import { z } from "zod";
import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// SCHEMA - All 16 actions from OpenClaw
// ============================================================================

const ActKindSchema = z.enum([
    "click", "type", "press", "hover", "drag", "select", "fill", "resize", "wait", "evaluate", "close"
]);

const ActRequestSchema = z.object({
    kind: ActKindSchema,
    // Common
    ref: z.string().optional().describe("Element ref from snapshot (e.g., '12' or 'e12')"),
    selector: z.string().optional().describe("CSS selector (fallback if no ref)"),
    // click
    doubleClick: z.boolean().optional(),
    button: z.enum(["left", "right", "middle"]).optional(),
    modifiers: z.array(z.string()).optional(),
    // type
    text: z.string().optional(),
    submit: z.boolean().optional().describe("Press Enter after typing"),
    slowly: z.boolean().optional().describe("Type character by character"),
    // press
    key: z.string().optional().describe("Key to press (Enter, Tab, Escape, etc.)"),
    // drag
    startRef: z.string().optional(),
    endRef: z.string().optional(),
    // select
    values: z.array(z.string()).optional(),
    // fill (multiple fields)
    fields: z.array(z.object({
        ref: z.string().optional(),
        selector: z.string().optional(),
        value: z.string(),
    })).optional(),
    // resize
    width: z.number().optional(),
    height: z.number().optional(),
    // wait
    timeMs: z.number().optional().describe("Wait duration in ms"),
    textGone: z.string().optional().describe("Wait until text disappears"),
    textVisible: z.string().optional().describe("Wait until text appears"),
    url: z.string().optional().describe("Wait for URL pattern"),
    // evaluate
    fn: z.string().optional().describe("JavaScript function to evaluate"),
});

const BrowserActionSchema = z.discriminatedUnion("action", [
    // Status & Lifecycle
    z.object({ action: z.literal("status") }),
    z.object({ action: z.literal("start"), headless: z.boolean().optional().default(true) }),
    z.object({ action: z.literal("stop") }),

    // Tabs
    z.object({ action: z.literal("tabs") }),
    z.object({
        action: z.literal("open"),
        url: z.string().url(),
        headless: z.boolean().optional().default(true),
    }),
    z.object({ action: z.literal("focus"), targetId: z.string() }),
    z.object({ action: z.literal("close"), targetId: z.string().optional() }),

    // Navigation
    z.object({
        action: z.literal("navigate"),
        url: z.string().url(),
        waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional().default("domcontentloaded"),
        headless: z.boolean().optional().default(true),
    }),

    // Snapshot & Screenshot
    z.object({
        action: z.literal("snapshot"),
        format: z.enum(["text", "interactive", "aria"]).optional().default("interactive"),
        selector: z.string().optional().describe("Scope snapshot to CSS selector"),
        maxChars: z.number().optional().default(50000),
    }),
    z.object({
        action: z.literal("screenshot"),
        fullPage: z.boolean().optional().default(false),
        selector: z.string().optional().describe("Screenshot specific element"),
        type: z.enum(["png", "jpeg"]).optional().default("png"),
    }),

    // Actions
    z.object({ action: z.literal("act"), request: ActRequestSchema }),

    // Console & Debug
    z.object({
        action: z.literal("console"),
        level: z.enum(["all", "error", "warn", "log", "info"]).optional().default("all"),
        clear: z.boolean().optional(),
    }),

    // PDF Export
    z.object({ action: z.literal("pdf") }),

    // File Upload
    z.object({
        action: z.literal("upload"),
        paths: z.array(z.string()),
        selector: z.string().optional().describe("File input selector"),
    }),

    // Dialog handling
    z.object({
        action: z.literal("dialog"),
        accept: z.boolean().default(true),
        promptText: z.string().optional(),
    }),

    // State Management
    z.object({
        action: z.literal("cookies"),
        operation: z.enum(["get", "set", "clear"]).default("get"),
        cookies: z.array(z.object({
            name: z.string(),
            value: z.string(),
            domain: z.string().optional(),
            path: z.string().optional(),
        })).optional(),
    }),
    z.object({
        action: z.literal("storage"),
        kind: z.enum(["local", "session"]).default("local"),
        operation: z.enum(["get", "set", "clear"]).default("get"),
        key: z.string().optional(),
        value: z.string().optional(),
    }),

    // Legacy aliases for backwards compatibility
    z.object({
        action: z.literal("click"),
        selector: z.string(),
        doubleClick: z.boolean().optional(),
    }),
    z.object({
        action: z.literal("type"),
        selector: z.string(),
        text: z.string(),
        submit: z.boolean().optional(),
    }),
    z.object({
        action: z.literal("scroll"),
        direction: z.enum(["up", "down"]),
        amount: z.number().optional().default(500),
    }),
    z.object({
        action: z.literal("get_text"),
        selector: z.string().optional(),
    }),
    z.object({
        action: z.literal("evaluate"),
        script: z.string(),
    }),
    z.object({
        action: z.literal("press"),
        key: z.string(),
    }),
    z.object({
        action: z.literal("hover"),
        selector: z.string(),
    }),
    z.object({
        action: z.literal("wait"),
        timeMs: z.number().optional(),
        selector: z.string().optional(),
        text: z.string().optional(),
    }),
]);

