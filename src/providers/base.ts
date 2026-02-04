// AI Provider abstraction layer

export type Message = {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
};

export type ToolCall = {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
};

export type ToolResult = {
    toolCallId: string;
    content: string;
    isError?: boolean;
    imageBase64?: string; // For vision - base64 encoded image
    imageMimeType?: string; // e.g. "image/png"
};

export type Tool = {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
};

export type StreamEvent =
    | { type: "text"; text: string }
    | { type: "tool_call"; toolCall: ToolCall }
    | { type: "done"; inputTokens?: number; outputTokens?: number }
    | { type: "error"; error: string };

export type CompletionRequest = {
    model: string;
    messages: Message[];
    tools?: Tool[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    systemPrompt?: string;
};

export type CompletionResponse = {
    content: string;
    toolCalls?: ToolCall[];
    inputTokens?: number;
    outputTokens?: number;
    model: string;
    stopReason?: string;
};

export interface AIProvider {
    name: string;
    type: string;
    listModels(): Promise<string[]>;
    complete(request: CompletionRequest): Promise<CompletionResponse>;
    stream(request: CompletionRequest): AsyncGenerator<StreamEvent>;
    supportsTools(): boolean;
    supportsVision(): boolean;
}

// Model routing with fallback support
export class ProviderRegistry {
    private providers: Map<string, AIProvider> = new Map();
    private modelToProvider: Map<string, string> = new Map();
    private fallbackOrder: string[] = [];

    register(id: string, provider: AIProvider): void {
        this.providers.set(id, provider);
    }

    setFallbackOrder(order: string[]): void {
        this.fallbackOrder = order.filter(id => this.providers.has(id));
    }

    mapModel(model: string, providerId: string): void {
        this.modelToProvider.set(model, providerId);
    }

    getProvider(model: string): AIProvider | null {
        // Check explicit mapping first
        const mappedProvider = this.modelToProvider.get(model);
        if (mappedProvider) {
            return this.providers.get(mappedProvider) ?? null;
        }

        // Try to infer from model name
        const providerHints: Record<string, string> = {
            "claude": "anthropic",
            "gpt": "openai",
            "o1": "openai",
            "o3": "openai",
            "deepseek": "deepseek",
            "gemini": "google",
            "llama": "groq",
            "mixtral": "groq",
        };

        for (const [hint, providerId] of Object.entries(providerHints)) {
            if (model.toLowerCase().includes(hint)) {
                const provider = this.providers.get(providerId);
                if (provider) return provider;
            }
        }

        // Return first available
        for (const id of this.fallbackOrder) {
            const provider = this.providers.get(id);
            if (provider) return provider;
        }

        return this.providers.values().next().value ?? null;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const provider = this.getProvider(request.model);
        if (!provider) {
            throw new Error(`No provider available for model: ${request.model}`);
        }
        return provider.complete(request);
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamEvent> {
        const provider = this.getProvider(request.model);
        if (!provider) {
            throw new Error(`No provider available for model: ${request.model}`);
        }
        yield* provider.stream(request);
    }

    listProviders(): { id: string; name: string; type: string }[] {
        return Array.from(this.providers.entries()).map(([id, provider]) => ({
            id,
            name: provider.name,
            type: provider.type,
        }));
    }
}

export const registry = new ProviderRegistry();
