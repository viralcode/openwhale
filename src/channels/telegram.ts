/**
 * Telegram adapter with full AI capabilities
 * Supports: text messages, images, AI processing with all tools
 */

import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";
import { processMessageWithAI } from "./shared-ai-processor.js";
import { registry } from "../providers/index.js";
import { getCurrentModel } from "../sessions/session-service.js";
import { logger } from "../logger.js";

type MessageHandler = (message: IncomingMessage) => void;

export class TelegramAdapter implements ChannelAdapter {
    name = "telegram" as const;
    private token: string;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private pollingInterval?: ReturnType<typeof setTimeout>;

    constructor(token: string) {
        this.token = token;
    }

    getToken(): string {
        return this.token;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        if (!this.token) {
            throw new Error("Telegram bot token not provided");
        }

        const response = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
        const data = await response.json() as { ok: boolean; result?: { username: string } };

        if (!data.ok) {
            throw new Error("Invalid Telegram bot token");
        }

        logger.info("channel", `Telegram connected`, { username: data.result?.username });
        this.connected = true;

        this.startPolling();
    }

    async disconnect(): Promise<void> {
        if (this.pollingInterval) {
            clearTimeout(this.pollingInterval);
        }
        this.connected = false;
    }

    // Send text message
    async send(message: OutgoingMessage): Promise<SendResult> {
        try {
            const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: message.to,
                    text: message.content,
                    reply_to_message_id: message.replyTo,
                    parse_mode: "Markdown",
                }),
            });

            const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

            if (data.ok) {
                return { success: true, messageId: String(data.result?.message_id) };
            } else {
                return { success: false, error: data.description };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return { success: false, error };
        }
    }

    // Send image/photo
    async sendPhoto(chatId: string, imageBuffer: Buffer, caption?: string): Promise<SendResult> {
        try {
            const formData = new FormData();
            formData.append("chat_id", chatId);
            formData.append("photo", new Blob([imageBuffer], { type: "image/png" }), "image.png");
            if (caption) {
                formData.append("caption", caption);
            }

            const response = await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

            if (data.ok) {
                logger.info("channel", `Telegram photo sent`, { chatId, sizeBytes: imageBuffer.length, hasCaption: !!caption });
                return { success: true, messageId: String(data.result?.message_id) };
            } else {
                return { success: false, error: data.description };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            logger.error("channel", "Telegram photo send failed", { chatId, error });
            return { success: false, error };
        }
    }

    // Send document/file
    async sendDocument(chatId: string, buffer: Buffer, fileName: string, mimetype: string, caption?: string): Promise<SendResult> {
        try {
            const formData = new FormData();
            formData.append("chat_id", chatId);
            formData.append("document", new Blob([buffer], { type: mimetype }), fileName);
            if (caption) {
                formData.append("caption", caption);
            }

            const response = await fetch(`https://api.telegram.org/bot${this.token}/sendDocument`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

            if (data.ok) {
                logger.info("channel", `Telegram document sent`, { chatId, fileName, mimetype, sizeBytes: buffer.length });
                return { success: true, messageId: String(data.result?.message_id) };
            } else {
                return { success: false, error: data.description };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            logger.error("channel", "Telegram document send failed", { chatId, fileName, error });
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    private async startPolling(): Promise<void> {
        let offset = 0;

        const poll = async () => {
            if (!this.connected) return;

            try {
                const response = await fetch(
                    `https://api.telegram.org/bot${this.token}/getUpdates?offset=${offset}&timeout=30`,
                    { signal: AbortSignal.timeout(35000) }
                );
                const data = await response.json() as {
                    ok: boolean;
                    result?: Array<{
                        update_id: number;
                        message?: {
                            message_id: number;
                            from: { id: number; username?: string; first_name?: string };
                            chat: { id: number; type: string };
                            text?: string;
                            date: number;
                        }
                    }>
                };

                if (data.ok && data.result?.length) {
                    for (const update of data.result) {
                        offset = update.update_id + 1;

                        if (update.message?.text) {
                            const chatId = String(update.message.chat.id);
                            const isGroup = update.message.chat.type !== "private";

                            // Skip group messages for now
                            if (isGroup) {
                                logger.debug("channel", "Telegram skipping group message", { chatId, chatType: update.message.chat.type });
                                continue;
                            }

                            const incoming: IncomingMessage = {
                                id: String(update.message.message_id),
                                channel: "telegram",
                                from: String(update.message.from.id),
                                to: chatId,
                                content: update.message.text,
                                timestamp: new Date(update.message.date * 1000),
                                metadata: {
                                    username: update.message.from.username,
                                    firstName: update.message.from.first_name,
                                    chatType: update.message.chat.type,
                                },
                            };

                            // ========== EXTENSION HOOK ==========
                            // Extensions subscribed to "telegram" get ALL messages
                            try {
                                const { triggerChannelExtensions } = await import("../tools/extend.js");
                                const extResult = await triggerChannelExtensions("telegram", {
                                    from: incoming.from,
                                    content: incoming.content,
                                    metadata: incoming.metadata as Record<string, unknown>
                                });

                                if (extResult.handled) {
                                    logger.info("channel", "Telegram message handled by extension", { from: incoming.from, chatId });
                                    continue;
                                }
                            } catch (extErr) {
                                logger.error("channel", "Telegram extension error", { error: String(extErr), from: incoming.from });
                            }
                            // =====================================

                            // Process with AI if provider available
                            if (registry.getProvider(getCurrentModel())) {
                                logger.info("channel", `Telegram message from ${incoming.from}`, { from: incoming.from, username: update.message?.from?.username, preview: incoming.content.slice(0, 80), chatId });
                                await processMessageWithAI({
                                    channel: "telegram",
                                    from: incoming.from,
                                    content: incoming.content,
                                    sendText: async (text) => {
                                        return await this.send({ channel: "telegram", to: chatId, content: text });
                                    },
                                    sendImage: async (imageBuffer, caption) => {
                                        return await this.sendPhoto(chatId, imageBuffer, caption);
                                    },
                                    sendDocument: async (buffer, fileName, mimetype, caption) => {
                                        return await this.sendDocument(chatId, buffer, fileName, mimetype, caption);
                                    },
                                    isGroup,
                                });
                            } else {
                                // Fallback: notify handlers
                                for (const handler of this.handlers) {
                                    handler(incoming);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    logger.error("channel", "Telegram polling error", { error: String(err) });
                }
            }

            // Continue polling
            if (this.connected) {
                this.pollingInterval = setTimeout(poll, 100);
            }
        };

        poll();
    }
}

export function createTelegramAdapter(): TelegramAdapter | null {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;
    return new TelegramAdapter(token);
}
