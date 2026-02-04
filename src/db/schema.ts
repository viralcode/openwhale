import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Users table
export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    name: text("name"),
    role: text("role", { enum: ["admin", "user", "readonly", "api-client"] }).default("user").notNull(),
    oauthProvider: text("oauth_provider"),
    oauthId: text("oauth_id"),
    avatarUrl: text("avatar_url"),
    mfaEnabled: integer("mfa_enabled", { mode: "boolean" }).default(false),
    mfaSecret: text("mfa_secret"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
}, (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
    oauthIdx: index("users_oauth_idx").on(table.oauthProvider, table.oauthId),
}));

// API Keys table
export const apiKeys = sqliteTable("api_keys", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(), // First 8 chars for display
    scopes: text("scopes", { mode: "json" }).$type<string[]>().default([]),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
}, (table) => ({
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
    keyHashIdx: index("api_keys_key_hash_idx").on(table.keyHash),
}));

// Sessions table (for agent conversations)
export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(), // e.g., "agent:main:default"
    userId: text("user_id").references(() => users.id),
    agentId: text("agent_id").notNull().default("default"),
    channel: text("channel"), // whatsapp, telegram, discord, etc.
    channelAccountId: text("channel_account_id"),
    model: text("model"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
}, (table) => ({
    keyIdx: index("sessions_key_idx").on(table.key),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
}));

// Messages table
export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<unknown[]>(),
    toolResults: text("tool_results", { mode: "json" }).$type<unknown[]>(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
    sessionIdIdx: index("messages_session_id_idx").on(table.sessionId),
}));

// Audit logs table
export const auditLogs = sqliteTable("audit_logs", {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    action: text("action").notNull(),
    resource: text("resource"),
    resourceId: text("resource_id"),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
}));

// Refresh tokens table
export const refreshTokens = sqliteTable("refresh_tokens", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
}, (table) => ({
    userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
    tokenHashIdx: index("refresh_tokens_token_hash_idx").on(table.tokenHash),
}));

// Cron jobs table (for scheduled tasks)
export const cronJobs = sqliteTable("cron_jobs", {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    sessionId: text("session_id").references(() => sessions.id),
    expression: text("expression").notNull(), // Cron expression
    task: text("task").notNull(),
    systemEvent: text("system_event"),
    enabled: integer("enabled", { mode: "boolean" }).default(true),
    lastRunAt: integer("last_run_at", { mode: "timestamp" }),
    nextRunAt: integer("next_run_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Processed messages table (for deduplication / loop prevention AND message persistence)
export const processedMessages = sqliteTable("processed_messages", {
    id: text("id").primaryKey(), // WhatsApp message ID
    channel: text("channel").notNull().default("whatsapp"),
    from: text("from_number"),
    to: text("to_number"),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    content: text("content"), // Message text content
    contactName: text("contact_name"), // Contact display name if available
    mediaType: text("media_type"), // image, video, audio, document, sticker, or null for text
    mediaUrl: text("media_url"), // URL/path to media file if applicable
    processedAt: integer("processed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
    channelIdx: index("processed_messages_channel_idx").on(table.channel),
    fromIdx: index("processed_messages_from_idx").on(table.from),
    processedAtIdx: index("processed_messages_processed_at_idx").on(table.processedAt),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type ProcessedMessage = typeof processedMessages.$inferSelect;
export type NewProcessedMessage = typeof processedMessages.$inferInsert;
