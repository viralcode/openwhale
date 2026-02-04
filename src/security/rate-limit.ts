import type { Context, Next } from "hono";
import { createLogger } from "../utils/logger.js";

const log = createLogger("rate-limit");

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const stores: Map<string, RateLimitStore> = new Map();

export type RateLimitConfig = {
    name: string;
    limit: number;
    window: number; // seconds
    keyFn?: (c: Context) => string;
};

export function rateLimiter(config: RateLimitConfig) {
    const store: RateLimitStore = new Map();
    stores.set(config.name, store);

    // Cleanup old entries periodically
    setInterval(() => {
        const now = Date.now();
        for (const [key, data] of store.entries()) {
            if (data.resetAt < now) {
                store.delete(key);
            }
        }
    }, 60000);

    return async (c: Context, next: Next): Promise<Response | void> => {
        const key = config.keyFn?.(c) ?? getClientIP(c);
        const now = Date.now();

        let data = store.get(key);
        if (!data || data.resetAt < now) {
            data = { count: 0, resetAt: now + config.window * 1000 };
            store.set(key, data);
        }

        data.count++;

        // Set rate limit headers
        c.header("X-RateLimit-Limit", String(config.limit));
        c.header("X-RateLimit-Remaining", String(Math.max(0, config.limit - data.count)));
        c.header("X-RateLimit-Reset", String(Math.floor(data.resetAt / 1000)));

        if (data.count > config.limit) {
            log.warn("Rate limit exceeded", { key, limit: config.limit });
            return c.json(
                {
                    error: "rate_limit_exceeded",
                    message: `Too many requests. Limit: ${config.limit} per ${config.window}s`,
                    retryAfter: Math.ceil((data.resetAt - now) / 1000),
                },
                429
            );
        }

        await next();
    };
}

function getClientIP(c: Context): string {
    return (
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
        c.req.header("x-real-ip") ??
        "unknown"
    );
}

// Pre-configured rate limiters
export const apiRateLimiter = rateLimiter({
    name: "api",
    limit: 60,
    window: 60,
});

export const authRateLimiter = rateLimiter({
    name: "auth",
    limit: 10,
    window: 60,
});

export const chatRateLimiter = rateLimiter({
    name: "chat",
    limit: 30,
    window: 60,
});
