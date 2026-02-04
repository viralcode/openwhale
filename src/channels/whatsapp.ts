import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";
import { homedir } from "node:os";
import { join } from "node:path";

type MessageHandler = (message: IncomingMessage) => void;

// Persistent auth directory
const DEFAULT_SESSION_PATH = join(homedir(), ".openwhale", "whatsapp-auth");

// WhatsApp adapter using Baileys
export class WhatsAppAdapter implements ChannelAdapter {
    name = "whatsapp" as const;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private sessionPath: string;
    private socket: any = null; // Baileys socket
    private ownerNumber: string | null = null;

    constructor(sessionPath: string = DEFAULT_SESSION_PATH, ownerNumber?: string) {
        this.sessionPath = sessionPath;
        this.ownerNumber = ownerNumber ?? process.env.WHATSAPP_OWNER_NUMBER ?? null;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        try {
            // Dynamic import since baileys is optional
            const baileys = await import("@whiskeysockets/baileys");
            const makeWASocket = baileys.default;
            const { useMultiFileAuthState, DisconnectReason } = baileys;

            console.log("🔗 Connecting to WhatsApp...");
            console.log("   Session path:", this.sessionPath);
            if (this.ownerNumber) {
                console.log("   Owner number:", this.ownerNumber);
            }

            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: true, // Show QR code in terminal for pairing
            });

            // Save credentials whenever they update
            sock.ev.on("creds.update", saveCreds);

            // Handle connection updates
            sock.ev.on("connection.update", (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log("\n📱 Scan this QR code with your WhatsApp app:");
                    console.log("   (Go to Settings > Linked Devices > Link a Device)\n");
                }

                if (connection === "close") {
                    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log("WhatsApp connection closed. Reconnecting:", shouldReconnect);
                    this.connected = false;

                    if (shouldReconnect) {
                        setTimeout(() => this.connect(), 3000);
                    }
                } else if (connection === "open") {
                    console.log("✅ WhatsApp connected!");
                    console.log("   Account:", sock.user?.id);
                    this.connected = true;
                }
            });

            // Handle incoming messages
            sock.ev.on("messages.upsert", (m: any) => {
                const messages = m.messages || [];
                for (const msg of messages) {
                    // Skip broadcast and status messages
                    if (!msg.key.remoteJid || msg.key.remoteJid.includes("@broadcast") || msg.key.remoteJid.includes("@s.whatsapp.net") === false) {
                        continue;
                    }

                    // Skip messages from self
                    if (msg.key.fromMe) continue;

                    this.handleMessage(msg);
                }
            });

            this.socket = sock;
        } catch (error: any) {
            if (error.code === "MODULE_NOT_FOUND" || error.code === "ERR_MODULE_NOT_FOUND") {
                console.log("WhatsApp adapter initialized (stub mode)");
                console.log("To enable: npm install @whiskeysockets/baileys");
                this.connected = true; // Mark as connected in stub mode
            } else {
                console.error("WhatsApp connection error:", error.message);
                throw error;
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.socket) {
            await this.socket.logout();
            this.socket = null;
        }
        this.connected = false;
    }

    async send(message: OutgoingMessage): Promise<SendResult> {
        // Normalize phone number to WhatsApp JID format
        const phone = message.to.replace(/[^0-9]/g, "");
        const jid = message.to.includes("@")
            ? message.to
            : `${phone}@s.whatsapp.net`;

        if (!this.socket) {
            console.log(`[WhatsApp] (stub) Would send to ${jid}: ${message.content.slice(0, 50)}...`);
            return {
                success: true,
                messageId: `wa_stub_${Date.now()}`,
            };
        }

        try {
            const result = await this.socket.sendMessage(jid, { text: message.content });
            console.log(`[WhatsApp] Sent to ${jid}`);

            return {
                success: true,
                messageId: result.key.id,
            };
        } catch (error: any) {
            console.error(`[WhatsApp] Send failed:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    // Called when Baileys receives a message
    handleMessage(event: {
        key: { remoteJid: string; id: string };
        message?: { conversation?: string; extendedTextMessage?: { text: string } };
        pushName?: string;
    }): void {
        const text = event.message?.conversation ?? event.message?.extendedTextMessage?.text;
        if (!text) return;

        const fromNumber = event.key.remoteJid.split("@")[0];

        // If owner number is set, only respond to owner
        if (this.ownerNumber && fromNumber !== this.ownerNumber.replace(/[^0-9]/g, "")) {
            console.log(`[WhatsApp] Ignoring message from non-owner: ${fromNumber}`);
            return;
        }

        const incoming: IncomingMessage = {
            id: event.key.id,
            channel: "whatsapp",
            from: fromNumber,
            content: text,
            timestamp: new Date(),
            metadata: { pushName: event.pushName },
        };

        console.log(`[WhatsApp] Message from ${event.pushName ?? fromNumber}: ${text.slice(0, 50)}...`);

        for (const handler of this.handlers) {
            handler(incoming);
        }
    }

    // Send a message to the owner
    async notifyOwner(content: string): Promise<SendResult> {
        if (!this.ownerNumber) {
            return { success: false, error: "No owner number configured" };
        }
        return this.send({ to: this.ownerNumber, content, channel: "whatsapp" });
    }
}

export function createWhatsAppAdapter(): WhatsAppAdapter | null {
    const sessionPath = process.env.WHATSAPP_SESSION_PATH ?? DEFAULT_SESSION_PATH;
    const ownerNumber = process.env.WHATSAPP_OWNER_NUMBER;
    return new WhatsAppAdapter(sessionPath, ownerNumber);
}
