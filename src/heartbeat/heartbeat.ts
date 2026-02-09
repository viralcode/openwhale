/**
 * OpenWhale Heartbeat Service
 * 
 * Runs periodic AI agent turns so the model can proactively surface
 * anything that needs attention without the user having to ask.
 * 
 * Inspired by OpenClaw's heartbeat system:
 * - Configurable interval (default: 30m)
 * - Reads HEARTBEAT.md from workspace if it exists
 * - Suppresses HEARTBEAT_OK replies
 * - Active hours support (skip night-time ticks)
 * - Config stored in tool_config SQLite table
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { homedir } from "node:os";
import cron, { type ScheduledTask } from "node-cron";
import { logger } from "../logger.js";
import { db } from "../db/index.js";

// ============== TYPES ==============

export interface HeartbeatConfig {
    enabled: boolean;
    every: string;             // e.g. "30m", "1h", "15m"
    prompt: string;
    activeHoursStart: string;  // e.g. "08:00"
    activeHoursEnd: string;    // e.g. "24:00"
    model: string;             // empty = use current default
    forwardTo: string;         // "" = dashboard only, "all" = all connected, or channel name
}

export interface HeartbeatAlert {
    id: string;
    text: string;
    timestamp: string;
    forwardedTo: string[];
}

export interface HeartbeatStatus {
    running: boolean;
    enabled: boolean;
    every: string;
    lastRunAt: string | null;
    lastResult: "ok" | "alert" | "skipped" | "error" | null;
    nextDueAt: string | null;
    heartbeatMdExists: boolean;
}

// ============== CONSTANTS ==============

const HEARTBEAT_TOKEN = "HEARTBEAT_OK";
const HEARTBEAT_MD_PATH = join(homedir(), ".openwhale", "HEARTBEAT.md");

const DEFAULT_CONFIG: HeartbeatConfig = {
    enabled: false,
    every: "30m",
    prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
    activeHoursStart: "",
    activeHoursEnd: "",
    model: "",
    forwardTo: "",
};

const DEFAULT_ACK_MAX_CHARS = 300;

// ============== STATE ==============

let scheduledTask: ScheduledTask | null = null;
let currentConfig: HeartbeatConfig = { ...DEFAULT_CONFIG };
let lastRunAt: Date | null = null;
let lastResult: HeartbeatStatus["lastResult"] = null;

// Alert queue for dashboard polling
const alertQueue: HeartbeatAlert[] = [];
const MAX_ALERTS = 50;

// ============== CONFIG PERSISTENCE ==============

function getDb() {
    return db;
}

function ensureTable(): void {
    try {
        const database = getDb();
        database.exec(`
            CREATE TABLE IF NOT EXISTS tool_config (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                settings TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
    } catch {
        // Table may already exist
    }
}

export function loadHeartbeatConfig(): HeartbeatConfig {
    try {
        ensureTable();
        const database = getDb();
        const row = database.prepare("SELECT settings FROM tool_config WHERE id = ?").get("heartbeat") as { settings: string } | undefined;
        if (row?.settings) {
            const saved = JSON.parse(row.settings);
            currentConfig = { ...DEFAULT_CONFIG, ...saved };
        }
    } catch {
        // Use defaults
    }
    return currentConfig;
}

export function saveHeartbeatConfig(config: Partial<HeartbeatConfig>): HeartbeatConfig {
    try {
        ensureTable();
        const merged = { ...currentConfig, ...config };
        currentConfig = merged;

        const database = getDb();
        const settingsJson = JSON.stringify(merged);
        database.prepare(`
            INSERT INTO tool_config (id, name, settings, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET settings = excluded.settings, updated_at = datetime('now')
        `).run("heartbeat", "Heartbeat", settingsJson);

        logger.info("heartbeat", "Config saved", { config: merged });
    } catch (err) {
        logger.error("heartbeat", "Failed to save config", { error: String(err) });
    }
    return currentConfig;
}

// ============== HEARTBEAT.MD ==============

const DEFAULT_HEARTBEAT_MD = `# Heartbeat Tasks

Add tasks below for the AI to check on each heartbeat tick.
Completed items can be removed or checked off.

- [ ] Example: Check if any new GitHub issues need attention
- [ ] Example: Remind me about upcoming meetings
`;

/**
 * Ensure the default HEARTBEAT.md exists on first run.
 */
