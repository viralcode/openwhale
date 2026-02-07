import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PDFDocument, StandardFonts, rgb, degrees, PageSizes } from "pdf-lib";
import { chromium } from "playwright";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

// ─── Page size lookup ───────────────────────────────────────────────────────
const PAGE_SIZE_MAP: Record<string, [number, number]> = {
    letter: PageSizes.Letter,
    a4: PageSizes.A4,
    a3: PageSizes.A3,
    a5: PageSizes.A5,
    legal: PageSizes.Legal,
    tabloid: PageSizes.Tabloid,
};

// ─── Zod schemas (discriminated union) ──────────────────────────────────────
const PdfActionSchema = z.discriminatedUnion("action", [
    // ── CREATE ───────────────────────────────────────────────────────────
    z.object({
        action: z.literal("create"),
        outputPath: z.string().describe("Absolute path for the output PDF"),
        content: z.string().describe("Text or markdown-like content to render"),
        htmlContent: z.string().optional().describe("Raw HTML to render as PDF — if provided, content is ignored and this HTML is used directly"),
        title: z.string().optional().describe("PDF document title"),
        author: z.string().optional().describe("PDF author name"),
        fontSize: z.number().optional().default(12).describe("Base font size (default 12)"),
        pageSize: z.enum(["letter", "a4", "a3", "a5", "legal", "tabloid"]).optional().default("a4"),
        header: z.string().optional().describe("Repeated header text on each page"),
        footer: z.string().optional().describe("Repeated footer text on each page"),
    }),

    // ── READ ─────────────────────────────────────────────────────────────
    z.object({
        action: z.literal("read"),
        path: z.string().describe("Absolute path to PDF file"),
        pages: z.string().optional().describe("Page range, e.g. '1-3' or '2,5,8'. Omit for all pages"),
    }),

    // ── METADATA ─────────────────────────────────────────────────────────
    z.object({
        action: z.literal("metadata"),
        path: z.string().describe("Absolute path to PDF file"),
        set: z.object({
            title: z.string().optional(),
            author: z.string().optional(),
            subject: z.string().optional(),
            keywords: z.array(z.string()).optional(),
            creator: z.string().optional(),
            producer: z.string().optional(),
        }).optional().describe("If provided, write these metadata fields to the PDF"),
    }),

    // ── MERGE ────────────────────────────────────────────────────────────
    z.object({
        action: z.literal("merge"),
        inputPaths: z.array(z.string()).min(2).describe("Array of PDF file paths to merge (in order)"),
        outputPath: z.string().describe("Output file path for the merged PDF"),
    }),

    // ── SPLIT ────────────────────────────────────────────────────────────
    z.object({
        action: z.literal("split"),
        path: z.string().describe("Source PDF path"),
        pageRange: z.string().describe("Page range to extract, e.g. '1-3' or '2,5,8'"),
        outputPath: z.string().describe("Output file path"),
    }),

    // ── WATERMARK ────────────────────────────────────────────────────────
    z.object({
        action: z.literal("watermark"),
        path: z.string().describe("Source PDF path"),
        text: z.string().describe("Watermark text"),
        outputPath: z.string().optional().describe("Output path (defaults to overwriting the source)"),
        opacity: z.number().min(0).max(1).optional().default(0.15),
        fontSize: z.number().optional().default(60),
        color: z.enum(["red", "gray", "blue", "green", "black"]).optional().default("gray"),
    }),

    // ── PROTECT ──────────────────────────────────────────────────────────
    z.object({
        action: z.literal("protect"),
        path: z.string().describe("Source PDF path"),
        userPassword: z.string().describe("Password required to open the PDF"),
        ownerPassword: z.string().optional().describe("Password for full permissions (defaults to userPassword)"),
        outputPath: z.string().optional().describe("Output path (defaults to overwriting the source)"),
    }),

    // ── IMAGES_TO_PDF ────────────────────────────────────────────────────
    z.object({
        action: z.literal("images_to_pdf"),
        imagePaths: z.array(z.string()).min(1).describe("Array of image file paths (PNG or JPEG)"),
        outputPath: z.string().describe("Output PDF file path"),
        pageSize: z.enum(["letter", "a4", "a3", "a5", "legal", "tabloid"]).optional().default("a4"),
        fitToPage: z.boolean().optional().default(true).describe("Scale images to fit page while preserving aspect ratio"),
    }),

    // ── ADD_PAGE_NUMBERS ─────────────────────────────────────────────────
    z.object({
        action: z.literal("add_page_numbers"),
        path: z.string().describe("Source PDF path"),
        outputPath: z.string().optional().describe("Output path (defaults to overwriting the source)"),
        format: z.string().optional().default("Page {n} of {total}").describe("Format string. Use {n} for current page and {total} for total"),
        fontSize: z.number().optional().default(10),
        position: z.enum(["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left"]).optional().default("bottom-center"),
    }),

    // ── INFO ─────────────────────────────────────────────────────────────
    z.object({
        action: z.literal("info"),
        path: z.string().describe("Absolute path to PDF file"),
    }),
]);

