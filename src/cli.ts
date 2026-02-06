#!/usr/bin/env node
/**
 * OpenWhale CLI - Interactive command-line interface with AGENTIC capabilities
 * 
 * The chat mode supports full tool use - Claude can execute commands, send WhatsApp
 * messages, read/write files, fetch URLs, and use any registered tool.
 */
import "dotenv/config";
import readline from "node:readline";
import { createAnthropicProvider, AnthropicProvider } from "./providers/anthropic.js";
import { createOpenAIProvider, createOllamaProvider } from "./providers/openai-compatible.js";
import { registry } from "./providers/base.js";
import { toolRegistry } from "./tools/index.js";
import { skillRegistry, registerAllSkills } from "./skills/index.js";
import type { ToolCallContext } from "./tools/base.js";
import { initWhatsApp, sendWhatsAppMessage, isWhatsAppConnected } from "./channels/whatsapp-baileys.js";
import { startDaemon, stopDaemon, getDaemonStatus } from "./daemon/daemon.js";
import { installLaunchAgent, uninstallLaunchAgent, getLaunchAgentStatus } from "./daemon/launchd.js";

// Colors for terminal
const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    underline: "\x1b[4m",
};

const c = (color: keyof typeof colors, text: string) => `${colors[color]}${text}${colors.reset}`;

