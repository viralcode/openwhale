import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";

type MessageHandler = (message: IncomingMessage) => void;

// Discord adapter using Bot API (HTTP-only, no gateway for simplicity)
export class DiscordAdapter implements ChannelAdapter {
    name = "discord" as const;
    private token: string;
    private connected = false;
    private handlers: MessageHandler[] = [];

    constructor(token: string) {
        this.token = token;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        if (!this.token) {
            throw new Error("Discord bot token not provided");
        }

        // Verify token by getting current user
        const response = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bot ${this.token}` },
        });

        if (!response.ok) {
            throw new Error("Invalid Discord bot token");
        }

        const data = await response.json() as { username: string };
        console.log(`Discord bot connected: ${data.username}`);
        this.connected = true;

        // Note: Full Discord integration requires WebSocket gateway
        // This is a simplified HTTP-only version for sending messages
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    async send(message: OutgoingMessage): Promise<SendResult> {
        try {
            const response = await fetch(`https://discord.com/api/v10/channels/${message.to}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bot ${this.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    content: message.content,
                    message_reference: message.replyTo ? { message_id: message.replyTo } : undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, error };
            }

            const data = await response.json() as { id: string };
            return { success: true, messageId: data.id };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
        // Note: Receiving messages requires WebSocket gateway
        // This is a placeholder for future implementation
    }
}

export function createDiscordAdapter(): DiscordAdapter | null {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;
    return new DiscordAdapter(token);
}
