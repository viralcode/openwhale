/**
 * Conflict Resolution Tools — File locking and conflict management for multi-agent writes
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import {
    acquireLock,
    releaseLock,
    isLocked,
    listLocks,
    resolveConflict,
    listConflicts,
    type MergeStrategy,
} from "../agents/conflict-resolver.js";

// ============== FILE LOCK ==============

export const fileLockTool: AgentTool = {
    name: "file_lock",
    description: `Acquire or release an advisory lock on a file to prevent concurrent modifications by other agents.

Use this before modifying a file that other agents might also be modifying. Always release the lock after your write is complete.`,

    category: "utility",

    parameters: z.object({
        action: z.enum(["acquire", "release", "check", "list"]).describe("Lock action to perform"),
        filePath: z.string().optional().describe("File path to lock/unlock/check. Required for acquire/release/check"),
        ttlMs: z.number().optional().default(30000).describe("Lock timeout in ms (default: 30s). Lock auto-releases after this"),
        purpose: z.string().optional().describe("Why you need the lock (for other agents' visibility)"),
    }),

    async execute(params: {
        action: "acquire" | "release" | "check" | "list";
        filePath?: string;
        ttlMs?: number;
        purpose?: string;
    }, context: ToolCallContext): Promise<ToolResult> {
        try {
            const agentId = context.agentId || context.sessionId || "unknown";

            switch (params.action) {
                case "acquire": {
                    if (!params.filePath) return { success: false, content: "filePath required for acquire", error: "Missing filePath" };
                    const result = acquireLock({
                        filePath: params.filePath,
                        lockedBy: agentId,
                        ttlMs: params.ttlMs,
                        purpose: params.purpose,
                    });
                    if (result.acquired) {
                        return { success: true, content: `🔒 Lock acquired on "${params.filePath}" (expires in ${(params.ttlMs || 30000) / 1000}s)` };
                    }
                    return { success: false, content: `⚠️ File "${params.filePath}" is already locked by ${result.heldBy}. Try again later.` };
                }

                case "release": {
                    if (!params.filePath) return { success: false, content: "filePath required for release", error: "Missing filePath" };
                    const released = releaseLock(params.filePath, agentId);
                    return { success: true, content: released ? `🔓 Lock released on "${params.filePath}"` : `No lock held by you on "${params.filePath}"` };
                }

                case "check": {
                    if (!params.filePath) return { success: false, content: "filePath required for check", error: "Missing filePath" };
                    const status = isLocked(params.filePath);
                    return { success: true, content: status.locked ? `🔒 Locked by: ${status.by}` : `🔓 Not locked` };
                }

                case "list": {
                    const allLocks = listLocks();
                    if (allLocks.length === 0) return { success: true, content: "No active file locks." };
                    const lines = allLocks.map(l =>
                        `- 🔒 ${l.filePath} — locked by ${l.lockedBy}${l.purpose ? ` (${l.purpose})` : ''} — expires in ${Math.round((l.expiresAt - Date.now()) / 1000)}s`
                    );
                    return { success: true, content: `**Active File Locks:**\n${lines.join('\n')}` };
                }
            }

            return { success: false, content: "Unknown action", error: "Unknown action" };
        } catch (e: any) {
            return { success: false, content: `Lock operation failed: ${e.message}`, error: e.message };
        }
    },
};

// ============== CONFLICT MANAGEMENT ==============

export const conflictsTool: AgentTool = {
    name: "conflicts_manage",
    description: `View and resolve file conflicts that occurred when multiple agents modified the same file.

Merge strategies:
- last-write-wins: Use the most recent write (default)
- first-write-wins: Use the earliest write
- append: Concatenate all writes with agent attribution
- manual: Provide your own merged content`,

    category: "utility",

    parameters: z.object({
        action: z.enum(["list", "resolve"]).describe("Action: list conflicts or resolve one"),
        status: z.enum(["detected", "resolved", "manual_review"]).optional().describe("Filter by status when listing"),
        conflictId: z.string().optional().describe("Conflict ID to resolve (required for resolve action)"),
        strategy: z.enum(["last-write-wins", "first-write-wins", "append", "manual"]).optional().describe("Merge strategy (required for resolve action)"),
        manualContent: z.string().optional().describe("Manual merged content (required when strategy is 'manual')"),
    }),

    async execute(params: {
        action: "list" | "resolve";
        status?: "detected" | "resolved" | "manual_review";
        conflictId?: string;
        strategy?: MergeStrategy;
        manualContent?: string;
    }, _context: ToolCallContext): Promise<ToolResult> {
        try {
            if (params.action === "list") {
                const allConflicts = listConflicts(params.status);
                if (allConflicts.length === 0) {
                    return { success: true, content: "No conflicts found." };
                }
                const lines = allConflicts.map(c => {
                    const agents = c.writes.map(w => w.agentId).join(', ');
                    const statusEmoji = c.status === "detected" ? "⚠️" : c.status === "resolved" ? "✅" : "👀";
                    return `${statusEmoji} **${c.conflictId}**\n  File: ${c.filePath}\n  Agents: ${agents}\n  Status: ${c.status}${c.resolvedBy ? ` (${c.resolvedBy})` : ''}`;
                });
                return { success: true, content: `**Conflicts (${allConflicts.length}):**\n\n${lines.join('\n\n')}` };
            }

            if (params.action === "resolve") {
                if (!params.conflictId || !params.strategy) {
                    return { success: false, content: "conflictId and strategy required for resolve", error: "Missing params" };
                }
                const result = resolveConflict(params.conflictId, params.strategy, params.manualContent);
                if (result.resolved) {
                    return { success: true, content: `✅ Conflict "${params.conflictId}" resolved with strategy: ${params.strategy}` };
                }
                return { success: false, content: `Failed to resolve conflict`, error: "Resolution failed" };
            }

            return { success: false, content: "Unknown action", error: "Unknown action" };
        } catch (e: any) {
            return { success: false, content: `Conflict operation failed: ${e.message}`, error: e.message };
        }
    },
};