// Format markdown for terminal display
function formatMarkdown(text: string): string {
    let result = text;

    // Headers: ## Header → Bold + Cyan
    result = result.replace(/^### (.+)$/gm, `${colors.bold}${colors.yellow}   $1${colors.reset}`);
    result = result.replace(/^## (.+)$/gm, `${colors.bold}${colors.cyan}$1${colors.reset}`);
    result = result.replace(/^# (.+)$/gm, `\n${colors.bold}${colors.magenta}$1${colors.reset}\n`);

    // Bold: **text** → Bold
    result = result.replace(/\*\*([^*]+)\*\*/g, `${colors.bold}$1${colors.reset}`);

    // Inline code: `code` → Dim
    result = result.replace(/`([^`]+)`/g, `${colors.dim}$1${colors.reset}`);

    // Bullet points: - item → Green bullet
    result = result.replace(/^- (.+)$/gm, `${colors.green}  •${colors.reset} $1`);
    result = result.replace(/^  - (.+)$/gm, `${colors.dim}    ◦${colors.reset} $1`);

    // Numbered lists: 1. item → Yellow number
    result = result.replace(/^(\d+)\. (.+)$/gm, `${colors.yellow}  $1.${colors.reset} $2`);

    // Code blocks: ```code``` → Dim background
    result = result.replace(/```[\w]*\n?([\s\S]*?)```/g, `${colors.dim}$1${colors.reset}`);

    // Horizontal rules
    result = result.replace(/^---+$/gm, `${colors.dim}────────────────────────────────────${colors.reset}`);

    return result;
}

// ASCII art logo
const logo = `
${c("cyan", "   ____                  _      ____          __   ")}
${c("cyan", "  / __ \\____  ___  ____| | /| / / /_  ____ _/ /___ ")}
${c("cyan", " / / / / __ \\/ _ \\/ __ \\ |/ |/ / __ \\/ __ '/ // _ \\")}
${c("cyan", "/ /_/ / /_/ /  __/ / / /__/|__/ / / / /_/ / //  __/")}
${c("cyan", "\\____/ .___/\\___/_/ /_/_/  /_/ /_/\\__,_/_/ \\___/ ")}
${c("cyan", "    /_/                                            ")}
${c("dim", "                    v0.1.0 (Agentic)                ")}
`;

// State
let currentModel = "claude-sonnet-4-20250514";
type ChatMessage = {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    toolResults?: Array<{
        toolCallId: string;
        content: string;
        isError?: boolean;
        imageBase64?: string;
        imageMimeType?: string;
    }>;
};
let conversationHistory: ChatMessage[] = [];

// Execute a tool
async function executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolCallContext
): Promise<{ content: string; isError: boolean; imageBase64?: string; imageMimeType?: string }> {
    console.log(c("yellow", `\n  🔧 Executing tool: ${toolName}`));
    console.log(c("dim", `     Args: ${JSON.stringify(args).slice(0, 100)}...`));

    // Special handling for WhatsApp - use real Baileys implementation
    if (toolName === "whatsapp_send" || toolName === "send_whatsapp") {
        const to = (args.to || args.number || args.phone || process.env.WHATSAPP_OWNER_NUMBER || "") as string;
        const message = (args.message || args.content || args.text || "") as string;

        if (!to) {
            return { content: "No phone number provided for WhatsApp message", isError: true };
        }

        // Auto-connect if not connected
        if (!isWhatsAppConnected()) {
            console.log(c("yellow", "     📱 WhatsApp not connected. Attempting to connect..."));
            await initWhatsApp({ printQR: false }); // Don't print QR in chat mode

            // Wait a bit for connection
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (!isWhatsAppConnected()) {
                return {
                    content: "WhatsApp not connected. Please run 'openwhale whatsapp login' first to pair your device.",
                    isError: true
                };
            }
        }

        console.log(c("magenta", `     📱 Sending WhatsApp to ${to}: "${message.slice(0, 50)}..."`));
        const result = await sendWhatsAppMessage(to, message);

        if (result.success) {
            console.log(c("green", `     ✓ Message sent (ID: ${result.messageId})`));
            return { content: `WhatsApp message sent to ${to} successfully!`, isError: false };
        } else {
            console.log(c("red", `     ✗ ${result.error}`));
            return { content: `Failed to send WhatsApp: ${result.error}`, isError: true };
        }
    }

    // Standard tool execution - try toolRegistry first
    const tool = toolRegistry.get(toolName);
    if (tool) {
        const result = await toolRegistry.execute(toolName, args, context);

        console.log(c(result.success ? "green" : "red", `     ${result.success ? "✓" : "✗"} ${result.success ? "Success" : "Error"}`));

        // Special handling for screenshot - extract image data
        if (toolName === "screenshot" && result.success && result.metadata?.base64) {
            const sizeKB = Math.round((result.metadata.sizeBytes as number || 0) / 1024);
            const mimeType = (result.metadata.mimeType as string) || "image/jpeg";
            console.log(c("cyan", `     📸 Screenshot captured (${sizeKB}KB, ${mimeType}) - sending to Claude for vision analysis`));
            return {
                content: "Screenshot captured successfully. Analyze the image I'm showing you.",
                isError: false,
                imageBase64: result.metadata.base64 as string,
                imageMimeType: mimeType,
            };
        }

        return {
            content: result.content || result.error || "Tool executed",
            isError: !result.success,
        };
    }

    // Try skill tools (GitHub, Gmail, Calendar, etc.)
    const skillTools = skillRegistry.getAllTools();
    const skillTool = skillTools.find(st => st.name === toolName);
    if (skillTool) {
        console.log(c("cyan", `     🔌 Executing skill tool: ${toolName}`));
        const result = await skillTool.execute(args, context);
        console.log(c(result.success ? "green" : "red", `     ${result.success ? "✓" : "✗"} ${result.success ? "Success" : "Error"}`));
        return {
            content: result.content || result.error || "Skill tool executed",
            isError: !result.success,
        };
    }

    // Unknown tool
    console.log(c("red", `     ✗ Unknown tool: ${toolName}`));
    return {
        content: `Unknown tool: ${toolName}`,
        isError: true,
    };
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
    console.log(logo);

    // Initialize providers
    initProviders();

    // Handle commands
    switch (command) {
        case "chat":
            await startAgenticChat();
            break;
        case "whatsapp":
            await handleWhatsAppCommand(process.argv[3]);
            break;
        case "test":
            await runTests();
            break;
        case "providers":
            showProviders();
            break;
        case "tools":
            showTools();
            break;
        case "channels":
            showChannels();
            break;
        case "serve":
        case "server":
            await startServer();
            break;
        case "browser":
            await handleBrowserCommand(process.argv[3]);
            break;
        case "daemon":
            await handleDaemonCommand(process.argv[3]);
            break;
        case "help":
        case "--help":
        case "-h":
            showHelp();
            break;
        default:
            showHelp();
            // If no command, start interactive mode
            if (!command) {
                await interactiveMode();
            }
    }
}

function initProviders() {
    const anthropic = createAnthropicProvider();
    if (anthropic) {
        registry.register("anthropic", anthropic);
        console.log(c("green", "✓") + " Anthropic provider ready (with tools)");
    }

    const openai = createOpenAIProvider();
    if (openai) {
        registry.register("openai", openai);
        console.log(c("green", "✓") + " OpenAI provider ready");
    }

    const ollama = createOllamaProvider();
    if (ollama) {
        registry.register("ollama", ollama);
        console.log(c("green", "✓") + " Ollama provider ready");
    }

    // Initialize WhatsApp if configured
    if (process.env.WHATSAPP_OWNER_NUMBER) {
        console.log(c("green", "✓") + ` WhatsApp configured (${process.env.WHATSAPP_OWNER_NUMBER})`);
    }

    // Register all skills
    registerAllSkills();
    const readySkills = skillRegistry.list().filter(s => s.isReady());
    console.log(c("green", "✓") + ` Skills: ${readySkills.length} ready (${readySkills.map(s => s.metadata.name).join(", ") || "none"})`);

    console.log();
}

/**
 * Handle WhatsApp subcommands (login, status, logout)
 */
async function handleWhatsAppCommand(subcommand?: string) {
    switch (subcommand) {
        case "login":
            console.log(c("bold", "\n📱 WhatsApp QR Code Login\n"));
            console.log(c("dim", "Open WhatsApp on your phone > Settings > Linked Devices > Link a Device\n"));

            try {
                const socket = await initWhatsApp({
                    printQR: true,
                    onConnected: () => {
                        console.log(c("green", "\n✅ WhatsApp connected! You can now close this and use 'openwhale chat'"));
                        console.log(c("dim", "Your session is saved and will reconnect automatically.\n"));
                    },
                });

                if (socket) {
                    // Keep the process running until connected
                    await new Promise<void>((resolve) => {
                        const checkInterval = setInterval(() => {
                            if (isWhatsAppConnected()) {
                                clearInterval(checkInterval);
                                setTimeout(() => {
                                    resolve();
                                }, 2000);
                            }
                        }, 1000);
                    });
                }
            } catch (error: any) {
                console.error(c("red", `Error: ${error.message}`));
            }
            break;

        case "status":
            if (isWhatsAppConnected()) {
                console.log(c("green", "✅ WhatsApp is connected"));
            } else {
                console.log(c("yellow", "⚠️ WhatsApp is not connected"));
                console.log(c("dim", "Run 'openwhale whatsapp login' to connect"));
            }
            break;

        case "logout":
            console.log(c("yellow", "Logging out of WhatsApp..."));
            // TODO: Implement logout (delete auth folder)
            console.log(c("dim", "To fully logout, delete the .openwhale-whatsapp-auth folder"));
            break;

        default:
            console.log(`${c("bold", "WhatsApp Commands:")}
  ${c("cyan", "login")}   Pair your WhatsApp by scanning a QR code
  ${c("cyan", "status")}  Check WhatsApp connection status
  ${c("cyan", "logout")}  Disconnect and remove saved session

${c("bold", "Usage:")}
  openwhale whatsapp login
`);
    }
}

/**
 * Handle daemon subcommands (install, start, stop, status, uninstall)
 */
async function handleDaemonCommand(subcommand?: string) {
    switch (subcommand) {
        case "install":
            console.log(c("bold", "\n🔧 Installing OpenWhale Daemon\n"));

            if (process.platform !== "darwin") {
                console.log(c("yellow", "⚠️ Daemon auto-start currently only supported on macOS"));
                console.log(c("dim", "Use 'openwhale daemon start' to run manually\n"));
                return;
            }

            try {
                await installLaunchAgent();
                console.log(c("green", "✅ Daemon installed and started!"));
                console.log(c("dim", "It will automatically start on login.\n"));
            } catch (error: any) {
                console.error(c("red", `Error: ${error.message}`));
            }
            break;

        case "start":
            console.log(c("bold", "\n🚀 Starting OpenWhale Daemon\n"));

            try {
                const status = await getDaemonStatus();
                if (status.running) {
                    console.log(c("yellow", `⚠️ Daemon already running (PID: ${status.pid})`));
                    return;
                }


                await startDaemon();
                console.log(c("green", "✅ Daemon started!"));
                console.log(c("dim", "Socket: .openwhale/daemon.sock"));
                console.log(c("dim", "PID: " + process.pid));
                console.log(c("dim", "\nPress Ctrl+C to stop\n"));

                // Keep running
                await new Promise(() => { });
            } catch (error: any) {
                console.error(c("red", `Error: ${error.message}`));
            }
            break;

        case "stop":
            console.log(c("bold", "\n⏹️ Stopping OpenWhale Daemon\n"));

            try {
                await stopDaemon();
                console.log(c("green", "✅ Daemon stopped"));
            } catch (error: any) {
                console.error(c("red", `Error: ${error.message}`));
            }
            break;

        case "status":
            const status = await getDaemonStatus();
            console.log(c("bold", "\n📊 Daemon Status\n"));

            if (status.running) {
                console.log(c("green", "● Running"));
                console.log(`  PID: ${status.pid}`);
                console.log(`  Connections: ${status.connections}`);
                console.log(`  Messages: ${status.messagesProcessed}`);
                if (status.uptime) {
                    const mins = Math.floor(status.uptime / 60000);
                    console.log(`  Uptime: ${mins} minutes`);
                }
            } else {
                console.log(c("dim", "○ Not running"));
            }

            // Check LaunchAgent status (macOS)
            if (process.platform === "darwin") {
                const laStatus = getLaunchAgentStatus();
                console.log(`\n${c("bold", "LaunchAgent (macOS):")}`);
                console.log(`  Installed: ${laStatus.installed ? c("green", "yes") : c("dim", "no")}`);
                console.log(`  Loaded: ${laStatus.loaded ? c("green", "yes") : c("dim", "no")}`);
            }
            console.log();
            break;

        case "uninstall":
            console.log(c("bold", "\n🗑️ Uninstalling OpenWhale Daemon\n"));

            if (process.platform !== "darwin") {
                console.log(c("yellow", "Nothing to uninstall on this platform"));
                return;
            }

            try {
                await uninstallLaunchAgent();
                console.log(c("green", "✅ Daemon uninstalled"));
            } catch (error: any) {
                console.error(c("red", `Error: ${error.message}`));
            }
            break;

        case "run":
            // Internal: used by LaunchAgent
            console.log("[DAEMON] Running in daemon mode...");
            try {
                await startDaemon();
                // Keep running forever
                await new Promise(() => { });
            } catch (error: any) {
                console.error("[DAEMON] Fatal:", error.message);
                process.exit(1);
            }
            break;

        default:
            console.log(`${c("bold", "Daemon Commands:")}
  ${c("cyan", "install")}    Install daemon to run at login (macOS)
  ${c("cyan", "start")}      Start daemon manually
  ${c("cyan", "stop")}       Stop running daemon  
  ${c("cyan", "status")}     Show daemon status
  ${c("cyan", "uninstall")}  Remove daemon from auto-start

${c("bold", "Security Features:")}
  • Local-only (127.0.0.1) - no network exposure
  • Unix socket IPC - no HTTP API
  • Command allowlisting - blocks dangerous commands
  • Audit logging - all actions recorded

${c("bold", "Usage:")}
  openwhale daemon install
  openwhale daemon start
`);
    }
}

/**
 * Handle browser automation commands (status, use, config)
 */
async function handleBrowserCommand(subcommand?: string) {
    const { isBrowserOSAvailable, DEFAULT_BROWSEROS_URL } = await import("./tools/browser-os.js");
    const { existsSync, mkdirSync, createWriteStream, unlinkSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    // Check BrowserOS availability
    const browserosStatus = await isBrowserOSAvailable();

    switch (subcommand) {
        case "install":
            console.log(c("bold", "\n🌐 Installing BrowserOS\n"));

            // Determine download URL based on platform
            const platform = process.platform;
            let downloadUrl: string;
            let filename: string;

            switch (platform) {
                case "darwin":
                    downloadUrl = "https://files.browseros.com/download/BrowserOS.dmg";
                    filename = "BrowserOS.dmg";
                    break;
                case "win32":
                    downloadUrl = "https://files.browseros.com/download/BrowserOS_installer.exe";
                    filename = "BrowserOS_installer.exe";
                    break;
                case "linux":
                    downloadUrl = "https://files.browseros.com/download/BrowserOS.AppImage";
                    filename = "BrowserOS.AppImage";
                    break;
                default:
                    console.log(c("red", `Unsupported platform: ${platform}`));
                    return;
            }

            // Check if already installed
            if (browserosStatus.available) {
                console.log(c("green", "✅ BrowserOS is already installed and running!"));
                return;
            }

            // Download location
            const downloadDir = join(homedir(), ".openwhale", "downloads");
            if (!existsSync(downloadDir)) {
                mkdirSync(downloadDir, { recursive: true });
            }
            const downloadPath = join(downloadDir, filename);

            console.log(c("dim", `Downloading from: ${downloadUrl}`));
            console.log(c("dim", `Saving to: ${downloadPath}`));

            try {
                // Download the file
                console.log(c("yellow", "⏳ Downloading BrowserOS..."));
                const response = await fetch(downloadUrl);

                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status}`);
                }

                const fileStream = createWriteStream(downloadPath);
                const reader = response.body?.getReader();

                if (!reader) {
                    throw new Error("Failed to get download stream");
                }

                // Stream download with progress
                const contentLength = parseInt(response.headers.get("content-length") || "0");
                let downloaded = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    fileStream.write(value);
                    downloaded += value.length;

                    if (contentLength > 0) {
                        const percent = Math.round((downloaded / contentLength) * 100);
                        process.stdout.write(`\r  Progress: ${percent}% (${Math.round(downloaded / 1024 / 1024)}MB)`);
                    }
                }

                fileStream.end();
                console.log(c("green", "\n  ✓ Download complete!"));

                // Install based on platform
                console.log(c("yellow", "⏳ Installing..."));

                if (platform === "darwin") {
                    // macOS: Mount DMG and copy to Applications
                    console.log(c("dim", "  Mounting DMG..."));
                    await execAsync(`hdiutil attach "${downloadPath}" -nobrowse -quiet`);

                    console.log(c("dim", "  Copying to Applications..."));
                    try {
                        await execAsync(`cp -R "/Volumes/BrowserOS/BrowserOS.app" /Applications/`);
                    } catch {
                        // Try alternate volume name
                        await execAsync(`cp -R /Volumes/BrowserOS*/BrowserOS*.app /Applications/`);
                    }

                    console.log(c("dim", "  Unmounting DMG..."));
                    await execAsync(`hdiutil detach "/Volumes/BrowserOS" -quiet || true`);

                    console.log(c("green", "✅ BrowserOS installed to /Applications/BrowserOS.app"));
                    console.log(c("dim", "\n  To start: Open BrowserOS from Applications or run:"));
                    console.log(c("cyan", "    open /Applications/BrowserOS.app"));

                } else if (platform === "win32") {
                    // Windows: Run installer
                    console.log(c("dim", "  Running installer..."));
                    await execAsync(`start /wait "${downloadPath}"`);
                    console.log(c("green", "✅ BrowserOS installer completed"));

                } else if (platform === "linux") {
                    // Linux: Make AppImage executable and move to bin
                    const binPath = join(homedir(), ".local", "bin");
                    if (!existsSync(binPath)) {
                        mkdirSync(binPath, { recursive: true });
                    }

                    const appImageDest = join(binPath, "BrowserOS.AppImage");
                    await execAsync(`chmod +x "${downloadPath}"`);
                    await execAsync(`mv "${downloadPath}" "${appImageDest}"`);

                    console.log(c("green", `✅ BrowserOS installed to ${appImageDest}`));
                    console.log(c("dim", "\n  To start: Run:"));
                    console.log(c("cyan", `    ${appImageDest}`));
                }

                // Cleanup download (except Linux which moves it)
                if (platform !== "linux" && existsSync(downloadPath)) {
                    unlinkSync(downloadPath);
                }

                console.log(c("dim", "\n  After starting BrowserOS, run:"));
                console.log(c("cyan", "    openwhale browser use browseros"));

            } catch (error: any) {
                console.error(c("red", `\n❌ Installation failed: ${error.message}`));
                console.log(c("dim", "\nManual install:"));
                console.log(c("cyan", `  ${downloadUrl}`));
            }
            break;

        case "status":
            console.log(c("bold", "\n🌐 Browser Automation Status\n"));

            const { isBrowserOSInstalled } = await import("./tools/browser-os.js");
            const installStatus = await isBrowserOSInstalled();

            // Playwright status (always available)
            console.log(`  ${c("cyan", "Playwright".padEnd(12))} ${c("green", "● Available")} (built-in)`);

            // BrowserOS status
            if (browserosStatus.available) {
                console.log(`  ${c("cyan", "BrowserOS".padEnd(12))} ${c("green", "● Running")} at ${DEFAULT_BROWSEROS_URL}`);
                if (browserosStatus.version) {
                    console.log(`    Version: ${browserosStatus.version}`);
                }
                // Show available tools
                try {
                    const { listBrowserOSTools } = await import("./tools/browser-os.js");
                    const tools = await listBrowserOSTools();
                    if (tools.length > 0) {
                        console.log(`    Tools: ${tools.length} available`);
                    }
                } catch {
                    // Ignore tool listing errors
                }
            } else if (installStatus.installed) {
                console.log(`  ${c("cyan", "BrowserOS".padEnd(12))} ${c("yellow", "○ Installed")} (not running)`);
                console.log(c("dim", `    Path: ${installStatus.path}`));
                console.log(c("dim", `    Start with: npm run cli browser start`));
            } else {
                console.log(`  ${c("cyan", "BrowserOS".padEnd(12))} ${c("dim", "○ Not installed")}`);
                console.log(c("dim", `    Install with: npm run cli browser install`));
            }

            console.log();
            break;

        case "start":
            console.log(c("bold", "\n🌐 Starting BrowserOS\n"));
            const { launchBrowserOS } = await import("./tools/browser-os.js");

            const launchResult = await launchBrowserOS();
            if (launchResult.success) {
                console.log(c("green", "✅ BrowserOS MCP server is responding!"));
                console.log(c("dim", "\nNow you can switch to BrowserOS backend:"));
                console.log(c("cyan", "  npm run cli browser use browseros"));
            } else {
                // Check if app launched but MCP not responding
                const { isBrowserOSInstalled } = await import("./tools/browser-os.js");
                const installed = await isBrowserOSInstalled();

                if (installed.installed && launchResult.error?.includes("not responding")) {
                    console.log(c("yellow", "⚠️ BrowserOS app launched, but MCP server not responding"));
                    console.log(c("bold", "\nTo enable the MCP server:"));
                    console.log(c("dim", "  1. Open BrowserOS"));
                    console.log(c("dim", "  2. Navigate to: ") + c("cyan", "chrome://browseros/mcp"));
                    console.log(c("dim", "  3. Enable the MCP server"));
                    console.log(c("dim", "  4. Copy the MCP URL (default: http://127.0.0.1:9201/mcp)"));
                    console.log(c("dim", "\nOnce enabled, run this command again."));
                } else {
                    console.log(c("red", `❌ Failed to start: ${launchResult.error}`));
                }
            }
            break;

        case "use":
            const backend = process.argv[4];
            if (!backend || !["playwright", "browseros"].includes(backend)) {
                console.log(c("red", "Usage: openwhale browser use <playwright|browseros>"));
                return;
            }

            if (backend === "browseros" && !browserosStatus.available) {
                // Try to auto-launch if installed
                const { ensureBrowserOSRunning } = await import("./tools/browser-os.js");
                console.log(c("yellow", "⚠️ BrowserOS is not running. Attempting to start..."));

                const ensureResult = await ensureBrowserOSRunning();
                if (!ensureResult.success) {
                    console.log(c("red", `❌ ${ensureResult.error}`));
                    return;
                }

                if (ensureResult.wasLaunched) {
                    console.log(c("green", "✓ BrowserOS started successfully!"));
                }
            }

            // Set the backend via dashboard API (if server running) or local config
            try {
                const res = await fetch("http://localhost:7777/dashboard/api/settings/browser", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ backend }),
                    signal: AbortSignal.timeout(2000),
                });

                if (res.ok) {
                    console.log(c("green", `✅ Browser backend set to: ${backend}`));
                } else {
                    console.log(c("yellow", `⚠️ Could not save setting (server not running)`));
                    console.log(c("dim", `Start the server with 'openwhale serve' to persist settings`));
                }
            } catch {
                console.log(c("yellow", `⚠️ Server not running - setting will not persist`));
                console.log(c("dim", `To persist: start server with 'openwhale serve', then run this command again`));
            }
            break;

        case "tools":
            console.log(c("bold", "\n🛠️ BrowserOS MCP Tools\n"));

            if (!browserosStatus.available) {
                console.log(c("yellow", "BrowserOS MCP server is not running."));
                console.log(c("dim", "Start BrowserOS and enable MCP: npm run cli browser start"));
                break;
            }

            try {
                const { listBrowserOSTools } = await import("./tools/browser-os.js");
                const availableTools = await listBrowserOSTools();

                if (availableTools.length === 0) {
                    console.log(c("dim", "No tools available from BrowserOS MCP."));
                } else {
                    console.log(`Found ${c("cyan", String(availableTools.length))} tools:\n`);
                    for (const tool of availableTools) {
                        console.log(`  • ${c("cyan", tool)}`);
                    }
                }
            } catch (err) {
                console.log(c("red", `Failed to list tools: ${err instanceof Error ? err.message : "Unknown error"}`));
            }
            console.log();
            break;

        default:
            console.log(`${c("bold", "Browser Automation Commands:")}
  ${c("cyan", "install")}   Download and install BrowserOS automatically
  ${c("cyan", "start")}     Launch BrowserOS if installed
  ${c("cyan", "status")}    Show available browser backends
  ${c("cyan", "tools")}     List available BrowserOS MCP tools
  ${c("cyan", "use")}       Switch between backends (auto-launches BrowserOS if needed)

${c("bold", "Backends:")}
  ${c("cyan", "playwright")}  Built-in Playwright (headless Chrome, default)
  ${c("cyan", "browseros")}   BrowserOS - full browser with extensions & AI

${c("bold", "Usage:")}
  npm run cli browser install             Auto-install BrowserOS
  npm run cli browser start               Start BrowserOS & enable MCP
  npm run cli browser status              Check which backends are available
  npm run cli browser tools               List available MCP tools
  npm run cli browser use playwright      Use built-in Playwright
  npm run cli browser use browseros       Use BrowserOS (auto-starts if needed)

${c("bold", "BrowserOS Features:")}
  • Real Chrome with all your extensions
  • AI agents run on YOUR browser, not cloud
  • Visual workflows and scheduled tasks
  • Privacy-first with local models support
`);
    }
}

