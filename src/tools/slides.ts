import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { chromium } from "playwright";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

// ─── Zod schemas ────────────────────────────────────────────────────────────
const SlideSchema = z.object({
    title: z.string().optional().describe("Slide title"),
    body: z.string().optional().describe("Markdown/text content for the slide body"),
    htmlContent: z.string().optional().describe("Raw HTML for full slide control — if provided, body is ignored"),
    notes: z.string().optional().describe("Speaker notes for this slide"),
});

const SlidesActionSchema = z.object({
    action: z.enum(["create", "info"]).describe("Action to perform"),
    // ── CREATE params ────────────────────────────────────────────────
    outputPath: z.string().optional().describe("Absolute path for the output PPTX file (required for create)"),
    slides: z.array(SlideSchema).optional().describe("Array of slides to include (required for create)"),
    title: z.string().optional().describe("Presentation title (metadata)"),
    author: z.string().optional().describe("Presentation author (metadata)"),
    theme: z.enum(["dark", "light", "corporate"]).optional().describe("Visual theme: dark (default), light, or corporate"),
    // ── INFO params ──────────────────────────────────────────────────
    path: z.string().optional().describe("Absolute path to PPTX file (required for info)"),
});

type SlidesAction = z.infer<typeof SlidesActionSchema>;
type SlideData = z.infer<typeof SlideSchema>;

// ─── Theme definitions ──────────────────────────────────────────────────────
interface Theme {
    bg: string;
    bgGradient: string;
    textColor: string;
    textMuted: string;
    headingColor: string;
    accentColor: string;
    accentGradient: string;
    tableHeaderBg: string;
    tableHeaderColor: string;
    tableRowEven: string;
    tableBorder: string;
    codeBg: string;
    codeColor: string;
}

const THEMES: Record<string, Theme> = {
    dark: {
        bg: "#0f0f1a",
        bgGradient: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
        textColor: "#e2e8f0",
        textMuted: "#94a3b8",
        headingColor: "#f1f5f9",
        accentColor: "#6366f1",
        accentGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        tableHeaderBg: "linear-gradient(135deg, #4338ca, #6366f1)",
        tableHeaderColor: "#ffffff",
        tableRowEven: "rgba(99, 102, 241, 0.08)",
        tableBorder: "rgba(148, 163, 184, 0.15)",
        codeBg: "#1e1e2e",
        codeColor: "#cdd6f4",
    },
    light: {
        bg: "#ffffff",
        bgGradient: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        textColor: "#1e293b",
        textMuted: "#64748b",
        headingColor: "#0f172a",
        accentColor: "#3b82f6",
        accentGradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
        tableHeaderBg: "linear-gradient(135deg, #2563eb, #3b82f6)",
        tableHeaderColor: "#ffffff",
        tableRowEven: "#f1f5f9",
        tableBorder: "#e2e8f0",
        codeBg: "#1e293b",
        codeColor: "#e2e8f0",
    },
    corporate: {
        bg: "#ffffff",
        bgGradient: "linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)",
        textColor: "#1a202c",
        textMuted: "#718096",
        headingColor: "#1a365d",
        accentColor: "#2b6cb0",
        accentGradient: "linear-gradient(135deg, #2b6cb0, #3182ce)",
        tableHeaderBg: "linear-gradient(135deg, #1a365d, #2b6cb0)",
        tableHeaderColor: "#ffffff",
        tableRowEven: "#f7fafc",
        tableBorder: "#e2e8f0",
        codeBg: "#2d3748",
        codeColor: "#e2e8f0",
    },
};

