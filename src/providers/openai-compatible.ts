import OpenAI from "openai";
import type { AIProvider, CompletionRequest, CompletionResponse, StreamEvent, Message, Tool } from "./base.js";

export class OpenAICompatibleProvider implements AIProvider {
    name: string;
    type = "openai-compatible";
    private client: OpenAI;
    private modelList: string[] = [];

    constructor(config: {
        name: string;
        apiKey?: string;
        baseUrl?: string;
        models?: string[];
    }) {
        this.name = config.name;
        this.client = new OpenAI({
            apiKey: config.apiKey ?? "dummy", // Some providers don't need a key
            baseURL: config.baseUrl,
        });
        this.modelList = config.models ?? [];
    }

    async listModels(): Promise<string[]> {
        if (this.modelList.length > 0) return this.modelList;

        try {
            const models = await this.client.models.list();
            return models.data.map(m => m.id);
        } catch {
            return [];
        }
    }

    supportsTools(): boolean {
        return true;
    }

    supportsVision(): boolean {
        return true;
    }

    private convertMessages(messages: Message[], systemPrompt?: string): OpenAI.ChatCompletionMessageParam[] {
        const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

        if (systemPrompt) {
            openaiMessages.push({ role: "system", content: systemPrompt });
        }

        for (const msg of messages) {
            switch (msg.role) {
                case "system":
                    openaiMessages.push({ role: "system", content: msg.content });
                    break;
                case "user":
                    openaiMessages.push({ role: "user", content: msg.content });
                    break;
                case "assistant":
                    if (msg.toolCalls?.length) {
                        openaiMessages.push({
                            role: "assistant",
                            content: msg.content || null,
                            tool_calls: msg.toolCalls.map(tc => ({
                                id: tc.id,
                                type: "function" as const,
                                function: {
                                    name: tc.name,
                                    arguments: JSON.stringify(tc.arguments),
                                },
                            })),
                        });
                    } else {
                        openaiMessages.push({ role: "assistant", content: msg.content });
                    }
                    break;
                case "tool":
                    if (msg.toolResults) {
                        for (const tr of msg.toolResults) {
                            openaiMessages.push({
                                role: "tool",
                                tool_call_id: tr.toolCallId,
                                content: tr.content,
                            });
                        }
                    }
                    break;
            }
        }

        return openaiMessages;
    }

    private convertTools(tools?: Tool[]): OpenAI.ChatCompletionTool[] | undefined {
        if (!tools?.length) return undefined;

        return tools.map(tool => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const messages = this.convertMessages(request.messages, request.systemPrompt);

        const response = await this.client.chat.completions.create({
            model: request.model,
            messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            tools: this.convertTools(request.tools),
        });

        const choice = response.choices[0];
        const toolCalls = choice.message.tool_calls?.map(tc => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
        }));

        return {
            content: choice.message.content ?? "",
            toolCalls: toolCalls?.length ? toolCalls : undefined,
            inputTokens: response.usage?.prompt_tokens,
            outputTokens: response.usage?.completion_tokens,
            model: response.model,
            stopReason: choice.finish_reason ?? undefined,
        };
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamEvent> {
        const messages = this.convertMessages(request.messages, request.systemPrompt);

        const stream = await this.client.chat.completions.create({
            model: request.model,
            messages,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            tools: this.convertTools(request.tools),
            stream: true,
        });

        let currentToolCall: { id: string; name: string; args: string } | null = null;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
                yield { type: "text", text: delta.content };
            }

            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (tc.id) {
                        // New tool call
                        if (currentToolCall) {
                            yield {
                                type: "tool_call",
                                toolCall: {
                                    id: currentToolCall.id,
                                    name: currentToolCall.name,
                                    arguments: JSON.parse(currentToolCall.args || "{}"),
                                },
                            };
                        }
                        currentToolCall = {
                            id: tc.id,
                            name: tc.function?.name ?? "",
                            args: tc.function?.arguments ?? "",
                        };
                    } else if (tc.function?.arguments) {
                        // Continuing tool call arguments
                        if (currentToolCall) {
                            currentToolCall.args += tc.function.arguments;
                        }
                    }
                }
            }

            if (chunk.choices[0]?.finish_reason) {
                if (currentToolCall) {
                    yield {
                        type: "tool_call",
                        toolCall: {
                            id: currentToolCall.id,
                            name: currentToolCall.name,
                            arguments: JSON.parse(currentToolCall.args || "{}"),
                        },
                    };
                }
                yield {
                    type: "done",
                    inputTokens: chunk.usage?.prompt_tokens,
                    outputTokens: chunk.usage?.completion_tokens,
                };
            }
        }
    }
}

// Convenience factory functions with env detection
export function createOpenAIProvider(): OpenAICompatibleProvider | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return new OpenAICompatibleProvider({
        name: "OpenAI",
        apiKey,
        baseUrl: "https://api.openai.com/v1",
        models: [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
            "o1-preview",
            "o1-mini",
        ],
    });
}

export function createDeepSeekProvider(): OpenAICompatibleProvider | null {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    return new OpenAICompatibleProvider({
        name: "DeepSeek",
        apiKey,
        baseUrl: "https://api.deepseek.com/v1",
        models: [
            "deepseek-chat",
            "deepseek-coder",
            "deepseek-reasoner",
        ],
    });
}

export function createGroqProvider(): OpenAICompatibleProvider | null {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    return new OpenAICompatibleProvider({
        name: "Groq",
        apiKey,
        baseUrl: "https://api.groq.com/openai/v1",
        models: [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ],
    });
}

export function createTogetherProvider(): OpenAICompatibleProvider | null {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) return null;
    return new OpenAICompatibleProvider({
        name: "Together AI",
        apiKey,
        baseUrl: "https://api.together.xyz/v1",
    });
}

export function createOllamaProvider(): OpenAICompatibleProvider | null {
    const host = process.env.OLLAMA_HOST ?? "http://localhost:11434/v1";
    // Ollama is local, always try to create
    return new OpenAICompatibleProvider({
        name: "Ollama",
        baseUrl: host,
    });
}

