import type { Context, Next } from "hono";
import type { DrizzleDB } from "../db/connection.js";
import type { OpenWhaleConfig } from "../config/loader.js";
import { verifyAccessToken, validateApiKey, type AuthResult } from "./core.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

declare module "hono" {
    interface ContextVariableMap {
        user: {
            id: string;
            email: string;
            role: string;
            method: "jwt" | "api-key" | "oauth";
        };
    }
}

export function authMiddleware(db: DrizzleDB, config: OpenWhaleConfig) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        const authHeader = c.req.header("Authorization");
        const apiKeyHeader = c.req.header("X-API-Key");

        let authResult: AuthResult | null = null;

        // Try Bearer token (JWT)
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            const payload = await verifyAccessToken(token, config);

            if (payload) {
                // Verify user still exists and is active
                const [user] = await db.select()
                    .from(users)
                    .where(eq(users.id, payload.sub))
                    .limit(1);

                if (user) {
                    authResult = {
                        ok: true,
                        userId: user.id,
                        email: user.email,
                        role: user.role,
                        method: "jwt",
                    };
                }
            }
        }

        // Try API Key
        if (!authResult && apiKeyHeader) {
            authResult = await validateApiKey(apiKeyHeader, db);
        }

        // Also check query param for API key (for webhooks)
        if (!authResult) {
            const queryKey = c.req.query("api_key");
            if (queryKey) {
                authResult = await validateApiKey(queryKey, db);
            }
        }

        if (!authResult || !authResult.ok) {
            return c.json(
                {
                    error: "unauthorized",
                    message: authResult?.ok === false ? authResult.reason : "Missing or invalid authentication",
                },
                401
            );
        }

        // Set user in context
        c.set("user", {
            id: authResult.userId,
            email: authResult.email,
            role: authResult.role,
            method: authResult.method,
        });

        await next();
    };
}

// Role-based access control middleware
export function requireRole(...roles: string[]) {
    return async (c: Context, next: Next): Promise<Response | void> => {
        const user = c.get("user");

        if (!user) {
            return c.json({ error: "unauthorized" }, 401);
        }

        if (!roles.includes(user.role)) {
            return c.json({ error: "forbidden", message: `Required role: ${roles.join(" or ")}` }, 403);
        }

        await next();
    };
}

// Admin-only middleware
export const requireAdmin = requireRole("admin");
