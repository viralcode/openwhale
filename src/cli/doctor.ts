/**
 * Doctor Command - System health checks
 */

import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface HealthCheck {
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
    details?: string;
}

export interface DoctorReport {
    timestamp: Date;
    checks: HealthCheck[];
    summary: {
        total: number;
        passed: number;
        warnings: number;
        failures: number;
    };
}

/**
 * Run all health checks
 */
export async function runDoctorChecks(): Promise<DoctorReport> {
    const checks: HealthCheck[] = [];

    // Run all checks
    checks.push(await checkAnthropicKey());
    checks.push(await checkOpenAIKey());
    checks.push(await checkOllamaConnection());
    checks.push(await checkDatabaseFile());
    checks.push(await checkDaemonPort());
    checks.push(await checkWhatsAppAuth());
    checks.push(await checkGoogleCredentials());
    checks.push(await checkGitHubToken());
    checks.push(await checkDiskSpace());
    checks.push(await checkNodeVersion());

    // Calculate summary
    const passed = checks.filter(c => c.status === "pass").length;
    const warnings = checks.filter(c => c.status === "warn").length;
    const failures = checks.filter(c => c.status === "fail").length;

    return {
        timestamp: new Date(),
        checks,
        summary: {
            total: checks.length,
            passed,
            warnings,
            failures,
        },
    };
}

/**
 * Format doctor report for display
 */
export function formatDoctorReport(report: DoctorReport): string {
    const lines: string[] = [
        "🩺 **OpenWhale Doctor**",
        "",
        `Time: ${report.timestamp.toLocaleString()}`,
        "",
        "---",
        "",
    ];

    for (const check of report.checks) {
        const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
        lines.push(`${icon} **${check.name}**: ${check.message}`);
        if (check.details && check.status !== "pass") {
            lines.push(`   ${check.details}`);
        }
    }

    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`**Summary**: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.warnings} warnings, ${report.summary.failures} failures`);

    return lines.join("\n");
}

// Individual health checks

async function checkAnthropicKey(): Promise<HealthCheck> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
        return { name: "Anthropic API", status: "fail", message: "Not configured", details: "Set ANTHROPIC_API_KEY" };
    }
    if (!key.startsWith("sk-ant-")) {
        return { name: "Anthropic API", status: "warn", message: "Key format looks wrong" };
    }
    return { name: "Anthropic API", status: "pass", message: "Configured" };
}

async function checkOpenAIKey(): Promise<HealthCheck> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return { name: "OpenAI API", status: "warn", message: "Not configured (optional)", details: "Set OPENAI_API_KEY for fallback" };
    }
    return { name: "OpenAI API", status: "pass", message: "Configured" };
}

async function checkOllamaConnection(): Promise<HealthCheck> {
    try {
        const res = await fetch("http://localhost:11434/api/tags", {
            signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
            const data = await res.json() as { models: Array<{ name: string }> };
            const modelCount = data.models?.length || 0;
            return { name: "Ollama", status: "pass", message: `Running (${modelCount} models)` };
        }
        return { name: "Ollama", status: "warn", message: "Not responding" };
    } catch {
        return { name: "Ollama", status: "warn", message: "Not running (optional)", details: "Install with: brew install ollama" };
    }
}

async function checkDatabaseFile(): Promise<HealthCheck> {
    const dbPath = join(homedir(), ".openwhale", "openwhale.db");
    if (existsSync(dbPath)) {
        return { name: "Database", status: "pass", message: "SQLite file exists" };
    }
    return { name: "Database", status: "warn", message: "Will be created on first run" };
}

async function checkDaemonPort(): Promise<HealthCheck> {
    try {
        const res = await fetch("http://localhost:7777/health", {
            signal: AbortSignal.timeout(2000)
        });
        if (res.ok) {
            return { name: "Daemon", status: "pass", message: "Running on port 7777" };
        }
        return { name: "Daemon", status: "warn", message: "Not responding" };
    } catch {
        return { name: "Daemon", status: "warn", message: "Not running", details: "Start with: openwhale daemon start" };
    }
}

async function checkWhatsAppAuth(): Promise<HealthCheck> {
    const authPath = join(homedir(), ".openwhale", "whatsapp-auth");
    if (existsSync(authPath)) {
        return { name: "WhatsApp", status: "pass", message: "Auth data exists" };
    }
    return { name: "WhatsApp", status: "warn", message: "Not paired yet", details: "Pair with: openwhale whatsapp pair" };
}

async function checkGoogleCredentials(): Promise<HealthCheck> {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        return { name: "Google APIs", status: "pass", message: "Configured" };
    }
    return { name: "Google APIs", status: "warn", message: "Not configured (optional)", details: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET" };
}

async function checkGitHubToken(): Promise<HealthCheck> {
    if (process.env.GITHUB_TOKEN) {
        return { name: "GitHub", status: "pass", message: "Token configured" };
    }
    return { name: "GitHub", status: "warn", message: "Not configured (optional)", details: "Set GITHUB_TOKEN" };
}

async function checkDiskSpace(): Promise<HealthCheck> {
    try {
        const { execSync } = await import("child_process");
        const output = execSync("df -h ~ | tail -1").toString();
        const parts = output.split(/\s+/);
        const available = parts[3];
        const usePercent = parseInt(parts[4]);

        if (usePercent > 95) {
            return { name: "Disk Space", status: "fail", message: `Critical: ${available} available`, details: "Less than 5% free" };
        } else if (usePercent > 85) {
            return { name: "Disk Space", status: "warn", message: `Low: ${available} available` };
        }
        return { name: "Disk Space", status: "pass", message: `${available} available` };
    } catch {
        return { name: "Disk Space", status: "warn", message: "Could not check" };
    }
}

async function checkNodeVersion(): Promise<HealthCheck> {
    const version = process.version;
    const major = parseInt(version.slice(1).split(".")[0]);

    if (major < 18) {
        return { name: "Node.js", status: "fail", message: `${version} - too old`, details: "Node.js 18+ required" };
    } else if (major < 20) {
        return { name: "Node.js", status: "warn", message: `${version}`, details: "Node.js 20+ recommended" };
    }
    return { name: "Node.js", status: "pass", message: version };
}