export function ensureDefaultHeartbeatMd(): void {
    if (!existsSync(HEARTBEAT_MD_PATH)) {
        try {
            mkdirSync(dirname(HEARTBEAT_MD_PATH), { recursive: true });
            writeFileSync(HEARTBEAT_MD_PATH, DEFAULT_HEARTBEAT_MD, "utf-8");
            logger.info("heartbeat", "Created default HEARTBEAT.md", { path: HEARTBEAT_MD_PATH });
        } catch (err) {
            logger.error("heartbeat", "Failed to create default HEARTBEAT.md", { error: String(err) });
        }
    }
}

function readHeartbeatMd(): string | null {
    try {
        if (existsSync(HEARTBEAT_MD_PATH)) {
            return readFileSync(HEARTBEAT_MD_PATH, "utf-8");
        }
    } catch {
        // File not readable
    }
    return null;
}

/**
 * Read HEARTBEAT.md content (for dashboard editor).
 */
export function getHeartbeatMdContent(): { content: string; path: string; exists: boolean } {
    const content = readHeartbeatMd();
    return {
        content: content ?? DEFAULT_HEARTBEAT_MD,
        path: HEARTBEAT_MD_PATH,
        exists: existsSync(HEARTBEAT_MD_PATH),
    };
}

/**
 * Write HEARTBEAT.md content (from dashboard editor).
 */
export function saveHeartbeatMdContent(content: string): void {
    try {
        mkdirSync(dirname(HEARTBEAT_MD_PATH), { recursive: true });
        writeFileSync(HEARTBEAT_MD_PATH, content, "utf-8");
        logger.info("heartbeat", "HEARTBEAT.md saved from dashboard");
    } catch (err) {
        logger.error("heartbeat", "Failed to save HEARTBEAT.md", { error: String(err) });
        throw err;
    }
}

function isHeartbeatMdEffectivelyEmpty(content: string | null): boolean {
    if (content === null) return false; // Missing file should still run
    const lines = content.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Skip markdown headers
        if (/^#+ /.test(trimmed) || /^#+$/.test(trimmed)) continue;
        // Skip empty checkboxes
        if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) continue;
        // Found actionable content
        return false;
    }
    return true;
}

// ============== ACTIVE HOURS ==============

function parseTime(raw: string): { hours: number; minutes: number } | null {
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours > 24 || minutes > 59) return null;
    return { hours, minutes };
}

function isWithinActiveHours(config: HeartbeatConfig): boolean {
    if (!config.activeHoursStart && !config.activeHoursEnd) return true;

    const start = parseTime(config.activeHoursStart || "00:00");
    const end = parseTime(config.activeHoursEnd || "24:00");
    if (!start || !end) return true; // Invalid config = always active

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Wraps around midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// ============== RESPONSE HANDLING ==============

function stripHeartbeatToken(reply: string): { shouldSkip: boolean; text: string } {
    const trimmed = reply.trim();
    if (!trimmed) return { shouldSkip: true, text: "" };

    if (!trimmed.includes(HEARTBEAT_TOKEN)) {
        return { shouldSkip: false, text: trimmed };
    }

    // Strip token from start/end
    let text = trimmed;
    let didStrip = false;
    let changed = true;
    while (changed) {
        changed = false;
        const next = text.trim();
        if (next.startsWith(HEARTBEAT_TOKEN)) {
            text = next.slice(HEARTBEAT_TOKEN.length).trimStart();
            didStrip = true;
            changed = true;
            continue;
        }
        if (next.endsWith(HEARTBEAT_TOKEN)) {
            text = next.slice(0, next.length - HEARTBEAT_TOKEN.length).trimEnd();
            didStrip = true;
            changed = true;
        }
    }

    if (!didStrip) return { shouldSkip: false, text: trimmed };
    if (!text.trim()) return { shouldSkip: true, text: "" };
    // If remaining text is short enough, treat as ack
    if (text.trim().length <= DEFAULT_ACK_MAX_CHARS) {
        return { shouldSkip: true, text: "" };
    }
    return { shouldSkip: false, text: text.trim() };
}

// ============== INTERVAL PARSING ==============

function parseIntervalToCron(every: string): string | null {
    const match = every.match(/^(\d+)(m|h)$/);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit === "m") {
        if (value < 1 || value > 59) return null;
        return `*/${value} * * * *`;
    }
    if (unit === "h") {
        if (value < 1 || value > 23) return null;
        return `0 */${value} * * *`;
    }
    return null;
}

// ============== CORE HEARTBEAT LOGIC ==============

