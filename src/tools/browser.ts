import { z } from "zod";
import { chromium, type Browser, type Page } from "playwright";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const BrowserActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("navigate"),
        url: z.string().url(),
        headless: z.boolean().optional().default(true).describe("Set to false to show visible browser window"),
    }),
    z.object({
        action: z.literal("screenshot"),
        fullPage: z.boolean().optional().default(false),
    }),
    z.object({
        action: z.literal("click"),
        selector: z.string(),
    }),
    z.object({
        action: z.literal("type"),
        selector: z.string(),
        text: z.string(),
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
        action: z.literal("close"),
    }),
]);

type BrowserAction = z.infer<typeof BrowserActionSchema>;

// Singleton browser manager
class BrowserManager {
    private browser: Browser | null = null;
    private pages: Map<string, Page> = new Map();
    private isHeadless: boolean = true;

    async getBrowser(headless: boolean = true): Promise<Browser> {
        // If headless mode changed, close existing browser
        if (this.browser && this.isHeadless !== headless) {
            await this.closeAll();
        }

        if (!this.browser || !this.browser.isConnected()) {
            this.isHeadless = headless;
            this.browser = await chromium.launch({
                headless: headless,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            console.log(`[Browser] Launched in ${headless ? 'headless' : 'visible'} mode`);
        }
        return this.browser;
    }

    async getPage(sessionId: string, headless: boolean = true): Promise<Page> {
        let page = this.pages.get(sessionId);
        if (!page || page.isClosed()) {
            const browser = await this.getBrowser(headless);
            const context = await browser.newContext({
                viewport: { width: 1280, height: 720 },
                userAgent: "OpenWhale/1.0 (AI Assistant)",
            });
            page = await context.newPage();
            this.pages.set(sessionId, page);
        }
        return page;
    }

    async closePage(sessionId: string): Promise<void> {
        const page = this.pages.get(sessionId);
        if (page && !page.isClosed()) {
            await page.close();
        }
        this.pages.delete(sessionId);
    }

    async closeAll(): Promise<void> {
        for (const page of this.pages.values()) {
            if (!page.isClosed()) await page.close();
        }
        this.pages.clear();
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

const browserManager = new BrowserManager();

export const browserTool: AgentTool<BrowserAction> = {
    name: "browser",
    description: "Control a web browser to navigate pages, click elements, type text, take screenshots, and extract content.",
    category: "browser",
    parameters: BrowserActionSchema,

    async execute(params: BrowserAction, context: ToolCallContext): Promise<ToolResult> {
        try {
            // Get headless setting from navigate action, default to true
            const headless = params.action === "navigate" ? params.headless ?? true : true;
            const page = await browserManager.getPage(context.sessionId, headless);

            switch (params.action) {
                case "navigate": {
                    await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 30000 });
                    const title = await page.title();
                    return {
                        success: true,
                        content: `Navigated to: ${params.url}\nTitle: ${title}${!headless ? '\n(Browser is visible)' : ''}`,
                        metadata: { url: page.url(), title, headless },
                    };
                }

                case "screenshot": {
                    const buffer = await page.screenshot({
                        fullPage: params.fullPage,
                        type: "png",
                    });
                    const base64 = buffer.toString("base64");
                    return {
                        success: true,
                        content: `Screenshot captured (${buffer.length} bytes)`,
                        metadata: {
                            image: `data:image/png;base64,${base64}`,
                            width: 1280,
                            height: params.fullPage ? undefined : 720,
                        },
                    };
                }

                case "click": {
                    await page.click(params.selector, { timeout: 5000 });
                    return {
                        success: true,
                        content: `Clicked element: ${params.selector}`,
                    };
                }

                case "type": {
                    await page.fill(params.selector, params.text);
                    return {
                        success: true,
                        content: `Typed "${params.text}" into: ${params.selector}`,
                    };
                }

                case "scroll": {
                    const delta = params.direction === "down" ? params.amount : -params.amount;
                    await page.evaluate(`window.scrollBy(0, ${delta})`);
                    return {
                        success: true,
                        content: `Scrolled ${params.direction} by ${params.amount}px`,
                    };
                }

                case "get_text": {
                    let text: string;
                    if (params.selector) {
                        text = await page.$eval(params.selector, (el) => el.textContent ?? "");
                    } else {
                        text = await page.evaluate("document.body.innerText");
                    }

                    // Truncate long text
                    const maxLen = 10000;
                    const truncated = text.length > maxLen
                        ? text.slice(0, maxLen) + `\n... (truncated)`
                        : text;

                    return {
                        success: true,
                        content: truncated,
                    };
                }

                case "evaluate": {
                    const result = await page.evaluate(params.script);
                    return {
                        success: true,
                        content: JSON.stringify(result, null, 2),
                    };
                }

                case "close": {
                    await browserManager.closePage(context.sessionId);
                    return {
                        success: true,
                        content: "Browser closed",
                    };
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

// Cleanup on process exit
process.on("beforeExit", () => browserManager.closeAll());
