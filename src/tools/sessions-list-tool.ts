/**
 * Sessions List Tool - List active sessions for agent-to-agent coordination
 * 
 * Allows agents to discover other sessions (main, group, cron, hook, node)
 * and their metadata for coordination.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

export const sessionsListSchema = z.object({
    kinds: z.array(z.enum(["main", "group", "cron", "hook", "node", "other"])).optional()
        .describe("Filter by session kinds"),
    limit: z.number().min(1).max(100).optional()
        .describe("Maximum number of sessions to return"),
    activeMinutes: z.number().min(1).optional()
        .describe("Only include sessions active within this many minutes"),
    messageLimit: z.number().min(0).max(20).optional()
        .describe("Include last N messages from each session"),
});

export type SessionsListParams = z.infer<typeof sessionsListSchema>;

export interface SessionListEntry {
    key: string;
    kind: "main" | "group" | "cron" | "hook" | "node" | "other";
    channel?: string;
    label?: string;
    displayName?: string;
    model?: string;
    contextTokens?: number;
    totalTokens?: number;
    updatedAt?: number;
    messages?: Array<{ role: string; content: string; timestamp?: number }>;
}

/**
 * Classify session kind based on key pattern
 */
function classifySessionKind(key: string): SessionListEntry["kind"] {
    if (key === "main" || key === "global") return "main";
    if (key.startsWith("cron:")) return "cron";
    if (key.startsWith("hook:") || key.startsWith("webhook:")) return "hook";
    if (key.startsWith("node:")) return "node";
    if (key.includes("group") || key.includes("@g.us")) return "group";
    return "other";
}

/**
 * Extract channel from session key
 */
function deriveChannel(key: string): string | undefined {
    if (key.startsWith("whatsapp:")) return "whatsapp";
    if (key.startsWith("telegram:")) return "telegram";
    if (key.startsWith("discord:")) return "discord";
    if (key.startsWith("slack:")) return "slack";
    if (key.startsWith("twitter:")) return "twitter";
    if (key.startsWith("imessage:")) return "imessage";
    if (key.startsWith("web:")) return "web";
    return undefined;
}

/**
 * Execute sessions_list tool
 */
async function executeSessionsList(
    params: SessionsListParams,
    context: ToolCallContext
): Promise<ToolResult> {
    try {
        // Get sessions from context or simulated list
        const sessions: SessionListEntry[] = [];

        // For now, return current session info
        // In production, this would query the session store
        const currentSession: SessionListEntry = {
            key: context.sessionId,
            kind: classifySessionKind(context.sessionId),
            channel: deriveChannel(context.sessionId),
            updatedAt: Date.now(),
        };

        if (!params.kinds || params.kinds.includes(currentSession.kind)) {
            sessions.push(currentSession);
        }

        const result = {
            count: sessions.length,
            sessions,
            note: "Session list tool active. In production, queries full session store.",
        };

        return {
            success: true,
            content: JSON.stringify(result, null, 2),
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
