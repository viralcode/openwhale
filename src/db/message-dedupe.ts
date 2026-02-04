/**
 * Message deduplication and persistence for WhatsApp messages
 * Uses SQLite to track processed message IDs and store message content
 */

import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import path from "path";

// Simple SQLite connection for message deduplication
let db: Database.Database | null = null;

function getDb(): Database.Database {
    if (db) return db;

    const dataDir = path.join(process.cwd(), ".openwhale");
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(path.join(dataDir, "messages.db"));
    db.pragma("journal_mode = WAL");

    // Create table if not exists (with content storage)
    db.exec(`
        CREATE TABLE IF NOT EXISTS processed_messages (
            id TEXT PRIMARY KEY,
            channel TEXT NOT NULL DEFAULT 'whatsapp',
            from_number TEXT,
            to_number TEXT,
            direction TEXT NOT NULL,
            content TEXT,
            contact_name TEXT,
            media_type TEXT,
            processed_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_processed_messages_channel ON processed_messages(channel);
        CREATE INDEX IF NOT EXISTS idx_processed_messages_from ON processed_messages(from_number);
        CREATE INDEX IF NOT EXISTS idx_processed_messages_processed_at ON processed_messages(processed_at);
    `);

    // Add new columns if they don't exist (migration for existing DBs)
    try {
        db.exec("ALTER TABLE processed_messages ADD COLUMN content TEXT");
    } catch { /* column already exists */ }
    try {
        db.exec("ALTER TABLE processed_messages ADD COLUMN to_number TEXT");
    } catch { /* column already exists */ }
    try {
        db.exec("ALTER TABLE processed_messages ADD COLUMN contact_name TEXT");
    } catch { /* column already exists */ }
    try {
        db.exec("ALTER TABLE processed_messages ADD COLUMN media_type TEXT");
    } catch { /* column already exists */ }

    // DON'T clean up old messages - we want to keep them for viewing!
    // Only clean messages older than 30 days
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);
    db.prepare("DELETE FROM processed_messages WHERE processed_at < ?").run(thirtyDaysAgo);

    return db;
}

/**
 * Check if a message has already been processed
 */
export function isMessageProcessed(messageId: string): boolean {
    const db = getDb();
    const result = db.prepare("SELECT 1 FROM processed_messages WHERE id = ?").get(messageId);
    return result !== undefined;
}

/**
 * Mark a message as processed and store its content
 */
export function markMessageProcessed(
    messageId: string,
    direction: "inbound" | "outbound",
    from?: string,
    options?: {
        to?: string;
        content?: string;
        contactName?: string;
        mediaType?: string;
    }
): void {
    const db = getDb();
    db.prepare(`
        INSERT OR REPLACE INTO processed_messages 
        (id, channel, from_number, to_number, direction, content, contact_name, media_type, processed_at)
        VALUES (?, 'whatsapp', ?, ?, ?, ?, ?, ?, unixepoch())
    `).run(
        messageId,
        from ?? null,
        options?.to ?? null,
        direction,
        options?.content ?? null,
        options?.contactName ?? null,
        options?.mediaType ?? null
    );
}

/**
 * Get all WhatsApp messages grouped by conversation
 */
export function getAllMessages(limit: number = 500): Array<{
    id: string;
    from_number: string | null;
    to_number: string | null;
    direction: string;
    content: string | null;
    contact_name: string | null;
    media_type: string | null;
    processed_at: number;
}> {
    const db = getDb();
    const result = db.prepare(`
        SELECT id, from_number, to_number, direction, content, contact_name, media_type, processed_at
        FROM processed_messages
        WHERE channel = 'whatsapp'
        ORDER BY processed_at DESC
        LIMIT ?
    `).all(limit);
    return result as any;
}

/**
 * Get message count by direction
 */
export function getMessageStats(): { sent: number; received: number } {
    const db = getDb();
    const sentResult = db.prepare("SELECT COUNT(*) as count FROM processed_messages WHERE direction = 'outbound'").get() as { count: number };
    const receivedResult = db.prepare("SELECT COUNT(*) as count FROM processed_messages WHERE direction = 'inbound'").get() as { count: number };
    return {
        sent: sentResult?.count ?? 0,
        received: receivedResult?.count ?? 0
    };
}

/**
 * Get count of processed messages (for stats)
 */
export function getProcessedMessageCount(): number {
    const db = getDb();
    const result = db.prepare("SELECT COUNT(*) as count FROM processed_messages").get() as { count: number };
    return result?.count ?? 0;
}

/**
 * Clean up old messages (call periodically to prevent DB bloat)
 */
export function cleanupOldMessages(maxAgeSeconds: number = 30 * 86400): number {
    const db = getDb();
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds;
    const result = db.prepare("DELETE FROM processed_messages WHERE processed_at < ?").run(cutoff);
    return result.changes;
}

