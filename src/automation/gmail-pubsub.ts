/**
 * Gmail Pub/Sub Integration
 * 
 * Real-time email triggers via Google Pub/Sub.
 * Push notifications for new emails.
 */

import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface GmailMessage {
    messageId: string;
    historyId: string;
    emailAddress: string;
    timestamp: number;
}

export interface GmailPubSubConfig {
    projectId: string;
    subscriptionName: string;
    topicName: string;
    enabled: boolean;
}

const gmailEvents = new EventEmitter();
let config: GmailPubSubConfig | null = null;

/**
 * Initialize Gmail Pub/Sub
 */
export function initGmailPubSub(cfg: GmailPubSubConfig): void {
    config = cfg;
    console.log(`[Gmail] Pub/Sub initialized: ${cfg.topicName}`);
}

/**
 * Get current config
 */
export function getGmailConfig(): GmailPubSubConfig | null {
    return config;
}

/**
 * Listen for new emails
 */
export function onGmailMessage(handler: (msg: GmailMessage) => void): () => void {
    gmailEvents.on("message", handler);
    return () => gmailEvents.off("message", handler);
}

/**
 * Parse Google Pub/Sub push notification
 */
function parsePubSubMessage(body: unknown): GmailMessage | null {
    try {
        const payload = body as {
            message?: {
                data?: string;
                messageId?: string;
                publishTime?: string;
            };
        };

        if (!payload.message?.data) return null;

        // Decode base64 data
        const decoded = Buffer.from(payload.message.data, "base64").toString("utf-8");
        const data = JSON.parse(decoded) as {
            emailAddress?: string;
            historyId?: string;
        };

        return {
            messageId: payload.message.messageId || "",
            historyId: data.historyId || "",
            emailAddress: data.emailAddress || "",
            timestamp: payload.message.publishTime
                ? new Date(payload.message.publishTime).getTime()
                : Date.now(),
        };
    } catch (err) {
        console.error("[Gmail] Failed to parse Pub/Sub message:", err);
        return null;
    }
}

/**
 * Handle Gmail Pub/Sub push endpoint
 */
export async function handleGmailPushRequest(
    req: IncomingMessage,
    res: ServerResponse
): Promise<boolean> {
    if (!config?.enabled) {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Gmail Pub/Sub not enabled" }));
        return true;
    }

    if (req.method !== "POST") {
        res.statusCode = 405;
        res.end("Method not allowed");
        return true;
    }

    // Parse body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf-8");

    let body: unknown;
    try {
        body = JSON.parse(raw);
    } catch {
        res.statusCode = 400;
        res.end("Invalid JSON");
        return true;
    }

    const message = parsePubSubMessage(body);
    if (message) {
        console.log(`[Gmail] New email notification: ${message.emailAddress}`);
        gmailEvents.emit("message", message);
    }

    // Always return 200 to acknowledge
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ received: true }));
    return true;
}

/**
 * Setup Gmail watch for a user (requires OAuth)
 */
export async function setupGmailWatch(
    accessToken: string,
    topicName: string
): Promise<{ historyId: string; expiration: string } | null> {
    try {
        const response = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/watch",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    topicName,
                    labelIds: ["INBOX"],
                }),
            }
        );

        if (!response.ok) {
            console.error("[Gmail] Watch setup failed:", await response.text());
            return null;
        }

        return await response.json() as { historyId: string; expiration: string };
    } catch (err) {
        console.error("[Gmail] Watch setup error:", err);
        return null;
    }
}

export default {
    initGmailPubSub,
    getGmailConfig,
    onGmailMessage,
    handleGmailPushRequest,
    setupGmailWatch,
};