type BrowserAction = z.infer<typeof BrowserActionSchema>;
type ActRequest = z.infer<typeof ActRequestSchema>;

// ============================================================================
// BROWSER MANAGER - Enhanced with tab tracking & console capture
// ============================================================================

interface TabInfo {
    targetId: string;
    url: string;
    title: string;
    page: Page;
}

interface ConsoleMessage {
    level: string;
    text: string;
    timestamp: number;
}

class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private tabs: Map<string, TabInfo> = new Map();
    private activeTabId: string | null = null;
    private isHeadless: boolean = true;
    private consoleMessages: ConsoleMessage[] = [];
    private dialogHandler: ((accept: boolean, text?: string) => void) | null = null;
    private refMap: Map<string, string> = new Map(); // ref -> selector mapping

    // Status
    getStatus() {
        return {
            running: this.browser?.isConnected() ?? false,
            headless: this.isHeadless,
            tabs: this.tabs.size,
            activeTab: this.activeTabId,
        };
    }

    // Start browser
    async start(headless: boolean = true): Promise<void> {
        if (this.browser?.isConnected()) {
            if (this.isHeadless !== headless) {
                await this.stop();
            } else {
                return;
            }
        }

        this.isHeadless = headless;
        this.browser = await chromium.launch({
            headless,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            // Use modern Chrome user-agent so sites render properly
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            // Disable cache to get fresh content
            bypassCSP: true,
        });

        // Clear cookies/cache for fresh sessions
        await this.context.clearCookies();

        console.log(`[Browser] Started in ${headless ? 'headless' : 'visible'} mode`);
    }

    // Stop browser
    async stop(): Promise<void> {
        for (const tab of this.tabs.values()) {
            if (!tab.page.isClosed()) {
                await tab.page.close();
            }
        }
        this.tabs.clear();
        this.activeTabId = null;

        if (this.context) {
            await this.context.close();
            this.context = null;
        }

        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }

        this.consoleMessages = [];
        console.log("[Browser] Stopped");
    }

    // Get/ensure browser running
    private async ensureBrowser(headless: boolean = true): Promise<BrowserContext> {
        if (!this.browser?.isConnected() || !this.context) {
            await this.start(headless);
        }
        return this.context!;
    }

    // List tabs
    getTabs(): Array<{ targetId: string; url: string; title: string; active: boolean }> {
        return Array.from(this.tabs.values()).map(tab => ({
            targetId: tab.targetId,
            url: tab.url,
            title: tab.title,
            active: tab.targetId === this.activeTabId,
        }));
    }

    // Open new tab
    async openTab(url: string, headless: boolean = true): Promise<TabInfo> {
        const context = await this.ensureBrowser(headless);
        const page = await context.newPage();
        const targetId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Capture console
        page.on("console", msg => {
            this.consoleMessages.push({
                level: msg.type(),
                text: msg.text(),
                timestamp: Date.now(),
            });
            // Keep last 500 messages
            if (this.consoleMessages.length > 500) {
                this.consoleMessages = this.consoleMessages.slice(-500);
            }
        });

        // Handle dialogs
        page.on("dialog", async dialog => {
            console.log(`[Browser] Dialog: ${dialog.type()} - ${dialog.message()}`);
            if (this.dialogHandler) {
                // Wait for handler to be set, then auto-handle
            } else {
                // Auto-accept if no handler
                await dialog.accept();
            }
        });

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

        const info: TabInfo = {
            targetId,
            url: page.url(),
            title: await page.title(),
            page,
        };

        this.tabs.set(targetId, info);
        this.activeTabId = targetId;

        return info;
    }

    // Focus tab
    focusTab(targetId: string): boolean {
        if (this.tabs.has(targetId)) {
            this.activeTabId = targetId;
            return true;
        }
        return false;
    }

    // Close tab
    async closeTab(targetId?: string): Promise<boolean> {
        const id = targetId || this.activeTabId;
        if (!id) return false;

        const tab = this.tabs.get(id);
        if (!tab) return false;

        if (!tab.page.isClosed()) {
            await tab.page.close();
        }
        this.tabs.delete(id);

        if (this.activeTabId === id) {
            this.activeTabId = this.tabs.size > 0 ? Array.from(this.tabs.keys())[0] : null;
        }

        return true;
    }

    // Get active page
    async getActivePage(): Promise<Page | null> {
        if (!this.activeTabId) {
            // Auto-create a tab if none exists
            return null;
        }
        const tab = this.tabs.get(this.activeTabId);
        return tab?.page ?? null;
    }

    // Navigate current tab
    async navigate(url: string, waitUntil: "load" | "domcontentloaded" | "networkidle" = "domcontentloaded"): Promise<{ url: string; title: string }> {
        let page = await this.getActivePage();

        if (!page) {
            const tab = await this.openTab(url);
            return { url: tab.url, title: tab.title };
        }

        await page.goto(url, { waitUntil, timeout: 30000 });

        const tab = this.tabs.get(this.activeTabId!);
        if (tab) {
            tab.url = page.url();
            tab.title = await page.title();
        }

        return { url: page.url(), title: await page.title() };
    }

    // Take snapshot
    async snapshot(format: "text" | "interactive" | "aria" = "interactive", _selector?: string, maxChars: number = 50000): Promise<{ snapshot: string; targetId: string; url: string; title: string }> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab. Use 'open' to open a URL first.");

        // Clear ref map for new snapshot
        this.refMap.clear();

        let content: string;

        if (format === "aria" || format === "text") {
            // Simple text content
            content = await page.evaluate(`
                JSON.stringify({
                    title: document.title,
                    url: location.href,
                    text: document.body.innerText.slice(0, 50000)
                })
            `) as string;
        } else {
            // Interactive element snapshot with refs
            const elementsJson = await page.evaluate(`
                (function() {
                    const selectors = ['a[href]', 'button', 'input', 'select', 'textarea', '[role="button"]', '[role="link"]', '[onclick]', 'label'];
                    const results = [];
                    let ref = 1;
                    
                    for (const sel of selectors) {
                        document.querySelectorAll(sel).forEach(el => {
                            if (el.offsetParent === null && el.tagName !== 'BODY') return;
                            
                            let selector = el.id ? '#' + el.id : el.tagName.toLowerCase();
                            if (!el.id && el.classList.length) selector += '.' + Array.from(el.classList).slice(0,2).join('.');
                            
                            results.push({
                                ref: ref++,
                                tag: el.tagName.toLowerCase(),
                                type: el.type || undefined,
                                text: (el.innerText || el.textContent || '').trim().slice(0, 100),
                                href: el.href || undefined,
                                placeholder: el.placeholder || undefined,
                                name: el.name || undefined,
                                id: el.id || undefined,
                                role: el.getAttribute('role') || undefined,
                                selector: selector
                            });
                        });
                    }
                    return JSON.stringify(results.slice(0, 200));
                })()
            `) as string;

            const elements = JSON.parse(elementsJson) as Array<{
                ref: number;
                tag: string;
                type?: string;
                text: string;
                href?: string;
                placeholder?: string;
                name?: string;
                id?: string;
                role?: string;
                selector: string;
            }>;

            // Build ref map
            for (const el of elements) {
                this.refMap.set(String(el.ref), el.selector);
            }

            // Format output
            const lines: string[] = [];
            lines.push(`Page: ${await page.title()}`);
            lines.push(`URL: ${page.url()}`);
            lines.push(`\nInteractive Elements:`);

            for (const el of elements) {
                let line = `[ref=${el.ref}] <${el.tag}`;
                if (el.type) line += ` type="${el.type}"`;
                if (el.role) line += ` role="${el.role}"`;
                line += `>`;
                if (el.text) line += ` "${el.text}"`;
                if (el.href) line += ` → ${el.href}`;
                if (el.placeholder) line += ` (placeholder: ${el.placeholder})`;
                lines.push(line);
            }

            content = lines.join('\n');
        }

        // Truncate if needed
        if (content.length > maxChars) {
            content = content.slice(0, maxChars) + `\n... (truncated at ${maxChars} chars)`;
        }

        return {
            snapshot: content,
            targetId: this.activeTabId!,
            url: page.url(),
            title: await page.title(),
        };
    }

    // Take screenshot
    async screenshot(fullPage: boolean = false, selector?: string, type: "png" | "jpeg" = "png"): Promise<{ buffer: Buffer; path: string }> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab");

        let buffer: Buffer;

        if (selector) {
            const element = await page.$(selector);
            if (!element) throw new Error(`Element not found: ${selector}`);
            buffer = await element.screenshot({ type });
        } else {
            buffer = await page.screenshot({ fullPage, type });
        }

        // Save to temp file
        const dir = join(homedir(), ".openwhale", "screenshots");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const path = join(dir, `screenshot_${Date.now()}.${type}`);
        writeFileSync(path, buffer);

        return { buffer, path };
    }

    // Execute action
    async act(request: ActRequest): Promise<string> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab");

        // Resolve ref to selector
        const getSelector = (ref?: string, selector?: string): string => {
            if (ref) {
                const mapped = this.refMap.get(ref.replace(/^e/, ''));
                if (mapped) return mapped;
                // If ref looks like a number, try direct
                if (/^\d+$/.test(ref)) {
                    const numMapped = this.refMap.get(ref);
                    if (numMapped) return numMapped;
                }
                throw new Error(`Unknown ref: ${ref}. Take a new snapshot first.`);
            }
            if (selector) return selector;
            throw new Error("Either ref or selector required");
        };

        switch (request.kind) {
            case "click": {
                const sel = getSelector(request.ref, request.selector);
                const opts: any = {};
                if (request.button) opts.button = request.button;
                if (request.modifiers) opts.modifiers = request.modifiers;
                if (request.doubleClick) {
                    await page.dblclick(sel, opts);
                    return `Double-clicked: ${sel}`;
                }
                await page.click(sel, opts);
                return `Clicked: ${sel}`;
            }

            case "type": {
                const sel = getSelector(request.ref, request.selector);
                if (!request.text) throw new Error("text required for type");

                if (request.slowly) {
                    await page.type(sel, request.text, { delay: 50 });
                } else {
                    await page.fill(sel, request.text);
                }

                if (request.submit) {
                    await page.press(sel, "Enter");
                }

                return `Typed "${request.text}" into ${sel}${request.submit ? ' and submitted' : ''}`;
            }

            case "press": {
                if (!request.key) throw new Error("key required for press");
                await page.keyboard.press(request.key);
                return `Pressed: ${request.key}`;
            }

            case "hover": {
                const sel = getSelector(request.ref, request.selector);
                await page.hover(sel);
                return `Hovered: ${sel}`;
            }

            case "drag": {
                if (!request.startRef || !request.endRef) {
                    throw new Error("startRef and endRef required for drag");
                }
                const startSel = getSelector(request.startRef);
                const endSel = getSelector(request.endRef);
                await page.dragAndDrop(startSel, endSel);
                return `Dragged from ${startSel} to ${endSel}`;
            }

            case "select": {
                const sel = getSelector(request.ref, request.selector);
                if (!request.values?.length) throw new Error("values required for select");
                await page.selectOption(sel, request.values);
                return `Selected: ${request.values.join(", ")}`;
            }

            case "fill": {
                if (!request.fields?.length) throw new Error("fields required for fill");
                for (const field of request.fields) {
                    const sel = getSelector(field.ref, field.selector);
                    await page.fill(sel, field.value);
                }
                return `Filled ${request.fields.length} fields`;
            }

            case "resize": {
                const width = request.width || 1280;
                const height = request.height || 720;
                await page.setViewportSize({ width, height });
                return `Resized viewport to ${width}x${height}`;
            }

            case "wait": {
                if (request.timeMs) {
                    await page.waitForTimeout(request.timeMs);
                    return `Waited ${request.timeMs}ms`;
                }
                if (request.selector) {
                    await page.waitForSelector(request.selector);
                    return `Waited for selector: ${request.selector}`;
                }
                if (request.textVisible) {
                    await page.waitForSelector(`text=${request.textVisible}`);
                    return `Waited for text: ${request.textVisible}`;
                }
                if (request.textGone) {
                    await page.waitForSelector(`text=${request.textGone}`, { state: "hidden" });
                    return `Waited for text to disappear: ${request.textGone}`;
                }
                if (request.url) {
                    await page.waitForURL(request.url);
                    return `Waited for URL: ${request.url}`;
                }
                return "Nothing to wait for";
            }

            case "evaluate": {
                if (!request.fn) throw new Error("fn required for evaluate");
                const result = await page.evaluate(request.fn);
                return JSON.stringify(result, null, 2);
            }

            case "close": {
                await this.closeTab();
                return "Tab closed";
            }

            default:
                throw new Error(`Unknown act kind: ${(request as any).kind}`);
        }
    }

    // Get console messages
    getConsole(level?: string, clear: boolean = false): ConsoleMessage[] {
        let messages = this.consoleMessages;
        if (level && level !== "all") {
            messages = messages.filter(m => m.level === level);
        }
        if (clear) {
            this.consoleMessages = [];
        }
        return messages;
    }

    // Export PDF
    async pdf(): Promise<{ buffer: Buffer; path: string }> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab");

        const buffer = await page.pdf({ format: "A4" });

        const dir = join(homedir(), ".openwhale", "pdfs");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const path = join(dir, `page_${Date.now()}.pdf`);
        writeFileSync(path, buffer);

        return { buffer, path };
    }

    // Upload files
    async upload(paths: string[], selector?: string): Promise<string> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab");

        // Find file input
        const inputSelector = selector || 'input[type="file"]';
        const input = await page.$(inputSelector);
        if (!input) throw new Error(`File input not found: ${inputSelector}`);

        await input.setInputFiles(paths);
        return `Uploaded ${paths.length} file(s)`;
    }

    // Setup dialog handler
    armDialog(_accept: boolean, _promptText?: string): void {
        this.dialogHandler = async (_dialogAccept, _text) => {
            // This will be called by the dialog event
        };
    }

    // Get/set cookies
    async cookies(operation: "get" | "set" | "clear", cookies?: any[]): Promise<any[]> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab");

        const context = page.context();

        switch (operation) {
            case "get":
                return await context.cookies();
            case "set":
                if (cookies) {
                    await context.addCookies(cookies);
                }
                return await context.cookies();
            case "clear":
                await context.clearCookies();
                return [];
        }
    }

    // Get/set storage
    async storage(kind: "local" | "session", operation: "get" | "set" | "clear", key?: string, value?: string): Promise<any> {
        const page = await this.getActivePage();
        if (!page) throw new Error("No active tab");

        const storageType = kind === "local" ? "localStorage" : "sessionStorage";

        switch (operation) {
            case "get":
                if (key) {
                    return await page.evaluate(`window["${storageType}"].getItem("${key}")`) as string | null;
                }
                return await page.evaluate(`
                    (function() {
                        const storage = window["${storageType}"];
                        const items = {};
                        for (let i = 0; i < storage.length; i++) {
                            const k = storage.key(i);
                            items[k] = storage.getItem(k);
                        }
                        return JSON.stringify(items);
                    })()
                `) as string;
            case "set":
                if (key && value !== undefined) {
                    await page.evaluate(`window["${storageType}"].setItem("${key}", "${value}")`);
                }
                return { set: key };
            case "clear":
                await page.evaluate(`window["${storageType}"].clear()`);
                return { cleared: true };
        }
    }
}

