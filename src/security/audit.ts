/**
 * Audit Logging - Complete security audit trail
 * 
 * Logs all security-relevant events to JSON Lines files.
 * - Daily rotation
 * - 30-day retention
 * - Tamper-evident with checksums
 */

import { existsSync, mkdirSync, appendFileSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export type AuditEvent = {
    timestamp: string;
    type: "command_allowed" | "command_blocked" | "approval_required" | "approved" | "denied" |
    "tool_execution" | "file_access" | "network_request" | "auth_event" | "error";
    sessionId?: string;
    source?: string;
    command?: string;
    tool?: string;
    args?: Record<string, unknown>;
    path?: string;
    url?: string;
    result?: "success" | "failure" | "pending";
    reason?: string;
    severity?: string;
    duration?: number;
    checksum?: string;
};

// Audit configuration  
const AUDIT_DIR = join(process.cwd(), ".openwhale", "audit");
const RETENTION_DAYS = 30;
let currentLogFile: string | null = null;
let lastChecksum = "";

/**
 * Ensure audit directory exists
 */
function ensureAuditDir(): void {
    if (!existsSync(AUDIT_DIR)) {
        mkdirSync(AUDIT_DIR, { recursive: true });
    }
}

/**
 * Get current log file path (rotates daily)
 */
function getLogFilePath(): string {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return join(AUDIT_DIR, `audit-${date}.jsonl`);
}

/**
 * Calculate checksum for chain integrity
 */
function calculateChecksum(event: AuditEvent, previousChecksum: string): string {
    const data = previousChecksum + JSON.stringify(event);
    return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Log an audit event
 */
export function logAuditEvent(event: Omit<AuditEvent, "timestamp" | "checksum">): void {
    ensureAuditDir();

    const logFile = getLogFilePath();

    // Create full event with timestamp and checksum
    const fullEvent: AuditEvent = {
        ...event,
        timestamp: new Date().toISOString(),
    };

    // Add checksum for tamper detection (chain with previous)
    fullEvent.checksum = calculateChecksum(fullEvent, lastChecksum);
    lastChecksum = fullEvent.checksum;

    // Append to log file
    const line = JSON.stringify(fullEvent) + "\n";
    appendFileSync(logFile, line, { encoding: "utf-8" });

    // Update current log file reference
    if (currentLogFile !== logFile) {
        currentLogFile = logFile;
        // Run cleanup on file rotation
        cleanupOldLogs();
    }
}

/**
 * Remove logs older than retention period
 */
function cleanupOldLogs(): void {
    try {
        const files = readdirSync(AUDIT_DIR);
        const now = Date.now();
        const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

        for (const file of files) {
            if (!file.startsWith("audit-") || !file.endsWith(".jsonl")) continue;

            const filePath = join(AUDIT_DIR, file);
            const stat = statSync(filePath);

            if (now - stat.mtimeMs > retentionMs) {
                unlinkSync(filePath);
                console.error(`[AUDIT] Removed old log: ${file}`);
            }
        }
    } catch (error) {
        // Ignore cleanup errors
    }
}

/**
 * Convenience: Log command execution
 */
export function auditCommand(
    command: string,
    result: "allowed" | "blocked" | "approval_required",
    options: {
        sessionId?: string;
        source?: string;
        reason?: string;
        severity?: string;
    } = {}
): void {
    logAuditEvent({
        type: result === "allowed" ? "command_allowed" :
            result === "blocked" ? "command_blocked" : "approval_required",
        command,
        result: result === "allowed" ? "success" : "failure",
        ...options,
    });
}

/**
 * Convenience: Log tool execution
 */
export function auditToolExecution(
    tool: string,
    args: Record<string, unknown>,
    result: "success" | "failure",
    options: {
        sessionId?: string;
        source?: string;
        duration?: number;
        reason?: string;
    } = {}
): void {
    // Sanitize sensitive args
    const sanitizedArgs = sanitizeArgs(args);

    logAuditEvent({
        type: "tool_execution",
        tool,
        args: sanitizedArgs,
        result,
        ...options,
    });
}

/**
 * Convenience: Log file access
 */
export function auditFileAccess(
    path: string,
    action: "read" | "write" | "delete",
    result: "success" | "failure",
    options: {
        sessionId?: string;
        source?: string;
    } = {}
): void {
    logAuditEvent({
        type: "file_access",
        path,
        result,
        reason: action,
        ...options,
    });
}

/**
 * Convenience: Log network request
 */
export function auditNetworkRequest(
    url: string,
    method: string,
    result: "success" | "failure",
    options: {
        sessionId?: string;
        source?: string;
        duration?: number;
    } = {}
): void {
    // Redact sensitive URL components
    const sanitizedUrl = url.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@");

    logAuditEvent({
        type: "network_request",
        url: sanitizedUrl,
        reason: method,
        result,
        ...options,
    });
}

/**
 * Sanitize arguments to remove sensitive data
 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
        const lowerKey = key.toLowerCase();

        // Redact likely sensitive fields
        if (lowerKey.includes("password") ||
            lowerKey.includes("secret") ||
            lowerKey.includes("token") ||
            lowerKey.includes("key") ||
            lowerKey.includes("credential")) {
            sanitized[key] = "***REDACTED***";
        } else if (typeof value === "string" && value.length > 500) {
            // Truncate long values
            sanitized[key] = value.slice(0, 500) + "...[truncated]";
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Get audit log file path for a specific date
 */
export function getAuditLogPath(date?: Date): string {
    ensureAuditDir();
    const d = date || new Date();
    const dateStr = d.toISOString().split("T")[0];
    return join(AUDIT_DIR, `audit-${dateStr}.jsonl`);
}

/**
 * List all audit log files
 */
export function listAuditLogs(): string[] {
    ensureAuditDir();
    return readdirSync(AUDIT_DIR)
        .filter(f => f.startsWith("audit-") && f.endsWith(".jsonl"))
        .sort()
        .reverse();
}
