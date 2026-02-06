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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID, createHash } from "node:crypto";
import {
    setModel,
    processMessage as processSessionMessage,
    processCommand as processSessionCommand,
    getChatHistory,
    clearChatHistory,
} from "../sessions/session-service.js";
import { registry } from "../providers/index.js";
import { createAnthropicProvider } from "../providers/anthropic.js";
import { createOpenAIProvider, createDeepSeekProvider } from "../providers/openai-compatible.js";
import { createGoogleProvider } from "../providers/google.js";

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
                baseUrl: p.baseUrl ?? undefined
            });
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
                baseUrl: cfg.baseUrl
            })
            .onConflictDoUpdate({
                target: providerConfig.id,
                set: { enabled: cfg.enabled, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl }
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
        return c.text(js, 200, { "Content-Type": "application/javascript" });
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

        // FFmpeg
        try {
            execSync("which ffmpeg", { stdio: "ignore" });
            prereqs.ffmpeg = { installed: true };
        } catch { prereqs.ffmpeg = { installed: false }; }

        // ImageSnap (macOS)
        try {
            execSync("which imagesnap", { stdio: "ignore" });
            prereqs.imagesnap = { installed: true };
        } catch { prereqs.imagesnap = { installed: false }; }

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
                    providerConfigs.set(type, { enabled: cfg.enabled ?? true, apiKey: cfg.apiKey });
                    // Also set environment variable for immediate use
                    if (type === "anthropic") process.env.ANTHROPIC_API_KEY = cfg.apiKey;
                    if (type === "openai") process.env.OPENAI_API_KEY = cfg.apiKey;
                    if (type === "google") process.env.GOOGLE_API_KEY = cfg.apiKey;
                    // Persist to database
                    await saveProviderToDB(db, type, providerConfigs.get(type)!);
                }
            }
        }

        if (data.channels) {
            for (const [type, enabled] of Object.entries(data.channels)) {
                const existing = channelConfigs.get(type) || { enabled: false, connected: false };
                channelConfigs.set(type, { ...existing, enabled: enabled as boolean });
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
                    const defaultModels: Record<string, string> = {
                        anthropic: "claude-sonnet-4-20250514",
                        openai: "gpt-4o",
                        google: "gemini-2.0-flash",
                        deepseek: "deepseek-chat",
                        ollama: "llama3.2",
                    };
                    effectiveModel = config.selectedModel || defaultModels[type] || "deepseek-chat";
                    console.log(`[Dashboard] Using enabled provider: ${type}, model: ${effectiveModel}`);
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
                effectiveModel = configStore.get("defaultModel") || "claude-sonnet-4-20250514";
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
            const { createAnthropicProvider } = await import("../providers/anthropic.js");
            const telegram = createTelegramAdapter();
            if (telegram) {
                const aiProvider = createAnthropicProvider();
                telegram.setAIProvider(aiProvider, "claude-sonnet-4-20250514");
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
            const { createAnthropicProvider } = await import("../providers/anthropic.js");
            const discord = createDiscordAdapter();
            if (discord) {
                const aiProvider = createAnthropicProvider();
                discord.setAIProvider(aiProvider, "claude-sonnet-4-20250514");
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
            }
        ];

        return c.json({ skills: skillList });
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
        }

        // Persist to database
        await saveSkillToDB(db, id, skillConfigs.get(id)!);

        return c.json({ ok: true });
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

            // Persist to database using raw SQL
            try {
                sqliteDb.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, String(value));
            } catch (e) {
                console.error(`[Dashboard] Failed to persist config ${key}:`, e);
            }
        }

        console.log(`[Dashboard] Config saved, defaultModel: ${configStore.get("defaultModel")}`);
        return c.json({ ok: true });
    });

    dashboard.get("/api/config", (c) => {
        return c.json(Object.fromEntries(configStore));
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
                clearTimeout(loaded.scheduledJob);
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
  <script type="module" src="/dashboard/assets/main.js"></script>
</body>
</html>`);
    });

    return dashboard;
}
