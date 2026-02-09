/**
 * iMessage Channel Adapter
 * 
 * Full channel adapter for Apple iMessage (macOS only).
 * Uses the IMessageClient RPC wrapper around the `imsg` CLI.
 * Follows the same patterns as TelegramAdapter / DiscordAdapter.
 */

import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "../base.js";
import { processMessageWithAI } from "../shared-ai-processor.js";
import { IMessageClient, isIMMessageAvailable, type IMessageClientOptions } from "./client.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { registry } from "../../providers/index.js";
import { getCurrentModel } from "../../sessions/session-service.js";
import { logger } from "../../logger.js";

const execAsync = promisify(exec);

type MessageHandler = (message: IncomingMessage) => void;

/**
 * Check if the `imsg` CLI binary is available on PATH
 */
async function isImsgCliAvailable(cliPath = "imsg"): Promise<boolean> {
    try {
        await execAsync(`which ${cliPath}`);
        return true;
    } catch {
        return false;
    }
}

export class IMessageAdapter implements ChannelAdapter {
    name = "imessage" as const;
    private client: IMessageClient | null = null;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private pollingInterval?: ReturnType<typeof setInterval>;
    private seenMessageIds = new Set<string>();
    private cliPath: string;
    private dbPath?: string;

    constructor(opts: IMessageClientOptions = {}) {
        this.cliPath = opts.cliPath?.trim() || "imsg";
        this.dbPath = opts.dbPath?.trim() || undefined;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        if (!isIMMessageAvailable()) {
            throw new Error("iMessage is only available on macOS");
        }

        if (!(await isImsgCliAvailable(this.cliPath))) {
            throw new Error(`imsg CLI not found (looked for: ${this.cliPath}). Install it to enable iMessage support.`);
        }

        // Create and start the RPC client
        this.client = new IMessageClient({
            cliPath: this.cliPath,
            dbPath: this.dbPath,
            onNotification: (notification) => {
                // Handle real-time notifications from `imsg rpc`
                if (notification.method === "message.received") {
                    const params = notification.params as {
                        chatId?: string;
                        sender?: string;
                        text?: string;
                        messageId?: string;
                        timestamp?: number;
                    } | undefined;

                    if (params?.text && params?.sender) {
                        this.handleIncomingMessage({
                            id: params.messageId || `imsg-${Date.now()}`,
                            chatId: params.chatId || "",
                            sender: params.sender,
                            text: params.text,
                            timestamp: params.timestamp || Date.now(),
                            isFromMe: false,
                        });
                    }
                }
            },
            onError: (err) => {
                logger.error("channel", `iMessage client error`, { error: err.message });
            },
        });

        await this.client.start();
        this.connected = true;

        // Start polling for new messages as a fallback
        // (in case notifications don't fire for all message types)
        this.startPolling();

        logger.info("channel", "iMessage adapter connected");
    }

    async disconnect(): Promise<void> {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
        if (this.client) {
            await this.client.stop();
            this.client = null;
        }
        this.connected = false;
        logger.info("channel", "iMessage adapter disconnected");
    }

