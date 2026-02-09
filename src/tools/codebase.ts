/**
 * Codebase Search Tool
 *
 * Lets the AI search and understand its own source code.
 * Uses the codebase indexer's vector search + keyword fallback.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import {
    indexCodebase,
    searchCodebase,
    getCodebaseStatus,
} from "../codebase/codebase-index.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve the OpenWhale source root (this file is in src/tools/)
function getSourceRoot(): string {
    try {
        const thisFile = fileURLToPath(import.meta.url);
        // Go up from dist/tools/ or src/tools/ to the project root
        return join(dirname(thisFile), "..", "..");
    } catch {
        return process.cwd();
    }
}

const CodebaseActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("search"),
        query: z.string().describe("Natural language query to search the codebase. e.g. 'how does screenshot tool work' or 'where are tools registered'"),
        limit: z.number().optional().default(8).describe("Max results to return (default 8)"),
    }),
    z.object({
        action: z.literal("index"),
    }),
    z.object({
        action: z.literal("status"),
    }),
]);

type CodebaseAction = z.infer<typeof CodebaseActionSchema>;

export const codebaseTool: AgentTool<CodebaseAction> = {
    name: "codebase_search",
    description: `Search and understand the OpenWhale codebase. Use this to find how features are implemented, locate files, or understand architecture.

Actions:
- search: Semantic search across the entire source code. Returns relevant code chunks ranked by similarity.
- index: Re-index the codebase (run after code changes). Incremental — only processes changed files.
- status: Show index stats (chunk count, last indexed, embedding provider).

The codebase is automatically indexed on first search if not already indexed.`,
    category: "utility",
    parameters: CodebaseActionSchema,

    async execute(params: CodebaseAction, _context: ToolCallContext): Promise<ToolResult> {
        const sourceRoot = getSourceRoot();

        switch (params.action) {
            case "search": {
                // Auto-index if not yet indexed
                const status = getCodebaseStatus();
                if (!status.indexed) {
                    await indexCodebase(sourceRoot);
                }

                const results = await searchCodebase(params.query, params.limit);

                if (results.length === 0) {
                    return {
                        success: true,
                        content: `No results found for: "${params.query}"\n\nTry re-indexing with action: "index" if the codebase has changed.`,
                    };
                }

                // Format results
                const formatted = results.map((r, i) => {
                    const score = r.score > 1 ? `keyword(${r.score})` : `${(r.score * 100).toFixed(1)}%`;
                    return [
                        `### ${i + 1}. ${r.name} (${r.chunkType})`,
                        `📁 \`${r.filePath}\` lines ${r.startLine}-${r.endLine} | relevance: ${score}`,
                        "```typescript",
                        r.content.length > 2000 ? r.content.slice(0, 2000) + "\n// ... (truncated)" : r.content,
                        "```",
                    ].join("\n");
                });

                return {
                    success: true,
                    content: `## Codebase Search: "${params.query}"\n\nFound ${results.length} relevant chunks:\n\n${formatted.join("\n\n")}`,
                };
            }

            case "index": {
                const result = await indexCodebase(sourceRoot);

                let content = [
                    `## Codebase Indexed`,
                    `- **Source root**: ${sourceRoot}`,
                    `- **Files**: ${result.totalFiles}`,
                    `- **Total chunks**: ${result.totalChunks}`,
                    `- **New/changed**: ${result.newChunks}`,
                    `- **Embedded**: ${result.embeddedChunks}`,
                    `- **Skipped (unchanged)**: ${result.skippedChunks}`,
                ].join("\n");

                if (result.errors.length > 0) {
                    content += `\n\n### Errors\n${result.errors.slice(0, 5).map(e => `- ${e}`).join("\n")}`;
                }

                return { success: true, content };
            }

            case "status": {
                const status = getCodebaseStatus();

                const content = [
                    `## Codebase Index Status`,
                    `- **Indexed**: ${status.indexed ? "✅ Yes" : "❌ No"}`,
                    `- **Chunks**: ${status.chunkCount}`,
                    `- **With embeddings**: ${status.embeddedCount}`,
                    `- **Last indexed**: ${status.lastIndexed || "never"}`,
                    `- **Source root**: ${status.sourceRoot || "not set"}`,
                    `- **Embedding provider**: ${status.provider || "none"}`,
                ].join("\n");

                return { success: true, content };
            }

            default:
                return { success: false, content: "", error: "Unknown action" };
        }
    },
};
