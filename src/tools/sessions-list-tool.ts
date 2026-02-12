/**
 * Sessions List Tool - List active sessions for agent-to-agent coordination
 * 
 * Real DB-backed implementation that queries the sessions table.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { db } from "../db/index.js";

export const sessionsListSchema = z.object({
    kinds: z.array(z.enum(["main", "group", "cron", "hook", "node", "sub", "other"])).optional()
        .describe("Filter by session kinds"),
    limit: z.number().min(1).max(100).optional()
        .describe("Maximum number of sessions to return"),
    activeMinutes: z.number().min(1).optional()
        .describe("Only include sessions active within this many minutes"),
    agentId: z.string().optional()
        .describe("Filter by agent ID"),
    messageLimit: z.number().min(0).max(20).optional()
        .describe("Include last N messages from each session"),
});

export type SessionsListParams = z.infer<typeof sessionsListSchema>;

export interface SessionListEntry {
    key: string;
    kind: "main" | "group" | "cron" | "hook" | "node" | "sub" | "other";
    channel?: string;
    agentId?: string;
    model?: string;
    messageCount?: number;
    updatedAt?: number;
    lastMessage?: string;
    messages?: Array<{ role: string; content: string; timestamp?: number }>;
}

function classifySessionKind(key: string): SessionListEntry["kind"] {
    if (key === "main" || key === "global" || key === "dashboard") return "main";
    if (key.startsWith("sub:")) return "sub";
    if (key.startsWith("cron:")) return "cron";
    if (key.startsWith("hook:") || key.startsWith("webhook:")) return "hook";
    if (key.startsWith("node:")) return "node";
    if (key.includes("group") || key.includes("@g.us")) return "group";
    return "other";
}

async function executeSessionsList(
    params: SessionsListParams,
    _context: ToolCallContext
): Promise<ToolResult> {
    try {
        let query = `
            SELECT s.id, s.key, s.agent_id, s.channel, s.model, s.last_message_at,
                   (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as msg_count,
                   (SELECT m2.content FROM messages m2 WHERE m2.session_id = s.id ORDER BY m2.created_at DESC LIMIT 1) as last_msg
            FROM sessions s
            WHERE 1=1
        `;
        const queryParams: any[] = [];

        if (params.agentId) {
            query += " AND s.agent_id = ?";
            queryParams.push(params.agentId);
        }

        if (params.activeMinutes) {
            const cutoff = Math.floor((Date.now() - params.activeMinutes * 60 * 1000) / 1000);
            query += " AND s.last_message_at >= ?";
            queryParams.push(cutoff);
        }

        query += " ORDER BY s.last_message_at DESC";
        query += ` LIMIT ${params.limit || 50}`;

        const rows = db.prepare(query).all(...queryParams) as any[];

        let sessions: SessionListEntry[] = rows.map(row => {
            const kind = classifySessionKind(row.key);
            const entry: SessionListEntry = {
                key: row.key,
                kind,
                agentId: row.agent_id || undefined,
                channel: row.channel || undefined,
                model: row.model || undefined,
                messageCount: row.msg_count || 0,
                updatedAt: row.last_message_at ? row.last_message_at * 1000 : undefined,
                lastMessage: row.last_msg ? row.last_msg.slice(0, 200) : undefined,
            };

            return entry;
        });

        // Filter by kinds if specified
        if (params.kinds?.length) {
            sessions = sessions.filter(s => params.kinds!.includes(s.kind));
        }

        // Include messages if requested
        if (params.messageLimit && params.messageLimit > 0) {
            for (const session of sessions) {
                try {
                    const sessionRow = db.prepare("SELECT id FROM sessions WHERE key = ?").get(session.key) as any;
                    if (sessionRow) {
                        const msgs = db.prepare(`
                            SELECT role, content, created_at FROM messages 
                            WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
                        `).all(sessionRow.id, params.messageLimit) as any[];

                        session.messages = msgs.reverse().map(m => ({
                            role: m.role,
                            content: m.content?.slice(0, 500) || "",
                            timestamp: m.created_at ? m.created_at * 1000 : undefined,
                        }));
                    }
                } catch {
                    // Skip messages for this session
                }
            }
        }

        return {
            success: true,
            content: JSON.stringify({
                count: sessions.length,
                sessions,
            }, null, 2),
            metadata: { count: sessions.length },
        };
    } catch (error) {
        return {
            success: false,
            content: "",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export const sessionsListTool: AgentTool<SessionsListParams> = {
    name: "sessions_list",
    description: "List active sessions (agents) with optional filters. Use this to discover other sessions for agent-to-agent coordination.",
    category: "communication",
    parameters: sessionsListSchema,
    execute: executeSessionsList,
};

export default sessionsListTool;
