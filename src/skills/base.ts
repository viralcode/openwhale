/**
 * OpenWhale Skills Framework
 * 
 * Skills are modular integrations that provide specific capabilities
 * to the AI assistant. Each skill can expose multiple tools.
 */

import { z } from "zod";
import type { ToolCallContext, ToolResult } from "../tools/base.js";
import { logger } from "../logger.js";

export interface SkillMetadata {
    name: string;
    description: string;
    version: string;
    author?: string;
    requiresAuth?: boolean;
    authConfigKey?: string;  // Key in config/env for this skill's auth
}

// Skill tool uses JSON schema for portability (converted to Zod at registration)
export interface SkillTool {
    name: string;
    description: string;
    parameters?: {
        type: "object";
        properties: Record<string, {
            type: string;
            description?: string;
            enum?: string[];
            items?: { type: string };
        }>;
        required?: string[];
    };
    execute(args: Record<string, unknown>, context: ToolCallContext): Promise<ToolResult>;
}

export interface Skill {
    metadata: SkillMetadata;

    /**
     * Get the tools this skill provides
     */
    getTools(): SkillTool[];

    /**
     * Initialize the skill (check auth, connect to APIs, etc.)
     */
    initialize?(): Promise<void>;

    /**
     * Check if the skill is properly configured and ready
     */
    isReady(): boolean;

    /**
     * Get the skill's configuration status
     */
    getStatus(): SkillStatus;
}

export interface SkillStatus {
    ready: boolean;
    authenticated: boolean;
    error?: string;
    lastUsed?: Date;
}

/**
 * Skill Registry - manages all registered skills
 */
class SkillRegistry {
    private skills = new Map<string, Skill>();

    /**
     * Register a skill
     */
    register(skill: Skill): void {
        this.skills.set(skill.metadata.name, skill);
        console.log(`[Skills] Registered: ${skill.metadata.name}`);
        logger.info("system", `Skill registered: ${skill.metadata.name}`);
    }

    /**
     * Unregister a skill by name
     */
    unregister(name: string): boolean {
        const existed = this.skills.delete(name);
        if (existed) {
            console.log(`[Skills] Unregistered: ${name}`);
            logger.info("system", `Skill unregistered: ${name}`);
        }
        return existed;
    }

    /**
     * Get a skill by name
     */
    get(name: string): Skill | undefined {
        return this.skills.get(name);
    }

    /**
     * Get all registered skills
     */
    list(): Skill[] {
        return Array.from(this.skills.values());
    }

    /**
     * Get all tools from all skills (as SkillTool, not AgentTool)
     */
    getAllTools(): SkillTool[] {
        const tools: SkillTool[] = [];
        for (const skill of this.skills.values()) {
            if (skill.isReady()) {
                tools.push(...skill.getTools());
            }
        }
        return tools;
    }

    /**
     * Initialize all skills
     */
    async initializeAll(): Promise<void> {
        for (const skill of this.skills.values()) {
            try {
                await skill.initialize?.();
            } catch (err) {
                console.error(`[Skills] Failed to initialize ${skill.metadata.name}:`, err);
                logger.error("system", `Skill init failed: ${skill.metadata.name}`, { error: String(err) });
            }
        }
    }

    /**
     * Get status of all skills
     */
    getStatusAll(): Record<string, SkillStatus> {
        const statuses: Record<string, SkillStatus> = {};
        for (const [name, skill] of this.skills) {
            statuses[name] = skill.getStatus();
        }
        return statuses;
    }
}

export const skillRegistry = new SkillRegistry();

/**
 * Helper to create a simple skill
 */
export function createSkill(
    metadata: SkillMetadata,
    tools: SkillTool[],
    isReady: () => boolean = () => true
): Skill {
    let lastUsed: Date | undefined;

    // Wrap each tool to track usage
    const wrappedTools = tools.map(tool => ({
        ...tool,
        execute: async (args: Record<string, unknown>, context: ToolCallContext): Promise<ToolResult> => {
            lastUsed = new Date();
            return tool.execute(args, context);
        }
    }));

    return {
        metadata,
        getTools: () => wrappedTools,
        isReady,
        getStatus: () => ({
            ready: isReady(),
            authenticated: !metadata.requiresAuth || isReady(),
            lastUsed,
        }),
    };
}

/**
 * Convert SkillTool to AgentTool compatible format for registration
 */
export function skillToolToZod(tool: SkillTool): {
    name: string;
    description: string;
    category: "utility";
    parameters: z.ZodObject<Record<string, z.ZodTypeAny>>;
    execute: (params: Record<string, unknown>, context: ToolCallContext) => Promise<ToolResult>;
} {
    // Build Zod schema from JSON schema
    const properties: Record<string, z.ZodTypeAny> = {};
    const required = tool.parameters?.required || [];

    if (tool.parameters?.properties) {
        for (const [key, prop] of Object.entries(tool.parameters.properties)) {
            let zodType: z.ZodTypeAny;

            switch (prop.type) {
                case "number":
                    zodType = z.number();
                    break;
                case "boolean":
                    zodType = z.boolean();
                    break;
                case "array":
                    zodType = z.array(z.string());
                    break;
                case "object":
                    zodType = z.record(z.unknown());
                    break;
                default:
                    if (prop.enum) {
                        zodType = z.enum(prop.enum as [string, ...string[]]);
                    } else {
                        zodType = z.string();
                    }
            }

            // Make optional if not in required
            if (!required.includes(key)) {
                zodType = zodType.optional();
            }

            properties[key] = zodType;
        }
    }

    return {
        name: tool.name,
        description: tool.description,
        category: "utility" as const,
        parameters: z.object(properties),
        execute: tool.execute,
    };
}
