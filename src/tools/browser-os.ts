/**
 * BrowserOS Backend - MCP-based browser automation via BrowserOS
 * 
 * BrowserOS is an open-source agentic browser that exposes an MCP server
 * for automation. This backend connects to BrowserOS to perform browser actions.
 * 
 * @see https://github.com/browseros-ai/BrowserOS
 */

import type { ToolResult } from "./base.js";

// Default BrowserOS MCP endpoint
const DEFAULT_BROWSEROS_URL = "http://127.0.0.1:9201";

export interface BrowserOSConfig {
    url: string;  // BrowserOS MCP server URL
}

/**
 * Check if BrowserOS is available and running
 */
export async function isBrowserOSAvailable(url: string = DEFAULT_BROWSEROS_URL): Promise<{
    available: boolean;
    running?: boolean;
    mcpEnabled?: boolean;
    version?: string;
    toolCount?: number;
    error?: string;
}> {
    let isRunning = false;

    try {
        // First try a simple health check to see if BrowserOS is running
        const healthRes = await fetch(`${url}/health`, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
        });

        if (healthRes.ok) {
            isRunning = true;
        }
    } catch {
        // Health endpoint might not exist
    }

    // Try using the MCPClient which handles the protocol properly
    try {
        const mcpUrl = url.endsWith("/mcp") ? url : `${url}/mcp`;
        console.log(`[BrowserOS] Checking MCPClient at ${mcpUrl}...`);
        const client = getMCPClient(mcpUrl);
        const tools = await client.listTools();
        console.log(`[BrowserOS] MCPClient returned ${tools.length} tools:`, tools.join(", "));

        // Only consider available if we actually got tools
        if (tools.length > 0) {
            return {
                available: true,
                running: true,
                mcpEnabled: true,
                toolCount: tools.length,
            };
        }

        // 0 tools means MCP server isn't properly responding
        console.log("[BrowserOS] MCPClient returned 0 tools - server not ready");
        // Fall through to try direct check
    } catch (mcpErr) {
        console.log("[BrowserOS] MCPClient check failed:", mcpErr instanceof Error ? mcpErr.message : String(mcpErr));
        // MCPClient failed, continue with direct check
    }

    try {
        // Try MCP initialize to verify the MCP server is enabled and responding
        const mcpUrl = url.endsWith("/mcp") ? url : `${url}/mcp`;
        const res = await fetch(mcpUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                    protocolVersion: "2024-11-05",
                    capabilities: {},
                    clientInfo: { name: "OpenWhale", version: "0.1.0" },
                },
            }),
            signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
            const text = await res.text();
            // Check if it's "Service Unavailable" or actual JSON
            if (text.includes("Service Unavailable") || text.includes("Not Found")) {
                return {
                    available: false,
                    running: isRunning,
                    mcpEnabled: false,
                    error: isRunning
                        ? "MCP server not enabled. Go to chrome://browseros/mcp to enable it."
                        : "BrowserOS not running"
                };
            }

            try {
                const data = JSON.parse(text) as {
                    result?: { serverInfo?: { version?: string } };
                    error?: { message: string };
                };

                if (data.result) {
                    return {
                        available: true,
                        running: true,
                        mcpEnabled: true,
                        version: data.result.serverInfo?.version,
                    };
                }
            } catch {
                // Not valid JSON
            }
        }

        return {
            available: false,
            running: isRunning,
            mcpEnabled: false,
            error: isRunning
                ? "MCP server not enabled. Go to chrome://browseros/mcp to enable it."
                : "BrowserOS not running"
        };
    } catch (err) {
        return {
            available: false,
            running: isRunning,
            mcpEnabled: false,
            error: isRunning
                ? "MCP server not enabled. Go to chrome://browseros/mcp to enable it."
                : (err instanceof Error ? err.message : "Connection failed")
        };
    }
}

/**
 * Check if BrowserOS is installed on this system
 */
