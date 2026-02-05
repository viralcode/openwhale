// Export all channels
export { channelRegistry, type MessageChannel, type IncomingMessage, type OutgoingMessage, type ChannelAdapter } from "./base.js";
export { TelegramAdapter, createTelegramAdapter } from "./telegram.js";
export { DiscordAdapter, createDiscordAdapter } from "./discord.js";
export { SlackAdapter, createSlackAdapter } from "./slack.js";
export { webAdapter } from "./web.js";
export { WhatsAppAdapter, createWhatsAppAdapter } from "./whatsapp.js";

// Initialize all available channels
import { channelRegistry } from "./base.js";
import { createTelegramAdapter } from "./telegram.js";
import { createDiscordAdapter } from "./discord.js";
import { createSlackAdapter } from "./slack.js";
import { webAdapter } from "./web.js";
// import { createWhatsAppAdapter } from "./whatsapp.js"; // Now using whatsapp-baileys.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeChannels(_db?: any, _config?: any): Promise<void> {
    // Register web adapter (always available)
    channelRegistry.register(webAdapter);
    await webAdapter.connect();

    // Get AI provider for channels
    let aiProvider: any = null;
    let currentModel = "claude-sonnet-4-20250514";

    try {
        const { createAnthropicProvider } = await import("../providers/anthropic.js");
        aiProvider = createAnthropicProvider();
    } catch (err) {
        console.log("[Channels] No AI provider available for Telegram/Discord");
    }

    // Register Telegram if configured
    const telegram = createTelegramAdapter();
    if (telegram) {
        if (aiProvider) {
            telegram.setAIProvider(aiProvider, currentModel);
        }
        channelRegistry.register(telegram);
        try {
            await telegram.connect();
            console.log("[Telegram] ✓ Connected with AI processing enabled");
        } catch (err) {
            console.error("Failed to connect Telegram:", err);
        }
    }

    // Register Discord if configured
    const discord = createDiscordAdapter();
    if (discord) {
        if (aiProvider) {
            discord.setAIProvider(aiProvider, currentModel);
        }
        channelRegistry.register(discord);
        try {
            await discord.connect();
            console.log("[Discord] ✓ Connected with AI processing enabled");
        } catch (err) {
            console.error("Failed to connect Discord:", err);
        }
    }

    // Register Slack if configured
    const slack = createSlackAdapter();
    if (slack) {
        channelRegistry.register(slack);
        try {
            await slack.connect();
        } catch (err) {
            console.error("Failed to connect Slack:", err);
        }
    }

    // WhatsApp is handled via whatsapp-baileys.ts and dashboard connect
    // Auto-connect only if session exists (user already authenticated)
    try {
        const { initWhatsApp, sendWhatsAppMessage } = await import("./whatsapp-baileys.js");
        const { existsSync } = await import("fs");
        const { join } = await import("path");
        const { homedir } = await import("os");
        const { markMessageProcessed } = await import("../db/message-dedupe.js");
        const { createAnthropicProvider } = await import("../providers/anthropic.js");
        const { toolRegistry } = await import("../tools/index.js");
        const { skillRegistry } = await import("../skills/base.js");
        const { getSessionContext, handleSlashCommand, recordUserMessage, recordAssistantMessage, finalizeExchange } = await import("../sessions/session-manager.js");
        const { getMemoryContext, initializeMemory } = await import("../memory/memory-files.js");

        // Initialize memory files on startup
        initializeMemory();

        const authDir = join(homedir(), ".openwhale", "whatsapp-auth");
        const credsFile = join(authDir, "creds.json");

        // Only auto-connect if we have saved credentials
        if (existsSync(credsFile)) {
            console.log("🔗 Found WhatsApp session, auto-connecting...");

            // Get owner number for filtering
            const ownerNumber = (process.env.WHATSAPP_OWNER_NUMBER || "").replace(/[^0-9]/g, "");
            console.log(`[WhatsApp] Owner number configured: ${ownerNumber || "(not set)"}`);

            // Initialize AI provider
            const aiProvider = createAnthropicProvider();
            const currentModel = "claude-sonnet-4-20250514";

            await initWhatsApp({
                printQR: false,
                onMessage: async (msg) => {
                    // Skip empty messages
                    if (!msg.content) return;

                    // Message ID for logging (dedup already handled by baileys layer)
                    const messageId = String(msg.metadata?.id || `${msg.from}-${Date.now()}`);

                    // Get sender info
                    const fromRaw = msg.from;
                    const fromDigits = fromRaw.replace(/[^0-9]/g, "");
                    const isFromMe = msg.metadata?.fromMe === true;
                    const isGroup = fromRaw.includes("@g.us") || fromRaw.includes("-");

                    // Skip bot's outbound messages (but allow owner's messages even if fromMe)
                    const isSameAsOwner = ownerNumber && fromDigits.includes(ownerNumber);
                    if (isFromMe && !isSameAsOwner) {
                        markMessageProcessed(messageId, "outbound", fromRaw);
                        return;
                    }

                    console.log(`[WhatsApp] 📱 Message from ${fromRaw} (fromMe: ${isFromMe}, owner: ${isSameAsOwner}, group: ${isGroup}): "${msg.content.slice(0, 50)}..."`);

                    // Skip group messages
                    if (isGroup) {
                        console.log("[WhatsApp]   ↳ Skipping group message");
                        markMessageProcessed(messageId, "inbound", fromRaw);
                        return;
                    }

                    // ========== EXTENSION HOOK (runs BEFORE owner filter) ==========
                    // Extensions subscribed to "whatsapp" channel get ALL messages
                    try {
                        const { triggerChannelExtensions } = await import("../tools/extend.js");
                        const extResult = await triggerChannelExtensions("whatsapp", {
                            from: fromRaw,
                            content: msg.content,
                            metadata: msg.metadata as Record<string, unknown>
                        });

                        if (extResult.handled) {
                            console.log(`[WhatsApp]   ↳ Message handled by extension(s)`);
                            markMessageProcessed(messageId, "inbound", fromRaw);
                            return; // Extension handled it, skip AI processing
                        }

                        if (extResult.responses.length > 0) {
                            console.log(`[WhatsApp]   ↳ ${extResult.responses.length} extension(s) processed message`);
                        }
                    } catch (extErr) {
                        console.error("[WhatsApp] Extension error:", extErr);
                    }
                    // ================================================================

                    // Only process messages from owner if configured (extensions already ran above)
                    if (ownerNumber && !isSameAsOwner) {
                        console.log(`[WhatsApp]   ↳ Skipping AI - not from owner (${ownerNumber})`);
                        markMessageProcessed(messageId, "inbound", fromRaw);
                        return;
                    }

                    // Mark as processed BEFORE handling to prevent race conditions
                    markMessageProcessed(messageId, "inbound", fromRaw);

                    // Process with AI if provider is available
                    if (aiProvider) {
                        console.log("[WhatsApp]   ↳ Processing with AI...");
                        try {
                            // Build tools list
                            const allTools = toolRegistry.getAll();
                            const tools = allTools.map((tool) => ({
                                name: tool.name,
                                description: tool.description,
                                parameters: toolRegistry.zodToJsonSchema(tool.parameters),
                            }));

                            // Add whatsapp_send_image tool for sending screenshots
                            tools.push({
                                name: "whatsapp_send_image",
                                description: "Send an image via WhatsApp. After taking a screenshot, call this to send it to the user.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        caption: { type: "string", description: "Caption for the image" },
                                    },
                                    required: [],
                                },
                            });

                            // Add skill tools (gmail, github, weather, etc.)
                            const skillTools = skillRegistry.getAllTools();
                            console.log(`[WhatsApp] Skill tools available: ${skillTools.length} (${skillTools.map(t => t.name).join(", ")})`);
                            for (const skillTool of skillTools) {
                                tools.push({
                                    name: skillTool.name,
                                    description: skillTool.description,
                                    parameters: skillTool.parameters || { type: "object", properties: {}, required: [] },
                                });
                            }

                            // Build skill tool names for system prompt
                            const skillToolNames = skillTools.map(t => t.name);
                            const baseToolNames = allTools.map(t => t.name);

                            const systemPrompt = `You are OpenWhale, a powerful AI assistant responding via WhatsApp.
You have FULL access to ALL system tools. You are authenticated and can execute code directly.
User's number: ${fromRaw}. Keep responses concise but complete.

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

EXTENSION SYSTEM - YOU CAN MONITOR ALL WHATSAPP MESSAGES:
The 'extend' tool lets you create extensions that can:
1. Monitor ALL incoming WhatsApp messages - including from anyone, not just the owner!
2. Auto-reply to specific contacts (like family members, clients, specific phone numbers)
3. Access openwhale.message (contains: from, content, channel, metadata)
4. Call openwhale.reply(text) to respond directly to that sender
5. Call openwhale.handled() to prevent normal AI from also responding

EXAMPLE - Auto-reply to a family member at +15551234567:
Use 'extend' with action='create', name='wife_auto_reply', channels=['whatsapp'], and code:
\`\`\`
if (openwhale.message && openwhale.message.from.includes("5551234567")) {
    await openwhale.reply("Hi! Jijo is busy right now but will get back to you soon 💙");
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

TO SEND IMAGES via WhatsApp:
1. Use 'screenshot' or 'camera_snap' to capture
2. Then call 'whatsapp_send_image' with a caption

TO WRITE AND EXECUTE SCRIPTS:
1. Use 'file' tool to write a script (e.g., save to /tmp/script.py)
2. Use 'exec' to run it (e.g., python3 /tmp/script.py)
OR use 'code_exec' to run code directly without saving.

For emails use gmail_*, for GitHub use github_*, for weather use weather_*.
Current time: ${new Date().toLocaleString()}`;

                            // Get or create persistent session
                            const sessionCtx = getSessionContext("whatsapp", isGroup ? "group" : "dm", fromDigits);
                            const { session, history, isNewSession } = sessionCtx;

                            console.log(`[WhatsApp] Session: ${session.sessionId} (new: ${isNewSession}, history: ${history.length} msgs)`);

                            // Handle slash commands
                            const cmdResult = handleSlashCommand(msg.content, session);
                            if (cmdResult.handled) {
                                if (cmdResult.response) {
                                    await sendWhatsAppMessage(fromRaw, cmdResult.response);
                                }
                                return;
                            }

                            // Record user message to transcript
                            recordUserMessage(session.sessionId, msg.content);

                            const context = {
                                sessionId: session.sessionId,
                                workspaceDir: process.cwd(),
                                sandboxed: false,
                            };

                            // Track last screenshot for sending via WhatsApp
                            let lastScreenshotBase64: string | null = null;

                            // Load memory context for system prompt
                            const memoryContext = getMemoryContext();
                            const systemPromptWithMemory = memoryContext
                                ? systemPrompt + "\n\n" + memoryContext
                                : systemPrompt;

                            // Build messages with conversation history
                            const messages: Array<{ role: "user" | "assistant"; content: string }> = [
                                ...history,  // Previous conversation
                                { role: "user", content: msg.content },
                            ];

                            let reply = "";
                            let iterations = 0;
                            const maxIterations = 10;

                            while (iterations < maxIterations) {
                                iterations++;

                                const response = await aiProvider.complete({
                                    model: currentModel,
                                    messages,
                                    systemPrompt: systemPromptWithMemory,
                                    tools,
                                    maxTokens: 2000,
                                    stream: false,
                                });

                                console.log(`[WhatsApp]   ↳ AI iteration ${iterations}: content=${response.content?.length || 0} chars, toolCalls=${response.toolCalls?.length || 0}`);

                                // No tool calls = we have final response
                                if (!response.toolCalls || response.toolCalls.length === 0) {
                                    reply = response.content || "Done!";
                                    break;
                                }

                                // Execute tool calls
                                const toolResults: Array<{ name: string; result: string }> = [];

                                for (const toolCall of response.toolCalls) {
                                    console.log(`[WhatsApp]   🔧 Tool: ${toolCall.name}`);

                                    try {
                                        // Special case: whatsapp_send_image
                                        if (toolCall.name === "whatsapp_send_image") {
                                            if (lastScreenshotBase64) {
                                                const imageBuffer = Buffer.from(lastScreenshotBase64, "base64");
                                                console.log(`[WhatsApp]   📸 Sending screenshot (${imageBuffer.length} bytes)`);
                                                const args = toolCall.arguments as { caption?: string };
                                                const result = await sendWhatsAppMessage(fromRaw, {
                                                    image: imageBuffer,
                                                    caption: args.caption || "Screenshot from OpenWhale",
                                                });
                                                if (result.success) {
                                                    toolResults.push({ name: toolCall.name, result: "Screenshot sent successfully!" });
                                                    console.log(`[WhatsApp]   ✅ Screenshot sent!`);
                                                } else {
                                                    toolResults.push({ name: toolCall.name, result: `Error: ${result.error}` });
                                                }
                                            } else {
                                                toolResults.push({ name: toolCall.name, result: "No screenshot available. Take a screenshot first." });
                                            }
                                            continue;
                                        }

                                        // Try regular tool first
                                        const baseTool = allTools.find(t => t.name === toolCall.name);

                                        if (baseTool) {
                                            // Execute regular tool
                                            const result = await toolRegistry.execute(toolCall.name, toolCall.arguments, context);

                                            // Special case: screenshot or camera_snap - store base64 for sending
                                            if ((toolCall.name === "screenshot" || toolCall.name === "camera_snap") && result.metadata?.base64) {
                                                lastScreenshotBase64 = result.metadata.base64 as string;
                                                const type = toolCall.name === "camera_snap" ? "Camera photo" : "Screenshot";
                                                console.log(`[WhatsApp]   📸 ${type} captured (${lastScreenshotBase64.length} chars)`);
                                                toolResults.push({ name: toolCall.name, result: `${type} captured! Now use whatsapp_send_image to send it.` });
                                            } else if (toolCall.name === "browser" && result.metadata?.image) {
                                                // Browser screenshot - extract base64 from data URL
                                                const imageData = result.metadata.image as string;
                                                if (imageData.startsWith("data:image")) {
                                                    lastScreenshotBase64 = imageData.split(",")[1];
                                                    console.log(`[WhatsApp]   📸 Browser screenshot captured (${lastScreenshotBase64.length} chars)`);
                                                    toolResults.push({ name: toolCall.name, result: `Browser screenshot captured! Now use whatsapp_send_image to send it.` });
                                                } else {
                                                    const resultStr = (result.content || result.error || "").slice(0, 2000);
                                                    toolResults.push({ name: toolCall.name, result: resultStr });
                                                    console.log(`[WhatsApp]   ✅ ${toolCall.name}: ${resultStr.slice(0, 100)}...`);
                                                }
                                            } else {
                                                const resultStr = (result.content || result.error || "").slice(0, 2000);
                                                toolResults.push({ name: toolCall.name, result: resultStr });
                                                console.log(`[WhatsApp]   ✅ ${toolCall.name}: ${resultStr.slice(0, 100)}...`);
                                            }
                                        } else {
                                            // Try skill tool
                                            const skillTool = skillTools.find(t => t.name === toolCall.name);
                                            if (skillTool) {
                                                const result = await skillTool.execute(toolCall.arguments as Record<string, unknown>, context);
                                                const resultStr = (result.content || result.error || "").slice(0, 2000);
                                                toolResults.push({ name: toolCall.name, result: resultStr });
                                                console.log(`[WhatsApp]   ✅ ${toolCall.name} (skill): ${resultStr.slice(0, 100)}...`);
                                            } else {
                                                toolResults.push({ name: toolCall.name, result: `Unknown tool: ${toolCall.name}` });
                                                console.log(`[WhatsApp]   ❌ Unknown tool: ${toolCall.name}`);
                                            }
                                        }
                                    } catch (err) {
                                        const errMsg = err instanceof Error ? err.message : String(err);
                                        toolResults.push({ name: toolCall.name, result: `Error: ${errMsg}` });
                                        console.log(`[WhatsApp]   ❌ ${toolCall.name}: ${errMsg}`);
                                    }
                                }

                                // Add assistant response with tool names (string-based)
                                const assistantContent = response.content
                                    ? `${response.content}\n\n[Tools executed: ${response.toolCalls.map(t => t.name).join(", ")}]`
                                    : `[Tools executed: ${response.toolCalls.map(t => t.name).join(", ")}]`;
                                messages.push({ role: "assistant", content: assistantContent });

                                // Add tool results as user message (string-based)
                                const toolResultsStr = toolResults
                                    .map(t => `${t.name}: ${t.result}`)
                                    .join("\n\n");
                                messages.push({
                                    role: "user",
                                    content: `Tool results:\n${toolResultsStr}\n\nProvide final response to user.`
                                });
                            }

                            // Truncate for WhatsApp
                            if (reply.length > 4000) {
                                reply = reply.slice(0, 3950) + "\n\n... (truncated)";
                            }

                            console.log(`[WhatsApp]   📤 Replying: "${reply.slice(0, 50)}..."`);

                            // Record assistant reply to transcript
                            recordAssistantMessage(session.sessionId, reply);

                            // Finalize the exchange
                            finalizeExchange(session.sessionKey);

                            await sendWhatsAppMessage(fromRaw, reply);
                        } catch (error: any) {
                            console.error(`[WhatsApp] AI error: ${error.message}`);
                            await sendWhatsAppMessage(fromRaw, `Error: ${error.message.slice(0, 100)}`);
                        }
                    }
                },
                onConnected: () => {
                    console.log("[WhatsApp] ✓ Connected with AI processing enabled");
                },
            });
        } else {
            console.log("📱 WhatsApp not configured yet - use dashboard to connect");
        }
    } catch (err) {
        console.error("WhatsApp initialization error:", err);
    }

    console.log("Connected channels:", channelRegistry.listConnected());
}
