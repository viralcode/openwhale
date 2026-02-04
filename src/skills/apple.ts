/**
 * Apple Notes & Reminders Skills - macOS integration via AppleScript
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runAppleScript(script: string): Promise<string> {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    return stdout.trim();
}

const notesTools: SkillTool[] = [
    {
        name: "notes_list",
        description: "List recent Apple Notes",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Max notes to return (default: 10)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { limit = 10 } = args;

                const script = `
                    tell application "Notes"
                        set noteList to {}
                        repeat with n in notes
                            if (count of noteList) >= ${limit} then exit repeat
                            set end of noteList to (name of n)
                        end repeat
                        return noteList
                    end tell
                `;

                const output = await runAppleScript(script);
                const notes = output.split(", ").filter(Boolean);

                const formatted = notes.map((n, i) =>
                    `${i + 1}. 📝 ${n}`
                ).join("\n");

                return { success: true, content: `📝 **Recent Notes**\n\n${formatted || "No notes"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "notes_create",
        description: "Create a new Apple Note",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Note title" },
                body: { type: "string", description: "Note content" },
            },
            required: ["title"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { title, body = "" } = args;

                const content = `<h1>${title}</h1><p>${(body as string).replace(/\n/g, "<br>")}</p>`;

                const script = `
                    tell application "Notes"
                        tell folder "Notes"
                            make new note with properties {name:"${title}", body:"${content}"}
                        end tell
                    end tell
                `;

                await runAppleScript(script);

                return { success: true, content: `✅ **Note Created**\n\n📝 ${title}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "notes_search",
        description: "Search Apple Notes",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query } = args;

                const script = `
                    tell application "Notes"
                        set matchingNotes to {}
                        repeat with n in notes
                            if name of n contains "${query}" or body of n contains "${query}" then
                                set end of matchingNotes to (name of n)
                            end if
                            if (count of matchingNotes) >= 10 then exit repeat
                        end repeat
                        return matchingNotes
                    end tell
                `;

                const output = await runAppleScript(script);
                const notes = output.split(", ").filter(Boolean);

                const formatted = notes.map(n => `📝 ${n}`).join("\n");

                return { success: true, content: `🔍 **Search: "${query}"**\n\n${formatted || "No matches"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

const remindersTools: SkillTool[] = [
    {
        name: "reminders_list",
        description: "List reminders",
        parameters: {
            type: "object",
            properties: {
                list_name: { type: "string", description: "Reminder list name" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { list_name } = args;

                let script: string;
                if (list_name) {
                    script = `
                        tell application "Reminders"
                            set reminderList to {}
                            tell list "${list_name}"
                                repeat with r in reminders
                                    if not completed of r then
                                        set end of reminderList to (name of r & "|" & (completed of r as text))
                                    end if
                                end repeat
                            end tell
                            return reminderList
                        end tell
                    `;
                } else {
                    script = `
                        tell application "Reminders"
                            set reminderList to {}
                            repeat with r in reminders
                                if not completed of r then
                                    set end of reminderList to (name of r & "|" & (completed of r as text))
                                end if
                                if (count of reminderList) >= 20 then exit repeat
                            end repeat
                            return reminderList
                        end tell
                    `;
                }

                const output = await runAppleScript(script);
                const reminders = output.split(", ").filter(Boolean).map(r => {
                    const [name, completed] = r.split("|");
                    return { name, completed: completed === "true" };
                });

                const formatted = reminders.map(r =>
                    `${r.completed ? "✅" : "⬜"} ${r.name}`
                ).join("\n");

                return { success: true, content: `📋 **Reminders**\n\n${formatted || "No reminders"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "reminders_create",
        description: "Create a new reminder",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Reminder title" },
                list_name: { type: "string", description: "Reminder list name" },
            },
            required: ["title"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { title, list_name = "Reminders" } = args;

                const script = `
                    tell application "Reminders"
                        tell list "${list_name}"
                            make new reminder with properties {name:"${title}"}
                        end tell
                    end tell
                `;

                await runAppleScript(script);

                return { success: true, content: `✅ **Reminder Created**\n\n📋 ${title}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "reminders_complete",
        description: "Mark a reminder as complete",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Reminder title to complete" },
                list_name: { type: "string", description: "Reminder list name" },
            },
            required: ["title"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { title, list_name = "Reminders" } = args;

                const script = `
                    tell application "Reminders"
                        tell list "${list_name}"
                            set completed of (first reminder whose name is "${title}") to true
                        end tell
                    end tell
                `;

                await runAppleScript(script);

                return { success: true, content: `✅ Completed: **${title}**` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const appleNotesSkill: Skill = createSkill(
    {
        name: "apple_notes",
        description: "Apple Notes integration - create, search, list notes",
        version: "1.0.0",
        requiresAuth: false,
    },
    notesTools,
    () => process.platform === "darwin"
);

export const appleRemindersSkill: Skill = createSkill(
    {
        name: "apple_reminders",
        description: "Apple Reminders integration - create, list, complete reminders",
        version: "1.0.0",
        requiresAuth: false,
    },
    remindersTools,
    () => process.platform === "darwin"
);
