/**
 * Telegram adapter with full AI capabilities
 * Supports: text messages, images, AI processing with all tools
 */

import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";
import { processMessageWithAI } from "./shared-ai-processor.js";

type MessageHandler = (message: IncomingMessage) => void;

export class TelegramAdapter implements ChannelAdapter {
    name = "telegram" as const;
    private token: string;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private pollingInterval?: ReturnType<typeof setTimeout>;
    private aiProvider: any = null;
    private currentModel: string = "claude-sonnet-4-20250514";

    constructor(token: string) {
        this.token = token;
    }

    // Set AI provider for message processing
    setAIProvider(provider: any, model: string): void {
        this.aiProvider = provider;
        this.currentModel = model;
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

        console.log(`[Telegram] Bot connected: @${data.result?.username}`);
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
                console.log(`[Telegram] Photo sent to ${chatId}`);
                return { success: true, messageId: String(data.result?.message_id) };
            } else {
                return { success: false, error: data.description };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            console.error(`[Telegram] Failed to send photo: ${error}`);
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
                                console.log("[Telegram] Skipping group message");
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

                            // Process with AI if provider available
                            if (this.aiProvider) {
                                console.log(`[Telegram] Processing message from ${incoming.from}`);
                                await processMessageWithAI({
                                    channel: "telegram",
                                    from: incoming.from,
                                    content: incoming.content,
                                    aiProvider: this.aiProvider,
                                    model: this.currentModel,
                                    sendText: async (text) => {
                                        return await this.send({ channel: "telegram", to: chatId, content: text });
                                    },
                                    sendImage: async (imageBuffer, caption) => {
                                        return await this.sendPhoto(chatId, imageBuffer, caption);
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
                    console.error("[Telegram] Polling error:", err);
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
