import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { DrizzleDB } from "../../db/connection.js";
import type { OpenWhaleConfig } from "../../config/loader.js";
import { registry } from "../../providers/base.js";
import type { CompletionRequest, Message } from "../../providers/base.js";

export function createAgentRoutes(_db: DrizzleDB, _config: OpenWhaleConfig) {
    const agent = new Hono();

    // Chat completions (OpenAI-compatible endpoint)
    agent.post("/chat/completions", async (c) => {
        const body = await c.req.json<{
            model: string;
            messages: Array<{ role: string; content: string }>;
            max_tokens?: number;
            temperature?: number;
            stream?: boolean;
            tools?: Array<{
                type: string;
                function: { name: string; description: string; parameters: unknown }
            }>;
        }>();

        const request: CompletionRequest = {
            model: body.model,
            messages: body.messages.map(m => ({
                role: m.role as Message["role"],
                content: m.content,
            })),
            maxTokens: body.max_tokens,
            temperature: body.temperature,
            tools: body.tools?.map(t => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters as Record<string, unknown>,
            })),
        };

        if (body.stream) {
            return streamSSE(c, async (stream) => {
                const id = `chatcmpl-${Date.now()}`;

                for await (const event of registry.stream(request)) {
                    if (event.type === "text") {
                        await stream.writeSSE({
                            data: JSON.stringify({
                                id,
                                object: "chat.completion.chunk",
                                created: Math.floor(Date.now() / 1000),
                                model: body.model,
                                choices: [{
                                    index: 0,
                                    delta: { content: event.text },
                                    finish_reason: null,
                                }],
                            }),
                        });
                    } else if (event.type === "done") {
                        await stream.writeSSE({
                            data: JSON.stringify({
                                id,
                                object: "chat.completion.chunk",
                                created: Math.floor(Date.now() / 1000),
                                model: body.model,
                                choices: [{
                                    index: 0,
                                    delta: {},
                                    finish_reason: "stop",
                                }],
                                usage: {
                                    prompt_tokens: event.inputTokens ?? 0,
                                    completion_tokens: event.outputTokens ?? 0,
                                    total_tokens: (event.inputTokens ?? 0) + (event.outputTokens ?? 0),
                                },
                            }),
                        });
                        await stream.writeSSE({ data: "[DONE]" });
                    }
                }
            });
        }

        const response = await registry.complete(request);

        return c.json({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: response.model,
            choices: [{
                index: 0,
                message: {
                    role: "assistant",
                    content: response.content,
                    tool_calls: response.toolCalls?.map(tc => ({
                        id: tc.id,
                        type: "function",
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments),
                        },
                    })),
                },
                finish_reason: response.stopReason ?? "stop",
            }],
            usage: {
                prompt_tokens: response.inputTokens ?? 0,
                completion_tokens: response.outputTokens ?? 0,
                total_tokens: (response.inputTokens ?? 0) + (response.outputTokens ?? 0),
            },
        });
    });

    // Simple message endpoint
    agent.post("/message", async (c) => {
        const body = await c.req.json<{
            message: string;
            model?: string;
            sessionId?: string;
        }>();

        const model = body.model ?? "claude-3-5-sonnet-20241022";

        const response = await registry.complete({
            model,
            messages: [{ role: "user", content: body.message }],
        });

        return c.json({
            response: response.content,
            model: response.model,
            usage: {
                inputTokens: response.inputTokens,
                outputTokens: response.outputTokens,
            },
        });
    });

    return agent;
}
