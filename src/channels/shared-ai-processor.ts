/**
 * Shared AI processor for all messaging channels
 * Provides consistent AI processing across WhatsApp, Telegram, Discord
 */

import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { toolRegistry } from "../tools/index.js";
import { skillRegistry } from "../skills/index.js";
import { getSessionContext, handleSlashCommand, recordUserMessage, recordAssistantMessage } from "../sessions/session-manager.js";
import { getMemoryContext } from "../memory/memory-files.js";

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
interface AIProvider {
    complete(options: {
        model: string;
        messages: Array<{ role: "user" | "assistant"; content: string }>;
        systemPrompt: string;
        tools: unknown[];
        maxTokens: number;
        stream: boolean;
    }): Promise<{
        content?: string;
        toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
    }>;
}

interface ProcessMessageOptions {
    channel: "whatsapp" | "telegram" | "discord" | "twitter" | "imessage";
    from: string;
    content: string;
    aiProvider: AIProvider;
    model: string;
    sendText: (text: string) => Promise<{ success: boolean; error?: string }>;
    sendImage: (imageBuffer: Buffer, caption: string) => Promise<{ success: boolean; error?: string }>;
    sendDocument?: (buffer: Buffer, fileName: string, mimetype: string, caption?: string) => Promise<{ success: boolean; error?: string }>;
    isGroup?: boolean;
}

interface ProcessResult {
    success: boolean;
    reply?: string;
    error?: string;
    handled?: boolean;  // For slash commands
}

/**
 * Process a message with AI - shared across all channels
 */
