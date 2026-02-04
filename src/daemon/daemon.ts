/**
 * OpenWhale Daemon Service - FULL FEATURED
 * 
 * Always-on background service that includes:
 * - Dashboard HTTP server on port 7777
 * - WhatsApp listener with auto-reply AI
 * - All tools available (exec, browser, file, etc.)
 * - Unix socket for IPC commands
 * - Secure localhost-only binding
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { createServer as createNetServer, Server as NetServer, Socket } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { logAuditEvent } from "../security/audit.js";
import { initWhatsApp, sendWhatsAppMessage, isWhatsAppConnected } from "../channels/whatsapp-baileys.js";
import { createAnthropicProvider, AnthropicProvider } from "../providers/anthropic.js";
import { toolRegistry } from "../tools/index.js";
import type { ToolCallContext } from "../tools/base.js";
import { isMessageProcessed, markMessageProcessed } from "../db/message-dedupe.js";
import { isCommand, processCommand } from "./chat-commands.js";

export type DaemonConfig = {
    socketPath: string;
    pidFile: string;
    logFile: string;
    httpPort: number;
    maxConnections: number;
    idleTimeout: number;
    enableDashboard: boolean;
    enableWhatsApp: boolean;
    enableAI: boolean;
};

export type DaemonStatus = {
    running: boolean;
    pid?: number;
    uptime?: number;
    startedAt?: Date;
    connections: number;
    messagesProcessed: number;
    whatsappConnected: boolean;
    dashboardUrl?: string;
    features: {
        dashboard: boolean;
        whatsapp: boolean;
        ai: boolean;
    };
};

// Store last screenshot in memory for easy WhatsApp sending
let lastScreenshotBase64: string | null = null;

export type DaemonMessage = {
    type: "command" | "query" | "subscribe" | "ping" | "chat";
    id: string;
    payload?: Record<string, unknown>;
};

export type DaemonResponse = {
    id: string;
    success: boolean;
    data?: unknown;
    error?: string;
};

const DEFAULT_CONFIG: DaemonConfig = {
    socketPath: join(process.cwd(), ".openwhale", "daemon.sock"),
    pidFile: join(process.cwd(), ".openwhale", "daemon.pid"),
    logFile: join(process.cwd(), ".openwhale", "daemon.log"),
    httpPort: 7777,
    maxConnections: 10,
    idleTimeout: 0,
    enableDashboard: true,
    enableWhatsApp: true,
    enableAI: true,
};

export class OpenWhaleDaemon extends EventEmitter {
    private config: DaemonConfig;
    private socketServer: NetServer | null = null;
    private httpServer: ReturnType<typeof createHttpServer> | null = null;
    private connections: Set<Socket> = new Set();
    private startTime: Date | null = null;
    private messagesProcessed = 0;
    private shutdownHandlers: Array<() => Promise<void>> = [];
    private aiProvider: AnthropicProvider | null = null;
    private currentModel = "claude-sonnet-4-20250514";

    constructor(config: Partial<DaemonConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start the daemon with all features
     */
    async start(): Promise<void> {
        // Ensure .openwhale directory exists
        const dir = join(process.cwd(), ".openwhale");
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        // Check if already running
        if (await this.isRunning()) {
            throw new Error("Daemon is already running");
        }

        // Remove stale socket
        if (existsSync(this.config.socketPath)) {
            unlinkSync(this.config.socketPath);
        }

        // Initialize AI provider
        if (this.config.enableAI) {
            this.aiProvider = createAnthropicProvider();
            if (this.aiProvider) {
                console.log("[DAEMON] ✓ AI provider initialized");
            }
        }

        // Start Unix socket server for IPC
        this.socketServer = createNetServer((socket) => this.handleConnection(socket));
        await new Promise<void>((resolve, reject) => {
            this.socketServer!.listen(this.config.socketPath, () => resolve());
            this.socketServer!.on("error", reject);
        });
        console.log(`[DAEMON] ✓ IPC socket: ${this.config.socketPath}`);

        // Start Dashboard HTTP server
        if (this.config.enableDashboard) {
            await this.startDashboard();
        }

        // Start WhatsApp listener
        if (this.config.enableWhatsApp) {
            await this.startWhatsApp();
        }

        // Write PID file
        writeFileSync(this.config.pidFile, String(process.pid));
        this.startTime = new Date();

        // Setup graceful shutdown
        this.setupSignalHandlers();

        logAuditEvent({
            type: "auth_event",
            result: "success",
            reason: "Daemon started with full features",
        });

        console.log(`[DAEMON] ✓ Started (PID: ${process.pid})`);
        this.emit("started");
    }

    /**
     * Start the dashboard HTTP server
     */
    private async startDashboard(): Promise<void> {
        // Dynamically import the server module to avoid circular deps
        const { startServer } = await import("../server.js");

        // The server module creates its own HTTP server
        // We'll integrate with it by calling startServer
        try {
            await startServer(this.config.httpPort);
            console.log(`[DAEMON] ✓ Dashboard: http://localhost:${this.config.httpPort}`);
        } catch (err) {
            console.error("[DAEMON] Dashboard failed to start:", err);
        }
    }

    /**
     * Start WhatsApp listener with AI auto-reply
     */
    private async startWhatsApp(): Promise<void> {
        console.log("[DAEMON] Connecting WhatsApp...");

        // Get owner number (strip non-digits)
        const ownerNumber = (process.env.WHATSAPP_OWNER_NUMBER || "").replace(/[^0-9]/g, "");
        console.log(`[DAEMON] Owner number: ${ownerNumber}`);


        initWhatsApp({
            printQR: false,
            onMessage: async (msg) => {
                // Skip empty messages
                if (!msg.content) return;

                // Get message ID for deduplication
                const messageId = String(msg.metadata?.id || `${msg.from}-${Date.now()}`);

                // SQLite deduplication: skip if we've already processed this message
                if (isMessageProcessed(messageId)) {
                    console.log(`[DAEMON] 📱 Skipping already processed message: ${messageId}`);
                    return;
                }

                // Get sender info
                const fromRaw = msg.from;
                const fromDigits = fromRaw.replace(/[^0-9]/g, "");
                const isFromMe = msg.metadata?.fromMe === true;
                const isGroup = fromRaw.includes("@g.us") || fromRaw.includes("-");

                // Skip bot's outbound messages
                const isSameAsOwner = ownerNumber && fromDigits.includes(ownerNumber);
                if (isFromMe && !isSameAsOwner) {
                    console.log(`[DAEMON] 📱 Skipping bot's outbound reply`);
                    markMessageProcessed(messageId, "outbound", fromRaw);
                    return;
                }

                console.log(`[DAEMON] 📱 Message from ${fromRaw} (fromMe: ${isFromMe}, owner: ${isSameAsOwner}, group: ${isGroup}): "${msg.content.slice(0, 50)}..."`);

                // Skip group messages
                if (isGroup) {
                    console.log("[DAEMON]   ↳ Skipping group message");
                    markMessageProcessed(messageId, "inbound", fromRaw);
                    return;
                }

                // Only process messages from owner
                if (!isSameAsOwner) {
                    console.log(`[DAEMON]   ↳ Skipping - not from owner (${ownerNumber})`);
                    markMessageProcessed(messageId, "inbound", fromRaw);
                    return;
                }

                // Mark as processed BEFORE handling to prevent race conditions
                markMessageProcessed(messageId, "inbound", fromRaw);
                this.messagesProcessed++;

                // Check for chat commands (e.g., /status, /new, /think)
                if (isCommand(msg.content)) {
                    console.log("[DAEMON]   ↳ Processing chat command...");
                    const commandResponse = processCommand(fromRaw, msg.content);
                    if (commandResponse) {
                        await sendWhatsAppMessage(fromRaw, commandResponse);
                        return;
                    }
                }

                // Auto-reply with AI if enabled
                if (this.config.enableAI && this.aiProvider) {
                    console.log("[DAEMON]   ↳ Processing with AI...");
                    await this.handleWhatsAppMessage(fromRaw, msg.content);
                }
            },
            onConnected: () => {
                console.log("[DAEMON] ✓ WhatsApp connected");
            },
        });
    }

    /**
     * Handle WhatsApp message with AI and tools
     */
    private async handleWhatsAppMessage(from: string, content: string): Promise<void> {
        if (!this.aiProvider) return;

        const context: ToolCallContext = {
            sessionId: `daemon-whatsapp-${from}-${Date.now()}`,
            workspaceDir: process.cwd(),
            sandboxed: false,
        };

        // Build tools list
        const allTools = toolRegistry.getAll();
        const tools = allTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: toolRegistry.zodToJsonSchema(tool.parameters),
        }));

        // Add WhatsApp-specific tools
        tools.push({
            name: "whatsapp_send",
            description: "Send a text message via WhatsApp",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Phone number" },
                    message: { type: "string", description: "Message text" },
                },
                required: ["to", "message"],
            },
        });

        tools.push({
            name: "whatsapp_send_image",
            description: "Send an image via WhatsApp. After taking a screenshot, call this with use_last_screenshot: true to send it.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Phone number to send to" },
                    use_last_screenshot: { type: "boolean", description: "Set to true to send the last captured screenshot" },
                    caption: { type: "string", description: "Optional caption for the image" },
                },
                required: ["to", "use_last_screenshot"],
            },
        });

        const systemPrompt = `You are OpenWhale Daemon, an always-on AI assistant responding via WhatsApp.
You have FULL access to all tools: exec, file, browser, screenshot, code_exec, memory, and more.
The user's number is: ${from}. Keep responses concise for mobile.

IMPORTANT: To send a screenshot to the user:
1. First use the 'screenshot' tool to capture the screen
2. Then immediately use 'whatsapp_send_image' with: to="${from}", use_last_screenshot=true, caption="Your description"

Be helpful and proactive. Execute tools when asked.`;

        try {
            const messages: Array<{ role: "user" | "assistant"; content: string }> = [
                { role: "user", content },
            ];

            let reply = "";
            let iterations = 0;
            const maxIterations = 10;

            while (iterations < maxIterations) {
                iterations++;

                const response = await this.aiProvider.complete({
                    model: this.currentModel,
                    messages,
                    systemPrompt,
                    tools,
                    maxTokens: 2000,
                    stream: false,
                });

                if (!response.toolCalls || response.toolCalls.length === 0) {
                    reply = response.content || "Done!";
                    break;
                }

                // Process tool calls
                const toolResults: Array<{ name: string; result: string }> = [];

                for (const toolCall of response.toolCalls) {
                    console.log(`[DAEMON]   🔧 Tool: ${toolCall.name}`);

                    try {
                        const result = await this.executeTool(toolCall.name, toolCall.arguments, context);
                        toolResults.push({ name: toolCall.name, result: result.slice(0, 5000) });
                    } catch (err) {
                        const errMsg = err instanceof Error ? err.message : String(err);
                        toolResults.push({ name: toolCall.name, result: `Error: ${errMsg}` });
                    }
                }

                const assistantContent = response.content
                    ? `${response.content}\n\n[Tools executed]`
                    : "[Tools executed]";
                messages.push({ role: "assistant", content: assistantContent });

                const toolResultsStr = toolResults
                    .map(t => `${t.name}: ${t.result}`)
                    .join("\n\n");
                messages.push({ role: "user", content: `Results:\n${toolResultsStr}\n\nContinue or provide final response.` });
            }

            // Truncate for WhatsApp
            if (reply.length > 4000) {
                reply = reply.slice(0, 3950) + "\n\n... (truncated)";
            }

            console.log(`[DAEMON]   📤 Replying: "${reply.slice(0, 50)}..."`);
            await sendWhatsAppMessage(from, reply);

        } catch (error: any) {
            console.error(`[DAEMON] WhatsApp error: ${error.message}`);
            await sendWhatsAppMessage(from, `Error: ${error.message.slice(0, 100)}`);
        }
    }

    /**
     * Execute a tool
     */
    private async executeTool(name: string, args: unknown, context: ToolCallContext): Promise<string> {
        // Special case: whatsapp_send (text)
        if (name === "whatsapp_send") {
            const { to, message } = args as { to: string; message: string };
            await sendWhatsAppMessage(to, message);
            return `Text message sent to ${to}`;
        }

        // Special case: whatsapp_send_image
        if (name === "whatsapp_send_image") {
            const { to, use_last_screenshot, caption } = args as { to: string; use_last_screenshot?: boolean; caption?: string };

            if (use_last_screenshot && lastScreenshotBase64) {
                // Convert base64 to buffer
                const imageBuffer = Buffer.from(lastScreenshotBase64, "base64");
                console.log(`[DAEMON] Sending last screenshot (${imageBuffer.length} bytes) to ${to}`);

                // Send image via WhatsApp
                const result = await sendWhatsAppMessage(to, {
                    image: imageBuffer,
                    caption: caption || "Screenshot from OpenWhale",
                });

                if (result.success) {
                    return `Screenshot image sent to ${to}`;
                } else {
                    throw new Error(result.error || "Failed to send image");
                }
            } else {
                throw new Error("No screenshot available. Please capture a screenshot first.");
            }
        }

        const result = await toolRegistry.execute(name, args, context);
        if (result.success) {
            // Special case: screenshot tool - store in memory for whatsapp_send_image
            if (name === "screenshot" && result.metadata?.base64) {
                lastScreenshotBase64 = result.metadata.base64 as string;
                console.log(`[DAEMON] Screenshot captured and stored (${lastScreenshotBase64.length} chars)`);
                return `${result.content}\n\nScreenshot is ready to send. Use whatsapp_send_image with use_last_screenshot: true`;
            }
            return result.content;
        } else {
            throw new Error(result.error || "Tool execution failed");
        }
    }

    /**
     * Handle IPC client connection
     */
    private handleConnection(socket: Socket): void {
        if (this.connections.size >= this.config.maxConnections) {
            socket.end(JSON.stringify({ error: "Max connections exceeded" }));
            return;
        }

        this.connections.add(socket);
        let buffer = "";

        socket.on("data", async (data) => {
            buffer += data.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const message: DaemonMessage = JSON.parse(line);
                    const response = await this.handleMessage(message);
                    socket.write(JSON.stringify(response) + "\n");
                } catch (err) {
                    const error = err instanceof Error ? err.message : String(err);
                    socket.write(JSON.stringify({ error }) + "\n");
                }
            }
        });

        socket.on("close", () => this.connections.delete(socket));
        socket.on("error", () => this.connections.delete(socket));
    }

    /**
     * Handle IPC message
     */
    private async handleMessage(message: DaemonMessage): Promise<DaemonResponse> {
        this.messagesProcessed++;

        switch (message.type) {
            case "ping":
                return { id: message.id, success: true, data: "pong" };

            case "query":
                return this.handleQuery(message);

            case "command":
                return this.handleCommand(message);

            case "chat":
                return this.handleChatMessage(message);

            default:
                return { id: message.id, success: false, error: `Unknown: ${message.type}` };
        }
    }

    private handleQuery(message: DaemonMessage): DaemonResponse {
        const query = message.payload?.query as string;
        if (query === "status") {
            return { id: message.id, success: true, data: this.getStatus() };
        }
        return { id: message.id, success: false, error: `Unknown query: ${query}` };
    }

    private async handleCommand(message: DaemonMessage): Promise<DaemonResponse> {
        const command = message.payload?.command as string;
        const allowed = ["reload", "stats", "flush-logs"];

        if (!allowed.includes(command)) {
            return { id: message.id, success: false, error: "Command not allowed" };
        }

        switch (command) {
            case "stats":
                return { id: message.id, success: true, data: this.getStatus() };
            case "reload":
                return { id: message.id, success: true, data: "Reloaded" };
            default:
                return { id: message.id, success: true, data: "OK" };
        }
    }

    private async handleChatMessage(message: DaemonMessage): Promise<DaemonResponse> {
        const content = message.payload?.content as string;
        if (!content || !this.aiProvider) {
            return { id: message.id, success: false, error: "No content or AI not available" };
        }

        // Simple completion without tools for IPC chat
        const response = await this.aiProvider.complete({
            model: this.currentModel,
            messages: [{ role: "user", content }],
            maxTokens: 1000,
            stream: false,
        });

        return { id: message.id, success: true, data: response.content };
    }

    getStatus(): DaemonStatus {
        return {
            running: this.socketServer !== null,
            pid: process.pid,
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
            startedAt: this.startTime || undefined,
            connections: this.connections.size,
            messagesProcessed: this.messagesProcessed,
            whatsappConnected: isWhatsAppConnected(),
            dashboardUrl: this.config.enableDashboard ? `http://localhost:${this.config.httpPort}` : undefined,
            features: {
                dashboard: this.config.enableDashboard,
                whatsapp: this.config.enableWhatsApp,
                ai: this.config.enableAI && this.aiProvider !== null,
            },
        };
    }

    async isRunning(): Promise<boolean> {
        if (!existsSync(this.config.pidFile)) return false;

        try {
            const pid = parseInt(readFileSync(this.config.pidFile, "utf-8"));
            process.kill(pid, 0);
            return true;
        } catch {
            if (existsSync(this.config.pidFile)) unlinkSync(this.config.pidFile);
            if (existsSync(this.config.socketPath)) unlinkSync(this.config.socketPath);
            return false;
        }
    }

    async stop(): Promise<void> {
        console.log("[DAEMON] Stopping...");

        for (const handler of this.shutdownHandlers) {
            try { await handler(); } catch (err) { console.error("[DAEMON] Shutdown error:", err); }
        }

        for (const socket of this.connections) socket.end();
        this.connections.clear();

        if (this.socketServer) {
            await new Promise<void>((resolve) => this.socketServer!.close(() => resolve()));
            this.socketServer = null;
        }

        if (this.httpServer) {
            await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()));
            this.httpServer = null;
        }

        if (existsSync(this.config.pidFile)) unlinkSync(this.config.pidFile);
        if (existsSync(this.config.socketPath)) unlinkSync(this.config.socketPath);

        logAuditEvent({ type: "auth_event", result: "success", reason: "Daemon stopped" });
        console.log("[DAEMON] Stopped");
        this.emit("stopped");
    }

    onShutdown(handler: () => Promise<void>): void {
        this.shutdownHandlers.push(handler);
    }

    private setupSignalHandlers(): void {
        const shutdown = async () => {
            await this.stop();
            process.exit(0);
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
        process.on("SIGHUP", shutdown);
    }
}

