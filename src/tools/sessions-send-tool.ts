/**
 * Sessions Send Tool - Send a message to another session
 * 
 * Allows agents to communicate with other sessions for coordination.
 * Supports reply-back mode for ping-pong conversations.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

// Event emitter for cross-session messaging
const sessionMessageHandlers = new Map<string, (message: CrossSessionMessage) => void>();

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

export interface CrossSessionMessage {
    fromSessionId: string;
    toSessionId: string;
    content: string;
    timestamp: number;
    isReply?: boolean;
}

/**
 * Register a handler for incoming cross-session messages
 */
export function registerSessionMessageHandler(
    sessionId: string,
    handler: (message: CrossSessionMessage) => void
): () => void {
    sessionMessageHandlers.set(sessionId, handler);
    return () => sessionMessageHandlers.delete(sessionId);
}

/**
 * Get handler for a session
 */
export function getSessionMessageHandler(sessionId: string) {
    return sessionMessageHandlers.get(sessionId);
}

/**
 * Execute sessions_send tool
 */
async function executeSessionsSend(
    params: SessionsSendParams,
    context: ToolCallContext
): Promise<ToolResult> {
    try {
        const message: CrossSessionMessage = {
            fromSessionId: context.sessionId,
            toSessionId: params.sessionId,
            content: params.announce
                ? `[Message from session: ${context.sessionId}]\n\n${params.message}`
                : params.message,
            timestamp: Date.now(),
        };

        // Try to deliver to active handler
        const handler = sessionMessageHandlers.get(params.sessionId);
        if (handler) {
            handler(message);
        }

        // If replyBack, wait for response
        if (params.replyBack && handler) {
            const replyPromise = new Promise<string | null>((resolve) => {
                const timeout = setTimeout(() => {
                    sessionMessageHandlers.delete(`${context.sessionId}:reply`);
                    resolve(null);
                }, params.replyTimeout);

                registerSessionMessageHandler(`${context.sessionId}:reply`, (reply) => {
                    clearTimeout(timeout);
                    sessionMessageHandlers.delete(`${context.sessionId}:reply`);
                    resolve(reply.content);
                });
            });

            const reply = await replyPromise;

            return {
                success: true,
                content: JSON.stringify({
                    delivered: true,
                    reply: reply || undefined,
                }),
                metadata: { targetSession: params.sessionId, gotReply: !!reply },
            };
        }

        return {
            success: true,
            content: JSON.stringify({
                delivered: !!handler,
                note: handler ? "Message delivered to active handler" : "Message queued (no active handler)",
            }),
            metadata: { targetSession: params.sessionId, delivered: !!handler },
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
