/**
 * Shared AI processor for all messaging channels
 * Uses the SAME quality engine as the web chat dashboard:
 * - registry.complete() for proper provider routing
 * - Proper tool message format (assistant + tool role messages)
 * - 25 iterations with 8192 tokens
 * - Context compaction for long conversations
 * - No status message spam
 */

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { registry } from "../providers/index.js";
import type { Message, ToolResult as ProviderToolResult } from "../providers/base.js";
import { toolRegistry } from "../tools/index.js";
import { skillRegistry } from "../skills/index.js";
import {
    getSessionContext,
    handleSlashCommand,
    recordUserMessage,
    recordAssistantMessage,
    recordToolUse,
    recordToolResult,
    finalizeExchange,
} from "../sessions/session-manager.js";
import { getMemoryContext } from "../memory/memory-files.js";
import { compactIfNeeded } from "../sessions/compaction.js";
import { getCurrentModel } from "../sessions/session-service.js";

// Mime types for common file extensions
const MIME_TYPES: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".html": "text/html",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Types
export interface ProcessMessageOptions {
    channel: "whatsapp" | "telegram" | "discord" | "twitter" | "imessage";
    from: string;
    content: string;
    model?: string;
    sendText: (text: string) => Promise<{ success: boolean; error?: string }>;
    sendImage: (imageBuffer: Buffer, caption: string) => Promise<{ success: boolean; error?: string }>;
    sendDocument?: (buffer: Buffer, fileName: string, mimetype: string, caption?: string) => Promise<{ success: boolean; error?: string }>;
    isGroup?: boolean;
}

export interface ProcessResult {
    success: boolean;
    reply?: string;
    error?: string;
    handled?: boolean;  // For slash commands
}

/**
 * Process a message with AI - shared across all channels
 * Uses the SAME engine as the web chat (session-service.ts)
 */
