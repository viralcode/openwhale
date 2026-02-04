import { Hono } from "hono";
import type { DrizzleDB } from "../../db/connection.js";
import type { OpenWhaleConfig } from "../../config/loader.js";
import { requireAdmin } from "../../auth/middleware.js";
import { users, apiKeys, sessions, auditLogs } from "../../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { generateApiKey } from "../../auth/core.js";

export function createAdminRoutes(db: DrizzleDB, _config: OpenWhaleConfig) {
    const admin = new Hono();

    // All admin routes require admin role
    admin.use("*", requireAdmin);

    // Dashboard stats
    admin.get("/stats", async (c) => {
        const userCount = db.select({ count: sql<number>`count(*)` }).from(users).get();
        const sessionCount = db.select({ count: sql<number>`count(*)` }).from(sessions).get();
        const apiKeyCount = db.select({ count: sql<number>`count(*)` }).from(apiKeys).get();

        return c.json({
            users: userCount?.count ?? 0,
            sessions: sessionCount?.count ?? 0,
            apiKeys: apiKeyCount?.count ?? 0,
        });
    });

    // List users
    admin.get("/users", async (c) => {
        const limit = parseInt(c.req.query("limit") ?? "50");
        const offset = parseInt(c.req.query("offset") ?? "0");

        const allUsers = db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            createdAt: users.createdAt,
            lastLoginAt: users.lastLoginAt,
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset)
            .all();

        return c.json({ users: allUsers });
    });

    // Update user role
    admin.patch("/users/:userId", async (c) => {
        const userId = c.req.param("userId");
        const body = await c.req.json<{ role?: string; name?: string }>();

        const validRoles = ["admin", "user", "readonly", "api-client"] as const;
        type ValidRole = typeof validRoles[number];

        const updates: { role?: ValidRole; name?: string } = {};
        if (body.role && validRoles.includes(body.role as ValidRole)) {
            updates.role = body.role as ValidRole;
        }
        if (body.name) {
            updates.name = body.name;
        }

        if (Object.keys(updates).length === 0) {
            return c.json({ error: "no valid updates" }, 400);
        }

        db.update(users).set(updates).where(eq(users.id, userId)).run();

        return c.json({ ok: true });
    });

    // List API keys
    admin.get("/api-keys", async (c) => {
        const keys = db.select({
            id: apiKeys.id,
            userId: apiKeys.userId,
            name: apiKeys.name,
            keyPrefix: apiKeys.keyPrefix,
            scopes: apiKeys.scopes,
            createdAt: apiKeys.createdAt,
            lastUsedAt: apiKeys.lastUsedAt,
            expiresAt: apiKeys.expiresAt,
        })
            .from(apiKeys)
            .orderBy(desc(apiKeys.createdAt))
            .all();

        return c.json({ apiKeys: keys });
    });

    // Create API key for user
    admin.post("/api-keys", async (c) => {
        const body = await c.req.json<{
            userId: string;
            name: string;
            scopes?: string[];
            expiresInDays?: number;
        }>();

        const expiresAt = body.expiresInDays
            ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        const { key, id } = await generateApiKey(
            body.userId,
            body.name,
            body.scopes ?? [],
            expiresAt,
            db
        );

        return c.json({
            id,
            key, // Only shown once!
            message: "Save this key securely. It won't be shown again."
        });
    });

    // Revoke API key
    admin.delete("/api-keys/:keyId", async (c) => {
        const keyId = c.req.param("keyId");

        db.update(apiKeys)
            .set({ revokedAt: new Date() })
            .where(eq(apiKeys.id, keyId))
            .run();

        return c.json({ ok: true });
    });

    // Audit logs
    admin.get("/audit-logs", async (c) => {
        const limit = parseInt(c.req.query("limit") ?? "100");

        const logs = db.select()
            .from(auditLogs)
            .orderBy(desc(auditLogs.timestamp))
            .limit(limit)
            .all();

        return c.json({ logs });
    });

    return admin;
}
