#!/usr/bin/env tsx
/**
 * OpenWhale Feature Test Script - Tests all agentic features
 */
import "dotenv/config";

// Test results tracking
const results: Array<{ name: string; status: "PASS" | "FAIL"; details?: string }> = [];

function log(msg: string) {
    console.log(msg);
}

async function test(name: string, fn: () => Promise<void>) {
    process.stdout.write(`  ${name.padEnd(35)}`);
    try {
        await fn();
        results.push({ name, status: "PASS" });
        console.log("\x1b[32m✓ PASS\x1b[0m");
    } catch (error: any) {
        results.push({ name, status: "FAIL", details: error.message });
        console.log(`\x1b[31m✗ FAIL: ${error.message.slice(0, 50)}\x1b[0m`);
    }
}

async function main() {
    console.log("\n\x1b[36m═══════════════════════════════════════════════════\x1b[0m");
    console.log("\x1b[36m     🐋 OpenWhale Comprehensive Feature Test\x1b[0m");
    console.log("\x1b[36m═══════════════════════════════════════════════════\x1b[0m\n");

    // ═════════════════════════════════════════════════════
    // SECTION 1: Provider Tests
    // ═════════════════════════════════════════════════════
    log("\x1b[1m📡 PROVIDERS\x1b[0m");

    await test("Anthropic Provider Load", async () => {
        const { createAnthropicProvider } = await import("./src/providers/anthropic.js");
        const provider = createAnthropicProvider();
        if (!provider) throw new Error("Provider not created");
    });

    await test("Anthropic Chat Completion", async () => {
        const { createAnthropicProvider } = await import("./src/providers/anthropic.js");
        const provider = createAnthropicProvider();
        if (!provider) throw new Error("No provider");

        let response = "";
        for await (const event of provider.stream({
            model: "claude-sonnet-4-20250514",
            messages: [{ role: "user", content: "Reply with only: TEST_OK" }],
            maxTokens: 20,
        })) {
            if (event.type === "text") response += event.text;
        }
        if (!response.includes("OK") && !response.includes("TEST")) {
            throw new Error(`Unexpected: ${response}`);
        }
    });

    await test("Ollama Provider Load", async () => {
        const { createOllamaProvider } = await import("./src/providers/openai-compatible.js");
        const provider = createOllamaProvider();
        if (!provider) throw new Error("Provider not created");
    });

    // ═════════════════════════════════════════════════════
    // SECTION 2: Tool Tests
    // ═════════════════════════════════════════════════════
    log("\n\x1b[1m🛠️  TOOLS\x1b[0m");

    await test("Tool Registry Load", async () => {
        const { toolRegistry } = await import("./src/tools/index.js");
        const tools = toolRegistry.list();
        if (tools.length < 10) throw new Error(`Only ${tools.length} tools`);
    });

    await test("Exec Tool", async () => {
        const { execTool } = await import("./src/tools/exec.js");
        const result = await execTool.execute(
            { command: "echo 'hello'", timeout: 5000 },
            { sessionId: "test", workspaceDir: "/tmp", sandboxed: false }
        );
        if (!result.success) throw new Error(result.error);
        if (!result.content.includes("hello")) throw new Error("No output");
    });

    await test("File Tool", async () => {
        const { fileTool } = await import("./src/tools/file.js");
        const result = await fileTool.execute(
            { action: "write", path: "/tmp/openwhale-test.txt", content: "test content", createDirs: true },
            { sessionId: "test", workspaceDir: "/tmp", sandboxed: false }
        );
        if (!result.success) throw new Error(result.error);
    });

    await test("Web Fetch Tool", async () => {
        const { webFetchTool } = await import("./src/tools/web-fetch.js");
        const result = await webFetchTool.execute(
            { url: "https://httpbin.org/get", method: "GET", extractText: true },
            { sessionId: "test", workspaceDir: "/tmp", sandboxed: false }
        );
        if (!result.success) throw new Error(result.error);
    });

    await test("Memory Tool", async () => {
        const { memoryTool } = await import("./src/tools/memory.js");
        const set = await memoryTool.execute(
            { action: "remember", key: "test_key", content: "test_value" },
            { sessionId: "test", workspaceDir: "/tmp", sandboxed: false }
        );
        if (!set.success) throw new Error(set.error);

        const get = await memoryTool.execute(
            { action: "recall", key: "test_key" },
            { sessionId: "test", workspaceDir: "/tmp", sandboxed: false }
        );
        if (!get.content.includes("test_value")) throw new Error("Value mismatch");
    });

    await test("Canvas Tool", async () => {
        const { canvasTool } = await import("./src/tools/canvas.js");
        const result = await canvasTool.execute(
            { action: "create", width: 100, height: 100, background: "#ffffff" },
            { sessionId: "test", workspaceDir: "/tmp", sandboxed: false }
        );
        if (!result.success) throw new Error(result.error);
    });

    // ═════════════════════════════════════════════════════
    // SECTION 3: Channel Tests
    // ═════════════════════════════════════════════════════
    log("\n\x1b[1m📱 CHANNELS\x1b[0m");

    await test("Web Channel Adapter", async () => {
        const { webAdapter } = await import("./src/channels/web.js");
        if (!webAdapter) throw new Error("No web adapter");
        if (!webAdapter.name) throw new Error("No name");
    });

    await test("WhatsApp Adapter Load", async () => {
        const { createWhatsAppAdapter } = await import("./src/channels/whatsapp.js");
        const adapter = createWhatsAppAdapter();
        if (!adapter) throw new Error("No adapter");
    });

    await test("Telegram Adapter Load", async () => {
        const { createTelegramAdapter } = await import("./src/channels/telegram.js");
        const adapter = createTelegramAdapter(); // Will be null without token
        // Just checking it doesn't crash
    });

    await test("Discord Adapter Load", async () => {
        const { createDiscordAdapter } = await import("./src/channels/discord.js");
        const adapter = createDiscordAdapter();
    });

    await test("Slack Adapter Load", async () => {
        const { createSlackAdapter } = await import("./src/channels/slack.js");
        const adapter = createSlackAdapter();
    });

    // ═════════════════════════════════════════════════════
    // SECTION 4: Database Tests
    // ═════════════════════════════════════════════════════
    log("\n\x1b[1m💾 DATABASE\x1b[0m");

    await test("Database Connection", async () => {
        const { createDatabase } = await import("./src/db/connection.js");
        const db = createDatabase({ type: "sqlite", url: "file:./data/openwhale.db" });
        if (!db) throw new Error("No database");
    });

    await test("Schema Tables Exist", async () => {
        const { createDatabase } = await import("./src/db/connection.js");
        const { users, sessions, apiKeys, auditLogs } = await import("./src/db/schema.js");
        const db = createDatabase({ type: "sqlite", url: "file:./data/openwhale.db" });

        // Just check we can query without error
        const result = db.select().from(users).limit(1).all();
    });

    // ═════════════════════════════════════════════════════
    // SECTION 5: API Server Tests
    // ═════════════════════════════════════════════════════
    log("\n\x1b[1m🌐 API SERVER\x1b[0m");

    await test("Health Endpoint", async () => {
        const res = await fetch("http://localhost:7777/health");
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const data = await res.json() as { status: string };
        if (data.status !== "ok") throw new Error("Status not ok");
    });

    await test("Dashboard Stats API", async () => {
        const res = await fetch("http://localhost:7777/dashboard/api/stats");
        if (!res.ok) throw new Error(`Status: ${res.status}`);
    });

    await test("Dashboard Providers API", async () => {
        const res = await fetch("http://localhost:7777/dashboard/api/providers");
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const data = await res.json() as { providers: any[] };
        if (data.providers.length !== 7) throw new Error(`Expected 7, got ${data.providers.length}`);
    });

    await test("Dashboard Tools API", async () => {
        const res = await fetch("http://localhost:7777/dashboard/api/tools");
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const data = await res.json() as { tools: any[] };
        if (data.tools.length !== 12) throw new Error(`Expected 12, got ${data.tools.length}`);
    });

    await test("Dashboard Channels API", async () => {
        const res = await fetch("http://localhost:7777/dashboard/api/channels");
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const data = await res.json() as { channels: any[] };
        if (data.channels.length !== 5) throw new Error(`Expected 5, got ${data.channels.length}`);
    });

    await test("Dashboard HTML", async () => {
        const res = await fetch("http://localhost:7777/dashboard");
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        const html = await res.text();
        if (!html.includes("OpenWhale")) throw new Error("Missing title");
    });

    // ═════════════════════════════════════════════════════
    // Summary
    // ═════════════════════════════════════════════════════
    console.log("\n\x1b[36m═══════════════════════════════════════════════════\x1b[0m");
    console.log("\x1b[36m                    TEST SUMMARY\x1b[0m");
    console.log("\x1b[36m═══════════════════════════════════════════════════\x1b[0m\n");

    const passed = results.filter(r => r.status === "PASS").length;
    const failed = results.filter(r => r.status === "FAIL").length;

    console.log(`  \x1b[32m✓ Passed: ${passed}\x1b[0m`);
    console.log(`  \x1b[31m✗ Failed: ${failed}\x1b[0m`);
    console.log(`  Total:   ${results.length}`);

    if (failed > 0) {
        console.log("\n\x1b[1mFailed Tests:\x1b[0m");
        for (const r of results.filter(r => r.status === "FAIL")) {
            console.log(`  - ${r.name}: ${r.details}`);
        }
    }

    console.log("\n");
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
