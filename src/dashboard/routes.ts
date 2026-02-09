/**
 * OpenWhale Dashboard Routes - Complete API
 * Setup wizard, chat, channels, providers, skills, configuration
 */

import { Hono } from "hono";
import type { DrizzleDB } from "../db/connection.js";
import type { OpenWhaleConfig } from "../config/loader.js";
import { sessions, users, messages, auditLogs } from "../db/schema.js";
import { providerConfig, skillConfig, channelConfig, setupState as setupStateTable, dashboardUsers, authSessions } from "../db/config-schema.js";
import { db as sqliteDb } from "../db/index.js";
import { desc, sql, eq } from "drizzle-orm";
import { readFileSync, existsSync } from "node:fs";
import fs from "node:fs/promises";
import { join, dirname } from "node:path";
import { logger, logEmitter } from "../logger.js";
import { fileURLToPath } from "node:url";
import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID, createHash } from "node:crypto";
import {
    setModel,
    processMessage as processSessionMessage,
    processMessageStream as processSessionMessageStream,
    processCommand as processSessionCommand,
    getChatHistory,
    clearChatHistory,
} from "../sessions/session-service.js";
import { registry } from "../providers/index.js";
import { createAnthropicProvider } from "../providers/anthropic.js";
import { createOpenAIProvider, createDeepSeekProvider } from "../providers/openai-compatible.js";
import { createGoogleProvider } from "../providers/google.js";
import { getCanvasHTML, injectCanvasScripts, canvasPush, canvasReset, canvasEval } from "../canvas/index.js";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

const configStore = new Map<string, unknown>();
const setupState = { completed: false, currentStep: 0, stepsCompleted: [] as string[] };

// In-memory caches for configs (synced with DB)
const providerConfigs = new Map<string, { enabled: boolean; apiKey?: string; baseUrl?: string; selectedModel?: string }>();
const skillConfigs = new Map<string, { enabled: boolean; apiKey?: string }>();
const channelConfigs = new Map<string, { enabled: boolean; connected: boolean; settings?: unknown }>();

// ============ DATABASE PERSISTENCE HELPERS ============