    /**
     * Send a text message via iMessage
     */
    async send(message: OutgoingMessage): Promise<SendResult> {
        if (!this.client || !this.connected) {
            return { success: false, error: "iMessage not connected" };
        }

        try {
            const result = await this.client.sendMessage(message.to, message.content);
            if (result.success) {
                return { success: true, messageId: result.messageId };
            } else {
                return { success: false, error: "Failed to send iMessage" };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            logger.error("channel", "iMessage send error", { error, to: message.to });
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Poll for new messages from recent chats
     */
    private startPolling(): void {
        const POLL_INTERVAL_MS = 5000; // Check every 5 seconds

        this.pollingInterval = setInterval(async () => {
            if (!this.client || !this.connected) return;

            try {
                // Get recent chats
                const chats = await this.client.listChats(10);

                if (Array.isArray(chats)) {
                    for (const chat of chats) {
                        // Get recent messages from each chat
                        const messages = await this.client.getMessages(chat.id, 5);

                        if (Array.isArray(messages)) {
                            for (const msg of messages) {
                                // Skip messages we've already seen
                                if (this.seenMessageIds.has(msg.id)) continue;
                                this.seenMessageIds.add(msg.id);

                                // Skip our own messages
                                if (msg.isFromMe) continue;

                                // Skip old messages (only process messages from the last 30 seconds)
                                const age = Date.now() - msg.timestamp;
                                if (age > 30_000) continue;

                                this.handleIncomingMessage(msg);
                            }
                        }
                    }
                }

                // Prune old message IDs to prevent memory leak
                if (this.seenMessageIds.size > 5000) {
                    const arr = Array.from(this.seenMessageIds);
                    this.seenMessageIds = new Set(arr.slice(-2500));
                }
            } catch (err) {
                // Suppress polling errors to avoid log spam
                if (this.connected) {
                    logger.error("channel", "iMessage polling error", { error: err instanceof Error ? err.message : String(err) });
                }
            }
        }, POLL_INTERVAL_MS);
    }

    /**
     * Handle an incoming iMessage and route it through the AI pipeline
     */
    private async handleIncomingMessage(msg: {
        id: string;
        chatId: string;
        sender: string;
        text: string;
        timestamp: number;
        isFromMe: boolean;
    }): Promise<void> {
        const isGroup = false; // TODO: detect group chats from chatId

        const incoming: IncomingMessage = {
            id: msg.id,
            channel: "imessage",
            from: msg.sender,
            to: msg.chatId,
            content: msg.text,
            timestamp: new Date(msg.timestamp),
            metadata: {
                chatId: msg.chatId,
            },
        };

        logger.info("channel", `iMessage message from ${msg.sender}`, { sender: msg.sender, chatId: msg.chatId, preview: msg.text.slice(0, 60) });

        // ========== EXTENSION HOOK ==========
        // Extensions subscribed to "imessage" get ALL messages
        try {
            const { triggerChannelExtensions } = await import("../../tools/extend.js");
            const extResult = await triggerChannelExtensions("imessage", {
                from: incoming.from,
                content: incoming.content,
                metadata: incoming.metadata as Record<string, unknown>,
            });

            if (extResult.handled) {
                logger.info("channel", "iMessage message handled by extension", { from: incoming.from });
                return;
            }
        } catch (extErr) {
            logger.error("channel", "iMessage extension error", { error: String(extErr), from: incoming.from });
        }
        // =====================================

        // Process with AI if provider is available
        if (registry.getProvider(getCurrentModel())) {
            logger.info("channel", `iMessage processing with AI`, { from: incoming.from });
            try {
                await processMessageWithAI({
                    channel: "imessage",
                    from: incoming.from,
                    content: incoming.content,
                    sendText: async (text) => {
                        return await this.send({
                            channel: "imessage",
                            to: msg.sender,
                            content: text,
                        });
                    },
                    sendImage: async (_imageBuffer, caption) => {
                        // iMessage doesn't support inline image sending via imsg CLI yet
                        // Send caption as text fallback
                        return await this.send({
                            channel: "imessage",
                            to: msg.sender,
                            content: `📸 ${caption || "Image"} (image sending not yet supported via iMessage)`,
                        });
                    },
                    isGroup,
                });
            } catch (err) {
                logger.error("channel", "iMessage AI processing error", { error: err instanceof Error ? err.message : String(err), from: incoming.from });
            }
        } else {
            // Fallback: notify registered handlers
            for (const handler of this.handlers) {
                handler(incoming);
            }
        }
    }
}

/**
 * Factory function: create iMessage adapter if available
 */
export function createIMessageAdapter(): IMessageAdapter | null {
    if (!isIMMessageAvailable()) {
        return null;
    }

    // Check for optional env var overrides
    const cliPath = process.env.IMESSAGE_CLI_PATH?.trim() || undefined;
    const dbPath = process.env.IMESSAGE_DB_PATH?.trim() || undefined;

    return new IMessageAdapter({ cliPath, dbPath });
}
