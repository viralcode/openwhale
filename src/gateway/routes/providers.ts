import { Hono } from "hono";
import type { OpenWhaleConfig } from "../../config/loader.js";
import { registry } from "../../providers/base.js";

export function createProviderRoutes(_config: OpenWhaleConfig) {
    const providers = new Hono();

    // List all providers
    providers.get("/", async (c) => {
        return c.json({
            providers: registry.listProviders(),
        });
    });

    // List models for a provider
    providers.get("/:providerId/models", async (c) => {
        const providerId = c.req.param("providerId");
        const providersList = registry.listProviders();
        const provider = providersList.find(p => p.id === providerId);

        if (!provider) {
            return c.json({ error: "provider not found" }, 404);
        }

        // For now, return static list based on provider (TODO: move to provider classes)
        const models: Record<string, string[]> = {
            anthropic: [
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
                "claude-3-opus-20240229",
            ],
            openai: [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "o1-preview",
                "o1-mini",
            ],
            deepseek: [
                "deepseek-chat",
                "deepseek-coder",
                "deepseek-reasoner",
            ],
            groq: [
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "llama-3.1-8b-instant",
                "mixtral-8x7b-32768",
                "gemma2-9b-it"
            ],
            google: [
                "gemini-2.0-flash",
                "gemini-1.5-pro",
                "gemini-1.5-flash",
            ],
        };

        return c.json({
            models: models[providerId] ?? [],
        });
    });

    // List all available models across providers
    providers.get("/models", async (c) => {
        const allModels = [
            // Anthropic
            { id: "claude-3-5-sonnet-20241022", provider: "anthropic", name: "Claude 3.5 Sonnet" },
            { id: "claude-3-5-haiku-20241022", provider: "anthropic", name: "Claude 3.5 Haiku" },
            { id: "claude-3-opus-20240229", provider: "anthropic", name: "Claude 3 Opus" },
            // OpenAI
            { id: "gpt-4o", provider: "openai", name: "GPT-4o" },
            { id: "gpt-4o-mini", provider: "openai", name: "GPT-4o Mini" },
            { id: "o1-preview", provider: "openai", name: "O1 Preview" },
            { id: "o1-mini", provider: "openai", name: "O1 Mini" },
            // DeepSeek
            { id: "deepseek-chat", provider: "deepseek", name: "DeepSeek Chat" },
            { id: "deepseek-coder", provider: "deepseek", name: "DeepSeek Coder" },
            { id: "deepseek-reasoner", provider: "deepseek", name: "DeepSeek R1" },
            // Groq
            { id: "llama-3.3-70b-versatile", provider: "groq", name: "LLaMA 3.3 70B" },
            { id: "mixtral-8x7b-32768", provider: "groq", name: "Mixtral 8x7B" },
            // Google
            { id: "gemini-1.5-pro", provider: "google", name: "Gemini 1.5 Pro" },
            { id: "gemini-1.5-flash", provider: "google", name: "Gemini 1.5 Flash" },
        ];

        const activeProviders = new Set(registry.listProviders().map(p => p.id));
        const availableModels = allModels.filter(m => activeProviders.has(m.provider));

        return c.json({ models: availableModels });
    });

    return providers;
}