function showHelp() {
    console.log(`${c("bold", "Usage:")} openwhale <command> [options]

${c("bold", "Commands:")}
  ${c("cyan", "chat")}       Start an AGENTIC chat session (Claude can use tools!)
  ${c("cyan", "whatsapp")}   WhatsApp connection management
    ${c("dim", "login")}     Pair WhatsApp via QR code
  ${c("cyan", "browser")}    Browser automation settings (Playwright/BrowserOS)
  ${c("cyan", "test")}       Run tests on all features
  ${c("cyan", "providers")}  List available AI providers
  ${c("cyan", "tools")}      List available agent tools
  ${c("cyan", "channels")}   List communication channels
  ${c("cyan", "serve")}      Start the HTTP server
  ${c("cyan", "help")}       Show this help message

${c("bold", "Examples:")}
  openwhale chat              Start agentic chat (can use WhatsApp, exec, etc.)
  openwhale whatsapp login    Pair WhatsApp via QR code
  openwhale test              Test all features
  openwhale serve             Start server on port 7777

${c("bold", "Environment Variables:")}
  ANTHROPIC_API_KEY    Your Anthropic API key
  WHATSAPP_OWNER_NUMBER   Your WhatsApp number for messaging
`);
}

function showProviders() {
    console.log(c("bold", "Available AI Providers:\n"));

    const providers = [
        { name: "Anthropic", key: "ANTHROPIC_API_KEY", models: ["claude-sonnet-4-20250514", "claude-3-opus", "claude-3-haiku"] },
        { name: "OpenAI", key: "OPENAI_API_KEY", models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"] },
        { name: "Google", key: "GOOGLE_API_KEY", models: ["gemini-1.5-pro", "gemini-1.5-flash"] },
        { name: "DeepSeek", key: "DEEPSEEK_API_KEY", models: ["deepseek-chat", "deepseek-coder"] },
        { name: "Groq", key: "GROQ_API_KEY", models: ["llama-3.1-70b", "mixtral-8x7b"] },
        { name: "Ollama", key: null, models: ["llama3.2", "mistral", "phi3"] },
    ];

    for (const p of providers) {
        const hasKey = p.key === null || !!process.env[p.key];
        const status = hasKey ? c("green", "● Connected") : c("dim", "○ Not configured");
        console.log(`  ${c("cyan", p.name.padEnd(12))} ${status}`);
        console.log(`    Models: ${c("dim", p.models.join(", "))}`);
    }
    console.log();
}

function showTools() {
    console.log(c("bold", "Available Agent Tools:\n"));

    const tools = toolRegistry.list();
    const categories = [...new Set(tools.map(t => t.category))];

    for (const cat of categories) {
        console.log(`  ${c("yellow", cat.toUpperCase())}`);
        for (const tool of tools.filter(t => t.category === cat)) {
            console.log(`    ${c("cyan", tool.name.padEnd(16))} ${tool.description}`);
        }
        console.log();
    }

    // Add WhatsApp as a special tool
    console.log(`  ${c("yellow", "MESSAGING")}`);
    console.log(`    ${c("cyan", "whatsapp_send".padEnd(16))} Send WhatsApp messages`);
    console.log();
}

function showChannels() {
    console.log(c("bold", "Communication Channels:\n"));

    const channels = [
        { name: "Web", type: "WebSocket", key: null, status: true },
        { name: "Telegram", type: "Bot", key: "TELEGRAM_BOT_TOKEN", status: !!process.env.TELEGRAM_BOT_TOKEN },
        { name: "Discord", type: "Bot", key: "DISCORD_BOT_TOKEN", status: !!process.env.DISCORD_BOT_TOKEN },
        { name: "Slack", type: "Bot", key: "SLACK_BOT_TOKEN", status: !!process.env.SLACK_BOT_TOKEN },
        { name: "WhatsApp", type: "Baileys", key: "WHATSAPP_OWNER_NUMBER", status: !!process.env.WHATSAPP_OWNER_NUMBER },
    ];

    for (const ch of channels) {
        const status = ch.status ? c("green", "● Connected") : c("dim", "○ Not configured");
        console.log(`  ${c("cyan", ch.name.padEnd(12))} ${ch.type.padEnd(10)} ${status}`);
    }
    console.log();
}

/**
 * Process an incoming WhatsApp message through Claude and respond
 */
async function processWhatsAppMessage(from: string, content: string) {
    console.log(c("magenta", `\n📱 Incoming WhatsApp from ${from}: "${content.slice(0, 50)}..."`));

    const provider = registry.getProvider(currentModel) as AnthropicProvider;
    if (!provider) {
        console.log(c("red", "Cannot respond - Anthropic provider not available"));
        return;
    }

    const context: ToolCallContext = {
        sessionId: `whatsapp-${from}-${Date.now()}`,
        workspaceDir: process.cwd(),
        sandboxed: false,
    };

    // Use the SAME tools as CLI - full parity!
    const allTools = toolRegistry.getAll();
    const tools = allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toolRegistry.zodToJsonSchema(tool.parameters),
    }));

    // Add WhatsApp-specific tool
    tools.push({
        name: "whatsapp_send",
        description: "Send a WhatsApp message to a phone number",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Phone number with country code" },
                message: { type: "string", description: "Message to send" },
            },
            required: ["to", "message"],
        },
    });

    // Full system prompt with all capabilities - same as CLI
    const systemPrompt = `You are OpenWhale, an AI assistant responding via WhatsApp.
You have FULL access to all tools - exactly the same as CLI mode!

AVAILABLE TOOLS:
- exec: Execute shell commands
- file: Read/write files
- web_fetch: Fetch URL content
- browser: FULL BROWSER AUTOMATION with Playwright - navigate, click, type, screenshot, extract text
- screenshot: Capture the user's screen and analyze it with vision
- code_exec: Write and run JavaScript/TypeScript/Python code
- memory: Store and recall information
- image: Generate images
- canvas: Create visual diagrams
- cron: Schedule tasks
- tts: Text-to-speech
- nodes: Manage agent nodes

The user's WhatsApp number is: ${from}

IMPORTANT: Keep responses concise for mobile. Execute tools when asked.
For research tasks: USE THE BROWSER TOOL to navigate websites, take screenshots, and gather information.
For code tasks: USE code_exec to write and run code.

Be proactive - if the user asks you to research something, actually GO TO websites using browser tool!`;

    try {
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [
            { role: "user", content },
        ];

        let reply = "";
        let iterations = 0;
        const maxIterations = 10; // Prevent infinite loops

        // Agentic loop - keep executing tools until done (like CLI mode)
        while (iterations < maxIterations) {
            iterations++;

            const response = await provider.complete({
                model: currentModel,
                messages,
                systemPrompt,
                tools,
                maxTokens: 2000,
                stream: false,
            });

            // If no tool calls, we have the final response
            if (!response.toolCalls || response.toolCalls.length === 0) {
                reply = response.content || "Done!";
                break;
            }

            // Process tool calls
            const toolResults: Array<{ name: string; result: string }> = [];

            for (const toolCall of response.toolCalls) {
                console.log(c("yellow", `  🔧 WhatsApp tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments).slice(0, 100)}...)`));

                try {
                    const result = await executeTool(toolCall.name, toolCall.arguments, context);
                    const resultStr = result.isError
                        ? `Error: ${result.content}`
                        : result.content.slice(0, 5000); // Truncate long results

                    toolResults.push({ name: toolCall.name, result: resultStr });
                    console.log(c("dim", `    ✓ ${toolCall.name} completed`));
                } catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    toolResults.push({ name: toolCall.name, result: `Error: ${errMsg}` });
                    console.log(c("red", `    ✗ ${toolCall.name} failed: ${errMsg}`));
                }
            }

            // Add assistant response and tool results to messages
            const assistantContent = response.content
                ? `${response.content}\n\n[Tool calls executed]`
                : "[Tool calls executed]";
            messages.push({ role: "assistant", content: assistantContent });

            // Add tool results as user message for next iteration
            const toolResultsStr = toolResults
                .map(t => `Tool ${t.name} result:\n${t.result}`)
                .join("\n\n");
            messages.push({ role: "user", content: `Tool results:\n${toolResultsStr}\n\nPlease continue or provide the final response.` });
        }

        // Truncate reply for WhatsApp (max 4096 chars)
        if (reply.length > 4000) {
            reply = reply.slice(0, 3950) + "\n\n... (truncated for WhatsApp)";
        }

        // Send response back via WhatsApp
        console.log(c("cyan", `  📤 Replying to ${from}: "${reply.slice(0, 50)}..."`));
        await sendWhatsAppMessage(from, reply);

    } catch (error: any) {
        console.error(c("red", `  Error processing WhatsApp: ${error.message}`));
        await sendWhatsAppMessage(from, `Sorry, I encountered an error: ${error.message.slice(0, 100)}`);
    }
}

