/**
 * OpenWhale Server - Shared HTTP server module
 * 
 * Exports startServer function for use by:
 * - CLI (openwhale serve)
 * - Daemon (always-on background service)
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { serveStatic } from "@hono/node-server/serve-static";
import { createDatabase } from "./db/connection.js";
import { authMiddleware } from "./auth/middleware.js";
import { createAuthRoutes } from "./gateway/routes/auth.js";
import { createAgentRoutes } from "./gateway/routes/agent.js";
import { createProviderRoutes } from "./gateway/routes/providers.js";
import { createAdminRoutes } from "./gateway/routes/admin.js";
import { createDashboardRoutes } from "./dashboard/routes.js";
import { loadConfig } from "./config/loader.js";
import { createLogger } from "./utils/logger.js";
import { initializeProviders } from "./providers/index.js";
import { initializeChannels } from "./channels/index.js";
import { toolRegistry } from "./tools/index.js";
import { apiRateLimiter, authRateLimiter } from "./security/rate-limit.js";

const log = createLogger("server");

let serverInstance: ReturnType<typeof serve> | null = null;

/**
 * Kill any process using the specified port (macOS/Linux)
 */
async function killPortProcess(port: number): Promise<void> {
    try {
        const { execSync } = await import("child_process");
        // Find process using the port (macOS/Linux)
        const result = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: "utf-8" }).trim();
        if (result) {
            const pids = result.split("\n").filter(Boolean);
            for (const pid of pids) {
                try {
                    execSync(`kill -9 ${pid} 2>/dev/null || true`);
                    log.info(`Killed process ${pid} on port ${port}`);
                } catch {
                    // Ignore errors
                }
            }
            // Wait a moment for port to be released
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch {
        // lsof might not be available, that's okay
    }
}

/**
 * Start the OpenWhale HTTP server
 * @param port - Port to listen on (default: config.gateway.port or 7777)
 * @returns Promise that resolves when server is running
 */
export async function startServer(port?: number): Promise<{ port: number; app: Hono }> {
    // Load configuration first to get port
    const config = await loadConfig();
    const serverPort = port ?? config.gateway.port;

    // Kill any existing process on the port
    await killPortProcess(serverPort);

    log.info("🐋 Starting OpenWhale server...");
    log.info("Configuration loaded", { mode: config.security.mode });

    // Initialize database
    const db = createDatabase(config.database);
    log.info("Database connected", { type: config.database.type });

    // Initialize providers
    initializeProviders();

    // Initialize channels (Telegram, Discord, Slack, etc.)
    await initializeChannels(db, config);

    // Log available tools
    log.info(`Tools registered: ${toolRegistry.list().length}`, {
        tools: toolRegistry.list().map(t => t.name),
    });

    // Create Hono app
    const app = new Hono();

    // Global middleware
    app.use("*", logger());
    app.use("*", secureHeaders());
    app.use("*", cors({
        origin: config.security.cors.origins,
        credentials: config.security.cors.credentials,
    }));

    // Health check (public)
    app.get("/health", (c) => c.json({
        status: "ok",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        providers: config.providers?.length ?? 0,
    }));

    // Public auth routes with rate limiting
    const auth = new Hono();
    auth.use("*", authRateLimiter);
    auth.route("/", createAuthRoutes(db, config));
    app.route("/auth", auth);

    // Protected API routes
    const api = new Hono();
    api.use("*", apiRateLimiter);
    api.use("*", authMiddleware(db, config));
    api.route("/agent", createAgentRoutes(db, config));
    api.route("/providers", createProviderRoutes(config));
    api.route("/admin", createAdminRoutes(db, config));
    app.route("/api", api);

    // Dashboard routes (admin only in production)
    app.route("/dashboard", createDashboardRoutes(db, config));

    // Serve dashboard static files
    app.use("/dashboard/assets/*", serveStatic({ root: "./src/dashboard" }));

    // OpenAI-compatible endpoint
    app.post("/v1/chat/completions", authMiddleware(db, config), async (c) => {
        return createAgentRoutes(db, config).fetch(
            new Request(c.req.url.replace("/v1/chat/completions", "/api/agent/chat"), {
                method: c.req.method,
                headers: c.req.raw.headers,
                body: c.req.raw.body,
            })
        );
    });

    // Start server
    log.info(`🐋 OpenWhale listening on http://0.0.0.0:${serverPort}`);
    log.info(`   Health: http://localhost:${serverPort}/health`);
    log.info(`   Dashboard: http://localhost:${serverPort}/dashboard`);
    log.info(`   API: http://localhost:${serverPort}/api`);

    serverInstance = serve({
        fetch: app.fetch,
        port: serverPort,
        hostname: config.gateway.host,
    });

    return { port: serverPort, app };
}

/**
 * Stop the HTTP server
 */
export async function stopServer(): Promise<void> {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
        log.info("🐋 OpenWhale server stopped");
    }
}

/**
 * Check if server is running
 */
export function isServerRunning(): boolean {
    return serverInstance !== null;
}
