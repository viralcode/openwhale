/**
 * Extension Secrets Storage
 * 
 * Securely stores API tokens and secrets for extensions in SQLite.
 * Secrets are stored per-extension and accessed via the extension SDK.
 */

import { db } from "../db/index.js";

// Initialize secrets table
db.exec(`
    CREATE TABLE IF NOT EXISTS extension_secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension_name TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(extension_name, key)
    )
`);

/**
 * Store a secret for an extension
 */
export function setSecret(extensionName: string, key: string, value: string): void {
    const stmt = db.prepare(`
        INSERT INTO extension_secrets (extension_name, key, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(extension_name, key) 
        DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(extensionName, key, value);
}

/**
 * Get a secret for an extension
 */
export function getSecret(extensionName: string, key: string): string | undefined {
    const stmt = db.prepare(`
        SELECT value FROM extension_secrets
        WHERE extension_name = ? AND key = ?
    `);
    const row = stmt.get(extensionName, key) as { value: string } | undefined;
    return row?.value;
}

/**
 * Delete a secret for an extension
 */
export function deleteSecret(extensionName: string, key: string): boolean {
    const stmt = db.prepare(`
        DELETE FROM extension_secrets
        WHERE extension_name = ? AND key = ?
    `);
    const result = stmt.run(extensionName, key);
    return result.changes > 0;
}

/**
 * List all secret keys for an extension (values hidden)
 */
export function listSecrets(extensionName: string): string[] {
    const stmt = db.prepare(`
        SELECT key FROM extension_secrets
        WHERE extension_name = ?
        ORDER BY key
    `);
    const rows = stmt.all(extensionName) as { key: string }[];
    return rows.map(r => r.key);
}

/**
 * Delete all secrets for an extension (used when extension is deleted)
 */
export function deleteAllSecrets(extensionName: string): number {
    const stmt = db.prepare(`
        DELETE FROM extension_secrets
        WHERE extension_name = ?
    `);
    const result = stmt.run(extensionName);
    return result.changes;
}

/**
 * Check if a secret exists
 */
export function hasSecret(extensionName: string, key: string): boolean {
    const stmt = db.prepare(`
        SELECT 1 FROM extension_secrets
        WHERE extension_name = ? AND key = ?
    `);
    return stmt.get(extensionName, key) !== undefined;
}
