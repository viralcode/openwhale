import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";

type MessageHandler = (message: IncomingMessage) => void;

// Slack adapter using Web API
export class SlackAdapter implements ChannelAdapter {
    name = "slack" as const;
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
            throw new Error("Slack bot token not provided");
        }

        // Verify token
        const response = await fetch("https://slack.com/api/auth.test", {
            headers: { Authorization: `Bearer ${this.token}` },
        });

        const data = await response.json() as { ok: boolean; user?: string; error?: string };

        if (!data.ok) {
            throw new Error(`Slack auth failed: ${data.error}`);
        }

        console.log(`Slack bot connected: ${data.user}`);
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    async send(message: OutgoingMessage): Promise<SendResult> {
        try {
            const response = await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    channel: message.to,
                    text: message.content,
                    thread_ts: message.replyTo,
                }),
            });

            const data = await response.json() as { ok: boolean; ts?: string; error?: string };

            if (data.ok) {
                return { success: true, messageId: data.ts };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
        // Note: Receiving messages requires Slack Events API or Socket Mode
    }

    // Handle incoming Slack events (called from webhook endpoint)
    async handleEvent(event: {
        type: string;
        user?: string;
        channel?: string;
        text?: string;
        ts?: string;
    }): Promise<void> {
        if (event.type === "message" && event.text && event.channel) {
            const incoming: IncomingMessage = {
                id: event.ts ?? `slack_${Date.now()}`,
                channel: "slack",
                from: event.user ?? "unknown",
                to: event.channel,
                content: event.text,
                timestamp: event.ts ? new Date(parseFloat(event.ts) * 1000) : new Date(),
            };

            // ========== EXTENSION HOOK ==========
            // Extensions subscribed to "slack" get ALL messages
            try {
                const { triggerChannelExtensions } = await import("../tools/extend.js");
                const extResult = await triggerChannelExtensions("slack", {
                    from: incoming.from,
                    content: incoming.content,
                    metadata: { channel: event.channel }
                });

                if (extResult.handled) {
                    console.log(`[Slack] Message handled by extension(s)`);
                    return; // Skip normal processing
                }
            } catch (extErr) {
                console.error("[Slack] Extension error:", extErr);
            }
            // =====================================

            for (const handler of this.handlers) {
                handler(incoming);
            }
        }
    }
}

export function createSlackAdapter(): SlackAdapter | null {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return null;
    return new SlackAdapter(token);
}