export async function loadConfigsFromDB(db: DrizzleDB) {
    try {
        // Load providers
        const providers = await db.select().from(providerConfig);
        for (const p of providers) {
            providerConfigs.set(p.type, {
                enabled: p.enabled ?? false,
                apiKey: p.apiKey ?? undefined,
                baseUrl: p.baseUrl ?? undefined,
                selectedModel: p.defaultModel ?? undefined
            });
            console.log(`[Dashboard] Loaded provider ${p.type}: enabled=${p.enabled}, hasKey=${!!p.apiKey}`);
            // Set environment variables for AI providers
            if (p.apiKey) {
                if (p.type === "anthropic") process.env.ANTHROPIC_API_KEY = p.apiKey;
                if (p.type === "openai") process.env.OPENAI_API_KEY = p.apiKey;
                if (p.type === "google") process.env.GOOGLE_API_KEY = p.apiKey;
                if (p.type === "deepseek") process.env.DEEPSEEK_API_KEY = p.apiKey;
            }
        }

        // Load skills
        const skills = await db.select().from(skillConfig);
        for (const s of skills) {
            skillConfigs.set(s.id, {
                enabled: s.enabled ?? false,
                apiKey: s.apiKey ?? undefined
            });
            // Set environment variables so skills can access them
            if (s.apiKey) {
                if (s.id === "github") process.env.GITHUB_TOKEN = s.apiKey;
                if (s.id === "weather") process.env.OPENWEATHERMAP_API_KEY = s.apiKey;
                if (s.id === "notion") process.env.NOTION_API_KEY = s.apiKey;
                if (s.id === "1password") process.env.OP_SERVICE_ACCOUNT_TOKEN = s.apiKey;
                if (s.id === "elevenlabs") process.env.ELEVENLABS_API_KEY = s.apiKey;
                // Twilio stores JSON-encoded credentials: {sid, authToken, phone}
                if (s.id === "twilio") {
                    try {
                        const creds = JSON.parse(s.apiKey);
                        if (creds.sid) process.env.TWILIO_ACCOUNT_SID = creds.sid;
                        if (creds.authToken) process.env.TWILIO_AUTH_TOKEN = creds.authToken;
                        if (creds.phone) process.env.TWILIO_FROM_NUMBER = creds.phone;
                    } catch {
                        // Legacy: treat as plain SID if not JSON
                        process.env.TWILIO_ACCOUNT_SID = s.apiKey;
                    }
                }
            }
            // Handle Twitter enablement (no API key needed, uses bird CLI)
            if (s.id === "twitter" && s.enabled) {
                process.env.TWITTER_ENABLED = "true";
            }
        }

        // Load channels
        const channels = await db.select().from(channelConfig);
        for (const c of channels) {
            channelConfigs.set(c.type, {
                enabled: c.enabled ?? false,
                connected: c.connectedAt !== null,
                settings: c.settings ?? undefined
            });
            // Set environment variables for bot tokens
            if (c.credentials) {
                if (c.type === "telegram" && c.credentials.botToken) {
                    process.env.TELEGRAM_BOT_TOKEN = c.credentials.botToken;
                }
                if (c.type === "discord" && c.credentials.botToken) {
                    process.env.DISCORD_BOT_TOKEN = c.credentials.botToken;
                }
            }

            // Auto-reconnect iMessage if it was previously enabled (macOS only)
            if (c.type === "imessage" && c.enabled && process.platform === "darwin") {
                (async () => {
                    try {
                        const { execSync } = await import("node:child_process");
                        execSync("which imsg", { stdio: "ignore", env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.cargo/bin:${process.env.PATH}` } });

                        const { createIMessageAdapter } = await import("../channels/imessage/adapter.js");
                        const imessage = createIMessageAdapter();
                        if (imessage) {
                            await imessage.connect();
                            const { channelRegistry } = await import("../channels/base.js");
                            channelRegistry.register(imessage);
                            channelConfigs.set("imessage", { ...channelConfigs.get("imessage")!, connected: true });
                            console.log("[Dashboard] ✓ iMessage auto-reconnected from saved config");
                        }
                    } catch (e) {
                        console.log("[Dashboard] iMessage auto-reconnect skipped:", e instanceof Error ? e.message : String(e));
                    }
                })();
            }
        }

        // Load setup state
        const setup = await db.select().from(setupStateTable).limit(1);
        if (setup.length > 0) {
            setupState.completed = setup[0].completed ?? false;
            setupState.currentStep = setup[0].currentStep ?? 0;
            setupState.stepsCompleted = setup[0].stepsCompleted ?? [];
        }

        // Load general config using raw SQL
        try {
            const configs = sqliteDb.prepare("SELECT key, value FROM config").all() as { key: string, value: string }[];
            for (const c of configs) {
                configStore.set(c.key, c.value);
            }
            if (configStore.has("defaultModel")) {
                console.log(`[Dashboard] Default model: ${configStore.get("defaultModel")}`);
            }
        } catch {
            // Table might not exist yet, that's ok
        }

        // Sync the session-service's currentModel with the enabled provider
        // so channels (WhatsApp, Telegram, etc.) use the correct provider
        for (const [type, config] of providerConfigs.entries()) {
            if (config.enabled && config.apiKey) {
                const model = config.selectedModel || configStore.get("defaultModel") as string || "";
                setModel(model);
                console.log(`[Dashboard] Set active model to ${model} (provider: ${type})`);
                logger.info("provider", `Active model set to ${model}`, { provider: type });
                break;
            }
        }

        console.log("[Dashboard] Loaded configs from database");
    } catch (e) {
        console.error("[Dashboard] Failed to load configs from DB:", e);
    }
}

async function saveProviderToDB(db: DrizzleDB, type: string, cfg: { enabled: boolean; apiKey?: string; baseUrl?: string }) {
    try {
        console.log(`[Dashboard] Saving provider ${type} to database...`);
        await db.insert(providerConfig)
            .values({
                id: type,
                type,
                name: type.charAt(0).toUpperCase() + type.slice(1),
                enabled: cfg.enabled,
                apiKey: cfg.apiKey,
                baseUrl: cfg.baseUrl,
                defaultModel: (cfg as any).selectedModel
            })
            .onConflictDoUpdate({
                target: providerConfig.id,
                set: {
                    enabled: cfg.enabled,
                    apiKey: cfg.apiKey,
                    baseUrl: cfg.baseUrl,
                    defaultModel: (cfg as any).selectedModel
                }
            });
        console.log(`[Dashboard] ✓ Provider ${type} saved to database`);
    } catch (e) {
        console.error(`[Dashboard] Failed to save provider config for ${type}:`, e);
    }
}

async function saveSkillToDB(db: DrizzleDB, id: string, cfg: { enabled: boolean; apiKey?: string }) {
    try {
        await db.insert(skillConfig)
            .values({
                id,
                name: id.charAt(0).toUpperCase() + id.slice(1),
                enabled: cfg.enabled,
                apiKey: cfg.apiKey
            })
            .onConflictDoUpdate({
                target: skillConfig.id,
                set: { enabled: cfg.enabled, apiKey: cfg.apiKey }
            });
    } catch (e) {
        console.error("[Dashboard] Failed to save skill config:", e);
    }
}

async function saveChannelToDB(db: DrizzleDB, type: string, cfg: { enabled: boolean; connected: boolean; credentials?: Record<string, string> }) {
    try {
        await db.insert(channelConfig)
            .values({
                id: type,
                type,
                displayName: type.charAt(0).toUpperCase() + type.slice(1),
                enabled: cfg.enabled,
                credentials: cfg.credentials,
                connectedAt: cfg.connected ? new Date() : null
            })
            .onConflictDoUpdate({
                target: channelConfig.id,
                set: {
                    enabled: cfg.enabled,
                    credentials: cfg.credentials,
                    connectedAt: cfg.connected ? new Date() : null
                }
            });
    } catch (e) {
        console.error("[Dashboard] Failed to save channel config:", e);
    }
}

async function saveSetupStateToDB(db: DrizzleDB) {
    try {
        const existing = await db.select().from(setupStateTable).limit(1);
        if (existing.length > 0) {
            await db.update(setupStateTable)
                .set({
                    completed: setupState.completed,
                    currentStep: setupState.currentStep,
                    stepsCompleted: setupState.stepsCompleted,
                    completedAt: setupState.completed ? new Date() : null
                })
                .where(eq(setupStateTable.id, existing[0].id));
        } else {
            await db.insert(setupStateTable).values({
                completed: setupState.completed,
                currentStep: setupState.currentStep,
                stepsCompleted: setupState.stepsCompleted
            });
        }
    } catch (e) {
        console.error("[Dashboard] Failed to save setup state:", e);
    }
}



// Initialize default channels
channelConfigs.set("whatsapp", { enabled: true, connected: false });
channelConfigs.set("telegram", { enabled: false, connected: false });
channelConfigs.set("discord", { enabled: false, connected: false });
channelConfigs.set("slack", { enabled: false, connected: false });
channelConfigs.set("web", { enabled: true, connected: true });

// Check if setup was previously completed (from env vars)
if (process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) {
    setupState.completed = true;
    setupState.currentStep = 6;

    if (process.env.ANTHROPIC_API_KEY) {
        providerConfigs.set("anthropic", { enabled: true, apiKey: process.env.ANTHROPIC_API_KEY });
    }
    if (process.env.OPENAI_API_KEY) {
        providerConfigs.set("openai", { enabled: true, apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.GOOGLE_API_KEY) {
        providerConfigs.set("google", { enabled: true, apiKey: process.env.GOOGLE_API_KEY });
    }
}

export function createDashboardRoutes(db: DrizzleDB, _config: OpenWhaleConfig) {
    const dashboard = new Hono();

    // ============== AUTH HELPERS ==============

    function hashPassword(password: string): string {
        return createHash("sha256").update(password).digest("hex");
    }

    async function validateSession(sessionId: string | undefined): Promise<{ userId: string; username: string; role: string } | null> {
        if (!sessionId) return null;
        try {
            const session = await db.select().from(authSessions).where(eq(authSessions.id, sessionId)).limit(1);
            if (!session.length || !session[0].expiresAt || new Date(session[0].expiresAt) < new Date()) {
                return null;
            }
            const user = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, session[0].userId)).limit(1);
            if (!user.length) return null;
            return { userId: user[0].id, username: user[0].username, role: user[0].role || "user" };
        } catch {
            return null;
        }
    }

    async function ensureAuthTables(): Promise<void> {
        try {
            // Create dashboard_users table if not exists
            await db.run(sql`
                CREATE TABLE IF NOT EXISTS dashboard_users (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at INTEGER,
                    last_login_at INTEGER
                )
            `);

            // Create auth_sessions table if not exists
            await db.run(sql`
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    created_at INTEGER
                )
            `);
        } catch (e) {
            console.error("[Dashboard] Failed to create auth tables:", e);
        }
    }

    async function ensureDefaultAdmin(): Promise<void> {
        try {
            // First ensure tables exist
            await ensureAuthTables();

            const existing = await db.select().from(dashboardUsers).limit(1);
            if (!existing.length) {
                await db.insert(dashboardUsers).values({
                    id: randomUUID(),
                    username: "admin",
                    passwordHash: hashPassword("admin"),
                    role: "admin",
                });
                console.log("[Dashboard] Created default admin user (admin/admin)");
            }
        } catch (e) {
            console.error("[Dashboard] Failed to create default admin:", e);
        }
    }

    // Load configs from database on startup
    loadConfigsFromDB(db).then(() => {
        console.log("[Dashboard] ✅ Configs loaded, env vars set for skills");
        console.log("[Dashboard] GITHUB_TOKEN:", process.env.GITHUB_TOKEN ? "Set" : "Not set");
    }).catch((e) => {
        console.error("[Dashboard] Failed to load configs:", e);
    });

    // Create default admin on startup
    ensureDefaultAdmin();

    // ============== AUTH ROUTES (no auth required) ==============

    dashboard.post("/api/auth/login", async (c) => {
        try {
            const { username, password } = await c.req.json();
            if (!username || !password) {
                return c.json({ ok: false, error: "Username and password required" }, 400);
            }

            const user = await db.select().from(dashboardUsers).where(eq(dashboardUsers.username, username)).limit(1);
            if (!user.length || user[0].passwordHash !== hashPassword(password)) {
                return c.json({ ok: false, error: "Invalid username or password" }, 401);
            }

            // Create session (7 days)
            const sessionId = randomUUID();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            await db.insert(authSessions).values({
                id: sessionId,
                userId: user[0].id,
                expiresAt,
            });

            // Update last login
            await db.update(dashboardUsers).set({ lastLoginAt: new Date() }).where(eq(dashboardUsers.id, user[0].id));

            return c.json({ ok: true, sessionId, user: { username: user[0].username, role: user[0].role } });
        } catch (e) {
            console.error("[Dashboard] Login error:", e);
            return c.json({ ok: false, error: "Login failed" }, 500);
        }
    });

    dashboard.post("/api/auth/logout", async (c) => {
        const sessionId = c.req.header("Authorization")?.replace("Bearer ", "");
        if (sessionId) {
            await db.delete(authSessions).where(eq(authSessions.id, sessionId));
        }
        return c.json({ ok: true });
    });

    dashboard.get("/api/auth/me", async (c) => {
        const sessionId = c.req.header("Authorization")?.replace("Bearer ", "");
        const user = await validateSession(sessionId);
        if (!user) {
            return c.json({ ok: false, error: "Not authenticated" }, 401);
        }
        return c.json({ ok: true, user });
    });

    dashboard.post("/api/auth/change-password", async (c) => {
        const sessionId = c.req.header("Authorization")?.replace("Bearer ", "");
        const user = await validateSession(sessionId);
        if (!user) {
            return c.json({ ok: false, error: "Not authenticated" }, 401);
        }

        const { currentPassword, newPassword } = await c.req.json();
        if (!currentPassword || !newPassword) {
            return c.json({ ok: false, error: "Current and new passwords required" }, 400);
        }

        const dbUser = await db.select().from(dashboardUsers).where(eq(dashboardUsers.id, user.userId)).limit(1);
        if (!dbUser.length || dbUser[0].passwordHash !== hashPassword(currentPassword)) {
            return c.json({ ok: false, error: "Current password is incorrect" }, 401);
        }

        await db.update(dashboardUsers).set({ passwordHash: hashPassword(newPassword) }).where(eq(dashboardUsers.id, user.userId));
        return c.json({ ok: true, message: "Password changed successfully" });
    });

    // ============== USER MANAGEMENT (admin only) ==============

    dashboard.get("/api/users", async (c) => {
        const sessionId = c.req.header("Authorization")?.replace("Bearer ", "");
        const user = await validateSession(sessionId);
        if (!user || user.role !== "admin") {
            return c.json({ ok: false, error: "Admin access required" }, 403);
        }

        const users = await db.select({
            id: dashboardUsers.id,
            username: dashboardUsers.username,
            role: dashboardUsers.role,
            createdAt: dashboardUsers.createdAt,
            lastLoginAt: dashboardUsers.lastLoginAt,
        }).from(dashboardUsers);

        return c.json({ ok: true, users });
    });

    dashboard.post("/api/users", async (c) => {
        const sessionId = c.req.header("Authorization")?.replace("Bearer ", "");
        const user = await validateSession(sessionId);
        if (!user || user.role !== "admin") {
            return c.json({ ok: false, error: "Admin access required" }, 403);
        }

        const { username, password, role = "user" } = await c.req.json();
        if (!username || !password) {
            return c.json({ ok: false, error: "Username and password required" }, 400);
        }

        // Check if username exists
        const existing = await db.select().from(dashboardUsers).where(eq(dashboardUsers.username, username)).limit(1);
        if (existing.length) {
            return c.json({ ok: false, error: "Username already exists" }, 400);
        }

        const newUser = {
            id: randomUUID(),
            username,
            passwordHash: hashPassword(password),
            role,
        };

        await db.insert(dashboardUsers).values(newUser);
        return c.json({ ok: true, user: { id: newUser.id, username, role } });
    });

    dashboard.delete("/api/users/:id", async (c) => {
        const sessionId = c.req.header("Authorization")?.replace("Bearer ", "");
        const user = await validateSession(sessionId);
        if (!user || user.role !== "admin") {
            return c.json({ ok: false, error: "Admin access required" }, 403);
        }

        const userId = c.req.param("id");

        // Prevent deleting yourself
        if (userId === user.userId) {
            return c.json({ ok: false, error: "Cannot delete your own account" }, 400);
        }

        await db.delete(authSessions).where(eq(authSessions.userId, userId));
        await db.delete(dashboardUsers).where(eq(dashboardUsers.id, userId));
        return c.json({ ok: true });
    });

    // ============== STATIC FILES ==============

    dashboard.get("/assets/style.css", (c) => {
        const css = readFileSync(join(__dirname, "style.css"), "utf-8");
        return c.text(css, 200, { "Content-Type": "text/css" });
    });

    dashboard.get("/assets/main.js", (c) => {
        const js = readFileSync(join(__dirname, "main.js"), "utf-8");
        return c.text(js, 200, { "Content-Type": "application/javascript", "Cache-Control": "no-cache, no-store, must-revalidate" });
    });

    // ============== CANVAS / A2UI ==============

    dashboard.get("/__openwhale__/canvas", (c) => {
        const html = injectCanvasScripts(getCanvasHTML());
        return c.html(html);
    });

    dashboard.get("/__openwhale__/a2ui", (c) => {
        const html = injectCanvasScripts(getCanvasHTML());
        return c.html(html);
    });

    dashboard.post("/__openwhale__/canvas/push", async (c) => {
        const { html } = await c.req.json();
        canvasPush(html);
        return c.json({ ok: true });
    });

    dashboard.post("/__openwhale__/canvas/reset", (c) => {
        canvasReset();
        return c.json({ ok: true });
    });

    dashboard.post("/__openwhale__/canvas/eval", async (c) => {
        const { code } = await c.req.json();
        canvasEval(code);
        return c.json({ ok: true });
    });

    // ============== SETUP WIZARD ==============

    // Get setup status
    dashboard.get("/api/setup/status", (c) => {
        return c.json({
            completed: setupState.completed,
            currentStep: setupState.currentStep,
            stepsCompleted: setupState.stepsCompleted,
            config: {
                hasAnthropic: providerConfigs.has("anthropic"),
                hasOpenAI: providerConfigs.has("openai"),
                hasGoogle: providerConfigs.has("google"),
            }
        });
    });

    // Check prerequisites
    dashboard.get("/api/setup/prerequisites", async (c) => {
        const prereqs: Record<string, { installed: boolean; version?: string }> = {};

        // Node.js (always installed if running this)
        try {
            const nodeVersion = execSync("node --version", { encoding: "utf-8" }).trim();
            prereqs.node = { installed: true, version: nodeVersion };
        } catch { prereqs.node = { installed: false }; }

        // pnpm (recommended package manager)
        try {
            const pnpmVersion = execSync("pnpm --version", { encoding: "utf-8" }).trim();
            prereqs.pnpm = { installed: true, version: `v${pnpmVersion}` };
        } catch { prereqs.pnpm = { installed: false }; }

        // Git (for git tool, version control)
        try {
            const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
            prereqs.git = { installed: true, version: gitVersion.replace("git version ", "") };
        } catch { prereqs.git = { installed: false }; }

        // Python (for code_exec tool)
        try {
            const pythonVersion = execSync("python3 --version", { encoding: "utf-8" }).trim();
            prereqs.python = { installed: true, version: pythonVersion };
        } catch { prereqs.python = { installed: false }; }

        // Homebrew (for installing other tools)
        try {
            execSync("which brew", { stdio: "ignore" });
            prereqs.homebrew = { installed: true };
        } catch { prereqs.homebrew = { installed: false }; }

        // FFmpeg (screen recording, audio/video)
        try {
            execSync("which ffmpeg", { stdio: "ignore" });
            prereqs.ffmpeg = { installed: true };
        } catch { prereqs.ffmpeg = { installed: false }; }

        // ImageSnap (macOS camera capture)
        try {
            execSync("which imagesnap", { stdio: "ignore" });
            prereqs.imagesnap = { installed: true };
        } catch { prereqs.imagesnap = { installed: false }; }

        // Docker (container management)
        try {
            const dockerVersion = execSync("docker --version", { encoding: "utf-8" }).trim();
            prereqs.docker = { installed: true, version: dockerVersion.replace("Docker version ", "").split(",")[0] };
        } catch { prereqs.docker = { installed: false }; }

        // Playwright / Chromium (browser automation)
        try {
            prereqs.playwright = { installed: existsSync(join(process.cwd(), "node_modules", "playwright")) };
        } catch { prereqs.playwright = { installed: false }; }

        // SSH client
        try {
            execSync("which ssh", { stdio: "ignore" });
            prereqs.ssh = { installed: true };
        } catch { prereqs.ssh = { installed: false }; }

        return c.json(prereqs);
    });

    // Test AI provider
    dashboard.post("/api/setup/test-ai", async (c) => {
        const { provider, apiKey } = await c.req.json();

        try {
            if (provider === "anthropic" && apiKey) {
                const res = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": apiKey,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 50,
                        messages: [{ role: "user", content: "Say 'Hello! I am working correctly.' in exactly those words." }],
                    }),
                });

                if (!res.ok) {
                    const err = await res.text();
                    return c.json({ ok: false, error: `API error: ${err}` });
                }

                const data = await res.json() as { content: Array<{ text: string }> };
                return c.json({ ok: true, message: data.content[0]?.text || "AI responded!" });
            } else if (provider === "openai" && apiKey) {
                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        max_tokens: 50,
                        messages: [{ role: "user", content: "Say 'Hello! I am working correctly.' in exactly those words." }],
                    }),
                });

                if (!res.ok) {
                    const err = await res.text();
                    return c.json({ ok: false, error: `API error: ${err}` });
                }

                const data = await res.json() as { choices: Array<{ message: { content: string } }> };
                return c.json({ ok: true, message: data.choices[0]?.message?.content || "AI responded!" });
            } else if (provider === "google" && apiKey) {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: "Say 'Hello! I am working correctly.' in exactly those words." }] }],
                    }),
                });

                if (!res.ok) {
                    const err = await res.text();
                    return c.json({ ok: false, error: `API error: ${err}` });
                }

                const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
                return c.json({ ok: true, message: data.candidates?.[0]?.content?.parts?.[0]?.text || "AI responded!" });
            } else if (provider === "deepseek" && apiKey) {
                const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        max_tokens: 50,
                        messages: [{ role: "user", content: "Say 'Hello! I am working correctly.' in exactly those words." }],
                    }),
                });

                if (!res.ok) {
                    const err = await res.text();
                    return c.json({ ok: false, error: `API error: ${err}` });
                }

                const data = await res.json() as { choices: Array<{ message: { content: string } }> };
                return c.json({ ok: true, message: data.choices[0]?.message?.content || "AI responded!" });
            } else if (provider === "ollama" && apiKey) {
                const baseUrl = apiKey.replace(/\/$/, "");
                const res = await fetch(`${baseUrl}/api/tags`);

                if (!res.ok) {
                    return c.json({ ok: false, error: `Cannot reach Ollama at ${baseUrl}` });
                }

                const data = await res.json() as { models?: Array<{ name: string }> };
                const modelCount = data.models?.length || 0;
                return c.json({ ok: true, message: `Ollama connected! ${modelCount} model${modelCount !== 1 ? 's' : ''} available.` });
            }

            return c.json({ ok: false, error: "Provider not supported for testing" });
        } catch (e) {
            return c.json({ ok: false, error: String(e) });
        }
    });

    // Install prerequisite
    dashboard.post("/api/setup/install/:tool", async (c) => {
        const tool = c.req.param("tool");

        try {
            await execAsync(`brew install ${tool}`);
            return c.json({ ok: true, message: `${tool} installed successfully` });
        } catch (e) {
            return c.json({ ok: false, error: String(e) }, 500);
        }
    });

    // Save setup step
    dashboard.post("/api/setup/step/:step", async (c) => {
        const step = parseInt(c.req.param("step"));
        const data = await c.req.json();

        setupState.currentStep = step + 1;
        setupState.stepsCompleted.push(`step_${step}`);

        // Process step data
        if (data.providers) {
            for (const [type, config] of Object.entries(data.providers)) {
                const cfg = config as { apiKey?: string; enabled?: boolean };
                if (cfg.apiKey) {
                    providerConfigs.set(type, {
                        enabled: cfg.enabled ?? true,
                        apiKey: cfg.apiKey,
                        selectedModel: (config as any).selectedModel
                    });
                    // Also set environment variable for immediate use
                    if (type === "anthropic") process.env.ANTHROPIC_API_KEY = cfg.apiKey;
                    if (type === "openai") process.env.OPENAI_API_KEY = cfg.apiKey;
                    if (type === "google") process.env.GOOGLE_API_KEY = cfg.apiKey;
                    if (type === "deepseek") process.env.DEEPSEEK_API_KEY = cfg.apiKey;

                    // Persist to database
                    await saveProviderToDB(db, type, providerConfigs.get(type)!);
                }
            }
        }

        if (data.channels) {
            for (const [type, enabled] of Object.entries(data.channels)) {
                const existing = channelConfigs.get(type) || { enabled: false, connected: false };
                channelConfigs.set(type, { ...existing, enabled: enabled as boolean });
                // Persist to database
                await saveChannelToDB(db, type, channelConfigs.get(type)!);
            }
        }

        if (data.skills) {
            for (const [id, config] of Object.entries(data.skills)) {
                const cfg = config as { apiKey?: string; enabled?: boolean };
                if (cfg.apiKey) {
                    skillConfigs.set(id, { enabled: cfg.enabled ?? true, apiKey: cfg.apiKey });
                    // Set env vars
                    if (id === "github") process.env.GITHUB_TOKEN = cfg.apiKey;
                    if (id === "weather") process.env.OPENWEATHERMAP_API_KEY = cfg.apiKey;
                    if (id === "spotify") process.env.SPOTIFY_CLIENT_SECRET = cfg.apiKey;
                    if (id === "notion") process.env.NOTION_API_KEY = cfg.apiKey;
                    // Persist to database
                    await saveSkillToDB(db, id, skillConfigs.get(id)!);
                }
            }
        }

        if (data.completed) {
            setupState.completed = true;
            // Persist setup state to database
            await saveSetupStateToDB(db);
        }

        return c.json({ ok: true, currentStep: setupState.currentStep });
    });

    // Reset setup
    dashboard.post("/api/setup/reset", (c) => {
        setupState.completed = false;
        setupState.currentStep = 0;
        setupState.stepsCompleted = [];
        providerConfigs.clear();
        skillConfigs.clear();
        return c.json({ ok: true });
    });

    // ============== CHAT ==============

    // Get chat history
    dashboard.get("/api/chat/history", (c) => {
        return c.json({ messages: getChatHistory(100) });
    });

    // Clear chat history
    dashboard.delete("/api/chat/history", (c) => {
        clearChatHistory();
        return c.json({ success: true, message: "Chat history cleared" });
    });

    // Download a file created by tools
    dashboard.get("/api/files/download", async (c) => {
        const filePath = c.req.query("path");
        if (!filePath) {
            return c.json({ error: "Missing path parameter" }, 400);
        }

        const { resolve, basename, extname } = await import("node:path");
        const resolved = resolve(filePath);
        const cwd = process.cwd();

        // Security: only allow files within workspace
        if (!resolved.startsWith(cwd)) {
            return c.json({ error: "Access denied: path outside workspace" }, 403);
        }

        try {
            const fileBuffer = await fs.readFile(resolved);
            const fileName = basename(resolved);
            const ext = extname(resolved).toLowerCase();

            // MIME type mapping
            const mimeTypes: Record<string, string> = {
                ".pdf": "application/pdf",
                ".md": "text/markdown",
                ".txt": "text/plain",
                ".json": "application/json",
                ".csv": "text/csv",
                ".html": "text/html",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
            };

            const contentType = mimeTypes[ext] || "application/octet-stream";

            return new Response(fileBuffer, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="${fileName}"`,
                    "Content-Length": String(fileBuffer.length),
                },
            });
        } catch (err) {
            return c.json({ error: `File not found: ${filePath}` }, 404);
        }
    });

    // Send chat message - now uses unified SessionService
    dashboard.post("/api/chat", async (c) => {
        const { message, model: requestModel } = await c.req.json();

        // Find the enabled provider and use its selected model
        let effectiveModel = requestModel;
        if (!effectiveModel) {
            // Debug: log all provider configs
            console.log("[Dashboard] Provider configs:", Array.from(providerConfigs.entries()).map(([k, v]) => ({ type: k, enabled: v.enabled, hasKey: !!v.apiKey })));

            // Check which provider is enabled in providerConfigs
            for (const [type, config] of providerConfigs.entries()) {
                if (config.enabled && config.apiKey) {
                    // Use the selected model for this provider, or a default
                    effectiveModel = config.selectedModel || configStore.get("defaultModel") as string;
                    console.log(`[Dashboard] Using enabled provider: ${type}, model: ${effectiveModel}`);
                    logger.info("chat", `Chat using provider: ${type}, model: ${effectiveModel}`);
                    break;
                }
            }
            // Fallback if no provider is enabled
            if (!effectiveModel) {
                // Check if ANY provider has an API key configured
                const anyProviderConfigured = Array.from(providerConfigs.values()).some(c => c.apiKey);
                if (!anyProviderConfigured && providerConfigs.size === 0) {
                    // First-time user - no providers configured at all
                    return c.json({
                        id: randomUUID(),
                        role: "assistant",
                        content: "👋 Welcome to OpenWhale! To get started, please go to **AI Providers** in the sidebar and configure at least one AI provider (like DeepSeek, OpenAI, or Anthropic) with your API key.",
                        createdAt: new Date().toISOString()
                    });
                }
                effectiveModel = configStore.get("defaultModel") as string || "";
                console.log(`[Dashboard] No enabled provider found, falling back to: ${effectiveModel}`);
            }
        }

        // Check for commands first
        const commandResult = processSessionCommand("dashboard", message);
        if (commandResult) {
            // Return as assistant message
            return c.json({
                id: randomUUID(),
                role: "assistant",
                content: commandResult,
                createdAt: new Date().toISOString()
            });
        }

        try {
            // Set the model for this request (registry will pick the right provider)
            setModel(effectiveModel);
            console.log(`[Dashboard] Using model: ${effectiveModel}`);

            // Process message with full tool support (iterative loop)
            const response = await processSessionMessage("dashboard", message, {
                model: effectiveModel,
                onToolStart: (tool) => console.log(`[Dashboard] 🔧 Starting: ${tool.name}`),
                onToolEnd: (tool) => console.log(`[Dashboard] ✅ Completed: ${tool.name} (${tool.status})`),
            });

            return c.json(response);
        } catch (e) {
            return c.json({
                id: randomUUID(),
                role: "assistant",
                content: `Error: ${e instanceof Error ? e.message : String(e)}`,
                createdAt: new Date().toISOString()
            });
        }
    });

    // TTS endpoint for voice mode - generates speech from text via ElevenLabs
    dashboard.post("/api/tts", async (c) => {
        try {
            const { text, voiceId } = await c.req.json();
            if (!text) {
                return c.json({ error: "No text provided" }, 400);
            }

            const apiKey = process.env.ELEVENLABS_API_KEY;
            if (!apiKey) {
                return c.json({ error: "ElevenLabs API key not configured" }, 400);
            }

            const voice = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George default
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "xi-api-key": apiKey,
                    },
                    body: JSON.stringify({
                        text: text.slice(0, 2000), // Limit to 2000 chars
                        model_id: "eleven_flash_v2_5",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errText = await response.text();
                console.error("[TTS] ElevenLabs error:", errText);
                return c.json({ error: "TTS generation failed" }, 500);
            }

            const audioBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(audioBuffer).toString("base64");
            const audio = `data:audio/mpeg;base64,${base64}`;

            return c.json({ audio });
        } catch (err) {
            console.error("[TTS] Error:", err);
            return c.json({ error: "TTS generation failed" }, 500);
        }
    });

    // Stream chat message via SSE for real-time step updates
    dashboard.post("/api/chat/stream", async (c) => {
        const { message, model: requestModel } = await c.req.json();

        // Resolve model (same logic as /api/chat)
        let effectiveModel = requestModel;
        if (!effectiveModel) {
            for (const [, config] of providerConfigs.entries()) {
                if (config.enabled && config.apiKey) {
                    effectiveModel = config.selectedModel || configStore.get("defaultModel") as string;
                    break;
                }
            }
            if (!effectiveModel) {
                effectiveModel = configStore.get("defaultModel") as string || "";
            }
        }

        // Check for commands first
        const commandResult = processSessionCommand("dashboard", message);
        if (commandResult) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    const msg = { id: randomUUID(), role: "assistant", content: commandResult, createdAt: new Date().toISOString() };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "content", data: { text: commandResult } })}\n\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "done", data: { message: msg } })}\n\n`));
                    controller.close();
                },
            });
            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        }

        setModel(effectiveModel);

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                const emit = (event: string, data: unknown) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`));
                    } catch {
                        // Stream may be closed
                    }
                };

                processSessionMessageStream("dashboard", message, {
                    model: effectiveModel,
                    emit,
                }).then(() => {
                    try { controller.close(); } catch { }
                }).catch((err) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "error", data: { message: err.message } })}\n\n`));
                        controller.close();
                    } catch { }
                });
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    });

    // ============== CHANNELS ==============

    dashboard.get("/api/channels", async (c) => {
        // Check real-time WhatsApp status
        let waConnected = false;
        try {
            const { isWhatsAppConnected } = await import("../channels/whatsapp-baileys.js");
            waConnected = isWhatsAppConnected();
        } catch { /* WhatsApp module not available */ }

        const channelList = [
            {
                name: "Web",
                type: "web",
                enabled: true,
                connected: true,
                messagesSent: getChatHistory().filter((m: { role: string }) => m.role === "assistant").length,
                messagesReceived: getChatHistory().filter((m: { role: string }) => m.role === "user").length
            },
            {
                name: "WhatsApp",
                type: "whatsapp",
                enabled: channelConfigs.get("whatsapp")?.enabled ?? true,
                connected: waConnected, // Real-time status check
                messagesSent: 0,
                messagesReceived: 0
            },
            {
                name: "Telegram",
                type: "telegram",
                enabled: channelConfigs.get("telegram")?.enabled ?? false,
                connected: channelConfigs.get("telegram")?.connected ?? false,
                messagesSent: 0,
                messagesReceived: 0
            },
            {
                name: "Discord",
                type: "discord",
                enabled: channelConfigs.get("discord")?.enabled ?? false,
                connected: channelConfigs.get("discord")?.connected ?? false,
                messagesSent: 0,
                messagesReceived: 0
            },
            {
                name: "iMessage",
                type: "imessage",
                enabled: channelConfigs.get("imessage")?.enabled ?? false,
                connected: channelConfigs.get("imessage")?.connected ?? false,
                messagesSent: 0,
                messagesReceived: 0,
                platform: process.platform,
                available: process.platform === "darwin"
            }
        ];

        return c.json({ channels: channelList });
    });

    // Toggle channel
    dashboard.post("/api/channels/:type/toggle", async (c) => {
        const type = c.req.param("type");
        const { enabled } = await c.req.json();

        const existing = channelConfigs.get(type) || { enabled: false, connected: false };
        channelConfigs.set(type, { ...existing, enabled });

        return c.json({ ok: true });
    });

    // WhatsApp connect
    dashboard.post("/api/channels/whatsapp/connect", async (c) => {
        try {
            // This would trigger the baileys connection
            const { initWhatsApp } = await import("../channels/whatsapp-baileys.js");

            // Start initialization
            await initWhatsApp();

            // For now, return success - QR would be handled via polling
            return c.json({ ok: true, message: "WhatsApp initialization started" });
        } catch (e) {
            return c.json({ ok: false, error: String(e) }, 500);
        }
    });

    // WhatsApp status (with QR code)
    dashboard.get("/api/channels/whatsapp/status", async (c) => {
        try {
            const { isWhatsAppConnected, getQRCode } = await import("../channels/whatsapp-baileys.js");
            const connected = isWhatsAppConnected();
            const qrCode = getQRCode();

            if (connected) {
                const cfg = channelConfigs.get("whatsapp") || { enabled: true, connected: false };
                channelConfigs.set("whatsapp", { ...cfg, connected: true });
            }

            // Generate QR code data URL if available
            let qrDataUrl = null;
            if (qrCode && !connected) {
                // Use qrcode library to generate data URL
                const QRCode = await import("qrcode");
                qrDataUrl = await QRCode.toDataURL(qrCode, { width: 256, margin: 2 });
            }

            return c.json({ connected, qrCode: qrDataUrl });
        } catch {
            return c.json({ connected: false });
        }
    });

    // Telegram connect
    dashboard.post("/api/channels/telegram/connect", async (c) => {
        try {
            const body = await c.req.json();
            const { telegramBotToken } = body;

            if (!telegramBotToken) {
                return c.json({ ok: false, error: "Bot token required" }, 400);
            }

            // Validate token by calling Telegram API
            const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getMe`);
            const data = await response.json() as { ok: boolean; result?: { username: string }; description?: string };

            if (!data.ok) {
                return c.json({ ok: false, error: data.description || "Invalid bot token" }, 400);
            }

            // Save token to environment
            process.env.TELEGRAM_BOT_TOKEN = telegramBotToken;

            // Mark as connected in memory
            channelConfigs.set("telegram", { enabled: true, connected: true });

            // Persist to database
            await saveChannelToDB(db, "telegram", {
                enabled: true,
                connected: true,
                credentials: { botToken: telegramBotToken }
            });

            // Start the Telegram adapter
            const { createTelegramAdapter } = await import("../channels/telegram.js");
            const telegram = createTelegramAdapter();
            if (telegram) {
                await telegram.connect();
            }

            console.log(`[Dashboard] Telegram connected: @${data.result?.username}`);
            return c.json({ ok: true, botUsername: data.result?.username });
        } catch (e) {
            console.error("[Dashboard] Telegram connect error:", e);
            return c.json({ ok: false, error: String(e) }, 500);
        }
    });

    // Telegram status
    dashboard.get("/api/channels/telegram/status", async (c) => {
        const config = channelConfigs.get("telegram");
        const connected = config?.connected ?? false;
        return c.json({ connected, enabled: config?.enabled ?? false });
    });

    // Discord connect
    dashboard.post("/api/channels/discord/connect", async (c) => {
        try {
            const body = await c.req.json();
            const { discordBotToken } = body;

            if (!discordBotToken) {
                return c.json({ ok: false, error: "Bot token required" }, 400);
            }

            // Validate token
            const response = await fetch("https://discord.com/api/v10/users/@me", {
                headers: { Authorization: `Bot ${discordBotToken}` },
            });

            if (!response.ok) {
                return c.json({ ok: false, error: "Invalid bot token" }, 400);
            }

            const data = await response.json() as { username: string };

            // Save token to environment
            process.env.DISCORD_BOT_TOKEN = discordBotToken;

            // Mark as connected in memory
            channelConfigs.set("discord", { enabled: true, connected: true });

            // Persist to database
            await saveChannelToDB(db, "discord", {
                enabled: true,
                connected: true,
                credentials: { botToken: discordBotToken }
            });

            // Start Discord adapter
            const { createDiscordAdapter } = await import("../channels/discord.js");
            const discord = createDiscordAdapter();
            if (discord) {
                await discord.connect();
            }

            console.log(`[Dashboard] Discord connected: ${data.username}`);
            return c.json({ ok: true, botUsername: data.username });
        } catch (e) {
            console.error("[Dashboard] Discord connect error:", e);
            return c.json({ ok: false, error: String(e) }, 500);
        }
    });

    // Discord status
    dashboard.get("/api/channels/discord/status", async (c) => {
        const config = channelConfigs.get("discord");
        return c.json({ connected: config?.connected ?? false, enabled: config?.enabled ?? false });
    });

    // iMessage status
    dashboard.get("/api/channels/imessage/status", async (c) => {
        const config = channelConfigs.get("imessage");
        const isMac = process.platform === "darwin";
        let imsgInstalled = false;

        if (isMac) {
            try {
                await execAsync("which imsg");
                imsgInstalled = true;
            } catch { /* not installed */ }
        }

        return c.json({
            connected: config?.connected ?? false,
            enabled: config?.enabled ?? false,
            isMac,
            imsgInstalled
        });
    });

    // iMessage connect
    dashboard.post("/api/channels/imessage/connect", async (c) => {
        try {
            if (process.platform !== "darwin") {
                return c.json({ ok: false, error: "iMessage is only available on macOS" }, 400);
            }

            // Check if imsg CLI is installed
            try {
                await execAsync("which imsg");
            } catch {
                return c.json({ ok: false, error: "imsg CLI not installed. Click 'Install imsg' first." }, 400);
            }

            // Start the iMessage adapter
            const { createIMessageAdapter } = await import("../channels/imessage/adapter.js");
            const imessage = createIMessageAdapter();
            if (!imessage) {
                return c.json({ ok: false, error: "Failed to create iMessage adapter" }, 500);
            }

            await imessage.connect();

            // Register with channel registry
            const { channelRegistry } = await import("../channels/base.js");
            channelRegistry.register(imessage);

            // Mark as connected
            channelConfigs.set("imessage", { enabled: true, connected: true });

            // Persist to database
            await saveChannelToDB(db, "imessage", { enabled: true, connected: true });

            console.log("[Dashboard] iMessage connected!");
            return c.json({ ok: true, message: "iMessage connected successfully" });
        } catch (e) {
            console.error("[Dashboard] iMessage connect error:", e);
            return c.json({ ok: false, error: String(e) }, 500);
        }
    });

    // iMessage: Install imsg CLI
    dashboard.post("/api/channels/imessage/install", async (c) => {
        if (process.platform !== "darwin") {
            return c.json({ ok: false, error: "iMessage is only available on macOS" }, 400);
        }

        // Augment PATH so child processes can find brew/cargo on macOS
        const extraPaths = ["/opt/homebrew/bin", "/usr/local/bin", `${process.env.HOME}/.cargo/bin`];
        const fullPath = [...extraPaths, process.env.PATH].join(":");
        const execOpts = { env: { ...process.env, PATH: fullPath }, timeout: 180000 };

        try {
            // Check if already installed
            try {
                await execAsync("which imsg", execOpts);
                return c.json({ ok: true, message: "imsg CLI is already installed", alreadyInstalled: true });
            } catch { /* not installed, proceed */ }

            // Try installing via Homebrew first (most common on macOS)
            try {
                await execAsync("which brew", execOpts);
                // Brew is available — install imsg
                await execAsync("brew install steipete/tap/imsg", execOpts);
                return c.json({ ok: true, message: "imsg CLI installed via Homebrew" });
            } catch { /* brew not available or install failed */ }

            // Fallback: try cargo (Rust)
            try {
                await execAsync("which cargo", execOpts);
                await execAsync("cargo install imsg", execOpts);
                return c.json({ ok: true, message: "imsg CLI installed via cargo" });
            } catch { /* cargo not available */ }

            return c.json({ ok: false, error: "Installation failed. Please install manually:\n  brew install --HEAD nichochar/tap/imsg\nor install Rust and run:\n  cargo install imsg" }, 500);
        } catch (e) {
            return c.json({ ok: false, error: `Installation failed: ${e instanceof Error ? e.message : String(e)}` }, 500);
        }
    });

    // Channel message history
    dashboard.get("/api/channels/:type/messages", async (c) => {
        const channelType = c.req.param("type");

        try {
            // For WhatsApp, use SQLite stored messages
            if (channelType === "whatsapp") {
                const { getAllMessages, getMessageStats } = await import("../db/message-dedupe.js");
                const messages = getAllMessages(500);
                const stats = getMessageStats();

                // Group messages by contact (phone number)
                const conversations = new Map<string, typeof messages>();
                for (const msg of messages) {
                    const contact = msg.direction === "inbound"
                        ? msg.from_number || "unknown"
                        : msg.to_number || "unknown";
                    if (!conversations.has(contact)) {
                        conversations.set(contact, []);
                    }
                    conversations.get(contact)!.push(msg);
                }

                // Convert to array sorted by most recent message
                const conversationList = Array.from(conversations.entries()).map(([contact, msgs]) => ({
                    contact,
                    contactName: msgs.find(m => m.contact_name)?.contact_name || null,
                    messages: msgs.sort((a, b) => a.processed_at - b.processed_at).map(m => ({
                        id: m.id,
                        direction: m.direction,
                        content: m.content,
                        timestamp: new Date(m.processed_at * 1000).toISOString(),
                        mediaType: m.media_type,
                    })),
                    lastMessage: msgs[0]?.processed_at ? new Date(msgs[0].processed_at * 1000).toISOString() : null,
                })).sort((a, b) => {
                    const aTime = a.messages[a.messages.length - 1]?.timestamp || "";
                    const bTime = b.messages[b.messages.length - 1]?.timestamp || "";
                    return bTime.localeCompare(aTime);
                });

                return c.json({
                    ok: true,
                    channel: channelType,
                    stats,
                    conversations: conversationList,
                });
            }

            // For other channels, use in-memory history
            const { getChannelHistory } = await import("../sessions/index.js");
            const messages = getChannelHistory(channelType);

            return c.json({
                ok: true,
                channel: channelType,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp.toISOString(),
                    userId: m.userId,
                }))
            });
        } catch (e) {
            return c.json({ ok: false, error: String(e), messages: [], conversations: [] });
        }
    });

    // ============== PROVIDERS ==============

    dashboard.get("/api/providers", (c) => {
        const providerList = [
            {
                name: "Anthropic",
                type: "anthropic",
                enabled: providerConfigs.get("anthropic")?.enabled ?? !!process.env.ANTHROPIC_API_KEY,
                hasKey: !!(providerConfigs.get("anthropic")?.apiKey || process.env.ANTHROPIC_API_KEY),
                supportsTools: true,
                supportsVision: true,
                models: [
                    "claude-sonnet-4-20250514",
                    "claude-3-5-sonnet-20241022",
                    "claude-3-opus-20240229",
                    "claude-3-5-haiku-20241022",
                    "claude-3-haiku-20240307"
                ]
            },
            {
                name: "OpenAI",
                type: "openai",
                enabled: providerConfigs.get("openai")?.enabled ?? !!process.env.OPENAI_API_KEY,
                hasKey: !!(providerConfigs.get("openai")?.apiKey || process.env.OPENAI_API_KEY),
                supportsTools: true,
                supportsVision: true,
                models: [
                    "gpt-4o",
                    "gpt-4o-mini",
                    "gpt-4-turbo",
                    "gpt-4",
                    "gpt-3.5-turbo",
                    "o1-preview",
                    "o1-mini"
                ]
            },
            {
                name: "Google",
                type: "google",
                enabled: providerConfigs.get("google")?.enabled ?? !!process.env.GOOGLE_API_KEY,
                hasKey: !!(providerConfigs.get("google")?.apiKey || process.env.GOOGLE_API_KEY),
                supportsTools: true,
                supportsVision: true,
                models: [
                    "gemini-2.0-flash",
                    "gemini-2.0-flash-lite",
                    "gemini-1.5-pro",
                    "gemini-1.5-flash",
                    "gemini-1.5-flash-8b"
                ]
            },
            {
                name: "Ollama",
                type: "ollama",
                enabled: providerConfigs.get("ollama")?.enabled ?? false,
                hasKey: true,
                supportsTools: true,
                supportsVision: true,
                models: [
                    "llama3.2",
                    "llama3.1",
                    "llama3",
                    "mistral",
                    "mixtral",
                    "phi3",
                    "qwen2.5",
                    "deepseek-r1"
                ]
            },
            {
                name: "DeepSeek",
                type: "deepseek",
                enabled: providerConfigs.get("deepseek")?.enabled ?? !!process.env.DEEPSEEK_API_KEY,
                hasKey: !!(providerConfigs.get("deepseek")?.apiKey || process.env.DEEPSEEK_API_KEY),
                supportsTools: true,
                supportsVision: false,
                models: [
                    "deepseek-chat",
                    "deepseek-coder",
                    "deepseek-reasoner"
                ]
            }
        ];

        return c.json({ providers: providerList });
    });

    // Save provider config
    dashboard.post("/api/providers/:type/config", async (c) => {
        const type = c.req.param("type");
        const { apiKey, baseUrl, enabled, selectedModel } = await c.req.json();

        const existing = providerConfigs.get(type) || { enabled: false };
        providerConfigs.set(type, {
            ...existing,
            enabled: enabled ?? existing.enabled,
            apiKey: apiKey || existing.apiKey,
            baseUrl: baseUrl || existing.baseUrl,
            selectedModel: selectedModel || existing.selectedModel
        });

        console.log(`[Dashboard] Provider ${type} config updated: enabled=${enabled ?? existing.enabled}, selectedModel=${selectedModel || existing.selectedModel}`);
        logger.info("provider", `Provider ${type} config updated`, { enabled: enabled ?? existing.enabled, selectedModel: selectedModel || existing.selectedModel });

        // Update env vars
        if (apiKey) {
            if (type === "anthropic") process.env.ANTHROPIC_API_KEY = apiKey;
            if (type === "openai") process.env.OPENAI_API_KEY = apiKey;
            if (type === "google") process.env.GOOGLE_API_KEY = apiKey;
            if (type === "deepseek") process.env.DEEPSEEK_API_KEY = apiKey;
        }

        // Persist to database
        await saveProviderToDB(db, type, providerConfigs.get(type)!);

        // Dynamically register provider when API key is provided
        // Always re-register to ensure the provider uses the latest API key
        if (apiKey) {
            console.log(`[Dashboard] Registering ${type} provider with API key...`);
            let provider = null;

            if (type === "anthropic") {
                provider = createAnthropicProvider();
            } else if (type === "openai") {
                provider = createOpenAIProvider();
            } else if (type === "google") {
                provider = createGoogleProvider();
            } else if (type === "deepseek") {
                provider = createDeepSeekProvider();
            }

            if (provider) {
                registry.register(type, provider);
                console.log(`✓ ${type} provider registered dynamically`);
            } else {
                console.error(`[Dashboard] Failed to create ${type} provider - API key may be invalid`);
            }
        }

        return c.json({ ok: true });
    });

    // ============== SKILLS ==============

    dashboard.get("/api/skills", (c) => {
        const skillList = [
            {
                id: "github",
                name: "GitHub",
                enabled: skillConfigs.get("github")?.enabled ?? !!process.env.GITHUB_TOKEN,
                hasKey: !!(skillConfigs.get("github")?.apiKey || process.env.GITHUB_TOKEN),
                description: "Access repos, issues, PRs"
            },
            {
                id: "weather",
                name: "Weather",
                enabled: skillConfigs.get("weather")?.enabled ?? !!process.env.OPENWEATHERMAP_API_KEY,
                hasKey: !!(skillConfigs.get("weather")?.apiKey || process.env.OPENWEATHERMAP_API_KEY),
                description: "Current weather and forecasts"
            },
            {
                id: "notion",
                name: "Notion",
                enabled: skillConfigs.get("notion")?.enabled ?? !!process.env.NOTION_API_KEY,
                hasKey: !!(skillConfigs.get("notion")?.apiKey || process.env.NOTION_API_KEY),
                description: "Manage pages and databases"
            },
            {
                id: "google",
                name: "Google Services",
                enabled: skillConfigs.get("google")?.enabled ?? false,
                hasKey: !!skillConfigs.get("google")?.apiKey,
                description: "Calendar, Gmail, Drive, Tasks"
            },
            {
                id: "onepassword",
                name: "1Password",
                enabled: skillConfigs.get("onepassword")?.enabled ?? !!process.env.OP_CONNECT_TOKEN,
                hasKey: !!(skillConfigs.get("onepassword")?.apiKey || process.env.OP_CONNECT_TOKEN),
                description: "Secure password access"
            },
            {
                id: "twitter",
                name: "Twitter/X",
                enabled: skillConfigs.get("twitter")?.enabled ?? !!process.env.TWITTER_ENABLED,
                hasKey: true,
                description: "Post tweets, read timeline, mentions",
                noCreds: true
            },
            {
                id: "elevenlabs",
                name: "ElevenLabs",
                enabled: skillConfigs.get("elevenlabs")?.enabled ?? !!process.env.ELEVENLABS_API_KEY,
                hasKey: !!(skillConfigs.get("elevenlabs")?.apiKey || process.env.ELEVENLABS_API_KEY),
                description: "High-quality text-to-speech voices"
            },
            {
                id: "twilio",
                name: "Twilio",
                enabled: skillConfigs.get("twilio")?.enabled ?? !!process.env.TWILIO_ACCOUNT_SID,
                hasKey: !!(skillConfigs.get("twilio")?.apiKey || process.env.TWILIO_ACCOUNT_SID),
                description: "SMS, WhatsApp, and AI voice calls",
                multiField: true
            }
        ];

        return c.json({ skills: skillList });
    });

    // Get markdown skills from ~/.openwhale/skills/
    dashboard.get("/api/md-skills", async (c) => {
        const { readdirSync, readFileSync, existsSync } = await import("fs");
        const { join } = await import("path");
        const { homedir } = await import("os");

        const skillsDir = join(homedir(), ".openwhale", "skills");
        const mdSkills: Array<{ name: string; description: string; path: string }> = [];

        if (!existsSync(skillsDir)) {
            return c.json({ mdSkills: [] });
        }

        try {
            const dirs = readdirSync(skillsDir, { withFileTypes: true });
            for (const dir of dirs) {
                if (dir.isDirectory()) {
                    const skillFile = join(skillsDir, dir.name, "SKILL.md");
                    if (existsSync(skillFile)) {
                        try {
                            const content = readFileSync(skillFile, "utf-8");
                            // Parse YAML frontmatter
                            const match = content.match(/^---\n([\s\S]*?)\n---/);
                            let name = dir.name;
                            let description = "";
                            if (match) {
                                const frontmatter = match[1];
                                const nameMatch = frontmatter.match(/name:\s*(.+)/);
                                const descMatch = frontmatter.match(/description:\s*(.+)/);
                                if (nameMatch) name = nameMatch[1].trim();
                                if (descMatch) description = descMatch[1].trim();
                            }
                            mdSkills.push({ name, description, path: skillFile });
                        } catch {
                            // Skip malformed files
                        }
                    }
                }
            }
        } catch {
            // Directory read error
        }

        return c.json({ mdSkills });
    });

    // Get skill content for editing
    dashboard.get("/api/md-skills/content", async (c) => {
        const { readFileSync, existsSync } = await import("fs");
        const skillPath = c.req.query("path");

        if (!skillPath || !existsSync(skillPath)) {
            return c.json({ error: "Skill not found" }, 404);
        }

        try {
            const content = readFileSync(skillPath, "utf-8");
            return c.json({ content });
        } catch (e) {
            return c.json({ error: "Failed to read skill" }, 500);
        }
    });

    // Get full directory tree for a skill
    dashboard.get("/api/md-skills/tree", async (c) => {
        const { readdirSync, existsSync } = await import("fs");
        const { join } = await import("path");
        const skillDir = c.req.query("dir");

        if (!skillDir || !existsSync(skillDir)) {
            return c.json({ error: "Skill directory not found" }, 404);
        }

        interface FileNode {
            name: string;
            path: string;
            type: "file" | "directory";
            children?: FileNode[];
        }

        function buildTree(dir: string): FileNode[] {
            const items: FileNode[] = [];
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name.startsWith('.') || entry.name === '_meta.json') continue;
                    const fullPath = join(dir, entry.name);
                    if (entry.isDirectory()) {
                        items.push({
                            name: entry.name,
                            path: fullPath,
                            type: "directory",
                            children: buildTree(fullPath)
                        });
                    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt') || entry.name.endsWith('.json') || entry.name.endsWith('.py') || entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.sh')) {
                        items.push({
                            name: entry.name,
                            path: fullPath,
                            type: "file"
                        });
                    }
                }
            } catch (e) { }
            return items.sort((a, b) => {
                if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        }

        return c.json({ tree: buildTree(skillDir) });
    });

    // Save skill content
    dashboard.post("/api/md-skills/save", async (c) => {
        const { writeFileSync, existsSync } = await import("fs");
        const { path, content } = await c.req.json();

        if (!path || !existsSync(path)) {
            return c.json({ error: "Skill not found" }, 404);
        }

        try {
            writeFileSync(path, content, "utf-8");
            return c.json({ success: true });
        } catch (e) {
            return c.json({ error: "Failed to save skill" }, 500);
        }
    });

    // Create a new skill
    dashboard.post("/api/md-skills/create", async (c) => {
        const { mkdirSync, writeFileSync, existsSync } = await import("fs");
        const { join } = await import("path");
        const { homedir } = await import("os");
        const { name, description } = await c.req.json();

        if (!name || !name.trim()) {
            return c.json({ error: "Skill name is required" }, 400);
        }

        const skillsDir = join(homedir(), ".openwhale", "skills");
        const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const skillDir = join(skillsDir, safeName);

        if (existsSync(skillDir)) {
            return c.json({ error: "Skill already exists" }, 400);
        }

        try {
            mkdirSync(skillDir, { recursive: true });
            const content = `---
name: ${safeName}
description: ${description || 'A custom skill'}
---

# ${name}

${description || 'Add your skill documentation here.'}

## Usage

Describe how to use this skill.

## Commands

\`\`\`bash
# Example command
echo "Hello from ${name}"
\`\`\`
`;
            writeFileSync(join(skillDir, "SKILL.md"), content);
            return c.json({ success: true, path: skillDir });
        } catch (e) {
            return c.json({ error: "Failed to create skill" }, 500);
        }
    });

    // Create a folder within a skill
    dashboard.post("/api/md-skills/create-folder", async (c) => {
        const { mkdirSync, existsSync } = await import("fs");
        const { join } = await import("path");
        const { skillDir, folderName } = await c.req.json();

        if (!skillDir || !folderName) {
            return c.json({ error: "Skill directory and folder name are required" }, 400);
        }

        const safeName = folderName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const folderPath = join(skillDir, safeName);

        if (existsSync(folderPath)) {
            return c.json({ error: "Folder already exists" }, 400);
        }

        try {
            mkdirSync(folderPath, { recursive: true });
            return c.json({ success: true, path: folderPath });
        } catch (e) {
            return c.json({ error: "Failed to create folder" }, 500);
        }
    });

    // Create a file within a skill
    dashboard.post("/api/md-skills/create-file", async (c) => {
        const { writeFileSync, existsSync } = await import("fs");
        const { join } = await import("path");
        const { parentDir, fileName, content = "" } = await c.req.json();

        if (!parentDir || !fileName) {
            return c.json({ error: "Parent directory and file name are required" }, 400);
        }

        const filePath = join(parentDir, fileName);

        if (existsSync(filePath)) {
            return c.json({ error: "File already exists" }, 400);
        }

        try {
            const defaultContent = fileName.endsWith('.md')
                ? `# ${fileName.replace('.md', '')}\n\nAdd content here.`
                : content;
            writeFileSync(filePath, defaultContent);
            return c.json({ success: true, path: filePath });
        } catch (e) {
            return c.json({ error: "Failed to create file" }, 500);
        }
    });

    // Save skill config
    dashboard.post("/api/skills/:id/config", async (c) => {
        const id = c.req.param("id");
        const { apiKey, enabled } = await c.req.json();

        const existing = skillConfigs.get(id) || { enabled: false };
        skillConfigs.set(id, {
            enabled: enabled ?? existing.enabled,
            apiKey: apiKey || existing.apiKey
        });

        // Update env vars
        if (apiKey) {
            if (id === "github") process.env.GITHUB_TOKEN = apiKey;
            if (id === "weather") process.env.OPENWEATHERMAP_API_KEY = apiKey;
            if (id === "notion") process.env.NOTION_API_KEY = apiKey;
            if (id === "trello") process.env.TRELLO_API_KEY = apiKey;
            if (id === "elevenlabs") process.env.ELEVENLABS_API_KEY = apiKey;
            if (id === "twilio") {
                try {
                    const creds = JSON.parse(apiKey);
                    if (creds.sid) process.env.TWILIO_ACCOUNT_SID = creds.sid;
                    if (creds.authToken) process.env.TWILIO_AUTH_TOKEN = creds.authToken;
                    if (creds.phone) process.env.TWILIO_FROM_NUMBER = creds.phone;
                } catch {
                    process.env.TWILIO_ACCOUNT_SID = apiKey;
                }
            }
        }

        // Persist to database
        await saveSkillToDB(db, id, skillConfigs.get(id)!);

        return c.json({ ok: true });
    });

    // Check bird CLI status for Twitter
    dashboard.get("/api/skills/twitter/check-bird", async (c) => {
        try {
            // Check if bird CLI is installed
            try {
                await execAsync("which bird");
            } catch {
                return c.json({ ok: true, installed: false });
            }

            // Check if authenticated
            try {
                const { stdout } = await execAsync("bird whoami --json");
                const whoami = JSON.parse(stdout);
                const username = whoami.username || whoami.screen_name;

                if (username) {
                    return c.json({
                        ok: true,
                        installed: true,
                        authenticated: true,
                        username
                    });
                } else {
                    return c.json({
                        ok: true,
                        installed: true,
                        authenticated: false
                    });
                }
            } catch {
                return c.json({
                    ok: true,
                    installed: true,
                    authenticated: false
                });
            }
        } catch (err) {
            return c.json({ ok: false, error: String(err) });
        }
    });

    // Get bird config (load Twitter cookies)
    dashboard.get("/api/skills/twitter/bird-config", async (c) => {
        try {
            const homedir = process.env.HOME || process.env.USERPROFILE || "";
            const configPath = `${homedir}/.config/bird/config.json5`;

            try {
                const content = await fs.readFile(configPath, "utf-8");
                // Parse JSON5 (supports unquoted keys, comments, trailing commas)
                // Add quotes around unquoted keys: auth_token: -> "auth_token":
                const jsonified = content
                    .replace(/\/\/.*$/gm, "")  // Remove comments
                    .replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:')  // Quote unquoted keys
                    .replace(/,(\s*[}\]])/g, "$1");  // Remove trailing commas
                const config = JSON.parse(jsonified);

                // Try to get username if authenticated
                let username = "";
                try {
                    const { stdout } = await execAsync("bird whoami --json 2>/dev/null");
                    const whoami = JSON.parse(stdout);
                    username = whoami.username || whoami.screen_name || "";
                } catch {
                    // Ignore
                }

                return c.json({
                    ok: true,
                    config: {
                        auth_token: config.auth_token || "",
                        ct0: config.ct0 || ""
                    },
                    username
                });
            } catch (parseErr) {
                console.error("[bird-config] Parse error:", parseErr);
                return c.json({ ok: true, config: null });
            }
        } catch (err) {
            return c.json({ ok: false, error: String(err) });
        }
    });

    // Save bird config (save Twitter cookies)
    dashboard.post("/api/skills/twitter/bird-config", async (c) => {
        try {
            const { auth_token, ct0 } = await c.req.json();

            if (!auth_token || !ct0) {
                return c.json({ ok: false, error: "Both auth_token and ct0 are required" });
            }

            const homedir = process.env.HOME || process.env.USERPROFILE || "";
            const configDir = `${homedir}/.config/bird`;
            const configPath = `${configDir}/config.json5`;

            // Ensure directory exists
            await fs.mkdir(configDir, { recursive: true });

            // Read existing config if any
            let existingConfig: Record<string, unknown> = {};
            try {
                const content = await fs.readFile(configPath, "utf-8");
                existingConfig = JSON.parse(content.replace(/,(\s*[}\]])/g, "$1").replace(/\/\/.*$/gm, ""));
            } catch {
                // No existing config
            }

            // Merge and write
            const newConfig = {
                ...existingConfig,
                auth_token,
                ct0
            };

            await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));

            // Verify by checking whoami
            let username = "";
            try {
                const { stdout } = await execAsync("bird whoami --json 2>/dev/null");
                const whoami = JSON.parse(stdout);
                username = whoami.username || whoami.screen_name || "";
            } catch {
                // May not work immediately
            }

            // Enable Twitter skill
            const existing = skillConfigs.get("twitter") || { enabled: false };
            skillConfigs.set("twitter", { ...existing, enabled: true });
            await saveSkillToDB(db, "twitter", skillConfigs.get("twitter")!);
            process.env.TWITTER_ENABLED = "true";

            return c.json({ ok: true, username });
        } catch (err) {
            return c.json({ ok: false, error: String(err) });
        }
    });

    // ============== GOOGLE OAUTH ==============

    // Get Google auth URL
    dashboard.get("/api/google/auth-url", async (c) => {
        try {
            const { getAuthUrl, getCredentialsPath } = await import("../integrations/google/client.js");
            const authUrl = getAuthUrl();
            if (!authUrl) {
                return c.json({
                    ok: false,
                    error: "Google credentials not configured",
                    credentialsPath: getCredentialsPath()
                }, 400);
            }
            return c.json({ ok: true, authUrl });
        } catch (e) {
            return c.json({ ok: false, error: String(e) }, 500);
        }
    });

    // Google OAuth callback
    dashboard.get("/callback/google", async (c) => {
        const code = c.req.query("code");
        if (!code) {
            return c.html("<html><body><h1>Error</h1><p>No authorization code received</p></body></html>");
        }

        try {
            const { handleAuthCallback } = await import("../integrations/google/client.js");
            const success = await handleAuthCallback(code);
            if (success) {
                return c.html(`
                    <html><body style="font-family: system-ui; text-align: center; padding: 50px;">
                        <h1>✅ Google Connected!</h1>
                        <p>Gmail, Calendar, Drive, and Tasks are now available.</p>
                        <p>You can close this window and return to the dashboard.</p>
                        <script>setTimeout(() => window.close(), 3000)</script>
                    </body></html>
                `);
            } else {
                return c.html("<html><body><h1>Error</h1><p>Failed to authenticate with Google</p></body></html>");
            }
        } catch (e) {
            return c.html(`<html><body><h1>Error</h1><p>${e}</p></body></html>`);
        }
    });

    // Check Google auth status
    dashboard.get("/api/google/status", async (c) => {
        try {
            const { isGoogleAuthenticated, getCredentialsPath } = await import("../integrations/google/client.js");
            return c.json({
                authenticated: isGoogleAuthenticated(),
                credentialsPath: getCredentialsPath()
            });
        } catch (e) {
            return c.json({ authenticated: false, error: String(e) });
        }
    });

    // ============== TOOLS ==============

    dashboard.get("/api/tools", async (c) => {
        try {
            const { toolRegistry } = await import("../tools/index.js");
            const tools = toolRegistry.list().map(t => ({
                name: t.name,
                description: t.description,
                category: t.category,
                disabled: t.disabled ?? false,
                requiresApproval: t.requiresApproval ?? false,
                requiresElevated: t.requiresElevated ?? false
            }));
            return c.json({ tools });
        } catch {
            return c.json({ tools: [] });
        }
    });

    // ============== CONFIG ==============

    dashboard.post("/api/config", async (c) => {
        const data = await c.req.json();

        for (const [key, value] of Object.entries(data)) {
            configStore.set(key, value);
            if (key === "ownerPhone") process.env.OWNER_PHONE = String(value);
            if (key === "logFilePath") logger.setLogPath(String(value));

            // Persist to database using raw SQL
            try {
                sqliteDb.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, String(value));
            } catch (e) {
                console.error(`[Dashboard] Failed to persist config ${key}:`, e);
            }
        }

        logger.info("dashboard", "Config saved", data);
        return c.json({ ok: true });
    });

    dashboard.get("/api/config", (c) => {
        return c.json(Object.fromEntries(configStore));
    });
    // ============== LOGS ==============

    dashboard.get("/api/logs", async (c) => {
        const page = parseInt(c.req.query("page") || "0");
        const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);
        const levelFilter = c.req.query("level");
        const categoryFilter = c.req.query("category");
        const startDate = c.req.query("startDate");
        const endDate = c.req.query("endDate");
        const search = c.req.query("search")?.toLowerCase();

        const logPath = logger.getLogPath();
        if (!existsSync(logPath)) {
            return c.json({ entries: [], total: 0, page, logPath });
        }

        try {
            const content = await fs.readFile(logPath, "utf-8");
            const lines = content.trim().split("\n").filter(Boolean);

            // Parse and filter
            let entries: Array<Record<string, unknown>> = [];
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    // Apply filters
                    if (levelFilter && entry.level !== levelFilter) continue;
                    if (categoryFilter && entry.category !== categoryFilter) continue;
                    if (startDate && entry.timestamp < startDate) continue;
                    if (endDate && entry.timestamp > endDate + "T23:59:59.999Z") continue;
                    if (search && !entry.message?.toLowerCase().includes(search) && !JSON.stringify(entry.data || "").toLowerCase().includes(search)) continue;
                    entries.push(entry);
                } catch { /* skip malformed lines */ }
            }

            // Reverse for newest-first
            entries.reverse();
            const total = entries.length;

            // Paginate
            const start = page * limit;
            entries = entries.slice(start, start + limit);

            return c.json({ entries, total, page, logPath });
        } catch (e) {
            return c.json({ entries: [], total: 0, page, logPath, error: String(e) });
        }
    });

    // ============== LOG STREAMING (SSE) ==============

    dashboard.get("/api/logs/stream", async (c) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                // Send initial heartbeat
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "connected" })}\n\n`));

                // Listen for new log entries
                const onEntry = (entry: unknown) => {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
                    } catch {
                        // Stream closed, clean up
                        logEmitter.removeListener("entry", onEntry);
                    }
                };
                logEmitter.on("entry", onEntry);

                // Heartbeat every 30s to keep connection alive
                const heartbeat = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                    } catch {
                        clearInterval(heartbeat);
                        logEmitter.removeListener("entry", onEntry);
                    }
                }, 30000);

                // Clean up on cancel
                c.req.raw.signal.addEventListener("abort", () => {
                    clearInterval(heartbeat);
                    logEmitter.removeListener("entry", onEntry);
                    try { controller.close(); } catch { /* already closed */ }
                });
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    });

    // ============== STATS ==============

    dashboard.get("/api/stats", async (c) => {
        const userCount = db.select({ count: sql<number>`count(*)` }).from(users).get();
        const sessionCount = db.select({ count: sql<number>`count(*)` }).from(sessions).get();
        const messageCount = db.select({ count: sql<number>`count(*)` }).from(messages).get();

        // Get in-memory active sessions
        let activeSessions = 1; // At least the dashboard session
        try {
            const { listActiveSessions } = await import("../sessions/index.js");
            activeSessions = listActiveSessions(60).length || 1; // Sessions active in last 60 min
        } catch { /* Fallback */ }

        const tokenUsage = db.select({
            inputTokens: sql<number>`coalesce(sum(input_tokens), 0)`,
            outputTokens: sql<number>`coalesce(sum(output_tokens), 0)`,
        }).from(messages).get();

        const chatHistory = getChatHistory();

        return c.json({
            users: userCount?.count ?? 0,
            sessions: activeSessions + (sessionCount?.count ?? 0),
            messages: (messageCount?.count ?? 0) + chatHistory.length,
            tokenUsage: {
                input: tokenUsage?.inputTokens ?? 0,
                output: tokenUsage?.outputTokens ?? 0,
                total: (tokenUsage?.inputTokens ?? 0) + (tokenUsage?.outputTokens ?? 0),
            },
        });
    });

    // ============== SESSIONS ==============

    dashboard.get("/api/sessions", (c) => {
        const limit = parseInt(c.req.query("limit") ?? "50");
        const offset = parseInt(c.req.query("offset") ?? "0");

        const allSessions = db.select({
            id: sessions.id,
            key: sessions.key,
            userId: sessions.userId,
            agentId: sessions.agentId,
            model: sessions.model,
            createdAt: sessions.createdAt,
            lastMessageAt: sessions.lastMessageAt,
        })
            .from(sessions)
            .orderBy(desc(sessions.createdAt))
            .limit(limit)
            .offset(offset)
            .all();

        return c.json({ sessions: allSessions });
    });

    // ============== AUDIT LOGS ==============

    dashboard.get("/api/audit-logs", (c) => {
        const limit = parseInt(c.req.query("limit") ?? "100");
        const offset = parseInt(c.req.query("offset") ?? "0");

        const logs = db.select()
            .from(auditLogs)
            .orderBy(desc(auditLogs.timestamp))
            .limit(limit)
            .offset(offset)
            .all();

        return c.json({ logs });
    });

    // ============== BROWSER SETTINGS ==============

    // Get browser automation settings
    dashboard.get("/api/settings/browser", async (c) => {
        try {
            const { db: rawDb } = await import("../db/index.js");

            // Read settings with raw SQL for reliability
            let settings: { backend?: string; browserosUrl?: string } = {};
            try {
                const result = rawDb.prepare("SELECT settings FROM tool_config WHERE id = ?").get("browser") as { settings: string } | undefined;
                if (result?.settings) {
                    settings = JSON.parse(result.settings);
                }
            } catch {
                // Table might not exist yet
            }

            return c.json({
                ok: true,
                backend: settings.backend || "playwright",
                browserosUrl: settings.browserosUrl || "http://127.0.0.1:9201",
            });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Update browser automation settings
    dashboard.post("/api/settings/browser", async (c) => {
        try {
            const { backend, browserosUrl } = await c.req.json() as {
                backend?: "playwright" | "browseros";
                browserosUrl?: string;
            };

            const settings = {
                backend: backend || "playwright",
                browserosUrl: browserosUrl || "http://127.0.0.1:9201",
            };

            // Use raw SQLite directly for reliability
            try {
                const { db: rawDb } = await import("../db/index.js");

                // Create table if not exists
                rawDb.exec(`
                    CREATE TABLE IF NOT EXISTS tool_config (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        settings TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Upsert the settings
                const settingsJson = JSON.stringify(settings);
                rawDb.prepare(`
                    INSERT INTO tool_config (id, name, settings, updated_at) 
                    VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(id) DO UPDATE SET settings = excluded.settings, updated_at = datetime('now')
                `).run("browser", "Browser Automation", settingsJson);

                console.log("[Browser Settings] Saved:", settings);
            } catch (dbError) {
                console.error("[Browser Settings] DB error:", dbError);
                throw dbError;
            }

            return c.json({ ok: true, ...settings });
        } catch (error) {
            console.error("[Browser Settings] Save error:", error);
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Check BrowserOS availability
    dashboard.get("/api/settings/browser/status", async (c) => {
        try {
            const { isBrowserOSAvailable } = await import("../tools/browser-os.js");
            const { toolConfig } = await import("../db/config-schema.js");

            // Get configured URL (gracefully handle missing table)
            let url = "http://127.0.0.1:9201";
            try {
                const result = await db.select().from(toolConfig).where(eq(toolConfig.id, "browser")).get();
                const settings = result?.settings as { browserosUrl?: string } || {};
                url = settings.browserosUrl || url;
            } catch {
                // Table might not exist yet, use default URL
            }

            const status = await isBrowserOSAvailable(url);

            return c.json({
                ok: true,
                browseros: {
                    url,
                    available: status.available,
                    running: status.running,
                    mcpEnabled: status.mcpEnabled,
                    version: status.version,
                    toolCount: status.toolCount,
                    error: status.error,
                },
                playwright: {
                    available: true, // Playwright is always available
                },
            });
        } catch (error) {
            console.error("[Browser Status API] Error:", error);
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // ============== HEARTBEAT SETTINGS ==============

    // Auto-start heartbeat on server boot
    import("../heartbeat/heartbeat.js").then(({ startHeartbeat }) => {
        startHeartbeat();
    }).catch(err => {
        console.warn("[Heartbeat] Failed to auto-start:", err);
    });

    // Get heartbeat config
    dashboard.get("/api/settings/heartbeat", async (c) => {
        try {
            const { getHeartbeatConfig, loadHeartbeatConfig } = await import("../heartbeat/heartbeat.js");
            loadHeartbeatConfig();
            const config = getHeartbeatConfig();
            return c.json({ ok: true, ...config });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Save heartbeat config
    dashboard.post("/api/settings/heartbeat", async (c) => {
        try {
            const body = await c.req.json() as Record<string, unknown>;
            const { updateHeartbeatConfig } = await import("../heartbeat/heartbeat.js");
            const config = updateHeartbeatConfig({
                enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
                every: typeof body.every === "string" ? body.every : undefined,
                prompt: typeof body.prompt === "string" ? body.prompt : undefined,
                activeHoursStart: typeof body.activeHoursStart === "string" ? body.activeHoursStart : undefined,
                activeHoursEnd: typeof body.activeHoursEnd === "string" ? body.activeHoursEnd : undefined,
                model: typeof body.model === "string" ? body.model : undefined,
                forwardTo: typeof body.forwardTo === "string" ? body.forwardTo : undefined,
            });
            return c.json({ ok: true, ...config });
        } catch (error) {
            console.error("[Heartbeat Settings] Save error:", error);
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Get heartbeat runtime status
    dashboard.get("/api/settings/heartbeat/status", async (c) => {
        try {
            const { getHeartbeatStatus } = await import("../heartbeat/heartbeat.js");
            const status = getHeartbeatStatus();
            return c.json({ ok: true, ...status });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Get HEARTBEAT.md content (for in-dashboard editor)
    dashboard.get("/api/settings/heartbeat/md", async (c) => {
        try {
            const { getHeartbeatMdContent } = await import("../heartbeat/heartbeat.js");
            const result = getHeartbeatMdContent();
            return c.json({ ok: true, ...result });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Save HEARTBEAT.md content (from in-dashboard editor)
    dashboard.post("/api/settings/heartbeat/md", async (c) => {
        try {
            const body = await c.req.json();
            const { saveHeartbeatMdContent } = await import("../heartbeat/heartbeat.js");
            saveHeartbeatMdContent(body.content || "");
            return c.json({ ok: true });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Get connected channels for heartbeat forwarding dropdown
    dashboard.get("/api/settings/heartbeat/channels", async (c) => {
        try {
            const connected: string[] = [];

            // Check WhatsApp via real-time status
            try {
                const { isWhatsAppConnected } = await import("../channels/whatsapp-baileys.js");
                if (isWhatsAppConnected()) connected.push("whatsapp");
            } catch { /* WhatsApp module not available */ }

            // Check other channels via channelConfigs
            for (const ch of ["telegram", "discord", "imessage"] as const) {
                if (channelConfigs.get(ch)?.connected) connected.push(ch);
            }

            return c.json({ ok: true, channels: connected });
        } catch (error) {
            return c.json({ ok: false, channels: [], error: String(error) }, 500);
        }
    });

    // Get heartbeat alerts (for dashboard polling)
    dashboard.get("/api/settings/heartbeat/alerts", async (c) => {
        try {
            const sinceId = c.req.query("since");
            const { getNewHeartbeatAlerts } = await import("../heartbeat/heartbeat.js");
            const alerts = getNewHeartbeatAlerts(sinceId || undefined);
            return c.json({ ok: true, alerts });
        } catch (error) {
            return c.json({ ok: false, alerts: [], error: String(error) }, 500);
        }
    });

    // ============== EXTENSIONS ==============

    // List all extensions
    dashboard.get("/api/extensions", async (c) => {
        try {
            const { getLoadedExtensions, getExtensionsDir } = await import("../tools/extend.js");
            const { readdirSync, readFileSync, existsSync } = await import("node:fs");
            const { join } = await import("node:path");

            const extensionsDir = getExtensionsDir();
            const loadedExtensions = getLoadedExtensions();
            const extensions: Array<{
                name: string;
                description: string;
                enabled: boolean;
                schedule?: string;
                channels?: string[];
                createdAt: string;
                updatedAt: string;
                running: boolean;
            }> = [];

            if (existsSync(extensionsDir)) {
                const dirs = readdirSync(extensionsDir, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                    .map(d => d.name);

                for (const name of dirs) {
                    const manifestPath = join(extensionsDir, name, "manifest.json");
                    if (existsSync(manifestPath)) {
                        try {
                            const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
                            const loaded = loadedExtensions.get(name);
                            extensions.push({
                                name,
                                description: manifest.description || "",
                                enabled: manifest.enabled ?? true,
                                schedule: manifest.schedule,
                                channels: manifest.channels,
                                createdAt: manifest.createdAt || new Date().toISOString(),
                                updatedAt: manifest.updatedAt || new Date().toISOString(),
                                running: !!loaded?.scheduledJob
                            });
                        } catch { /* skip invalid */ }
                    }
                }
            }

            return c.json({ ok: true, extensions });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Run an extension
    dashboard.post("/api/extensions/:name/run", async (c) => {
        const name = c.req.param("name");
        try {
            const { executeExtension } = await import("../tools/extend.js");
            const result = await executeExtension(name);
            return c.json({ ok: result.success, output: result.output, error: result.error });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Toggle extension enabled/disabled
    dashboard.post("/api/extensions/:name/toggle", async (c) => {
        const name = c.req.param("name");
        try {
            const { getExtensionsDir, hotReloadExtension } = await import("../tools/extend.js");
            const { readFileSync, writeFileSync, existsSync } = await import("node:fs");
            const { join } = await import("node:path");

            const manifestPath = join(getExtensionsDir(), name, "manifest.json");
            if (!existsSync(manifestPath)) {
                return c.json({ ok: false, error: "Extension not found" }, 404);
            }

            const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
            manifest.enabled = !manifest.enabled;
            manifest.updatedAt = new Date().toISOString();
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

            await hotReloadExtension(name);

            return c.json({ ok: true, enabled: manifest.enabled });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Hot reload an extension
    dashboard.post("/api/extensions/:name/reload", async (c) => {
        const name = c.req.param("name");
        try {
            const { hotReloadExtension } = await import("../tools/extend.js");
            await hotReloadExtension(name);
            return c.json({ ok: true, message: `Extension ${name} reloaded` });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Delete an extension
    dashboard.delete("/api/extensions/:name", async (c) => {
        const name = c.req.param("name");
        try {
            const { getExtensionsDir, getLoadedExtensions } = await import("../tools/extend.js");
            const { rmSync, existsSync } = await import("node:fs");
            const { join } = await import("node:path");

            const extPath = join(getExtensionsDir(), name);
            if (!existsSync(extPath)) {
                return c.json({ ok: false, error: "Extension not found" }, 404);
            }

            // Stop any scheduled job
            const loaded = getLoadedExtensions().get(name);
            if (loaded?.scheduledJob) {
                loaded.scheduledJob.stop();
            }
            getLoadedExtensions().delete(name);

            // Delete the directory
            rmSync(extPath, { recursive: true, force: true });

            return c.json({ ok: true, message: `Extension ${name} deleted` });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // Get extension source code
    dashboard.get("/api/extensions/:name/code", async (c) => {
        const name = c.req.param("name");
        try {
            const { getExtensionsDir } = await import("../tools/extend.js");
            const { readFileSync, existsSync } = await import("node:fs");
            const { join } = await import("node:path");

            const codePath = join(getExtensionsDir(), name, "index.ts");
            if (!existsSync(codePath)) {
                return c.json({ ok: false, error: "Extension code not found" }, 404);
            }

            const code = readFileSync(codePath, "utf-8");
            return c.json({ ok: true, code });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // ============== AI CHAT (for extensions) ==============

    // Allow extensions to send prompts to the active AI and get responses
    dashboard.post("/api/ai/chat", async (c) => {
        try {
            const { prompt, extensionName } = await c.req.json() as {
                prompt: string;
                extensionName?: string;
            };

            if (!prompt) {
                return c.json({ ok: false, error: "Prompt is required" }, 400);
            }

            // Find the active model (same logic as /api/chat)
            let effectiveModel: string | undefined;
            for (const [, config] of providerConfigs.entries()) {
                if (config.enabled && config.apiKey) {
                    effectiveModel = config.selectedModel || configStore.get("defaultModel") as string;
                    break;
                }
            }
            if (!effectiveModel) {
                effectiveModel = configStore.get("defaultModel") as string || "";
            }

            // Use a dedicated session for extensions
            const sessionId = extensionName ? `extension-${extensionName}` : "extension";

            setModel(effectiveModel);
            console.log(`[Extension AI] ${extensionName || "unknown"} → prompt: "${prompt.slice(0, 80)}..." (model: ${effectiveModel})`);

            const response = await processSessionMessage(sessionId, prompt, {
                model: effectiveModel,
                onToolStart: (tool) => console.log(`[Extension AI] 🔧 ${tool.name}`),
                onToolEnd: (tool) => console.log(`[Extension AI] ✅ ${tool.name} (${tool.status})`),
            });

            return c.json({
                ok: true,
                response: response.content,
                model: effectiveModel,
                toolCalls: response.toolCalls || [],
            });
        } catch (error) {
            console.error("[Extension AI] Error:", error);
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // ============== TOOL EXECUTION (for extensions) ==============

    // Execute a tool from extension context - FULL ACCESS to all system tools
    dashboard.post("/api/tools/execute", async (c) => {
        try {
            const { tool, args, extensionName } = await c.req.json() as {
                tool: string;
                args: Record<string, unknown>;
                extensionName?: string;
            };

            if (!tool) {
                return c.json({ ok: false, error: "Tool name is required" }, 400);
            }

            // Import registries
            const { toolRegistry } = await import("../tools/index.js");
            const { skillRegistry } = await import("../skills/index.js");

            // Create a context for the tool execution
            const context = {
                sessionId: extensionName || "extension",
                userId: "extension",
                workspaceDir: process.cwd(),
                sandboxed: false
            };

            // 1. Try tool registry first (exec, browser, file, etc.)
            const registeredTool = toolRegistry.get(tool);
            if (registeredTool) {
                const result = await toolRegistry.execute(tool, args, context);
                return c.json({
                    ok: result.success,
                    result: result.content,
                    error: result.error
                });
            }

            // 2. Try skill tools (github, weather, notion, etc.)
            const skillTools = skillRegistry.getAllTools();
            const skillTool = skillTools.find((st: { name: string }) => st.name === tool);
            if (skillTool) {
                const result = await skillTool.execute(args, context);
                return c.json({
                    ok: result.success,
                    result: result.content,
                    error: result.error
                });
            }

            // 3. Try channel functions (whatsapp, telegram, discord, slack)
            try {
                if (tool.includes("whatsapp") || tool === "wa_send") {
                    const { sendWhatsAppMessage } = await import("../channels/whatsapp-baileys.js");
                    const to = (args.to || args.number || args.phone) as string;
                    const message = (args.message || args.text || args.body) as string;
                    const result = await sendWhatsAppMessage(to, message);
                    return c.json({ ok: result.success, result: result.success ? `Sent to ${to}` : result.error });
                }

                if (tool.includes("telegram") || tool === "tg_send") {
                    const chatId = (args.chatId || args.chat_id || args.to) as string;
                    const message = (args.message || args.text || args.body) as string;
                    const botToken = process.env.TELEGRAM_BOT_TOKEN;
                    if (botToken) {
                        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ chat_id: chatId, text: message })
                        });
                        const data = await res.json() as { ok: boolean; description?: string };
                        return c.json({ ok: data.ok, result: data.ok ? `Sent to ${chatId}` : data.description });
                    }
                    return c.json({ ok: false, error: "TELEGRAM_BOT_TOKEN not configured" });
                }

                if (tool.includes("discord") || tool === "dc_send") {
                    const channelId = (args.channelId || args.channel_id || args.to) as string;
                    const message = (args.message || args.text || args.body) as string;
                    const botToken = process.env.DISCORD_BOT_TOKEN;
                    if (botToken) {
                        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                            method: "POST",
                            headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ content: message })
                        });
                        const data = await res.json() as { id?: string; message?: string };
                        return c.json({ ok: !!data.id, result: data.id ? `Sent to ${channelId}` : (data.message || "Failed") });
                    }
                    return c.json({ ok: false, error: "DISCORD_BOT_TOKEN not configured" });
                }

                if (tool.includes("slack") || tool === "slack_send") {
                    const channel = (args.channel || args.channelId || args.to) as string;
                    const message = (args.message || args.text || args.body) as string;
                    const slackToken = process.env.SLACK_BOT_TOKEN;
                    if (slackToken) {
                        const res = await fetch("https://slack.com/api/chat.postMessage", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${slackToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ channel, text: message })
                        });
                        const data = await res.json() as { ok: boolean; error?: string };
                        return c.json({ ok: data.ok, result: data.ok ? `Sent to ${channel}` : data.error });
                    }
                    return c.json({ ok: false, error: "SLACK_BOT_TOKEN not configured" });
                }
            } catch (channelErr) {
                return c.json({ ok: false, error: `Channel error: ${String(channelErr)}` }, 500);
            }

            return c.json({ ok: false, error: `Unknown tool: ${tool}. Use /api/tools/available to list all tools.` }, 404);
        } catch (error) {
            console.error("[Tool Execute Error]", error);
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // List available tools for extensions
    dashboard.get("/api/tools/available", async (c) => {
        try {
            const { toolRegistry } = await import("../tools/index.js");
            const { skillRegistry } = await import("../skills/index.js");

            const tools = toolRegistry.list().map((t: { name: string; description: string; category: string }) => ({
                name: t.name,
                description: t.description,
                category: t.category
            }));

            const skillTools = skillRegistry.getAllTools().map((t: { name: string; description: string }) => ({
                name: t.name,
                description: t.description,
                category: "skill"
            }));

            return c.json({ ok: true, tools: [...tools, ...skillTools] });
        } catch (error) {
            return c.json({ ok: false, error: String(error) }, 500);
        }
    });

    // ============== HTML SHELL ==============

    dashboard.get("*", (c) => {
        return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenWhale Dashboard</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐋</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/dashboard/assets/style.css">
</head>
<body>
  <div id="root">
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh;">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  </div>
  <script src="/dashboard/assets/main.js"></script>
</body>
</html>`);
    });

    return dashboard;
}
