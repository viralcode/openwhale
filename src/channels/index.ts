// Export all channels
export { channelRegistry, type MessageChannel, type IncomingMessage, type OutgoingMessage, type ChannelAdapter } from "./base.js";

export { TelegramAdapter, createTelegramAdapter } from "./telegram.js";
export { DiscordAdapter, createDiscordAdapter } from "./discord.js";
export { SlackAdapter, createSlackAdapter } from "./slack.js";
export { webAdapter } from "./web.js";
export { WhatsAppAdapter, createWhatsAppAdapter } from "./whatsapp.js";
export { TwitterAdapter, createTwitterAdapter } from "./twitter.js";
export { IMessageAdapter, createIMessageAdapter } from "./imessage/adapter.js";

// Initialize all available channels
import { channelRegistry } from "./base.js";
import { createTelegramAdapter } from "./telegram.js";
import { createDiscordAdapter } from "./discord.js";
import { createSlackAdapter } from "./slack.js";
import { webAdapter } from "./web.js";
import { createTwitterAdapter } from "./twitter.js";
import { createIMessageAdapter } from "./imessage/adapter.js";
import { registry } from "../providers/index.js";
import { getCurrentModel } from "../sessions/session-service.js";
import { processMessageWithAI } from "./shared-ai-processor.js";

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
            console.log("[Telegram] ✓ Connected with AI processing enabled");
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

    // Register Twitter if configured
    const twitter = createTwitterAdapter();
    if (twitter) {
        channelRegistry.register(twitter);
        try {
            await twitter.connect();
            console.log("[Twitter] ✓ Connected with AI processing enabled");
        } catch (err) {
            console.error("Failed to connect Twitter:", err);
        }
    }

    // Register iMessage if available (macOS only)
    const imessage = createIMessageAdapter();
    if (imessage) {
        channelRegistry.register(imessage);
        try {
            await imessage.connect();
            console.log("[iMessage] ✓ Connected with AI processing enabled");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`📱 iMessage not available: ${errMsg}`);
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
        const { initializeMemory } = await import("../memory/memory-files.js");

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

                    // Process with AI using the unified shared processor
                    const waModel = getCurrentModel();
                    if (registry.getProvider(waModel)) {
                        console.log("[WhatsApp]   ↳ Processing with AI...");
                        try {
                            await processMessageWithAI({
                                channel: "whatsapp",
                                from: fromRaw,
                                content: msg.content,
                                model: waModel,
                                sendText: async (text) => {
                                    const result = await sendWhatsAppMessage(fromRaw, text);
                                    return { success: result.success !== false, error: result.error };
                                },
                                sendImage: async (imageBuffer, caption) => {
                                    const result = await sendWhatsAppMessage(fromRaw, {
                                        image: imageBuffer,
                                        caption: caption || "Image from OpenWhale",
                                    });
                                    return { success: result.success !== false, error: result.error };
                                },
                                sendDocument: async (buffer, fileName, mimetype, caption) => {
                                    const result = await sendWhatsAppMessage(fromRaw, {
                                        document: buffer,
                                        mimetype,
                                        fileName,
                                        caption,
                                    } as any);
                                    return { success: result.success !== false, error: result.error };
                                },
                                isGroup,
                            });
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
