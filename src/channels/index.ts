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
import { logger } from "../logger.js";

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
            logger.info("channel", "Telegram connected with AI processing");
        } catch (err) {
            logger.error("channel", "Telegram connection failed", { error: String(err) });
        }
    }

    // Register Discord if configured
    const discord = createDiscordAdapter();
    if (discord) {
        channelRegistry.register(discord);
        try {
            await discord.connect();
            logger.info("channel", "Discord connected with AI processing");
        } catch (err) {
            logger.error("channel", "Discord connection failed", { error: String(err) });
        }
    }

    // Register Slack if configured
    const slack = createSlackAdapter();
    if (slack) {
        channelRegistry.register(slack);
        try {
            await slack.connect();
        } catch (err) {
            logger.error("channel", "Slack connection failed", { error: String(err) });
        }
    }

    // Register Twitter if configured
    const twitter = createTwitterAdapter();
    if (twitter) {
        channelRegistry.register(twitter);
        try {
            await twitter.connect();
            logger.info("channel", "Twitter connected with AI processing");
        } catch (err) {
            logger.error("channel", "Twitter connection failed", { error: String(err) });
        }
    }

    // Register iMessage if available (macOS only)
    const imessage = createIMessageAdapter();
    if (imessage) {
        channelRegistry.register(imessage);
        try {
            await imessage.connect();
            logger.info("channel", "iMessage connected with AI processing");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.warn("channel", "iMessage not available", { error: errMsg });
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
            logger.info("channel", "WhatsApp auto-connecting from saved session");

            // Get owner number for filtering
            const ownerNumber = (process.env.WHATSAPP_OWNER_NUMBER || "").replace(/[^0-9]/g, "");
            logger.info("channel", "WhatsApp owner number", { owner: ownerNumber || "(not set)" });

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

                    // Determine if this is an owner message
                    // fromMe=true means the message is from the connected WhatsApp account (the owner).
                    // We can't match fromMe messages by phone number because WhatsApp may use
                    // LID (Linked Identity) JIDs instead of phone numbers for linked devices.
                    // Bot echo loops are prevented by the dedup mechanism (sendWhatsAppMessage
                    // pre-marks outbound message IDs before they echo back).
                    const isSameAsOwner = isFromMe || (ownerNumber ? fromDigits.includes(ownerNumber) : false);

                    // Skip bot's outbound messages (echoes from messages the bot sent)
                    if (isFromMe) {
                        const { isMessageProcessed: isDupe } = await import("../db/message-dedupe.js");
                        if (isDupe(messageId)) {
                            logger.debug("channel", "WhatsApp skipping bot echo", { messageId });
                            return;
                        }
                        logger.info("channel", "WhatsApp owner message (fromMe)", { messageId, preview: msg.content.slice(0, 50) });
                    }

                    logger.info("channel", `WhatsApp message from ${fromRaw}`, { fromMe: isFromMe, owner: isSameAsOwner, group: isGroup, preview: msg.content.slice(0, 50) });

                    // Skip group messages
                    if (isGroup) {
                        logger.debug("channel", "WhatsApp skipping group message", { from: fromRaw });
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
                            logger.info("channel", "WhatsApp message handled by extension", { from: fromRaw });
                            markMessageProcessed(messageId, "inbound", fromRaw);
                            return;
                        }

                        if (extResult.responses.length > 0) {
                            logger.info("channel", `WhatsApp ${extResult.responses.length} extension(s) processed message`, { from: fromRaw });
                        }
                    } catch (extErr) {
                        logger.error("extension", "WhatsApp extension error", { error: String(extErr) });
                    }
                    // ================================================================

                    // Only process messages from owner if configured (extensions already ran above)
                    if (ownerNumber && !isSameAsOwner) {
                        logger.debug("channel", "WhatsApp skipping AI, not from owner", { from: fromRaw, ownerNumber });
                        markMessageProcessed(messageId, "inbound", fromRaw);
                        return;
                    }

                    // Mark as processed BEFORE handling to prevent race conditions
                    markMessageProcessed(messageId, "inbound", fromRaw);

                    // Process with AI using the unified shared processor
                    const waModel = getCurrentModel();
                    if (registry.getProvider(waModel)) {
                        logger.info("channel", "WhatsApp processing with AI", { from: fromRaw, model: waModel });
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
                            logger.error("chat", `WhatsApp AI processing error`, { error: error.message, from: fromRaw });
                            await sendWhatsAppMessage(fromRaw, `Error: ${error.message.slice(0, 100)}`);
                        }
                    }
                },
                onConnected: () => {
                    logger.info("channel", "WhatsApp connected with AI processing");
                },
            });
        } else {
            logger.info("channel", "WhatsApp not configured, use dashboard to connect");
        }
    } catch (err) {
        logger.error("channel", "WhatsApp initialization failed", { error: String(err) });
    }

    logger.info("system", "All channels initialized", { connected: channelRegistry.listConnected() });
}