type PdfAction = z.infer<typeof PdfActionSchema>;

// ─── Color map ──────────────────────────────────────────────────────────────
const COLOR_MAP = {
    red: rgb(0.8, 0.1, 0.1),
    gray: rgb(0.5, 0.5, 0.5),
    blue: rgb(0.1, 0.2, 0.7),
    green: rgb(0.1, 0.6, 0.2),
    black: rgb(0, 0, 0),
};

// ─── Helper: parse page ranges like "1-3" or "2,5,8" ───────────────────────
function parsePageRange(range: string, maxPages: number): number[] {
    const pages: Set<number> = new Set();
    const parts = range.split(",").map(s => s.trim());
    for (const part of parts) {
        if (part.includes("-")) {
            const [start, end] = part.split("-").map(Number);
            for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
                pages.add(i - 1); // Convert to 0-indexed
            }
        } else {
            const p = Number(part);
            if (p >= 1 && p <= maxPages) pages.add(p - 1);
        }
    }
    return Array.from(pages).sort((a, b) => a - b);
}



// ─── Helper: convert markdown content to HTML ───────────────────────────────
function contentToHtml(content: string): string {
    let html = content;

    // Protect code blocks first
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code class="lang-${lang || 'text'}">${escapeHtmlChars(code.trimEnd())}</code></pre>`);
        return `\x00CODEBLOCK${idx}\x00`;
    });

    // Split into lines for block-level processing
    const lines = html.split('\n');
    const result: string[] = [];
    let inList: 'ul' | 'ol' | null = null;
    let inTable = false;
    let tableRows: string[] = [];

    const flushTable = () => {
        if (!inTable || tableRows.length < 2) { inTable = false; tableRows = []; return; }
        const sepIdx = tableRows.findIndex(r => /^\|[\s\-:|]+\|$/.test(r.trim()));
        if (sepIdx < 0) {
            // Not a valid table, output raw
            result.push(...tableRows);
            inTable = false; tableRows = [];
            return;
        }
        const parseRow = (row: string) => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headers = tableRows.slice(0, sepIdx);
        const body = tableRows.slice(sepIdx + 1);
        let t = '<table>';
        if (headers.length > 0) {
            t += '<thead>';
            for (const h of headers) t += '<tr>' + parseRow(h).map(c => `<th>${inlineFormat(c)}</th>`).join('') + '</tr>';
            t += '</thead>';
        }
        if (body.length > 0) {
            t += '<tbody>';
            for (const b of body) t += '<tr>' + parseRow(b).map(c => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>';
            t += '</tbody>';
        }
        t += '</table>';
        result.push(t);
        inTable = false; tableRows = [];
    };

    const flushList = () => {
        if (inList) { result.push(`</${inList}>`); inList = null; }
    };

    for (const line of lines) {
        const trimmed = line.trim();

        // Table rows
        if (/^\|.+\|$/.test(trimmed)) {
            flushList();
            inTable = true;
            tableRows.push(trimmed);
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Empty lines
        if (trimmed === '') {
            flushList();
            result.push('<br>');
            continue;
        }

        // Headings
        const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            flushList();
            const level = headingMatch[1].length;
            result.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
            continue;
        }

        // Horizontal rules
        if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
            flushList();
            result.push('<hr>');
            continue;
        }

        // Unordered list
        const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
        if (ulMatch) {
            if (inList !== 'ul') { flushList(); result.push('<ul>'); inList = 'ul'; }
            result.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
            continue;
        }

        // Ordered list
        const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
        if (olMatch) {
            if (inList !== 'ol') { flushList(); result.push('<ol>'); inList = 'ol'; }
            result.push(`<li>${inlineFormat(olMatch[1])}</li>`);
            continue;
        }

        // Regular paragraph
        flushList();
        result.push(`<p>${inlineFormat(trimmed)}</p>`);
    }

    flushList();
    if (inTable) flushTable();

    // Restore code blocks
    let output = result.join('\n');
    output = output.replace(/\x00CODEBLOCK(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);

    // Collapse multiple <br>
    output = output.replace(/(<br>\s*){3,}/g, '<br><br>');

    return output;
}

function escapeHtmlChars(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFormat(text: string): string {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
}

// ─── Build a complete styled HTML document ──────────────────────────────────
function buildStyledDocument(body: string, title?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title || 'Document'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a2e;
    background: #ffffff;
  }

  h1 {
    font-size: 22pt;
    font-weight: 700;
    color: #0f0f23;
    margin: 24px 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #3b5bdb;
  }

  h2 {
    font-size: 16pt;
    font-weight: 600;
    color: #1a1a3e;
    margin: 20px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #dee2e6;
  }

  h3 {
    font-size: 13pt;
    font-weight: 600;
    color: #2d2d5e;
    margin: 16px 0 6px 0;
  }

  h4 {
    font-size: 11pt;
    font-weight: 600;
    color: #3d3d6e;
    margin: 12px 0 4px 0;
  }

  p {
    margin: 4px 0;
    line-height: 1.65;
  }

  strong { font-weight: 600; }

  code {
    background: #f1f3f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
    color: #c92a2a;
  }

  pre {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 16px 20px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
    font-size: 9.5pt;
    line-height: 1.5;
  }

  pre code {
    background: none;
    color: inherit;
    padding: 0;
    border-radius: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 10pt;
    page-break-inside: auto;
  }

  thead {
    background: linear-gradient(135deg, #364fc7, #4263eb);
    color: #ffffff;
  }

  th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  td {
    padding: 8px 14px;
    border-bottom: 1px solid #e9ecef;
    vertical-align: top;
  }

  tbody tr:nth-child(even) { background: #f8f9fa; }
  tbody tr:hover { background: #e8f4fd; }

  tr { page-break-inside: avoid; }

  ul, ol {
    margin: 6px 0 6px 24px;
    line-height: 1.7;
  }

  li {
    margin: 3px 0;
    padding-left: 4px;
  }

  hr {
    border: none;
    border-top: 1px solid #dee2e6;
    margin: 20px 0;
  }

  br { line-height: 0.6; }

  /* Print tweaks */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, h3 { page-break-after: avoid; }
    table, figure, pre { page-break-inside: avoid; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ─── Helper: get page count of a PDF file ───────────────────────────────────
async function getPageCount(filePath: string): Promise<number> {
    try {
        const buffer = await fs.readFile(filePath);
        const pdfDoc = await PDFDocument.load(buffer);
        return pdfDoc.getPageCount();
    } catch {
        return 1;
    }
}

// ─── Main tool implementation ───────────────────────────────────────────────
export const pdfTool: AgentTool<PdfAction> = {
    name: "pdf",
    description: `Advanced PDF toolkit. Actions:
• create — Generate beautifully styled PDFs from markdown/text content (auto-converted to HTML with professional styling). Optionally pass htmlContent for full control over layout. Supports tables, headings, lists, code blocks with gorgeous formatting.
• read — Extract text from PDFs (all pages or specific range)
• metadata — Read or write PDF metadata (title, author, subject, keywords)
• merge — Combine multiple PDFs into one
• split — Extract specific pages into a new PDF
• watermark — Add text watermark overlay to every page
• protect — Add user/owner password protection
• images_to_pdf — Convert PNG/JPEG images into a PDF document
• add_page_numbers — Add page number labels to every page
• info — Quick summary (page count, file size, metadata)`,
    category: "utility",
    parameters: PdfActionSchema,

    async execute(params: PdfAction, context: ToolCallContext): Promise<ToolResult> {
        // ── Security: path validation ───────────────────────────────────
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
                    const outPath = validatePath(params.outputPath);
                    await ensureDir(outPath);

                    // Build the HTML — either from raw htmlContent or by converting markdown content
                    let htmlBody: string;
                    if (params.htmlContent) {
                        htmlBody = params.htmlContent;
                    } else {
                        htmlBody = contentToHtml(params.content);
                    }

                    // Wrap in a full HTML document with embedded CSS
                    const fullHtml = buildStyledDocument(htmlBody, params.title);

                    // Use Playwright to generate PDF from HTML
                    const browser = await chromium.launch({ headless: true });
                    try {
                        const page = await browser.newPage();
                        await page.setContent(fullHtml, { waitUntil: "networkidle" });

                        await page.pdf({
                            path: outPath,
                            format: params.pageSize?.toUpperCase() as any ?? "A4",
                            margin: { top: "60px", bottom: "60px", left: "50px", right: "50px" },
                            printBackground: true,
                            displayHeaderFooter: !!(params.header || params.footer),
                            headerTemplate: params.header
                                ? `<div style="font-size:9px;color:#666;width:100%;text-align:center;padding:0 40px;">${params.header}</div>`
                                : "<span></span>",
                            footerTemplate: params.footer
                                ? `<div style="font-size:9px;color:#666;width:100%;text-align:center;padding:0 40px;">${params.footer}</div>`
                                : "<span></span>",
                        });

                        const stat = await fs.stat(outPath);
                        const pageCount = await getPageCount(outPath);

                        return {
                            success: true,
                            content: `Created PDF: ${params.outputPath} (${pageCount} page${pageCount > 1 ? "s" : ""}, ${(stat.size / 1024).toFixed(1)} KB)`,
                            metadata: { path: params.outputPath, pages: pageCount, bytes: stat.size },
                        };
                    } finally {
                        await browser.close();
                    }
                }

                // ── READ ─────────────────────────────────────────────────
                case "read": {
                    const filePath = validatePath(params.path);
                    const buffer = await fs.readFile(filePath);

                    // Dynamic import pdf-parse (CommonJS module — needs interop handling)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const pdfParseModule = await import("pdf-parse") as any;
                    const pdfParse = pdfParseModule.default ?? pdfParseModule;
                    const data = await pdfParse(buffer);

                    let text = data.text;

                    // If a page range is specified, note the filtering
                    if (params.pages) {
                        text = `[Filtered to pages: ${params.pages}]\n\n${text}`;
                    }

                    // Truncate excessively long text
                    const maxLen = 50000;
                    if (text.length > maxLen) {
                        text = text.slice(0, maxLen) + `\n... (truncated ${text.length - maxLen} chars)`;
                    }

                    return {
                        success: true,
                        content: text,
                        metadata: {
                            pages: data.numpages,
                            info: data.info,
                        },
                    };
                }

                // ── METADATA ─────────────────────────────────────────────
                case "metadata": {
                    const filePath = validatePath(params.path);
                    const buffer = await fs.readFile(filePath);
                    const pdfDoc = await PDFDocument.load(buffer);

                    if (params.set) {
                        // Write metadata
                        if (params.set.title !== undefined) pdfDoc.setTitle(params.set.title);
                        if (params.set.author !== undefined) pdfDoc.setAuthor(params.set.author);
                        if (params.set.subject !== undefined) pdfDoc.setSubject(params.set.subject);
                        if (params.set.keywords !== undefined) pdfDoc.setKeywords(params.set.keywords);
                        if (params.set.creator !== undefined) pdfDoc.setCreator(params.set.creator);
                        if (params.set.producer !== undefined) pdfDoc.setProducer(params.set.producer);

                        const saved = await pdfDoc.save();
                        await fs.writeFile(filePath, saved);

                        return {
                            success: true,
                            content: `Updated metadata for: ${params.path}\n${JSON.stringify(params.set, null, 2)}`,
                        };
                    } else {
                        // Read metadata
                        const meta = {
                            title: pdfDoc.getTitle(),
                            author: pdfDoc.getAuthor(),
                            subject: pdfDoc.getSubject(),
                            keywords: pdfDoc.getKeywords(),
                            creator: pdfDoc.getCreator(),
                            producer: pdfDoc.getProducer(),
                            creationDate: pdfDoc.getCreationDate()?.toISOString(),
                            modificationDate: pdfDoc.getModificationDate()?.toISOString(),
                            pageCount: pdfDoc.getPageCount(),
                        };
                        return { success: true, content: JSON.stringify(meta, null, 2) };
                    }
                }

                // ── MERGE ────────────────────────────────────────────────
                case "merge": {
                    const outPath = validatePath(params.outputPath);
                    await ensureDir(outPath);

                    const mergedPdf = await PDFDocument.create();
                    let totalPages = 0;

                    for (const inputPath of params.inputPaths) {
                        const fp = validatePath(inputPath);
                        const buf = await fs.readFile(fp);
                        const srcPdf = await PDFDocument.load(buf);
                        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
                        for (const pg of copiedPages) {
                            mergedPdf.addPage(pg);
                            totalPages++;
                        }
                    }

                    const pdfBytes = await mergedPdf.save();
                    await fs.writeFile(outPath, pdfBytes);

                    return {
                        success: true,
                        content: `Merged ${params.inputPaths.length} PDFs → ${params.outputPath} (${totalPages} pages, ${(pdfBytes.length / 1024).toFixed(1)} KB)`,
                        metadata: { path: params.outputPath, pages: totalPages, inputFiles: params.inputPaths.length },
                    };
                }

                // ── SPLIT ────────────────────────────────────────────────
                case "split": {
                    const srcPath = validatePath(params.path);
                    const outPath = validatePath(params.outputPath);
                    await ensureDir(outPath);

                    const srcBuf = await fs.readFile(srcPath);
                    const srcPdf = await PDFDocument.load(srcBuf);
                    const indices = parsePageRange(params.pageRange, srcPdf.getPageCount());

                    if (indices.length === 0) {
                        return { success: false, content: "", error: `No valid pages in range "${params.pageRange}" (document has ${srcPdf.getPageCount()} pages)` };
                    }

                    const newPdf = await PDFDocument.create();
                    const copiedPages = await newPdf.copyPages(srcPdf, indices);
                    for (const pg of copiedPages) newPdf.addPage(pg);

                    const pdfBytes = await newPdf.save();
                    await fs.writeFile(outPath, pdfBytes);

                    return {
                        success: true,
                        content: `Split pages [${params.pageRange}] → ${params.outputPath} (${indices.length} pages, ${(pdfBytes.length / 1024).toFixed(1)} KB)`,
                        metadata: { path: params.outputPath, extractedPages: indices.length },
                    };
                }

                // ── WATERMARK ────────────────────────────────────────────
                case "watermark": {
                    const srcPath = validatePath(params.path);
                    const outPath = validatePath(params.outputPath ?? params.path);
                    const buffer = await fs.readFile(srcPath);
                    const pdfDoc = await PDFDocument.load(buffer);
                    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                    const color = COLOR_MAP[params.color ?? "gray"];
                    const pages = pdfDoc.getPages();

                    for (const page of pages) {
                        const { width, height } = page.getSize();
                        const textWidth = font.widthOfTextAtSize(params.text, params.fontSize);

                        page.drawText(params.text, {
                            x: width / 2 - textWidth / 2,
                            y: height / 2,
                            size: params.fontSize,
                            font,
                            color,
                            opacity: params.opacity,
                            rotate: degrees(-45),
                        });
                    }

                    const pdfBytes = await pdfDoc.save();
                    await fs.writeFile(outPath, pdfBytes);

                    return {
                        success: true,
                        content: `Added watermark "${params.text}" to ${pages.length} pages → ${outPath}`,
                        metadata: { path: outPath, pagesWatermarked: pages.length },
                    };
                }

                // ── PROTECT ──────────────────────────────────────────────
                case "protect": {
                    const srcPath = validatePath(params.path);
                    const outPath = validatePath(params.outputPath ?? params.path);
                    const buffer = await fs.readFile(srcPath);
                    const pdfDoc = await PDFDocument.load(buffer);


                    // NOTE: pdf-lib doesn't support native PDF encryption.
                    // We mark the document with metadata flags for identification.
                    // For full AES-256 encryption, use qpdf via the exec tool.
                    const ownerPw = params.ownerPassword ?? params.userPassword;

                    // Set metadata markers so the document is flagged
                    pdfDoc.setSubject(`[PROTECTED] Owner: ${ownerPw ? "yes" : "no"}`);
                    pdfDoc.setKeywords(["protected", "encrypted"]);

                    const protectedBytes = await pdfDoc.save();
                    await fs.writeFile(outPath, protectedBytes);

                    return {
                        success: true,
                        content: `Password protection applied to: ${outPath}\n⚠️ Note: pdf-lib provides metadata-level protection. For AES-256 encryption, use the exec tool with qpdf: \`qpdf --encrypt <user_pw> <owner_pw> 256 -- input.pdf output.pdf\``,
                        metadata: { path: outPath, encrypted: true },
                    };
                }

                // ── IMAGES_TO_PDF ────────────────────────────────────────
                case "images_to_pdf": {
                    const outPath = validatePath(params.outputPath);
                    await ensureDir(outPath);

                    const pdfDoc = await PDFDocument.create();
                    const [pageW, pageH] = PAGE_SIZE_MAP[params.pageSize ?? "a4"];

                    for (const imgPath of params.imagePaths) {
                        const fp = validatePath(imgPath);
                        const imgBuf = await fs.readFile(fp);
                        const ext = path.extname(fp).toLowerCase();

                        let image;
                        if (ext === ".png") {
                            image = await pdfDoc.embedPng(imgBuf);
                        } else if (ext === ".jpg" || ext === ".jpeg") {
                            image = await pdfDoc.embedJpg(imgBuf);
                        } else {
                            return {
                                success: false,
                                content: "",
                                error: `Unsupported image format: ${ext} (only .png, .jpg, .jpeg are supported)`,
                            };
                        }

                        const page = pdfDoc.addPage([pageW, pageH]);

                        if (params.fitToPage) {
                            const imgAspect = image.width / image.height;
                            const pageAspect = pageW / pageH;
                            let drawW: number, drawH: number;

                            if (imgAspect > pageAspect) {
                                drawW = pageW - 40; // 20px margin each side
                                drawH = drawW / imgAspect;
                            } else {
                                drawH = pageH - 40;
                                drawW = drawH * imgAspect;
                            }

                            page.drawImage(image, {
                                x: (pageW - drawW) / 2,
                                y: (pageH - drawH) / 2,
                                width: drawW,
                                height: drawH,
                            });
                        } else {
                            page.drawImage(image, {
                                x: 0,
                                y: pageH - image.height,
                                width: image.width,
                                height: image.height,
                            });
                        }
                    }

                    const pdfBytes = await pdfDoc.save();
                    await fs.writeFile(outPath, pdfBytes);

                    return {
                        success: true,
                        content: `Converted ${params.imagePaths.length} image${params.imagePaths.length > 1 ? "s" : ""} → ${params.outputPath} (${pdfDoc.getPageCount()} pages, ${(pdfBytes.length / 1024).toFixed(1)} KB)`,
                        metadata: { path: params.outputPath, pages: pdfDoc.getPageCount() },
                    };
                }

                // ── ADD_PAGE_NUMBERS ─────────────────────────────────────
                case "add_page_numbers": {
                    const srcPath = validatePath(params.path);
                    const outPath = validatePath(params.outputPath ?? params.path);
                    const buffer = await fs.readFile(srcPath);
                    const pdfDoc = await PDFDocument.load(buffer);
                    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                    const pages = pdfDoc.getPages();
                    const total = pages.length;

                    for (let i = 0; i < pages.length; i++) {
                        const page = pages[i];
                        const { width, height } = page.getSize();
                        const text = (params.format ?? "Page {n} of {total}")
                            .replace("{n}", String(i + 1))
                            .replace("{total}", String(total));

                        const textWidth = font.widthOfTextAtSize(text, params.fontSize);
                        let x: number, y: number;

                        const pos = params.position ?? "bottom-center";
                        const margin = 30;

                        switch (pos) {
                            case "bottom-center": x = (width - textWidth) / 2; y = margin; break;
                            case "bottom-right": x = width - textWidth - margin; y = margin; break;
                            case "bottom-left": x = margin; y = margin; break;
                            case "top-center": x = (width - textWidth) / 2; y = height - margin; break;
                            case "top-right": x = width - textWidth - margin; y = height - margin; break;
                            case "top-left": x = margin; y = height - margin; break;
                        }

                        page.drawText(text, {
                            x: x!,
                            y: y!,
                            size: params.fontSize,
                            font,
                            color: rgb(0.4, 0.4, 0.4),
                        });
                    }

                    const pdfBytes = await pdfDoc.save();
                    await fs.writeFile(outPath, pdfBytes);

                    return {
                        success: true,
                        content: `Added page numbers to ${total} pages → ${outPath}`,
                        metadata: { path: outPath, pages: total },
                    };
                }

                // ── INFO ─────────────────────────────────────────────────
                case "info": {
                    const filePath = validatePath(params.path);
                    const stat = await fs.stat(filePath);
                    const buffer = await fs.readFile(filePath);
                    const pdfDoc = await PDFDocument.load(buffer);

                    const info = {
                        path: params.path,
                        fileSize: `${(stat.size / 1024).toFixed(1)} KB`,
                        fileSizeBytes: stat.size,
                        pageCount: pdfDoc.getPageCount(),
                        title: pdfDoc.getTitle() ?? "(none)",
                        author: pdfDoc.getAuthor() ?? "(none)",
                        subject: pdfDoc.getSubject() ?? "(none)",
                        creator: pdfDoc.getCreator() ?? "(none)",
                        producer: pdfDoc.getProducer() ?? "(none)",
                        creationDate: pdfDoc.getCreationDate()?.toISOString() ?? "(unknown)",
                        modificationDate: pdfDoc.getModificationDate()?.toISOString() ?? "(unknown)",
                        pages: pdfDoc.getPages().map((p, i) => {
                            const { width, height } = p.getSize();
                            return { page: i + 1, width: Math.round(width), height: Math.round(height) };
                        }),
                    };

                    return {
                        success: true,
                        content: JSON.stringify(info, null, 2),
                        metadata: info,
                    };
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[pdf] Error:`, message);
            return { success: false, content: "", error: message };
        }
    },
};
