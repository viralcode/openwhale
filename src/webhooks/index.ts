/**
 * Webhook System - Event notifications to external URLs
 */

export interface WebhookConfig {
    id: string;
    url: string;
    events: string[];  // message, tool_call, error, session_start, etc.
    secret?: string;   // For signature verification
    active: boolean;
    createdAt: Date;
    lastDelivery?: Date;
    failCount: number;
}

export interface WebhookPayload {
    event: string;
    timestamp: string;
    data: unknown;
}

// In-memory webhook registry
const webhooks = new Map<string, WebhookConfig>();

/**
 * Register a new webhook
 */
export function registerWebhook(config: Omit<WebhookConfig, "id" | "createdAt" | "failCount">): string {
    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    webhooks.set(id, {
        ...config,
        id,
        createdAt: new Date(),
        failCount: 0,
    });

    console.log(`[Webhooks] Registered: ${id} -> ${config.url}`);
    return id;
}

/**
 * Unregister a webhook
 */
export function unregisterWebhook(id: string): boolean {
    return webhooks.delete(id);
}

/**
 * List all registered webhooks
 */
export function listWebhooks(): WebhookConfig[] {
    return Array.from(webhooks.values());
}

/**
 * Send a webhook event
 */
export async function sendWebhook(event: string, data: unknown): Promise<void> {
    const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
    };

    const body = JSON.stringify(payload);

    for (const [id, webhook] of webhooks) {
        if (!webhook.active) continue;
        if (!webhook.events.includes(event) && !webhook.events.includes("*")) continue;

        // Send async - don't block
        deliverWebhook(id, webhook, body).catch(err => {
            console.error(`[Webhooks] Delivery failed for ${id}:`, err);
        });
    }
}

/**
 * Deliver webhook with retry
 */
async function deliverWebhook(id: string, webhook: WebhookConfig, body: string): Promise<void> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "OpenWhale-Webhook/1.0",
        "X-Webhook-ID": id,
    };

    // Add signature if secret is configured
    if (webhook.secret) {
        const crypto = await import("crypto");
        const signature = crypto
            .createHmac("sha256", webhook.secret)
            .update(body)
            .digest("hex");
        headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    try {
        const res = await fetch(webhook.url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (res.ok) {
            webhook.lastDelivery = new Date();
            webhook.failCount = 0;
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err) {
        webhook.failCount++;
        console.error(`[Webhooks] Failed (${webhook.failCount}): ${webhook.url}`, err);

        // Disable after 5 consecutive failures
        if (webhook.failCount >= 5) {
            webhook.active = false;
            console.warn(`[Webhooks] Disabled ${id} after 5 failures`);
        }
    }
}

// Convenience functions for common events
export const webhookEvents = {
    messageReceived: (from: string, content: string, channel: string) =>
        sendWebhook("message.received", { from, content, channel }),

    messageSent: (to: string, content: string, channel: string) =>
        sendWebhook("message.sent", { to, content, channel }),

    toolCalled: (toolName: string, args: unknown, result: unknown) =>
        sendWebhook("tool.called", { toolName, args, result }),

    error: (error: string, context?: unknown) =>
        sendWebhook("error", { error, context }),

    sessionStarted: (sessionId: string, channel: string) =>
        sendWebhook("session.started", { sessionId, channel }),
};
