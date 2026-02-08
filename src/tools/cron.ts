import { z } from "zod";
import cron, { type ScheduledTask } from "node-cron";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

/**
 * Get the system's local timezone (e.g. "America/New_York")
 */
function getSystemTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return "UTC";
    }
}

/**
 * Execute a cron task by sending it to the AI agent for processing.
 * The AI has full tool access (WhatsApp, exec, browser, etc.) so it can
 * actually carry out the task described in the job.
 */
async function executeJobTask(job: { id: string; task: string; name?: string; expression: string }): Promise<void> {
    const tz = getSystemTimezone();
    const localTime = new Date().toLocaleString("en-US", { timeZone: tz });
    console.log(`[Cron] ⏰ Job fired: ${job.name || job.id} at ${localTime} (${tz})`);
    console.log(`[Cron] Task: ${job.task}`);

    try {
        // Dynamically import to avoid circular dependencies
        const { processMessage, getCurrentModel } = await import("../sessions/session-service.js");

        // Use whatever model is currently active in the system
        const model = getCurrentModel();

        // Send the task to the AI with context about what triggered it
        const prompt = `[SCHEDULED TASK - AUTO-EXECUTE]\nA cron job has fired. You MUST execute the following task NOW, do not ask for confirmation:\n\nTask: ${job.task}\nJob Name: ${job.name || job.id}\nSchedule: ${job.expression}\nFired at: ${localTime} (${tz})\n\nExecute this task immediately using the appropriate tools.`;

        const response = await processMessage(`cron-${job.id}`, prompt, {
            model,
            maxIterations: 10,
        });

        console.log(`[Cron] ✅ Task completed: ${job.name || job.id}`);
        console.log(`[Cron] AI response: ${response.content?.slice(0, 200)}...`);
    } catch (err) {
        console.error(`[Cron] ❌ Task failed: ${job.name || job.id}`, err);
    }
}

const CronActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("schedule"),
        expression: z.string().describe("Cron expression (e.g., '34 10 * * *' for 10:34 AM daily, or '*/5 * * * *' for every 5 minutes). For a one-time reminder N minutes from now, calculate the exact minute and hour."),
        task: z.string().describe("The task to execute when triggered. Be specific - e.g., 'Send a WhatsApp message to +1234567890 saying: Put your pants on!'"),
        name: z.string().optional().describe("Human-readable name for this job"),
        oneTime: z.boolean().optional().describe("If true, the job will be deleted after firing once (useful for reminders)"),
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

// In-memory job storage with real cron tasks
const scheduledJobs: Map<string, {
    id: string;
    expression: string;
    task: string;
    name?: string;
    enabled: boolean;
    timezone: string;
    oneTime: boolean;
    createdAt: Date;
    lastRunAt?: Date;
    cronTask: ScheduledTask;
}> = new Map();

export const cronTool: AgentTool<CronAction> = {
    name: "cron",
    description: "Schedule tasks that the AI will automatically execute at specified times. Uses your system's local timezone. The AI has full tool access when executing (WhatsApp, browser, exec, etc.). Use for reminders, recurring tasks, and timed actions. For one-time reminders, calculate the exact cron time and set oneTime: true. Example: to remind in 5 min at 10:34 AM → expression: '34 10 8 2 *', oneTime: true.",
    category: "utility",
    parameters: CronActionSchema,

    async execute(params: CronAction, _context: ToolCallContext): Promise<ToolResult> {
        switch (params.action) {
            case "schedule": {
                // Validate cron expression using node-cron
                if (!cron.validate(params.expression)) {
                    return {
                        success: false,
                        content: "",
                        error: "Invalid cron expression. Use format: minute hour day month weekday (e.g., '0 7 * * *' for 7 AM daily)",
                    };
                }

                const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const tz = getSystemTimezone();
                const isOneTime = params.oneTime ?? false;

                // Create a real cron job that executes the task via AI
                const cronTask = cron.schedule(params.expression, async () => {
                    const job = scheduledJobs.get(id);
                    if (!job || !job.enabled) return;

                    job.lastRunAt = new Date();

                    // Execute task through the AI
                    await executeJobTask(job);

                    // If one-time, auto-delete after firing
                    if (job.oneTime) {
                        console.log(`[Cron] 🗑️ One-time job completed, removing: ${job.name || job.id}`);
                        job.cronTask.stop();
                        scheduledJobs.delete(id);
                    }
                }, {
                    timezone: tz,
                });

                scheduledJobs.set(id, {
                    id,
                    expression: params.expression,
                    task: params.task,
                    name: params.name,
                    enabled: true,
                    timezone: tz,
                    oneTime: isOneTime,
                    createdAt: new Date(),
                    cronTask,
                });

                const typeLabel = isOneTime ? "One-time reminder" : "Recurring job";
                return {
                    success: true,
                    content: `${typeLabel} scheduled!\nID: ${id}\nCron: ${params.expression}\nTimezone: ${tz}\nTask: ${params.task}\n\nWhen this fires, the AI will automatically execute the task with full tool access.`,
                    metadata: { jobId: id, expression: params.expression, timezone: tz, oneTime: isOneTime },
                };
            }

            case "list": {
                const jobs = Array.from(scheduledJobs.values());
                if (jobs.length === 0) {
                    return { success: true, content: "No scheduled jobs." };
                }

                const tz = getSystemTimezone();
                const list = jobs.map(job =>
                    `• ${job.id}${job.name ? ` (${job.name})` : ""}\n  Cron: ${job.expression}\n  Type: ${job.oneTime ? "One-time" : "Recurring"}\n  Timezone: ${job.timezone}\n  Task: ${job.task}\n  Status: ${job.enabled ? "Active" : "Paused"}\n  Last run: ${job.lastRunAt ? job.lastRunAt.toLocaleString("en-US", { timeZone: tz }) : "Never"}`
                ).join("\n\n");

                return {
                    success: true,
                    content: `Scheduled jobs (timezone: ${tz}):\n\n${list}`,
                    metadata: { count: jobs.length },
                };
            }

            case "delete": {
                const job = scheduledJobs.get(params.jobId);
                if (!job) {
                    return { success: false, content: "", error: `Job not found: ${params.jobId}` };
                }
                job.cronTask.stop();
                scheduledJobs.delete(params.jobId);
                return { success: true, content: `Deleted job: ${params.jobId}` };
            }

            case "pause": {
                const job = scheduledJobs.get(params.jobId);
                if (!job) {
                    return { success: false, content: "", error: `Job not found: ${params.jobId}` };
                }
                job.enabled = false;
                job.cronTask.stop();
                return { success: true, content: `Paused job: ${params.jobId}` };
            }

            case "resume": {
                const job = scheduledJobs.get(params.jobId);
                if (!job) {
                    return { success: false, content: "", error: `Job not found: ${params.jobId}` };
                }
                job.enabled = true;
                job.cronTask.start();
                return { success: true, content: `Resumed job: ${params.jobId}` };
            }
        }
    },
};
