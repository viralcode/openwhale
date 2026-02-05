/**
 * OpenWhale Self-Extension Tool
 * 
 * Allows users to create, manage, and run persistent extensions
 * through chat. Extensions are TypeScript files stored in
 * ~/.openwhale/extensions/ and can be scheduled or triggered manually.
 */

import { z } from "zod";
import { spawn } from "node:child_process";
import {
    writeFileSync,
    readFileSync,
    mkdirSync,
    existsSync,
    readdirSync,
    rmSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import {
    setSecret,
    deleteSecret,
    listSecrets,
    deleteAllSecrets,
} from "./extension-secrets.js";

// Extensions directory
const EXTENSIONS_DIR = join(homedir(), ".openwhale", "extensions");

// Ensure extensions directory exists
if (!existsSync(EXTENSIONS_DIR)) {
    mkdirSync(EXTENSIONS_DIR, { recursive: true });
}

// Extension manifest interface
interface ExtensionManifest {
    name: string;
    description: string;
    version: string;
    enabled: boolean;
    schedule?: string;        // Cron expression
    channels?: string[];      // Channels to notify
    createdAt: string;
    updatedAt: string;
}

// In-memory registry of loaded extensions
const loadedExtensions: Map<string, {
    manifest: ExtensionManifest;
    scheduledJob?: NodeJS.Timeout;
}> = new Map();

// Scheduled jobs registry  
const scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

// Channel notification callback (set by extension-loader)
let notifyChannel: ((channel: string, message: string) => Promise<void>) | null = null;

/**
 * Set the channel notification callback
 */
export function setNotifyCallback(callback: (channel: string, message: string) => Promise<void>): void {
    notifyChannel = callback;
}

/**
 * Get the extensions directory path
 */
export function getExtensionsDir(): string {
    return EXTENSIONS_DIR;
}

/**
 * Get loaded extensions
 */
export function getLoadedExtensions(): Map<string, { manifest: ExtensionManifest; scheduledJob?: NodeJS.Timeout }> {
    return loadedExtensions;
}

// Extension action schema
const ExtendActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("create"),
        name: z.string().describe("Unique name for the extension (lowercase, underscores allowed)"),
        description: z.string().describe("What this extension does"),
        code: z.string().describe("TypeScript code for the extension"),
        schedule: z.string().optional().describe("Cron expression for scheduled execution (e.g., '0 9 * * *' for 9 AM daily)"),
        channels: z.array(z.string()).optional().describe("Channels to send notifications to (e.g., ['whatsapp'])"),
        knowledgeUrl: z.string().optional().describe("URL to fetch and store as knowledge base for this extension"),
    }),
    z.object({
        action: z.literal("list"),
    }),
    z.object({
        action: z.literal("get"),
        name: z.string().describe("Name of the extension to view"),
    }),
    z.object({
        action: z.literal("update"),
        name: z.string().describe("Name of the extension to update"),
        code: z.string().optional().describe("New TypeScript code"),
        description: z.string().optional().describe("New description"),
        schedule: z.string().optional().describe("New cron schedule (empty string to remove)"),
        channels: z.array(z.string()).optional().describe("New channels list"),
    }),
    z.object({
        action: z.literal("delete"),
        name: z.string().describe("Name of the extension to delete"),
    }),
    z.object({
        action: z.literal("run"),
        name: z.string().describe("Name of the extension to run"),
    }),
    z.object({
        action: z.literal("enable"),
        name: z.string().describe("Name of the extension to enable"),
    }),
    z.object({
        action: z.literal("disable"),
        name: z.string().describe("Name of the extension to disable"),
    }),
    z.object({
        action: z.literal("set_secret"),
        name: z.string().describe("Name of the extension"),
        key: z.string().describe("Secret key (e.g., 'API_KEY', 'TOKEN')"),
        value: z.string().describe("Secret value (will be stored securely)"),
    }),
    z.object({
        action: z.literal("list_secrets"),
        name: z.string().describe("Name of the extension"),
    }),
    z.object({
        action: z.literal("delete_secret"),
        name: z.string().describe("Name of the extension"),
        key: z.string().describe("Secret key to delete"),
    }),
]);

type ExtendAction = z.infer<typeof ExtendActionSchema>;

/**
 * Generate the extension SDK that gets injected into extension code
 */
