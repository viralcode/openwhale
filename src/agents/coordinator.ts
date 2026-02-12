/**
 * Fan-Out/Fan-In Coordinator
 * 
 * Orchestrates parallel multi-agent execution:
 * - Fan-out: Split a task and spawn multiple agents in parallel
 * - Fan-in: Wait for all agents to complete, collect and merge results
 * - Supports timeout, partial results, and automatic aggregation
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { registerRun, updateRunStatus, getRun, getAbortSignal, subagentEvents } from "./subagent-registry.js";
import { getAgentConfig, canAgentSpawn } from "./agent-config.js";

// ============== TYPES ==============

export interface FanOutTask {
    agentId: string;
    task: string;
    model?: string;
    label?: string;
}

export interface FanOutResult {
    agentId: string;
    runId: string;
    label?: string;
    status: "completed" | "error" | "stopped" | "timeout";
    result?: string;
    error?: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
}

export interface CoordinatedTask {
    coordinationId: string;
    parentSessionId: string;
    sourceAgentId: string;
    tasks: FanOutTask[];
    status: "pending" | "running" | "completed" | "partial" | "error";
    results: FanOutResult[];
    runIds: string[];
    createdAt: number;
    completedAt?: number;
    timeoutMs: number;
    aggregatedResult?: string;
}

// ============== SINGLETON ==============

const coordinatedTasks = new Map<string, CoordinatedTask>();
export const coordinatorEvents = new EventEmitter();
coordinatorEvents.setMaxListeners(50);

// ============== REAL AGENT EXECUTION ==============

/**
 * Start real AI work for a sub-agent run.
 * Calls processMessage from session-service with the agent's task,
 * tracking tool calls and updating run status on completion/error.
 */