export async function startDaemon(config: Partial<DaemonConfig> = {}): Promise<OpenWhaleDaemon> {
    const daemon = new OpenWhaleDaemon(config);
    await daemon.start();
    return daemon;
}

export async function stopDaemon(): Promise<void> {
    const pidFile = join(process.cwd(), ".openwhale", "daemon.pid");
    if (!existsSync(pidFile)) {
        console.log("[DAEMON] Not running");
        return;
    }

    try {
        const pid = parseInt(readFileSync(pidFile, "utf-8"));
        process.kill(pid, "SIGTERM");
        console.log(`[DAEMON] Sent stop signal to PID ${pid}`);
    } catch (err) {
        console.error("[DAEMON] Failed to stop:", err);
    }
}

export async function getDaemonStatus(): Promise<DaemonStatus> {
    const daemon = new OpenWhaleDaemon();
    const running = await daemon.isRunning();

    if (!running) {
        return {
            running: false,
            connections: 0,
            messagesProcessed: 0,
            whatsappConnected: false,
            features: { dashboard: false, whatsapp: false, ai: false }
        };
    }

    const pidFile = join(process.cwd(), ".openwhale", "daemon.pid");
    const pid = existsSync(pidFile) ? parseInt(readFileSync(pidFile, "utf-8")) : undefined;

    return {
        running: true,
        pid,
        connections: 0,
        messagesProcessed: 0,
        whatsappConnected: isWhatsAppConnected(),
        dashboardUrl: "http://localhost:7777",
        features: { dashboard: true, whatsapp: true, ai: true },
    };
}
