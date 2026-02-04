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
        const { initWhatsApp } = await import("./whatsapp-baileys.js");
        const { existsSync } = await import("fs");
        const { join } = await import("path");
        const { homedir } = await import("os");

        const authDir = join(homedir(), ".openwhale", "whatsapp-auth");
        const credsFile = join(authDir, "creds.json");

        // Only auto-connect if we have saved credentials
        if (existsSync(credsFile)) {
            console.log("🔗 Found WhatsApp session, auto-connecting...");
            await initWhatsApp();
        } else {
            console.log("📱 WhatsApp not configured yet - use dashboard to connect");
        }
    } catch (err) {
        console.error("WhatsApp initialization error:", err);
    }

    console.log("Connected channels:", channelRegistry.listConnected());
}
