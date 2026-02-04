/**
 * Command Filter - Security-first command validation
 * 
 * Validates commands BEFORE execution using allowlists and blocked patterns.
 * This prevents the security issues found in OpenClaw (CVE-2026-25253, etc.)
 * 
 * Defense layers:
 * 1. Blocked patterns (always rejected)
 * 2. Allowed commands (always permitted)
 * 3. Approval required (user must confirm)
 */

// Commands that are always allowed (safe, read-only)
export const ALLOWED_COMMANDS = new Set([
    // Read-only file operations
    "ls", "cat", "head", "tail", "less", "more", "wc", "file",
    "find", "locate", "which", "whereis", "type",

    // Text processing (read-only)
    "grep", "awk", "sed", "sort", "uniq", "cut", "tr", "diff",

    // System info (read-only)
    "pwd", "whoami", "id", "groups", "hostname", "uname", "uptime",
    "date", "cal", "df", "du", "free", "top", "ps", "env", "printenv",

    // Development info (read-only)
    "node", "npm", "npx", "python3", "python", "pip", "pip3",
    "git", "cargo", "rustc", "go", "java", "javac",

    // Network info (read-only)
    "ping", "host", "nslookup", "dig", "curl", "wget",

    // Safe utilities
    "echo", "printf", "true", "false", "test", "expr", "bc",
    "basename", "dirname", "realpath", "readlink",
]);

