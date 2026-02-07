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

export const clipboardTool: AgentTool<ClipboardAction> = {
    name: "clipboard",
    description: "Read from or write to the system clipboard. macOS (pbcopy/pbpaste) and Linux (xclip) supported.",
    category: "system",
    parameters: ClipboardActionSchema,

    async execute(params: ClipboardAction, _context: ToolCallContext): Promise<ToolResult> {
        const isMac = process.platform === "darwin";
        const isLinux = process.platform === "linux";

        if (!isMac && !isLinux) {
            return { success: false, content: "", error: "Clipboard only supported on macOS and Linux" };
        }

        try {
            if (params.action === "read") {
                const cmd = isMac ? "pbpaste" : "xclip -selection clipboard -o";
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
                const cmd = isMac ? "pbcopy" : "xclip -selection clipboard";
                await execAsync(`echo ${JSON.stringify(params.content)} | ${cmd}`);
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
