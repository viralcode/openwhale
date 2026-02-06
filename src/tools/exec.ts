import { z } from "zod";
import { spawn } from "node:child_process";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { checkCommand, checkPath, auditCommand, createSandboxConfig } from "./sandbox.js";

const ExecParamsSchema = z.object({
    command: z.string().describe("The command to execute"),
    cwd: z.string().optional().describe("Working directory for the command"),
    timeout: z.number().optional().default(30000).describe("Timeout in milliseconds"),
    stdin: z.string().optional().describe("Input to send to the command"),
});

type ExecParams = z.infer<typeof ExecParamsSchema>;

export const execTool: AgentTool<ExecParams> = {
    name: "exec",
    description: "Execute a shell command and return its output. Use for running scripts, builds, tests, or any CLI operation.",
    category: "system",
    parameters: ExecParamsSchema,
    requiresElevated: true,

    async execute(params: ExecParams, context: ToolCallContext): Promise<ToolResult> {
        const { command, cwd, timeout, stdin } = params;

        // Security: Always block the most dangerous patterns
        const criticalPatterns = [
            /\brm\s+-rf\s+[\/~]/,
            /\bsudo\b/,
            /\bmkfs\b/,
            /\bdd\s+if=/,
            />\s*\/dev\//,
        ];

        for (const pattern of criticalPatterns) {
            if (pattern.test(command)) {
                return {
                    success: false,
                    content: "",
                    error: "Command blocked: potentially dangerous operation detected",
                };
            }
        }

        // Enhanced sandbox checks when sandboxed
        if (context.sandboxed) {
            const sandboxConfig = createSandboxConfig(context.workspaceDir, true);
            const cmdCheck = checkCommand(command, sandboxConfig);
            auditCommand(command, cmdCheck);
            if (!cmdCheck.allowed) {
                return {
                    success: false,
                    content: "",
                    error: cmdCheck.reason || "Command blocked by sandbox",
                };
            }

            // Validate working directory
            if (cwd) {
                const pathCheck = checkPath(cwd, sandboxConfig);
                if (!pathCheck.allowed) {
                    return {
                        success: false,
                        content: "",
                        error: pathCheck.reason || "Working directory outside sandbox",
                    };
                }
            }
        }

        return new Promise((resolve) => {
            const workDir = cwd ?? context.workspaceDir;
            const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
            const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

            const child = spawn(shell, shellArgs, {
                cwd: workDir,
                env: { ...process.env, PAGER: "cat" },
                timeout,
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            if (stdin) {
                child.stdin.write(stdin);
                child.stdin.end();
            }

            child.on("error", (err) => {
                resolve({
                    success: false,
                    content: "",
                    error: `Failed to execute command: ${err.message}`,
                });
            });

            child.on("close", (code) => {
                const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

                // Truncate very long output
                const maxLength = 50000;
                const truncatedOutput = output.length > maxLength
                    ? output.slice(0, maxLength) + `\n... (truncated ${output.length - maxLength} characters)`
                    : output;

                resolve({
                    success: code === 0,
                    content: truncatedOutput,
                    error: code !== 0 ? `Command exited with code ${code}` : undefined,
                    metadata: { exitCode: code, cwd: workDir },
                });
            });
        });
    },
};
