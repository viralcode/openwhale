/**
 * Database Singleton - Provides access to the SQLite database
 */

import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

// Ensure the data directory exists
const dataDir = join(homedir(), ".openwhale");
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
    )
`);

// Re-export the connection module for drizzle users
export { createDatabase, type DrizzleDB } from "./connection.js";
