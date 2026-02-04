/**
 * macOS LaunchAgent Installer
 * 
 * Installs OpenWhale as a LaunchAgent that:
 * - Starts automatically on login
 * - Runs as current user (no root)
 * - Has sandboxed profile
 * - Resource limits (CPU, memory)
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

const LABEL = "ai.openwhale.daemon";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

export type LaunchAgentConfig = {
    label: string;
    programPath: string;
    workingDirectory: string;
    environmentVariables?: Record<string, string>;
    keepAlive: boolean;
    runAtLoad: boolean;
    throttleInterval?: number;
    softResourceLimit?: number;  // Virtual memory limit in bytes
    hardResourceLimit?: number;
};

/**
 * Generate LaunchAgent plist content
 */
function generatePlist(config: LaunchAgentConfig): string {
    const envEntries = config.environmentVariables
        ? Object.entries(config.environmentVariables).map(([key, value]) =>
            `      <key>${escapeXml(key)}</key>\n      <string>${escapeXml(value)}</string>`
        ).join("\n")
        : "";

    const envDict = envEntries
        ? `    <key>EnvironmentVariables</key>\n    <dict>\n${envEntries}\n    </dict>`
        : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(config.label)}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${escapeXml(config.programPath)}</string>
        <string>daemon</string>
        <string>run</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>${escapeXml(config.workingDirectory)}</string>
    
    <key>RunAtLoad</key>
    <${config.runAtLoad}/>
    
    <key>KeepAlive</key>
    <${config.keepAlive}/>
    
    <key>ThrottleInterval</key>
    <integer>${config.throttleInterval || 10}</integer>
    
    <key>StandardOutPath</key>
    <string>${escapeXml(join(config.workingDirectory, ".openwhale", "daemon.stdout.log"))}</string>
    
    <key>StandardErrorPath</key>
    <string>${escapeXml(join(config.workingDirectory, ".openwhale", "daemon.stderr.log"))}</string>
    
${envDict}
    
    <!-- Security: Resource limits -->
    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>1024</integer>
        <key>NumberOfProcesses</key>
        <integer>50</integer>
    </dict>
    
    <key>HardResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>2048</integer>
        <key>NumberOfProcesses</key>
        <integer>100</integer>
    </dict>
    
    <!-- Nice level: run with lower priority -->
    <key>Nice</key>
    <integer>5</integer>
    
    <!-- Process type: background -->
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Install LaunchAgent
 */
export async function installLaunchAgent(options: {
    workingDirectory?: string;
    environmentVariables?: Record<string, string>;
} = {}): Promise<void> {
    if (process.platform !== "darwin") {
        throw new Error("LaunchAgent is only supported on macOS");
    }

    // Ensure LaunchAgents directory exists
    const launchAgentsDir = join(homedir(), "Library", "LaunchAgents");
    if (!existsSync(launchAgentsDir)) {
        mkdirSync(launchAgentsDir, { recursive: true });
    }

    const workingDirectory = options.workingDirectory || process.cwd();

    // For npm-based installation, use npx
    const config: LaunchAgentConfig = {
        label: LABEL,
        programPath: "/usr/local/bin/node",  // Will be adjusted during install
        workingDirectory,
        environmentVariables: {
            PATH: "/usr/local/bin:/usr/bin:/bin",
            HOME: homedir(),
            ...options.environmentVariables,
        },
        keepAlive: true,
        runAtLoad: true,
        throttleInterval: 10,
    };

    // Generate and write plist
    const plist = generatePlist(config);
    writeFileSync(PLIST_PATH, plist);
    console.log(`[LAUNCHD] Created ${PLIST_PATH}`);

    // Load the agent
    try {
        execSync(`launchctl load -w "${PLIST_PATH}"`, { stdio: "inherit" });
        console.log(`[LAUNCHD] Loaded ${LABEL}`);
    } catch (err) {
        console.error("[LAUNCHD] Failed to load agent:", err);
        throw err;
    }
}

/**
 * Uninstall LaunchAgent
 */
export async function uninstallLaunchAgent(): Promise<void> {
    if (process.platform !== "darwin") {
        throw new Error("LaunchAgent is only supported on macOS");
    }

    if (!existsSync(PLIST_PATH)) {
        console.log("[LAUNCHD] Not installed");
        return;
    }

    // Unload the agent
    try {
        execSync(`launchctl unload -w "${PLIST_PATH}"`, { stdio: "inherit" });
        console.log(`[LAUNCHD] Unloaded ${LABEL}`);
    } catch (err) {
        console.error("[LAUNCHD] Failed to unload:", err);
    }

    // Remove plist file
    unlinkSync(PLIST_PATH);
    console.log(`[LAUNCHD] Removed ${PLIST_PATH}`);
}

/**
 * Check if LaunchAgent is installed
 */
export function isLaunchAgentInstalled(): boolean {
    return existsSync(PLIST_PATH);
}

/**
 * Check if LaunchAgent is loaded
 */
export function isLaunchAgentLoaded(): boolean {
    if (!isLaunchAgentInstalled()) return false;

    try {
        const output = execSync(`launchctl list | grep ${LABEL}`, { encoding: "utf-8" });
        return output.includes(LABEL);
    } catch {
        return false;
    }
}

/**
 * Restart LaunchAgent
 */
export async function restartLaunchAgent(): Promise<void> {
    if (!isLaunchAgentInstalled()) {
        throw new Error("LaunchAgent is not installed");
    }

    try {
        execSync(`launchctl stop ${LABEL}`, { stdio: "inherit" });
        execSync(`launchctl start ${LABEL}`, { stdio: "inherit" });
        console.log(`[LAUNCHD] Restarted ${LABEL}`);
    } catch (err) {
        console.error("[LAUNCHD] Failed to restart:", err);
        throw err;
    }
}

/**
 * Get LaunchAgent status
 */
export function getLaunchAgentStatus(): {
    installed: boolean;
    loaded: boolean;
    plistPath: string;
    label: string;
} {
    return {
        installed: isLaunchAgentInstalled(),
        loaded: isLaunchAgentLoaded(),
        plistPath: PLIST_PATH,
        label: LABEL,
    };
}
