/**
 * Database Singleton - Provides access to the SQLite database
 */

import Database from "better-sqlite3";
import { join } from "path";
// import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

// Ensure the data directory exists
// Ensure the data directory exists
const dataDir = join(process.cwd(), "data");
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, "openwhale.db");

// Create the database connection
import type BetterSqlite3 from "better-sqlite3";
export const db: BetterSqlite3.Database = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Ensure config table exists (for storing defaultModel and other settings)
db.exec(`
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS provider_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 0,
        api_key TEXT,
        base_url TEXT,
        default_model TEXT,
        settings TEXT,
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS channel_config (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 0,
        display_name TEXT,
        settings TEXT,
        credentials TEXT,
        connected_at INTEGER,
        last_message_at INTEGER,
        message_count INTEGER DEFAULT 0,
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS skill_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER DEFAULT 0,
        api_key TEXT,
        settings TEXT,
        last_used_at INTEGER,
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS setup_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        completed INTEGER DEFAULT 0,
        current_step INTEGER DEFAULT 0,
        steps_completed TEXT,
        completed_at INTEGER,
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS dashboard_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER
    );
    
    -- Core Session Tables
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        name TEXT,
        role TEXT DEFAULT 'user' NOT NULL,
        oauth_provider TEXT,
        oauth_id TEXT,
        avatar_url TEXT,
        mfa_enabled INTEGER DEFAULT 0,
        mfa_secret TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_login_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        user_id TEXT,
        agent_id TEXT DEFAULT 'default' NOT NULL,
        channel TEXT,
        channel_account_id TEXT,
        model TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_message_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_results TEXT,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
`);

// Re-export the connection module for drizzle users
export { createDatabase, type DrizzleDB } from "./connection.js";
