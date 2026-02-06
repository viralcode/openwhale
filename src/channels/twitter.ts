/**
 * Twitter/X adapter using bird CLI
 * Supports: reading mentions, posting tweets, replying
 * Authentication: Cookie-based via bird CLI (no API keys needed)
 */

import { exec } from "child_process";
import { promisify } from "util";
import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";
import { processMessageWithAI } from "./shared-ai-processor.js";

const execAsync = promisify(exec);

type MessageHandler = (message: IncomingMessage) => void;

interface BirdMention {
    id: string;
    text: string;
    author: {
        id: string;
        username: string;
        name: string;
    };
    created_at: string;
    in_reply_to_tweet_id?: string;
}

export class TwitterAdapter implements ChannelAdapter {
    name = "twitter" as const;
    private connected = false;
    private handlers: MessageHandler[] = [];
    private pollingInterval?: ReturnType<typeof setTimeout>;
    private aiProvider: any = null;
    private currentModel: string = "claude-sonnet-4-20250514";
    private username: string = "";
    private lastMentionId: string = "";
    private pollIntervalMs: number;

    constructor(pollIntervalMs: number = 60000) {
        this.pollIntervalMs = pollIntervalMs;
    }

    // Set AI provider for message processing
    setAIProvider(provider: any, model: string): void {
        this.aiProvider = provider;
        this.currentModel = model;
    }

    isConnected(): boolean {
        return this.connected;
    }

    getUsername(): string {
        return this.username;
    }

    async connect(): Promise<void> {
        // Check if bird CLI is available
        try {
            await execAsync("which bird");
        } catch {
            throw new Error("bird CLI not found. Install with: npm install -g @steipete/bird");
        }

        // Check authentication via bird whoami
        try {
            const { stdout } = await execAsync("bird whoami --json");
            const whoami = JSON.parse(stdout);
            this.username = whoami.username || whoami.screen_name || "unknown";
            console.log(`[Twitter] Authenticated as @${this.username}`);
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            throw new Error(`Twitter authentication failed. Run 'bird check' to configure. Error: ${error}`);
        }

        this.connected = true;
        this.startPolling();
    }

    async disconnect(): Promise<void> {
        if (this.pollingInterval) {
            clearTimeout(this.pollingInterval);
        }
        this.connected = false;
    }

    // Send a tweet or reply
    async send(message: OutgoingMessage): Promise<SendResult> {
        try {
            let command: string;

            // If replying to a tweet
            if (message.replyTo) {
                command = `bird reply "${message.replyTo}" "${this.escapeForShell(message.content)}"`;
            } else {
                command = `bird tweet "${this.escapeForShell(message.content)}"`;
            }

            // Add media if present
            if (message.attachments?.length) {
                for (const attachment of message.attachments) {
                    if (attachment.type === "image" && attachment.url) {
                        command += ` --media "${attachment.url}"`;
                    }
                }
            }

            const { stdout } = await execAsync(command);
            console.log(`[Twitter] Tweet sent: ${message.content.slice(0, 50)}...`);

            // Try to parse the tweet ID from output
            try {
                const result = JSON.parse(stdout);
                return { success: true, messageId: result.id || result.id_str };
            } catch {
                return { success: true };
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            console.error(`[Twitter] Failed to send: ${error}`);
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    private escapeForShell(text: string): string {
        // Escape special characters for shell
        return text
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\$/g, "\\$")
            .replace(/`/g, "\\`");
    }

    private async startPolling(): Promise<void> {
        const poll = async () => {
            if (!this.connected) return;

            try {
                // Fetch mentions
                const { stdout } = await execAsync("bird mentions -n 10 --json");
                const mentions: BirdMention[] = JSON.parse(stdout);

                for (const mention of mentions) {
                    // Skip if we've already processed this mention
                    if (this.lastMentionId && mention.id <= this.lastMentionId) {
                        continue;
                    }

                    // Skip our own tweets
                    if (mention.author.username.toLowerCase() === this.username.toLowerCase()) {
                        continue;
                    }

                    console.log(`[Twitter] New mention from @${mention.author.username}: ${mention.text.slice(0, 50)}...`);

                    const incoming: IncomingMessage = {
                        id: mention.id,
                        channel: "twitter",
                        from: mention.author.username,
                        content: mention.text,
                        timestamp: new Date(mention.created_at),
                        replyTo: mention.in_reply_to_tweet_id,
                        metadata: {
                            authorId: mention.author.id,
                            authorName: mention.author.name,
                            tweetId: mention.id,
                        },
                    };

                    // Update last mention ID
                    if (!this.lastMentionId || mention.id > this.lastMentionId) {
                        this.lastMentionId = mention.id;
                    }

                    // Process with AI if provider available
                    if (this.aiProvider) {
                        await processMessageWithAI({
                            channel: "twitter",
                            from: mention.author.username,
                            content: mention.text,
                            aiProvider: this.aiProvider,
                            model: this.currentModel,
                            sendText: async (text) => {
                                // Reply to the tweet
                                return await this.send({
                                    channel: "twitter",
                                    to: mention.author.username,
                                    content: `@${mention.author.username} ${text}`,
                                    replyTo: mention.id,
                                });
                            },
                            sendImage: async (_imageBuffer, caption) => {
                                // TODO: Save image to temp file and send via bird --media
                                return await this.send({
                                    channel: "twitter",
                                    to: mention.author.username,
                                    content: `@${mention.author.username} ${caption || ""}`,
                                    replyTo: mention.id,
                                });
                            },
                            isGroup: false,
                        });
                    } else {
                        // Fallback: notify handlers
                        for (const handler of this.handlers) {
                            handler(incoming);
                        }
                    }
                }
            } catch (err) {
                // Don't spam logs if bird isn't configured
                if ((err as Error).message?.includes("Cookie")) {
                    console.error("[Twitter] Cookie authentication required. Run 'bird check' to configure.");
                } else {
                    console.error("[Twitter] Polling error:", (err as Error).message);
                }
            }

            // Continue polling
            if (this.connected) {
                this.pollingInterval = setTimeout(poll, this.pollIntervalMs);
            }
        };

        // Start polling
        poll();
    }
}

export function createTwitterAdapter(): TwitterAdapter | null {
    const enabled = process.env.TWITTER_ENABLED?.toLowerCase() === "true";
    if (!enabled) return null;

    const pollInterval = parseInt(process.env.TWITTER_POLL_INTERVAL || "60000", 10);
    return new TwitterAdapter(pollInterval);
}
