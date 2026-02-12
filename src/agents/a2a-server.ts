/**
 * A2A Server — Agent2Agent Protocol Server Implementation
 * 
 * Bridges A2A protocol requests to OpenWhale's session service.
 * Implements the A2A server role: receives tasks from external clients,
 * processes them via OpenWhale's AI loop, and returns results.
 */

import { randomUUID } from "crypto";
import type {
    AgentCard,
    AgentSkill,
    A2ATask,
    A2AMessage,
    Artifact,
    SendMessageParams,
    GetTaskParams,
    CancelTaskParams,
    JsonRpcRequest,
    JsonRpcResponse,
} from "./a2a-types.js";
import { A2AErrorCodes as ErrorCodes } from "./a2a-types.js";
import { toolRegistry } from "../tools/index.js";
import * as sessionService from "../sessions/session-service.js";

// ============== TASK STORE ==============

const tasks = new Map<string, A2ATask>();

// ============== AGENT CARD ==============

/**
 * Generate the OpenWhale Agent Card describing capabilities.
 * This is served at /.well-known/agent.json
 */
export function getAgentCard(baseUrl: string): AgentCard {
    // Build skills from registered tools
    const tools = toolRegistry.list();
    const skills: AgentSkill[] = tools.map(t => ({
        id: t.name,
        name: t.name,
        description: t.description || `OpenWhale ${t.name} tool`,
        tags: [t.name],
        inputModes: ["text/plain", "application/json"],
        outputModes: ["text/plain", "application/json"],
    }));

    // Add meta-skills for high-level capabilities
    skills.unshift(
        {
            id: "general-assistant",
            name: "General AI Assistant",
            description: "Multi-model AI assistant with access to 33+ tools including shell commands, file management, browser automation, code execution, and more.",
            tags: ["ai", "assistant", "tools", "automation"],
            examples: [
                "Write a Python script that sorts a list of numbers",
                "Browse https://news.ycombinator.com and summarize the top stories",
                "Create a PDF report about today's weather",
            ],
            inputModes: ["text/plain"],
            outputModes: ["text/plain", "application/json"],
        },
        {
            id: "multi-agent-coordination",
            name: "Multi-Agent Coordinator",
            description: "Fan-out complex tasks to multiple parallel AI agents with shared memory and file locks, then synthesize results.",
            tags: ["multi-agent", "coordination", "fan-out", "parallel"],
            examples: [
                "Research quantum computing AND write a sorting algorithm simultaneously",
                "Compare React vs Vue by researching both in parallel",
            ],
            inputModes: ["text/plain"],
            outputModes: ["text/plain", "application/json"],
        }
    );

    return {
        name: "OpenWhale",
        description: "Multi-Agent AI Operating System — Deploy autonomous AI agent swarms that coordinate, communicate, and conquer complex tasks in parallel. 33+ built-in tools, 8 AI providers, 6 messaging channels.",
        version: "1.0.0",
        supportedInterfaces: [
            {
                url: `${baseUrl}/a2a`,
                protocolBinding: "JSONRPC",
                protocolVersion: "1.0",
            },
        ],
        provider: {
            organization: "OpenWhale",
            url: "https://viralcode.github.io/openwhale",
        },
        capabilities: {
            streaming: true,
            pushNotifications: false,
            stateTransitionHistory: true,
        },
        defaultInputModes: ["text/plain", "application/json"],
        defaultOutputModes: ["text/plain", "application/json"],
        skills,
    };
}

// ============== MESSAGE HANDLER ==============

/**
 * Extract text content from A2A message parts
 */
function extractText(message: A2AMessage): string {
    return message.parts
        .map(p => {
            if (p.text) return p.text;
            if (p.data) return JSON.stringify(p.data);
            return "";
        })
        .filter(Boolean)
        .join("\n");
}

/**
 * Handle SendMessage — process a message and return a completed task
 */
