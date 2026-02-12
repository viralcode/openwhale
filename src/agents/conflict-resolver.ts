/**
 * Conflict Resolver — File locking and merge for concurrent agent writes
 * 
 * When multiple agents try to modify the same file:
 * - Advisory file locks prevent simultaneous writes
 * - Conflict detection when two agents wrote the same file
 * - Automatic merge strategies (last-write-wins, append, manual)
 * - Conflict reports for review
 */

import { EventEmitter } from "node:events";

// ============== TYPES ==============

export type MergeStrategy = "last-write-wins" | "append" | "manual" | "first-write-wins";

export interface FileLock {
    filePath: string;
    lockedBy: string;       // agentId or runId
    lockedAt: number;
    expiresAt: number;
    purpose?: string;
}

export interface FileWrite {
    filePath: string;
    agentId: string;
    runId: string;
    content: string;
    writtenAt: number;
    checksum: string;
}

export interface Conflict {
    conflictId: string;
    filePath: string;
    writes: FileWrite[];
    resolvedBy?: MergeStrategy;
    resolvedAt?: number;
    resolvedContent?: string;
    status: "detected" | "resolved" | "manual_review";
}

// ============== SINGLETON ==============

const locks = new Map<string, FileLock>();
const recentWrites = new Map<string, FileWrite[]>();  // filePath → writes
const conflicts: Conflict[] = [];
export const conflictEvents = new EventEmitter();
conflictEvents.setMaxListeners(50);

// Default lock timeout: 30s
const DEFAULT_LOCK_TTL = 30000;

// ============== LOCKING ==============

/**
 * Try to acquire a lock on a file
 */
export function acquireLock(params: {
    filePath: string;
    lockedBy: string;
    ttlMs?: number;
    purpose?: string;
}): { acquired: boolean; lock?: FileLock; heldBy?: string } {
    cleanupExpiredLocks();

    const existing = locks.get(params.filePath);
    if (existing && existing.expiresAt > Date.now()) {
        // Already locked by someone else
        if (existing.lockedBy !== params.lockedBy) {
            return { acquired: false, heldBy: existing.lockedBy };
        }
        // Same agent — extend lock
        existing.expiresAt = Date.now() + (params.ttlMs || DEFAULT_LOCK_TTL);
        return { acquired: true, lock: existing };
    }

    const lock: FileLock = {
        filePath: params.filePath,
        lockedBy: params.lockedBy,
        lockedAt: Date.now(),
        expiresAt: Date.now() + (params.ttlMs || DEFAULT_LOCK_TTL),
        purpose: params.purpose,
    };

    locks.set(params.filePath, lock);
    return { acquired: true, lock };
}

/**
 * Release a file lock
 */
export function releaseLock(filePath: string, releasedBy: string): boolean {
    const lock = locks.get(filePath);
    if (!lock) return false;
    if (lock.lockedBy !== releasedBy) return false;

    locks.delete(filePath);
    return true;
}

/**
 * Check if file is locked
 */
export function isLocked(filePath: string): { locked: boolean; by?: string } {
    cleanupExpiredLocks();
    const lock = locks.get(filePath);
    if (!lock) return { locked: false };
    return { locked: true, by: lock.lockedBy };
}

/**
 * List all active locks
 */
export function listLocks(): FileLock[] {
    cleanupExpiredLocks();
    return Array.from(locks.values());
}

// ============== CONFLICT DETECTION ==============

/**
 * Record a file write by an agent
 */
export function recordWrite(params: {
    filePath: string;
    agentId: string;
    runId: string;
    content: string;
}): Conflict | null {
    const write: FileWrite = {
        filePath: params.filePath,
        agentId: params.agentId,
        runId: params.runId,
        content: params.content,
        writtenAt: Date.now(),
        checksum: simpleChecksum(params.content),
    };

    // Track write
    const existing = recentWrites.get(params.filePath) || [];
    existing.push(write);
    recentWrites.set(params.filePath, existing);

    // Check for conflicts: if another agent wrote to the same file within the last 60s
    const recentByOthers = existing.filter(w =>
        w.agentId !== params.agentId &&
        w.writtenAt > Date.now() - 60000
    );

    if (recentByOthers.length > 0) {
        // Conflict detected
        const conflict: Conflict = {
            conflictId: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            filePath: params.filePath,
            writes: [write, ...recentByOthers],
            status: "detected",
        };

        conflicts.push(conflict);

        conflictEvents.emit("conflict", {
            conflictId: conflict.conflictId,
            filePath: params.filePath,
            agents: conflict.writes.map(w => w.agentId),
        });

        return conflict;
    }

    return null;
}

/**
 * Resolve a conflict with a specific strategy
 */
export function resolveConflict(
    conflictId: string,
    strategy: MergeStrategy,
    manualContent?: string
): { resolved: boolean; content?: string } {
    const conflict = conflicts.find(c => c.conflictId === conflictId);
    if (!conflict) return { resolved: false };

    let resolvedContent: string;

    switch (strategy) {
        case "last-write-wins":
            // Use the most recent write
            const sorted = [...conflict.writes].sort((a, b) => b.writtenAt - a.writtenAt);
            resolvedContent = sorted[0].content;
            break;

        case "first-write-wins":
            const sortedFirst = [...conflict.writes].sort((a, b) => a.writtenAt - b.writtenAt);
            resolvedContent = sortedFirst[0].content;
            break;

        case "append":
            // Concatenate all writes with separators
            resolvedContent = conflict.writes
                .sort((a, b) => a.writtenAt - b.writtenAt)
                .map(w => `// === From agent: ${w.agentId} ===\n${w.content}`)
                .join('\n\n');
            break;

        case "manual":
            if (!manualContent) return { resolved: false };
            resolvedContent = manualContent;
            break;
    }

    conflict.resolvedBy = strategy;
    conflict.resolvedAt = Date.now();
    conflict.resolvedContent = resolvedContent;
    conflict.status = "resolved";

    conflictEvents.emit("resolved", {
        conflictId: conflict.conflictId,
        strategy,
        filePath: conflict.filePath,
    });

    return { resolved: true, content: resolvedContent };
}

/**
 * List conflicts (optionally filtered by status)
 */
export function listConflicts(status?: Conflict["status"]): Conflict[] {
    if (status) {
        return conflicts.filter(c => c.status === status);
    }
    return [...conflicts];
}

/**
 * Get a specific conflict
 */
export function getConflict(conflictId: string): Conflict | undefined {
    return conflicts.find(c => c.conflictId === conflictId);
}

// ============== HELPERS ==============

function cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [path, lock] of locks) {
        if (lock.expiresAt <= now) {
            locks.delete(path);
        }
    }
}

function simpleChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash.toString(16);
}

/**
 * Clean up old write records (older than 5 minutes)
 */
export function cleanupOldWrites(): void {
    const cutoff = Date.now() - 300000;
    for (const [path, writes] of recentWrites) {
        const filtered = writes.filter(w => w.writtenAt > cutoff);
        if (filtered.length === 0) {
            recentWrites.delete(path);
        } else {
            recentWrites.set(path, filtered);
        }
    }
}
