// Google/Gemini Provider - using @google/generative-ai SDK
import type { AIProvider, CompletionRequest, CompletionResponse, StreamEvent } from "./base.js";
import { logger } from "../logger.js";

export class GoogleProvider implements AIProvider {
    name = "Google AI";
    type = "google";
    private apiKey: string;
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async listModels(): Promise<string[]> {
        return [
            // Gemini 3 (latest - Feb 2026)
            "gemini-3-pro-preview",
            "gemini-3-flash-preview",
            // Gemini 2.5 (GA)
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            // Gemini 2.0 (being deprecated Mar 2026)
            "gemini-2.0-flash",
            // Legacy
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ];
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const model = request.model.replace("google/", "");

        // Convert messages to Gemini format
        const contents = request.messages
            .filter(m => m.role !== "system")
            .map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

        // Add system instruction if present
        const systemInstruction = request.systemPrompt ??
            request.messages.find(m => m.role === "system")?.content;

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                maxOutputTokens: request.maxTokens ?? 8192,
                temperature: request.temperature ?? 0.7,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        // Add tools if provided
        if (request.tools?.length) {
            body.tools = [{
                functionDeclarations: request.tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                })),
            }];
        }

        logger.info("provider", "Google API call", { model, messages: contents.length, tools: request.tools?.length ?? 0, maxTokens: request.maxTokens ?? 8192 });

        const response = await fetch(
            `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            logger.error("provider", "Google API ERROR", { status: response.status, model, body: error.slice(0, 500) });
            throw new Error(`Google API error: ${error}`);
        }

        const data = await response.json() as {
            candidates?: Array<{
                content: { parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }> };
                finishReason: string;
            }>;
            usageMetadata?: {
                promptTokenCount: number;
                candidatesTokenCount: number;
            };
        };

        const candidate = data.candidates?.[0];
        const parts = candidate?.content.parts ?? [];

        // Extract text and function calls
        const textParts = parts.filter(p => p.text).map(p => p.text).join("");
        const functionCalls = parts
            .filter(p => p.functionCall)
            .map((p, i) => ({
                id: `call_${i}`,
                name: p.functionCall!.name,
                arguments: p.functionCall!.args,
            }));

        logger.info("provider", "Google API success", { model, finish: candidate?.finishReason, inputTokens: data.usageMetadata?.promptTokenCount, outputTokens: data.usageMetadata?.candidatesTokenCount, toolCalls: functionCalls.length, contentLen: textParts.length });

        return {
            content: textParts,
            toolCalls: functionCalls.length > 0 ? functionCalls : undefined,
            model: request.model,
            inputTokens: data.usageMetadata?.promptTokenCount,
            outputTokens: data.usageMetadata?.candidatesTokenCount,
            stopReason: candidate?.finishReason,
        };
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamEvent> {
        const model = request.model.replace("google/", "");

        const contents = request.messages
            .filter(m => m.role !== "system")
            .map(m => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

        const systemInstruction = request.systemPrompt ??
            request.messages.find(m => m.role === "system")?.content;

        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                maxOutputTokens: request.maxTokens ?? 8192,
                temperature: request.temperature ?? 0.7,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        const response = await fetch(
            `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            yield { type: "error", error: `Google API error: ${error}` };
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
            yield { type: "error", error: "No response body" };
            return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            yield { type: "text", text };
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }

        yield { type: "done" };
    }

    supportsTools(): boolean {
        return true;
    }

    supportsVision(): boolean {
        return true;
    }
}

export function createGoogleProvider(): GoogleProvider | null {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleProvider(apiKey);
}