export async function processMessageWithAI(options: ProcessMessageOptions): Promise<ProcessResult> {
    const { channel, from, content, aiProvider, model, sendText, sendImage, sendDocument, isGroup = false } = options;
    const channelUpper = channel.charAt(0).toUpperCase() + channel.slice(1);

    console.log(`[${channelUpper}] 📱 Processing message from ${from}: "${content.slice(0, 50)}..."`);

    // Build tools list
    const allTools = toolRegistry.getAll();
    const tools = allTools.map((tool) => ({
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

    const systemPrompt = `You are OpenWhale, a powerful AI assistant responding via ${channelUpper}.
You have FULL access to ALL system tools. You are authenticated and can execute code directly.
User's ID: ${from}. Keep responses concise but complete.

BASE TOOLS (${baseToolNames.length}): ${baseToolNames.join(", ")}
${skillToolNames.length > 0 ? `SKILL TOOLS (${skillToolNames.length}): ${skillToolNames.join(", ")}` : ""}

KEY CAPABILITIES:
- exec: Run shell commands (bash, zsh). Use for system tasks, file management, git, etc.
- code_exec: Write and execute JavaScript/Python scripts. Perfect for data processing, calculations, API calls.
- file: Read/write files anywhere on the system. Can create scripts and save them.
- browser: Control web browser, navigate pages, take screenshots of websites.
- screenshot: Capture the user's screen.
- camera_snap: Take a photo with the device camera.
- cron: Schedule recurring tasks.
- tts: Text-to-speech conversion.
- image: Generate AI images.
- canvas: Create/manipulate 2D graphics.
- memory: Store and recall context across conversations.
- nodes: Control IoT devices.
- extend: Create extensions that monitor channels and auto-reply.

EXTENSION SYSTEM - YOU CAN MONITOR ALL CHANNEL MESSAGES:
The 'extend' tool lets you create extensions that can:
1. Monitor ALL incoming messages on any channel (whatsapp, telegram, discord, slack) - not just the owner's!
2. Auto-reply to specific contacts (like family members, clients, etc.)
3. Use openwhale.message to read incoming message content and sender
4. Use openwhale.reply(text) to respond back to that sender
5. Use openwhale.handled() to prevent normal AI from also responding

EXAMPLE: To auto-reply to a family member at +15551234567:
Use 'extend' with action='create', channels=['whatsapp'], and code:
\`\`\`
if (openwhale.message && openwhale.message.from.includes("5551234567")) {
    await openwhale.reply("Jijo is busy but will get back to you soon!");
    openwhale.handled();
}
\`\`\`

IMPORTANT - EXTENSIONS ARE YOUR FALLBACK:
If a user asks for something that tools and skills CANNOT do, USE EXTENSIONS:
- Monitoring channels for specific messages/senders → Extension
- Auto-replying to specific people → Extension
- Custom automations/workflows → Extension
- Integrating external APIs not covered by skills → Extension
- Persistent background tasks → Extension with cron schedule
- Any behavior that needs to run without user prompting → Extension

TO SEND IMAGES via ${channelUpper}:
1. Use 'screenshot', 'camera_snap', or 'browser action=screenshot' to capture
2. Then call '${channel}_send_image' with a caption

For emails use gmail_*, for GitHub use github_*, for weather use weather_*.
Current time: ${new Date().toLocaleString()}`;

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
    const systemPromptWithMemory = memoryContext
        ? systemPrompt + "\n\n" + memoryContext
        : systemPrompt;

    // Build messages with history
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        ...history,
        { role: "user", content },
    ];

    let reply = "";
    let iterations = 0;
    const maxIterations = 10;

    // Track whether we've sent a status update to avoid spamming
    let statusSent = false;

    while (iterations < maxIterations) {
        iterations++;

        const response = await aiProvider.complete({
            model,
            messages,
            systemPrompt: systemPromptWithMemory,
            tools,
            maxTokens: 2000,
            stream: false,
        });

        console.log(`[${channelUpper}]   ↳ AI iteration ${iterations}: content=${response.content?.length || 0} chars, toolCalls=${response.toolCalls?.length || 0}`);

        // No tool calls = final response
        if (!response.toolCalls || response.toolCalls.length === 0) {
            reply = response.content || "Done!";
            break;
        }

        // Push real-time status update to the user
        const toolNames = response.toolCalls.map(t => t.name).filter(n => !n.includes("_send_image"));
        if (toolNames.length > 0) {
            const statusEmoji = iterations === 1 ? "⚡" : "🔄";
            const statusMsg = iterations === 1
                ? `${statusEmoji} _Working on it..._ 🔧 ${toolNames.join(", ")}`
                : `${statusEmoji} _Still working (step ${iterations})..._ 🔧 ${toolNames.join(", ")}`;
            try {
                await sendText(statusMsg);
                statusSent = true;
            } catch {
                // Don't fail if status message fails
            }
        }

        // Execute tool calls
        const toolResults: Array<{ name: string; result: string }> = [];

        for (const toolCall of response.toolCalls) {
            console.log(`[${channelUpper}]   🔧 Tool: ${toolCall.name}`);

            try {
                // Special case: channel_send_image
                if (toolCall.name === `${channel}_send_image`) {
                    if (lastScreenshotBase64) {
                        const imageBuffer = Buffer.from(lastScreenshotBase64, "base64");
                        console.log(`[${channelUpper}]   📸 Sending image (${imageBuffer.length} bytes)`);
                        const args = toolCall.arguments as { caption?: string };
                        const result = await sendImage(imageBuffer, args.caption || "Image from OpenWhale");
                        if (result.success) {
                            toolResults.push({ name: toolCall.name, result: "Image sent successfully!" });
                            console.log(`[${channelUpper}]   ✅ Image sent!`);
                        } else {
                            toolResults.push({ name: toolCall.name, result: `Error: ${result.error}` });
                        }
                    } else {
                        toolResults.push({ name: toolCall.name, result: "No image available. Take a screenshot first." });
                    }
                    continue;
                }

                // Try regular tool
                const baseTool = allTools.find(t => t.name === toolCall.name);

                if (baseTool) {
                    const result = await toolRegistry.execute(toolCall.name, toolCall.arguments, context);

                    // Capture screenshots for sending
                    if ((toolCall.name === "screenshot" || toolCall.name === "camera_snap") && result.metadata?.base64) {
                        lastScreenshotBase64 = result.metadata.base64 as string;
                        const type = toolCall.name === "camera_snap" ? "Camera photo" : "Screenshot";
                        console.log(`[${channelUpper}]   📸 ${type} captured`);
                        toolResults.push({ name: toolCall.name, result: `${type} captured! Now use ${channel}_send_image to send it.` });
                    } else if (toolCall.name === "browser" && result.metadata?.image) {
                        const imageData = result.metadata.image as string;
                        if (imageData.startsWith("data:image")) {
                            lastScreenshotBase64 = imageData.split(",")[1];
                            console.log(`[${channelUpper}]   📸 Browser screenshot captured`);
                            toolResults.push({ name: toolCall.name, result: `Browser screenshot captured! Now use ${channel}_send_image to send it.` });
                        } else {
                            const resultStr = (result.content || result.error || "").slice(0, 2000);
                            toolResults.push({ name: toolCall.name, result: resultStr });
                        }
                    } else {
                        const resultStr = (result.content || result.error || "").slice(0, 2000);
                        toolResults.push({ name: toolCall.name, result: resultStr });
                        console.log(`[${channelUpper}]   ✅ ${toolCall.name}: ${resultStr.slice(0, 100)}...`);

                        // Auto-send created files to the channel
                        if (sendDocument && result.metadata?.path) {
                            const filePath = String(result.metadata.path);
                            const ext = extname(filePath).toLowerCase();
                            const mime = MIME_TYPES[ext];
                            if (mime) {
                                try {
                                    const fileStat = await stat(filePath);
                                    // Only send files under 50MB
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
                    const skillTool = skillTools.find(t => t.name === toolCall.name);
                    if (skillTool) {
                        const result = await skillTool.execute(toolCall.arguments as Record<string, unknown>, context);
                        const resultStr = (result.content || result.error || "").slice(0, 2000);
                        toolResults.push({ name: toolCall.name, result: resultStr });
                        console.log(`[${channelUpper}]   ✅ ${toolCall.name} (skill): ${resultStr.slice(0, 100)}...`);
                    } else {
                        toolResults.push({ name: toolCall.name, result: `Unknown tool: ${toolCall.name}` });
                    }
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                toolResults.push({ name: toolCall.name, result: `Error: ${errMsg}` });
                console.log(`[${channelUpper}]   ❌ ${toolCall.name}: ${errMsg}`);
            }
        }

        // Add to messages
        const assistantContent = response.content
            ? `${response.content}\n\n[Tools executed: ${response.toolCalls.map(t => t.name).join(", ")}]`
            : `[Tools executed: ${response.toolCalls.map(t => t.name).join(", ")}]`;
        messages.push({ role: "assistant", content: assistantContent });

        const toolResultsStr = toolResults.map(t => `${t.name}: ${t.result}`).join("\n\n");
        messages.push({ role: "user", content: `Tool results:\n${toolResultsStr}\n\nProvide final response to user.` });
    }

    // Truncate for messaging platforms
    const maxLength = channel === "discord" ? 1900 : 4000;
    if (reply.length > maxLength) {
        reply = reply.slice(0, maxLength - 3) + "...";
    }

    // Record and send
    recordAssistantMessage(session.sessionId, reply);

    await sendText(reply);

    return { success: true, reply };
}
