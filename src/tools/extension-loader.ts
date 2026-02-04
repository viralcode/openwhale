/**
 * OpenWhale Extension Loader
 * 
 * Loads extensions at startup and provides channel notification integration.
 * This module bridges extensions with the channel system for sending notifications.
 */

import {
    loadAllExtensions,
    setNotifyCallback,
    getLoadedExtensions,
    getExtensionsDir
} from "./extend.js";

/**
 * Send notification through a channel
 * Uses dynamic import to avoid circular dependencies
 */
async function sendNotification(channel: string, message: string): Promise<void> {
    console.log(`[Extension] Sending notification to ${channel}: ${message.slice(0, 50)}...`);

    if (channel === "whatsapp") {
        try {
            // Dynamically import WhatsApp to avoid circular deps
            const { sendWhatsAppMessage, isWhatsAppConnected } = await import("../channels/whatsapp-baileys.js");

            if (!isWhatsAppConnected()) {
                console.log(`[Extension] WhatsApp not connected, logging: ${message}`);
                return;
            }

            const ownerNumber = process.env.WHATSAPP_OWNER_NUMBER;
            if (!ownerNumber) {
                console.log(`[Extension] No WhatsApp owner number configured`);
                return;
            }

            // Send message to owner
            const result = await sendWhatsAppMessage(ownerNumber, message);

            if (result.success) {
                console.log(`[Extension] ✅ Sent to WhatsApp: ${message.slice(0, 50)}...`);
            } else {
                console.error(`[Extension] ❌ WhatsApp send failed: ${result.error}`);
            }
        } catch (err) {
            console.error(`[Extension] Failed to send WhatsApp notification:`, err);
        }
    } else {
        // For other channels, log for now (can extend to Telegram, Discord, etc.)
        console.log(`[Extension] Channel '${channel}' notification: ${message}`);
    }
}

/**
 * Initialize the extension loader
 * Call this during startup after channels are connected
 */
export async function initializeExtensionLoader(): Promise<void> {
    console.log(`[Extension] Initializing extension loader...`);
    console.log(`[Extension] Extensions directory: ${getExtensionsDir()}`);

    // Set up notification callback
    setNotifyCallback(sendNotification);

    // Load all extensions
    await loadAllExtensions();
}

/**
 * Get extension stats for dashboard
 */
export function getExtensionStats(): { total: number; enabled: number; scheduled: number } {
    const extensions = getLoadedExtensions();
    let enabled = 0;
    let scheduled = 0;

    for (const [, ext] of extensions) {
        if (ext.manifest.enabled) enabled++;
        if (ext.manifest.schedule) scheduled++;
    }

    return {
        total: extensions.size,
        enabled,
        scheduled,
    };
}

export { getExtensionsDir, getLoadedExtensions };
