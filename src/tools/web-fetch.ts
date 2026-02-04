import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const WebFetchParamsSchema = z.object({
    url: z.string().url().describe("The URL to fetch"),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional().default("GET"),
    headers: z.record(z.string()).optional().describe("Optional headers to include"),
    body: z.string().optional().describe("Request body for POST/PUT/PATCH"),
    extractText: z.boolean().optional().default(true).describe("Extract text content from HTML"),
});

type WebFetchParams = z.infer<typeof WebFetchParamsSchema>;

export const webFetchTool: AgentTool<WebFetchParams> = {
    name: "web_fetch",
    description: "Fetch content from a URL. Returns raw response or extracted text from HTML pages.",
    category: "utility",
    parameters: WebFetchParamsSchema,

    async execute(params: WebFetchParams, _context: ToolCallContext): Promise<ToolResult> {
        try {
            const { url, method, headers, body, extractText } = params;

            const response = await fetch(url, {
                method,
                headers: {
                    "User-Agent": "OpenWhale/1.0 (AI Assistant)",
                    ...headers,
                },
                body: method !== "GET" ? body : undefined,
            });

            if (!response.ok) {
                return {
                    success: false,
                    content: "",
                    error: `HTTP ${response.status}: ${response.statusText}`,
                };
            }

            const contentType = response.headers.get("content-type") ?? "";
            let content: string;

            if (contentType.includes("application/json")) {
                const json = await response.json();
                content = JSON.stringify(json, null, 2);
            } else if (contentType.includes("text/html") && extractText) {
                const html = await response.text();
                // Simple HTML to text extraction
                content = html
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
            } else {
                content = await response.text();
            }

            // Truncate long responses
            const maxLength = 50000;
            if (content.length > maxLength) {
                content = content.slice(0, maxLength) + `\n... (truncated ${content.length - maxLength} characters)`;
            }

            return {
                success: true,
                content,
                metadata: {
                    status: response.status,
                    contentType,
                    url: response.url,
                },
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                content: "",
                error: `Fetch error: ${message}`,
            };
        }
    },
};