export async function isBrowserOSInstalled(): Promise<{ installed: boolean; path?: string }> {
    const { existsSync } = await import("node:fs");
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");

    const platform = process.platform;

    if (platform === "darwin") {
        const appPath = "/Applications/BrowserOS.app";
        if (existsSync(appPath)) {
            return { installed: true, path: appPath };
        }
        // Also check user Applications
        const userAppPath = join(homedir(), "Applications", "BrowserOS.app");
        if (existsSync(userAppPath)) {
            return { installed: true, path: userAppPath };
        }
    } else if (platform === "win32") {
        const paths = [
            join(homedir(), "AppData", "Local", "Programs", "BrowserOS", "BrowserOS.exe"),
            "C:\\Program Files\\BrowserOS\\BrowserOS.exe",
            "C:\\Program Files (x86)\\BrowserOS\\BrowserOS.exe",
        ];
        for (const p of paths) {
            if (existsSync(p)) {
                return { installed: true, path: p };
            }
        }
    } else if (platform === "linux") {
        const paths = [
            join(homedir(), ".local", "bin", "BrowserOS.AppImage"),
            "/usr/bin/browseros",
            "/usr/local/bin/browseros",
        ];
        for (const p of paths) {
            if (existsSync(p)) {
                return { installed: true, path: p };
            }
        }
    }

    return { installed: false };
}

/**
 * Launch BrowserOS and wait for it to be ready
 */
export async function launchBrowserOS(url: string = DEFAULT_BROWSEROS_URL): Promise<{
    success: boolean;
    error?: string;
}> {
    const { spawn } = await import("node:child_process");
    const platform = process.platform;

    // Check if already running
    const status = await isBrowserOSAvailable(url);
    if (status.available) {
        return { success: true };
    }

    // Check if installed
    const installed = await isBrowserOSInstalled();
    if (!installed.installed || !installed.path) {
        return {
            success: false,
            error: "BrowserOS is not installed. Run: npm run cli browser install"
        };
    }

    console.log("[BrowserOS] Launching BrowserOS...");

    try {
        // Launch based on platform
        if (platform === "darwin") {
            spawn("open", ["-a", installed.path], {
                detached: true,
                stdio: "ignore",
            }).unref();
        } else if (platform === "win32") {
            spawn(installed.path, [], {
                detached: true,
                stdio: "ignore",
                shell: true,
            }).unref();
        } else {
            spawn(installed.path, [], {
                detached: true,
                stdio: "ignore",
            }).unref();
        }

        // Wait for BrowserOS to be ready (up to 30 seconds)
        console.log("[BrowserOS] Waiting for MCP server to be ready...");
        const maxWait = 30000;
        const checkInterval = 1000;
        let waited = 0;

        while (waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;

            const checkStatus = await isBrowserOSAvailable(url);
            if (checkStatus.available) {
                console.log("[BrowserOS] ✓ Ready!");
                return { success: true };
            }

            // Print progress every 5 seconds
            if (waited % 5000 === 0) {
                console.log(`[BrowserOS] Still waiting... (${waited / 1000}s)`);
            }
        }

        return {
            success: false,
            error: "BrowserOS launched but MCP server not responding after 30 seconds"
        };

    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to launch BrowserOS"
        };
    }
}

/**
 * Ensure BrowserOS is running, launching it if needed
 */
export async function ensureBrowserOSRunning(url: string = DEFAULT_BROWSEROS_URL): Promise<{
    success: boolean;
    wasLaunched: boolean;
    error?: string;
}> {
    // Check if already running
    const status = await isBrowserOSAvailable(url);
    if (status.available) {
        return { success: true, wasLaunched: false };
    }

    // Try to launch
    const launchResult = await launchBrowserOS(url);
    return {
        success: launchResult.success,
        wasLaunched: launchResult.success,
        error: launchResult.error,
    };
}

/**
 * MCP JSON-RPC client for BrowserOS
 * Uses the standard MCP protocol with streamable HTTP transport
 */
class MCPClient {
    private url: string;
    private requestId: number = 0;
    private initialized: boolean = false;
    private sessionId?: string;

    constructor(url: string) {
        this.url = url;
    }

