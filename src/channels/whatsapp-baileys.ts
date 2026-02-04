/**
 * Real WhatsApp channel implementation using Baileys
 * Supports QR code pairing and actual message sending
 */

import {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeWASocket,
    useMultiFileAuthState,
    type AnyMessageContent,
    type WASocket,
} from "@whiskeysockets/baileys";
import { homedir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import qrcode from "qrcode-terminal";
import pino from "pino";
import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";

// Suppress most Baileys logs
const logger = pino({ level: "silent" });

let waSocket: WASocket | null = null;
let isConnected = false;
let isConnecting = false;
let qrDisplayed = false;
let messageHandler: ((msg: IncomingMessage) => void) | null = null;
let currentQRCode: string | null = null; // Store QR for dashboard display

/**
 * Get the current QR code for dashboard display
 */
export function getQRCode(): string | null {
    return currentQRCode;
}

// Auth directory for storing WhatsApp credentials - use homedir for persistence
const AUTH_DIR = join(homedir(), ".openwhale", "whatsapp-auth");

/**
 * Initialize WhatsApp connection with QR code display
 */
export async function initWhatsApp(options: {
    printQR?: boolean;
    onQR?: (qr: string) => void;
    onConnected?: () => void;
    onDisconnected?: (reason: string) => void;
    onMessage?: (msg: IncomingMessage) => void;
} = {}): Promise<WASocket | null> {
    if (isConnecting) {
        console.log("[WhatsApp] Already connecting...");
        return null;
    }

    if (waSocket && isConnected) {
        console.log("[WhatsApp] Already connected");
        return waSocket;
    }

    isConnecting = true;
    qrDisplayed = false;

    try {
        // Ensure auth directory exists
        if (!existsSync(AUTH_DIR)) {
            mkdirSync(AUTH_DIR, { recursive: true });
        }

        // Load auth state from disk
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion();

        console.log("[WhatsApp] Connecting with Baileys version", version.join("."));

        // Create socket
        waSocket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger as any),
            },
            version,
            logger: logger as any,
            printQRInTerminal: false, // We'll handle QR ourselves
            browser: ["OpenWhale", "CLI", "1.0.0"],
            syncFullHistory: false,
            markOnlineOnConnect: true,
        });

        // Handle credentials update
        waSocket.ev.on("creds.update", saveCreds);

        // Handle connection updates
        waSocket.ev.on("connection.update", (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR code
            if (qr) {
                currentQRCode = qr; // Store for dashboard
                if (options.onQR) {
                    options.onQR(qr);
                }
                if (options.printQR !== false && !qrDisplayed) {
                    console.log("\n📱 Scan this QR code in WhatsApp (Linked Devices):\n");
                    qrcode.generate(qr, { small: true });
                    qrDisplayed = true;
                }
            }

            // Handle connection state
            if (connection === "open") {
                isConnected = true;
                isConnecting = false;
                currentQRCode = null; // Clear QR when connected
                console.log("\n✅ WhatsApp connected successfully!");
                options.onConnected?.();
            }

            if (connection === "close") {
                isConnected = false;
                const reason = (lastDisconnect?.error as any)?.output?.statusCode;
                const reasonText = reason === DisconnectReason.loggedOut
                    ? "Logged out"
                    : `Disconnected (code: ${reason})`;

                console.log(`[WhatsApp] ${reasonText}`);
                options.onDisconnected?.(reasonText);

                // Reconnect unless logged out
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("[WhatsApp] Reconnecting...");
                    isConnecting = false;
                    initWhatsApp(options);
                } else {
                    console.log("[WhatsApp] Please re-authenticate by running: openwhale whatsapp login");
                    waSocket = null;
                }
            }
        });

        // Handle incoming messages
        waSocket.ev.on("messages.upsert", async (m) => {
            // Import dedup module for checking and saving messages
            const { markMessageProcessed, isMessageProcessed } = await import("../db/message-dedupe.js");

            for (const msg of m.messages) {
                if (msg.message) {
                    const text = msg.message.conversation ||
                        msg.message.extendedTextMessage?.text ||
                        "";

                    // Skip empty messages
                    if (!text) continue;

                    const messageId = msg.key.id || `wa-${Date.now()}`;

                    // Use SQLite to check if already processed (prevents infinite loops)
                    if (isMessageProcessed(messageId)) {
                        console.log(`[WhatsApp] Skipping already processed message: ${messageId}`);
                        continue;
                    }

                    const from = msg.key.remoteJid?.replace("@s.whatsapp.net", "").replace("@lid", "") || "";
                    const msgTimestamp = typeof msg.messageTimestamp === "number"
                        ? msg.messageTimestamp
                        : Number(msg.messageTimestamp) || Date.now() / 1000;

                    console.log(`[WhatsApp] Message received - from: ${from}, fromMe: ${msg.key.fromMe}, text: "${text.slice(0, 30)}..."`);

                    // Save incoming message to database (marks as processed)
                    markMessageProcessed(messageId, msg.key.fromMe ? "outbound" : "inbound", from, {
                        content: text,
                        contactName: msg.pushName || undefined,
                    });

                    if (options.onMessage) {
                        options.onMessage({
                            id: messageId,
                            from,
                            content: text,
                            channel: "whatsapp",
                            timestamp: new Date(msgTimestamp * 1000),
                            metadata: {
                                id: messageId,
                                pushName: msg.pushName,
                                fromMe: msg.key.fromMe,
                            },
                        });
                    }
                }
            }
        });

        return waSocket;
    } catch (error: any) {
        console.error("[WhatsApp] Connection error:", error.message);
        isConnecting = false;
        return null;
    }
}

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(
    to: string,
    content: string | AnyMessageContent,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Import dedup module dynamically to avoid circular deps
    const { markMessageProcessed } = await import("../db/message-dedupe.js");

    if (!waSocket || !isConnected) {
        return {
            success: false,
            error: "WhatsApp not connected. Run: openwhale whatsapp login"
        };
    }

    try {
        // Format phone number to JID
        let jid = to.replace(/[^0-9]/g, "");
        if (!jid.includes("@")) {
            jid = `${jid}@s.whatsapp.net`;
        }

        // Prepare message content
        const payload: AnyMessageContent = typeof content === "string"
            ? { text: content }
            : content;

        // Debug: log what type of message we're sending
        const hasImage = 'image' in payload;
        console.log(`[WhatsApp] Sending message to ${jid}, type: ${hasImage ? 'IMAGE' : 'TEXT'}`);
        if (hasImage) {
            const imgPayload = payload as { image: Buffer; caption?: string };
            console.log(`[WhatsApp]   Image buffer size: ${imgPayload.image?.length || 0} bytes`);
        }

        const result = await waSocket.sendMessage(jid, payload);
        const messageId = result?.key?.id;

        console.log(`[WhatsApp] Message sent successfully, ID: ${messageId}`);

        // CRITICAL: Mark outbound message as processed IMMEDIATELY
        // This prevents the loop when WhatsApp echoes it back to us
        if (messageId) {
            const msgContent = typeof content === "string" ? content : (content as any).text || "[media]";
            markMessageProcessed(messageId, "outbound", undefined, {
                to: to.replace(/[^0-9]/g, ""),
                content: msgContent,
            });
            console.log(`[WhatsApp] Saved outbound message: ${messageId}`);
        }

        return {
            success: true,
            messageId: messageId || "unknown"
        };
    } catch (error: any) {
        console.error(`[WhatsApp] Send error: ${error.message}`);
        console.error(error.stack);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check if WhatsApp is connected
 */
export function isWhatsAppConnected(): boolean {
    return isConnected && waSocket !== null;
}

/**
 * Get the WhatsApp socket
 */
export function getWhatsAppSocket(): WASocket | null {
    return waSocket;
}

/**
 * Disconnect WhatsApp
 */
export async function disconnectWhatsApp(): Promise<void> {
    if (waSocket) {
        waSocket.end(undefined);
        waSocket = null;
        isConnected = false;
    }
}

/**
 * WhatsApp Channel Adapter for OpenWhale
 */
export function createWhatsAppBaileysChannel(): ChannelAdapter {
    return {
        name: "whatsapp",

        async send(message: OutgoingMessage): Promise<SendResult> {
            const result = await sendWhatsAppMessage(message.to, message.content);
            return {
                success: result.success,
                messageId: result.messageId,
                error: result.error,
            };
        },

        onMessage(handler: (message: IncomingMessage) => void): void {
            messageHandler = handler;
        },

        async connect(): Promise<void> {
            await initWhatsApp({
                printQR: true,
                onMessage: (msg) => {
                    if (messageHandler) {
                        messageHandler(msg);
                    }
                },
            });
        },

        async disconnect(): Promise<void> {
            await disconnectWhatsApp();
        },

        isConnected(): boolean {
            return isWhatsAppConnected();
        },
    };
}
