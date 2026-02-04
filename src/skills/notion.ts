/**
 * Notion Skill - Notion workspace integration
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = process.env.NOTION_API_KEY;
    if (!token) throw new Error("NOTION_API_KEY not configured");

    return fetch(`${NOTION_API}${endpoint}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
}

const tools: SkillTool[] = [
    {
        name: "notion_search",
        description: "Search Notion pages and databases",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                filter: { type: "string", description: "Filter by type: page or database" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query, filter } = args;

                const body: Record<string, unknown> = { query };
                if (filter) {
                    body.filter = { value: filter, property: "object" };
                }

                const res = await notionFetch("/search", {
                    method: "POST",
                    body: JSON.stringify(body),
                });

                const data = await res.json() as {
                    results: Array<{
                        object: string;
                        id: string;
                        url: string;
                        properties?: { title?: { title: Array<{ plain_text: string }> }; Name?: { title: Array<{ plain_text: string }> } };
                        title?: Array<{ plain_text: string }>;
                    }>;
                };

                const formatted = data.results?.slice(0, 10).map(item => {
                    const icon = item.object === "database" ? "🗄️" : "📄";
                    let title = "Untitled";

                    if (item.title?.[0]?.plain_text) {
                        title = item.title[0].plain_text;
                    } else if (item.properties?.title?.title?.[0]?.plain_text) {
                        title = item.properties.title.title[0].plain_text;
                    } else if (item.properties?.Name?.title?.[0]?.plain_text) {
                        title = item.properties.Name.title[0].plain_text;
                    }

                    return `${icon} **${title}**\n   ${item.url}`;
                }).join("\n\n") || "No results";

                return { success: true, content: `🔍 **Search: "${query}"**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "notion_create_page",
        description: "Create a new Notion page",
        parameters: {
            type: "object",
            properties: {
                parent_id: { type: "string", description: "Parent page or database ID" },
                title: { type: "string", description: "Page title" },
                content: { type: "string", description: "Page content (plain text)" },
                is_database: { type: "boolean", description: "If parent is a database" },
            },
            required: ["parent_id", "title"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { parent_id, title, content, is_database } = args;

                const parent = is_database
                    ? { database_id: parent_id }
                    : { page_id: parent_id };

                const properties = is_database
                    ? { Name: { title: [{ text: { content: title } }] } }
                    : { title: { title: [{ text: { content: title } }] } };

                const children = content ? [
                    {
                        object: "block",
                        type: "paragraph",
                        paragraph: {
                            rich_text: [{ type: "text", text: { content: content } }],
                        },
                    },
                ] : [];

                const res = await notionFetch("/pages", {
                    method: "POST",
                    body: JSON.stringify({ parent, properties, children }),
                });

                const page = await res.json() as { id: string; url: string };

                return {
                    success: true,
                    content: `✅ **Page Created**\n\n📄 ${title}\n🔗 ${page.url}`
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "notion_get_page",
        description: "Get a Notion page's content",
        parameters: {
            type: "object",
            properties: {
                page_id: { type: "string", description: "Page ID" },
            },
            required: ["page_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { page_id } = args;

                const pageRes = await notionFetch(`/pages/${page_id}`);
                const page = await pageRes.json() as {
                    properties: Record<string, { title?: Array<{ plain_text: string }> }>;
                    url: string;
                };

                const blocksRes = await notionFetch(`/blocks/${page_id}/children`);
                const blocks = await blocksRes.json() as {
                    results: Array<{
                        type: string;
                        paragraph?: { rich_text: Array<{ plain_text: string }> };
                        to_do?: { checked: boolean };
                    }>;
                };

                let title = "Untitled";
                for (const [, prop] of Object.entries(page.properties)) {
                    if (prop.title?.[0]?.plain_text) {
                        title = prop.title[0].plain_text;
                        break;
                    }
                }

                const content = blocks.results?.map(block => {
                    const text = (block as Record<string, { rich_text?: Array<{ plain_text: string }> }>)[block.type]?.rich_text?.map(t => t.plain_text).join("") || "";

                    switch (block.type) {
                        case "heading_1": return `# ${text}`;
                        case "heading_2": return `## ${text}`;
                        case "heading_3": return `### ${text}`;
                        case "bulleted_list_item": return `• ${text}`;
                        case "numbered_list_item": return `1. ${text}`;
                        case "to_do": return `${block.to_do?.checked ? "✅" : "⬜"} ${text}`;
                        default: return text;
                    }
                }).join("\n") || "(Empty page)";

                return {
                    success: true,
                    content: `📄 **${title}**\n\n${content}\n\n🔗 ${page.url}`,
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const notionSkill: Skill = createSkill(
    {
        name: "notion",
        description: "Notion workspace integration - pages, databases, blocks",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "NOTION_API_KEY",
    },
    tools,
    () => !!process.env.NOTION_API_KEY
);
