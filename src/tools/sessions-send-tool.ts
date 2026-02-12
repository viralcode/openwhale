/**
 * Sessions Send Tool - Send a message to another session
 * 
 * Real cross-session messaging using EventEmitter bus.
 * Supports reply-back mode for synchronous agent-to-agent conversations.
 */

import { z } from "zod";
import { EventEmitter } from "node:events";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { db } from "../db/index.js";

// ============== CROSS-SESSION MESSAGE BUS ==============

export const sessionBus = new EventEmitter();
sessionBus.setMaxListeners(100);

export interface CrossSessionMessage {
    fromSessionId: string;
    toSessionId: string;
    content: string;
    timestamp: number;
    isReply?: boolean;
    agentId?: string;
}

// Map of session handlers for direct delivery
const sessionMessageHandlers = new Map<string, (message: CrossSessionMessage) => void>();

export function registerSessionMessageHandler(
    sessionId: string,
    handler: (message: CrossSessionMessage) => void
): () => void {
    sessionMessageHandlers.set(sessionId, handler);
    return () => sessionMessageHandlers.delete(sessionId);
}

export function getSessionMessageHandler(sessionId: string) {
    return sessionMessageHandlers.get(sessionId);
}

// ============== SCHEMA ==============

export const sessionsSendSchema = z.object({
    sessionId: z.string().describe("Target session key/ID (from sessions_list)"),
    message: z.string().describe("Message content to send to the session"),
    replyBack: z.boolean().optional().default(false)
        .describe("If true, wait for and return the target session's response"),
    replyTimeout: z.number().min(1000).max(60000).optional().default(30000)
        .describe("Timeout in ms when waiting for reply (default 30s)"),
    announce: z.boolean().optional().default(true)
        .describe("If true, announce the sender to the target session"),
});

export type SessionsSendParams = z.infer<typeof sessionsSendSchema>;

// ============== EXECUTION ==============

async function executeSessionsSend(
    params: SessionsSendParams,
    context: ToolCallContext
): Promise<ToolResult> {
    try {
        // Validate target session exists
        const targetSession = db.prepare(
            "SELECT id, key, agent_id FROM sessions WHERE key = ? OR id = ?"
        ).get(params.sessionId, params.sessionId) as any;

        const targetKey = targetSession?.key || params.sessionId;

        const message: CrossSessionMessage = {
            fromSessionId: context.sessionId,
            toSessionId: targetKey,
            content: params.announce
                ? `[Message from session: ${context.sessionId}]\n\n${params.message}`
                : params.message,
            timestamp: Date.now(),
            agentId: context.agentId,
        };

        // Try direct handler delivery
        const handler = sessionMessageHandlers.get(targetKey);
        if (handler) {
            handler(message);
        }

        // Also emit on the bus (for any listeners)
        sessionBus.emit("message", message);
        sessionBus.emit(`message:${targetKey}`, message);

        // If replyBack, wait for response
        if (params.replyBack) {
            const replyPromise = new Promise<string | null>((resolve) => {
                const timeout = setTimeout(() => {
                    sessionBus.removeAllListeners(`reply:${context.sessionId}`);
                    resolve(null);
                }, params.replyTimeout);

                sessionBus.once(`reply:${context.sessionId}`, (reply: CrossSessionMessage) => {
                    clearTimeout(timeout);
                    resolve(reply.content);
                });
            });

            const reply = await replyPromise;

            return {
                success: true,
                content: JSON.stringify({
                    delivered: true,
                    targetSession: targetKey,
                    targetAgent: targetSession?.agent_id,
                    reply: reply || undefined,
                    timedOut: !reply,
                }),
                metadata: { targetSession: targetKey, gotReply: !!reply },
            };
        }

        return {
            success: true,
            content: JSON.stringify({
                delivered: !!handler,
                targetSession: targetKey,
                targetAgent: targetSession?.agent_id,
                note: handler
                    ? "Message delivered to active handler"
                    : targetSession
                        ? "Message emitted on bus (no active handler — session may be idle)"
                        : "Target session not found in DB; message emitted on bus",
            }),
            metadata: { targetSession: targetKey, delivered: !!handler },
        };
    } catch (error) {
        return {
            success: false,
            content: "",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export const sessionsSendTool: AgentTool<SessionsSendParams> = {
    name: "sessions_send",
    description: "Send a message to another session for agent-to-agent coordination. Optionally wait for a reply.",
    category: "communication",
    parameters: sessionsSendSchema,
    execute: executeSessionsSend,
};

export default sessionsSendTool;
