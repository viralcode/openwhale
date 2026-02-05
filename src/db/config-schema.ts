/**
 * Configuration Schema - SQLite tables for dashboard settings
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * General configuration key-value store
 */
export const config = sqliteTable("config", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    category: text("category").default("general"),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Channel configuration (WhatsApp, Telegram, Discord, etc.)
 */
export const channelConfig = sqliteTable("channel_config", {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // whatsapp, telegram, discord, slack
    enabled: integer("enabled", { mode: "boolean" }).default(false),
    displayName: text("display_name"),
    settings: text("settings", { mode: "json" }).$type<Record<string, unknown>>(),
    credentials: text("credentials", { mode: "json" }).$type<Record<string, string>>(), // Encrypted
    connectedAt: integer("connected_at", { mode: "timestamp" }),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    messageCount: integer("message_count").default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Skill configuration (GitHub, Spotify, Weather, etc.)
 */
export const skillConfig = sqliteTable("skill_config", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(false),
    apiKey: text("api_key"), // Encrypted
    settings: text("settings", { mode: "json" }).$type<Record<string, unknown>>(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Provider configuration (Anthropic, OpenAI, etc.)
 */
export const providerConfig = sqliteTable("provider_config", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(), // anthropic, openai, google, ollama
    enabled: integer("enabled", { mode: "boolean" }).default(false),
    apiKey: text("api_key"), // Encrypted
    baseUrl: text("base_url"),
    defaultModel: text("default_model"),
    settings: text("settings", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Setup wizard state
 */
export const setupState = sqliteTable("setup_state", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    completed: integer("completed", { mode: "boolean" }).default(false),
    currentStep: integer("current_step").default(0),
    stepsCompleted: text("steps_completed", { mode: "json" }).$type<string[]>(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Chat messages for dashboard
 */
export const dashboardMessages = sqliteTable("dashboard_messages", {
    id: text("id").primaryKey(),
    role: text("role").notNull(), // user, assistant, system, tool
    content: text("content").notNull(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
        result?: unknown;
        status: "pending" | "running" | "completed" | "error";
    }>>(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/**
 * Dashboard users for authentication
 */
export const dashboardUsers = sqliteTable("dashboard_users", {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").default("user"), // admin, user
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
});

/**
 * Auth sessions for dashboard login
 */
export const authSessions = sqliteTable("auth_sessions", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
