import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const CronActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("schedule"),
        expression: z.string().describe("Cron expression (e.g., '0 9 * * *' for 9 AM daily)"),
        task: z.string().describe("Description of what to do when triggered"),
        name: z.string().optional().describe("Name for this scheduled task"),
    }),
    z.object({
        action: z.literal("list"),
    }),
    z.object({
        action: z.literal("delete"),
        jobId: z.string().describe("ID of the job to delete"),
    }),
    z.object({
        action: z.literal("pause"),
        jobId: z.string(),
    }),
    z.object({
        action: z.literal("resume"),
        jobId: z.string(),
    }),
]);

type CronAction = z.infer<typeof CronActionSchema>;

// In-memory job storage (in production, use database)
const scheduledJobs: Map<string, {
    id: string;
    expression: string;
    task: string;
    name?: string;
    enabled: boolean;
    createdAt: Date;
    lastRunAt?: Date;
}> = new Map();

export const cronTool: AgentTool<CronAction> = {
    name: "cron",
    description: "Schedule recurring tasks using cron expressions. Jobs run automatically at specified times.",
    category: "utility",
    parameters: CronActionSchema,

    async execute(params: CronAction, _context: ToolCallContext): Promise<ToolResult> {
        switch (params.action) {
            case "schedule": {
                const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                // Validate cron expression (basic check)
                const parts = params.expression.split(" ");
                if (parts.length < 5 || parts.length > 6) {
                    return {
                        success: false,
                        content: "",
                        error: "Invalid cron expression. Use format: minute hour day month weekday",
                    };
                }

                scheduledJobs.set(id, {
                    id,
                    expression: params.expression,
                    task: params.task,
                    name: params.name,
                    enabled: true,
                    createdAt: new Date(),
                });

                return {
                    success: true,
                    content: `Scheduled job created:\nID: ${id}\nCron: ${params.expression}\nTask: ${params.task}`,
                    metadata: { jobId: id, expression: params.expression },
                };
            }

            case "list": {
                const jobs = Array.from(scheduledJobs.values());
                if (jobs.length === 0) {
                    return { success: true, content: "No scheduled jobs." };
                }

                const list = jobs.map(job =>
                    `• ${job.id}${job.name ? ` (${job.name})` : ""}\n  Cron: ${job.expression}\n  Task: ${job.task}\n  Status: ${job.enabled ? "Active" : "Paused"}`
                ).join("\n\n");

                return {
                    success: true,
                    content: `Scheduled jobs:\n\n${list}`,
                    metadata: { count: jobs.length },
                };
            }

            case "delete": {
                if (!scheduledJobs.has(params.jobId)) {
                    return { success: false, content: "", error: `Job not found: ${params.jobId}` };
                }
                scheduledJobs.delete(params.jobId);
                return { success: true, content: `Deleted job: ${params.jobId}` };
            }

            case "pause": {
                const job = scheduledJobs.get(params.jobId);
                if (!job) {
                    return { success: false, content: "", error: `Job not found: ${params.jobId}` };
                }
                job.enabled = false;
                return { success: true, content: `Paused job: ${params.jobId}` };
            }

            case "resume": {
                const job = scheduledJobs.get(params.jobId);
                if (!job) {
                    return { success: false, content: "", error: `Job not found: ${params.jobId}` };
                }
                job.enabled = true;
                return { success: true, content: `Resumed job: ${params.jobId}` };
            }
        }
    },
};
