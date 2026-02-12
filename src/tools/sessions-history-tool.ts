/**
 * Sessions History Tool - Fetch transcript history for a session
 * 
 * Real DB-backed implementation that queries the messages table.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { db } from "../db/index.js";

export const sessionsHistorySchema = z.object({
    sessionId: z.string().describe("Session key/ID to fetch history from (from sessions_list)"),
    limit: z.number().min(1).max(100).optional().default(20)
        .describe("Maximum number of messages to return"),
    before: z.number().optional()
        .describe("Only include messages before this timestamp (Unix ms)"),
    after: z.number().optional()
        .describe("Only include messages after this timestamp (Unix ms)"),
});

export type SessionsHistoryParams = z.infer<typeof sessionsHistorySchema>;

export interface HistoryMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp: number;
    toolName?: string;
    model?: string;
}

async function executeSessionsHistory(
    params: SessionsHistoryParams,
    _context: ToolCallContext
): Promise<ToolResult> {
    try {
        // Resolve session ID from key
        const sessionRow = db.prepare(
            "SELECT id, key, agent_id FROM sessions WHERE key = ? OR id = ?"
        ).get(params.sessionId, params.sessionId) as any;

        if (!sessionRow) {
            return {
                success: true,
                content: JSON.stringify({
                    sessionId: params.sessionId,
                    count: 0,
                    messages: [],
                    note: "Session not found",
                }),
                metadata: { sessionId: params.sessionId, count: 0 },
            };
        }

        let query = `
            SELECT role, content, model, tool_calls, created_at 
            FROM messages 
            WHERE session_id = ?
        `;
        const queryParams: any[] = [sessionRow.id];

        if (params.before) {
            query += " AND created_at < ?";
            queryParams.push(Math.floor(params.before / 1000));
        }
        if (params.after) {
            query += " AND created_at > ?";
            queryParams.push(Math.floor(params.after / 1000));
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        queryParams.push(params.limit || 20);

        const rows = db.prepare(query).all(...queryParams) as any[];

        const messages: HistoryMessage[] = rows.reverse().map(row => ({
            role: row.role,
            content: (row.content || "").slice(0, 2000),
            timestamp: row.created_at ? row.created_at * 1000 : 0,
            model: row.model || undefined,
        }));

        return {
            success: true,
            content: JSON.stringify({
                sessionId: params.sessionId,
                sessionKey: sessionRow.key,
                agentId: sessionRow.agent_id,
                count: messages.length,
                messages,
            }, null, 2),
            metadata: { sessionId: params.sessionId, count: messages.length },
        };
    } catch (error) {
        return {
            success: false,
            content: "",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export const sessionsHistoryTool: AgentTool<SessionsHistoryParams> = {
    name: "sessions_history",
    description: "Fetch conversation history for a session. Use this to read what happened in another session for context.",
    category: "communication",
    parameters: sessionsHistorySchema,
    execute: executeSessionsHistory,
};

export default sessionsHistoryTool;
