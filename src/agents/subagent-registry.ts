/**
 * Sub-Agent Registry - Lifecycle tracking for sub-agent runs
 * 
 * Tracks all spawned sub-agent runs with:
 * - Status management (pending → running → completed/error/stopped)
 * - Stop/pause controls
 * - Token usage and duration tracking
 * - In-memory + SQLite persistence
 * - EventEmitter for real-time dashboard updates
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";

// ============== TYPES ==============

export interface SubagentRun {
    runId: string;
    parentSessionId: string;
    childSessionKey: string;
    agentId: string;
    task: string;
    status: "pending" | "running" | "completed" | "error" | "stopped" | "paused";
    createdAt: number;
    startedAt?: number;
    endedAt?: number;
    result?: string;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
}

export type SubagentEvent =
    | { type: "run_created"; run: SubagentRun }
    | { type: "run_started"; runId: string }
    | { type: "run_completed"; runId: string; result?: string }
    | { type: "run_error"; runId: string; error: string }
    | { type: "run_stopped"; runId: string }
    | { type: "run_paused"; runId: string }
    | { type: "run_progress"; runId: string; message: string };

// ============== SINGLETON ==============

const runs = new Map<string, SubagentRun>();
const abortControllers = new Map<string, AbortController>();
export const subagentEvents = new EventEmitter();
subagentEvents.setMaxListeners(50);

let tableReady = false;

function ensureTable(): void {
    if (tableReady) return;
    tableReady = true;
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS subagent_runs (
                run_id TEXT PRIMARY KEY,
                parent_session_id TEXT NOT NULL,
                child_session_key TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                task TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                result TEXT,
                error TEXT,
                model TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                created_at INTEGER DEFAULT (unixepoch()),
                started_at INTEGER,
                ended_at INTEGER
            )
        `);

        // Clean up stale runs from previous server sessions
        // Any run that was 'pending', 'running', or 'paused' when the server stopped
        // can never complete — mark them as stopped
        const staleCount = db.prepare(
            "UPDATE subagent_runs SET status = 'stopped', error = 'Server restarted', ended_at = unixepoch() WHERE status IN ('pending', 'running', 'paused')"
        ).run();

        if (staleCount.changes > 0) {
            console.log(`[SubagentRegistry] Cleaned up ${staleCount.changes} stale runs from previous session`);
        }
    } catch (e) {
        console.warn("[SubagentRegistry] Failed to init table:", e);
    }
}

// ============== API ==============

export function registerRun(params: {
    parentSessionId: string;
    agentId: string;
    task: string;
    model?: string;
}): SubagentRun {
    ensureTable();
    const runId = randomUUID();
    const childSessionKey = `sub:${params.agentId}:${runId.slice(0, 8)}`;
    const now = Date.now();

    const run: SubagentRun = {
        runId,
        parentSessionId: params.parentSessionId,
        childSessionKey,
        agentId: params.agentId,
        task: params.task,
        status: "pending",
        createdAt: now,
        model: params.model,
    };

    runs.set(runId, run);

    // Create AbortController for this run
    abortControllers.set(runId, new AbortController());

    // Persist
    try {
        db.prepare(`
            INSERT INTO subagent_runs (run_id, parent_session_id, child_session_key, agent_id, task, status, model, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(runId, params.parentSessionId, childSessionKey, params.agentId, params.task, "pending", params.model || null, Math.floor(now / 1000));
    } catch (e) {
        console.warn("[SubagentRegistry] Failed to persist run:", e);
    }

    subagentEvents.emit("event", { type: "run_created", run } as SubagentEvent);
    return run;
}

export function updateRunStatus(
    runId: string,
    status: SubagentRun["status"],
    details?: { result?: string; error?: string; inputTokens?: number; outputTokens?: number }
): void {
    ensureTable();
    const run = runs.get(runId);
    if (!run) return;

    run.status = status;
    const now = Date.now();

    if (status === "running" && !run.startedAt) {
        run.startedAt = now;
    }
    if (["completed", "error", "stopped"].includes(status)) {
        run.endedAt = now;
    }
    if (details?.result) run.result = details.result;
    if (details?.error) run.error = details.error;
    if (details?.inputTokens) run.inputTokens = details.inputTokens;
    if (details?.outputTokens) run.outputTokens = details.outputTokens;

    // Persist
    try {
        db.prepare(`
            UPDATE subagent_runs SET status = ?, result = ?, error = ?, input_tokens = ?, output_tokens = ?,
                started_at = ?, ended_at = ?
            WHERE run_id = ?
        `).run(
            status,
            run.result || null,
            run.error || null,
            run.inputTokens || null,
            run.outputTokens || null,
            run.startedAt ? Math.floor(run.startedAt / 1000) : null,
            run.endedAt ? Math.floor(run.endedAt / 1000) : null,
            runId
        );
    } catch (e) {
        console.warn("[SubagentRegistry] Failed to update run:", e);
    }

    // Emit appropriate event
    switch (status) {
        case "running": subagentEvents.emit("event", { type: "run_started", runId } as SubagentEvent); break;
        case "completed": subagentEvents.emit("event", { type: "run_completed", runId, result: details?.result } as SubagentEvent); break;
        case "error": subagentEvents.emit("event", { type: "run_error", runId, error: details?.error || "Unknown" } as SubagentEvent); break;
        case "stopped": subagentEvents.emit("event", { type: "run_stopped", runId } as SubagentEvent); break;
        case "paused": subagentEvents.emit("event", { type: "run_paused", runId } as SubagentEvent); break;
    }
}

export function stopRun(runId: string): boolean {
    const run = runs.get(runId);
    if (!run || !["running", "pending", "paused"].includes(run.status)) return false;

    // Signal abort
    const controller = abortControllers.get(runId);
    if (controller) {
        controller.abort();
        abortControllers.delete(runId);
    }

    updateRunStatus(runId, "stopped");
    return true;
}

export function pauseRun(runId: string): boolean {
    const run = runs.get(runId);
    if (!run || run.status !== "running") return false;

    updateRunStatus(runId, "paused");
    return true;
}

export function getAbortSignal(runId: string): AbortSignal | undefined {
    return abortControllers.get(runId)?.signal;
}

export function getRun(runId: string): SubagentRun | undefined {
    ensureTable();
    return runs.get(runId);
}

export function getActiveRuns(parentSessionId?: string): SubagentRun[] {
    ensureTable();
    const active = Array.from(runs.values()).filter(r =>
        ["pending", "running", "paused"].includes(r.status)
    );

    if (parentSessionId) {
        return active.filter(r => r.parentSessionId === parentSessionId);
    }
    return active;
}

export function getAllRuns(options?: {
    limit?: number;
    status?: SubagentRun["status"][];
}): SubagentRun[] {
    ensureTable();
    try {
        let query = "SELECT * FROM subagent_runs";
        const params: any[] = [];

        if (options?.status?.length) {
            const placeholders = options.status.map(() => "?").join(",");
            query += ` WHERE status IN (${placeholders})`;
            params.push(...options.status);
        }

        query += " ORDER BY created_at DESC";

        if (options?.limit) {
            query += " LIMIT ?";
            params.push(options.limit);
        }

        const rows = db.prepare(query).all(...params) as any[];
        return rows.map(rowToRun);
    } catch {
        return Array.from(runs.values());
    }
}

// ============== HELPERS ==============

function rowToRun(row: any): SubagentRun {
    return {
        runId: row.run_id,
        parentSessionId: row.parent_session_id,
        childSessionKey: row.child_session_key,
        agentId: row.agent_id,
        task: row.task,
        status: row.status,
        result: row.result || undefined,
        error: row.error || undefined,
        model: row.model || undefined,
        inputTokens: row.input_tokens || undefined,
        outputTokens: row.output_tokens || undefined,
        createdAt: (row.created_at || 0) * 1000,
        startedAt: row.started_at ? row.started_at * 1000 : undefined,
        endedAt: row.ended_at ? row.ended_at * 1000 : undefined,
    };
}
