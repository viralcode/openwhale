/**
 * OpenWhale Global Logger
 * 
 * Structured JSON-line logger with file output, log levels, categories,
 * and automatic rotation. Reads log path from DB config.
 */

import { appendFileSync, existsSync, renameSync, statSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { EventEmitter } from "node:events";
import { db } from "./db/index.js";

// Real-time event emitter — subscribers receive each log entry as it's written
export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(100); // Allow many SSE clients

// ============== TYPES ==============

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LogCategory =
    | "chat"
    | "channel"
    | "provider"
    | "tool"
    | "session"
    | "dashboard"
    | "system"
    | "cron"
    | "extension"
    | "auth";

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    data?: unknown;
}

// ============== CONSTANTS ==============

const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const DEFAULT_LOG_PATH = join(process.cwd(), "data", "openwhale.log");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB rotation threshold

// ============== STATE ==============

let currentLogPath: string = DEFAULT_LOG_PATH;
let minLevel: LogLevel = "DEBUG";

// ============== HELPERS ==============

function getLogPathFromDB(): string {
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'logFilePath'").get() as { value: string } | undefined;
        if (row?.value) return row.value;
    } catch { /* DB not ready */ }
    return DEFAULT_LOG_PATH;
}

function ensureLogDir(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function rotateIfNeeded(filePath: string): void {
    try {
        if (!existsSync(filePath)) return;
        const stat = statSync(filePath);
        if (stat.size >= MAX_FILE_SIZE) {
            // Simple rotation: rename current to .1 (overwrite previous .1)
            const rotatedPath = filePath + ".1";
            renameSync(filePath, rotatedPath);
        }
    } catch { /* Rotation is best-effort */ }
}

function formatForConsole(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
        DEBUG: "\x1b[2m",    // dim
        INFO: "\x1b[36m",    // cyan
        WARN: "\x1b[33m",    // yellow
        ERROR: "\x1b[31m",   // red
    };
    const reset = "\x1b[0m";
    const color = levelColors[entry.level];
    const time = entry.timestamp.split("T")[1]?.split(".")[0] || entry.timestamp;
    return `${color}[${time}] [${entry.level}] [${entry.category}]${reset} ${entry.message}`;
}

// ============== CORE WRITE ==============

function writeLog(entry: LogEntry): void {
    // Console output
    const consoleMsg = formatForConsole(entry);
    if (entry.level === "ERROR") {
        console.error(consoleMsg);
    } else if (entry.level === "WARN") {
        console.warn(consoleMsg);
    } else {
        console.log(consoleMsg);
    }

    // File output
    try {
        const logPath = currentLogPath;
        ensureLogDir(logPath);
        rotateIfNeeded(logPath);
        const line = JSON.stringify(entry) + "\n";
        appendFileSync(logPath, line, "utf-8");
    } catch (e) {
        // Don't recurse — just stderr
        console.error("[Logger] Failed to write log file:", e);
    }

    // Emit for real-time subscribers (SSE)
    try { logEmitter.emit("entry", entry); } catch { /* best-effort */ }
}

// ============== PUBLIC API ==============

function log(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
    };
    if (data !== undefined) entry.data = data;

    writeLog(entry);
}

export const logger = {
    debug: (category: LogCategory, message: string, data?: unknown) => log("DEBUG", category, message, data),
    info: (category: LogCategory, message: string, data?: unknown) => log("INFO", category, message, data),
    warn: (category: LogCategory, message: string, data?: unknown) => log("WARN", category, message, data),
    error: (category: LogCategory, message: string, data?: unknown) => log("ERROR", category, message, data),

    /** Update the log file path (called when settings change) */
    setLogPath(path: string): void {
        currentLogPath = path || DEFAULT_LOG_PATH;
    },

    /** Set minimum log level */
    setMinLevel(level: LogLevel): void {
        minLevel = level;
    },

    /** Get current log file path */
    getLogPath(): string {
        return currentLogPath;
    },

    /** Reload log path from DB (called at startup) */
    reload(): void {
        currentLogPath = getLogPathFromDB();
    },
};

// Initialize on import — read path from DB
logger.reload();
