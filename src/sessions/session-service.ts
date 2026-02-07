/**
 * OpenWhale Session Service - Unified Chat Processing
 * 
 * Provides the same AI conversation loop for all clients:
 * - Dashboard web UI
 * - WhatsApp/Telegram channels
 * - CLI interface
 * 
 * Features:
 * - Iterative tool execution (up to 25 rounds)
 * - Shared message history
 * - Real-time tool call events
 * - Context compaction for long conversations
 * - Full tool call transcript recording
 * - Planning tool integration for multi-step tasks
 * - Sandbox mode for safe command execution
 */

import { randomUUID } from "crypto";
import { hostname } from "os";
import { registry } from "../providers/index.js";
import type { Message, ToolResult as ProviderToolResult } from "../providers/base.js";
import { toolRegistry } from "../tools/index.js";
import { skillRegistry } from "../skills/base.js";
import type { ToolCallContext } from "../tools/base.js";
import { checkCommand, auditCommand, createSandboxConfig } from "../tools/sandbox.js";
import {
    getOrCreateSessionLegacy,
    addMessage,
    clearSession,
} from "./index.js";
import {
    getSessionContext,
    recordUserMessage,
    recordAssistantMessage,
    recordToolUse,
    recordToolResult,
    finalizeExchange,
} from "./session-manager.js";
import { getMemoryContext } from "../memory/memory-files.js";
import { compactIfNeeded } from "./compaction.js";

// ============== TYPES ==============

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    toolCalls?: ToolCallInfo[];
    model?: string;
    createdAt: string;
}

export interface ToolCallInfo {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    metadata?: Record<string, unknown>;  // Preserves metadata like base64 images
    status: "pending" | "running" | "completed" | "error";
}

export interface ChatEvent {
    type: "message" | "tool_start" | "tool_end" | "error" | "done";
    data: unknown;
}

import { db } from "../db/index.js";

// ============== SINGLETON STATE ==============

let currentModel = "claude-sonnet-4-20250514";

// Dashboard-specific message store (with tool call info)
// Uses in-memory cache + SQLite persistence
const dashboardMessages: ChatMessage[] = [];
let dbInitialized = false;

// Initialize message table and load history
function ensureDbInit(): void {
    if (dbInitialized) return;
    dbInitialized = true;

    try {
        // Create table if not exists
        db.exec(`
            CREATE TABLE IF NOT EXISTS dashboard_messages (
                id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_calls TEXT,
                model TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                created_at INTEGER DEFAULT (unixepoch())
            )
        `);

        // Load existing messages into memory
        const rows = db.prepare(`
            SELECT id, role, content, tool_calls, model, created_at 
            FROM dashboard_messages 
            ORDER BY created_at ASC 
            LIMIT 100
        `).all() as Array<{
            id: string;
            role: string;
            content: string;
            tool_calls: string | null;
            model: string | null;
            created_at: number;
        }>;

        for (const row of rows) {
            dashboardMessages.push({
                id: row.id,
                role: row.role as "user" | "assistant" | "system",
                content: row.content,
                toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
                model: row.model || undefined,
                createdAt: new Date(row.created_at * 1000).toISOString(),
            });
        }

        console.log(`[SessionService] Loaded ${rows.length} messages from database`);
    } catch (e) {
        console.warn("[SessionService] Failed to init DB:", e);
    }
}