// ─── Markdown → HTML for slides ─────────────────────────────────────────────
function slideContentToHtml(content: string): string {
    let html = content;

    // Protect code blocks
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code class="lang-${lang || "text"}">${escapeHtml(code.trimEnd())}</code></pre>`);
        return `\x00CB${idx}\x00`;
    });

    const lines = html.split("\n");
    const result: string[] = [];
    let inList: "ul" | "ol" | null = null;
    let inTable = false;
    let tableRows: string[] = [];

    const flushTable = () => {
        if (!inTable || tableRows.length < 2) { inTable = false; tableRows = []; return; }
        const sepIdx = tableRows.findIndex(r => /^\|[\s\-:|]+\|$/.test(r.trim()));
        if (sepIdx < 0) { result.push(...tableRows); inTable = false; tableRows = []; return; }
        const parseRow = (row: string) => row.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        const headers = tableRows.slice(0, sepIdx);
        const body = tableRows.slice(sepIdx + 1);
        let t = "<table>";
        if (headers.length > 0) {
            t += "<thead>";
            for (const h of headers) t += "<tr>" + parseRow(h).map(c => `<th>${inlineFmt(c)}</th>`).join("") + "</tr>";
            t += "</thead>";
        }
        if (body.length > 0) {
            t += "<tbody>";
            for (const b of body) t += "<tr>" + parseRow(b).map(c => `<td>${inlineFmt(c)}</td>`).join("") + "</tr>";
            t += "</tbody>";
        }
        t += "</table>";
        result.push(t);
        inTable = false; tableRows = [];
    };

    const flushList = () => { if (inList) { result.push(`</${inList}>`); inList = null; } };

    for (const line of lines) {
        const trimmed = line.trim();

        if (/^\|.+\|$/.test(trimmed)) { flushList(); inTable = true; tableRows.push(trimmed); continue; }
        else if (inTable) flushTable();

        if (trimmed === "") { flushList(); continue; }

        const hm = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (hm) { flushList(); result.push(`<h${hm[1].length}>${inlineFmt(hm[2])}</h${hm[1].length}>`); continue; }

        if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) { flushList(); result.push("<hr>"); continue; }

        const ul = trimmed.match(/^[-*+]\s+(.+)$/);
        if (ul) { if (inList !== "ul") { flushList(); result.push("<ul>"); inList = "ul"; } result.push(`<li>${inlineFmt(ul[1])}</li>`); continue; }

        const ol = trimmed.match(/^\d+\.\s+(.+)$/);
        if (ol) { if (inList !== "ol") { flushList(); result.push("<ol>"); inList = "ol"; } result.push(`<li>${inlineFmt(ol[1])}</li>`); continue; }

        flushList();
        result.push(`<p>${inlineFmt(trimmed)}</p>`);
    }

    flushList();
    if (inTable) flushTable();

    let output = result.join("\n");
    output = output.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);
    return output;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFmt(text: string): string {
    return text
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/_([^_]+)_/g, "<em>$1</em>");
}

// ─── Build slide HTML ───────────────────────────────────────────────────────
function buildSlideHtml(slide: SlideData, theme: Theme, slideIndex: number, totalSlides: number): string {
    const body = slide.htmlContent || (slide.body ? slideContentToHtml(slide.body) : "");
    const hasTitle = slide.title && slide.title.trim();

    // First slide gets special title treatment
    const isTitleSlide = slideIndex === 0 && hasTitle;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 1920px;
    height: 1080px;
    overflow: hidden;
  }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: ${theme.bgGradient};
    color: ${theme.textColor};
    padding: ${isTitleSlide ? "0" : "80px 100px 60px 100px"};
    display: flex;
    flex-direction: column;
    ${isTitleSlide ? "justify-content: center; align-items: center;" : ""}
  }

  /* ── Title slide ── */
  .title-slide {
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    padding: 100px;
  }

  .title-slide h1 {
    font-size: 72px;
    font-weight: 800;
    background: ${theme.accentGradient};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 24px;
    line-height: 1.1;
  }

  .title-slide .subtitle {
    font-size: 28px;
    color: ${theme.textMuted};
    max-width: 900px;
    line-height: 1.6;
  }

  /* ── Content slides ── */
  .slide-title {
    font-size: 44px;
    font-weight: 700;
    color: ${theme.headingColor};
    margin-bottom: 40px;
    padding-bottom: 16px;
    border-bottom: 3px solid ${theme.accentColor};
    line-height: 1.2;
  }

  .slide-body {
    flex: 1;
    overflow: hidden;
    font-size: 24px;
    line-height: 1.7;
  }

  h2 { font-size: 36px; font-weight: 600; color: ${theme.headingColor}; margin: 28px 0 16px; }
  h3 { font-size: 30px; font-weight: 600; color: ${theme.headingColor}; margin: 20px 0 12px; }
  h4 { font-size: 26px; font-weight: 500; margin: 16px 0 8px; }
  p { margin: 8px 0; }
  strong { font-weight: 600; }
  em { font-style: italic; }

  code {
    background: ${theme.codeBg};
    color: ${theme.codeColor};
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.85em;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }

  pre {
    background: ${theme.codeBg};
    color: ${theme.codeColor};
    padding: 24px 28px;
    border-radius: 12px;
    font-size: 18px;
    line-height: 1.5;
    margin: 16px 0;
    overflow: hidden;
  }

  pre code { background: none; padding: 0; border-radius: 0; font-size: inherit; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 20px;
  }

  thead { background: ${theme.tableHeaderBg}; color: ${theme.tableHeaderColor}; }
  th {
    padding: 14px 20px;
    text-align: left;
    font-weight: 600;
    font-size: 18px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  td {
    padding: 12px 20px;
    border-bottom: 1px solid ${theme.tableBorder};
  }

  tbody tr:nth-child(even) { background: ${theme.tableRowEven}; }

  ul, ol { margin: 12px 0 12px 40px; }
  li { margin: 8px 0; padding-left: 8px; }

  hr { border: none; border-top: 1px solid ${theme.tableBorder}; margin: 24px 0; }

  /* ── Slide number ── */
  .slide-number {
    position: fixed;
    bottom: 24px;
    right: 40px;
    font-size: 16px;
    color: ${theme.textMuted};
    font-weight: 500;
  }

  /* ── Accent bar ── */
  .accent-bar {
    position: fixed;
    top: 0; left: 0;
    width: 100%;
    height: 6px;
    background: ${theme.accentGradient};
  }
</style>
</head>
<body>
${!isTitleSlide ? '<div class="accent-bar"></div>' : ""}
${isTitleSlide
            ? `<div class="title-slide">
             <h1>${slide.title}</h1>
             ${body ? `<div class="subtitle">${body}</div>` : ""}
           </div>`
            : `${hasTitle ? `<div class="slide-title">${slide.title}</div>` : ""}
           <div class="slide-body">${body}</div>`
        }
<div class="slide-number">${slideIndex + 1} / ${totalSlides}</div>
</body>
</html>`;
}

