import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SSHActionSchema = z.object({
    action: z.enum(["exec", "upload", "download"]).describe("SSH action to perform"),
    host: z.string().describe("SSH hostname or IP"),
    port: z.number().optional().default(22).describe("SSH port"),
    username: z.string().describe("SSH username"),
    password: z.string().optional().describe("SSH password (if not using key)"),
    privateKey: z.string().optional().describe("Path to private key file (defaults to ~/.ssh/id_rsa)"),
    // For exec
    command: z.string().optional().describe("Command to execute remotely"),
    // For upload/download
    localPath: z.string().optional().describe("Local file path"),
    remotePath: z.string().optional().describe("Remote file path"),
});

type SSHAction = z.infer<typeof SSHActionSchema>;

export const sshTool: AgentTool<SSHAction> = {
    name: "ssh",
    description: "Execute commands on remote servers via SSH, upload or download files. Supports key-based and password authentication.",
    category: "utility",
    requiresApproval: true,
    parameters: SSHActionSchema,

    async execute(params: SSHAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            const { Client } = await import("ssh2");

            // Resolve auth
            let privateKey: Buffer | undefined;
            if (!params.password) {
                const keyPath = params.privateKey || join(homedir(), ".ssh", "id_rsa");
                try {
                    privateKey = await readFile(keyPath);
                } catch {
                    return { success: false, content: "", error: `SSH key not found at ${keyPath}. Provide password or privateKey path.` };
                }
            }

            const conn = new Client();

            const connect = () => new Promise<typeof conn>((resolve, reject) => {
                conn.on("ready", () => resolve(conn));
                conn.on("error", reject);
                conn.connect({
                    host: params.host,
                    port: params.port || 22,
                    username: params.username,
                    password: params.password,
                    privateKey,
                });
            });

            await connect();

            switch (params.action) {
                case "exec": {
                    if (!params.command) {
                        conn.end();
                        return { success: false, content: "", error: "command is required" };
                    }

                    const output = await new Promise<string>((resolve, reject) => {
                        conn.exec(params.command!, (err, stream) => {
                            if (err) return reject(err);
                            let data = "";
                            let stderr = "";
                            stream.on("data", (chunk: Buffer) => { data += chunk.toString(); });
                            stream.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
                            stream.on("close", (code: number) => {
                                resolve(`${data}${stderr ? `\nSTDERR: ${stderr}` : ""}${code ? `\nExit code: ${code}` : ""}`);
                            });
                        });
                    });

                    conn.end();
                    return {
                        success: true,
                        content: `**${params.username}@${params.host}** $ ${params.command}\n\`\`\`\n${output.trim()}\n\`\`\``,
                        metadata: { host: params.host, command: params.command },
                    };
                }

                case "upload": {
                    if (!params.localPath || !params.remotePath) {
                        conn.end();
                        return { success: false, content: "", error: "localPath and remotePath are required" };
                    }

                    await new Promise<void>((resolve, reject) => {
                        conn.sftp((err, sftp) => {
                            if (err) return reject(err);
                            sftp.fastPut(params.localPath!, params.remotePath!, (err2) => {
                                if (err2) reject(err2);
                                else resolve();
                            });
                        });
                    });

                    conn.end();
                    return {
                        success: true,
                        content: `Uploaded: ${params.localPath} → ${params.username}@${params.host}:${params.remotePath}`,
                    };
                }

                case "download": {
                    if (!params.localPath || !params.remotePath) {
                        conn.end();
                        return { success: false, content: "", error: "localPath and remotePath are required" };
                    }

                    await new Promise<void>((resolve, reject) => {
                        conn.sftp((err, sftp) => {
                            if (err) return reject(err);
                            sftp.fastGet(params.remotePath!, params.localPath!, (err2) => {
                                if (err2) reject(err2);
                                else resolve();
                            });
                        });
                    });

                    conn.end();
                    return {
                        success: true,
                        content: `Downloaded: ${params.username}@${params.host}:${params.remotePath} → ${params.localPath}`,
                        metadata: { path: params.localPath },
                    };
                }

                default:
                    conn.end();
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `SSH error: ${message}` };
        }
    },
};
