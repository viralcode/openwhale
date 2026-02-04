/**
 * Multi-Agent Router - Route messages to specialized agents
 */

export interface Agent {
    id: string;
    name: string;
    description: string;
    systemPrompt?: string;
    model?: string;
    capabilities: string[];
}

export interface RoutingRule {
    id: string;
    priority: number;
    condition: RoutingCondition;
    agentId: string;
}

export type RoutingCondition =
    | { type: "channel"; value: string }
    | { type: "user"; value: string }
    | { type: "keyword"; values: string[] }
    | { type: "time"; from: number; to: number }  // Hours
    | { type: "regex"; pattern: string };

// Agent registry
const agents = new Map<string, Agent>();
const routingRules: RoutingRule[] = [];
let defaultAgentId = "default";

/**
 * Register an agent
 */
export function registerAgent(agent: Agent): void {
    agents.set(agent.id, agent);
    console.log(`[Router] Registered agent: ${agent.id} - ${agent.name}`);
}

/**
 * Unregister an agent
 */
export function unregisterAgent(id: string): boolean {
    return agents.delete(id);
}

/**
 * Get an agent by ID
 */
export function getAgent(id: string): Agent | undefined {
    return agents.get(id);
}

/**
 * List all agents
 */
export function listAgents(): Agent[] {
    return Array.from(agents.values());
}

/**
 * Set the default agent
 */
export function setDefaultAgent(id: string): void {
    if (!agents.has(id)) {
        throw new Error(`Agent ${id} not found`);
    }
    defaultAgentId = id;
}

/**
 * Add a routing rule
 */
export function addRoutingRule(rule: Omit<RoutingRule, "id">): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    routingRules.push({ ...rule, id });
    routingRules.sort((a, b) => b.priority - a.priority);
    return id;
}

/**
 * Remove a routing rule
 */
export function removeRoutingRule(id: string): boolean {
    const idx = routingRules.findIndex(r => r.id === id);
    if (idx !== -1) {
        routingRules.splice(idx, 1);
        return true;
    }
    return false;
}

/**
 * Route a message to the appropriate agent
 */
export function routeMessage(context: {
    channel: string;
    userId: string;
    content: string;
}): Agent {
    const { channel, userId, content } = context;
    const hour = new Date().getHours();

    for (const rule of routingRules) {
        let matched = false;

        switch (rule.condition.type) {
            case "channel":
                matched = channel === rule.condition.value;
                break;
            case "user":
                matched = userId === rule.condition.value;
                break;
            case "keyword":
                matched = rule.condition.values.some(kw =>
                    content.toLowerCase().includes(kw.toLowerCase())
                );
                break;
            case "time":
                matched = hour >= rule.condition.from && hour < rule.condition.to;
                break;
            case "regex":
                matched = new RegExp(rule.condition.pattern, "i").test(content);
                break;
        }

        if (matched) {
            const agent = agents.get(rule.agentId);
            if (agent) {
                console.log(`[Router] Routed to ${agent.id} via rule ${rule.id}`);
                return agent;
            }
        }
    }

    return agents.get(defaultAgentId) || {
        id: "default",
        name: "Default",
        description: "Default assistant",
        capabilities: ["general"],
    };
}

/**
 * Initialize default agents
 */
export function initializeDefaultAgents(): void {
    registerAgent({
        id: "default",
        name: "OpenWhale",
        description: "General purpose AI assistant",
        capabilities: ["general", "code", "tools"],
    });

    registerAgent({
        id: "limited",
        name: "Limited Mode",
        description: "Restricted capabilities for unknown users",
        systemPrompt: "You are a limited assistant. Be helpful but cautious.",
        capabilities: ["general"],
    });

    registerAgent({
        id: "coder",
        name: "Code Assistant",
        description: "Specialized for programming tasks",
        systemPrompt: "You are an expert programmer. Focus on code quality and best practices.",
        capabilities: ["code", "tools"],
    });
}

// Initialize on import
initializeDefaultAgents();
