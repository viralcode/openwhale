import { z } from "zod";

export type ToolCallContext = {
    sessionId: string;
    userId?: string;
    agentId?: string;
    workspaceDir: string;
    sandboxed: boolean;
};

export type ToolResult = {
    success: boolean;
    content: string;
    error?: string;
    metadata?: Record<string, unknown>;
};

export interface AgentTool<TParams = unknown> {
    name: string;
    description: string;
    category: "browser" | "system" | "utility" | "communication" | "device";
    parameters: z.ZodType<TParams, z.ZodTypeDef, unknown>;
    execute(params: TParams, context: ToolCallContext): Promise<ToolResult>;
    // Optional capabilities
    requiresApproval?: boolean;
    requiresElevated?: boolean;
    disabled?: boolean;
}

export class ToolRegistry {
    private tools: Map<string, AgentTool> = new Map();

    register<T>(tool: AgentTool<T>): void {
        this.tools.set(tool.name, tool as AgentTool);
    }

    get(name: string): AgentTool | undefined {
        return this.tools.get(name);
    }

    list(): AgentTool[] {
        return Array.from(this.tools.values());
    }

    // Alias for list - for compatibility
    getAll(): AgentTool[] {
        return this.list();
    }

    listEnabled(): AgentTool[] {
        return this.list().filter(t => !t.disabled);
    }

    getByCategory(category: AgentTool["category"]): AgentTool[] {
        return this.list().filter(t => t.category === category);
    }

    async execute(
        name: string,
        params: unknown,
        context: ToolCallContext
    ): Promise<ToolResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            return { success: false, content: "", error: `Unknown tool: ${name}` };
        }

        try {
            const validatedParams = tool.parameters.parse(params);
            return await tool.execute(validatedParams, context);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: message };
        }
    }

    // Generate OpenAI function schema
    toOpenAITools(): Array<{
        type: "function";
        function: { name: string; description: string; parameters: unknown };
    }> {
        return this.listEnabled().map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: this.zodToJsonSchema(tool.parameters),
            },
        }));
    }

    // Public method to convert Zod schema to JSON Schema
    zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
        // Basic conversion - in production use zod-to-json-schema
        if (schema instanceof z.ZodObject) {
            const shape = schema.shape;
            const properties: Record<string, unknown> = {};
            const required: string[] = [];

            for (const [key, value] of Object.entries(shape)) {
                const zodField = value as z.ZodType;
                properties[key] = this.zodFieldToJson(zodField);
                if (!zodField.isOptional()) {
                    required.push(key);
                }
            }

            return { type: "object", properties, required };
        }
        return { type: "object", properties: {} };
    }

    private zodFieldToJson(field: z.ZodType): Record<string, unknown> {
        // Unwrap wrappers first
        if (field instanceof z.ZodOptional) {
            return this.zodFieldToJson(field.unwrap());
        }
        if (field instanceof z.ZodDefault) {
            const inner = this.zodFieldToJson(field.removeDefault());
            const def = field._def.defaultValue();
            if (def !== undefined) inner.default = def;
            return inner;
        }
        if (field instanceof z.ZodNullable) {
            return this.zodFieldToJson(field.unwrap());
        }

        // Get description if present
        const desc = field.description;
        const base: Record<string, unknown> = {};
        if (desc) base.description = desc;

        // Primitives
        if (field instanceof z.ZodString) return { ...base, type: "string" };
        if (field instanceof z.ZodNumber) return { ...base, type: "number" };
        if (field instanceof z.ZodBoolean) return { ...base, type: "boolean" };

        // Enum
        if (field instanceof z.ZodEnum) {
            return { ...base, type: "string", enum: field.options };
        }

        // Array
        if (field instanceof z.ZodArray) {
            return { ...base, type: "array", items: this.zodFieldToJson(field.element) };
        }

        // Record (e.g. z.record(z.string()))
        if (field instanceof z.ZodRecord) {
            return { ...base, type: "object", additionalProperties: this.zodFieldToJson(field.element) };
        }

        // Nested object
        if (field instanceof z.ZodObject) {
            const shape = field.shape;
            const properties: Record<string, unknown> = {};
            const required: string[] = [];
            for (const [key, value] of Object.entries(shape)) {
                const zodField = value as z.ZodType;
                properties[key] = this.zodFieldToJson(zodField);
                if (!zodField.isOptional()) {
                    required.push(key);
                }
            }
            return { ...base, type: "object", properties, ...(required.length ? { required } : {}) };
        }

        return { ...base, type: "string" };
    }
}

export const toolRegistry = new ToolRegistry();