const browserManager = new BrowserManager();

// ============================================================================
// BROWSER TOOL
// ============================================================================

export const browserTool: AgentTool<BrowserAction> = {
    name: "browser",
    description: `Control a web browser for automation. Actions:
- status/start/stop: Browser lifecycle
- tabs/open/focus/close: Tab management  
- navigate: Go to URL with wait options
- snapshot: Get page content with element refs (use refs for click/type)
- screenshot/pdf: Capture page
- act: Interact (click, type, press, hover, drag, select, fill, wait, evaluate)
- console: Get console logs
- upload: Handle file inputs
- cookies/storage: State management

For interactions, first take a snapshot to get refs, then use act with ref parameter.`,
    category: "browser",
    parameters: BrowserActionSchema,

    async execute(params: BrowserAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            switch (params.action) {
                // ========== LIFECYCLE ==========
                case "status": {
                    const status = browserManager.getStatus();
                    return {
                        success: true,
                        content: JSON.stringify(status, null, 2),
                        metadata: status,
                    };
                }

                case "start": {
                    await browserManager.start(params.headless);
                    return {
                        success: true,
                        content: `Browser started (${params.headless ? 'headless' : 'visible'})`,
                    };
                }

                case "stop": {
                    await browserManager.stop();
                    return {
                        success: true,
                        content: "Browser stopped",
                    };
                }

                // ========== TABS ==========
                case "tabs": {
                    const tabs = browserManager.getTabs();
                    return {
                        success: true,
                        content: tabs.length === 0
                            ? "No tabs open"
                            : tabs.map(t => `${t.active ? '→ ' : '  '}[${t.targetId}] ${t.title} (${t.url})`).join('\n'),
                        metadata: { tabs },
                    };
                }

                case "open": {
                    const tab = await browserManager.openTab(params.url, params.headless);
                    return {
                        success: true,
                        content: `Opened: ${tab.title}\nURL: ${tab.url}\nTab ID: ${tab.targetId}`,
                        metadata: tab as unknown as Record<string, unknown>,
                    };
                }

                case "focus": {
                    if (browserManager.focusTab(params.targetId)) {
                        return {
                            success: true,
                            content: `Focused tab: ${params.targetId}`,
                        };
                    }
                    return {
                        success: false,
                        content: "",
                        error: `Tab not found: ${params.targetId}`,
                    };
                }

                case "close": {
                    const closed = await browserManager.closeTab(params.targetId);
                    return {
                        success: closed,
                        content: closed ? "Tab closed" : "No tab to close",
                    };
                }

                // ========== NAVIGATION ==========
                case "navigate": {
                    const result = await browserManager.navigate(params.url, params.waitUntil);
                    return {
                        success: true,
                        content: `Navigated to: ${result.url}\nTitle: ${result.title}`,
                        metadata: result,
                    };
                }

                // ========== SNAPSHOT ==========
                case "snapshot": {
                    const result = await browserManager.snapshot(params.format, params.selector, params.maxChars);
                    return {
                        success: true,
                        content: result.snapshot,
                        metadata: { targetId: result.targetId, url: result.url, title: result.title },
                    };
                }

                // ========== SCREENSHOT ==========
                case "screenshot": {
                    const result = await browserManager.screenshot(params.fullPage, params.selector, params.type);
                    const base64 = result.buffer.toString("base64");
                    return {
                        success: true,
                        content: `Screenshot saved: ${result.path}`,
                        metadata: {
                            image: `data:image/${params.type};base64,${base64}`,
                            path: result.path,
                        },
                    };
                }

                // ========== ACT ==========
                case "act": {
                    const result = await browserManager.act(params.request);
                    return {
                        success: true,
                        content: result,
                    };
                }

                // ========== CONSOLE ==========
                case "console": {
                    const messages = browserManager.getConsole(params.level, params.clear);
                    const formatted = messages.map(m =>
                        `[${m.level}] ${m.text}`
                    ).join('\n');
                    return {
                        success: true,
                        content: formatted || "(no console messages)",
                        metadata: { count: messages.length },
                    };
                }

                // ========== PDF ==========
                case "pdf": {
                    const result = await browserManager.pdf();
                    return {
                        success: true,
                        content: `PDF saved: ${result.path}`,
                        metadata: { path: result.path },
                    };
                }

                // ========== UPLOAD ==========
                case "upload": {
                    const result = await browserManager.upload(params.paths, params.selector);
                    return {
                        success: true,
                        content: result,
                    };
                }

                // ========== DIALOG ==========
                case "dialog": {
                    browserManager.armDialog(params.accept, params.promptText);
                    return {
                        success: true,
                        content: `Dialog handler armed: ${params.accept ? 'accept' : 'dismiss'}`,
                    };
                }

                // ========== COOKIES ==========
                case "cookies": {
                    const result = await browserManager.cookies(params.operation, params.cookies);
                    return {
                        success: true,
                        content: JSON.stringify(result, null, 2),
                        metadata: { cookies: result },
                    };
                }

                // ========== STORAGE ==========
                case "storage": {
                    const result = await browserManager.storage(params.kind, params.operation, params.key, params.value);
                    return {
                        success: true,
                        content: JSON.stringify(result, null, 2),
                        metadata: result,
                    };
                }

                // ========== LEGACY ACTIONS ==========
                case "click": {
                    const result = await browserManager.act({
                        kind: "click",
                        selector: params.selector,
                        doubleClick: params.doubleClick,
                    });
                    return { success: true, content: result };
                }

                case "type": {
                    const result = await browserManager.act({
                        kind: "type",
                        selector: params.selector,
                        text: params.text,
                        submit: params.submit,
                    });
                    return { success: true, content: result };
                }

                case "scroll": {
                    const page = await browserManager.getActivePage();
                    if (!page) return { success: false, content: "", error: "No active tab" };
                    const delta = params.direction === "down" ? params.amount : -params.amount;
                    await page.evaluate(`window.scrollBy(0, ${delta})`);
                    return { success: true, content: `Scrolled ${params.direction} by ${params.amount}px` };
                }

                case "get_text": {
                    const page = await browserManager.getActivePage();
                    if (!page) return { success: false, content: "", error: "No active tab" };
                    let text: string;
                    if (params.selector) {
                        text = await page.$eval(params.selector, el => el.textContent ?? "");
                    } else {
                        text = await page.evaluate("document.body.innerText");
                    }
                    if (text.length > 10000) text = text.slice(0, 10000) + "\n... (truncated)";
                    return { success: true, content: text };
                }

                case "evaluate": {
                    const page = await browserManager.getActivePage();
                    if (!page) return { success: false, content: "", error: "No active tab" };
                    const result = await page.evaluate(params.script);
                    return { success: true, content: JSON.stringify(result, null, 2) };
                }

                case "press": {
                    const result = await browserManager.act({ kind: "press", key: params.key });
                    return { success: true, content: result };
                }

                case "hover": {
                    const result = await browserManager.act({ kind: "hover", selector: params.selector });
                    return { success: true, content: result };
                }

                case "wait": {
                    const result = await browserManager.act({
                        kind: "wait",
                        timeMs: params.timeMs,
                        selector: params.selector,
                        textVisible: params.text,
                    });
                    return { success: true, content: result };
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                content: "",
                error: `Browser error: ${message}`,
            };
        }
    },
};

// Cleanup on exit
process.on("beforeExit", () => browserManager.stop());
