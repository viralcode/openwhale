/**
 * Webhooks Automation
 * 
 * Inbound webhook handler for triggering agent actions.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

export interface WebhookConfig {
    id: string;
    name: string;
    secret?: string;
    sessionKey?: string;
    enabled: boolean;
    createdAt: number;
}

export interface WebhookPayload {
    webhookId: string;
    headers: Record<string, string>;
    body: unknown;
    query: Record<string, string>;
    timestamp: number;
}

// Webhook registry
const webhooks = new Map<string, WebhookConfig>();
const webhookEvents = new EventEmitter();

/**
 * Register a new webhook
 */
export function registerWebhook(config: Omit<WebhookConfig, "id" | "createdAt">): WebhookConfig {
    const webhook: WebhookConfig = {
        ...config,
        id: randomUUID().slice(0, 8),
        createdAt: Date.now(),
    };
    webhooks.set(webhook.id, webhook);
    console.log(`[Webhooks] Registered: ${webhook.id} (${webhook.name})`);
    return webhook;
}

/**
 * Get all registered webhooks
 */
export function listWebhooks(): WebhookConfig[] {
    return Array.from(webhooks.values());
}

/**
 * Get a webhook by ID
 */
export function getWebhook(id: string): WebhookConfig | undefined {
    return webhooks.get(id);
}

/**
 * Delete a webhook
 */
export function deleteWebhook(id: string): boolean {
    return webhooks.delete(id);
}

/**
 * Listen for webhook triggers
 */
export function onWebhook(handler: (payload: WebhookPayload) => void): () => void {
    webhookEvents.on("trigger", handler);
    return () => webhookEvents.off("trigger", handler);
}

/**
 * Trigger a webhook
 */
export function triggerWebhook(payload: WebhookPayload): void {
    webhookEvents.emit("trigger", payload);
}

/**
 * Validate webhook secret
 */
function validateSecret(webhook: WebhookConfig, providedSecret?: string): boolean {
    if (!webhook.secret) return true;
    return webhook.secret === providedSecret;
}

/**
 * Handle inbound webhook HTTP request
 */
export async function handleWebhookRequest(
    req: IncomingMessage,
    res: ServerResponse,
    webhookId: string
): Promise<boolean> {
    const webhook = webhooks.get(webhookId);

    if (!webhook) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Webhook not found" }));
        return true;
    }

    if (!webhook.enabled) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Webhook disabled" }));
        return true;
    }

    // Check secret
    const url = new URL(req.url || "/", "http://localhost");
    const providedSecret = url.searchParams.get("secret") || req.headers["x-webhook-secret"] as string;

    if (!validateSecret(webhook, providedSecret)) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Invalid secret" }));
        return true;
    }

    // Parse body
    let body: unknown = {};
    if (req.method === "POST" || req.method === "PUT") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(chunk as Buffer);
        }
        const raw = Buffer.concat(chunks).toString("utf-8");
        try {
            body = JSON.parse(raw);
        } catch {
            body = { raw };
        }
    }

    // Build payload
    const payload: WebhookPayload = {
        webhookId: webhook.id,
        headers: Object.fromEntries(
            Object.entries(req.headers)
                .filter(([_, v]) => typeof v === "string")
                .map(([k, v]) => [k, v as string])
        ),
        body,
        query: Object.fromEntries(url.searchParams.entries()),
        timestamp: Date.now(),
    };

    // Trigger
    triggerWebhook(payload);
    console.log(`[Webhooks] Triggered: ${webhook.id} (${webhook.name})`);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
        success: true,
        webhookId: webhook.id,
        timestamp: payload.timestamp,
    }));

    return true;
}

export default {
    registerWebhook,
    listWebhooks,
    getWebhook,
    deleteWebhook,
    onWebhook,
    handleWebhookRequest,
};
