/**
 * Google Tasks Skill
 */

import { createSkill, type Skill, type SkillTool } from "../../skills/base.js";
import type { ToolResult } from "../../tools/base.js";
import { googleFetch, isGoogleConfigured, hasValidToken } from "./auth.js";

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

const tools: SkillTool[] = [
    {
        name: "tasks_lists",
        description: "List all task lists",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                const res = await googleFetch(`${TASKS_API}/users/@me/lists`);
                const data = await res.json() as { items: Array<{ id: string; title: string }> };

                const formatted = data.items?.map(l =>
                    `📋 **${l.title}**\n   ID: \`${l.id}\``
                ).join("\n\n") || "No task lists";

                return { success: true, content: `📋 **Task Lists**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "tasks_list",
        description: "List tasks in a task list",
        parameters: {
            type: "object",
            properties: {
                list_id: { type: "string", description: "Task list ID" },
                show_completed: { type: "boolean", description: "Include completed tasks" },
            },
            required: ["list_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_id, show_completed = false } = args;

                const params = new URLSearchParams();
                if (!show_completed) {
                    params.append("showCompleted", "false");
                }

                const res = await googleFetch(`${TASKS_API}/lists/${list_id}/tasks?${params}`);
                const data = await res.json() as { items?: Array<{ id: string; title: string; status: string; due?: string }> };

                if (!data.items?.length) {
                    return { success: true, content: "📋 **Tasks**\n\nNo tasks." };
                }

                const formatted = data.items.map(t => {
                    const icon = t.status === "completed" ? "✅" : "⬜";
                    const due = t.due ? `\n   📅 Due: ${new Date(t.due).toLocaleDateString()}` : "";
                    return `${icon} **${t.title}**${due}`;
                }).join("\n\n");

                return { success: true, content: `📋 **Tasks**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "tasks_create",
        description: "Create a new task",
        parameters: {
            type: "object",
            properties: {
                list_id: { type: "string", description: "Task list ID" },
                title: { type: "string", description: "Task title" },
                notes: { type: "string", description: "Task notes" },
                due: { type: "string", description: "Due date (ISO format)" },
            },
            required: ["list_id", "title"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_id, title, notes, due } = args;

                const task: Record<string, unknown> = { title };
                if (notes) task.notes = notes;
                if (due) task.due = due;

                const res = await googleFetch(`${TASKS_API}/lists/${list_id}/tasks`, {
                    method: "POST",
                    body: JSON.stringify(task),
                });

                const created = await res.json() as { id: string; title: string };

                return { success: true, content: `✅ **Task Created**\n\n📋 ${created.title}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "tasks_complete",
        description: "Mark a task as complete",
        parameters: {
            type: "object",
            properties: {
                list_id: { type: "string", description: "Task list ID" },
                task_id: { type: "string", description: "Task ID" },
            },
            required: ["list_id", "task_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_id, task_id } = args;

                await googleFetch(`${TASKS_API}/lists/${list_id}/tasks/${task_id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "completed" }),
                });

                return { success: true, content: `✅ Task completed` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "tasks_delete",
        description: "Delete a task",
        parameters: {
            type: "object",
            properties: {
                list_id: { type: "string", description: "Task list ID" },
                task_id: { type: "string", description: "Task ID" },
            },
            required: ["list_id", "task_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_id, task_id } = args;

                await googleFetch(`${TASKS_API}/lists/${list_id}/tasks/${task_id}`, {
                    method: "DELETE",
                });

                return { success: true, content: `✅ Task deleted` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const googleTasksSkill: Skill = createSkill(
    {
        name: "google_tasks",
        description: "Google Tasks integration - todo lists and tasks",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "GOOGLE_CLIENT_ID",
    },
    tools,
    () => isGoogleConfigured() && hasValidToken()
);
