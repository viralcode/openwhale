import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import {
    readMemory,
    writeMemory,
    appendMemory,
    readDailyMemory,
    appendDailyMemory,
} from "../memory/memory-files.js";
import {
    searchMemoryVector,
    indexMemoryFiles,
    getVectorMemoryStatus,
} from "../memory/vector-memory.js";

const MemoryActionSchema = z.discriminatedUnion("action", [
    // Legacy in-memory actions
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
    // NEW: Persistent file-based memory actions
    z.object({
        action: z.literal("write_memory"),
        content: z.string().describe("Content to write/append to long-term MEMORY.md"),
        mode: z.enum(["append", "replace"]).default("append").describe("Append to existing or replace all"),
    }),
    z.object({
        action: z.literal("add_daily"),
        content: z.string().describe("Note to add to today's daily memory file"),
    }),
    z.object({
        action: z.literal("read_memory"),
        type: z.enum(["long_term", "daily", "all"]).default("all").describe("Which memory to read"),
    }),
    z.object({
        action: z.literal("search_memory"),
        query: z.string().describe("Search query for memory files"),
    }),
    // Vector search using embeddings (requires OPENAI_API_KEY)
    z.object({
        action: z.literal("vector_search"),
        query: z.string().describe("Semantic search query - finds similar content even without exact matches"),
        limit: z.number().optional().default(5).describe("Max results to return"),
    }),
    z.object({
        action: z.literal("index_memory"),
    }),
    z.object({
        action: z.literal("memory_status"),
    }),
]);

type MemoryAction = z.infer<typeof MemoryActionSchema>;

// In-memory store for session-scoped fast memory
const memoryStore: Map<string, {
    sessionId: string;
    key: string;
    content: string;
    createdAt: Date;
    expiresAt?: Date;
}> = new Map();