export async function processMessageWithAI(options: ProcessMessageOptions): Promise<ProcessResult> {
    const { channel, from, content, sendText, sendImage, sendDocument, isGroup = false } = options;
    const model = options.model || getCurrentModel();
    const channelUpper = channel.charAt(0).toUpperCase() + channel.slice(1);
    const maxIterations = 100;

    console.log(`[${channelUpper}] 📱 Processing message from ${from}: "${content.slice(0, 50)}..."`);

    // Verify provider is available
    const provider = registry.getProvider(model);
    if (!provider) {
        const errMsg = `No AI provider available for model: ${model}`;
        console.error(`[${channelUpper}] ${errMsg}`);
        await sendText(`❌ ${errMsg}`);
        return { success: false, error: errMsg };
    }

    // Build tools list
    const allTools = toolRegistry.getAll();
    const tools: Array<{ name: string; description: string; parameters: unknown }> = allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toolRegistry.zodToJsonSchema(tool.parameters),
    }));

    // Add channel-specific send_image tool
    tools.push({
        name: `${channel}_send_image`,
        description: `Send an image via ${channelUpper}. After taking a screenshot, call this to send it to the user.`,
        parameters: {
            type: "object",
            properties: {
                caption: { type: "string", description: "Caption for the image" },
            },
            required: [],
        },
    });

    // Add skill tools
    const skillTools = skillRegistry.getAllTools();
    console.log(`[${channelUpper}] Skill tools available: ${skillTools.length}`);
    for (const skillTool of skillTools) {
        tools.push({
            name: skillTool.name,
            description: skillTool.description,
            parameters: skillTool.parameters || { type: "object", properties: {}, required: [] },
        });
    }

    const skillToolNames = skillTools.map(t => t.name);
    const baseToolNames = allTools.map(t => t.name);

    // Build system prompt — same quality as session-service.ts
    const now = new Date();
    const runtimeInfo = `OS: ${process.platform} ${process.arch} | Host: ${hostname()} | Node: ${process.version} | Time: ${now.toISOString()} | CWD: ${process.cwd()}`;

    const systemPrompt = `You are OpenWhale, an AI assistant with FULL tool access responding via ${channelUpper}.
You are authenticated and connected. User's ID: ${from}.
Keep responses concise but complete for messaging platforms.

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
4. **Wrap up early**: If you're approaching the iteration limit, provide a summary.

## Tool Usage
- Planning → use \`plan\` (create_plan, update_step, complete_step, get_plan, add_step)
- GitHub repos → use \`github_repos\`
- GitHub issues → use \`github_issues\`
- Weather → use \`weather_current\` or \`weather_forecast\`
- Gmail → use \`gmail_read\`, \`gmail_send\`
- Calendar → use \`calendar_events\`
- Drive → use \`drive_list\`
- Twitter timeline → use \`twitter_timeline\`
- exec: Run shell commands (bash, zsh)
- code_exec: Execute JavaScript/Python directly
- file: Read/write files anywhere
- browser: Control web browser, navigate pages

## Sending Images via ${channelUpper}
1. Use 'screenshot', 'camera_snap', or 'browser action=screenshot' to capture
2. Then call '${channel}_send_image' with a caption

## Extension System
Use 'extend' tool to create extensions that monitor channel messages and auto-reply.

## Your Identity
You are a fully authenticated AI assistant. All integrations are configured and ready.
Do NOT apologize for previous errors or claim you lack access. Just execute the task.

Current time: ${now.toLocaleString()}`;

    // Get or create persistent session
    const sessionType = isGroup ? "group" : "dm";
    const sessionCtx = getSessionContext(channel, sessionType, from);
    const { session, history, isNewSession } = sessionCtx;

    console.log(`[${channelUpper}] Session: ${session.sessionId} (new: ${isNewSession}, history: ${history.length} msgs)`);

    // Handle slash commands
    const cmdResult = handleSlashCommand(content, session);
    if (cmdResult.handled) {
        if (cmdResult.response) {
            await sendText(cmdResult.response);
        }
        return { success: true, handled: true };
    }

    // Record user message
    recordUserMessage(session.sessionId, content);

    const context = {
        sessionId: session.sessionId,
        workspaceDir: process.cwd(),
        sandboxed: false,
    };

    // Track last screenshot for sending
    let lastScreenshotBase64: string | null = null;

    // Load memory context
    const memoryContext = getMemoryContext();
    const fullSystemPrompt = memoryContext
        ? systemPrompt + "\n\n" + memoryContext
        : systemPrompt;

    // Build message history using proper Message format (matches session-service.ts)
    const msgHistory: Message[] = [
        ...history.map(h => ({
            role: h.role as "user" | "assistant",
            content: h.content,
        })),
        { role: "user" as const, content },
    ];

    let reply = "";
    let iterations = 0;

    try {
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

            console.log(`[${channelUpper}]   ↳ AI iteration ${iterations}: content=${response.content?.length || 0} chars, toolCalls=${response.toolCalls?.length || 0}`);

            // No tool calls = final response
            if (!response.toolCalls || response.toolCalls.length === 0) {
                reply = response.content || "Done!";
                break;
            }

            // Send initial thinking to user on first iteration so they know work has started
            if (iterations === 1 && response.content && response.content.length > 10) {
                const thinkingPreview = response.content.length > 200
                    ? response.content.slice(0, 200) + "..."
                    : response.content;
                await sendText(`🧠 ${thinkingPreview}`);
            }

            // Execute tool calls (same pattern as session-service.ts)
            const iterationToolResults: ProviderToolResult[] = [];

            for (const tc of response.toolCalls) {
                const toolCallId = tc.id || randomUUID();

                console.log(`[${channelUpper}]   🔧 Executing: ${tc.name} (iteration ${iterations}/${maxIterations})`);
                recordToolUse(session.sessionId, tc.name, tc.arguments);

                let result: string;
                let isError = false;

                try {
                    // Special case: channel_send_image
                    if (tc.name === `${channel}_send_image`) {
                        if (lastScreenshotBase64) {
                            const imageBuffer = Buffer.from(lastScreenshotBase64, "base64");
                            console.log(`[${channelUpper}]   📸 Sending image (${imageBuffer.length} bytes)`);
                            const args = tc.arguments as { caption?: string };
                            const sendResult = await sendImage(imageBuffer, args.caption || "Image from OpenWhale");
                            if (sendResult.success) {
                                result = "Image sent successfully!";
                                console.log(`[${channelUpper}]   ✅ Image sent!`);
                            } else {
                                result = `Error: ${sendResult.error}`;
                                isError = true;
                            }
                        } else {
                            result = "No image available. Take a screenshot first.";
                            isError = true;
                        }
                    } else {
                        // Try regular tool
                        const baseTool = allTools.find(t => t.name === tc.name);

                        if (baseTool) {
                            const execResult = await toolRegistry.execute(tc.name, tc.arguments, context);

                            // Capture screenshots for sending
                            if ((tc.name === "screenshot" || tc.name === "camera_snap") && execResult.metadata?.base64) {
                                lastScreenshotBase64 = execResult.metadata.base64 as string;
                                const type = tc.name === "camera_snap" ? "Camera photo" : "Screenshot";
                                console.log(`[${channelUpper}]   📸 ${type} captured`);
                                result = `${type} captured! Now use ${channel}_send_image to send it.`;
                            } else if (tc.name === "browser" && execResult.metadata?.image) {
                                const imageData = execResult.metadata.image as string;
                                if (imageData.startsWith("data:image")) {
                                    lastScreenshotBase64 = imageData.split(",")[1];
                                    console.log(`[${channelUpper}]   📸 Browser screenshot captured`);
                                    result = `Browser screenshot captured! Now use ${channel}_send_image to send it.`;
                                } else {
                                    result = (execResult.content || execResult.error || "").slice(0, 10000);
                                }
                            } else {
                                result = (execResult.content || execResult.error || "").slice(0, 10000);
                                isError = !execResult.success;
                                console.log(`[${channelUpper}]   ${execResult.success ? "✅" : "❌"} ${tc.name}: ${result.slice(0, 100)}...`);

                                // Auto-send created files to the channel
                                if (sendDocument && execResult.metadata?.path) {
                                    const filePath = String(execResult.metadata.path);
                                    const ext = extname(filePath).toLowerCase();
                                    const mime = MIME_TYPES[ext];
                                    if (mime) {
                                        try {
                                            const fileStat = await stat(filePath);
                                            if (fileStat.size < 50 * 1024 * 1024) {
                                                const fileBuffer = await readFile(filePath);
                                                const fileName = basename(filePath);
                                                console.log(`[${channelUpper}]   📎 Auto-sending file: ${fileName} (${(fileStat.size / 1024).toFixed(1)} KB)`);
                                                await sendDocument(fileBuffer, fileName, mime, `📎 ${fileName}`);
                                            }
                                        } catch (fileErr) {
                                            console.log(`[${channelUpper}]   ⚠️ Could not auto-send file: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`);
                                        }
                                    }
                                }
                            }
                        } else {
                            // Try skill tool
                            const skillTool = skillTools.find(t => t.name === tc.name);
                            if (skillTool) {
                                const execResult = await skillTool.execute(tc.arguments as Record<string, unknown>, context);
                                result = (execResult.content || execResult.error || "").slice(0, 10000);
                                isError = !execResult.success;
                                console.log(`[${channelUpper}]   ✅ ${tc.name} (skill): ${result.slice(0, 100)}...`);
                            } else {
                                result = `Unknown tool: ${tc.name}`;
                                isError = true;
                            }
                        }
                    }
                } catch (err) {
                    result = err instanceof Error ? err.message : String(err);
                    isError = true;
                    console.log(`[${channelUpper}]   ❌ ${tc.name}: ${result}`);
                }

                // Record tool result to transcript
                recordToolResult(session.sessionId, tc.name, result.slice(0, 2000), !isError);

                // Push plan updates to user so they see progress
                if (tc.name === "plan" && !isError && result.length > 0) {
                    const args = tc.arguments as { action?: string };
                    if (args.action === "create_plan" || (!args.action && result.includes("📋"))) {
                        // New plan created — send it
                        const planPreview = result.length > 1500 ? result.slice(0, 1500) + "\n..." : result;
                        await sendText(`📋 Working on it...\n\n${planPreview}`);
                    } else if (args.action === "complete_step" && result.includes("✅")) {
                        // Step completed — extract the step line and notify
                        const stepMatch = result.match(/✅\s*\d+\.\s*.+/);
                        if (stepMatch) {
                            await sendText(stepMatch[0]);
                        }
                    } else if (result.includes("🎉 All steps completed")) {
                        // Plan fully complete — notify
                        await sendText("✅ All steps complete! Preparing final response...");
                    }
                }

                // Collect for proper tool message format
                iterationToolResults.push({
                    toolCallId: toolCallId,
                    content: result,
                    isError,
                });
            }

            // Add to history using PROPER message format (same as session-service.ts)
            // 1. Assistant message with tool calls
            msgHistory.push({
                role: "assistant",
                content: response.content || "",
                toolCalls: response.toolCalls,
            });

            // 2. Tool results as proper "tool" role message
            msgHistory.push({
                role: "tool",
                content: "",
                toolResults: iterationToolResults,
            });
        }

        // Truncate for messaging platforms
        const maxLength = channel === "discord" ? 1900 : 4000;
        if (reply.length > maxLength) {
            reply = reply.slice(0, maxLength - 20) + "\n\n... (truncated)";
        }

        // Record and finalize
        recordAssistantMessage(session.sessionId, reply);
        finalizeExchange(session.sessionKey);

        await sendText(reply);

        return { success: true, reply };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${channelUpper}] AI error: ${errMsg}`);
        await sendText(`Error: ${errMsg.slice(0, 200)}`);
        return { success: false, error: errMsg };
    }
}
