import { Hono } from "hono";
import type { DrizzleDB } from "../../db/connection.js";
import type { OpenWhaleConfig } from "../../config/loader.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
    hashPassword,
    verifyPassword,
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken,
} from "../../auth/core.js";

export function createAuthRoutes(db: DrizzleDB, config: OpenWhaleConfig) {
    const auth = new Hono();

    // Register new user
    auth.post("/register", async (c) => {
        const body = await c.req.json<{ email: string; password: string; name?: string }>();

        if (!body.email || !body.password) {
            return c.json({ error: "email and password required" }, 400);
        }

        // Check if user exists
        const existing = db.select().from(users).where(eq(users.email, body.email)).limit(1).get();
        if (existing) {
            return c.json({ error: "user already exists" }, 409);
        }

        const passwordHash = await hashPassword(body.password);
        const userId = randomBytes(16).toString("hex");

        db.insert(users).values({
            id: userId,
            email: body.email,
            passwordHash,
            name: body.name,
            role: "user",
        }).run();

        const accessToken = await createAccessToken(
            { sub: userId, email: body.email, role: "user" },
            config
        );
        const refreshToken = await createRefreshToken(userId, config, db);

        return c.json({
            user: { id: userId, email: body.email, role: "user", name: body.name },
            accessToken,
            refreshToken,
        });
    });

    // Login
    auth.post("/login", async (c) => {
        const body = await c.req.json<{ email: string; password: string }>();

        if (!body.email || !body.password) {
            return c.json({ error: "email and password required" }, 400);
        }

        const user = db.select().from(users).where(eq(users.email, body.email)).limit(1).get();
        if (!user || !user.passwordHash) {
            return c.json({ error: "invalid credentials" }, 401);
        }

        const valid = await verifyPassword(body.password, user.passwordHash);
        if (!valid) {
            return c.json({ error: "invalid credentials" }, 401);
        }

        // Update last login
        db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run();

        const accessToken = await createAccessToken(
            { sub: user.id, email: user.email, role: user.role },
            config
        );
        const refreshToken = await createRefreshToken(user.id, config, db);

        return c.json({
            user: { id: user.id, email: user.email, role: user.role, name: user.name },
            accessToken,
            refreshToken,
        });
    });

    // Refresh token
    auth.post("/refresh", async (c) => {
        const body = await c.req.json<{ refreshToken: string }>();

        if (!body.refreshToken) {
            return c.json({ error: "refreshToken required" }, 400);
        }

        const result = await verifyRefreshToken(body.refreshToken, db);
        if (!result) {
            return c.json({ error: "invalid or expired refresh token" }, 401);
        }

        const user = db.select().from(users).where(eq(users.id, result.userId)).limit(1).get();
        if (!user) {
            return c.json({ error: "user not found" }, 404);
        }

        const accessToken = await createAccessToken(
            { sub: user.id, email: user.email, role: user.role },
            config
        );
        const newRefreshToken = await createRefreshToken(user.id, config, db);

        return c.json({
            accessToken,
            refreshToken: newRefreshToken,
        });
    });

    // Get current user (requires auth)
    auth.get("/me", async (c) => {
        const authHeader = c.req.header("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return c.json({ error: "unauthorized" }, 401);
        }

        const { verifyAccessToken } = await import("../../auth/core.js");
        const payload = await verifyAccessToken(authHeader.slice(7), config);
        if (!payload) {
            return c.json({ error: "invalid token" }, 401);
        }

        const user = db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
        }).from(users).where(eq(users.id, payload.sub)).limit(1).get();

        if (!user) {
            return c.json({ error: "user not found" }, 404);
        }

        return c.json({ user });
    });

    return auth;
}
