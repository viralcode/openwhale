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
import { logger as owLogger } from "../logger.js";

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
        owLogger.debug("channel", "WhatsApp already connecting, skipping");
        return null;
    }

    if (waSocket && isConnected) {
        owLogger.debug("channel", "WhatsApp already connected");
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

        owLogger.info("channel", "WhatsApp connecting", { baileysVersion: version.join(".") });

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

        // Owner's real phone number extracted from sock.user.id on connection
        let selfPhoneNumber = "";

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
                    owLogger.info("channel", "WhatsApp QR code displayed for scanning");
                }
            }

            // Handle connection state
            if (connection === "open") {
                isConnected = true;
                isConnecting = false;
                currentQRCode = null; // Clear QR when connected

                // OpenClaw pattern (monitor.ts:68-69): extract the real phone number from sock.user.id
                // sock.user.id is always the real phone JID (e.g. "14378762880:5@s.whatsapp.net")
                // even on linked devices where remoteJid uses LID numbers.
                const selfJid = waSocket?.user?.id || "";
                const selfPhoneMatch = selfJid.match(/^(\d+)(?::\d+)?@/);
                selfPhoneNumber = selfPhoneMatch ? selfPhoneMatch[1] : "";

                owLogger.info("channel", "WhatsApp connected successfully", { selfJid, selfPhoneNumber: selfPhoneNumber || "(unknown)" });
                console.log("\n✅ WhatsApp connected successfully!");
                options.onConnected?.();
            }

            if (connection === "close") {
                isConnected = false;
                const reason = (lastDisconnect?.error as any)?.output?.statusCode;
                const reasonText = reason === DisconnectReason.loggedOut
                    ? "Logged out"
                    : `Disconnected (code: ${reason})`;

                owLogger.warn("channel", `WhatsApp ${reasonText}`, { reason, willReconnect: reason !== DisconnectReason.loggedOut });
                options.onDisconnected?.(reasonText);

                // Reconnect unless logged out
                if (reason !== DisconnectReason.loggedOut) {
                    owLogger.info("channel", "WhatsApp reconnecting");
                    isConnecting = false;
                    initWhatsApp(options);
                } else {
                    owLogger.warn("channel", "WhatsApp logged out, re-authentication needed", { hint: "Run: openwhale whatsapp login" });
                    console.log("[WhatsApp] Please re-authenticate by running: openwhale whatsapp login");
                    waSocket = null;
                }
            }
        });

        // Track when the handler was set up to skip old messages on startup
        const handlerStartTime = Math.floor(Date.now() / 1000);

        // Handle incoming messages
        waSocket.ev.on("messages.upsert", async (m) => {
            // OpenClaw pattern: only process "notify" type (real-time incoming messages).
            // "append" = historical catch-up on reconnect, other types = history sync.
            // This is the PRIMARY filter that prevents old message replay.
            const upsertType = (m as any).type;
            if (upsertType !== "notify") {
                owLogger.debug("channel", `WhatsApp skipping upsert type=${upsertType}`, { count: m.messages?.length ?? 0 });
                return;
            }

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

                    // Skip old messages replayed on startup/reconnect (older than 30s before handler start)
                    const msgTimestamp = typeof msg.messageTimestamp === "number"
                        ? msg.messageTimestamp
                        : Number(msg.messageTimestamp) || 0;
                    if (msgTimestamp > 0 && msgTimestamp < handlerStartTime - 30) {
                        owLogger.debug("channel", "WhatsApp skipping old message (before startup)", { messageId, age: `${handlerStartTime - msgTimestamp}s` });
                        continue;
                    }

                    // Use SQLite to check if already processed (prevents infinite loops)
                    if (isMessageProcessed(messageId)) {
                        owLogger.debug("channel", "WhatsApp skipping already processed message", { messageId });
                        continue;
                    }

                    const from = msg.key.remoteJid?.replace("@s.whatsapp.net", "").replace("@lid", "") || "";
                    const effectiveTimestamp = msgTimestamp || Date.now() / 1000;

                    // OpenClaw pattern (access-control.ts:54): skip fromMe ONLY for DMs to other people.
                    // When the conversation is with yourself (self-chat), fromMe messages ARE the owner
                    // talking to the AI — those must be processed.
                    // Use selfPhoneNumber (from sock.user.id) which is ALWAYS the real phone number,
                    // even on linked devices where remoteJid uses LID numbers.
                    if (msg.key.fromMe) {
                        const fromDigits = from.replace(/[^0-9]/g, "");
                        const isSelfChat = selfPhoneNumber && fromDigits.includes(selfPhoneNumber);

                        if (!isSelfChat) {
                            owLogger.debug("channel", "WhatsApp skipping outbound to other contact", { messageId, from, selfPhoneNumber, preview: text.slice(0, 40) });
                            markMessageProcessed(messageId, "outbound", from, { content: text });
                            continue;
                        }
                        // Self-chat fromMe: owner is talking to AI, let it through
                        owLogger.info("channel", "WhatsApp self-chat message (owner→AI)", { messageId, from, preview: text.slice(0, 40) });
                    }

                    owLogger.info("channel", `WhatsApp message received`, { from, fromMe: msg.key.fromMe, messageId, preview: text.slice(0, 60), pushName: msg.pushName || null });

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
                            timestamp: new Date(effectiveTimestamp * 1000),
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
        owLogger.error("channel", "WhatsApp connection error", { error: error.message });
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
        owLogger.info("channel", `WhatsApp sending ${hasImage ? 'image' : 'text'} message`, { to: jid, type: hasImage ? 'IMAGE' : 'TEXT' });
        if (hasImage) {
            const imgPayload = payload as { image: Buffer; caption?: string };
            owLogger.debug("channel", "WhatsApp image payload", { sizeBytes: imgPayload.image?.length || 0 });
        }

        const result = await waSocket.sendMessage(jid, payload);
        const messageId = result?.key?.id;

        owLogger.info("channel", "WhatsApp message sent", { messageId, to: jid });

        // CRITICAL: Mark outbound message as processed IMMEDIATELY
        // This prevents the loop when WhatsApp echoes it back to us
        if (messageId) {
            const msgContent = typeof content === "string" ? content : (content as any).text || "[media]";
            markMessageProcessed(messageId, "outbound", undefined, {
                to: to.replace(/[^0-9]/g, ""),
                content: msgContent,
            });
            owLogger.debug("channel", "WhatsApp outbound message saved", { messageId, to: to.replace(/[^0-9]/g, "") });
        }

        return {
            success: true,
            messageId: messageId || "unknown"
        };
    } catch (error: any) {
        owLogger.error("channel", "WhatsApp send error", { error: error.message, to, stack: error.stack?.split("\n").slice(0, 3).join(" | ") });
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
