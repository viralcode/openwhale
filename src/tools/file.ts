import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const FileActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("read"),
        path: z.string().describe("Absolute path to the file"),
        encoding: z.enum(["utf-8", "base64"]).optional().default("utf-8"),
    }),
    z.object({
        action: z.literal("write"),
        path: z.string().describe("Absolute path to the file"),
        content: z.string().describe("Content to write"),
        createDirs: z.boolean().optional().default(true),
    }),
    z.object({
        action: z.literal("append"),
        path: z.string(),
        content: z.string(),
    }),
    z.object({
        action: z.literal("delete"),
        path: z.string(),
        recursive: z.boolean().optional().default(false),
    }),
    z.object({
        action: z.literal("list"),
        path: z.string().describe("Directory path to list"),
        recursive: z.boolean().optional().default(false),
    }),
    z.object({
        action: z.literal("mkdir"),
        path: z.string(),
        recursive: z.boolean().optional().default(true),
    }),
    z.object({
        action: z.literal("copy"),
        source: z.string(),
        destination: z.string(),
    }),
    z.object({
        action: z.literal("move"),
        source: z.string(),
        destination: z.string(),
    }),
    z.object({
        action: z.literal("stat"),
        path: z.string(),
    }),
]);

type FileAction = z.infer<typeof FileActionSchema>;

export const fileTool: AgentTool<FileAction> = {
    name: "file",
    description: "Perform file system operations: read, write, list, delete, copy, move files and directories.",
    category: "system",
    parameters: FileActionSchema,

    async execute(params: FileAction, context: ToolCallContext): Promise<ToolResult> {
        // Security: Ensure paths are within workspace
        const validatePath = (p: string): string => {
            const resolved = path.resolve(p);
            if (!resolved.startsWith(context.workspaceDir) && !context.sandboxed) {
                throw new Error(`Access denied: path outside workspace: ${resolved}`);
            }
            return resolved;
        };

        try {
            switch (params.action) {
                case "read": {
                    const filePath = validatePath(params.path);
                    const content = await fs.readFile(filePath, params.encoding === "base64" ? "base64" : "utf-8");

                    // Truncate if too long
                    const maxLen = 50000;
                    const truncated = content.length > maxLen
                        ? content.slice(0, maxLen) + `\n... (truncated ${content.length - maxLen} chars)`
                        : content;

                    return { success: true, content: truncated };
                }

                case "write": {
                    const filePath = validatePath(params.path);
                    if (params.createDirs) {
                        await fs.mkdir(path.dirname(filePath), { recursive: true });
                    }
                    await fs.writeFile(filePath, params.content, "utf-8");
                    return {
                        success: true,
                        content: `Wrote ${params.content.length} bytes to ${params.path}`,
                        metadata: { path: params.path, sizeBytes: params.content.length, action: "write" },
                    };
                }

                case "append": {
                    const filePath = validatePath(params.path);
                    await fs.appendFile(filePath, params.content, "utf-8");
                    return {
                        success: true,
                        content: `Appended ${params.content.length} bytes to ${params.path}`,
                        metadata: { path: params.path, sizeBytes: params.content.length, action: "append" },
                    };
                }

                case "delete": {
                    const filePath = validatePath(params.path);
                    if (params.recursive) {
                        await fs.rm(filePath, { recursive: true, force: true });
                    } else {
                        await fs.unlink(filePath);
                    }
                    return { success: true, content: `Deleted: ${params.path}` };
                }

                case "list": {
                    const dirPath = validatePath(params.path);

                    if (params.recursive) {
                        const items: string[] = [];
                        const walk = async (dir: string, prefix = ""): Promise<void> => {
                            const entries = await fs.readdir(dir, { withFileTypes: true });
                            for (const entry of entries) {
                                const fullPath = path.join(dir, entry.name);
                                const relPath = prefix + entry.name;
                                items.push(entry.isDirectory() ? `${relPath}/` : relPath);
                                if (entry.isDirectory()) {
                                    await walk(fullPath, relPath + "/");
                                }
                            }
                        };
                        await walk(dirPath);
                        return { success: true, content: items.join("\n") };
                    } else {
                        const entries = await fs.readdir(dirPath, { withFileTypes: true });
                        const list = entries.map(e => e.isDirectory() ? `${e.name}/` : e.name);
                        return { success: true, content: list.join("\n") };
                    }
                }

                case "mkdir": {
                    const dirPath = validatePath(params.path);
                    await fs.mkdir(dirPath, { recursive: params.recursive });
                    return {
                        success: true,
                        content: `Created directory: ${params.path}`,
                        metadata: { path: params.path, action: "mkdir" },
                    };
                }

                case "copy": {
                    const src = validatePath(params.source);
                    const dst = validatePath(params.destination);
                    await fs.cp(src, dst, { recursive: true });
                    return {
                        success: true,
                        content: `Copied ${params.source} to ${params.destination}`,
                        metadata: { path: params.destination, action: "copy" },
                    };
                }

                case "move": {
                    const src = validatePath(params.source);
                    const dst = validatePath(params.destination);
                    await fs.rename(src, dst);
                    return { success: true, content: `Moved ${params.source} to ${params.destination}` };
                }

                case "stat": {
                    const filePath = validatePath(params.path);
                    const stat = await fs.stat(filePath);
                    return {
                        success: true,
                        content: JSON.stringify({
                            size: stat.size,
                            isFile: stat.isFile(),
                            isDirectory: stat.isDirectory(),
                            created: stat.birthtime.toISOString(),
                            modified: stat.mtime.toISOString(),
                            mode: stat.mode.toString(8),
                        }, null, 2),
                    };
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: message };
        }
    },
};