    /**
     * Send a JSON-RPC request to the MCP server
     */
    private async sendRequest(method: string, params?: Record<string, unknown>): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }> {
        const id = ++this.requestId;
        const body = {
            jsonrpc: "2.0",
            id,
            method,
            params: params || {},
        };

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            };

            // Include session ID if we have one
            if (this.sessionId) {
                headers["Mcp-Session-Id"] = this.sessionId;
            }

            const res = await fetch(this.url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(60000),
            });

            // Capture session ID from response
            const newSessionId = res.headers.get("Mcp-Session-Id");
            if (newSessionId) {
                this.sessionId = newSessionId;
            }

            if (!res.ok) {
                const errorText = await res.text();
                return { success: false, error: `HTTP ${res.status}: ${errorText}` };
            }

            const contentType = res.headers.get("Content-Type") || "";

            // Handle SSE response
            if (contentType.includes("text/event-stream")) {
                return await this.handleSSEResponse(res);
            }

            // Handle JSON response
            const data = await res.json() as {
                jsonrpc: string;
                id: number;
                result?: unknown;
                error?: { code: number; message: string; data?: unknown };
            };

            if (data.error) {
                return { success: false, error: data.error.message };
            }

            return { success: true, result: data.result };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : "MCP request failed"
            };
        }
    }

    /**
     * Handle Server-Sent Events response
     */
    private async handleSSEResponse(res: Response): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }> {
        const text = await res.text();
        const lines = text.split("\n");

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(data) as {
                        jsonrpc: string;
                        id?: number;
                        result?: unknown;
                        error?: { code: number; message: string };
                    };

                    if (parsed.error) {
                        return { success: false, error: parsed.error.message };
                    }

                    if (parsed.result !== undefined) {
                        return { success: true, result: parsed.result };
                    }
                } catch {
                    // Continue to next line
                }
            }
        }

        return { success: true, result: null };
    }

    /**
     * Initialize the MCP connection
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        const result = await this.sendRequest("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {
                tools: {},
                prompts: {},
                resources: {},
            },
            clientInfo: {
                name: "OpenWhale",
                version: "0.1.0",
            },
        });

        if (result.success) {
            // Send initialized notification
            await this.sendRequest("notifications/initialized", {});
            this.initialized = true;
            return true;
        }

        return false;
    }

    /**
     * List available tools
     */
    async listTools(): Promise<string[]> {
        await this.initialize();

        const result = await this.sendRequest("tools/list", {});
        if (!result.success || !result.result) {
            return [];
        }

        const tools = result.result as { tools?: Array<{ name: string }> };
        return tools.tools?.map(t => t.name) || [];
    }

    /**
     * Call a tool
     */
    async callTool(name: string, args: Record<string, unknown>): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }> {
        await this.initialize();

        return await this.sendRequest("tools/call", {
            name,
            arguments: args,
        });
    }
}

// Singleton MCP client
let mcpClient: MCPClient | null = null;

function getMCPClient(url: string): MCPClient {
    if (!mcpClient || !url.includes(mcpClient["url"])) {
        mcpClient = new MCPClient(url);
    }
    return mcpClient;
}

/**
 * Execute a BrowserOS MCP tool call
 */