async function runHeartbeatOnce(): Promise<void> {
    const config = currentConfig;

    // Check active hours
    if (!isWithinActiveHours(config)) {
        logger.debug("heartbeat", "Skipped: outside active hours");
        lastResult = "skipped";
        return;
    }

    // Read HEARTBEAT.md
    const heartbeatMd = readHeartbeatMd();
    if (heartbeatMd !== null && isHeartbeatMdEffectivelyEmpty(heartbeatMd)) {
        logger.debug("heartbeat", "Skipped: HEARTBEAT.md is effectively empty");
        lastResult = "skipped";
        return;
    }

    // Build prompt
    let prompt = `[HEARTBEAT — AUTO-EXECUTE]\n`;
    prompt += config.prompt || DEFAULT_CONFIG.prompt;
    if (heartbeatMd !== null) {
        prompt += `\n\n--- HEARTBEAT.md ---\n${heartbeatMd}\n--- END HEARTBEAT.md ---`;
    }

    const tz = getSystemTimezone();
    const localTime = new Date().toLocaleString("en-US", { timeZone: tz });
    prompt += `\n\nCurrent time: ${localTime} (${tz})`;

    logger.info("heartbeat", "Running heartbeat tick", { time: localTime });
    lastRunAt = new Date();

    try {
        const { processMessage, getCurrentModel } = await import("../sessions/session-service.js");
        const model = config.model || getCurrentModel();

        const response = await processMessage("heartbeat", prompt, {
            model,
            maxIterations: 10,
        });

        const replyText = response.content || "";
        const { shouldSkip, text } = stripHeartbeatToken(replyText);

        if (shouldSkip) {
            logger.info("heartbeat", "HEARTBEAT_OK — nothing needs attention");
            lastResult = "ok";
        } else {
            logger.info("heartbeat", "Heartbeat alert", { alert: text.slice(0, 200) });
            lastResult = "alert";

            // Queue alert for dashboard polling
            const alert: HeartbeatAlert = {
                id: `hb_${Date.now()}`,
                text,
                timestamp: new Date().toISOString(),
                forwardedTo: [],
            };

            // Forward to channels if configured
            const forwardedTo = await forwardAlertToChannels(text, config.forwardTo);
            alert.forwardedTo = forwardedTo;

            alertQueue.push(alert);
            if (alertQueue.length > MAX_ALERTS) alertQueue.shift();
        }
    } catch (err) {
        logger.error("heartbeat", "Heartbeat tick failed", { error: String(err) });
        lastResult = "error";
    }
}

function getSystemTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return "UTC";
    }
}

// ============== LIFECYCLE ==============

export function startHeartbeat(): boolean {
    const config = loadHeartbeatConfig();

    // Always ensure default HEARTBEAT.md exists
    ensureDefaultHeartbeatMd();

    if (!config.enabled) {
        logger.info("heartbeat", "Heartbeat is disabled");
        return false;
    }

    // Stop existing if any
    stopHeartbeat();

    const cronExpr = parseIntervalToCron(config.every || "30m");
    if (!cronExpr) {
        logger.error("heartbeat", "Invalid interval", { every: config.every });
        return false;
    }

    scheduledTask = cron.schedule(cronExpr, () => {
        runHeartbeatOnce().catch(err => {
            logger.error("heartbeat", "Heartbeat tick error", { error: String(err) });
        });
    });

    logger.info("heartbeat", `Heartbeat started: every ${config.every}`, {
        cronExpr,
        activeHours: config.activeHoursStart ? `${config.activeHoursStart}-${config.activeHoursEnd}` : "always",
    });
    console.log(`[Heartbeat] 💓 Started: every ${config.every}`);
    return true;
}

export function stopHeartbeat(): void {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
        logger.info("heartbeat", "Heartbeat stopped");
        console.log("[Heartbeat] Stopped");
    }
}

export function updateHeartbeatConfig(config: Partial<HeartbeatConfig>): HeartbeatConfig {
    const saved = saveHeartbeatConfig(config);

    // Restart if running or if enabling
    if (scheduledTask || saved.enabled) {
        stopHeartbeat();
        if (saved.enabled) {
            startHeartbeat();
        }
    }

    return saved;
}

export function getHeartbeatStatus(): HeartbeatStatus {
    return {
        running: scheduledTask !== null,
        enabled: currentConfig.enabled,
        every: currentConfig.every || "30m",
        lastRunAt: lastRunAt?.toISOString() ?? null,
        lastResult,
        nextDueAt: null, // node-cron doesn't expose next fire time easily
        heartbeatMdExists: existsSync(HEARTBEAT_MD_PATH),
    };
}

export function getHeartbeatConfig(): HeartbeatConfig {
    return { ...currentConfig };
}

