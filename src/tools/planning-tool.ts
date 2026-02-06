/**
 * OpenWhale Planning Tool
 * 
 * Enables the AI to create, track, and update multi-step task plans.
 * Plans are stored in-memory per session. Inspired by OpenClaw's
 * structured agent execution approach.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

// ============== TYPES ==============

interface PlanStep {
    id: number;
    title: string;
    status: "pending" | "in_progress" | "completed" | "skipped";
    notes?: string;
}

interface Plan {
    title: string;
    steps: PlanStep[];
    createdAt: string;
    updatedAt: string;
}

// ============== IN-MEMORY STORE ==============

const sessionPlans = new Map<string, Plan>();

// ============== TOOL DEFINITION ==============

const planningParameters = z.object({
    action: z.enum(["create_plan", "get_plan", "update_step", "add_step", "complete_step"]),
    title: z.string().optional(),
    steps: z.array(z.string()).optional(),
    step_id: z.number().optional(),
    step_title: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "skipped"]).optional(),
    notes: z.string().optional(),
});

type PlanningParams = z.infer<typeof planningParameters>;

function formatPlan(plan: Plan): string {
    const lines = [`📋 **${plan.title}**`, ""];
    for (const step of plan.steps) {
        const icon =
            step.status === "completed" ? "✅" :
                step.status === "in_progress" ? "🔄" :
                    step.status === "skipped" ? "⏭️" : "⬜";
        const notesStr = step.notes ? ` — ${step.notes}` : "";
        lines.push(`${icon} ${step.id}. ${step.title}${notesStr}`);
    }
    const completed = plan.steps.filter(s => s.status === "completed").length;
    lines.push("");
    lines.push(`Progress: ${completed}/${plan.steps.length} steps completed`);
    return lines.join("\n");
}

export const planningTool: AgentTool<PlanningParams> = {
    name: "plan",
    description: `Create and manage multi-step task plans. Use this for complex tasks that require multiple tool calls.

Actions:
- create_plan: Create a new plan (title, steps[])
- get_plan: View current plan status
- update_step: Update a step's status/notes (step_id, status, notes)
- add_step: Add a new step (step_title)
- complete_step: Mark a step as completed (step_id, notes)

IMPORTANT: For any task requiring 3+ tool calls, create a plan FIRST, then work through it step by step.`,
    category: "utility",
    parameters: planningParameters,

    async execute(params: PlanningParams, context: ToolCallContext): Promise<ToolResult> {
        const sessionId = context.sessionId;

        switch (params.action) {
            case "create_plan": {
                if (!params.title || !params.steps || params.steps.length === 0) {
                    return { success: false, content: "", error: "create_plan requires 'title' and 'steps' (array of step descriptions)" };
                }

                const plan: Plan = {
                    title: params.title,
                    steps: params.steps.map((s, i) => ({
                        id: i + 1,
                        title: s,
                        status: "pending" as const,
                    })),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                sessionPlans.set(sessionId, plan);
                return { success: true, content: `Plan created!\n\n${formatPlan(plan)}` };
            }

            case "get_plan": {
                const plan = sessionPlans.get(sessionId);
                if (!plan) {
                    return { success: true, content: "No active plan for this session. Use create_plan to start one." };
                }
                return { success: true, content: formatPlan(plan) };
            }

            case "update_step": {
                const plan = sessionPlans.get(sessionId);
                if (!plan) {
                    return { success: false, content: "", error: "No active plan. Use create_plan first." };
                }
                if (params.step_id === undefined) {
                    return { success: false, content: "", error: "update_step requires 'step_id'" };
                }

                const step = plan.steps.find(s => s.id === params.step_id);
                if (!step) {
                    return { success: false, content: "", error: `Step ${params.step_id} not found. Valid IDs: ${plan.steps.map(s => s.id).join(", ")}` };
                }

                if (params.status) step.status = params.status;
                if (params.notes) step.notes = params.notes;
                plan.updatedAt = new Date().toISOString();

                return { success: true, content: `Step ${step.id} updated.\n\n${formatPlan(plan)}` };
            }

            case "add_step": {
                const plan = sessionPlans.get(sessionId);
                if (!plan) {
                    return { success: false, content: "", error: "No active plan. Use create_plan first." };
                }
                if (!params.step_title) {
                    return { success: false, content: "", error: "add_step requires 'step_title'" };
                }

                const newId = plan.steps.length > 0 ? Math.max(...plan.steps.map(s => s.id)) + 1 : 1;
                plan.steps.push({
                    id: newId,
                    title: params.step_title,
                    status: "pending",
                });
                plan.updatedAt = new Date().toISOString();

                return { success: true, content: `Step ${newId} added.\n\n${formatPlan(plan)}` };
            }

            case "complete_step": {
                const plan = sessionPlans.get(sessionId);
                if (!plan) {
                    return { success: false, content: "", error: "No active plan. Use create_plan first." };
                }
                if (params.step_id === undefined) {
                    return { success: false, content: "", error: "complete_step requires 'step_id'" };
                }

                const step = plan.steps.find(s => s.id === params.step_id);
                if (!step) {
                    return { success: false, content: "", error: `Step ${params.step_id} not found.` };
                }

                step.status = "completed";
                if (params.notes) step.notes = params.notes;
                plan.updatedAt = new Date().toISOString();

                const allDone = plan.steps.every(s => s.status === "completed" || s.status === "skipped");
                const suffix = allDone ? "\n\n🎉 All steps completed!" : "";

                return { success: true, content: `Step ${step.id} completed!${suffix}\n\n${formatPlan(plan)}` };
            }

            default:
                return { success: false, content: "", error: `Unknown action: ${params.action}` };
        }
    },
};
