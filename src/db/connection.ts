import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { DatabaseConfig } from "../config/loader.js";
import * as schema from "./schema.js";

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

export function createDatabase(config: DatabaseConfig): DrizzleDB {
    if (config.type !== "sqlite") {
        console.warn(`Database type '${config.type}' requested but only SQLite is currently supported. Using SQLite.`);
    }

    const url = config.url.replace("file:", "");
    const sqlite = new Database(url);
    sqlite.pragma("journal_mode = WAL");
    return drizzle(sqlite, { schema });
}
