/**
 * OpenWhale Session Store
 * 
 * Manages session metadata for all channels. Sessions persist conversation
 * history across messages and restarts, with configurable reset policies.
 * 
 * Based on OpenClaw's session management architecture.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Session storage directory
const SESSIONS_DIR = join(homedir(), ".openwhale", "sessions");
const SESSIONS_FILE = join(SESSIONS_DIR, "sessions.json");
const TRANSCRIPTS_DIR = join(SESSIONS_DIR, "transcripts");

// Ensure directories exist
if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
}
if (!existsSync(TRANSCRIPTS_DIR)) {
    mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
}

/**
 * Session entry stored in sessions.json
 */
export interface SessionEntry {
    sessionId: string;
    sessionKey: string;
    channel: string;
    userId?: string;
    displayName?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
}

/**
 * Session store - maps session keys to session entries
 */
interface SessionStore {
    sessions: Record<string, SessionEntry>;
    lastResetAt?: string;
}

// In-memory cache
let sessionStore: SessionStore | null = null;

/**
 * Load session store from disk
 */
export function loadSessionStore(): SessionStore {
    if (sessionStore) {
        return sessionStore;
    }

    try {
        if (existsSync(SESSIONS_FILE)) {
            const data = readFileSync(SESSIONS_FILE, "utf-8");
            sessionStore = JSON.parse(data);
            return sessionStore!;
        }
    } catch (err) {
        console.error("[Sessions] Failed to load sessions.json:", err);
    }

    sessionStore = { sessions: {} };
    return sessionStore;
}

/**
 * Save session store to disk
 */
export function saveSessionStore(): void {
    if (!sessionStore) return;

    try {
        writeFileSync(SESSIONS_FILE, JSON.stringify(sessionStore, null, 2));
    } catch (err) {
        console.error("[Sessions] Failed to save sessions.json:", err);
    }
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
}

/**
 * Build session key from channel and user info
 */
export function buildSessionKey(channel: string, type: "dm" | "group", userId: string): string {
    return `${channel}:${type}:${userId}`;
}

/**
 * Check if session should be reset (daily reset at 4 AM)
 */
function shouldResetSession(entry: SessionEntry): boolean {
    const now = new Date();
    const lastUpdate = new Date(entry.updatedAt);

    // Get today's 4 AM
    const today4am = new Date(now);
    today4am.setHours(4, 0, 0, 0);

    // If before 4 AM today, use yesterday's 4 AM
    if (now < today4am) {
        today4am.setDate(today4am.getDate() - 1);
    }

    // Reset if last update was before the reset time
    return lastUpdate < today4am;
}

/**
 * Get or create a session for a given key
 */
export function getOrCreateSession(
    sessionKey: string,
    channel: string,
    userId?: string,
    displayName?: string
): SessionEntry {
    const store = loadSessionStore();

    let entry: SessionEntry | undefined = store.sessions[sessionKey];

    // Check if session exists and should be reset
    if (entry && shouldResetSession(entry)) {
        console.log(`[Sessions] Resetting stale session: ${sessionKey}`);
        delete store.sessions[sessionKey];
        entry = undefined;
    }

    if (!entry) {
        entry = {
            sessionId: generateSessionId(),
            sessionKey,
            channel,
            userId,
            displayName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
            inputTokens: 0,
            outputTokens: 0,
        };
        store.sessions[sessionKey] = entry;
        saveSessionStore();
        console.log(`[Sessions] Created new session: ${sessionKey} -> ${entry.sessionId}`);
    }

    return entry;
}

/**
 * Update session after a message exchange
 */
export function updateSession(
    sessionKey: string,
    inputTokens: number = 0,
    outputTokens: number = 0
): void {
    const store = loadSessionStore();
    const entry = store.sessions[sessionKey];

    if (entry) {
        entry.updatedAt = new Date().toISOString();
        entry.messageCount++;
        entry.inputTokens += inputTokens;
        entry.outputTokens += outputTokens;
        saveSessionStore();
    }
}

/**
 * Reset a session (start fresh)
 */
export function resetSession(sessionKey: string): SessionEntry | null {
    const store = loadSessionStore();
    const existing = store.sessions[sessionKey];

    if (existing) {
        // Create new session with same key
        const newEntry: SessionEntry = {
            sessionId: generateSessionId(),
            sessionKey,
            channel: existing.channel,
            userId: existing.userId,
            displayName: existing.displayName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
            inputTokens: 0,
            outputTokens: 0,
        };
        store.sessions[sessionKey] = newEntry;
        saveSessionStore();
        console.log(`[Sessions] Reset session: ${sessionKey} -> ${newEntry.sessionId}`);
        return newEntry;
    }

    return null;
}

/**
 * Get all sessions
 */
export function getAllSessions(): SessionEntry[] {
    const store = loadSessionStore();
    return Object.values(store.sessions);
}

/**
 * Get session by key
 */
export function getSession(sessionKey: string): SessionEntry | undefined {
    const store = loadSessionStore();
    return store.sessions[sessionKey];
}

/**
 * Delete a session
 */
export function deleteSession(sessionKey: string): boolean {
    const store = loadSessionStore();
    if (store.sessions[sessionKey]) {
        delete store.sessions[sessionKey];
        saveSessionStore();
        return true;
    }
    return false;
}

/**
 * Get the transcripts directory path
 */
export function getTranscriptsDir(): string {
    return TRANSCRIPTS_DIR;
}

/**
 * Get transcript file path for a session
 */
export function getTranscriptPath(sessionId: string): string {
    return join(TRANSCRIPTS_DIR, `${sessionId}.jsonl`);
}
