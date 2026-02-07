import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { stat, mkdir } from "node:fs/promises";
import { dirname, basename } from "node:path";

const execAsync = promisify(exec);

const ZipActionSchema = z.object({
    action: z.enum(["compress", "extract", "list"]).describe("Action to perform"),
    source: z.string().describe("Source file or directory path"),
    outputPath: z.string().optional().describe("Output path for compressed/extracted files"),
    format: z.enum(["zip", "tar.gz"]).optional().default("zip").describe("Compression format"),
});

type ZipAction = z.infer<typeof ZipActionSchema>;

export const zipTool: AgentTool<ZipAction> = {
    name: "zip",
    description: "Compress files/directories into ZIP or tar.gz archives, extract archives, or list archive contents.",
    category: "utility",
    parameters: ZipActionSchema,

    async execute(params: ZipAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            switch (params.action) {
                case "compress": {
                    const source = params.source;
                    const sourceName = basename(source);
                    const output = params.outputPath || (params.format === "tar.gz"
                        ? `${source}.tar.gz`
                        : `${source}.zip`);

                    await mkdir(dirname(output), { recursive: true });

                    let cmd: string;
                    if (params.format === "tar.gz") {
                        cmd = `tar -czf "${output}" -C "${dirname(source)}" "${sourceName}"`;
                    } else {
                        // Check if source is directory
                        const srcStat = await stat(source);
                        if (srcStat.isDirectory()) {
                            cmd = `cd "${dirname(source)}" && zip -r "${output}" "${sourceName}"`;
                        } else {
                            cmd = `zip -j "${output}" "${source}"`;
                        }
                    }

                    await execAsync(cmd);
                    const outStat = await stat(output);
                    const sizeKB = (outStat.size / 1024).toFixed(1);

                    return {
                        success: true,
                        content: `Compressed: ${source} → ${output} (${sizeKB} KB)`,
                        metadata: { path: output, sizeBytes: outStat.size, format: params.format },
                    };
                }

                case "extract": {
                    const output = params.outputPath || dirname(params.source);
                    await mkdir(output, { recursive: true });

                    let cmd: string;
                    if (params.source.endsWith(".tar.gz") || params.source.endsWith(".tgz")) {
                        cmd = `tar -xzf "${params.source}" -C "${output}"`;
                    } else if (params.source.endsWith(".tar")) {
                        cmd = `tar -xf "${params.source}" -C "${output}"`;
                    } else {
                        cmd = `unzip -o "${params.source}" -d "${output}"`;
                    }

                    const { stdout } = await execAsync(cmd);
                    return {
                        success: true,
                        content: `Extracted: ${params.source} → ${output}\n${stdout.slice(0, 500)}`,
                        metadata: { extractedTo: output },
                    };
                }

                case "list": {
                    let cmd: string;
                    if (params.source.endsWith(".tar.gz") || params.source.endsWith(".tgz")) {
                        cmd = `tar -tzf "${params.source}"`;
                    } else if (params.source.endsWith(".tar")) {
                        cmd = `tar -tf "${params.source}"`;
                    } else {
                        cmd = `unzip -l "${params.source}"`;
                    }

                    const { stdout } = await execAsync(cmd);
                    return {
                        success: true,
                        content: `Contents of ${params.source}:\n\`\`\`\n${stdout.trim()}\n\`\`\``,
                    };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Zip error: ${message}` };
        }
    },
};