// Patterns that are ALWAYS blocked - these indicate malicious intent
export const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string; severity: "critical" | "high" | "medium" }> = [
    // Dangerous deletions
    { pattern: /rm\s+(-rf?|--recursive)\s+[\/~]/, reason: "Recursive delete of root/home", severity: "critical" },
    { pattern: /rm\s+-rf?\s+\*/, reason: "Wildcard recursive delete", severity: "critical" },

    // Privilege escalation
    { pattern: /\bsudo\b/, reason: "Privilege escalation attempt", severity: "critical" },
    { pattern: /\bsu\s+-?\s*$/, reason: "Switch user attempt", severity: "critical" },
    { pattern: /\bdoas\b/, reason: "Privilege escalation (doas)", severity: "critical" },

    // Remote code execution (pipe to shell)
    { pattern: /curl\s+.*\|\s*(sh|bash|zsh|python)/, reason: "Remote code execution via curl", severity: "critical" },
    { pattern: /wget\s+.*\|\s*(sh|bash|zsh|python)/, reason: "Remote code execution via wget", severity: "critical" },
    { pattern: /\beval\s*\(/, reason: "Dynamic code execution", severity: "high" },

    // System file modification
    { pattern: />\s*\/etc\//, reason: "System config modification", severity: "critical" },
    { pattern: />\s*\/usr\//, reason: "System binary modification", severity: "critical" },
    { pattern: />\s*\/var\//, reason: "System data modification", severity: "high" },
    { pattern: />\s*\/bin\//, reason: "Binary modification", severity: "critical" },
    { pattern: />\s*\/sbin\//, reason: "System binary modification", severity: "critical" },

    // Dangerous permissions
    { pattern: /chmod\s+(777|a\+rwx|--recursive.*777)/, reason: "World-writable permissions", severity: "high" },
    { pattern: /chown\s+root/, reason: "Change ownership to root", severity: "high" },

    // Sensitive file access
    { pattern: /cat\s+.*\.ssh\/id_/, reason: "SSH private key access", severity: "critical" },
    { pattern: /cat\s+.*\.aws\/credentials/, reason: "AWS credentials access", severity: "critical" },
    { pattern: /cat\s+.*\.env/, reason: "Environment secrets access", severity: "high" },
    { pattern: /cat\s+.*\/etc\/shadow/, reason: "Password hash access", severity: "critical" },

    // Crypto mining / malware indicators
    { pattern: /\bxmrig\b/i, reason: "Crypto miner detected", severity: "critical" },
    { pattern: /\bminerd\b/i, reason: "Crypto miner detected", severity: "critical" },
    { pattern: /stratum\+tcp/i, reason: "Mining pool connection", severity: "critical" },

    // Fork bombs and resource exhaustion  
    { pattern: /:\(\)\s*{\s*:\|:&\s*};\s*:/, reason: "Fork bomb", severity: "critical" },
    { pattern: /while\s*\(\s*true\s*\).*fork/, reason: "Resource exhaustion", severity: "high" },

    // Reverse shells
    { pattern: /nc\s+(-e|--exec)\s+\/bin\//, reason: "Netcat reverse shell", severity: "critical" },
    { pattern: /bash\s+-i\s+>&?\s*\/dev\/tcp/, reason: "Bash reverse shell", severity: "critical" },
    { pattern: /python.*socket.*connect.*exec/, reason: "Python reverse shell", severity: "critical" },

    // Data exfiltration
    { pattern: /curl\s+.*-d\s+.*@\//, reason: "File exfiltration via curl", severity: "high" },
    { pattern: /base64\s+.*\|\s*curl/, reason: "Encoded data exfiltration", severity: "high" },
];

// Commands requiring explicit user approval
export const APPROVAL_REQUIRED_PREFIXES = [
    // Package installation
    "npm install", "npm i ", "yarn add", "pnpm add",
    "pip install", "pip3 install",
    "brew install", "apt install", "apt-get install",

    // File modification
    "rm ", "mv ", "cp ", "mkdir ", "rmdir ", "touch ",
    "chmod ", "chown ",

    // Git operations that modify
    "git push", "git commit", "git reset", "git checkout",
    "git merge", "git rebase",

    // Process control
    "kill ", "killall ", "pkill ",

    // Network operations
    "ssh ", "scp ", "rsync ",

    // Docker operations
    "docker run", "docker exec", "docker rm",
];

export type CommandCheckResult = {
    allowed: boolean;
    requiresApproval: boolean;
    reason?: string;
    severity?: "critical" | "high" | "medium";
    matchedPattern?: string;
};

/**
 * Check if a command is safe to execute
 */
export function checkCommand(command: string): CommandCheckResult {
    const trimmed = command.trim();
    const firstWord = trimmed.split(/\s+/)[0] || "";

    // 1. Check blocked patterns first (highest priority - never allow)
    for (const { pattern, reason, severity } of BLOCKED_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                allowed: false,
                requiresApproval: false,
                reason: `BLOCKED: ${reason}`,
                severity,
                matchedPattern: pattern.toString(),
            };
        }
    }

    // 2. Check if command starts with an allowed command
    if (ALLOWED_COMMANDS.has(firstWord)) {
        // Even allowed commands can't access sensitive paths without approval
        if (/\.ssh\/id_|\.aws\/credentials|\.env\b|\/etc\/shadow/.test(trimmed)) {
            return {
                allowed: false,
                requiresApproval: true,
                reason: "Accessing sensitive files requires approval",
                severity: "high",
            };
        }
        return { allowed: true, requiresApproval: false };
    }

    // 3. Check if command requires approval
    for (const prefix of APPROVAL_REQUIRED_PREFIXES) {
        if (trimmed.startsWith(prefix) || trimmed === prefix.trim()) {
            return {
                allowed: false,
                requiresApproval: true,
                reason: `"${prefix.trim()}" requires user approval`,
                severity: "medium",
            };
        }
    }

    // 4. Unknown command - requires approval by default (fail-safe)
    return {
        allowed: false,
        requiresApproval: true,
        reason: `Unknown command "${firstWord}" requires approval`,
        severity: "medium",
    };
}

/**
 * Sanitize command output to prevent sensitive data leakage
 */
export function sanitizeOutput(output: string): string {
    return output
        // API keys (various formats)
        .replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***REDACTED***")
        .replace(/sk-ant-[a-zA-Z0-9-]{20,}/g, "sk-ant-***REDACTED***")
        .replace(/api[_-]?key["'\s:=]+["']?[a-zA-Z0-9]{20,}["']?/gi, "api_key=***REDACTED***")

        // AWS keys
        .replace(/AKIA[0-9A-Z]{16}/g, "AKIA***REDACTED***")
        .replace(/aws[_-]?secret[_-]?access[_-]?key["'\s:=]+["']?[a-zA-Z0-9\/+]{40}["']?/gi,
            "aws_secret_access_key=***REDACTED***")

        // Passwords in URLs
        .replace(/:\/\/[^:]+:[^@]+@/g, "://***:***@")

        // JWT tokens
        .replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "***JWT_REDACTED***")

        // Private keys
        .replace(/-----BEGIN [A-Z]+ PRIVATE KEY-----[\s\S]+?-----END [A-Z]+ PRIVATE KEY-----/g,
            "***PRIVATE_KEY_REDACTED***")

        // GitHub tokens
        .replace(/gh[ps]_[a-zA-Z0-9]{36}/g, "***GITHUB_TOKEN_REDACTED***")

        // Generic secrets in env output
        .replace(/^(.*(?:password|secret|token|key|credential)[^\n=]*=)[^\n]+$/gim, "$1***REDACTED***");
}

/**
 * Security event for audit logging
 */
export type SecurityEvent = {
    type: "allowed" | "blocked" | "approval_required" | "approved" | "denied";
    command: string;
    reason?: string;
    severity?: string;
    timestamp: Date;
    sessionId?: string;
};

// In-memory event buffer (will be persisted by audit module)
const eventBuffer: SecurityEvent[] = [];

/**
 * Log security event for audit trail
 */
export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
    const fullEvent: SecurityEvent = {
        ...event,
        timestamp: new Date(),
    };

    eventBuffer.push(fullEvent);

    // Keep buffer bounded
    if (eventBuffer.length > 1000) {
        eventBuffer.shift();
    }

    // Log to stderr in development
    if (process.env.NODE_ENV !== "production") {
        const emoji = event.type === "blocked" ? "🚫" :
            event.type === "allowed" ? "✅" :
                event.type === "approved" ? "👍" :
                    event.type === "denied" ? "👎" : "⚠️";
        console.error(`[SECURITY] ${emoji} ${event.type}: ${event.command.slice(0, 50)}...`);
    }
}

/**
 * Get recent security events
 */
export function getRecentEvents(count = 100): SecurityEvent[] {
    return eventBuffer.slice(-count);
}
