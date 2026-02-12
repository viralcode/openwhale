/**
 * Fan-Out Tool — Spawn multiple agents in parallel with automatic result aggregation
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { fanOut, fanIn } from "../agents/coordinator.js";

export const sessionsFanoutTool: AgentTool = {
    name: "sessions_fanout",
    description: `Spawn multiple agents in parallel to work on sub-tasks, then automatically wait for all to complete and aggregate results.

This implements the "fan-out/fan-in" pattern:
1. Fan-out: Each sub-task is assigned to a specific agent and runs concurrently
2. Fan-in: Results from all agents are collected and merged into a single response

Use this when a complex task can be broken into independent sub-tasks handled by different agents.`,

    category: "communication",

    parameters: z.object({
        tasks: z.array(z.object({
            agentId: z.string().describe("ID of the agent to assign this sub-task to"),
            task: z.string().describe("Description of the sub-task for this agent"),
            label: z.string().optional().describe("Human-readable label for this sub-task (e.g. 'Research', 'Code')"),
            model: z.string().optional().describe("Optional model override for this agent"),
        })).min(1).max(10).describe("Array of sub-tasks to fan out to agents"),
        timeoutMs: z.number().optional().default(120000).describe("Max time to wait for all agents (default: 120s)"),
        waitForResults: z.boolean().optional().default(true).describe("If true, wait for all agents to complete before returning"),
    }),

    async execute(params: {
        tasks: Array<{ agentId: string; task: string; label?: string; model?: string }>;
        timeoutMs?: number;
        waitForResults?: boolean;
    }, context: ToolCallContext): Promise<ToolResult> {
        try {
            const sourceAgentId = context.agentId || "main";
            const sessionId = context.sessionId || "unknown";

            // Fan-out: spawn all agents
            const coordinated = fanOut({
                parentSessionId: sessionId,
                sourceAgentId,
                tasks: params.tasks,
                timeoutMs: params.timeoutMs,
            });

            const output: string[] = [
                `✅ Fan-out started: ${params.tasks.length} agents spawned`,
                `Coordination ID: ${coordinated.coordinationId}`,
                '',
                '**Agents:**',
            ];

            for (let i = 0; i < params.tasks.length; i++) {
                output.push(`- ${params.tasks[i].label || params.tasks[i].agentId}: run ${coordinated.runIds[i]}`);
            }

            // If waiting for results, do fan-in
            if (params.waitForResults !== false) {
                output.push('', '⏳ Waiting for all agents to complete...');

                const result = await fanIn(coordinated.coordinationId);

                output.push('', `**Status: ${result.status}**`);

                if (result.aggregatedResult) {
                    output.push('', result.aggregatedResult);
                }
            } else {
                output.push('', 'ℹ️ Not waiting for results. Use coordination ID to check status later.');
            }

            return { success: true, content: output.join('\n') };
        } catch (e: any) {
            return {
                success: false,
                content: `Fan-out failed: ${e.message}`,
                error: e.message,
            };
        }
    },
};
