/**
 * Agents List Tool - List all configured agents
 * 
 * Allows agents to discover available agent IDs for spawning and coordination.
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { listAgentConfigs, canAgentSpawn } from "../agents/agent-config.js";

export const agentsListSchema = z.object({
    includeDisabled: z.boolean().optional().default(false)
        .describe("Include disabled agents in the list"),
});

export type AgentsListParams = z.infer<typeof agentsListSchema>;

async function executeAgentsList(
    params: AgentsListParams,
    context: ToolCallContext
): Promise<ToolResult> {
    try {
        let agents = listAgentConfigs();

        if (!params.includeDisabled) {
            agents = agents.filter(a => a.enabled);
        }

        const currentAgentId = context.agentId || "main";

        const agentList = agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            model: agent.model || "(default)",
            capabilities: agent.capabilities || [],
            isDefault: agent.isDefault,
            enabled: agent.enabled,
            canSpawn: canAgentSpawn(currentAgentId, agent.id),
        }));

        return {
            success: true,
            content: JSON.stringify({
                count: agentList.length,
                currentAgent: currentAgentId,
                agents: agentList,
            }, null, 2),
            metadata: { count: agentList.length },
        };
    } catch (error) {
        return {
            success: false,
            content: "",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export const agentsListTool: AgentTool<AgentsListParams> = {
    name: "agents_list",
    description: "List all available agents that can be targeted by sessions_spawn. Discover agent IDs, capabilities, and whether you can spawn them.",
    category: "communication",
    parameters: agentsListSchema,
    execute: executeAgentsList,
};

export default agentsListTool;
