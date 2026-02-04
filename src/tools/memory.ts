import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const MemoryActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("remember"),
        key: z.string().describe("Key to store the memory under"),
        content: z.string().describe("Content to remember"),
        ttl: z.number().optional().describe("Time to live in seconds"),
    }),
    z.object({
        action: z.literal("recall"),
        key: z.string().describe("Key to recall"),
    }),
    z.object({
        action: z.literal("forget"),
        key: z.string().describe("Key to forget"),
    }),
    z.object({
        action: z.literal("list"),
        prefix: z.string().optional().describe("Optional prefix filter"),
    }),
    z.object({
        action: z.literal("search"),
        query: z.string().describe("Search query"),
        limit: z.number().optional().default(10),
    }),
]);

type MemoryAction = z.infer<typeof MemoryActionSchema>;

// In-memory store (would use vector DB in production)
const memoryStore: Map<string, {
    sessionId: string;
    key: string;
    content: string;
    createdAt: Date;
    expiresAt?: Date;
}> = new Map();

export const memoryTool: AgentTool<MemoryAction> = {
    name: "memory",
    description: "Store and recall information across conversations. Use to remember user preferences, context, or important facts.",
    category: "utility",
    parameters: MemoryActionSchema,

    async execute(params: MemoryAction, context: ToolCallContext): Promise<ToolResult> {
        const makeKey = (key: string) => `${context.sessionId}:${key}`;

        switch (params.action) {
            case "remember": {
                const storeKey = makeKey(params.key);
                memoryStore.set(storeKey, {
                    sessionId: context.sessionId,
                    key: params.key,
                    content: params.content,
                    createdAt: new Date(),
                    expiresAt: params.ttl ? new Date(Date.now() + params.ttl * 1000) : undefined,
                });
                return {
                    success: true,
                    content: `Remembered "${params.key}": ${params.content.slice(0, 100)}${params.content.length > 100 ? "..." : ""}`
                };
            }

            case "recall": {
                const storeKey = makeKey(params.key);
                const memory = memoryStore.get(storeKey);

                if (!memory) {
                    return { success: false, content: "", error: `Memory not found: ${params.key}` };
                }

                // Check expiration
                if (memory.expiresAt && memory.expiresAt < new Date()) {
                    memoryStore.delete(storeKey);
                    return { success: false, content: "", error: `Memory expired: ${params.key}` };
                }

                return { success: true, content: memory.content };
            }

            case "forget": {
                const storeKey = makeKey(params.key);
                if (!memoryStore.has(storeKey)) {
                    return { success: false, content: "", error: `Memory not found: ${params.key}` };
                }
                memoryStore.delete(storeKey);
                return { success: true, content: `Forgot: ${params.key}` };
            }

            case "list": {
                const prefix = params.prefix ? makeKey(params.prefix) : `${context.sessionId}:`;
                const now = new Date();

                const keys: string[] = [];
                for (const [storeKey, memory] of memoryStore.entries()) {
                    if (storeKey.startsWith(prefix)) {
                        // Skip expired
                        if (memory.expiresAt && memory.expiresAt < now) continue;
                        keys.push(memory.key);
                    }
                }

                if (keys.length === 0) {
                    return { success: true, content: "No memories stored." };
                }

                return {
                    success: true,
                    content: `Stored memories:\n${keys.map(k => `• ${k}`).join("\n")}`,
                    metadata: { count: keys.length },
                };
            }

            case "search": {
                const query = params.query.toLowerCase();
                const now = new Date();
                const results: Array<{ key: string; content: string; score: number }> = [];

                for (const [storeKey, memory] of memoryStore.entries()) {
                    if (!storeKey.startsWith(`${context.sessionId}:`)) continue;
                    if (memory.expiresAt && memory.expiresAt < now) continue;

                    // Simple keyword matching (use vector similarity in production)
                    const contentLower = memory.content.toLowerCase();
                    const keyLower = memory.key.toLowerCase();

                    if (contentLower.includes(query) || keyLower.includes(query)) {
                        const score = contentLower.split(query).length - 1;
                        results.push({ key: memory.key, content: memory.content, score });
                    }
                }

                results.sort((a, b) => b.score - a.score);
                const top = results.slice(0, params.limit);

                if (top.length === 0) {
                    return { success: true, content: `No memories matching "${params.query}"` };
                }

                const formatted = top.map(r =>
                    `• ${r.key}: ${r.content.slice(0, 100)}${r.content.length > 100 ? "..." : ""}`
                ).join("\n");

                return { success: true, content: `Search results:\n${formatted}`, metadata: { count: top.length } };
            }
        }
    },
};
