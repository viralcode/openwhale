/**
 * OpenWhale Dashboard Routes - Complete API
 * Setup wizard, chat, channels, providers, skills, configuration
 */

import { Hono } from "hono";
import type { DrizzleDB } from "../db/connection.js";
import type { OpenWhaleConfig } from "../config/loader.js";
import { sessions, users, messages, auditLogs } from "../db/schema.js";
import { providerConfig, skillConfig, channelConfig, setupState as setupStateTable } from "../db/config-schema.js";
import { desc, sql, eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
    initializeProvider,
    setModel,
    processMessage as processSessionMessage,
    processCommand as processSessionCommand,
    getChatHistory,
    clearChatHistory,
} from "../sessions/session-service.js";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

const configStore = new Map<string, unknown>();
const setupState = { completed: false, currentStep: 0, stepsCompleted: [] as string[] };

// In-memory caches for configs (synced with DB)
const providerConfigs = new Map<string, { enabled: boolean; apiKey?: string; baseUrl?: string }>();
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

        console.log("[Dashboard] Loaded configs from database");
    } catch (e) {
        console.error("[Dashboard] Failed to load configs from DB:", e);
    }
}

async function saveProviderToDB(db: DrizzleDB, type: string, cfg: { enabled: boolean; apiKey?: string; baseUrl?: string }) {
    try {
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
    } catch (e) {
        console.error("[Dashboard] Failed to save provider config:", e);
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

    // Load configs from database on startup
    loadConfigsFromDB(db).then(() => {
        console.log("[Dashboard] ✅ Configs loaded, env vars set for skills");
        console.log("[Dashboard] GITHUB_TOKEN:", process.env.GITHUB_TOKEN ? "Set" : "Not set");
    }).catch((e) => {
        console.error("[Dashboard] Failed to load configs:", e);
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
        const { message, model } = await c.req.json();

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
            // Initialize provider if needed
            const apiKey = providerConfigs.get("anthropic")?.apiKey || process.env.ANTHROPIC_API_KEY;
            if (apiKey) {
                initializeProvider(apiKey, model);
            }
            if (model) {
                setModel(model);
            }

            // Process message with full tool support (iterative loop)
            const response = await processSessionMessage("dashboard", message, {
                model,
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
                enabled: true,
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
            }
        ];

        return c.json({ providers: providerList });
    });

    // Save provider config
    dashboard.post("/api/providers/:type/config", async (c) => {
        const type = c.req.param("type");
        const { apiKey, baseUrl, enabled } = await c.req.json();

        const existing = providerConfigs.get(type) || { enabled: false };
        providerConfigs.set(type, {
            ...existing,
            enabled: enabled ?? existing.enabled,
            apiKey: apiKey || existing.apiKey,
            baseUrl: baseUrl || (existing as { baseUrl?: string }).baseUrl
        });

        // Update env vars
        if (apiKey) {
            if (type === "anthropic") process.env.ANTHROPIC_API_KEY = apiKey;
            if (type === "openai") process.env.OPENAI_API_KEY = apiKey;
            if (type === "google") process.env.GOOGLE_API_KEY = apiKey;
        }

        // Persist to database
        await saveProviderToDB(db, type, providerConfigs.get(type)!);

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
            if (key === "defaultModel") configStore.set("defaultModel", value);
        }

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
