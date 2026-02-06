/**
 * OpenWhale Sandbox
 * 
 * Provides safe command execution by restricting file system access
 * and blocking dangerous commands. Inspired by OpenClaw's sandbox system.
 */

import { resolve, normalize } from "node:path";

// ============== TYPES ==============

export interface SandboxConfig {
    enabled: boolean;
    workspaceDir: string;
    allowedPaths?: string[];        // Additional allowed paths beyond workspace
    blockedCommands?: string[];     // Extra commands to block
}

export interface SandboxCheckResult {
    allowed: boolean;
    reason?: string;
}

// ============== DEFAULTS ==============

const DEFAULT_BLOCKED_PATTERNS: RegExp[] = [
    /\brm\s+(-\w*\s+)*-\w*r\w*\s+\//,     // rm -rf / or similar
    /\brm\s+(-\w*\s+)*\/\s*$/,              // rm /
    /\bsudo\b/,                              // sudo commands
    /\bmkfs\b/,                              // filesystem formatting
    /\bdd\s+.*of=\/dev\//,                   // dd to device
    /\b(shutdown|reboot|halt|poweroff)\b/,   // system control
    /\bchmod\s+(-\w+\s+)*777\s+\//,         // chmod 777 /
    /\bchown\s+.*\s+\//,                     // chown /
    />\s*\/etc\//,                           // redirect to /etc
    />\s*\/usr\//,                           // redirect to /usr
    />\s*\/sys\//,                           // redirect to /sys
    /\bcurl\b.*\|\s*(ba)?sh/,               // curl pipe to shell
    /\bwget\b.*\|\s*(ba)?sh/,               // wget pipe to shell
    /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:/,  // fork bomb
];

const SAFE_SYSTEM_PATHS = [
    "/tmp",
    "/var/tmp",
    "/usr/bin",
    "/usr/local/bin",
    "/opt/homebrew",
];

// ============== SANDBOX FUNCTIONS ==============

/**
 * Check if a command is safe to execute
 */
export function checkCommand(command: string, config: SandboxConfig): SandboxCheckResult {
    if (!config.enabled) {
        return { allowed: true };
    }

    const trimmedCmd = command.trim();

    // Check against blocked patterns
    for (const pattern of DEFAULT_BLOCKED_PATTERNS) {
        if (pattern.test(trimmedCmd)) {
            return {
                allowed: false,
                reason: `Command blocked by sandbox: matches dangerous pattern "${pattern.source}"`,
            };
        }
    }

    // Check extra blocked commands
    if (config.blockedCommands) {
        for (const blocked of config.blockedCommands) {
            if (trimmedCmd.startsWith(blocked)) {
                return {
                    allowed: false,
                    reason: `Command blocked by sandbox: "${blocked}" is not allowed`,
                };
            }
        }
    }

    return { allowed: true };
}

/**
 * Check if a file path is within allowed boundaries
 */
export function checkPath(filePath: string, config: SandboxConfig): SandboxCheckResult {
    if (!config.enabled) {
        return { allowed: true };
    }

    const resolved = resolve(normalize(filePath));
    const workspace = resolve(normalize(config.workspaceDir));

    // Always allow workspace access
    if (resolved.startsWith(workspace)) {
        return { allowed: true };
    }

    // Allow safe system paths (read-only typically)
    for (const safePath of SAFE_SYSTEM_PATHS) {
        if (resolved.startsWith(safePath)) {
            return { allowed: true };
        }
    }

    // Allow explicitly configured paths
    if (config.allowedPaths) {
        for (const allowed of config.allowedPaths) {
            const resolvedAllowed = resolve(normalize(allowed));
            if (resolved.startsWith(resolvedAllowed)) {
                return { allowed: true };
            }
        }
    }

    // Allow home directory config files
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    if (homeDir && resolved.startsWith(resolve(homeDir, ".openwhale"))) {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: `Path "${filePath}" is outside the sandbox. Allowed: workspace (${workspace}), /tmp, and configured paths.`,
    };
}

/**
 * Create a default sandbox config for the current workspace
 */
export function createSandboxConfig(
    workspaceDir: string,
    enabled: boolean = false,
    extraPaths?: string[]
): SandboxConfig {
    return {
        enabled,
        workspaceDir: resolve(workspaceDir),
        allowedPaths: extraPaths,
    };
}

/**
 * Log a sandboxed command execution for audit
 */
const auditLog: Array<{ timestamp: string; command: string; allowed: boolean; reason?: string }> = [];

export function auditCommand(command: string, result: SandboxCheckResult): void {
    auditLog.push({
        timestamp: new Date().toISOString(),
        command: command.slice(0, 200), // Truncate for safety
        allowed: result.allowed,
        reason: result.reason,
    });

    // Keep only the last 1000 entries
    if (auditLog.length > 1000) {
        auditLog.splice(0, auditLog.length - 1000);
    }

    if (!result.allowed) {
        console.warn(`[Sandbox] 🚫 BLOCKED: ${command.slice(0, 100)} — ${result.reason}`);
    }
}

export function getAuditLog(): typeof auditLog {
    return [...auditLog];
}
