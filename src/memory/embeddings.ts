/**
 * OpenWhale Embedding Providers
 * 
 * Supports multiple embedding backends like OpenClaw:
 * - Local: node-llama-cpp with GGUF models (no API key needed!)
 * - OpenAI: text-embedding-3-small
 * - Gemini: text-embedding-004
 */

// Types
export type EmbeddingProvider = {
    id: "local" | "openai" | "gemini";
    model: string;
    embedQuery: (text: string) => Promise<number[]>;
    embedBatch: (texts: string[]) => Promise<number[][]>;
};

export type ProviderType = "local" | "openai" | "gemini" | "auto";

// Default local model - small 300MB embedding model from HuggingFace
const DEFAULT_LOCAL_MODEL = "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf";

// Singleton for lazy-loaded local model
let localProvider: EmbeddingProvider | null = null;
let localProviderError: string | null = null;

/**
 * Normalize embedding vector
 */
function normalizeEmbedding(vec: number[]): number[] {
    const sanitized = vec.map(v => Number.isFinite(v) ? v : 0);
    const magnitude = Math.sqrt(sanitized.reduce((sum, v) => sum + v * v, 0));
    if (magnitude < 1e-10) return sanitized;
    return sanitized.map(v => v / magnitude);
}

/**
 * Create local embedding provider using node-llama-cpp
 */
async function createLocalProvider(modelPath?: string): Promise<EmbeddingProvider> {
    const path = modelPath?.trim() || DEFAULT_LOCAL_MODEL;

    // Dynamic import to keep startup light
    const { getLlama, resolveModelFile, LlamaLogLevel } = await import("node-llama-cpp");

    // Use any to avoid complex type inference issues with dynamic imports
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let llama: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let context: any = null;

    const ensureContext = async () => {
        if (!llama) {
            llama = await getLlama({ logLevel: LlamaLogLevel.error });
        }
        if (!model && llama) {
            console.log(`[Embeddings] Loading local model: ${path}`);
            const resolved = await resolveModelFile(path);
            model = await llama.loadModel({ modelPath: resolved });
            console.log(`[Embeddings] ✓ Local model loaded`);
        }
        if (!context && model) {
            context = await model.createEmbeddingContext();
        }
        return context;
    };

    return {
        id: "local",
        model: path,
        embedQuery: async (text: string) => {
            const ctx = await ensureContext();
            const embedding = await ctx.getEmbeddingFor(text);
            return normalizeEmbedding(Array.from(embedding.vector));
        },
        embedBatch: async (texts: string[]) => {
            const ctx = await ensureContext();
            const embeddings = await Promise.all(
                texts.map(async (text) => {
                    const embedding = await ctx.getEmbeddingFor(text);
                    return normalizeEmbedding(Array.from(embedding.vector));
                })
            );
            return embeddings;
        },
    };
}

/**
 * Create OpenAI embedding provider
 */
async function createOpenAIProvider(): Promise<EmbeddingProvider> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY not set");
    }

    const model = "text-embedding-3-small";

    const embed = async (texts: string[]): Promise<number[][]> => {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                input: texts.map(t => t.slice(0, 8000)),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json() as {
            data: Array<{ embedding: number[]; index: number }>
        };

        // Sort by index to maintain order
        return data.data
            .sort((a, b) => a.index - b.index)
            .map(d => normalizeEmbedding(d.embedding));
    };

    return {
        id: "openai",
        model,
        embedQuery: async (text: string) => (await embed([text]))[0] ?? [],
        embedBatch: embed,
    };
}

/**
 * Create Gemini embedding provider
 */
async function createGeminiProvider(): Promise<EmbeddingProvider> {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY not set");
    }

    const model = "text-embedding-004";

    const embed = async (texts: string[]): Promise<number[][]> => {
        const results: number[][] = [];

        for (const text of texts) {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: `models/${model}`,
                        content: { parts: [{ text: text.slice(0, 8000) }] },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Gemini API error: ${error}`);
            }

            const data = await response.json() as {
                embedding: { values: number[] }
            };
            results.push(normalizeEmbedding(data.embedding.values));
        }

        return results;
    };

    return {
        id: "gemini",
        model,
        embedQuery: async (text: string) => (await embed([text]))[0] ?? [],
        embedBatch: embed,
    };
}

/**
 * Get or create an embedding provider
 * 
 * Order of preference for "auto":
 * 1. Local (if available) - no API key needed
 * 2. OpenAI (if OPENAI_API_KEY set)
 * 3. Gemini (if GOOGLE_API_KEY set)
 */
export async function getEmbeddingProvider(
    preferred: ProviderType = "auto"
): Promise<EmbeddingProvider | null> {
    const tryProvider = async (type: "local" | "openai" | "gemini"): Promise<EmbeddingProvider | null> => {
        try {
            switch (type) {
                case "local":
                    if (!localProvider && !localProviderError) {
                        try {
                            localProvider = await createLocalProvider();
                        } catch (err) {
                            localProviderError = err instanceof Error ? err.message : String(err);
                            console.warn(`[Embeddings] Local provider unavailable: ${localProviderError}`);
                            return null;
                        }
                    }
                    return localProvider;
                case "openai":
                    return await createOpenAIProvider();
                case "gemini":
                    return await createGeminiProvider();
            }
        } catch (err) {
            console.warn(`[Embeddings] ${type} provider failed: ${err instanceof Error ? err.message : err}`);
            return null;
        }
    };

    if (preferred !== "auto") {
        return await tryProvider(preferred);
    }

    // Auto mode: try in order of preference
    // 1. Local first (no API key needed)
    const local = await tryProvider("local");
    if (local) {
        console.log("[Embeddings] Using local provider (node-llama-cpp)");
        return local;
    }

    // 2. OpenAI
    const openai = await tryProvider("openai");
    if (openai) {
        console.log("[Embeddings] Using OpenAI provider");
        return openai;
    }

    // 3. Gemini
    const gemini = await tryProvider("gemini");
    if (gemini) {
        console.log("[Embeddings] Using Gemini provider");
        return gemini;
    }

    console.warn("[Embeddings] No embedding provider available");
    return null;
}

/**
 * Get embedding provider status
 */
export function getProviderStatus(): {
    available: ("local" | "openai" | "gemini")[];
    current: string | null;
    localError: string | null;
} {
    const available: ("local" | "openai" | "gemini")[] = [];

    if (localProvider) available.push("local");
    if (process.env.OPENAI_API_KEY) available.push("openai");
    if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) available.push("gemini");

    return {
        available,
        current: localProvider?.id ?? null,
        localError: localProviderError,
    };
}