async function startAgenticChat() {
    console.log(c("bold", `🤖 Starting AGENTIC chat with ${currentModel}...\n`));
    console.log(c("dim", "Claude now has access to tools: exec, file, web_fetch, whatsapp_send, and more!"));
    console.log(c("dim", "Try: 'send a hello message to my whatsapp' or 'list files in /tmp'\n"));
    console.log(c("dim", "Type 'exit' to quit, '/model <name>' to change models, '/clear' to reset\n"));

    // Get the Anthropic provider (it supports tools)
    const provider = registry.getProvider(currentModel) as AnthropicProvider;
    if (!provider) {
        console.log(c("red", "Anthropic provider not available. Set ANTHROPIC_API_KEY."));
        return;
    }

    // Initialize WhatsApp with message handler for incoming messages (optional - skip if dashboard is running)
    // Check if dashboard is already running (it will handle WhatsApp)
    let dashboardRunning = false;
    try {
        const res = await fetch("http://localhost:7777/health", { signal: AbortSignal.timeout(500) });
        dashboardRunning = res.ok;
    } catch {
        // Dashboard not running
    }

    if (dashboardRunning) {
        console.log(c("dim", "📱 WhatsApp: Using dashboard connection (server running on :7777)"));
    } else {
        try {
            console.log(c("dim", "📱 Connecting WhatsApp for incoming messages..."));
            initWhatsApp({
                printQR: false, // Don't print QR in chat mode, user should use 'whatsapp login' first
                onMessage: (msg) => {
                    // whatsapp-baileys already filters outgoing (fromMe) messages
                    // Process all incoming messages that have content
                    if (msg.content) {
                        console.log(c("magenta", `\n📱 Processing message from ${msg.from}`));
                        processWhatsAppMessage(msg.from, msg.content);
                    }
                },
                onConnected: () => {
                    console.log(c("green", "📱 WhatsApp connected - listening for messages"));
                },
            });
        } catch {
            console.log(c("dim", "📱 WhatsApp skipped"));
        }
    }


    // Build dynamic skill tools list from registered skills
    const readySkills = skillRegistry.list().filter(s => s.isReady());
    const allSkillTools = skillRegistry.getAllTools();
    const skillToolsList = allSkillTools.map(tool =>
        `  - ${tool.name}: ${tool.description}`
    ).join("\n");

    // System prompt that exposes all tools including skills
    const systemPrompt = `You are OpenWhale, an AI assistant with access to powerful tools.

CORE TOOLS:
- exec: Execute shell commands
- file: Read and write files  
- web_fetch: Fetch URLs and web content
- whatsapp_send: Send WhatsApp messages (to: phone number, message: text)
- image: Generate images
- memory: Store and recall information
- screenshot: Capture the user's screen and analyze what you see
- code_exec: Write and run JavaScript/TypeScript/Python code on-the-fly

📧 SKILL TOOLS (${readySkills.length} skills ready):
${skillToolsList || "No skills configured - check dashboard settings"}

👁️ VISION: Use 'screenshot' to capture and ANALYZE the user's screen!

🔥 CODE: Use 'code_exec' for UNLIMITED capabilities - write code to do anything!

CRITICAL RULES:
- When asked about emails, use gmail_inbox, gmail_search, gmail_send tools
- When asked about calendar, use google_calendar_list, google_calendar_create tools
- When asked about notes, use apple_notes_list, apple_notes_search tools
- When asked about reminders, use apple_reminders_list, apple_reminders_create tools
- ALWAYS use the appropriate skill tool - don't say you can't do something if a tool exists!

For WhatsApp, the user's number is: ${process.env.WHATSAPP_OWNER_NUMBER || "not configured"}

Be helpful and proactive. USE YOUR TOOLS to accomplish tasks!`;

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const context: ToolCallContext = {
        sessionId: `cli-${Date.now()}`,
        workspaceDir: process.cwd(),
        sandboxed: false,
    };

    const prompt = () => {
        rl.question(c("green", "You: "), async (input) => {
            input = input.trim();

            if (!input) {
                prompt();
                return;
            }

            if (input === "exit" || input === "/exit") {
                console.log(c("dim", "\nGoodbye! 🐋"));
                rl.close();
                process.exit(0);
            }

            if (input === "/clear") {
                conversationHistory = [];
                console.log(c("dim", "Conversation cleared.\n"));
                prompt();
                return;
            }

            if (input.startsWith("/model ")) {
                currentModel = input.slice(7).trim();
                console.log(c("dim", `Switched to ${currentModel}\n`));
                prompt();
                return;
            }

            // Add to history
            conversationHistory.push({ role: "user", content: input });

            try {
                // Agentic loop - keep going until no more tool calls
                let iterations = 0;
                const maxIterations = 10;

                while (iterations < maxIterations) {
                    iterations++;

                    // Make the API call with tools
                    const response = await provider.complete({
                        model: currentModel,
                        messages: conversationHistory,
                        systemPrompt,
                        maxTokens: 4096,
                        tools: [
                            {
                                name: "exec",
                                description: "Execute a shell command",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        command: { type: "string", description: "The shell command to execute" },
                                        timeout: { type: "number", description: "Timeout in ms (default 30000)" },
                                    },
                                    required: ["command"],
                                },
                            },
                            {
                                name: "file",
                                description: "Read or write files",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        action: { type: "string", enum: ["read", "write", "list"], description: "Action to perform" },
                                        path: { type: "string", description: "File or directory path" },
                                        content: { type: "string", description: "Content to write (for write action)" },
                                    },
                                    required: ["action", "path"],
                                },
                            },
                            {
                                name: "web_fetch",
                                description: "Fetch a URL",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        url: { type: "string", description: "URL to fetch" },
                                        method: { type: "string", enum: ["GET", "POST"], description: "HTTP method" },
                                    },
                                    required: ["url"],
                                },
                            },
                            {
                                name: "whatsapp_send",
                                description: "Send a WhatsApp message",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        to: { type: "string", description: "Phone number with country code (e.g., +14378762880)" },
                                        message: { type: "string", description: "Message to send" },
                                    },
                                    required: ["message"],
                                },
                            },
                            {
                                name: "memory",
                                description: "Store or recall information",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        action: { type: "string", enum: ["remember", "recall", "list"], description: "Action" },
                                        key: { type: "string", description: "Memory key" },
                                        content: { type: "string", description: "Content to remember" },
                                    },
                                    required: ["action"],
                                },
                            },
                            {
                                name: "code_exec",
                                description: "Execute dynamically generated code. Write and run JavaScript/TypeScript/Python code on-the-fly when no existing tool meets your needs. This gives UNLIMITED capabilities - you can process data, make API calls, parse files, calculate anything, create visualizations, and more!",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        code: { type: "string", description: "The JavaScript/TypeScript/Python code to execute" },
                                        language: { type: "string", enum: ["javascript", "typescript", "python"], description: "Programming language (default: javascript)" },
                                        description: { type: "string", description: "Brief description of what this code does" },
                                    },
                                    required: ["code"],
                                },
                            },
                            {
                                name: "screenshot",
                                description: "Capture a screenshot of the user's screen. Use this to SEE what's displayed on their computer. After capturing, the image will be sent to you for vision analysis. You can describe what you see, find UI elements, read text from the screen, etc.",
                                parameters: {
                                    type: "object",
                                    properties: {
                                        region: { type: "string", enum: ["fullscreen", "window", "selection"], description: "What to capture (default: fullscreen)" },
                                        delay: { type: "number", description: "Delay in seconds before capture" },
                                    },
                                    required: [],
                                },
                            },
                        ],
                    });

                    // Print assistant's text response
                    if (response.content) {
                        console.log(c("cyan", "\nClaude: ") + formatMarkdown(response.content));
                    }

                    // Check for tool calls
                    if (response.toolCalls && response.toolCalls.length > 0) {
                        // Add assistant message WITH tool calls to history (critical for Anthropic)
                        conversationHistory.push({
                            role: "assistant",
                            content: response.content || "",
                            toolCalls: response.toolCalls, // Include tool calls!
                        });

                        // Execute each tool
                        const toolResults: ChatMessage["toolResults"] = [];

                        for (const toolCall of response.toolCalls) {
                            const result = await executeTool(
                                toolCall.name,
                                toolCall.arguments,
                                context
                            );

                            toolResults.push({
                                toolCallId: toolCall.id,
                                content: result.content,
                                isError: result.isError,
                                imageBase64: result.imageBase64,
                                imageMimeType: result.imageMimeType || (result.imageBase64 ? "image/jpeg" : undefined),
                            });
                        }

                        // Add tool results to history
                        conversationHistory.push({
                            role: "tool",
                            content: "",
                            toolResults,
                        });

                        // Continue the loop to let Claude respond to tool results
                        continue;
                    }

                    // No tool calls - we're done
                    if (response.content) {
                        conversationHistory.push({ role: "assistant", content: response.content });
                    }
                    break;
                }

                if (iterations >= maxIterations) {
                    console.log(c("yellow", "\n[Reached maximum tool iterations]"));
                }

                console.log();
            } catch (error: any) {
                console.log(c("red", `\nError: ${error.message}\n`));
            }

            prompt();
        });
    };

    prompt();
}