// Save a message to database
function persistMessage(msg: ChatMessage): void {
    try {
        ensureDbInit();
        db.prepare(`
            INSERT OR REPLACE INTO dashboard_messages (id, role, content, tool_calls, model, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            msg.id,
            msg.role,
            msg.content,
            msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
            msg.model || null,
            Math.floor(new Date(msg.createdAt).getTime() / 1000)
        );
        console.log(`[SessionService] Persisted message ${msg.id} (${msg.role})`);
    } catch (e) {
        console.warn("[SessionService] Failed to persist message:", e);
    }
}

// ============== INITIALIZATION ==============

export function initializeProvider(apiKey: string, model?: string): void {
    // Legacy function - provider initialization now handled by registry
    if (model) currentModel = model;
    ensureDbInit(); // Load history on init
    console.log(`[SessionService] Provider initialized with model: ${currentModel}`);
}

export function setModel(model: string): void {
    currentModel = model;
}

export function getProvider(): unknown {
    // Returns the provider from registry for the current model
    return registry.getProvider(currentModel);
}

export function getCurrentModel(): string {
    return currentModel;
}

// ============== MESSAGE HISTORY ==============

export function getChatHistory(limit = 100): ChatMessage[] {
    ensureDbInit();
    return dashboardMessages.slice(-limit);
}

export function clearChatHistory(): void {
    dashboardMessages.length = 0;

    try {
        db.prepare("DELETE FROM dashboard_messages").run();
    } catch (e) {
        console.warn("[SessionService] Failed to clear DB messages:", e);
    }
}


// ============== UNIFIED CHAT PROCESSING ==============

/**
 * Process a chat message with full tool support
 * This is the unified entry point for all clients (dashboard, WhatsApp, CLI)
 */
export async function processMessage(
    sessionId: string,
    content: string,
    options: {
        model?: string;
        maxIterations?: number;
        onToolStart?: (tool: ToolCallInfo) => void;
        onToolEnd?: (tool: ToolCallInfo) => void;
    } = {}
): Promise<ChatMessage> {
    const { model = currentModel, maxIterations = 25, onToolStart, onToolEnd } = options;

    // Ensure provider is available for the selected model
    const provider = registry.getProvider(model);
    console.log(`[SessionService] Model requested: ${model}, Provider found: ${provider?.name || 'NONE'}`);
    if (!provider) {
        throw new Error(`No provider available for model: ${model}. Please configure the appropriate API key.`);
    }

    // Create user message
    const userMsg: ChatMessage = {
        id: randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
    };
    dashboardMessages.push(userMsg);
    persistMessage(userMsg);

    // Get or create persistent session with history
    const sessionCtx = getSessionContext("dashboard", "dm", sessionId);
    const { session } = sessionCtx;

    // Record to JSONL transcript
    recordUserMessage(session.sessionId, content);

    // Also store in legacy session for compatibility
    getOrCreateSessionLegacy(sessionId, "dashboard");
    addMessage(sessionId, "user", content);

    // Build tools list
    const allTools = toolRegistry.getAll();
    const tools: Array<{ name: string; description: string; parameters: unknown }> = allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toolRegistry.zodToJsonSchema(tool.parameters),
    }));

    // Add WhatsApp-specific tools (same as daemon)
    tools.push({
        name: "whatsapp_send",
        description: "Send a text message via WhatsApp",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Phone number with country code (e.g. +1234567890)" },
                message: { type: "string", description: "Message text to send" },
            },
            required: ["to", "message"],
        },
    });

    tools.push({
        name: "whatsapp_send_image",
        description: "Send an image via WhatsApp. After taking a screenshot, call this with use_last_screenshot: true to send it.",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Phone number to send to" },
                use_last_screenshot: { type: "boolean", description: "Set to true to send the last captured screenshot" },
                caption: { type: "string", description: "Optional caption for the image" },
            },
            required: ["to", "use_last_screenshot"],
        },
    });

    // Add skill tools from all ready skills
    const skillTools = skillRegistry.getAllTools();
    for (const skillTool of skillTools) {
        tools.push({
            name: skillTool.name,
            description: skillTool.description,
            parameters: skillTool.parameters || { type: "object", properties: {}, required: [] },
        });
    }

    console.log(`[SessionService] Tools available: ${tools.length} (${allTools.length} base + 2 WhatsApp + ${skillTools.length} skill tools)`);

    // Build message history for context, filtering out empty messages
    const msgHistory: Message[] = dashboardMessages
        .slice(-20)
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

    // Build dynamic system prompt with available skills
    const skillToolNames = skillTools.map(t => t.name);
    const baseToolNames = allTools.map(t => t.name);

    const now = new Date();
    const runtimeInfo = `OS: ${process.platform} ${process.arch} | Host: ${hostname()} | Node: ${process.version} | Time: ${now.toISOString()} | CWD: ${process.cwd()}`;

    const systemPrompt = `You are OpenWhale, an AI assistant with FULL tool access. You are authenticated and connected.

## Runtime
${runtimeInfo}

## Your Available Tools (${tools.length} total)
Base Tools: ${baseToolNames.join(", ")}
Skill Tools: ${skillToolNames.length > 0 ? skillToolNames.join(", ") : "None configured"}

## CRITICAL RULES - FOLLOW THESE EXACTLY
1. **NEVER say "I don't have access"** - You DO have access. Use your tools.
2. **NEVER ask for credentials, tokens, or API keys** - They are already configured.
3. **NEVER say "I cannot access your account"** - You CAN. Just use the tool.
4. When asked about GitHub, emails, calendar, weather, Twitter, etc. - CALL THE TOOL IMMEDIATELY.
5. You have up to ${maxIterations} tool execution rounds. Use them wisely.

## Multi-Step Tasks
For complex tasks requiring 3+ tool calls:
1. **Plan first**: Use the \`plan\` tool to create a step-by-step plan before executing.
2. **Execute systematically**: Work through the plan step by step, marking steps complete.
3. **Track progress**: Use \`plan\` with action \`complete_step\` after finishing each step.
4. **Wrap up early**: If you're approaching the iteration limit, provide a summary of what's done and what remains.

## Tool Usage
- Planning → use \`plan\` (create_plan, update_step, complete_step, get_plan, add_step)
- GitHub repos → use \`github_repos\`
- GitHub issues → use \`github_issues\`
- Weather → use \`weather_current\` or \`weather_forecast\`
- Gmail → use \`gmail_read\`, \`gmail_send\`
- Calendar → use \`calendar_events\`
- Drive → use \`drive_list\`
- Twitter timeline → use \`twitter_timeline\`
- Twitter mentions → use \`twitter_mentions\`
- Post tweet → use \`twitter_post\`
- Reply to tweet → use \`twitter_reply\`
- Search Twitter → use \`twitter_search\`
- Twitter user info → use \`twitter_user\`

## Your Identity
You are a fully authenticated AI assistant. All integrations are configured and ready.
Do NOT apologize for previous errors or claim you lack access. Just execute the task.`;

    // Load memory context and append to system prompt
    const memoryContext = getMemoryContext();
    const fullSystemPrompt = memoryContext
        ? systemPrompt + "\n\n" + memoryContext
        : systemPrompt;

    const sandboxConfig = createSandboxConfig(process.cwd(), false);

    const context: ToolCallContext = {
        sessionId,
        workspaceDir: process.cwd(),
        sandboxed: sandboxConfig.enabled,
    };

    try {
        let iterations = 0;
        const allToolCalls: ToolCallInfo[] = [];
        let finalContent = "";

        // Iterative tool execution loop
        while (iterations < maxIterations) {
            iterations++;

            // Compact history if it's getting too long
            await compactIfNeeded(msgHistory, model, session.sessionId);

            // Warn the AI if approaching the limit
            if (iterations === Math.floor(maxIterations * 0.8)) {
                msgHistory.push({
                    role: "user",
                    content: `[System] You have used ${iterations}/${maxIterations} iterations. Please wrap up your current task and provide a final response soon.`,
                });
            }

            const response = await registry.complete({
                model,
                messages: msgHistory,
                systemPrompt: fullSystemPrompt,
                tools: tools as any,
                maxTokens: 8192,
                stream: false,
            });

            // No tool calls = done
            if (!response.toolCalls || response.toolCalls.length === 0) {
                finalContent = response.content || "Done!";
                break;
            }

            // Process tool calls
            for (const tc of response.toolCalls) {
                const toolInfo: ToolCallInfo = {
                    id: tc.id || randomUUID(),
                    name: tc.name,
                    arguments: tc.arguments,
                    status: "running",
                };
                allToolCalls.push(toolInfo);

                // Notify start
                onToolStart?.(toolInfo);

                try {
                    console.log(`[SessionService] 🔧 Executing: ${tc.name} (iteration ${iterations}/${maxIterations})`);

                    // Record tool use to transcript
                    recordToolUse(session.sessionId, tc.name, tc.arguments);

                    // Sandbox check for exec commands
                    if (tc.name === "exec" && sandboxConfig.enabled) {
                        const cmd = (tc.arguments as { command?: string }).command || "";
                        const sandboxCheck = checkCommand(cmd, sandboxConfig);
                        auditCommand(cmd, sandboxCheck);
                        if (!sandboxCheck.allowed) {
                            toolInfo.result = sandboxCheck.reason;
                            toolInfo.status = "error";
                            recordToolResult(session.sessionId, tc.name, sandboxCheck.reason || "Blocked by sandbox", false);
                            onToolEnd?.(toolInfo);
                            continue;
                        }
                    }

                    // Handle WhatsApp-specific tools
                    if (tc.name === "whatsapp_send") {
                        const { sendWhatsAppMessage } = await import("../channels/whatsapp-baileys.js");
                        const args = tc.arguments as { to: string; message: string };
                        await sendWhatsAppMessage(args.to, args.message);
                        toolInfo.result = `Message sent to ${args.to}`;
                        toolInfo.status = "completed";
                    } else if (tc.name === "whatsapp_send_image") {
                        // For now, just indicate it's not yet fully implemented in dashboard
                        toolInfo.result = "WhatsApp image sending is available via WhatsApp channel directly";
                        toolInfo.status = "completed";
                    } else {
                        // Try regular tools first
                        const tool = toolRegistry.get(tc.name);
                        if (tool) {
                            const result = await toolRegistry.execute(tc.name, tc.arguments, context);
                            toolInfo.result = result.content || result.error;
                            toolInfo.metadata = result.metadata;  // Preserve metadata (images, etc.)
                            toolInfo.status = result.success ? "completed" : "error";
                        } else {
                            // Try skill tools
                            const skillTool = skillTools.find(st => st.name === tc.name);
                            if (skillTool) {
                                const result = await skillTool.execute(tc.arguments, context);
                                toolInfo.result = result.content || result.error;
                                toolInfo.metadata = result.metadata;  // Preserve metadata
                                toolInfo.status = result.success ? "completed" : "error";
                            } else {
                                toolInfo.result = `Unknown tool: ${tc.name}`;
                                toolInfo.status = "error";
                            }
                        }
                    }
                } catch (err) {
                    toolInfo.result = err instanceof Error ? err.message : String(err);
                    toolInfo.status = "error";
                }

                // Record tool result to transcript
                recordToolResult(
                    session.sessionId,
                    tc.name,
                    String(toolInfo.result).slice(0, 2000),
                    toolInfo.status === "completed"
                );

                // Notify end
                onToolEnd?.(toolInfo);
            }

            // Add assistant response with structured tool calls
            msgHistory.push({
                role: "assistant",
                content: response.content || "",
                toolCalls: response.toolCalls,
            });

            // Add tool results as proper "tool" role messages
            const toolResultMessages: ProviderToolResult[] = allToolCalls
                .slice(-response.toolCalls.length)
                .map((t) => ({
                    toolCallId: t.id,
                    content: String(t.result).slice(0, 10000),
                    isError: t.status === "error",
                }));
            msgHistory.push({
                role: "tool",
                content: "",
                toolResults: toolResultMessages,
            });
        }

        // Create final assistant message
        const assistantMsg: ChatMessage = {
            id: randomUUID(),
            role: "assistant",
            content: finalContent,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            model,
            createdAt: new Date().toISOString(),
        };
        dashboardMessages.push(assistantMsg);
        persistMessage(assistantMsg);

        // Record to JSONL transcript
        recordAssistantMessage(session.sessionId, finalContent);
        finalizeExchange(session.sessionKey);

        // Store in legacy session
        addMessage(sessionId, "assistant", finalContent);

        return assistantMsg;
    } catch (error) {
        const errorMsg: ChatMessage = {
            id: randomUUID(),
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            createdAt: new Date().toISOString(),
        };
        dashboardMessages.push(errorMsg);
        persistMessage(errorMsg);
        return errorMsg;
    }
}

/**
 * Process a chat message with streaming events for real-time UI updates
 * Emits SSE events: thinking, content, tool_start, tool_end, done, error
 */
export async function processMessageStream(
    sessionId: string,
    content: string,
    options: {
        model?: string;
        maxIterations?: number;
        emit: (event: string, data: unknown) => void;
    }
): Promise<ChatMessage> {
    const { model = currentModel, maxIterations = 25, emit } = options;

    const provider = registry.getProvider(model);
    if (!provider) {
        emit("error", { message: `No provider available for model: ${model}` });
        throw new Error(`No provider available for model: ${model}`);
    }

    // Create user message
    const userMsg: ChatMessage = {
        id: randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
    };
    dashboardMessages.push(userMsg);
    persistMessage(userMsg);

    const sessionCtx = getSessionContext("dashboard", "dm", sessionId);
    const { session } = sessionCtx;
    recordUserMessage(session.sessionId, content);
    getOrCreateSessionLegacy(sessionId, "dashboard");
    addMessage(sessionId, "user", content);

    // Build tools list (same as processMessage)
    const allTools = toolRegistry.getAll();
    const tools: Array<{ name: string; description: string; parameters: unknown }> = allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toolRegistry.zodToJsonSchema(tool.parameters),
    }));

    tools.push({
        name: "whatsapp_send",
        description: "Send a text message via WhatsApp",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Phone number with country code" },
                message: { type: "string", description: "Message text to send" },
            },
            required: ["to", "message"],
        },
    });
    tools.push({
        name: "whatsapp_send_image",
        description: "Send an image via WhatsApp",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Phone number to send to" },
                use_last_screenshot: { type: "boolean", description: "Send the last captured screenshot" },
                caption: { type: "string", description: "Optional caption" },
            },
            required: ["to", "use_last_screenshot"],
        },
    });

    const skillTools = skillRegistry.getAllTools();
    for (const skillTool of skillTools) {
        tools.push({
            name: skillTool.name,
            description: skillTool.description,
            parameters: skillTool.parameters || { type: "object", properties: {}, required: [] },
        });
    }

    // Build message history
    const msgHistory: Message[] = dashboardMessages
        .slice(-20)
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

    const now = new Date();
    const runtimeInfo = `OS: ${process.platform} ${process.arch} | Host: ${hostname()} | Node: ${process.version} | Time: ${now.toISOString()} | CWD: ${process.cwd()}`;
    const baseToolNames = allTools.map(t => t.name);
    const skillToolNames = skillTools.map(t => t.name);

    const systemPrompt = `You are OpenWhale, an AI assistant with FULL tool access. You are authenticated and connected.

## Runtime
${runtimeInfo}

## Your Available Tools (${tools.length} total)
Base Tools: ${baseToolNames.join(", ")}
Skill Tools: ${skillToolNames.length > 0 ? skillToolNames.join(", ") : "None configured"}

## CRITICAL RULES - FOLLOW THESE EXACTLY
1. **NEVER say "I don't have access"** - You DO have access. Use your tools.
2. **NEVER ask for credentials, tokens, or API keys** - They are already configured.
3. **NEVER say "I cannot access your account"** - You CAN. Just use the tool.
4. When asked about GitHub, emails, calendar, weather, Twitter, etc. - CALL THE TOOL IMMEDIATELY.
5. You have up to ${maxIterations} tool execution rounds. Use them wisely.

## Multi-Step Tasks
For complex tasks requiring 3+ tool calls:
1. **Plan first**: Use the \`plan\` tool to create a step-by-step plan before executing.
2. **Execute systematically**: Work through the plan step by step, marking steps complete.
3. **Track progress**: Use \`plan\` with action \`complete_step\` after finishing each step.
4. **Wrap up early**: If you're approaching the iteration limit, provide a summary of what's done and what remains.

## Tool Usage
- Planning → use \`plan\` (create_plan, update_step, complete_step, get_plan, add_step)
- GitHub repos → use \`github_repos\`
- GitHub issues → use \`github_issues\`
- Weather → use \`weather_current\` or \`weather_forecast\`
- Gmail → use \`gmail_read\`, \`gmail_send\`
- Calendar → use \`calendar_events\`
- Drive → use \`drive_list\`
- Twitter timeline → use \`twitter_timeline\`
- Twitter mentions → use \`twitter_mentions\`
- Post tweet → use \`twitter_post\`
- Reply to tweet → use \`twitter_reply\`
- Search Twitter → use \`twitter_search\`
- Twitter user info → use \`twitter_user\`

## Your Identity
You are a fully authenticated AI assistant. All integrations are configured and ready.
Do NOT apologize for previous errors or claim you lack access. Just execute the task.`;

    const memoryContext = getMemoryContext();
    const fullSystemPrompt = memoryContext
        ? systemPrompt + "\n\n" + memoryContext
        : systemPrompt;

    const sandboxConfig = createSandboxConfig(process.cwd(), false);
    const context: ToolCallContext = {
        sessionId,
        workspaceDir: process.cwd(),
        sandboxed: sandboxConfig.enabled,
    };

    try {
        let iterations = 0;
        const allToolCalls: ToolCallInfo[] = [];
        let finalContent = "";

        while (iterations < maxIterations) {
            iterations++;

            emit("thinking", { iteration: iterations, maxIterations });

            await compactIfNeeded(msgHistory, model, session.sessionId);

            if (iterations === Math.floor(maxIterations * 0.8)) {
                msgHistory.push({
                    role: "user",
                    content: `[System] You have used ${iterations}/${maxIterations} iterations. Please wrap up your current task and provide a final response soon.`,
                });
            }

            const response = await registry.complete({
                model,
                messages: msgHistory,
                systemPrompt: fullSystemPrompt,
                tools: tools as any,
                maxTokens: 8192,
                stream: false,
            });

            // No tool calls = done
            if (!response.toolCalls || response.toolCalls.length === 0) {
                finalContent = response.content || "Done!";
                emit("content", { text: finalContent });
                break;
            }

            // Emit assistant's thinking text (before tools)
            if (response.content) {
                emit("content", { text: response.content });
            }

            // Process tool calls with streaming events
            for (const tc of response.toolCalls) {
                const toolInfo: ToolCallInfo = {
                    id: tc.id || randomUUID(),
                    name: tc.name,
                    arguments: tc.arguments,
                    status: "running",
                };
                allToolCalls.push(toolInfo);

                emit("tool_start", {
                    id: toolInfo.id,
                    name: tc.name,
                    arguments: tc.arguments,
                });

                try {
                    console.log(`[SessionService] 🔧 Executing: ${tc.name} (iteration ${iterations}/${maxIterations})`);
                    recordToolUse(session.sessionId, tc.name, tc.arguments);

                    if (tc.name === "exec" && sandboxConfig.enabled) {
                        const cmd = (tc.arguments as { command?: string }).command || "";
                        const sandboxCheck = checkCommand(cmd, sandboxConfig);
                        auditCommand(cmd, sandboxCheck);
                        if (!sandboxCheck.allowed) {
                            toolInfo.result = sandboxCheck.reason;
                            toolInfo.status = "error";
                            recordToolResult(session.sessionId, tc.name, sandboxCheck.reason || "Blocked", false);
                            emit("tool_end", { id: toolInfo.id, name: tc.name, result: toolInfo.result, status: "error" });
                            continue;
                        }
                    }

                    if (tc.name === "whatsapp_send") {
                        const { sendWhatsAppMessage } = await import("../channels/whatsapp-baileys.js");
                        const args = tc.arguments as { to: string; message: string };
                        await sendWhatsAppMessage(args.to, args.message);
                        toolInfo.result = `Message sent to ${args.to}`;
                        toolInfo.status = "completed";
                    } else if (tc.name === "whatsapp_send_image") {
                        toolInfo.result = "WhatsApp image sending is available via WhatsApp channel directly";
                        toolInfo.status = "completed";
                    } else {
                        const tool = toolRegistry.get(tc.name);
                        if (tool) {
                            const result = await toolRegistry.execute(tc.name, tc.arguments, context);
                            toolInfo.result = result.content || result.error;
                            toolInfo.metadata = result.metadata;
                            toolInfo.status = result.success ? "completed" : "error";
                        } else {
                            const skillTool = skillTools.find(st => st.name === tc.name);
                            if (skillTool) {
                                const result = await skillTool.execute(tc.arguments, context);
                                toolInfo.result = result.content || result.error;
                                toolInfo.metadata = result.metadata;
                                toolInfo.status = result.success ? "completed" : "error";
                            } else {
                                toolInfo.result = `Unknown tool: ${tc.name}`;
                                toolInfo.status = "error";
                            }
                        }
                    }
                } catch (err) {
                    toolInfo.result = err instanceof Error ? err.message : String(err);
                    toolInfo.status = "error";
                }

                recordToolResult(session.sessionId, tc.name, String(toolInfo.result).slice(0, 2000), toolInfo.status === "completed");

                emit("tool_end", {
                    id: toolInfo.id,
                    name: tc.name,
                    result: toolInfo.result,
                    metadata: toolInfo.metadata,
                    status: toolInfo.status,
                });
            }

            // Add to history for next iteration
            msgHistory.push({
                role: "assistant",
                content: response.content || "",
                toolCalls: response.toolCalls,
            });

            const toolResultMessages: ProviderToolResult[] = allToolCalls
                .slice(-response.toolCalls.length)
                .map((t) => ({
                    toolCallId: t.id,
                    content: String(t.result).slice(0, 10000),
                    isError: t.status === "error",
                }));
            msgHistory.push({
                role: "tool",
                content: "",
                toolResults: toolResultMessages,
            });
        }

        // Create final message
        const assistantMsg: ChatMessage = {
            id: randomUUID(),
            role: "assistant",
            content: finalContent,
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            model,
            createdAt: new Date().toISOString(),
        };
        dashboardMessages.push(assistantMsg);
        persistMessage(assistantMsg);

        recordAssistantMessage(session.sessionId, finalContent);
        finalizeExchange(session.sessionKey);
        addMessage(sessionId, "assistant", finalContent);

        emit("done", { message: assistantMsg });
        return assistantMsg;
    } catch (error) {
        const errorContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        emit("error", { message: errorContent });

        const errorMsg: ChatMessage = {
            id: randomUUID(),
            role: "assistant",
            content: errorContent,
            createdAt: new Date().toISOString(),
        };
        dashboardMessages.push(errorMsg);
        persistMessage(errorMsg);
        return errorMsg;
    }
}

/**
 * Process commands like /new, /status, /think
 */
export function processCommand(sessionId: string, message: string): string | null {
    const cmd = message.trim().toLowerCase();

    if (cmd === "/new" || cmd === "/reset" || cmd === "/clear") {
        clearChatHistory();
        clearSession(sessionId);
        return "🔄 Session cleared. Starting fresh!";
    }

    if (cmd === "/status") {
        const msgs = dashboardMessages.length;
        const provider = registry.getProvider(currentModel) ? "Connected" : "Not configured";
        return `📊 **Status**\n- Messages: ${msgs}\n- Model: ${currentModel}\n- Provider: ${provider}`;
    }

    if (cmd === "/help") {
        return `📚 **Commands**
/new, /reset, /clear - Start a new session
/status - Show current status
/model <name> - Switch model
/help - Show this help`;
    }

    if (cmd.startsWith("/model ")) {
        const newModel = message.slice(7).trim();
        setModel(newModel);
        return `✅ Model switched to: ${newModel}`;
    }

    // Not a command
    return null;
}
