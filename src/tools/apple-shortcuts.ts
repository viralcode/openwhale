import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const ShortcutsActionSchema = z.object({
    action: z.enum(["run", "list"]).describe("Action to perform"),
    name: z.string().optional().describe("Shortcut name to run"),
    input: z.string().optional().describe("Input text to pass to the shortcut"),
});

type ShortcutsAction = z.infer<typeof ShortcutsActionSchema>;

export const shortcutsTool: AgentTool<ShortcutsAction> = {
    name: "shortcuts",
    description: "Run Apple Shortcuts by name or list all available shortcuts. macOS only.",
    category: "system",
    parameters: ShortcutsActionSchema,

    async execute(params: ShortcutsAction, _context: ToolCallContext): Promise<ToolResult> {
        if (process.platform !== "darwin") {
            return { success: false, content: "", error: "Apple Shortcuts only available on macOS" };
        }

        try {
            switch (params.action) {
                case "list": {
                    const { stdout } = await execAsync("shortcuts list");
                    const shortcuts = stdout.trim().split("\n").filter(Boolean);
                    return {
                        success: true,
                        content: `Found ${shortcuts.length} shortcuts:\n${shortcuts.map(s => `• ${s}`).join("\n")}`,
                        metadata: { count: shortcuts.length, shortcuts },
                    };
                }

                case "run": {
                    if (!params.name) {
                        return { success: false, content: "", error: "name is required to run a shortcut" };
                    }

                    let cmd = `shortcuts run "${params.name.replace(/"/g, '\\"')}"`;
                    if (params.input) {
                        cmd = `echo ${JSON.stringify(params.input)} | ${cmd}`;
                    }

                    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
                    return {
                        success: true,
                        content: stdout.trim() || `Shortcut "${params.name}" executed successfully.${stderr ? `\nWarnings: ${stderr}` : ""}`,
                        metadata: { shortcut: params.name },
                    };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Shortcuts error: ${message}` };
        }
    },
};