async function runTests() {
    console.log(c("bold", "Running OpenWhale Tests...\n"));

    const tests = [
        { name: "Provider Registry", test: testProviders },
        { name: "Chat Completion", test: testChat },
        { name: "Tools Registration", test: testTools },
        { name: "Database Connection", test: testDatabase },
        { name: "API Server", test: testServer },
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
        process.stdout.write(`  ${name.padEnd(25)}`);
        try {
            await test();
            console.log(c("green", "✓ PASS"));
            passed++;
        } catch (error: any) {
            console.log(c("red", `✗ FAIL: ${error.message}`));
            failed++;
        }
    }

    console.log();
    console.log(`Results: ${c("green", `${passed} passed`)}, ${c(failed > 0 ? "red" : "dim", `${failed} failed`)}`);
}

async function testProviders() {
    const providers = registry.listProviders();
    if (providers.length === 0) throw new Error("No providers registered");
}

async function testChat() {
    const provider = registry.getProvider("claude-sonnet-4-20250514");
    if (!provider) throw new Error("Anthropic provider not available");

    let gotResponse = false;
    for await (const event of provider.stream({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Say 'test passed' in exactly 2 words" }],
        maxTokens: 10,
    })) {
        if (event.type === "text") {
            gotResponse = true;
        }
    }
    if (!gotResponse) throw new Error("No response received");
}

