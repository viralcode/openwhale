/**
 * OpenWhale Session Service - Unified Chat Processing
 * 
 * Provides the same AI conversation loop for all clients:
 * - Dashboard web UI
 * - WhatsApp/Telegram channels
 * - CLI interface
 * 
 * Features:
 * - Iterative tool execution (up to 10 rounds)
 * - Shared message history
 * - Real-time tool call events
 */

import { randomUUID } from "crypto";
import { registry } from "../providers/index.js";
import { toolRegistry } from "../tools/index.js";
import { skillRegistry } from "../skills/base.js";
import type { ToolCallContext } from "../tools/base.js";
import {
    getOrCreateSessionLegacy,
    addMessage,
    clearSession,
} from "./index.js";
import {
    getSessionContext,
    recordUserMessage,
    recordAssistantMessage,
    finalizeExchange,
} from "./session-manager.js";
import { getMemoryContext } from "../memory/memory-files.js";

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
    const { model = currentModel, maxIterations = 10, onToolStart, onToolEnd } = options;

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
    const msgHistory = dashboardMessages
        .slice(-20)
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

    // Build dynamic system prompt with available skills
    const skillToolNames = skillTools.map(t => t.name);
    const baseToolNames = allTools.map(t => t.name);

    const systemPrompt = `You are OpenWhale, an AI assistant with FULL tool access. You are authenticated and connected.

## Your Available Tools (${tools.length} total)
Base Tools: ${baseToolNames.join(", ")}
Skill Tools: ${skillToolNames.length > 0 ? skillToolNames.join(", ") : "None configured"}

## CRITICAL RULES - FOLLOW THESE EXACTLY
1. **NEVER say "I don't have access"** - You DO have access. Use your tools.
2. **NEVER ask for credentials, tokens, or API keys** - They are already configured.
3. **NEVER say "I cannot access your account"** - You CAN. Just use the tool.
4. When asked about GitHub, emails, calendar, weather, etc. - CALL THE TOOL IMMEDIATELY.

## Tool Usage
- GitHub repos → use \`github_repos\`
- GitHub issues → use \`github_issues\`
- Weather → use \`weather_current\` or \`weather_forecast\`
- Gmail → use \`gmail_read\`, \`gmail_send\`
- Calendar → use \`calendar_events\`
- Drive → use \`drive_list\`

## Your Identity
You are a fully authenticated AI assistant. All integrations are configured and ready.
Do NOT apologize for previous errors or claim you lack access. Just execute the task.`;

    // Load memory context and append to system prompt
    const memoryContext = getMemoryContext();
    const fullSystemPrompt = memoryContext
        ? systemPrompt + "\n\n" + memoryContext
        : systemPrompt;

    const context: ToolCallContext = {
        sessionId,
        workspaceDir: process.cwd(),
        sandboxed: false,
    };

    try {
        let iterations = 0;
        const allToolCalls: ToolCallInfo[] = [];
        let finalContent = "";

        // Iterative tool execution loop
        while (iterations < maxIterations) {
            iterations++;

            const response = await registry.complete({
                model,
                messages: msgHistory,
                systemPrompt: fullSystemPrompt,
                tools: tools as any,
                maxTokens: 4096,
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
                    console.log(`[SessionService] 🔧 Executing: ${tc.name}`);

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

                // Notify end
                onToolEnd?.(toolInfo);
            }

            // Add assistant response to history
            const assistantContent = response.content
                ? `${response.content}\n\n[Tools executed: ${response.toolCalls.map((t) => t.name).join(", ")}]`
                : `[Tools executed: ${response.toolCalls.map((t) => t.name).join(", ")}]`;
            msgHistory.push({ role: "assistant", content: assistantContent });

            // Add tool results
            const toolResultsStr = allToolCalls
                .slice(-response.toolCalls.length)
                .map((t) => `${t.name}: ${String(t.result).slice(0, 2000)}`)
                .join("\n\n");
            msgHistory.push({
                role: "user",
                content: `Tool results:\n${toolResultsStr}\n\nContinue or provide final response.`,
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
