/**
 * OpenWhale Logs Tool
 * 
 * Allows the AI agent to query, search, and analyze system logs.
 * Works across all channels (WhatsApp, Telegram, Discord, webchat, etc.)
 */

import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { logger } from "../logger.js";

const LogsActionSchema = z.object({
    action: z.enum(["search", "recent", "errors", "stats"]).describe(
        "Action: 'search' to find logs by keyword/filters, 'recent' for latest entries, 'errors' for recent errors only, 'stats' for log statistics"
    ),
    query: z.string().optional().describe("Search keyword (for 'search' action)"),
    level: z.enum(["DEBUG", "INFO", "WARN", "ERROR"]).optional().describe("Filter by log level"),
    category: z.string().optional().describe("Filter by category: chat, channel, provider, tool, session, system, cron, extension, auth"),
    count: z.number().optional().default(20).describe("Number of entries to return (default 20, max 50)"),
});

type LogsAction = z.infer<typeof LogsActionSchema>;

interface ParsedLogEntry {
    timestamp: string;
    level: string;
    category: string;
    message: string;
    data?: unknown;
}

function readLogEntries(): ParsedLogEntry[] {
    const logPath = logger.getLogPath();
    if (!existsSync(logPath)) return [];

    try {
        const content = readFileSync(logPath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        const entries: ParsedLogEntry[] = [];
        for (const line of lines) {
            try {
                entries.push(JSON.parse(line));
            } catch { /* skip malformed */ }
        }
        return entries;
    } catch {
        return [];
    }
}

export const logsTool: AgentTool<LogsAction> = {
    name: "logs",
    description: "Query and analyze OpenWhale system logs. Search for errors, view recent activity, filter by level/category, or get statistics. Use this to diagnose issues, check system health, or review what happened.",
    category: "system",
    parameters: LogsActionSchema,

    async execute(params: LogsAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            const entries = readLogEntries();
            const count = Math.min(params.count || 20, 50);

            switch (params.action) {
                case "recent": {
                    let filtered = entries;
                    if (params.level) filtered = filtered.filter(e => e.level === params.level);
                    if (params.category) filtered = filtered.filter(e => e.category === params.category);

                    const recent = filtered.slice(-count).reverse();
                    if (recent.length === 0) {
                        return { success: true, content: "No log entries found." };
                    }

                    const lines = recent.map(e => {
                        const time = e.timestamp.split("T")[1]?.split(".")[0] || e.timestamp;
                        const dataStr = e.data ? ` | ${JSON.stringify(e.data).slice(0, 100)}` : "";
                        return `[${time}] ${e.level} [${e.category}] ${e.message}${dataStr}`;
                    });

                    return {
                        success: true,
                        content: `**Recent Logs** (${recent.length} entries)\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
                    };
                }

                case "errors": {
                    let errors = entries.filter(e => e.level === "ERROR" || e.level === "WARN");
                    if (params.category) errors = errors.filter(e => e.category === params.category);

                    const recent = errors.slice(-count).reverse();
                    if (recent.length === 0) {
                        return { success: true, content: "✅ No errors or warnings found in the logs." };
                    }

                    const lines = recent.map(e => {
                        const time = e.timestamp.split("T")[1]?.split(".")[0] || e.timestamp;
                        const dataStr = e.data ? ` | ${JSON.stringify(e.data).slice(0, 150)}` : "";
                        return `[${time}] ${e.level} [${e.category}] ${e.message}${dataStr}`;
                    });

                    return {
                        success: true,
                        content: `**Errors & Warnings** (${recent.length} entries)\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
                    };
                }

                case "search": {
                    const query = (params.query || "").toLowerCase();
                    if (!query) {
                        return { success: false, content: "", error: "Please provide a search query." };
                    }

                    let filtered = entries.filter(e =>
                        e.message.toLowerCase().includes(query) ||
                        JSON.stringify(e.data || "").toLowerCase().includes(query)
                    );
                    if (params.level) filtered = filtered.filter(e => e.level === params.level);
                    if (params.category) filtered = filtered.filter(e => e.category === params.category);

                    const results = filtered.slice(-count).reverse();
                    if (results.length === 0) {
                        return { success: true, content: `No logs matching "${params.query}".` };
                    }

                    const lines = results.map(e => {
                        const time = e.timestamp.split("T")[1]?.split(".")[0] || e.timestamp;
                        const dataStr = e.data ? ` | ${JSON.stringify(e.data).slice(0, 100)}` : "";
                        return `[${time}] ${e.level} [${e.category}] ${e.message}${dataStr}`;
                    });

                    return {
                        success: true,
                        content: `**Search: "${params.query}"** (${results.length} of ${filtered.length} matches)\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
                    };
                }

                case "stats": {
                    const byLevel: Record<string, number> = {};
                    const byCategory: Record<string, number> = {};

                    for (const e of entries) {
                        byLevel[e.level] = (byLevel[e.level] || 0) + 1;
                        byCategory[e.category] = (byCategory[e.category] || 0) + 1;
                    }

                    const levelLines = Object.entries(byLevel)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `  ${k}: ${v}`);

                    const catLines = Object.entries(byCategory)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `  ${k}: ${v}`);

                    // Time range
                    const first = entries[0]?.timestamp || "N/A";
                    const last = entries[entries.length - 1]?.timestamp || "N/A";

                    return {
                        success: true,
                        content: [
                            `**Log Statistics**`,
                            `• Total entries: ${entries.length}`,
                            `• Log file: ${logger.getLogPath()}`,
                            `• Time range: ${first.split("T")[0]} → ${last.split("T")[0]}`,
                            ``,
                            `**By Level:**`,
                            ...levelLines,
                            ``,
                            `**By Category:**`,
                            ...catLines,
                        ].join("\n"),
                    };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Logs error: ${message}` };
        }
    },
};
