import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "../tools/base.js";
import { AgentRunner } from "./runner.js";
import type { DrizzleDB } from "../db/connection.js";

const SessionsSpawnSchema = z.object({
    task: z.string().describe("The task for the sub-agent to complete"),
    model: z.string().optional().describe("Model to use for the sub-agent"),
    timeout: z.number().optional().default(60000).describe("Timeout in milliseconds"),
    background: z.boolean().optional().default(false).describe("Run in background without waiting"),
});

type SessionsSpawnParams = z.infer<typeof SessionsSpawnSchema>;

let dbInstance: DrizzleDB | null = null;

export function initializeSessionTools(db: DrizzleDB): void {
    dbInstance = db;
}

export const sessionsSpawnTool: AgentTool<SessionsSpawnParams> = {
    name: "sessions_spawn",
    description: "Spawn a new sub-agent to complete a specific task in the background.",
    category: "communication",
    parameters: SessionsSpawnSchema,

    async execute(params: SessionsSpawnParams, context: ToolCallContext): Promise<ToolResult> {
        if (!dbInstance) {
            return {
                success: false,
                content: "",
                error: "Database not initialized for session spawning",
            };
        }

        const runner = new AgentRunner(dbInstance);
        const subSessionKey = `sub:${context.sessionId}:${Date.now()}`;

        if (params.background) {
            // Fire and forget
            setImmediate(async () => {
                try {
                    await runner.run(subSessionKey, params.task, {
                        model: params.model,
                        systemPromptOverride: `You are a sub-agent. Complete this task efficiently: ${params.task}`,
                    });
                } catch (err) {
                    console.error("Background sub-agent failed:", err);
                }
            });

            return {
                success: true,
                content: `Sub-agent spawned in background with session: ${subSessionKey}`,
                metadata: { sessionKey: subSessionKey, background: true },
            };
        }

        // Wait for completion with timeout
        try {
            const result = await Promise.race([
                runner.run(subSessionKey, params.task, {
                    model: params.model,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Sub-agent timed out")), params.timeout)
                ),
            ]);

            return {
                success: true,
                content: result.response,
                metadata: {
                    sessionKey: subSessionKey,
                    inputTokens: result.inputTokens,
                    outputTokens: result.outputTokens,
                    model: result.model,
                },
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                content: "",
                error: message,
            };
        }
    },
};

// Session send tool for A2A communication
const SessionsSendSchema = z.object({
    targetSession: z.string().describe("The session key to send message to"),
    message: z.string().describe("Message to send to the target agent"),
    waitForReply: z.boolean().optional().default(true).describe("Wait for a reply"),
    timeout: z.number().optional().default(30000).describe("Reply timeout in ms"),
});

type SessionsSendParams = z.infer<typeof SessionsSendSchema>;

export const sessionsSendTool: AgentTool<SessionsSendParams> = {
    name: "sessions_send",
    description: "Send a message to another agent session for agent-to-agent communication.",
    category: "communication",
    parameters: SessionsSendSchema,

    async execute(params: SessionsSendParams, context: ToolCallContext): Promise<ToolResult> {
        if (!dbInstance) {
            return {
                success: false,
                content: "",
                error: "Database not initialized",
            };
        }

        const runner = new AgentRunner(dbInstance);

        try {
            const result = await runner.run(params.targetSession, params.message, {
                systemPromptOverride: `You are receiving a message from agent session "${context.sessionId}". Respond appropriately.`,
            });

            return {
                success: true,
                content: result.response,
                metadata: {
                    targetSession: params.targetSession,
                    inputTokens: result.inputTokens,
                    outputTokens: result.outputTokens,
                },
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                content: "",
                error: message,
            };
        }
    },
};
