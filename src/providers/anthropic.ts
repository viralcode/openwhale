import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, CompletionRequest, CompletionResponse, StreamEvent, Message, Tool } from "./base.js";

export class AnthropicProvider implements AIProvider {
    name = "Anthropic";
    type = "anthropic";
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({ apiKey });
    }

    async listModels(): Promise<string[]> {
        return [
            // Claude 5 (Sonnet 5 - Fennec, released Feb 2026)
            "claude-sonnet-5-20260203",
            // Claude 4.5 series (latest production models)
            "claude-opus-4-5-20251101",
            "claude-sonnet-4-5-20250929",
            "claude-haiku-4-5-20251001",
            // Claude 3.5 (still supported)
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
        ];
    }

    supportsTools(): boolean {
        return true;
    }

    supportsVision(): boolean {
        return true;
    }


    private convertMessages(messages: Message[], systemPrompt?: string): {
        system?: string;
        messages: Anthropic.MessageParam[];
    } {
        const anthropicMessages: Anthropic.MessageParam[] = [];
        let extractedSystem = systemPrompt ?? "";

        for (const msg of messages) {
            if (msg.role === "system") {
                extractedSystem = (extractedSystem ? extractedSystem + "\n" : "") + msg.content;
                continue;
            }

            if (msg.role === "tool") {
                // Tool results
                const toolResults = msg.toolResults ?? [];
                if (toolResults.length > 0) {
                    anthropicMessages.push({
                        role: "user",
                        content: toolResults.map(tr => {
                            // Build content array for each tool result
                            const resultContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];

                            // If there's an image, include it for vision
                            if (tr.imageBase64) {
                                resultContent.push({
                                    type: "image",
                                    source: {
                                        type: "base64",
                                        media_type: (tr.imageMimeType || "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                                        data: tr.imageBase64,
                                    },
                                });
                            }

                            // Add the text content
                            resultContent.push({
                                type: "text",
                                text: tr.content,
                            });

                            return {
                                type: "tool_result" as const,
                                tool_use_id: tr.toolCallId,
                                content: resultContent,
                                is_error: tr.isError,
                            };
                        }),
                    });
                }
                continue;
            }

            // Handle assistant messages with tool calls
            if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
                const contentBlocks: Anthropic.ContentBlock[] = [];

                // Add text content if present
                if (msg.content) {
                    contentBlocks.push({
                        type: "text",
                        text: msg.content,
                    });
                }

                // Add tool_use blocks
                for (const tc of msg.toolCalls) {
                    contentBlocks.push({
                        type: "tool_use",
                        id: tc.id,
                        name: tc.name,
                        input: tc.arguments,
                    });
                }

                anthropicMessages.push({
                    role: "assistant",
                    content: contentBlocks as any, // Cast needed for mixed content types
                });
                continue;
            }

            anthropicMessages.push({
                role: msg.role === "assistant" ? "assistant" : "user",
                content: msg.content,
            });
        }

        return {
            system: extractedSystem || undefined,
            messages: anthropicMessages,
        };
    }


    private convertTools(tools?: Tool[]): Anthropic.Tool[] | undefined {
        if (!tools?.length) return undefined;

        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters as Anthropic.Tool.InputSchema,
        }));
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const { system, messages } = this.convertMessages(request.messages, request.systemPrompt);

        const response = await this.client.messages.create({
            model: request.model,
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            system,
            messages,
            tools: this.convertTools(request.tools),
        });

        let content = "";
        const toolCalls: CompletionResponse["toolCalls"] = [];

        for (const block of response.content) {
            if (block.type === "text") {
                content += block.text;
            } else if (block.type === "tool_use") {
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    arguments: block.input as Record<string, unknown>,
                });
            }
        }

        return {
            content,
            toolCalls: toolCalls.length ? toolCalls : undefined,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            model: response.model,
            stopReason: response.stop_reason ?? undefined,
        };
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamEvent> {
        const { system, messages } = this.convertMessages(request.messages, request.systemPrompt);

        const stream = await this.client.messages.stream({
            model: request.model,
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
            system,
            messages,
            tools: this.convertTools(request.tools),
        });

        for await (const event of stream) {
            if (event.type === "content_block_delta") {
                if (event.delta.type === "text_delta") {
                    yield { type: "text", text: event.delta.text };
                } else if (event.delta.type === "input_json_delta") {
                    // Tool call argument streaming - accumulate
                }
            } else if (event.type === "content_block_stop") {
                // Block finished
            } else if (event.type === "message_delta") {
                // Could extract final usage here
            } else if (event.type === "message_stop") {
                const finalMessage = await stream.finalMessage();
                yield {
                    type: "done",
                    inputTokens: finalMessage.usage.input_tokens,
                    outputTokens: finalMessage.usage.output_tokens,
                };
            }
        }
    }
}

export function createAnthropicProvider(): AnthropicProvider | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return new AnthropicProvider(apiKey);
}