export const memoryTool: AgentTool<MemoryAction> = {
    name: "memory",
    description: `Store and recall information. Multiple memory systems available:

1. SESSION MEMORY (in-memory, fast, session-scoped):
   - remember/recall/forget/list/search - Quick key-value storage

2. PERSISTENT MEMORY (file-based, survives restarts):
   - write_memory - Add to MEMORY.md for important long-term facts
   - add_daily - Add notes to today's daily log (YYYY-MM-DD.md)
   - read_memory - Read memory files
   - search_memory - Keyword search across all memory files

3. VECTOR MEMORY (semantic search with embeddings):
   - vector_search - Find semantically similar content (requires OPENAI_API_KEY)
   - index_memory - Re-index all memory files for vector search
   - memory_status - Show vector memory stats

Use write_memory for: user preferences, important facts, learned information
Use add_daily for: conversation summaries, daily notes, context
Use vector_search for: finding related content by meaning, not just keywords`,
    category: "utility",
    parameters: MemoryActionSchema,

    async execute(params: MemoryAction, context: ToolCallContext): Promise<ToolResult> {
        const makeKey = (key: string) => `${context.sessionId}:${key}`;

        switch (params.action) {
            // ========== IN-MEMORY ACTIONS ==========
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
                    return { success: true, content: "No session memories stored." };
                }

                return {
                    success: true,
                    content: `Session memories:\n${keys.map(k => `• ${k}`).join("\n")}`,
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
                    return { success: true, content: `No session memories matching "${params.query}"` };
                }

                const formatted = top.map(r =>
                    `• ${r.key}: ${r.content.slice(0, 100)}${r.content.length > 100 ? "..." : ""}`
                ).join("\n");

                return { success: true, content: `Search results:\n${formatted}`, metadata: { count: top.length } };
            }

            // ========== PERSISTENT FILE ACTIONS ==========
            case "write_memory": {
                try {
                    if (params.mode === "replace") {
                        writeMemory(params.content);
                        return {
                            success: true,
                            content: `✅ Replaced MEMORY.md with new content (${params.content.length} chars)`
                        };
                    } else {
                        appendMemory(params.content);
                        return {
                            success: true,
                            content: `✅ Appended to MEMORY.md: ${params.content.slice(0, 100)}${params.content.length > 100 ? "..." : ""}`
                        };
                    }
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Failed to write memory: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }

            case "add_daily": {
                try {
                    appendDailyMemory(params.content);
                    const today = new Date().toISOString().split("T")[0];
                    return {
                        success: true,
                        content: `✅ Added to daily notes (${today}): ${params.content.slice(0, 100)}${params.content.length > 100 ? "..." : ""}`
                    };
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Failed to add daily note: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }

            case "read_memory": {
                try {
                    let content = "";

                    if (params.type === "long_term" || params.type === "all") {
                        const longTerm = readMemory();
                        if (longTerm.trim()) {
                            content += "## MEMORY.md (Long-Term)\n" + longTerm + "\n\n";
                        }
                    }

                    if (params.type === "daily" || params.type === "all") {
                        const daily = readDailyMemory();
                        if (daily.trim()) {
                            content += "## Today's Notes\n" + daily;
                        }
                    }

                    if (!content.trim()) {
                        return { success: true, content: "No memory content found." };
                    }

                    return { success: true, content };
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Failed to read memory: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }

            case "search_memory": {
                try {
                    const query = params.query.toLowerCase();
                    const results: string[] = [];

                    // Search long-term memory
                    const longTerm = readMemory();
                    if (longTerm.toLowerCase().includes(query)) {
                        const lines = longTerm.split("\n");
                        const matches = lines.filter(l => l.toLowerCase().includes(query));
                        if (matches.length > 0) {
                            results.push("**MEMORY.md:**");
                            results.push(...matches.slice(0, 5).map(l => `  • ${l.trim()}`));
                        }
                    }

                    // Search today's daily notes
                    const daily = readDailyMemory();
                    if (daily.toLowerCase().includes(query)) {
                        const lines = daily.split("\n");
                        const matches = lines.filter(l => l.toLowerCase().includes(query));
                        if (matches.length > 0) {
                            results.push("**Today's Notes:**");
                            results.push(...matches.slice(0, 5).map(l => `  • ${l.trim()}`));
                        }
                    }

                    // Search yesterday's notes
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayNotes = readDailyMemory(yesterday);
                    if (yesterdayNotes.toLowerCase().includes(query)) {
                        const lines = yesterdayNotes.split("\n");
                        const matches = lines.filter(l => l.toLowerCase().includes(query));
                        if (matches.length > 0) {
                            results.push("**Yesterday's Notes:**");
                            results.push(...matches.slice(0, 5).map(l => `  • ${l.trim()}`));
                        }
                    }

                    if (results.length === 0) {
                        return { success: true, content: `No matches found for "${params.query}" in memory files.` };
                    }

                    return { success: true, content: `Search results for "${params.query}":\n\n${results.join("\n")}` };
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Failed to search memory: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }

            // ========== VECTOR MEMORY ACTIONS ==========
            case "vector_search": {
                try {
                    const results = await searchMemoryVector(params.query, params.limit);

                    if (results.length === 0) {
                        return {
                            success: true,
                            content: `No semantic matches found for "${params.query}". Try indexing with index_memory first.`
                        };
                    }

                    const formatted = results.map((r, i) =>
                        `**${i + 1}. ${r.path}** (score: ${r.score.toFixed(3)}, lines ${r.startLine}-${r.endLine})\n${r.text.slice(0, 200)}${r.text.length > 200 ? "..." : ""}`
                    ).join("\n\n");

                    return {
                        success: true,
                        content: `🔍 Vector search results for "${params.query}":\n\n${formatted}`,
                        metadata: { resultCount: results.length }
                    };
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Vector search failed: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }

            case "index_memory": {
                try {
                    const result = await indexMemoryFiles();
                    return {
                        success: true,
                        content: `✅ Indexed ${result.indexed} chunks from memory files.${result.errors > 0 ? ` (${result.errors} errors)` : ""}`,
                        metadata: result
                    };
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Indexing failed: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }

            case "memory_status": {
                try {
                    const status = getVectorMemoryStatus();
                    const lines = [
                        "📊 **Vector Memory Status**",
                        `• Initialized: ${status.initialized ? "Yes" : "No"}`,
                        `• sqlite-vec: ${status.sqliteVecAvailable ? "Available ✓" : "Not available (using fallback)"}`,
                        `• Chunks indexed: ${status.chunkCount}`,
                        `• Embeddings generated: ${status.embeddingCount}`,
                        `• Embedding dimension: ${status.embeddingDim ?? "N/A"}`,
                        "",
                        "**Embedding Provider:**",
                        `• Current: ${status.provider.current ?? "Not initialized"}`,
                        `• Available: ${status.provider.available.length > 0 ? status.provider.available.join(", ") : "None"}`,
                    ];
                    if (status.provider.localError) {
                        lines.push(`• Local error: ${status.provider.localError.slice(0, 100)}`);
                    }
                    return { success: true, content: lines.join("\n"), metadata: status };
                } catch (err) {
                    return {
                        success: false,
                        content: "",
                        error: `Status check failed: ${err instanceof Error ? err.message : String(err)}`
                    };
                }
            }
        }
    },
};


