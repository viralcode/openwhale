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

    // Register Telegram if configured
    const telegram = createTelegramAdapter();
    if (telegram) {
        channelRegistry.register(telegram);
        try {
            await telegram.connect();
        } catch (err) {
            console.error("Failed to connect Telegram:", err);
        }
    }

    // Register Discord if configured
    const discord = createDiscordAdapter();
    if (discord) {
        channelRegistry.register(discord);
        try {
            await discord.connect();
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

                    // Only process messages from owner if configured
                    if (ownerNumber && !isSameAsOwner) {
                        console.log(`[WhatsApp]   ↳ Skipping - not from owner (${ownerNumber})`);
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

                            const systemPrompt = `You are OpenWhale, an AI assistant responding via WhatsApp.
Available tools: exec (run shell commands), file, browser, screenshot, code_exec, web_fetch, and more.
User's number: ${fromRaw}. Keep responses concise.

IMPORTANT: To send a screenshot to the user:
1. First use the 'screenshot' tool to capture the screen
2. Then immediately use 'whatsapp_send_image' with a caption to send it

When asked to run commands, take screenshots, etc - use the appropriate tool immediately.
Current time: ${new Date().toLocaleString()}`;

                            const context = {
                                sessionId: `whatsapp-${fromRaw}-${Date.now()}`,
                                workspaceDir: process.cwd(),
                                sandboxed: false,
                            };

                            // Track last screenshot for sending via WhatsApp
                            let lastScreenshotBase64: string | null = null;

                            // Simple string-based messages (works with Anthropic)
                            const messages: Array<{ role: "user" | "assistant"; content: string }> = [
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
                                    systemPrompt,
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

                                        // Execute regular tool
                                        const result = await toolRegistry.execute(toolCall.name, toolCall.arguments, context);

                                        // Special case: screenshot - store base64 for sending
                                        if (toolCall.name === "screenshot" && result.metadata?.base64) {
                                            lastScreenshotBase64 = result.metadata.base64 as string;
                                            console.log(`[WhatsApp]   📸 Screenshot captured (${lastScreenshotBase64.length} chars)`);
                                            toolResults.push({ name: toolCall.name, result: "Screenshot captured! Now use whatsapp_send_image to send it." });
                                        } else {
                                            const resultStr = (result.content || result.error || "").slice(0, 2000);
                                            toolResults.push({ name: toolCall.name, result: resultStr });
                                            console.log(`[WhatsApp]   ✅ ${toolCall.name}: ${resultStr.slice(0, 100)}...`);
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
