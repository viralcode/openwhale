/**
 * OpenWhale Memory Files
 * 
 * Handles markdown-based memory files like OpenClaw:
 * - MEMORY.md - curated long-term facts
 * - memory/YYYY-MM-DD.md - daily notes
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Memory storage directory
const MEMORY_DIR = join(homedir(), ".openwhale", "memory");
const MEMORY_FILE = join(MEMORY_DIR, "MEMORY.md");

// Ensure directories exist
if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
}

/**
 * Get path to daily memory file
 */
function getDailyMemoryPath(date?: Date): string {
    const d = date || new Date();
    const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
    return join(MEMORY_DIR, `${dateStr}.md`);
}

/**
 * Read the main MEMORY.md file
 */
export function readMemory(): string {
    try {
        if (existsSync(MEMORY_FILE)) {
            return readFileSync(MEMORY_FILE, "utf-8");
        }
    } catch (err) {
        console.error("[Memory] Failed to read MEMORY.md:", err);
    }
    return "";
}

/**
 * Write to MEMORY.md (replace entire content)
 */
export function writeMemory(content: string): void {
    try {
        writeFileSync(MEMORY_FILE, content);
        console.log("[Memory] Updated MEMORY.md");
    } catch (err) {
        console.error("[Memory] Failed to write MEMORY.md:", err);
    }
}

/**
 * Append to MEMORY.md
 */
export function appendMemory(content: string): void {
    try {
        const existing = readMemory();
        const newContent = existing ? `${existing}\n\n${content}` : content;
        writeFileSync(MEMORY_FILE, newContent);
        console.log("[Memory] Appended to MEMORY.md");
    } catch (err) {
        console.error("[Memory] Failed to append to MEMORY.md:", err);
    }
}

/**
 * Read today's daily memory file
 */
export function readDailyMemory(date?: Date): string {
    const path = getDailyMemoryPath(date);
    try {
        if (existsSync(path)) {
            return readFileSync(path, "utf-8");
        }
    } catch (err) {
        console.error("[Memory] Failed to read daily memory:", err);
    }
    return "";
}

/**
 * Append to today's daily memory file
 */
export function appendDailyMemory(content: string, date?: Date): void {
    const path = getDailyMemoryPath(date);
    try {
        const timestamp = new Date().toLocaleTimeString();
        const entry = `\n## ${timestamp}\n${content}\n`;

        if (!existsSync(path)) {
            // Create new file with header
            const dateStr = (date || new Date()).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
            writeFileSync(path, `# Daily Notes - ${dateStr}\n${entry}`);
        } else {
            appendFileSync(path, entry);
        }
        console.log("[Memory] Added to daily memory");
    } catch (err) {
        console.error("[Memory] Failed to append to daily memory:", err);
    }
}

/**
 * Get memory context for system prompt
 * Loads MEMORY.md + today's daily notes + yesterday's notes
 */
export function getMemoryContext(): string {
    const parts: string[] = [];

    // Long-term memory
    const memory = readMemory();
    if (memory.trim()) {
        parts.push("## Long-Term Memory (MEMORY.md)\n" + memory);
    }

    // Yesterday's notes
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayNotes = readDailyMemory(yesterday);
    if (yesterdayNotes.trim()) {
        parts.push("## Yesterday's Notes\n" + yesterdayNotes);
    }

    // Today's notes
    const todayNotes = readDailyMemory();
    if (todayNotes.trim()) {
        parts.push("## Today's Notes\n" + todayNotes);
    }

    if (parts.length === 0) {
        return "";
    }

    return "# Memory Context\n\n" + parts.join("\n\n---\n\n");
}

/**
 * Initialize memory file if it doesn't exist
 */
export function initializeMemory(): void {
    if (!existsSync(MEMORY_FILE)) {
        const initialContent = `# OpenWhale Memory

This file stores important long-term information that should persist across sessions.

## User Preferences
<!-- Add user preferences here -->

## Important Facts
<!-- Add important facts here -->

## Notes
<!-- Add general notes here -->
`;
        writeFileSync(MEMORY_FILE, initialContent);
        console.log("[Memory] Initialized MEMORY.md");
    }
}

/**
 * Get the memory directory path
 */
export function getMemoryDir(): string {
    return MEMORY_DIR;
}

/**
 * Get the main memory file path
 */
export function getMemoryFilePath(): string {
    return MEMORY_FILE;
}
