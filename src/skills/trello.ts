/**
 * Trello Skill - Trello board management
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const TRELLO_API = "https://api.trello.com/1";

function getTrelloAuth(): string {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    if (!key || !token) throw new Error("TRELLO_API_KEY and TRELLO_TOKEN required");
    return `key=${key}&token=${token}`;
}

const tools: SkillTool[] = [
    {
        name: "trello_boards",
        description: "List your Trello boards",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                const res = await fetch(`${TRELLO_API}/members/me/boards?${getTrelloAuth()}`);
                const boards = await res.json() as Array<{ id: string; name: string; url: string }>;

                const formatted = boards.map(b =>
                    `📋 **${b.name}**\n   ID: \`${b.id}\``
                ).join("\n\n");

                return { success: true, content: `📋 **Your Trello Boards**\n\n${formatted || "No boards"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "trello_lists",
        description: "Get lists on a board",
        parameters: {
            type: "object",
            properties: {
                board_id: { type: "string", description: "Board ID" },
            },
            required: ["board_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { board_id } = args;
                const res = await fetch(`${TRELLO_API}/boards/${board_id}/lists?${getTrelloAuth()}`);
                const lists = await res.json() as Array<{ id: string; name: string }>;

                const formatted = lists.map(l =>
                    `📝 **${l.name}**\n   ID: \`${l.id}\``
                ).join("\n\n");

                return { success: true, content: `📝 **Board Lists**\n\n${formatted || "No lists"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "trello_cards",
        description: "Get cards from a list",
        parameters: {
            type: "object",
            properties: {
                list_id: { type: "string", description: "List ID" },
            },
            required: ["list_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_id } = args;
                const res = await fetch(`${TRELLO_API}/lists/${list_id}/cards?${getTrelloAuth()}`);
                const cards = await res.json() as Array<{ id: string; name: string; desc: string; due: string | null }>;

                const formatted = cards.map(c => {
                    const due = c.due ? `\n   📅 Due: ${new Date(c.due).toLocaleDateString()}` : "";
                    return `🎴 **${c.name}**${due}\n   ${c.desc?.slice(0, 50) || "(No desc)"}`;
                }).join("\n\n");

                return { success: true, content: `🎴 **Cards**\n\n${formatted || "No cards"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "trello_create_card",
        description: "Create a new card",
        parameters: {
            type: "object",
            properties: {
                list_id: { type: "string", description: "List ID" },
                name: { type: "string", description: "Card name" },
                desc: { type: "string", description: "Card description" },
            },
            required: ["list_id", "name"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_id, name, desc } = args;

                const params = new URLSearchParams({
                    idList: list_id as string,
                    name: name as string,
                });
                if (desc) params.append("desc", desc as string);

                const res = await fetch(`${TRELLO_API}/cards?${getTrelloAuth()}&${params}`, {
                    method: "POST",
                });
                const card = await res.json() as { id: string; name: string; url: string };

                return {
                    success: true,
                    content: `✅ **Card Created**\n\n🎴 ${card.name}\n🔗 ${card.url}`
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const trelloSkill: Skill = createSkill(
    {
        name: "trello",
        description: "Trello board and card management",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "TRELLO_API_KEY",
    },
    tools,
    () => !!(process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN)
);
