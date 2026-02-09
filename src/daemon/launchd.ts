/**
 * Cross-Platform Daemon Installer
 * 
 * Installs OpenWhale as a background service that starts on login:
 * - macOS: LaunchAgent (launchd)
 * - Linux: systemd user service
 * - Windows: Startup folder shortcut
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

const platform = process.platform;

// ─── macOS LaunchAgent ───────────────────────────────────────────────────────

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
    softResourceLimit?: number;
    hardResourceLimit?: number;
};

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

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

// ─── Linux systemd ───────────────────────────────────────────────────────────

const SYSTEMD_SERVICE_NAME = "openwhale.service";
const SYSTEMD_USER_DIR = join(homedir(), ".config", "systemd", "user");
const SYSTEMD_SERVICE_PATH = join(SYSTEMD_USER_DIR, SYSTEMD_SERVICE_NAME);

function generateSystemdUnit(workingDirectory: string): string {
    return `[Unit]
Description=OpenWhale AI Assistant Daemon
After=network.target

[Service]
Type=simple
WorkingDirectory=${workingDirectory}
ExecStart=/usr/bin/env node ${join(workingDirectory, "dist", "cli.js")} daemon run
Restart=on-failure
RestartSec=10
StandardOutput=append:${join(workingDirectory, ".openwhale", "daemon.stdout.log")}
StandardError=append:${join(workingDirectory, ".openwhale", "daemon.stderr.log")}
Environment=HOME=${homedir()}
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;
}

// ─── Windows Startup ─────────────────────────────────────────────────────────

function getWindowsStartupPath(): string {
    return join(
        process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
        "Microsoft", "Windows", "Start Menu", "Programs", "Startup",
        "OpenWhale.vbs"
    );
}

function generateWindowsStartupScript(workingDirectory: string): string {
    // VBScript that launches node in background without a visible window
    return `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${workingDirectory.replace(/\\/g, "\\\\")}"
WshShell.Run "node ""${join(workingDirectory, "dist", "cli.js").replace(/\\/g, "\\\\")}"" daemon run", 0, False
`;
}

// ─── Cross-Platform API ──────────────────────────────────────────────────────

/**
 * Install daemon (auto-start on login)
 */
export async function installLaunchAgent(options: {
    workingDirectory?: string;
    environmentVariables?: Record<string, string>;
} = {}): Promise<void> {
    const workingDirectory = options.workingDirectory || process.cwd();

    if (platform === "darwin") {
        // macOS: LaunchAgent
        const launchAgentsDir = join(homedir(), "Library", "LaunchAgents");
        if (!existsSync(launchAgentsDir)) {
            mkdirSync(launchAgentsDir, { recursive: true });
        }

        const config: LaunchAgentConfig = {
            label: LABEL,
            programPath: "/usr/local/bin/node",
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

        const plist = generatePlist(config);
        writeFileSync(PLIST_PATH, plist);
        console.log(`[Daemon] Created LaunchAgent: ${PLIST_PATH}`);

        try {
            execSync(`launchctl load -w "${PLIST_PATH}"`, { stdio: "inherit" });
            console.log(`[Daemon] Loaded LaunchAgent: ${LABEL}`);
        } catch (err) {
            console.error("[Daemon] Failed to load LaunchAgent:", err);
            throw err;
        }
    } else if (platform === "linux") {
        // Linux: systemd user service
        if (!existsSync(SYSTEMD_USER_DIR)) {
            mkdirSync(SYSTEMD_USER_DIR, { recursive: true });
        }

        const logDir = join(workingDirectory, ".openwhale");
        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
        }

        const unit = generateSystemdUnit(workingDirectory);
        writeFileSync(SYSTEMD_SERVICE_PATH, unit);
        console.log(`[Daemon] Created systemd service: ${SYSTEMD_SERVICE_PATH}`);

        try {
            execSync("systemctl --user daemon-reload", { stdio: "inherit" });
            execSync(`systemctl --user enable ${SYSTEMD_SERVICE_NAME}`, { stdio: "inherit" });
            execSync(`systemctl --user start ${SYSTEMD_SERVICE_NAME}`, { stdio: "inherit" });
            console.log(`[Daemon] Enabled and started systemd service: ${SYSTEMD_SERVICE_NAME}`);
        } catch (err) {
            console.error("[Daemon] Failed to enable systemd service:", err);
            throw err;
        }
    } else if (platform === "win32") {
        // Windows: Startup folder VBScript
        const startupPath = getWindowsStartupPath();
        const script = generateWindowsStartupScript(workingDirectory);
        writeFileSync(startupPath, script);
        console.log(`[Daemon] Created startup script: ${startupPath}`);
        console.log("[Daemon] OpenWhale will start automatically on next login.");
    } else {
        throw new Error(`Daemon installation not supported on ${platform}`);
    }
}

/**
 * Uninstall daemon (remove auto-start)
 */