export async function handleSendMessage(params: SendMessageParams): Promise<A2ATask> {
    const taskId = randomUUID();
    const contextId = params.message.contextId || randomUUID();
    const sessionId = `a2a-${contextId}`;

    // Create task in submitted state
    const task: A2ATask = {
        id: taskId,
        contextId,
        status: {
            state: "submitted",
            timestamp: new Date().toISOString(),
        },
        history: [params.message],
        artifacts: [],
    };
    tasks.set(taskId, task);

    // Transition to working
    task.status = {
        state: "working",
        timestamp: new Date().toISOString(),
    };

    try {
        const textContent = extractText(params.message);

        // Process through OpenWhale's session service
        const result = await sessionService.processMessage(sessionId, textContent, {
            maxIterations: 25,
        });

        // Create artifact from the response
        const artifact: Artifact = {
            artifactId: randomUUID(),
            name: "response",
            description: "AI assistant response",
            parts: [{ text: result.content, mediaType: "text/plain" }],
        };

        // Include tool call info if present
        if (result.toolCalls && result.toolCalls.length > 0) {
            artifact.parts.push({
                data: result.toolCalls.map(tc => ({
                    name: tc.name,
                    arguments: tc.arguments,
                    result: tc.result,
                    status: tc.status,
                })),
                mediaType: "application/json",
            });
        }

        task.artifacts = [artifact];

        // Add agent response to history
        const agentMessage: A2AMessage = {
            messageId: randomUUID(),
            contextId,
            taskId,
            role: "agent",
            parts: [{ text: result.content, mediaType: "text/plain" }],
        };
        task.history!.push(agentMessage);

        // Transition to completed
        task.status = {
            state: "completed",
            message: agentMessage,
            timestamp: new Date().toISOString(),
        };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.status = {
            state: "failed",
            message: {
                messageId: randomUUID(),
                role: "agent",
                parts: [{ text: `Error: ${errorMsg}` }],
            },
            timestamp: new Date().toISOString(),
        };
    }

    return task;
}

/**
 * Handle SendStreamingMessage — process with SSE streaming
 * Returns an async generator of task status updates
 */
export async function* handleSendStreamingMessage(
    params: SendMessageParams
): AsyncGenerator<{ type: "status" | "artifact" | "message"; data: unknown }> {
    const taskId = randomUUID();
    const contextId = params.message.contextId || randomUUID();
    const sessionId = `a2a-${contextId}`;

    // Create task
    const task: A2ATask = {
        id: taskId,
        contextId,
        status: {
            state: "submitted",
            timestamp: new Date().toISOString(),
        },
        history: [params.message],
        artifacts: [],
    };
    tasks.set(taskId, task);

    // Emit submitted status
    yield { type: "status", data: { task: { id: taskId, contextId, status: task.status } } };

    // Transition to working
    task.status = { state: "working", timestamp: new Date().toISOString() };
    yield { type: "status", data: { task: { id: taskId, contextId, status: task.status } } };

    try {
        const textContent = extractText(params.message);
        let fullContent = "";

        // Use streaming processor
        const chunks: Array<{ type: string; data: unknown }> = [];
        const emitPromise = new Promise<void>((resolve) => {
            const emit = (event: string, data: unknown) => {
                chunks.push({ type: event, data });
            };

            sessionService.processMessageStream(sessionId, textContent, {
                maxIterations: 25,
                emit,
            }).then((result) => {
                fullContent = result.content;
                resolve();
            }).catch((err) => {
                fullContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
                resolve();
            });
        });

        // Wait for processing to complete
        await emitPromise;

        // Yield message events from collected chunks
        for (const chunk of chunks) {
            if (chunk.type === "content") {
                yield {
                    type: "message",
                    data: {
                        message: {
                            messageId: randomUUID(),
                            role: "agent",
                            parts: [{ text: (chunk.data as { text: string }).text }],
                        },
                    },
                };
            } else if (chunk.type === "tool_start" || chunk.type === "tool_end") {
                yield {
                    type: "status",
                    data: {
                        task: {
                            id: taskId,
                            status: {
                                state: "working",
                                message: {
                                    messageId: randomUUID(),
                                    role: "agent",
                                    parts: [{ data: chunk.data, mediaType: "application/json" }],
                                },
                            },
                        },
                    },
                };
            }
        }

        // Create final artifact
        const artifact: Artifact = {
            artifactId: randomUUID(),
            name: "response",
            parts: [{ text: fullContent, mediaType: "text/plain" }],
        };
        task.artifacts = [artifact];
        yield { type: "artifact", data: { task: { id: taskId }, artifact } };

        // Complete
        const agentMessage: A2AMessage = {
            messageId: randomUUID(),
            contextId,
            taskId,
            role: "agent",
            parts: [{ text: fullContent, mediaType: "text/plain" }],
        };
        task.history!.push(agentMessage);
        task.status = {
            state: "completed",
            message: agentMessage,
            timestamp: new Date().toISOString(),
        };
        yield { type: "status", data: { task: { id: taskId, contextId, status: task.status } } };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.status = {
            state: "failed",
            message: {
                messageId: randomUUID(),
                role: "agent",
                parts: [{ text: `Error: ${errorMsg}` }],
            },
            timestamp: new Date().toISOString(),
        };
        yield { type: "status", data: { task: { id: taskId, contextId, status: task.status } } };
    }
}