async function callBrowserOSTool(
    url: string,
    toolName: string,
    args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    // Ensure URL ends with /mcp
    const mcpUrl = url.endsWith("/mcp") ? url : `${url}/mcp`;
    const client = getMCPClient(mcpUrl);

    console.log(`[BrowserOS] Calling tool: ${toolName} with args:`, JSON.stringify(args));
    try {
        const result = await client.callTool(toolName, args);
        console.log(`[BrowserOS] Tool result: success=${result.success}, error=${result.error || "none"}, result=${JSON.stringify(result.result)?.substring(0, 200)}`);
        return result;
    } catch (err) {
        console.error(`[BrowserOS] Tool call error:`, err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * List available BrowserOS tools
 */
export async function listBrowserOSTools(url: string = DEFAULT_BROWSEROS_URL): Promise<string[]> {
    const mcpUrl = url.endsWith("/mcp") ? url : `${url}/mcp`;
    const client = getMCPClient(mcpUrl);
    return await client.listTools();
}

/**
 * BrowserOS Browser Backend
 * Implements browser automation via BrowserOS MCP server
 */
export class BrowserOSBackend {
    private url: string;

    constructor(config: BrowserOSConfig = { url: DEFAULT_BROWSEROS_URL }) {
        this.url = config.url;
    }

    /**
     * Check connection status
     */
    async getStatus(): Promise<{
        running: boolean;
        version?: string;
        tabs?: number;
    }> {
        const status = await isBrowserOSAvailable(this.url);
        if (!status.available) {
            return { running: false };
        }

        // Get tabs count
        const tabsResult = await callBrowserOSTool(this.url, "get_tabs", {});
        const tabCount = Array.isArray(tabsResult.result) ? tabsResult.result.length : 0;

        return {
            running: true,
            version: status.version,
            tabs: tabCount,
        };
    }

    /**
     * Navigate to a URL
     */
    async navigate(url: string): Promise<ToolResult> {
        // Use browser_open_tab which is the correct BrowserOS tool
        let result = await callBrowserOSTool(this.url, "browser_open_tab", { url });

        // Auto-recover from "No current window" by creating one first
        const resultContent = result.result as { isError?: boolean; content?: Array<{ text?: string }> };
        const errorMsg = resultContent?.content?.[0]?.text || result.error || "";
        if (!result.success || resultContent?.isError) {
            if (errorMsg.toLowerCase().includes("no current window")) {
                console.log("[BrowserOS] No window found, creating one and retrying...");
                const createResult = await callBrowserOSTool(this.url, "browser_create_window", {});
                if (createResult.success) {
                    console.log("[BrowserOS] ✓ Window created, retrying navigation...");
                    result = await callBrowserOSTool(this.url, "browser_open_tab", { url });
                }
            }
        }

        // Check for isError in the result content
        if (!result.success || (result.result as { isError?: boolean })?.isError) {
            const errorContent = result.result as { content?: Array<{ text?: string }> };
            const finalError = errorContent?.content?.[0]?.text || result.error || "Navigation failed";
            return {
                success: false,
                content: "",
                error: finalError,
            };
        }

        return {
            success: true,
            content: `Navigated to ${url}`,
        };
    }

    /**
     * Click an element
     */
    async click(selector: string): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "browser_click_element", { elementRef: selector });

        return {
            success: result.success,
            content: result.success ? `Clicked: ${selector}` : "",
            error: result.error,
        };
    }

    /**
     * Type text
     */
    async type(selector: string, text: string): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "browser_type_text", { elementRef: selector, text });

        return {
            success: result.success,
            content: result.success ? `Typed text into: ${selector}` : "",
            error: result.error,
        };
    }

    /**
     * Press a key
     */
    async press(key: string): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "browser_send_keys", { keys: key });

        return {
            success: result.success,
            content: result.success ? `Pressed key: ${key}` : "",
            error: result.error,
        };
    }

    /**
     * Take a screenshot
     */
    async screenshot(fullPage: boolean = false): Promise<ToolResult> {
        // First get the active tab to get its ID
        const tabResult = await callBrowserOSTool(this.url, "browser_get_active_tab", {});

        let tabId: number | undefined;
        if (tabResult.success && tabResult.result) {
            const tabData = tabResult.result as { structuredContent?: { tabId?: number }; tabId?: number };
            tabId = tabData.structuredContent?.tabId || tabData.tabId;
        }

        if (!tabId) {
            return {
                success: false,
                content: "",
                error: "Could not get active tab for screenshot",
            };
        }

        console.log(`[BrowserOS] Taking screenshot of tab ${tabId}`);
        const result = await callBrowserOSTool(this.url, "browser_get_screenshot", { tabId });

        if (!result.success) {
            return {
                success: false,
                content: "",
                error: result.error,
            };
        }

        // Check for error in result
        const resultData = result.result as { isError?: boolean; content?: Array<{ type: string; text?: string; data?: string }>; structuredContent?: { base64?: string } };
        if (resultData.isError) {
            const errorText = resultData.content?.[0]?.text || "Screenshot failed";
            return {
                success: false,
                content: "",
                error: errorText,
            };
        }

        // BrowserOS returns base64 in structuredContent or content array
        let base64: string | undefined;

        // Check structuredContent first
        if (resultData.structuredContent?.base64) {
            base64 = resultData.structuredContent.base64;
        }

        // Check content array for image type
        if (!base64 && resultData.content && Array.isArray(resultData.content)) {
            const imgContent = resultData.content.find(c => c.type === "image" || c.type === "image/png");
            if (imgContent && imgContent.data) {
                base64 = imgContent.data;
            }
        }

        console.log(`[BrowserOS] Screenshot captured. Base64 length: ${base64?.length || 0}`);

        if (!base64) {
            return {
                success: false,
                content: "",
                error: "Screenshot captured but no image data returned",
            };
        }

        return {
            success: true,
            content: "Screenshot captured via BrowserOS",
            metadata: {
                image: `data:image/png;base64,${base64}`,
                base64,
            },
        };
    }

    /**
     * Get page content
     */
    async getContent(): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "browser_get_page_content", {});

        if (!result.success) {
            return {
                success: false,
                content: "",
                error: result.error,
            };
        }

        const content = result.result as { content?: string; html?: string; text?: string };

        return {
            success: true,
            content: content.content || content.text || content.html || "",
        };
    }

    /**
     * Get page snapshot with interactive elements
     */
    async snapshot(): Promise<ToolResult> {
        // Get current tab info first
        const tabResult = await callBrowserOSTool(this.url, "browser_get_active_tab", {});
        const lines: string[] = [];

        if (tabResult.success && tabResult.result) {
            // BrowserOS returns structured content
            const resultData = tabResult.result as { structuredContent?: { url?: string; title?: string } };
            const tab = resultData.structuredContent || tabResult.result as { url?: string; title?: string };
            lines.push(`Page: ${tab.title || "Unknown"}`);
            lines.push(`URL: ${tab.url || "Unknown"}`);
        }

        // Try to get interactive elements - requires a limit parameter
        const elementsResult = await callBrowserOSTool(this.url, "browser_get_interactive_elements", { limit: 200 });

        // Check for isError in result
        const resultContent = elementsResult.result as { isError?: boolean; content?: Array<{ type?: string; text?: string }>; structuredContent?: { elements?: Array<unknown> } };

        if (elementsResult.success && !resultContent?.isError && resultContent?.structuredContent?.elements) {
            const elements = resultContent.structuredContent.elements as Array<{ ref?: string; text?: string; type?: string }>;

            lines.push("\nInteractive Elements:");
            for (const el of elements.slice(0, 200)) {
                let line = `[ref=${el.ref || "?"}]`;
                if (el.type) line += ` <${el.type}>`;
                if (el.text) line += ` "${el.text.slice(0, 100)}"`;
                lines.push(line);
            }

            return {
                success: true,
                content: lines.join("\n"),
                metadata: { elementCount: elements.length },
            };
        }

        // If elements failed, try to get page content instead
        if (lines.length > 0) {
            lines.push("\n(Could not get interactive elements)");
            return {
                success: true,
                content: lines.join("\n"),
            };
        }

        // Fallback to page content
        return this.getContent();
    }

    /**
     * Scroll the page
     */
    async scroll(direction: "up" | "down", amount?: number): Promise<ToolResult> {
        const toolName = direction === "down" ? "browser_scroll_down" : "browser_scroll_up";
        const result = await callBrowserOSTool(this.url, toolName, {});

        return {
            success: result.success,
            content: result.success ? `Scrolled ${direction}` : "",
            error: result.error,
        };
    }

    /**
     * Wait for condition
     */
    async wait(ms: number): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "wait", { ms });

        return {
            success: result.success,
            content: result.success ? `Waited ${ms}ms` : "",
            error: result.error,
        };
    }

    /**
     * Get open tabs
     */
    async getTabs(): Promise<Array<{ id: string; url: string; title: string }>> {
        const result = await callBrowserOSTool(this.url, "get_tabs", {});

        if (!result.success || !Array.isArray(result.result)) {
            return [];
        }

        return result.result as Array<{ id: string; url: string; title: string }>;
    }

    /**
     * Close a tab
     */
    async closeTab(tabId?: string): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "close_tab", { tabId });

        return {
            success: result.success,
            content: result.success ? "Tab closed" : "",
            error: result.error,
        };
    }

    /**
     * Execute arbitrary JavaScript
     */
    async evaluate(script: string): Promise<ToolResult> {
        const result = await callBrowserOSTool(this.url, "evaluate", { script });

        return {
            success: result.success,
            content: result.success ? JSON.stringify(result.result) : "",
            error: result.error,
        };
    }
}

// Singleton instance
let browserOSInstance: BrowserOSBackend | null = null;

export function getBrowserOSBackend(url?: string): BrowserOSBackend {
    if (!browserOSInstance || url) {
        browserOSInstance = new BrowserOSBackend({ url: url || DEFAULT_BROWSEROS_URL });
    }
    return browserOSInstance;
}

export { DEFAULT_BROWSEROS_URL };
