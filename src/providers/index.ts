export { registry, ProviderRegistry, type AIProvider, type CompletionRequest, type CompletionResponse, type Message, type StreamEvent } from "./base.js";
export { AnthropicProvider, createAnthropicProvider } from "./anthropic.js";
export { OpenAICompatibleProvider, createOpenAIProvider, createDeepSeekProvider, createGroqProvider, createTogetherProvider, createOllamaProvider, createQwenProvider } from "./openai-compatible.js";
export { GoogleProvider, createGoogleProvider } from "./google.js";

// Auto-register available providers
import { registry } from "./base.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOpenAIProvider, createDeepSeekProvider, createGroqProvider, createTogetherProvider, createOllamaProvider, createQwenProvider } from "./openai-compatible.js";
import { createGoogleProvider } from "./google.js";

export function initializeProviders(): void {
    // Anthropic
    const anthropic = createAnthropicProvider();
    if (anthropic) {
        registry.register("anthropic", anthropic);
        console.log("✓ Anthropic provider registered");
    }

    // OpenAI
    const openai = createOpenAIProvider();
    if (openai) {
        registry.register("openai", openai);
        console.log("✓ OpenAI provider registered");
    }

    // Google/Gemini
    const google = createGoogleProvider();
    if (google) {
        registry.register("google", google);
        console.log("✓ Google/Gemini provider registered");
    }

    // DeepSeek
    const deepseek = createDeepSeekProvider();
    if (deepseek) {
        registry.register("deepseek", deepseek);
        console.log("✓ DeepSeek provider registered");
    }

    // Groq
    const groq = createGroqProvider();
    if (groq) {
        registry.register("groq", groq);
        console.log("✓ Groq provider registered");
    }

    // Together AI
    const together = createTogetherProvider();
    if (together) {
        registry.register("together", together);
        console.log("✓ Together AI provider registered");
    }

    // Ollama (local)
    const ollama = createOllamaProvider();
    if (ollama) {
        registry.register("ollama", ollama);
        console.log("✓ Ollama provider registered");
    }

    // Qwen (Alibaba DashScope)
    const qwen = createQwenProvider();
    if (qwen) {
        registry.register("qwen", qwen);
        console.log("✓ Qwen provider registered");
    }

    // Set fallback order
    registry.setFallbackOrder(["anthropic", "openai", "google", "qwen", "deepseek", "groq", "together", "ollama"]);

    console.log(`Providers initialized: ${registry.listProviders().length} available`);
}
