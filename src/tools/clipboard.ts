import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const ClipboardActionSchema = z.object({
    action: z.enum(["read", "write"]).describe("Action to perform"),
    content: z.string().optional().describe("Content to write to clipboard (for write action)"),
});

type ClipboardAction = z.infer<typeof ClipboardActionSchema>;

const platform = process.platform;

export const clipboardTool: AgentTool<ClipboardAction> = {
    name: "clipboard",
    description: "Read from or write to the system clipboard. Supports macOS (pbcopy/pbpaste), Windows (PowerShell), and Linux (xclip).",
    category: "system",
    parameters: ClipboardActionSchema,

    async execute(params: ClipboardAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            if (params.action === "read") {
                let cmd: string;
                if (platform === "darwin") {
                    cmd = "pbpaste";
                } else if (platform === "win32") {
                    cmd = "powershell -NoProfile -Command Get-Clipboard";
                } else if (platform === "linux") {
                    cmd = "xclip -selection clipboard -o";
                } else {
                    return { success: false, content: "", error: `Clipboard not supported on ${platform}` };
                }

                const { stdout } = await execAsync(cmd);
                return {
                    success: true,
                    content: `Clipboard contents:\n${stdout}`,
                    metadata: { length: stdout.length },
                };
            } else {
                if (!params.content) {
                    return { success: false, content: "", error: "content is required for write action" };
                }

                if (platform === "darwin") {
                    await execAsync(`echo ${JSON.stringify(params.content)} | pbcopy`);
                } else if (platform === "win32") {
                    // Use PowerShell Set-Clipboard — pipe content via stdin
                    await execAsync(`powershell -NoProfile -Command "Set-Clipboard -Value '${params.content.replace(/'/g, "''")}'"`);
                } else if (platform === "linux") {
                    await execAsync(`echo ${JSON.stringify(params.content)} | xclip -selection clipboard`);
                } else {
                    return { success: false, content: "", error: `Clipboard not supported on ${platform}` };
                }

                return {
                    success: true,
                    content: `Copied ${params.content.length} characters to clipboard`,
                    metadata: { length: params.content.length },
                };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Clipboard error: ${message}` };
        }
    },
};