async function testTools() {
    const tools = toolRegistry.list();
    if (tools.length < 10) throw new Error(`Only ${tools.length} tools registered`);
}

async function testDatabase() {
    const { createDatabase } = await import("./db/connection.js");
    const db = createDatabase({ type: "sqlite", url: "file:./data/openwhale.db" });
    if (!db) throw new Error("Database not created");
}

async function testServer() {
    try {
        const res = await fetch("http://localhost:7777/health");
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
    } catch {
        throw new Error("Server not running on port 7777");
    }
}

async function startServer() {
    console.log(c("bold", "Starting OpenWhale server...\n"));
    await import("./index.js");
}

async function interactiveMode() {
    console.log(c("bold", "Interactive Mode - Enter a command:\n"));
    console.log("  " + ["chat", "test", "providers", "tools", "channels", "serve", "help"].map(cmd => cmd === "chat" ? c("cyan", cmd) : cmd).join("  "));
    console.log();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question(c("blue", "openwhale> "), async (input) => {
        const cmd = input.trim().toLowerCase();
        rl.close();

        if (cmd === "exit" || cmd === "quit") {
            console.log(c("dim", "Goodbye! 🐋"));
            process.exit(0);
        }

        // Re-run with the command
        process.argv[2] = cmd;
        await main();
    });
}

// Run main
main().catch((err) => {
    console.error(c("red", `Error: ${err.message}`));
    process.exit(1);
});