export async function startAgentWork(
    runId: string,
    childSessionKey: string,
    task: string,
    agentId: string,
    model?: string,
    coordinationContext?: {
        coordinationId: string;
        siblings: Array<{ agentId: string; sessionKey: string; label?: string; task: string }>;
    },
): Promise<void> {
    try {
        // Dynamic import to avoid circular dependencies
        const { processMessage } = await import("../sessions/session-service.js");

        console.log(`[Coordinator] 🚀 Starting real AI work for agent "${agentId}" (run: ${runId.slice(0, 8)})`);

        // Build the task with coordination context if siblings exist
        let fullTask = task;
        if (coordinationContext && coordinationContext.siblings.length > 0) {
            const siblingList = coordinationContext.siblings
                .map(s => `  - Agent "${s.agentId}" (session: ${s.sessionKey})${s.label ? ` — ${s.label}` : ""}: ${s.task.slice(0, 100)}`)
                .join("\n");

            fullTask = `${task}

---
**🤝 Inter-Agent Coordination**
You are part of a multi-agent team working in parallel. Here are your sibling agents:
${siblingList}

**Coordination namespace**: \`${coordinationContext.coordinationId}\`

You can communicate with your siblings if needed:
- **Send a message**: Use the \`sessions_send\` tool with a sibling's session key
- **Share data**: Use \`shared_context_write\` with namespace "${coordinationContext.coordinationId}" to share findings
- **Read shared data**: Use \`shared_context_read\` with namespace "${coordinationContext.coordinationId}" to read what others shared
- **Check who's active**: Use \`sessions_list\` to see active sessions

You don't HAVE to communicate — only do so if your task would genuinely benefit from collaboration or if you have findings relevant to another agent's work.
---`;
        }
        // Emit progress event
        subagentEvents.emit("event", {
            type: "run_progress",
            runId,
            message: `Starting AI execution for task: ${task.slice(0, 80)}...`,
        });

        const result = await processMessage(childSessionKey, fullTask, {
            model: model || undefined,
            maxIterations: 15,
            abortSignal: getAbortSignal(runId),
            // Only prevent sub-agents from recursively spawning more agents
            // Allow communication tools (sessions_send, sessions_list, sessions_history, shared_context_*)
            // so agents can talk to each other during fan-out execution
            excludeTools: ["sessions_fanout", "sessions_spawn"],
            onToolStart: (toolInfo) => {
                console.log(`[Coordinator] 🔧 Agent "${agentId}" calling: ${toolInfo.name}`);
                subagentEvents.emit("event", {
                    type: "run_tool_start",
                    runId,
                    tool: toolInfo.name,
                    args: typeof toolInfo.arguments === 'string'
                        ? (toolInfo.arguments as string).slice(0, 200)
                        : JSON.stringify(toolInfo.arguments || {}).slice(0, 200),
                });
                subagentEvents.emit("event", {
                    type: "run_progress",
                    runId,
                    message: `Executing tool: ${toolInfo.name}`,
                });
            },
            onToolEnd: (toolInfo) => {
                subagentEvents.emit("event", {
                    type: "run_tool_end",
                    runId,
                    tool: toolInfo.name,
                    status: toolInfo.status || 'completed',
                    result: typeof toolInfo.result === 'string'
                        ? toolInfo.result.slice(0, 300)
                        : JSON.stringify(toolInfo.result || '').slice(0, 300),
                });
                subagentEvents.emit("event", {
                    type: "run_progress",
                    runId,
                    message: `Tool ${toolInfo.name}: ${toolInfo.status}`,
                });
            },
        });

        // Success — update run with actual result
        updateRunStatus(runId, "completed", {
            result: result.content || "Agent completed (no output)",
        });

        console.log(`[Coordinator] ✅ Agent "${agentId}" completed (run: ${runId.slice(0, 8)})`);

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Coordinator] ❌ Agent "${agentId}" failed (run: ${runId.slice(0, 8)}):`, errorMsg);

        updateRunStatus(runId, "error", { error: errorMsg });
    }
}

// ============== CORE API ==============

/**
 * Fan-out: Spawn multiple agents in parallel for sub-tasks
 */
export function fanOut(params: {
    parentSessionId: string;
    sourceAgentId: string;
    tasks: FanOutTask[];
    timeoutMs?: number;
}): CoordinatedTask {
    const coordinationId = randomUUID();
    const runIds: string[] = [];

    // Register all sub-agent runs first (to collect session keys for sibling info)
    const registrations: Array<{ task: FanOutTask; runId: string; childSessionKey: string; model: string | undefined }> = [];
    for (const task of params.tasks) {
        // Check spawn permission
        if (!canAgentSpawn(params.sourceAgentId, task.agentId)) {
            throw new Error(`Agent "${params.sourceAgentId}" cannot spawn agent "${task.agentId}"`);
        }

        const agentConfig = getAgentConfig(task.agentId);
        if (!agentConfig || !agentConfig.enabled) {
            throw new Error(`Agent "${task.agentId}" not found or disabled`);
        }

        const run = registerRun({
            parentSessionId: params.parentSessionId,
            agentId: task.agentId,
            task: task.task,
            model: task.model || agentConfig.model,
        });

        runIds.push(run.runId);
        registrations.push({
            task,
            runId: run.runId,
            childSessionKey: run.childSessionKey,
            model: task.model || agentConfig.model,
        });
    }

    // Now start all agents with coordination context (sibling awareness)
    for (const reg of registrations) {
        // Build sibling list (all agents except current one)
        const siblings = registrations
            .filter(r => r.runId !== reg.runId)
            .map(r => ({
                agentId: r.task.agentId,
                sessionKey: r.childSessionKey,
                label: r.task.label,
                task: r.task.task,
            }));

        updateRunStatus(reg.runId, "running");
        startAgentWork(
            reg.runId,
            reg.childSessionKey,
            reg.task.task,
            reg.task.agentId,
            reg.model,
            {
                coordinationId,
                siblings,
            },
        ).catch(err => {
            console.error(`[Coordinator] Unhandled error in agent "${reg.task.agentId}":`, err);
        });
    }

    const coordinated: CoordinatedTask = {
        coordinationId,
        parentSessionId: params.parentSessionId,
        sourceAgentId: params.sourceAgentId,
        tasks: params.tasks,
        status: "running",
        results: [],
        runIds,
        createdAt: Date.now(),
        timeoutMs: params.timeoutMs || 120000,
    };

    coordinatedTasks.set(coordinationId, coordinated);

    coordinatorEvents.emit("fanout_started", {
        coordinationId,
        taskCount: params.tasks.length,
        agents: params.tasks.map(t => t.agentId),
    });

    return coordinated;
}

/**
 * Fan-in: Wait for all agents in a coordinated task to complete
 * Returns aggregated results
 */
export async function fanIn(coordinationId: string): Promise<CoordinatedTask> {
    const coordinated = coordinatedTasks.get(coordinationId);
    if (!coordinated) {
        throw new Error(`Coordinated task "${coordinationId}" not found`);
    }

    // Since we verified above, we know coordinated is defined
    const task = coordinated;

    return new Promise((resolve) => {
        // Set up timeout
        const timeout = setTimeout(() => {
            clearInterval(pollInterval);
            finalize(true);
        }, task.timeoutMs);

        // Poll for completion
        const pollInterval = setInterval(() => {
            checkCompletion();
        }, 500);

        function checkCompletion() {
            const results: FanOutResult[] = [];
            let allDone = true;

            for (let i = 0; i < task.runIds.length; i++) {
                const runId = task.runIds[i];
                const run = getRun(runId);
                const subtask = task.tasks[i];

                if (!run) {
                    console.log(`[Coordinator] ⚠️ checkCompletion: run ${runId.slice(0, 8)} not found`);
                    results.push({
                        agentId: subtask.agentId,
                        runId,
                        label: subtask.label,
                        status: "error",
                        error: "Run not found",
                    });
                    continue;
                }

                console.log(`[Coordinator] 🔍 checkCompletion: run ${runId.slice(0, 8)} (${subtask.agentId}) status=${run.status}`);

                if (["completed", "error", "stopped"].includes(run.status)) {
                    results.push({
                        agentId: subtask.agentId,
                        runId,
                        label: subtask.label,
                        status: run.status as FanOutResult["status"],
                        result: run.result,
                        error: run.error,
                        durationMs: run.endedAt && run.startedAt ? run.endedAt - run.startedAt : undefined,
                        inputTokens: run.inputTokens,
                        outputTokens: run.outputTokens,
                    });
                } else {
                    allDone = false;
                }
            }

            task.results = results;

            if (allDone) {
                console.log(`[Coordinator] ✅ All ${task.runIds.length} runs done. Results: ${results.map(r => `${r.agentId}=${r.status}`).join(', ')}`);
                clearInterval(pollInterval);
                clearTimeout(timeout);
                finalize(false);
            }
        }

        function finalize(_timedOut: boolean) {
            // Collect any remaining incomplete runs
            for (let i = 0; i < task.runIds.length; i++) {
                const existing = task.results.find(r => r.runId === task.runIds[i]);
                if (!existing) {
                    const subtask = task.tasks[i];
                    task.results.push({
                        agentId: subtask.agentId,
                        runId: task.runIds[i],
                        label: subtask.label,
                        status: "timeout",
                        error: "Agent did not complete within timeout",
                    });
                }
            }

            const completedCount = task.results.filter(r => r.status === "completed").length;
            const totalCount = task.tasks.length;

            if (completedCount === totalCount) {
                task.status = "completed";
            } else if (completedCount > 0) {
                task.status = "partial";
            } else {
                task.status = "error";
            }

            task.completedAt = Date.now();

            // Aggregate results
            task.aggregatedResult = aggregateResults(task);

            coordinatorEvents.emit("fanin_completed", {
                coordinationId: task.coordinationId,
                status: task.status,
                completedCount,
                totalCount,
            });

            resolve(task);
        }

        // Immediately check if any are already done
        checkCompletion();
    });
}

/**
 * Get status of a coordinated task
 */
export function getCoordinatedTask(coordinationId: string): CoordinatedTask | undefined {
    return coordinatedTasks.get(coordinationId);
}

/**
 * List all coordinated tasks
 */
export function listCoordinatedTasks(limit: number = 20): CoordinatedTask[] {
    return Array.from(coordinatedTasks.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
}

/**
 * Stop all agents in a coordinated task
 */
export function stopCoordinatedTask(coordinationId: string): boolean {
    const coordinated = coordinatedTasks.get(coordinationId);
    if (!coordinated || coordinated.status !== "running") return false;

    const { stopRun } = require("./subagent-registry.js");
    for (const runId of coordinated.runIds) {
        const run = getRun(runId);
        if (run && ["pending", "running", "paused"].includes(run.status)) {
            stopRun(runId);
        }
    }

    coordinated.status = "error";
    coordinated.completedAt = Date.now();
    return true;
}

// ============== AGGREGATION ==============

function aggregateResults(coordinated: CoordinatedTask): string {
    const parts: string[] = [];

    parts.push(`## Coordinated Task Results`);
    parts.push(`**Status**: ${coordinated.status}`);
    parts.push(`**Agents**: ${coordinated.tasks.length}`);
    parts.push(`**Duration**: ${coordinated.completedAt ? Math.round((coordinated.completedAt - coordinated.createdAt) / 1000) : '?'}s`);
    parts.push('');

    for (const result of coordinated.results) {
        const label = result.label || result.agentId;
        const statusEmoji = result.status === "completed" ? "✅" : result.status === "error" ? "❌" : result.status === "timeout" ? "⏰" : "🛑";

        parts.push(`### ${statusEmoji} ${label}`);

        if (result.result) {
            parts.push(result.result);
        } else if (result.error) {
            parts.push(`**Error**: ${result.error}`);
        }

        if (result.durationMs) {
            parts.push(`*Duration: ${Math.round(result.durationMs / 1000)}s*`);
        }

        parts.push('');
    }

    return parts.join('\n');
}
