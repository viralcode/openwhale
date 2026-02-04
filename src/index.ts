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
import { createDashboardRoutes, loadConfigsFromDB } from "./dashboard/routes.js";
import { loadConfig } from "./config/loader.js";
import { createLogger } from "./utils/logger.js";
import { initializeProviders } from "./providers/index.js";
import { initializeChannels } from "./channels/index.js";
import { toolRegistry } from "./tools/index.js";
import { registerAllSkills, skillRegistry } from "./skills/index.js";
import { apiRateLimiter, authRateLimiter } from "./security/rate-limit.js";
import { initializeExtensionLoader } from "./tools/extension-loader.js";

const log = createLogger("main");

async function main() {
    log.info("🐋 Starting OpenWhale...");

    // Load configuration
    const config = await loadConfig();
    log.info("Configuration loaded", { mode: config.security.mode });

    // Initialize database
    const db = createDatabase(config.database);
    log.info("Database connected", { type: config.database.type });

    // Load skill/provider configs from database FIRST (sets env vars)
    await loadConfigsFromDB(db);

    // Initialize providers
    initializeProviders();

    // Register all skills - env vars should now be set from loadConfigsFromDB
    registerAllSkills();

    // Initialize channels (Telegram, Discord, Slack, etc.)
    await initializeChannels(db, config);

    // Initialize extension loader (hot-loads persistent extensions)
    await initializeExtensionLoader();

    // Log available tools
    log.info(`Tools registered: ${toolRegistry.list().length}`, {
        tools: toolRegistry.list().map(t => t.name),
    });

    // Log available skills
    const readySkills = skillRegistry.list().filter(s => s.isReady());
    log.info(`Skills ready: ${readySkills.length}/${skillRegistry.list().length}`, {
        ready: readySkills.map(s => s.metadata.name),
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
        // Proxy to agent routes
        return createAgentRoutes(db, config).fetch(
            new Request(c.req.url.replace("/v1/chat/completions", "/api/agent/chat"), {
                method: c.req.method,
                headers: c.req.raw.headers,
                body: c.req.raw.body,
            })
        );
    });

    // Start server
    const port = config.gateway.port;
    log.info(`🐋 OpenWhale listening on http://0.0.0.0:${port}`);
    log.info(`   Health: http://localhost:${port}/health`);
    log.info(`   Dashboard: http://localhost:${port}/dashboard`);
    log.info(`   API: http://localhost:${port}/api`);

    serve({
        fetch: app.fetch,
        port,
        hostname: config.gateway.host,
    });
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

