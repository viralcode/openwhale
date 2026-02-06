/**
 * DM Pairing System
 * 
 * Security for unknown senders - generates pairing codes.
 * Based on OpenClaw's pairing implementation.
 */

import { randomUUID, randomInt } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Human-friendly, no 0O1I
const PAIRING_PENDING_TTL_MS = 60 * 60 * 1000; // 1 hour
const PAIRING_PENDING_MAX = 3; // Max pending per channel

export type ChannelId = "whatsapp" | "telegram" | "discord" | "slack" | "twitter" | "imessage";

export interface PairingRequest {
    id: string;
    code: string;
    createdAt: string;
    lastSeenAt: string;
    meta?: Record<string, string>;
}

interface PairingStore {
    version: 1;
    requests: PairingRequest[];
}

interface AllowFromStore {
    version: 1;
    allowFrom: string[];
}

/**
 * Get pairing store directory
 */
function getStoreDir(): string {
    return path.join(os.homedir(), ".openwhale", "credentials");
}

/**
 * Safe channel key for filenames
 */
function safeChannelKey(channel: ChannelId): string {
    const raw = String(channel).trim().toLowerCase();
    if (!raw) throw new Error("Invalid pairing channel");
    return raw.replace(/[\\/:*?"<>|]/g, "_").replace(/\.\./g, "_");
}

/**
 * Get pairing file path
 */
function getPairingPath(channel: ChannelId): string {
    return path.join(getStoreDir(), `${safeChannelKey(channel)}-pairing.json`);
}

/**
 * Get allowlist file path
 */
function getAllowFromPath(channel: ChannelId): string {
    return path.join(getStoreDir(), `${safeChannelKey(channel)}-allowFrom.json`);
}

/**
 * Read JSON file safely
 */
async function readJSON<T>(filePath: string, fallback: T): Promise<T> {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/**
 * Write JSON file atomically
 */
async function writeJSON(filePath: string, value: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const tmp = path.join(dir, `${path.basename(filePath)}.${randomUUID()}.tmp`);
    await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
    await fs.chmod(tmp, 0o600);
    await fs.rename(tmp, filePath);
}

/**
 * Generate random pairing code
 */
function generateCode(): string {
    let out = "";
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
        const idx = randomInt(0, PAIRING_CODE_ALPHABET.length);
        out += PAIRING_CODE_ALPHABET[idx];
    }
    return out;
}

/**
 * Check if request is expired
 */
function isExpired(entry: PairingRequest, nowMs: number): boolean {
    const createdAt = Date.parse(entry.createdAt);
    if (!Number.isFinite(createdAt)) return true;
    return nowMs - createdAt > PAIRING_PENDING_TTL_MS;
}

/**
 * Prune expired requests
 */
function pruneExpired(requests: PairingRequest[], nowMs: number): PairingRequest[] {
    return requests.filter(req => !isExpired(req, nowMs));
}

// ============================================
// Public API
// ============================================

/**
 * Read channel allowlist
 */
export async function readAllowFrom(channel: ChannelId): Promise<string[]> {
    const filePath = getAllowFromPath(channel);
    const store = await readJSON<AllowFromStore>(filePath, { version: 1, allowFrom: [] });
    return Array.isArray(store.allowFrom) ? store.allowFrom.map(v => String(v).trim()).filter(Boolean) : [];
}

/**
 * Check if sender is allowed
 */
export async function isAllowed(channel: ChannelId, senderId: string): Promise<boolean> {
    const allowList = await readAllowFrom(channel);
    if (allowList.includes("*")) return true;
    return allowList.includes(senderId.trim());
}

/**
 * Add sender to allowlist
 */
export async function addToAllowList(channel: ChannelId, senderId: string): Promise<void> {
    const filePath = getAllowFromPath(channel);
    const store = await readJSON<AllowFromStore>(filePath, { version: 1, allowFrom: [] });
    const current = Array.isArray(store.allowFrom) ? store.allowFrom : [];
    const normalized = senderId.trim();

    if (!current.includes(normalized)) {
        current.push(normalized);
        await writeJSON(filePath, { version: 1, allowFrom: current });
        console.log(`[Pairing] Added ${normalized} to ${channel} allowlist`);
    }
}

/**
 * Remove sender from allowlist
 */
export async function removeFromAllowList(channel: ChannelId, senderId: string): Promise<boolean> {
    const filePath = getAllowFromPath(channel);
    const store = await readJSON<AllowFromStore>(filePath, { version: 1, allowFrom: [] });
    const current = Array.isArray(store.allowFrom) ? store.allowFrom : [];
    const normalized = senderId.trim();
    const next = current.filter(entry => entry !== normalized);

    if (next.length !== current.length) {
        await writeJSON(filePath, { version: 1, allowFrom: next });
        console.log(`[Pairing] Removed ${normalized} from ${channel} allowlist`);
        return true;
    }
    return false;
}

/**
 * List pending pairing requests
 */
export async function listPairingRequests(channel: ChannelId): Promise<PairingRequest[]> {
    const filePath = getPairingPath(channel);
    const store = await readJSON<PairingStore>(filePath, { version: 1, requests: [] });
    const requests = Array.isArray(store.requests) ? store.requests : [];
    const pruned = pruneExpired(requests, Date.now());

    // Save if pruned
    if (pruned.length !== requests.length) {
        await writeJSON(filePath, { version: 1, requests: pruned });
    }

    return pruned.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Create or update pairing request for a sender
 */
export async function upsertPairingRequest(
    channel: ChannelId,
    senderId: string,
    meta?: Record<string, string>
): Promise<{ code: string; created: boolean }> {
    const filePath = getPairingPath(channel);
    const store = await readJSON<PairingStore>(filePath, { version: 1, requests: [] });
    const now = new Date().toISOString();
    const nowMs = Date.now();

    let requests = Array.isArray(store.requests) ? store.requests : [];
    requests = pruneExpired(requests, nowMs);

    const id = senderId.trim();
    const existingIdx = requests.findIndex(r => r.id === id);
    const existingCodes = new Set(requests.map(r => r.code.toUpperCase()));

    // Generate unique code
    const generateUniqueCode = (): string => {
        for (let attempt = 0; attempt < 500; attempt++) {
            const code = generateCode();
            if (!existingCodes.has(code)) return code;
        }
        throw new Error("Failed to generate unique pairing code");
    };

    if (existingIdx >= 0) {
        // Update existing
        const existing = requests[existingIdx];
        requests[existingIdx] = {
            ...existing,
            lastSeenAt: now,
            meta: meta ?? existing.meta,
        };
        await writeJSON(filePath, { version: 1, requests });
        return { code: existing.code, created: false };
    }

    // Check max pending
    if (requests.length >= PAIRING_PENDING_MAX) {
        // Remove oldest
        requests.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        requests = requests.slice(-PAIRING_PENDING_MAX + 1);
    }

    // Create new
    const code = generateUniqueCode();
    const newRequest: PairingRequest = {
        id,
        code,
        createdAt: now,
        lastSeenAt: now,
        ...(meta ? { meta } : {}),
    };
    requests.push(newRequest);
    await writeJSON(filePath, { version: 1, requests });

    console.log(`[Pairing] New request for ${channel}: ${id} → ${code}`);
    return { code, created: true };
}

/**
 * Approve a pairing code
 */
export async function approvePairingCode(
    channel: ChannelId,
    code: string
): Promise<{ id: string; entry?: PairingRequest } | null> {
    const filePath = getPairingPath(channel);
    const store = await readJSON<PairingStore>(filePath, { version: 1, requests: [] });

    let requests = Array.isArray(store.requests) ? store.requests : [];
    requests = pruneExpired(requests, Date.now());

    const normalizedCode = code.trim().toUpperCase();
    const idx = requests.findIndex(r => r.code.toUpperCase() === normalizedCode);

    if (idx < 0) {
        await writeJSON(filePath, { version: 1, requests });
        return null;
    }

    const entry = requests[idx];
    requests.splice(idx, 1);
    await writeJSON(filePath, { version: 1, requests });

    // Add to allowlist
    await addToAllowList(channel, entry.id);

    console.log(`[Pairing] Approved: ${channel} ${entry.id}`);
    return { id: entry.id, entry };
}

/**
 * Get pairing response message
 */
export function getPairingMessage(code: string): string {
    return `🔐 OpenWhale doesn't recognize you yet.

To start chatting, share this pairing code with the owner:

**${code}**

They can approve you with:
\`openwhale pairing approve <channel> ${code}\`

This code expires in 1 hour.`;
}

export default {
    readAllowFrom,
    isAllowed,
    addToAllowList,
    removeFromAllowList,
    listPairingRequests,
    upsertPairingRequest,
    approvePairingCode,
    getPairingMessage,
};
