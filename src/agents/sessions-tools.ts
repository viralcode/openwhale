/**
 * Sessions Tools - Sub-agent spawn and send with lifecycle tracking
 * 
 * These tools are used by agents to spawn sub-agents and send messages
 * between sessions. They integrate with the subagent-registry for
 * lifecycle tracking and the session-service for actual AI execution.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "../tools/base.js";
import { registerRun, updateRunStatus } from "./subagent-registry.js";
import { getAgentConfig, canAgentSpawn } from "./agent-config.js";
import { buildSubAgentPrompt } from "./prompt-builder.js";
import { sessionBus } from "../tools/sessions-send-tool.js";

// ============== SESSIONS SPAWN ==============

export const sessionsSpawnSchema = z.object({
    task: z.string().describe("The task for the sub-agent to accomplish"),
    agentId: z.string().optional().default("main")
        .describe("Target agent ID to spawn (from agents_list)"),
    label: z.string().optional()
        .describe("Human-readable label for this sub-agent run"),
    waitForResult: z.boolean().optional().default(false)
        .describe("If true, wait for the sub-agent to complete and return its result"),
    timeout: z.number().min(5000).max(300000).optional().default(60000)
        .describe("Timeout in ms when waiting for result (default 60s)"),
    model: z.string().optional()
        .describe("Model override for this sub-agent run"),
});

export type SessionsSpawnParams = z.infer<typeof sessionsSpawnSchema>;

async function executeSessionsSpawn(
    params: SessionsSpawnParams,
    context: ToolCallContext
): Promise<ToolResult> {
    try {
        const sourceAgentId = context.agentId || "main";
        const targetAgentId = params.agentId || "main";

        // Check spawn permission
        if (sourceAgentId !== targetAgentId && !canAgentSpawn(sourceAgentId, targetAgentId)) {
            return {
                success: false,
                content: "",
                error: `Agent "${sourceAgentId}" is not allowed to spawn agent "${targetAgentId}". Check the allowAgents configuration.`,
            };
        }

        // Resolve target agent config
        const agentConfig = getAgentConfig(targetAgentId);
        if (!agentConfig) {
            return {
                success: false,
                content: "",
                error: `Agent "${targetAgentId}" not found. Use agents_list to see available agents.`,
            };
        }

        if (!agentConfig.enabled) {
            return {
                success: false,
                content: "",
                error: `Agent "${targetAgentId}" is disabled.`,
            };
        }

        // Determine model
        const model = params.model || agentConfig.model;

        // Register the run
        const run = registerRun({
            parentSessionId: context.sessionId,
            agentId: targetAgentId,
            task: params.task,
            model,
        });

        // Build the sub-agent prompt
        const _subAgentPrompt = buildSubAgentPrompt({
            parentAgentId: sourceAgentId,
            task: params.task,
            constraints: agentConfig.capabilities
                ? [`Available capabilities: ${agentConfig.capabilities.join(", ")}`]
                : undefined,
        });

        // Mark as running
        updateRunStatus(run.runId, "running");

        if (params.waitForResult) {
            // Synchronous mode: start real AI work and wait for result
            const { startAgentWork } = await import("./coordinator.js");
            await startAgentWork(
                run.runId,
                run.childSessionKey,
                params.task,
                targetAgentId,
                model,
            );

            // Re-fetch the run to get updated status
            const { getRun } = await import("./subagent-registry.js");
            const updatedRun = getRun(run.runId);

            return {
                success: true,
                content: JSON.stringify({
                    runId: run.runId,
                    agentId: targetAgentId,
                    status: updatedRun?.status || "completed",
                    result: updatedRun?.result || "Agent completed",
                    sessionKey: run.childSessionKey,
                }),
                metadata: { runId: run.runId, agentId: targetAgentId },
            };
        } else {
            // Async mode: fire-and-forget real AI work
            import("./coordinator.js").then(({ startAgentWork }) => {
                startAgentWork(
                    run.runId,
                    run.childSessionKey,
                    params.task,
                    targetAgentId,
                    model,
                ).catch(err => {
                    console.error(`[SessionsSpawn] Unhandled error for agent "${targetAgentId}":`, err);
                });
            });

            return {
                success: true,
                content: JSON.stringify({
                    runId: run.runId,
                    agentId: targetAgentId,
                    status: "running",
                    sessionKey: run.childSessionKey,
                    note: "Sub-agent spawned in background with real AI execution. Use sessions_list to check status.",
                }),
                metadata: { runId: run.runId, agentId: targetAgentId },
            };
        }
    } catch (error) {
        return {
            success: false,
            content: "",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export const sessionsSpawnTool: AgentTool<SessionsSpawnParams> = {
    name: "sessions_spawn",
    description: "Spawn a new sub-agent session to work on a task. The sub-agent runs in its own isolated session. Optionally wait for its result.",
    category: "communication",
    parameters: sessionsSpawnSchema,
    execute: executeSessionsSpawn,
};

// ============== SESSIONS SEND (Agent-level) ==============

export const agentSessionsSendSchema = z.object({
    sessionId: z.string().describe("Target session key (from sessions_list)"),
    message: z.string().describe("Message content to send"),
    waitForReply: z.boolean().optional().default(false)
        .describe("Wait for the target session to reply"),
    timeout: z.number().min(1000).max(60000).optional().default(30000)
        .describe("Reply timeout in ms"),
});

export type AgentSessionsSendParams = z.infer<typeof agentSessionsSendSchema>;

async function executeAgentSessionsSend(
    params: AgentSessionsSendParams,
    context: ToolCallContext
): Promise<ToolResult> {
    try {
        // Emit message on the bus
        sessionBus.emit(`message:${params.sessionId}`, {
            fromSessionId: context.sessionId,
            toSessionId: params.sessionId,
            content: params.message,
            timestamp: Date.now(),
            agentId: context.agentId,
        });

        if (params.waitForReply) {
            const replyPromise = new Promise<string | null>((resolve) => {
                const timeout = setTimeout(() => {
                    resolve(null);
                }, params.timeout);

                sessionBus.once(`reply:${context.sessionId}`, (reply: any) => {
                    clearTimeout(timeout);
                    resolve(reply.content || reply);
                });
            });

            const reply = await replyPromise;
            return {
                success: true,
                content: JSON.stringify({
                    delivered: true,
                    reply: reply || undefined,
                    timedOut: !reply,
                }),
                metadata: { targetSession: params.sessionId, gotReply: !!reply },
            };
        }

        return {
            success: true,
            content: JSON.stringify({
                delivered: true,
                note: "Message sent to session bus",
            }),
            metadata: { targetSession: params.sessionId },
        };
    } catch (error) {
        return {
            success: false,
            content: "",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export const agentSessionsSendTool: AgentTool<AgentSessionsSendParams> = {
    name: "agent_sessions_send",
    description: "Send a message to another session at the agent level. For cross-agent coordination.",
    category: "communication",
    parameters: agentSessionsSendSchema,
    execute: executeAgentSessionsSend,
};

export default sessionsSpawnTool;
