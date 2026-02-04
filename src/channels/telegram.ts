import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";

type MessageHandler = (message: IncomingMessage) => void;

// Telegram adapter using Bot API
export class TelegramAdapter implements ChannelAdapter {
    name = "telegram" as const;
    private token: string;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private pollingInterval?: ReturnType<typeof setInterval>;

    constructor(token: string) {
        this.token = token;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        if (!this.token) {
            throw new Error("Telegram bot token not provided");
        }

        // Verify token by getting bot info
        const response = await fetch(`https://api.telegram.org/bot${this.token}/getMe`);
        const data = await response.json() as { ok: boolean; result?: { username: string } };

        if (!data.ok) {
            throw new Error("Invalid Telegram bot token");
        }

        console.log(`Telegram bot connected: @${data.result?.username}`);
        this.connected = true;

        // Start long polling
        this.startPolling();
    }

    async disconnect(): Promise<void> {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        this.connected = false;
    }

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

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    private async startPolling(): Promise<void> {
        let offset = 0;

        const poll = async () => {
            try {
                const response = await fetch(
                    `https://api.telegram.org/bot${this.token}/getUpdates?offset=${offset}&timeout=30`
                );
                const data = await response.json() as {
                    ok: boolean;
                    result?: Array<{
                        update_id: number;
                        message?: {
                            message_id: number;
                            from: { id: number; username?: string };
                            chat: { id: number };
                            text?: string;
                            date: number;
                        }
                    }>
                };

                if (data.ok && data.result?.length) {
                    for (const update of data.result) {
                        offset = update.update_id + 1;

                        if (update.message?.text) {
                            const incoming: IncomingMessage = {
                                id: String(update.message.message_id),
                                channel: "telegram",
                                from: String(update.message.from.id),
                                to: String(update.message.chat.id),
                                content: update.message.text,
                                timestamp: new Date(update.message.date * 1000),
                                metadata: { username: update.message.from.username },
                            };

                            for (const handler of this.handlers) {
                                handler(incoming);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Telegram polling error:", err);
            }
        };

        // Poll every 1 second
        this.pollingInterval = setInterval(poll, 1000);
        poll(); // Initial poll
    }
}

export function createTelegramAdapter(): TelegramAdapter | null {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;
    return new TelegramAdapter(token);
}