// ─── Main tool ──────────────────────────────────────────────────────────────
export const slidesTool: AgentTool<SlidesAction> = {
    name: "slides",
    description: `Create beautiful PowerPoint (PPTX) presentations with professional styling. Actions:
• create — Generate a styled PPTX from an array of slides. Each slide can have a title, markdown body (auto-styled), or raw htmlContent for full control. Supports themes: dark, light, corporate. Slides are rendered as pixel-perfect images via headless browser.
• info — Get basic info about an existing PPTX file (size, metadata)`,
    category: "utility",
    parameters: SlidesActionSchema,

    async execute(params: SlidesAction, context: ToolCallContext): Promise<ToolResult> {
        const validatePath = (p: string): string => {
            const resolved = path.resolve(p);
            if (!resolved.startsWith(context.workspaceDir) && !context.sandboxed) {
                throw new Error(`Access denied: path outside workspace: ${resolved}`);
            }
            return resolved;
        };

        const ensureDir = async (filePath: string) => {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
        };

        try {
            switch (params.action) {
                // ── CREATE ───────────────────────────────────────────────
                case "create": {
                    if (!params.outputPath) throw new Error("outputPath is required for create action");
                    if (!params.slides || params.slides.length === 0) throw new Error("slides array is required for create action");

                    const outPath = validatePath(params.outputPath);
                    await ensureDir(outPath);

                    const theme = THEMES[params.theme ?? "dark"];
                    const totalSlides = params.slides.length;

                    // Launch browser once for all slides
                    const browser = await chromium.launch({ headless: true });
                    const slideImages: Buffer[] = [];

                    try {
                        const page = await browser.newPage({
                            viewport: { width: 1920, height: 1080 },
                        });

                        for (let i = 0; i < totalSlides; i++) {
                            const slideHtml = buildSlideHtml(params.slides[i], theme, i, totalSlides);
                            await page.setContent(slideHtml, { waitUntil: "networkidle" });
                            const screenshot = await page.screenshot({
                                type: "png",
                                clip: { x: 0, y: 0, width: 1920, height: 1080 },
                            });
                            slideImages.push(screenshot);
                        }
                    } finally {
                        await browser.close();
                    }

                    // Create PPTX (dynamic import for CJS/ESM interop)
                    const pptxMod = await import("pptxgenjs");
                    const PptxCtor = (pptxMod.default ?? pptxMod) as any;
                    const pptx = new PptxCtor();
                    pptx.layout = "LAYOUT_WIDE"; // 13.33" × 7.5" (widescreen 16:9)

                    if (params.title) pptx.title = params.title;
                    if (params.author) pptx.author = params.author;
                    pptx.company = "OpenWhale";

                    for (const imgBuf of slideImages) {
                        const slide = pptx.addSlide();
                        const base64 = imgBuf.toString("base64");
                        slide.addImage({
                            data: `image/png;base64,${base64}`,
                            x: 0,
                            y: 0,
                            w: "100%",
                            h: "100%",
                        });
                    }

                    // Add speaker notes
                    const pptxSlides = pptx.slides;
                    for (let i = 0; i < params.slides.length; i++) {
                        if (params.slides[i].notes && pptxSlides[i]) {
                            pptxSlides[i].addNotes(params.slides[i].notes!);
                        }
                    }

                    // Save
                    const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
                    await fs.writeFile(outPath, buffer);

                    const stat = await fs.stat(outPath);

                    return {
                        success: true,
                        content: `Created presentation: ${params.outputPath} (${totalSlides} slide${totalSlides > 1 ? "s" : ""}, ${(stat.size / 1024).toFixed(1)} KB, theme: ${params.theme ?? "dark"})`,
                        metadata: {
                            path: params.outputPath,
                            slides: totalSlides,
                            bytes: stat.size,
                            theme: params.theme ?? "dark",
                        },
                    };
                }

                // ── INFO ─────────────────────────────────────────────────
                case "info": {
                    if (!params.path) throw new Error("path is required for info action");
                    const filePath = validatePath(params.path);
                    const stat = await fs.stat(filePath);

                    return {
                        success: true,
                        content: JSON.stringify({
                            path: params.path,
                            fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
                            fileSizeBytes: stat.size,
                            created: stat.birthtime.toISOString(),
                            modified: stat.mtime.toISOString(),
                        }, null, 2),
                    };
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[slides] Error:`, message);
            return { success: false, content: "", error: message };
        }
    },
};