export async function uninstallLaunchAgent(): Promise<void> {
    if (platform === "darwin") {
        if (!existsSync(PLIST_PATH)) {
            console.log("[Daemon] Not installed");
            return;
        }
        try {
            execSync(`launchctl unload -w "${PLIST_PATH}"`, { stdio: "inherit" });
            console.log(`[Daemon] Unloaded LaunchAgent: ${LABEL}`);
        } catch (err) {
            console.error("[Daemon] Failed to unload:", err);
        }
        unlinkSync(PLIST_PATH);
        console.log(`[Daemon] Removed: ${PLIST_PATH}`);
    } else if (platform === "linux") {
        if (!existsSync(SYSTEMD_SERVICE_PATH)) {
            console.log("[Daemon] Not installed");
            return;
        }
        try {
            execSync(`systemctl --user stop ${SYSTEMD_SERVICE_NAME}`, { stdio: "inherit" });
            execSync(`systemctl --user disable ${SYSTEMD_SERVICE_NAME}`, { stdio: "inherit" });
            console.log(`[Daemon] Stopped and disabled: ${SYSTEMD_SERVICE_NAME}`);
        } catch (err) {
            console.error("[Daemon] Failed to stop service:", err);
        }
        unlinkSync(SYSTEMD_SERVICE_PATH);
        execSync("systemctl --user daemon-reload", { stdio: "pipe" });
        console.log(`[Daemon] Removed: ${SYSTEMD_SERVICE_PATH}`);
    } else if (platform === "win32") {
        const startupPath = getWindowsStartupPath();
        if (!existsSync(startupPath)) {
            console.log("[Daemon] Not installed");
            return;
        }
        unlinkSync(startupPath);
        console.log(`[Daemon] Removed startup script: ${startupPath}`);
    } else {
        throw new Error(`Daemon uninstallation not supported on ${platform}`);
    }
}

/**
 * Check if daemon is installed
 */
export function isLaunchAgentInstalled(): boolean {
    if (platform === "darwin") {
        return existsSync(PLIST_PATH);
    } else if (platform === "linux") {
        return existsSync(SYSTEMD_SERVICE_PATH);
    } else if (platform === "win32") {
        return existsSync(getWindowsStartupPath());
    }
    return false;
}

/**
 * Check if daemon is loaded/active
 */
export function isLaunchAgentLoaded(): boolean {
    if (!isLaunchAgentInstalled()) return false;

    if (platform === "darwin") {
        try {
            const output = execSync(`launchctl list | grep ${LABEL}`, { encoding: "utf-8" });
            return output.includes(LABEL);
        } catch {
            return false;
        }
    } else if (platform === "linux") {
        try {
            const output = execSync(`systemctl --user is-active ${SYSTEMD_SERVICE_NAME}`, { encoding: "utf-8" });
            return output.trim() === "active";
        } catch {
            return false;
        }
    } else if (platform === "win32") {
        // Windows startup scripts run on login; check if the process is running
        try {
            const output = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: "utf-8" });
            return output.includes("node.exe");
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * Restart daemon
 */
export async function restartLaunchAgent(): Promise<void> {
    if (!isLaunchAgentInstalled()) {
        throw new Error("Daemon is not installed");
    }

    if (platform === "darwin") {
        try {
            execSync(`launchctl stop ${LABEL}`, { stdio: "inherit" });
            execSync(`launchctl start ${LABEL}`, { stdio: "inherit" });
            console.log(`[Daemon] Restarted LaunchAgent: ${LABEL}`);
        } catch (err) {
            console.error("[Daemon] Failed to restart:", err);
            throw err;
        }
    } else if (platform === "linux") {
        try {
            execSync(`systemctl --user restart ${SYSTEMD_SERVICE_NAME}`, { stdio: "inherit" });
            console.log(`[Daemon] Restarted systemd service: ${SYSTEMD_SERVICE_NAME}`);
        } catch (err) {
            console.error("[Daemon] Failed to restart:", err);
            throw err;
        }
    } else if (platform === "win32") {
        // Kill existing node daemon processes and relaunch
        try {
            execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq OpenWhale*"', { stdio: "pipe" });
        } catch { /* may not be running */ }
        const workDir = process.cwd();
        const { spawn } = await import("node:child_process");
        spawn("node", [join(workDir, "dist", "cli.js"), "daemon", "run"], {
            detached: true,
            stdio: "ignore",
            cwd: workDir,
        }).unref();
        console.log("[Daemon] Restarted on Windows");
    }
}

/**
 * Get daemon status
 */
export function getLaunchAgentStatus(): {
    installed: boolean;
    loaded: boolean;
    plistPath: string;
    label: string;
    platform: string;
    servicePath?: string;
} {
    if (platform === "darwin") {
        return {
            installed: isLaunchAgentInstalled(),
            loaded: isLaunchAgentLoaded(),
            plistPath: PLIST_PATH,
            label: LABEL,
            platform: "macOS (launchd)",
        };
    } else if (platform === "linux") {
        return {
            installed: isLaunchAgentInstalled(),
            loaded: isLaunchAgentLoaded(),
            plistPath: SYSTEMD_SERVICE_PATH,
            label: SYSTEMD_SERVICE_NAME,
            platform: "Linux (systemd)",
            servicePath: SYSTEMD_SERVICE_PATH,
        };
    } else if (platform === "win32") {
        return {
            installed: isLaunchAgentInstalled(),
            loaded: isLaunchAgentLoaded(),
            plistPath: getWindowsStartupPath(),
            label: "OpenWhale Startup",
            platform: "Windows (Startup folder)",
        };
    }

    return {
        installed: false,
        loaded: false,
        plistPath: "",
        label: "",
        platform: `${platform} (unsupported)`,
    };
}
