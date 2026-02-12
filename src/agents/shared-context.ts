/**
 * Shared Context — Inter-agent memory for coordinated tasks
 * 
 * Provides a shared key-value store that agents in the same task group
 * can read from and write to, enabling collaboration without direct messaging.
 * 
 * Features:
 * - Namespaced contexts (per coordination group or custom namespace)
 * - Key-value storage with metadata (who wrote, when)
 * - TTL support for auto-expiring entries
 * - Event notifications when context is updated
 */

import { EventEmitter } from "node:events";
import { db } from "../db/index.js";

// ============== TYPES ==============

export interface ContextEntry {
    key: string;
    value: string;
    namespace: string;
    writtenBy: string;       // agentId or sessionId 
    writtenAt: number;       // timestamp
    expiresAt?: number;      // optional TTL expiry
    version: number;         // increments on each update
    metadata?: Record<string, string>;
}

export interface ContextNamespace {
    name: string;
    entries: Map<string, ContextEntry>;
    createdAt: number;
    lastUpdatedAt: number;
}

// ============== SINGLETON ==============

const namespaces = new Map<string, ContextNamespace>();
export const contextEvents = new EventEmitter();
contextEvents.setMaxListeners(50);

let tableReady = false;

function ensureTable(): void {
    if (tableReady) return;
    tableReady = true;
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS shared_context (
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                written_by TEXT NOT NULL,
                written_at INTEGER NOT NULL DEFAULT (unixepoch()),
                expires_at INTEGER,
                version INTEGER NOT NULL DEFAULT 1,
                metadata TEXT,
                PRIMARY KEY (namespace, key)
            )
        `);

        // Load existing contexts
        const rows = db.prepare(
            "SELECT * FROM shared_context WHERE expires_at IS NULL OR expires_at > unixepoch()"
        ).all() as any[];

        for (const row of rows) {
            const ns = getOrCreateNamespace(row.namespace);
            ns.entries.set(row.key, {
                key: row.key,
                value: row.value,
                namespace: row.namespace,
                writtenBy: row.written_by,
                writtenAt: row.written_at * 1000,
                expiresAt: row.expires_at ? row.expires_at * 1000 : undefined,
                version: row.version,
                metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            });
        }

        if (rows.length > 0) {
            console.log(`[SharedContext] Loaded ${rows.length} entries from DB`);
        }
    } catch (e) {
        console.warn("[SharedContext] Failed to init table:", e);
    }
}

// ============== API ==============

/**
 * Write a key-value pair to a namespace
 */
export function writeContext(params: {
    namespace: string;
    key: string;
    value: string;
    writtenBy: string;
    ttlMs?: number;
    metadata?: Record<string, string>;
}): ContextEntry {
    ensureTable();
    const ns = getOrCreateNamespace(params.namespace);
    const existing = ns.entries.get(params.key);
    const now = Date.now();

    const entry: ContextEntry = {
        key: params.key,
        value: params.value,
        namespace: params.namespace,
        writtenBy: params.writtenBy,
        writtenAt: now,
        expiresAt: params.ttlMs ? now + params.ttlMs : undefined,
        version: existing ? existing.version + 1 : 1,
        metadata: params.metadata,
    };

    ns.entries.set(params.key, entry);
    ns.lastUpdatedAt = now;

    // Persist
    try {
        db.prepare(`
            INSERT INTO shared_context (namespace, key, value, written_by, written_at, expires_at, version, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(namespace, key) DO UPDATE SET
                value = excluded.value,
                written_by = excluded.written_by,
                written_at = excluded.written_at,
                expires_at = excluded.expires_at,
                version = excluded.version,
                metadata = excluded.metadata
        `).run(
            params.namespace,
            params.key,
            params.value,
            params.writtenBy,
            Math.floor(now / 1000),
            entry.expiresAt ? Math.floor(entry.expiresAt / 1000) : null,
            entry.version,
            params.metadata ? JSON.stringify(params.metadata) : null
        );
    } catch (e) {
        console.warn("[SharedContext] Failed to persist:", e);
    }

    contextEvents.emit("write", {
        namespace: params.namespace,
        key: params.key,
        writtenBy: params.writtenBy,
        version: entry.version,
    });

    return entry;
}

/**
 * Read a specific key from a namespace
 */
export function readContext(namespace: string, key: string): ContextEntry | undefined {
    ensureTable();
    const ns = namespaces.get(namespace);
    if (!ns) return undefined;

    const entry = ns.entries.get(key);
    if (!entry) return undefined;

    // Check expiry
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
        ns.entries.delete(key);
        cleanupExpiredEntry(namespace, key);
        return undefined;
    }

    return entry;
}

/**
 * Read all entries in a namespace
 */
export function readNamespace(namespace: string): ContextEntry[] {
    ensureTable();
    const ns = namespaces.get(namespace);
    if (!ns) return [];

    const now = Date.now();
    const entries: ContextEntry[] = [];

    for (const [key, entry] of ns.entries) {
        if (entry.expiresAt && entry.expiresAt < now) {
            ns.entries.delete(key);
            cleanupExpiredEntry(namespace, key);
            continue;
        }
        entries.push(entry);
    }

    return entries.sort((a, b) => b.writtenAt - a.writtenAt);
}

/**
 * List all namespaces
 */
export function listNamespaces(): Array<{ name: string; entryCount: number; lastUpdatedAt: number }> {
    ensureTable();
    return Array.from(namespaces.values()).map(ns => ({
        name: ns.name,
        entryCount: ns.entries.size,
        lastUpdatedAt: ns.lastUpdatedAt,
    }));
}

/**
 * Delete a key from a namespace
 */
export function deleteContextKey(namespace: string, key: string): boolean {
    ensureTable();
    const ns = namespaces.get(namespace);
    if (!ns) return false;

    const deleted = ns.entries.delete(key);
    if (deleted) {
        try {
            db.prepare("DELETE FROM shared_context WHERE namespace = ? AND key = ?").run(namespace, key);
        } catch { }
    }
    return deleted;
}

/**
 * Clear an entire namespace
 */
export function clearNamespace(namespace: string): void {
    ensureTable();
    namespaces.delete(namespace);
    try {
        db.prepare("DELETE FROM shared_context WHERE namespace = ?").run(namespace);
    } catch { }
}

// ============== HELPERS ==============

function getOrCreateNamespace(name: string): ContextNamespace {
    let ns = namespaces.get(name);
    if (!ns) {
        ns = {
            name,
            entries: new Map(),
            createdAt: Date.now(),
            lastUpdatedAt: Date.now(),
        };
        namespaces.set(name, ns);
    }
    return ns;
}

function cleanupExpiredEntry(namespace: string, key: string): void {
    try {
        db.prepare("DELETE FROM shared_context WHERE namespace = ? AND key = ?").run(namespace, key);
    } catch { }
}
