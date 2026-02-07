import { randomBytes } from "node:crypto";
import type { DrizzleDB } from "../db/connection.js";
import { sessions, messages } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { registry } from "../providers/base.js";
import { toolRegistry, type ToolCallContext } from "../tools/index.js";
import type { Message } from "../providers/base.js";
import { buildSystemPrompt } from "./prompt-builder.js";

export type AgentSession = {
    id: string;
    key: string;
    userId?: string;
    agentId: string;
    model: string;
    messages: Message[];
    workspaceDir: string;
    sandboxed: boolean;
    createdAt: Date;
};

export type RunResult = {
    response: string;
    toolCalls?: Array<{ name: string; result: string }>;
    inputTokens: number;
    outputTokens: number;
    model: string;
};

export class AgentRunner {
    private db: DrizzleDB;
    private sessionCache: Map<string, AgentSession> = new Map();

    constructor(db: DrizzleDB) {
        this.db = db;
    }

    async getOrCreateSession(
        key: string,
        options: {
            userId?: string;
            agentId?: string;
            model?: string;
            workspaceDir?: string;
        } = {}
    ): Promise<AgentSession> {
        // Check cache
        let session = this.sessionCache.get(key);
        if (session) return session;

        // Check database
        const existing = this.db.select().from(sessions).where(eq(sessions.key, key)).get();

        if (existing) {
            // Load messages
            const storedMessages = this.db.select()
                .from(messages)
                .where(eq(messages.sessionId, existing.id))
                .orderBy(messages.createdAt)
                .all();

            const model = existing.model ?? process.env.DEFAULT_MODEL;
            if (!model) throw new Error("Session has no model and DEFAULT_MODEL not set");

            session = {
                id: existing.id,
                key: existing.key,
                userId: existing.userId ?? undefined,
                agentId: existing.agentId,
                model,
                messages: storedMessages.map(m => ({
                    role: m.role as Message["role"],
                    content: m.content,
                })),
                workspaceDir: options.workspaceDir ?? process.cwd(),
                sandboxed: false,
                createdAt: existing.createdAt,
            };
        } else {
            // Create new session
            const id = randomBytes(16).toString("hex");

            const model = options.model ?? process.env.DEFAULT_MODEL;
            if (!model) throw new Error("No model specified and DEFAULT_MODEL not set");

            this.db.insert(sessions).values({
                id,
                key,
                userId: options.userId,
                agentId: options.agentId ?? "default",
                model,
            }).run();

            session = {
                id,
                key,
                userId: options.userId,
                agentId: options.agentId ?? "default",
                model,
                messages: [],
                workspaceDir: options.workspaceDir ?? process.cwd(),
                sandboxed: false,
                createdAt: new Date(),
            };
        }

        this.sessionCache.set(key, session);
        return session;
    }

    async run(
        sessionKey: string,
        userMessage: string,
        options: {
            model?: string;
            maxToolRounds?: number;
            systemPromptOverride?: string;
        } = {}
    ): Promise<RunResult> {
        const session = await this.getOrCreateSession(sessionKey);
        const model = options.model ?? session.model;
        const maxRounds = options.maxToolRounds ?? 10;

        // Add user message
        session.messages.push({ role: "user", content: userMessage });
        await this.saveMessage(session.id, "user", userMessage);

        // Build system prompt
        const systemPrompt = options.systemPromptOverride ?? buildSystemPrompt({
            agentId: session.agentId,
            workspaceDir: session.workspaceDir,
            tools: toolRegistry.listEnabled().map(t => t.name),
        });

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const toolCallResults: Array<{ name: string; result: string }> = [];

        // Agent loop with tool execution
        for (let round = 0; round < maxRounds; round++) {
            const response = await registry.complete({
                model,
                messages: session.messages,
                systemPrompt,
                tools: toolRegistry.toOpenAITools().map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters as Record<string, unknown>,
                })),
            });

            totalInputTokens += response.inputTokens ?? 0;
            totalOutputTokens += response.outputTokens ?? 0;

            // If no tool calls, we're done
            if (!response.toolCalls?.length) {
                session.messages.push({ role: "assistant", content: response.content });
                await this.saveMessage(session.id, "assistant", response.content, {
                    model: response.model,
                    inputTokens: response.inputTokens,
                    outputTokens: response.outputTokens,
                });

                return {
                    response: response.content,
                    toolCalls: toolCallResults.length ? toolCallResults : undefined,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    model: response.model,
                };
            }

            // Execute tool calls
            const toolContext: ToolCallContext = {
                sessionId: session.id,
                userId: session.userId,
                agentId: session.agentId,
                workspaceDir: session.workspaceDir,
                sandboxed: session.sandboxed,
            };

            const toolResults: Array<{ toolCallId: string; content: string }> = [];

            for (const toolCall of response.toolCalls) {
                const result = await toolRegistry.execute(toolCall.name, toolCall.arguments, toolContext);

                toolResults.push({
                    toolCallId: toolCall.id,
                    content: result.success ? result.content : `Error: ${result.error}`,
                });

                toolCallResults.push({
                    name: toolCall.name,
                    result: result.content || result.error || "",
                });
            }

            // Add assistant message with tool calls and tool results
            session.messages.push({
                role: "assistant",
                content: response.content,
                toolCalls: response.toolCalls,
            });

            session.messages.push({
                role: "tool",
                content: "",
                toolResults,
            });
        }

        // Max rounds reached
        const finalMessage = "Maximum tool execution rounds reached.";
        session.messages.push({ role: "assistant", content: finalMessage });

        return {
            response: finalMessage,
            toolCalls: toolCallResults,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            model,
        };
    }

    private async saveMessage(
        sessionId: string,
        role: string,
        content: string,
        metadata?: {
            model?: string;
            inputTokens?: number;
            outputTokens?: number;
            toolCalls?: unknown[];
            toolResults?: unknown[];
        }
    ): Promise<void> {
        this.db.insert(messages).values({
            id: randomBytes(16).toString("hex"),
            sessionId,
            role: role as "user" | "assistant" | "system" | "tool",
            content,
            model: metadata?.model,
            inputTokens: metadata?.inputTokens,
            outputTokens: metadata?.outputTokens,
            toolCalls: metadata?.toolCalls,
            toolResults: metadata?.toolResults,
        }).run();
    }

    clearSession(sessionKey: string): void {
        const session = this.sessionCache.get(sessionKey);
        if (session) {
            session.messages = [];
            this.db.delete(messages).where(eq(messages.sessionId, session.id)).run();
        }
    }
}
