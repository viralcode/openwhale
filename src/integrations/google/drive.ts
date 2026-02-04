/**
 * Google Drive Skill
 */

import { createSkill, type Skill, type SkillTool } from "../../skills/base.js";
import type { ToolResult } from "../../tools/base.js";
import { googleFetch, isGoogleConfigured, hasValidToken } from "./auth.js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

function fileIcon(mimeType: string): string {
    if (mimeType.includes("folder")) return "📁";
    if (mimeType.includes("document")) return "📄";
    if (mimeType.includes("spreadsheet")) return "📊";
    if (mimeType.includes("presentation")) return "📽️";
    if (mimeType.includes("image")) return "🖼️";
    if (mimeType.includes("video")) return "🎬";
    if (mimeType.includes("audio")) return "🎵";
    if (mimeType.includes("pdf")) return "📕";
    return "📎";
}

function formatSize(bytes: number | undefined): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const tools: SkillTool[] = [
    {
        name: "drive_list",
        description: "List files in Google Drive",
        parameters: {
            type: "object",
            properties: {
                folder_id: { type: "string", description: "Folder ID (default: root)" },
                max: { type: "number", description: "Maximum files (default: 20)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { folder_id = "root", max = 20 } = args;

                const params = new URLSearchParams({
                    q: `'${folder_id}' in parents and trashed = false`,
                    fields: "files(id,name,mimeType,size,modifiedTime)",
                    pageSize: String(max),
                    orderBy: "modifiedTime desc",
                });

                const res = await googleFetch(`${DRIVE_API}/files?${params}`);
                const data = await res.json() as { files: Array<{ id: string; name: string; mimeType: string; size?: string }> };

                const formatted = data.files?.map(f => {
                    const icon = fileIcon(f.mimeType);
                    const size = f.size ? ` (${formatSize(parseInt(f.size))})` : "";
                    return `${icon} **${f.name}**${size}\n   ID: \`${f.id}\``;
                }).join("\n\n") || "No files";

                return { success: true, content: `📂 **Drive Files**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "drive_search",
        description: "Search files in Google Drive",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                max: { type: "number", description: "Maximum results (default: 10)" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query, max = 10 } = args;

                const params = new URLSearchParams({
                    q: `name contains '${query}' and trashed = false`,
                    fields: "files(id,name,mimeType,size)",
                    pageSize: String(max),
                });

                const res = await googleFetch(`${DRIVE_API}/files?${params}`);
                const data = await res.json() as { files: Array<{ id: string; name: string; mimeType: string; size?: string }> };

                const formatted = data.files?.map(f => {
                    const icon = fileIcon(f.mimeType);
                    return `${icon} **${f.name}**\n   ID: \`${f.id}\``;
                }).join("\n\n") || "No results";

                return { success: true, content: `🔍 **Search: "${query}"**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "drive_create_folder",
        description: "Create a new folder",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Folder name" },
                parent_id: { type: "string", description: "Parent folder ID (default: root)" },
            },
            required: ["name"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { name, parent_id = "root" } = args;

                const res = await googleFetch(`${DRIVE_API}/files`, {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        mimeType: "application/vnd.google-apps.folder",
                        parents: [parent_id],
                    }),
                });

                const folder = await res.json() as { id: string; name: string };

                return { success: true, content: `✅ **Folder Created**\n\n📁 ${folder.name}\nID: \`${folder.id}\`` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "drive_delete",
        description: "Delete a file or folder",
        parameters: {
            type: "object",
            properties: {
                file_id: { type: "string", description: "File or folder ID" },
            },
            required: ["file_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { file_id } = args;

                await googleFetch(`${DRIVE_API}/files/${file_id}`, {
                    method: "DELETE",
                });

                return { success: true, content: `✅ Deleted` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const googleDriveSkill: Skill = createSkill(
    {
        name: "google_drive",
        description: "Google Drive integration - file management",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "GOOGLE_CLIENT_ID",
    },
    tools,
    () => isGoogleConfigured() && hasValidToken()
);