async function forwardAlertToChannels(text: string, forwardTo: string): Promise<string[]> {
    if (!forwardTo) return [];

    const forwardedTo: string[] = [];
    const alertPrefix = "💓 Heartbeat Alert:\n\n";
    const messageText = alertPrefix + text;

    // Determine which channels to try
    const targetChannels = forwardTo === "all"
        ? ["whatsapp", "telegram", "discord", "imessage"]
        : [forwardTo];

    for (const channel of targetChannels) {
        try {
            const sent = await sendToChannel(channel, messageText);
            if (sent) {
                forwardedTo.push(channel);
                logger.info("heartbeat", `Alert forwarded to ${channel}`);
            }
        } catch (err) {
            logger.error("heartbeat", `Error forwarding to ${channel}`, { error: String(err) });
        }
    }

    return forwardedTo;
}

async function sendToChannel(channel: string, text: string): Promise<boolean> {
    switch (channel) {
        case "whatsapp": {
            const { isWhatsAppConnected, sendWhatsAppMessage } = await import("../channels/whatsapp-baileys.js");
            if (!isWhatsAppConnected()) return false;
            const recipient = resolveChannelRecipient(channel);
            if (!recipient) { logger.warn("heartbeat", "No WhatsApp recipient configured"); return false; }
            const result = await sendWhatsAppMessage(recipient, text);
            return result.success;
        }
        case "telegram": {
            const recipient = resolveChannelRecipient(channel);
            if (!recipient) { logger.warn("heartbeat", "No Telegram chat_id configured"); return false; }
            const token = resolveChannelToken("telegram");
            if (!token) { logger.warn("heartbeat", "No Telegram bot token configured"); return false; }
            const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: recipient, text, parse_mode: "Markdown" }),
            });
            const data = await resp.json() as { ok: boolean };
            return data.ok;
        }
        case "discord": {
            const recipient = resolveChannelRecipient(channel);
            if (!recipient) { logger.warn("heartbeat", "No Discord channel_id configured"); return false; }
            const token = resolveChannelToken("discord");
            if (!token) { logger.warn("heartbeat", "No Discord bot token configured"); return false; }
            const resp = await fetch(`https://discord.com/api/v10/channels/${recipient}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bot ${token}` },
                body: JSON.stringify({ content: text }),
            });
            return resp.ok;
        }
        default:
            logger.warn("heartbeat", `Channel ${channel} forwarding not implemented`);
            return false;
    }
}

function resolveChannelRecipient(channel: string): string | null {
    try {
        // Check DB for saved channel config
        const database = getDb();
        const row = database.prepare("SELECT settings FROM channel_config WHERE channel_type = ?").get(channel) as { settings: string } | undefined;
        if (row?.settings) {
            const config = JSON.parse(row.settings);
            if (channel === "whatsapp" && config.ownerNumber) return config.ownerNumber;
            if (channel === "telegram" && config.chatId) return String(config.chatId);
            if (channel === "discord" && config.channelId) return String(config.channelId);
        }
    } catch { /* table might not exist */ }

    // Fallback: environment variables
    switch (channel) {
        case "whatsapp": return process.env.WHATSAPP_OWNER_NUMBER || null;
        case "telegram": return process.env.TELEGRAM_CHAT_ID || null;
        case "discord": return process.env.DISCORD_CHANNEL_ID || null;
        case "imessage": return process.env.IMESSAGE_RECIPIENT || null;
        default: return null;
    }
}

function resolveChannelToken(channel: string): string | null {
    try {
        const database = getDb();
        const row = database.prepare("SELECT settings FROM channel_config WHERE channel_type = ?").get(channel) as { settings: string } | undefined;
        if (row?.settings) {
            const config = JSON.parse(row.settings);
            if (config.token) return config.token;
            if (config.botToken) return config.botToken;
        }
    } catch { /* */ }

    switch (channel) {
        case "telegram": return process.env.TELEGRAM_BOT_TOKEN || null;
        case "discord": return process.env.DISCORD_BOT_TOKEN || null;
        default: return null;
    }
}

// ============== ALERT QUEUE (for dashboard polling) ==============

export function getHeartbeatAlerts(limit = 20): HeartbeatAlert[] {
    return alertQueue.slice(-limit);
}

export function getNewHeartbeatAlerts(sinceId?: string): HeartbeatAlert[] {
    if (!sinceId) return alertQueue.slice(-10);
    const idx = alertQueue.findIndex(a => a.id === sinceId);
    if (idx === -1) return alertQueue.slice(-10);
    return alertQueue.slice(idx + 1);
}
