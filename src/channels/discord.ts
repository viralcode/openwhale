/**
 * Discord adapter with full AI capabilities
 * Supports: text messages, images, AI processing with all tools
 * Uses WebSocket gateway for real-time message receiving
 */

import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";
import { processMessageWithAI } from "./shared-ai-processor.js";
import { WebSocket } from "ws";

type MessageHandler = (message: IncomingMessage) => void;

const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";

export class DiscordAdapter implements ChannelAdapter {
    name = "discord" as const;
    private token: string;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private ws: WebSocket | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private sessionId: string | null = null;
    private sequence: number | null = null;
    private botUserId: string | null = null;
    private aiProvider: any = null;
    private currentModel: string = "claude-sonnet-4-20250514";
    private resumeGatewayUrl: string | null = null;

    constructor(token: string) {
        this.token = token;
    }

    // Set AI provider for message processing
    setAIProvider(provider: any, model: string): void {
        this.aiProvider = provider;
        this.currentModel = model;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        if (!this.token) {
            throw new Error("Discord bot token not provided");
        }

        // Verify token
        const response = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bot ${this.token}` },
        });

        if (!response.ok) {
            throw new Error("Invalid Discord bot token");
        }

        const data = await response.json() as { id: string; username: string };
        this.botUserId = data.id;
        console.log(`[Discord] Bot verified: ${data.username} (${data.id})`);

        // Connect to gateway
        await this.connectGateway();
    }

    private async connectGateway(): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = this.resumeGatewayUrl || DISCORD_GATEWAY;
            this.ws = new WebSocket(url);

            this.ws.on("open", () => {
                console.log("[Discord] Gateway connected");
            });

            this.ws.on("message", async (data: Buffer) => {
                const payload = JSON.parse(data.toString());
                this.handleGatewayMessage(payload, resolve, reject);
            });

            this.ws.on("close", (code) => {
                console.log(`[Discord] Gateway closed: ${code}`);
                this.connected = false;
                if (this.heartbeatInterval) {
                    clearInterval(this.heartbeatInterval);
                }
                // Attempt reconnect
                if (code !== 1000) {
                    setTimeout(() => this.connectGateway(), 5000);
                }
            });

            this.ws.on("error", (err) => {
                console.error("[Discord] Gateway error:", err);
                reject(err);
            });
        });
    }

    private handleGatewayMessage(payload: any, resolve: () => void, _reject: (err: Error) => void): void {
        const { op, d, s, t } = payload;

        if (s) this.sequence = s;

        switch (op) {
            case 10: // Hello - start heartbeat
                const { heartbeat_interval } = d;
                this.startHeartbeat(heartbeat_interval);
                // Identify
                this.ws?.send(JSON.stringify({
                    op: 2,
                    d: {
                        token: this.token,
                        intents: 33281, // GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT + DIRECT_MESSAGES
                        properties: {
                            os: "linux",
                            browser: "openwhale",
                            device: "openwhale",
                        },
                    },
                }));
                break;

            case 0: // Dispatch
                this.handleDispatch(t, d);
                if (t === "READY") {
                    this.sessionId = d.session_id;
                    this.resumeGatewayUrl = d.resume_gateway_url;
                    this.connected = true;
                    console.log(`[Discord] Ready - Session: ${this.sessionId}`);
                    resolve();
                }
                break;

            case 1: // Heartbeat request
                this.sendHeartbeat();
                break;

            case 7: // Reconnect
                console.log("[Discord] Reconnect requested");
                this.ws?.close();
                break;

            case 9: // Invalid session
                console.log("[Discord] Invalid session, re-identifying...");
                this.sessionId = null;
                setTimeout(() => {
                    this.ws?.send(JSON.stringify({
                        op: 2,
                        d: {
                            token: this.token,
                            intents: 33281,
                            properties: { os: "linux", browser: "openwhale", device: "openwhale" },
                        },
                    }));
                }, 1000);
                break;

            case 11: // Heartbeat ACK
                break;
        }
    }

    private startHeartbeat(interval: number): void {
        // First heartbeat after random jitter
        setTimeout(() => this.sendHeartbeat(), interval * Math.random());
        // Regular heartbeats
        this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), interval);
    }

    private sendHeartbeat(): void {
        this.ws?.send(JSON.stringify({ op: 1, d: this.sequence }));
    }

    private async handleDispatch(type: string, data: any): Promise<void> {
        if (type === "MESSAGE_CREATE") {
            // Ignore bot's own messages
            if (data.author.id === this.botUserId) return;
            // Ignore other bots
            if (data.author.bot) return;

            const channelId = data.channel_id;
            const isGuild = !!data.guild_id;
            const content = data.content;

            // For guild messages, only respond to mentions
            if (isGuild) {
                const botMention = `<@${this.botUserId}>`;
                if (!content.includes(botMention)) return;
            }

            console.log(`[Discord] Message from ${data.author.username}: "${content.slice(0, 50)}..."`);

            const incoming: IncomingMessage = {
                id: data.id,
                channel: "discord",
                from: data.author.id,
                to: channelId,
                content: content.replace(/<@\d+>/g, "").trim(), // Remove mentions
                timestamp: new Date(data.timestamp),
                metadata: {
                    username: data.author.username,
                    guildId: data.guild_id,
                    channelId,
                },
            };

            // ========== EXTENSION HOOK ==========
            // Extensions subscribed to "discord" get ALL messages
            try {
                const { triggerChannelExtensions } = await import("../tools/extend.js");
                const extResult = await triggerChannelExtensions("discord", {
                    from: incoming.from,
                    content: incoming.content,
                    metadata: incoming.metadata as Record<string, unknown>
                });

                if (extResult.handled) {
                    console.log(`[Discord] Message handled by extension(s)`);
                    return; // Skip AI processing
                }
            } catch (extErr) {
                console.error("[Discord] Extension error:", extErr);
            }
            // =====================================

            // Process with AI
            if (this.aiProvider && incoming.content) {
                await processMessageWithAI({
                    channel: "discord",
                    from: incoming.from,
                    content: incoming.content,
                    aiProvider: this.aiProvider,
                    model: this.currentModel,
                    sendText: async (text) => {
                        return await this.send({ channel: "discord", to: channelId, content: text });
                    },
                    sendImage: async (imageBuffer, caption) => {
                        return await this.sendImage(channelId, imageBuffer, caption);
                    },
                    isGroup: isGuild,
                });
            } else {
                for (const handler of this.handlers) {
                    handler(incoming);
                }
            }
        }
    }

    async disconnect(): Promise<void> {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.ws) {
            this.ws.close(1000);
        }
        this.connected = false;
    }

    // Send text message
    async send(message: OutgoingMessage): Promise<SendResult> {
        try {
            const response = await fetch(`${DISCORD_API}/channels/${message.to}/messages`, {
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

    // Send image as attachment
    async sendImage(channelId: string, imageBuffer: Buffer, caption?: string): Promise<SendResult> {
        try {
            const formData = new FormData();
            formData.append("files[0]", new Blob([imageBuffer], { type: "image/png" }), "image.png");
            if (caption) {
                formData.append("payload_json", JSON.stringify({ content: caption }));
            }

            const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bot ${this.token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, error };
            }

            const data = await response.json() as { id: string };
            console.log(`[Discord] Image sent to ${channelId}`);
            return { success: true, messageId: data.id };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            console.error(`[Discord] Failed to send image: ${error}`);
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }
}

export function createDiscordAdapter(): DiscordAdapter | null {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return null;
    return new DiscordAdapter(token);
}