function generateExtensionSDK(extensionName: string, channels: string[]): string {
    const secretsFile = join(EXTENSIONS_DIR, extensionName, "secrets.json");
    return `
// OpenWhale Extension SDK - Auto-injected
const __EXTENSION_NAME__ = ${JSON.stringify(extensionName)};
const __CHANNELS__ = ${JSON.stringify(channels)};

// Simple data storage using JSON file
const __DATA_FILE__ = ${JSON.stringify(join(EXTENSIONS_DIR, extensionName, "data.json"))};
const __SECRETS_FILE__ = ${JSON.stringify(secretsFile)};
import * as __fs from "node:fs";

const openwhale = {
    // Send notification to configured channels
    notify: async (message: string, channel?: string): Promise<void> => {
        const targetChannels = channel ? [channel] : __CHANNELS__;
        for (const ch of targetChannels) {
            console.log(\`[NOTIFY:\${ch}] \${message}\`);
        }
    },
    
    // Key-value data storage
    data: {
        get: (key: string): unknown => {
            try {
                if (!__fs.existsSync(__DATA_FILE__)) return undefined;
                const data = JSON.parse(__fs.readFileSync(__DATA_FILE__, "utf8"));
                return data[key];
            } catch { return undefined; }
        },
        set: (key: string, value: unknown): void => {
            let data: Record<string, unknown> = {};
            try {
                if (__fs.existsSync(__DATA_FILE__)) {
                    data = JSON.parse(__fs.readFileSync(__DATA_FILE__, "utf8"));
                }
            } catch { }
            data[key] = value;
            __fs.writeFileSync(__DATA_FILE__, JSON.stringify(data, null, 2));
        },
        delete: (key: string): void => {
            try {
                if (!__fs.existsSync(__DATA_FILE__)) return;
                const data = JSON.parse(__fs.readFileSync(__DATA_FILE__, "utf8"));
                delete data[key];
                __fs.writeFileSync(__DATA_FILE__, JSON.stringify(data, null, 2));
            } catch { }
        },
        getAll: (): Record<string, unknown> => {
            try {
                if (!__fs.existsSync(__DATA_FILE__)) return {};
                return JSON.parse(__fs.readFileSync(__DATA_FILE__, "utf8"));
            } catch { return {}; }
        },
    },
    
    // Secure secrets access (managed via set_secret action)
    secrets: {
        get: (key: string): string | undefined => {
            try {
                if (!__fs.existsSync(__SECRETS_FILE__)) return undefined;
                const data = JSON.parse(__fs.readFileSync(__SECRETS_FILE__, "utf8"));
                return data[key];
            } catch { return undefined; }
        },
        has: (key: string): boolean => {
            try {
                if (!__fs.existsSync(__SECRETS_FILE__)) return false;
                const data = JSON.parse(__fs.readFileSync(__SECRETS_FILE__, "utf8"));
                return key in data;
            } catch { return false; }
        },
        keys: (): string[] => {
            try {
                if (!__fs.existsSync(__SECRETS_FILE__)) return [];
                const data = JSON.parse(__fs.readFileSync(__SECRETS_FILE__, "utf8"));
                return Object.keys(data);
            } catch { return []; }
        },
    },
    
    // Logging
    log: (message: string): void => {
        console.log(\`[\${__EXTENSION_NAME__}] \${message}\`);
    },
    
    // Current extension info
    name: __EXTENSION_NAME__,
    channels: __CHANNELS__,
};

// fetch is available globally in Node.js 18+
`;
}

/**
 * Validate extension name
 */
function validateName(name: string): string | null {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        return "Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores";
    }
    if (name.length > 50) {
        return "Name must be 50 characters or less";
    }
    return null;
}

/**
 * Get extension path
 */
function getExtensionPath(name: string): string {
    return join(EXTENSIONS_DIR, name);
}

/**
 * Read extension manifest
 */
function readManifest(name: string): ExtensionManifest | null {
    const manifestPath = join(getExtensionPath(name), "manifest.json");
    if (!existsSync(manifestPath)) return null;
    try {
        return JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
        return null;
    }
}

/**
 * Write extension manifest
 */