// ============== TASK MANAGEMENT ==============

/**
 * Handle GetTask — retrieve task state by ID
 */
export function handleGetTask(params: GetTaskParams): A2ATask | null {
    const task = tasks.get(params.id);
    if (!task) return null;

    // Optionally trim history
    if (params.historyLength !== undefined && task.history) {
        const trimmed = { ...task };
        trimmed.history = task.history.slice(-params.historyLength);
        return trimmed;
    }

    return task;
}

/**
 * Handle CancelTask — cancel an in-progress task
 */
export function handleCancelTask(params: CancelTaskParams): A2ATask | null {
    const task = tasks.get(params.id);
    if (!task) return null;

    // Can only cancel tasks that are in progress
    if (task.status.state === "completed" || task.status.state === "failed" || task.status.state === "canceled") {
        return null; // Return null to signal not cancelable
    }

    task.status = {
        state: "canceled",
        timestamp: new Date().toISOString(),
    };

    return task;
}

// ============== JSON-RPC DISPATCHER ==============

/**
 * Process a JSON-RPC 2.0 request and return the appropriate response
 */
export async function processJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params } = request;

    try {
        switch (method) {
            case "SendMessage": {
                const msgParams = params as unknown as SendMessageParams;
                if (!msgParams?.message) {
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: ErrorCodes.INVALID_PARAMS,
                            message: "Missing required parameter: message",
                        },
                    };
                }
                const task = await handleSendMessage(msgParams);
                return { jsonrpc: "2.0", id, result: { task } };
            }

            case "GetTask": {
                const getParams = params as unknown as GetTaskParams;
                if (!getParams?.id) {
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: ErrorCodes.INVALID_PARAMS,
                            message: "Missing required parameter: id",
                        },
                    };
                }
                const task = handleGetTask(getParams);
                if (!task) {
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: ErrorCodes.TASK_NOT_FOUND,
                            message: `Task "${getParams.id}" not found`,
                        },
                    };
                }
                return { jsonrpc: "2.0", id, result: { task } };
            }

            case "CancelTask": {
                const cancelParams = params as unknown as CancelTaskParams;
                if (!cancelParams?.id) {
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: ErrorCodes.INVALID_PARAMS,
                            message: "Missing required parameter: id",
                        },
                    };
                }
                const task = handleCancelTask(cancelParams);
                if (!task) {
                    const existing = tasks.get(cancelParams.id);
                    if (!existing) {
                        return {
                            jsonrpc: "2.0",
                            id,
                            error: {
                                code: ErrorCodes.TASK_NOT_FOUND,
                                message: `Task "${cancelParams.id}" not found`,
                            },
                        };
                    }
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: ErrorCodes.TASK_NOT_CANCELABLE,
                            message: `Task "${cancelParams.id}" is in terminal state: ${existing.status.state}`,
                        },
                    };
                }
                return { jsonrpc: "2.0", id, result: { task } };
            }

            default:
                return {
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: ErrorCodes.METHOD_NOT_FOUND,
                        message: `Method "${method}" not found. Supported: SendMessage, SendStreamingMessage, GetTask, CancelTask`,
                    },
                };
        }
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
            jsonrpc: "2.0",
            id,
            error: {
                code: ErrorCodes.INTERNAL_ERROR,
                message: `Internal error: ${errorMsg}`,
            },
        };
    }
}

/**
 * List all tasks (for debugging/admin)
 */
export function listTasks(): A2ATask[] {
    return Array.from(tasks.values());
}

/**
 * Get task count
 */
export function getTaskCount(): number {
    return tasks.size;
}
