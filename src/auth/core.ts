import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as jose from "jose";
import type { DrizzleDB } from "../db/connection.js";
import type { OpenWhaleConfig } from "../config/loader.js";
import { users, apiKeys, refreshTokens } from "../db/schema.js";
import { eq, and, isNull } from "drizzle-orm";

export type TokenPayload = {
    sub: string; // user ID
    email: string;
    role: string;
    type: "access" | "refresh";
};

export type AuthResult = {
    ok: true;
    userId: string;
    email: string;
    role: string;
    method: "jwt" | "api-key" | "oauth";
} | {
    ok: false;
    reason: string;
};

// Password hashing using scrypt
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const hash = createHash("sha256").update(password + salt).digest("hex");
    return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [salt, storedHash] = stored.split(":");
    const hash = createHash("sha256").update(password + salt).digest("hex");
    return timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

// JWT tokens
export async function createAccessToken(
    payload: Omit<TokenPayload, "type">,
    config: OpenWhaleConfig
): Promise<string> {
    const secret = new TextEncoder().encode(config.security.jwt.secret);

    return new jose.SignJWT({ ...payload, type: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(config.security.jwt.expiresIn)
        .setSubject(payload.sub)
        .sign(secret);
}

export async function createRefreshToken(
    userId: string,
    config: OpenWhaleConfig,
    db: DrizzleDB
): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + parseExpiry(config.security.jwt.refreshExpiresIn));

    db.insert(refreshTokens).values({
        id: randomBytes(16).toString("hex"),
        userId,
        tokenHash,
        expiresAt,
    }).run();

    return token;
}

export async function verifyAccessToken(
    token: string,
    config: OpenWhaleConfig
): Promise<TokenPayload | null> {
    try {
        const secret = new TextEncoder().encode(config.security.jwt.secret);
        const { payload } = await jose.jwtVerify(token, secret);

        if (payload.type !== "access") return null;

        return {
            sub: payload.sub as string,
            email: payload.email as string,
            role: payload.role as string,
            type: "access",
        };
    } catch {
        return null;
    }
}

export async function verifyRefreshToken(
    token: string,
    db: DrizzleDB
): Promise<{ userId: string } | null> {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const record = db.select()
        .from(refreshTokens)
        .where(and(
            eq(refreshTokens.tokenHash, tokenHash),
            isNull(refreshTokens.revokedAt)
        ))
        .limit(1)
        .get();

    if (!record) return null;
    if (record.expiresAt < new Date()) return null;

    return { userId: record.userId };
}

// API Key validation
export async function validateApiKey(
    key: string,
    db: DrizzleDB
): Promise<AuthResult> {
    const keyHash = createHash("sha256").update(key).digest("hex");

    const record = db.select({
        apiKey: apiKeys,
        user: users,
    })
        .from(apiKeys)
        .innerJoin(users, eq(apiKeys.userId, users.id))
        .where(and(
            eq(apiKeys.keyHash, keyHash),
            isNull(apiKeys.revokedAt)
        ))
        .limit(1)
        .get();

    if (!record) {
        return { ok: false, reason: "invalid_api_key" };
    }

    if (record.apiKey.expiresAt && record.apiKey.expiresAt < new Date()) {
        return { ok: false, reason: "api_key_expired" };
    }

    // Update last used
    db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, record.apiKey.id))
        .run();

    return {
        ok: true,
        userId: record.user.id,
        email: record.user.email,
        role: record.user.role,
        method: "api-key",
    };
}

// Generate new API key
export async function generateApiKey(
    userId: string,
    name: string,
    scopes: string[],
    expiresAt: Date | null,
    db: DrizzleDB
): Promise<{ key: string; id: string }> {
    const key = `owk_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(key).digest("hex");
    const keyPrefix = key.slice(0, 12);
    const id = randomBytes(16).toString("hex");

    db.insert(apiKeys).values({
        id,
        userId,
        name,
        keyHash,
        keyPrefix,
        scopes,
        expiresAt,
    }).run();

    return { key, id };
}

function parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case "s": return value * 1000;
        case "m": return value * 60 * 1000;
        case "h": return value * 60 * 60 * 1000;
        case "d": return value * 24 * 60 * 60 * 1000;
        default: return 7 * 24 * 60 * 60 * 1000;
    }
}
