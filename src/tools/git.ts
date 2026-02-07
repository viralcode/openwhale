import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const GitActionSchema = z.object({
    action: z.enum(["status", "log", "diff", "commit", "push", "pull", "branch", "checkout", "clone", "stash", "tag"]).describe("Git action"),
    directory: z.string().optional().describe("Repository directory (defaults to workspace)"),
    // For commit
    message: z.string().optional().describe("Commit message"),
    addAll: z.boolean().optional().default(true).describe("Add all changes before committing"),
    // For branch/checkout
    branchName: z.string().optional().describe("Branch name"),
    createBranch: z.boolean().optional().default(false).describe("Create new branch"),
    // For clone
    url: z.string().optional().describe("Repository URL to clone"),
    // For log
    count: z.number().optional().default(10).describe("Number of log entries"),
    // For diff
    file: z.string().optional().describe("Specific file to diff"),
    staged: z.boolean().optional().default(false).describe("Show staged changes"),
    // For tag
    tagName: z.string().optional().describe("Tag name"),
    tagMessage: z.string().optional().describe("Tag message (for annotated tags)"),
    // For stash
    stashAction: z.enum(["save", "pop", "list", "drop"]).optional().default("save"),
    stashMessage: z.string().optional().describe("Stash message"),
    // For push
    remote: z.string().optional().default("origin"),
    force: z.boolean().optional().default(false),
});

type GitAction = z.infer<typeof GitActionSchema>;

async function runGit(args: string, cwd?: string): Promise<string> {
    const { stdout, stderr } = await execAsync(`git ${args}`, {
        cwd: cwd || process.cwd(),
        maxBuffer: 1024 * 1024,
    });
    return (stdout + (stderr ? `\n${stderr}` : "")).trim();
}

export const gitTool: AgentTool<GitAction> = {
    name: "git",
    description: "Perform Git operations: status, log, diff, commit, push, pull, branch, checkout, clone, stash, tag.",
    category: "utility",
    parameters: GitActionSchema,

    async execute(params: GitAction, context: ToolCallContext): Promise<ToolResult> {
        const cwd = params.directory || context.workspaceDir;

        try {
            switch (params.action) {
                case "status": {
                    const result = await runGit("status --short --branch", cwd);
                    return { success: true, content: result || "Working tree clean" };
                }

                case "log": {
                    const n = params.count || 10;
                    const result = await runGit(`log --oneline --graph --decorate -${n}`, cwd);
                    return { success: true, content: result };
                }

                case "diff": {
                    const stagedFlag = params.staged ? "--staged" : "";
                    const fileArg = params.file ? `-- "${params.file}"` : "";
                    const result = await runGit(`diff ${stagedFlag} ${fileArg}`, cwd);
                    return { success: true, content: result || "No changes" };
                }

                case "commit": {
                    if (!params.message) {
                        return { success: false, content: "", error: "Commit message is required" };
                    }
                    if (params.addAll) {
                        await runGit("add -A", cwd);
                    }
                    const result = await runGit(`commit -m "${params.message.replace(/"/g, '\\"')}"`, cwd);
                    return { success: true, content: result };
                }

                case "push": {
                    const force = params.force ? "--force" : "";
                    const result = await runGit(`push ${params.remote || "origin"} ${force}`, cwd);
                    return { success: true, content: result || "Push successful" };
                }

                case "pull": {
                    const result = await runGit(`pull ${params.remote || "origin"}`, cwd);
                    return { success: true, content: result };
                }

                case "branch": {
                    if (params.branchName && params.createBranch) {
                        const result = await runGit(`checkout -b ${params.branchName}`, cwd);
                        return { success: true, content: result };
                    }
                    const result = await runGit("branch -a", cwd);
                    return { success: true, content: result };
                }

                case "checkout": {
                    if (!params.branchName) {
                        return { success: false, content: "", error: "branchName is required" };
                    }
                    const flag = params.createBranch ? "-b" : "";
                    const result = await runGit(`checkout ${flag} ${params.branchName}`, cwd);
                    return { success: true, content: result || `Switched to ${params.branchName}` };
                }

                case "clone": {
                    if (!params.url) {
                        return { success: false, content: "", error: "Repository URL is required" };
                    }
                    const result = await runGit(`clone ${params.url}`, cwd);
                    return { success: true, content: result || `Cloned ${params.url}` };
                }

                case "stash": {
                    switch (params.stashAction) {
                        case "save": {
                            const msg = params.stashMessage ? `-m "${params.stashMessage}"` : "";
                            const result = await runGit(`stash ${msg}`, cwd);
                            return { success: true, content: result };
                        }
                        case "pop": {
                            const result = await runGit("stash pop", cwd);
                            return { success: true, content: result };
                        }
                        case "list": {
                            const result = await runGit("stash list", cwd);
                            return { success: true, content: result || "No stashes" };
                        }
                        case "drop": {
                            const result = await runGit("stash drop", cwd);
                            return { success: true, content: result };
                        }
                        default:
                            return { success: true, content: await runGit("stash", cwd) };
                    }
                }

                case "tag": {
                    if (params.tagName) {
                        const msg = params.tagMessage ? `-a -m "${params.tagMessage}"` : "";
                        const result = await runGit(`tag ${msg} ${params.tagName}`, cwd);
                        return { success: true, content: result || `Created tag: ${params.tagName}` };
                    }
                    const result = await runGit("tag -l", cwd);
                    return { success: true, content: result || "No tags" };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Git error: ${message}` };
        }
    },
};