function writeManifest(name: string, manifest: ExtensionManifest): void {
    const manifestPath = join(getExtensionPath(name), "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Parse cron expression to next run time (simple implementation)
 */
function parseCronToMs(expression: string): number | null {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const [minute, hour] = parts;

    // Handle */N patterns (every N minutes)
    const everyNMatch = minute.match(/^\*\/(\d+)$/);
    if (everyNMatch) {
        const n = parseInt(everyNMatch[1], 10);
        return n * 60 * 1000; // Every N minutes
    }

    // Every minute: * * * * *
    if (minute === "*" && hour === "*") {
        return 60 * 1000; // Every minute
    }

    // For specific times, calculate next occurrence
    const now = new Date();
    const targetMinute = minute === "*" ? now.getMinutes() : parseInt(minute, 10);
    const targetHour = hour === "*" ? now.getHours() : parseInt(hour, 10);

    const next = new Date(now);
    next.setHours(targetHour, targetMinute, 0, 0);

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    return next.getTime() - now.getTime();
}

/**
 * Schedule an extension to run
 */
function scheduleExtension(name: string, manifest: ExtensionManifest): void {
    if (!manifest.schedule || !manifest.enabled) return;

    // Clear existing schedule
    const existingJob = scheduledJobs.get(name);
    if (existingJob) {
        clearTimeout(existingJob);
        scheduledJobs.delete(name);
    }

    const intervalMs = parseCronToMs(manifest.schedule);
    if (!intervalMs) return;

    const runJob = async () => {
        if (!manifest.enabled) return;

        console.log(`[Extension] Running scheduled: ${name}`);
        try {
            await executeExtension(name);
        } catch (err) {
            console.error(`[Extension] Scheduled run failed for ${name}:`, err);
        }

        // Reschedule
        const nextInterval = parseCronToMs(manifest.schedule!);
        if (nextInterval) {
            const job = setTimeout(runJob, nextInterval);
            scheduledJobs.set(name, job);
        }
    };

    const job = setTimeout(runJob, intervalMs);
    scheduledJobs.set(name, job);
    console.log(`[Extension] Scheduled ${name} to run in ${Math.round(intervalMs / 1000)}s`);
}

/**
 * Execute an extension and return output
 */
async function executeExtension(name: string): Promise<{ success: boolean; output: string; error?: string }> {
    const extPath = getExtensionPath(name);
    const indexPath = join(extPath, "index.ts");

    if (!existsSync(indexPath)) {
        return { success: false, output: "", error: `Extension not found: ${name}` };
    }

    const manifest = readManifest(name);
    if (!manifest) {
        return { success: false, output: "", error: `Invalid extension manifest: ${name}` };
    }

    return new Promise((resolve) => {
        const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
        const command = `npx tsx "${indexPath}"`;
        const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

        const child = spawn(shell, shellArgs, {
            cwd: extPath,
            env: { ...process.env, NODE_NO_WARNINGS: "1" },
            timeout: 30000,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        child.on("error", (err) => {
            resolve({
                success: false,
                output: "",
                error: `Failed to execute: ${err.message}`,
            });
        });

        child.on("close", (exitCode) => {
            // Parse NOTIFY messages and send to channels
            const notifyPattern = /\[NOTIFY:(\w+)\] (.+)/g;
            let match;
            while ((match = notifyPattern.exec(stdout)) !== null) {
                const [, channel, message] = match;
                if (notifyChannel) {
                    notifyChannel(channel, message).catch(console.error);
                }
            }

            const output = stdout + (stderr ? `\nErrors:\n${stderr}` : "");

            resolve({
                success: exitCode === 0,
                output: output || "(no output)",
                error: exitCode !== 0 ? `Exited with code ${exitCode}` : undefined,
            });
        });
    });
}

/**
 * Load all extensions on startup (called by extension-loader)
 */
export async function loadAllExtensions(): Promise<void> {
    if (!existsSync(EXTENSIONS_DIR)) return;

    const entries = readdirSync(EXTENSIONS_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifest = readManifest(entry.name);
        if (!manifest) continue;

        loadedExtensions.set(entry.name, { manifest });

        if (manifest.enabled && manifest.schedule) {
            scheduleExtension(entry.name, manifest);
        }

        console.log(`[Extension] Loaded: ${entry.name}${manifest.schedule ? ` (scheduled: ${manifest.schedule})` : ""}`);
    }

    console.log(`[Extension] Loaded ${loadedExtensions.size} extensions`);
}

/**
 * Hot reload a single extension (updates in-memory without restart)
 */
export async function hotReloadExtension(name: string): Promise<void> {
    const manifest = readManifest(name);
    if (!manifest) {
        loadedExtensions.delete(name);
        const job = scheduledJobs.get(name);
        if (job) {
            clearTimeout(job);
            scheduledJobs.delete(name);
        }
        return;
    }

    loadedExtensions.set(name, { manifest });

    // Reschedule if needed
    const existingJob = scheduledJobs.get(name);
    if (existingJob) {
        clearTimeout(existingJob);
        scheduledJobs.delete(name);
    }

    if (manifest.enabled && manifest.schedule) {
        scheduleExtension(name, manifest);
    }
}

export const extendTool: AgentTool<ExtendAction> = {
    name: "extend",
    description: `Create and manage persistent extensions that run on schedules. Extensions can send notifications, fetch data, and store state across runs. Use cron expressions for scheduling (e.g., "*/5 * * * *" for every 5 minutes, "0 9 * * *" for daily 9 AM).`,
    category: "system",
    parameters: ExtendActionSchema,

    async execute(params: ExtendAction, _context: ToolCallContext): Promise<ToolResult> {
        switch (params.action) {
            case "create": {
                // Validate name
                const nameError = validateName(params.name);
                if (nameError) {
                    return { success: false, content: "", error: nameError };
                }

                // Check if exists
                const extPath = getExtensionPath(params.name);
                if (existsSync(extPath)) {
                    return { success: false, content: "", error: `Extension '${params.name}' already exists. Use 'update' action to modify.` };
                }

                // Create extension directory
                mkdirSync(extPath, { recursive: true });

                // Fetch knowledge from URL if provided
                let knowledgeContent = "";
                if (params.knowledgeUrl) {
                    try {
                        const response = await fetch(params.knowledgeUrl);
                        if (response.ok) {
                            knowledgeContent = await response.text();
                            // Store as knowledge file
                            writeFileSync(join(extPath, "knowledge.md"), `# Knowledge Base\nSource: ${params.knowledgeUrl}\n\n${knowledgeContent}`);
                        }
                    } catch (err) {
                        console.log(`[Extension] Failed to fetch knowledge URL: ${err}`);
                    }
                }

                // Create manifest
                const manifest: ExtensionManifest = {
                    name: params.name,
                    description: params.description,
                    version: "1.0.0",
                    enabled: true,
                    schedule: params.schedule,
                    channels: params.channels || [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                writeManifest(params.name, manifest);

                // Generate extension code with SDK
                const sdk = generateExtensionSDK(params.name, params.channels || []);
                // Wrap user code in async IIFE to support top-level await
                const fullCode = `${sdk}\n// Extension code starts here\n(async () => {\n${params.code}\n})().catch(e => console.error('[${params.name}] Error:', e));\n`;

                writeFileSync(join(extPath, "index.ts"), fullCode);

                // Hot reload into memory
                await hotReloadExtension(params.name);

                let response = `✅ Extension '${params.name}' created successfully!\n`;
                response += `📁 Location: ${extPath}\n`;
                if (params.schedule) {
                    response += `⏰ Scheduled: ${params.schedule}\n`;
                }
                if (params.channels?.length) {
                    response += `📢 Channels: ${params.channels.join(", ")}\n`;
                }
                if (knowledgeContent) {
                    response += `📚 Knowledge base loaded from URL\n`;
                }
                response += `\nRun with: extend({ action: "run", name: "${params.name}" })`;

                return {
                    success: true,
                    content: response,
                    metadata: { name: params.name, path: extPath },
                };
            }

            case "list": {
                if (!existsSync(EXTENSIONS_DIR)) {
                    return { success: true, content: "No extensions found." };
                }

                const entries = readdirSync(EXTENSIONS_DIR, { withFileTypes: true });
                const extensions: string[] = [];

                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;

                    const manifest = readManifest(entry.name);
                    if (!manifest) continue;

                    const status = manifest.enabled ? "✅" : "⏸️";
                    const schedule = manifest.schedule ? ` [${manifest.schedule}]` : "";
                    extensions.push(`${status} ${manifest.name}${schedule}\n   ${manifest.description}`);
                }

                if (extensions.length === 0) {
                    return { success: true, content: "No extensions found." };
                }

                return {
                    success: true,
                    content: `📦 Extensions (${extensions.length}):\n\n${extensions.join("\n\n")}`,
                    metadata: { count: extensions.length },
                };
            }

            case "get": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                const indexPath = join(getExtensionPath(params.name), "index.ts");
                const code = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "(no code)";

                // Extract user code (after SDK)
                const userCodeMatch = code.match(/\/\/ Extension code starts here\n([\s\S]*)/);
                const userCode = userCodeMatch ? userCodeMatch[1].trim() : code;

                return {
                    success: true,
                    content: `📦 Extension: ${manifest.name}\n` +
                        `📝 Description: ${manifest.description}\n` +
                        `📌 Version: ${manifest.version}\n` +
                        `✅ Enabled: ${manifest.enabled}\n` +
                        (manifest.schedule ? `⏰ Schedule: ${manifest.schedule}\n` : "") +
                        (manifest.channels?.length ? `📢 Channels: ${manifest.channels.join(", ")}\n` : "") +
                        `\n--- Code ---\n${userCode}`,
                };
            }

            case "update": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                // Update manifest fields
                if (params.description !== undefined) {
                    manifest.description = params.description;
                }
                if (params.schedule !== undefined) {
                    manifest.schedule = params.schedule || undefined;
                }
                if (params.channels !== undefined) {
                    manifest.channels = params.channels;
                }
                manifest.updatedAt = new Date().toISOString();
                writeManifest(params.name, manifest);

                // Update code if provided
                if (params.code) {
                    const sdk = generateExtensionSDK(params.name, manifest.channels || []);
                    const fullCode = `${sdk}\n// Extension code starts here\n${params.code}\n`;
                    writeFileSync(join(getExtensionPath(params.name), "index.ts"), fullCode);
                }

                // Hot reload
                await hotReloadExtension(params.name);

                return {
                    success: true,
                    content: `✅ Extension '${params.name}' updated successfully!`,
                };
            }

            case "delete": {
                const extPath = getExtensionPath(params.name);
                if (!existsSync(extPath)) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                // Stop scheduled job
                const job = scheduledJobs.get(params.name);
                if (job) {
                    clearTimeout(job);
                    scheduledJobs.delete(params.name);
                }

                // Remove from memory
                loadedExtensions.delete(params.name);

                // Delete secrets from SQLite
                deleteAllSecrets(params.name);

                // Delete files
                rmSync(extPath, { recursive: true, force: true });

                return {
                    success: true,
                    content: `🗑️ Extension '${params.name}' deleted.`,
                };
            }

            case "run": {
                const result = await executeExtension(params.name);

                if (!result.success) {
                    return { success: false, content: "", error: result.error };
                }

                return {
                    success: true,
                    content: `▶️ Extension '${params.name}' executed:\n\n${result.output}`,
                };
            }

            case "enable": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                manifest.enabled = true;
                manifest.updatedAt = new Date().toISOString();
                writeManifest(params.name, manifest);

                await hotReloadExtension(params.name);

                return {
                    success: true,
                    content: `✅ Extension '${params.name}' enabled.`,
                };
            }

            case "disable": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                manifest.enabled = false;
                manifest.updatedAt = new Date().toISOString();
                writeManifest(params.name, manifest);

                // Stop scheduled job
                const job = scheduledJobs.get(params.name);
                if (job) {
                    clearTimeout(job);
                    scheduledJobs.delete(params.name);
                }

                loadedExtensions.set(params.name, { manifest });

                return {
                    success: true,
                    content: `⏸️ Extension '${params.name}' disabled.`,
                };
            }

            case "set_secret": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                // Store secret in file (per-extension)
                const secretsPath = join(getExtensionPath(params.name), "secrets.json");
                let secrets: Record<string, string> = {};
                try {
                    if (existsSync(secretsPath)) {
                        secrets = JSON.parse(readFileSync(secretsPath, "utf8"));
                    }
                } catch { }
                secrets[params.key] = params.value;
                writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));

                // Also store in SQLite for persistence
                setSecret(params.name, params.key, params.value);

                return {
                    success: true,
                    content: `🔐 Secret '${params.key}' stored for extension '${params.name}'. Access it in your code via openwhale.secrets.get("${params.key}")`,
                };
            }

            case "list_secrets": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                const keys = listSecrets(params.name);
                if (keys.length === 0) {
                    return {
                        success: true,
                        content: `No secrets stored for extension '${params.name}'.`,
                    };
                }

                return {
                    success: true,
                    content: `🔐 Secrets for '${params.name}':\n${keys.map(k => `  • ${k}`).join("\n")}`,
                };
            }

            case "delete_secret": {
                const manifest = readManifest(params.name);
                if (!manifest) {
                    return { success: false, content: "", error: `Extension '${params.name}' not found.` };
                }

                // Delete from file
                const secretsPath = join(getExtensionPath(params.name), "secrets.json");
                try {
                    if (existsSync(secretsPath)) {
                        const secrets = JSON.parse(readFileSync(secretsPath, "utf8"));
                        delete secrets[params.key];
                        writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));
                    }
                } catch { }

                // Delete from SQLite
                const deleted = deleteSecret(params.name, params.key);

                return {
                    success: true,
                    content: deleted
                        ? `🗑️ Secret '${params.key}' deleted from extension '${params.name}'.`
                        : `Secret '${params.key}' not found in extension '${params.name}'.`,
                };
            }
        }
    },
};
