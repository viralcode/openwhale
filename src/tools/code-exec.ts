import { z } from "zod";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const CodeExecParamsSchema = z.object({
    code: z.string().describe("The JavaScript/TypeScript code to execute"),
    language: z.enum(["javascript", "typescript", "python"]).optional().default("javascript").describe("Programming language"),
    description: z.string().optional().describe("What this code does (for logging)"),
    timeout: z.number().optional().default(30000).describe("Timeout in milliseconds"),
});

type CodeExecParams = z.infer<typeof CodeExecParamsSchema>;

/**
 * Dynamic code execution tool - allows AI to write and run code on the fly
 * This enables endless possibilities as the AI can create any functionality it needs
 */
export const codeExecTool: AgentTool<CodeExecParams> = {
    name: "code_exec",
    description: `Execute dynamically generated code. Use this to write and run JavaScript/TypeScript/Python code on-the-fly when no existing tool meets your needs. This gives you unlimited capabilities - you can:
- Process data in complex ways
- Make API calls to any service
- Parse or transform files
- Calculate anything
- Create visualizations
- And much more!

The code runs in Node.js (for JS/TS) or Python. You have access to common modules.`,
    category: "system",
    parameters: CodeExecParamsSchema,
    requiresElevated: true,

    async execute(params: CodeExecParams, context: ToolCallContext): Promise<ToolResult> {
        const { code, language, description, timeout } = params;

        // Create temp directory for code files
        const tempDir = join(context.workspaceDir || process.cwd(), ".openwhale-temp");
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        let tempFile: string;
        let command: string;

        try {
            if (language === "python") {
                tempFile = join(tempDir, `code_${timestamp}.py`);
                writeFileSync(tempFile, code);
                command = `python3 "${tempFile}"`;
            } else {
                // JavaScript/TypeScript
                tempFile = join(tempDir, `code_${timestamp}.${language === "typescript" ? "ts" : "js"}`);

                // Wrap code with common imports for convenience
                const wrappedCode = `
// Auto-injected imports for convenience
import fetch from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Helper functions
const readFile = (p) => fs.readFileSync(p, 'utf8');
const writeFile = (p, c) => fs.writeFileSync(p, c);
const exists = (p) => fs.existsSync(p);
const listDir = (p) => fs.readdirSync(p);
const run = (cmd) => execSync(cmd, { encoding: 'utf8' });

// User code starts here
${code}
`;
                writeFileSync(tempFile, wrappedCode);

                if (language === "typescript") {
                    command = `npx tsx "${tempFile}"`;
                } else {
                    command = `node "${tempFile}"`;
                }
            }

            // Execute the code
            return new Promise((resolve) => {
                const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
                const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

                const child = spawn(shell, shellArgs, {
                    cwd: context.workspaceDir || process.cwd(),
                    env: { ...process.env, NODE_NO_WARNINGS: "1" },
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

                child.on("error", (err) => {
                    // Cleanup temp file
                    try { unlinkSync(tempFile); } catch { }

                    resolve({
                        success: false,
                        content: "",
                        error: `Failed to execute code: ${err.message}`,
                    });
                });

                child.on("close", (exitCode) => {
                    // Cleanup temp file
                    try { unlinkSync(tempFile); } catch { }

                    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

                    // Truncate very long output
                    const maxLength = 50000;
                    const truncatedOutput = output.length > maxLength
                        ? output.slice(0, maxLength) + `\n... (truncated ${output.length - maxLength} characters)`
                        : output;

                    resolve({
                        success: exitCode === 0,
                        content: truncatedOutput || "(no output)",
                        error: exitCode !== 0 ? `Code exited with code ${exitCode}\n${stderr}` : undefined,
                        metadata: {
                            language,
                            description,
                            exitCode,
                        },
                    });
                });
            });
        } catch (err: any) {
            return {
                success: false,
                content: "",
                error: `Failed to setup code execution: ${err.message}`,
            };
        }
    },
};
