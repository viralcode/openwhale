import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { canvasPush } from "../canvas/index.js";

// Canvas state per session
const canvasStates: Map<string, CanvasState> = new Map();

/**
 * Sync the in-memory canvas state to the web canvas
 */
function syncToWebCanvas(state: CanvasState): void {
    const svgElements = state.elements.map(el => {
        switch (el.type) {
            case "rect":
                return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill ?? "none"}" stroke="${el.stroke ?? "none"}"/>`;
            case "circle":
                return `<circle cx="${el.x}" cy="${el.y}" r="${el.radius}" fill="${el.fill ?? "none"}" stroke="${el.stroke ?? "none"}"/>`;
            case "text":
                return `<text x="${el.x}" y="${el.y}" font-size="${el.fontSize}" fill="${el.fill}">${el.text}</text>`;
            case "line":
                const p = el.points?.[0];
                return `<line x1="${el.x}" y1="${el.y}" x2="${p?.x}" y2="${p?.y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`;
            default:
                return "";
        }
    }).join("\n  ");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}" style="display: block; margin: auto;">
  <rect width="100%" height="100%" fill="${state.background}"/>
  ${svgElements}
</svg>`;

    const html = `<!DOCTYPE html>
<html>
<head>
    <title>OpenWhale Canvas</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            margin: 0;
            padding: 2rem;
        }
        .canvas-wrapper {
            background: white;
            border-radius: 8px;
            padding: 1rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        .info {
            margin-top: 1rem;
            color: #888;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="canvas-wrapper">
        ${svg}
    </div>
    <p class="info">${state.width}×${state.height} • ${state.elements.length} elements</p>
</body>
</html>`;

    canvasPush(html);
}

type CanvasElement = {
    id: string;
    type: "rect" | "circle" | "text" | "line" | "path";
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    text?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fontSize?: number;
    points?: Array<{ x: number; y: number }>;
};

type CanvasState = {
    width: number;
    height: number;
    background: string;
    elements: CanvasElement[];
};

const CanvasActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("create"),
        width: z.number().default(800),
        height: z.number().default(600),
        background: z.string().default("#ffffff"),
    }),
    z.object({
        action: z.literal("add_rect"),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
        fill: z.string().optional(),
        stroke: z.string().optional(),
    }),
    z.object({
        action: z.literal("add_circle"),
        x: z.number(),
        y: z.number(),
        radius: z.number(),
        fill: z.string().optional(),
        stroke: z.string().optional(),
    }),
    z.object({
        action: z.literal("add_text"),
        x: z.number(),
        y: z.number(),
        text: z.string(),
        fontSize: z.number().optional().default(16),
        fill: z.string().optional().default("#000000"),
    }),
    z.object({
        action: z.literal("add_line"),
        x1: z.number(),
        y1: z.number(),
        x2: z.number(),
        y2: z.number(),
        stroke: z.string().optional().default("#000000"),
        strokeWidth: z.number().optional().default(1),
    }),
    z.object({
        action: z.literal("remove"),
        elementId: z.string(),
    }),
    z.object({
        action: z.literal("clear"),
    }),
    z.object({
        action: z.literal("export"),
        format: z.enum(["svg", "json"]).default("svg"),
    }),
    z.object({
        action: z.literal("get_state"),
    }),
]);

type CanvasAction = z.infer<typeof CanvasActionSchema>;

function generateId(): string {
    return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const canvasTool: AgentTool<CanvasAction> = {
    name: "canvas",
    description: `Create and manipulate a 2D canvas with shapes. The canvas is viewable at http://localhost:7777/dashboard/__openwhale__/canvas

Valid actions:
- create: Create a new canvas (width, height, background)
- add_rect: Add a rectangle (x, y, width, height, fill, stroke)
- add_circle: Add a circle (x, y, radius, fill, stroke)
- add_text: Add text (x, y, text, fontSize, fill)
- add_line: Add a line (x1, y1, x2, y2, stroke, strokeWidth)
- remove: Remove an element by ID (elementId)
- clear: Clear all elements from the canvas
- export: Export canvas as SVG or JSON (format)
- get_state: Get current canvas state`,
    category: "utility",
    parameters: CanvasActionSchema,

    async execute(params: CanvasAction, context: ToolCallContext): Promise<ToolResult> {
        const getOrCreateState = (): CanvasState => {
            let state = canvasStates.get(context.sessionId);
            if (!state) {
                state = { width: 800, height: 600, background: "#ffffff", elements: [] };
                canvasStates.set(context.sessionId, state);
            }
            return state;
        };

        switch (params.action) {
            case "create": {
                const state: CanvasState = {
                    width: params.width,
                    height: params.height,
                    background: params.background,
                    elements: [],
                };
                canvasStates.set(context.sessionId, state);
                syncToWebCanvas(state);
                return { success: true, content: `Canvas created: ${params.width}x${params.height}. View at: http://localhost:7777/dashboard/__openwhale__/canvas` };
            }

            case "add_rect": {
                const state = getOrCreateState();
                const id = generateId();
                state.elements.push({
                    id,
                    type: "rect",
                    x: params.x,
                    y: params.y,
                    width: params.width,
                    height: params.height,
                    fill: params.fill,
                    stroke: params.stroke,
                });
                syncToWebCanvas(state);
                return { success: true, content: `Added rect: ${id}. Canvas updated: http://localhost:7777/dashboard/__openwhale__/canvas`, metadata: { elementId: id } };
            }

            case "add_circle": {
                const state = getOrCreateState();
                const id = generateId();
                state.elements.push({
                    id,
                    type: "circle",
                    x: params.x,
                    y: params.y,
                    radius: params.radius,
                    fill: params.fill,
                    stroke: params.stroke,
                });
                syncToWebCanvas(state);
                return { success: true, content: `Added circle: ${id}. Canvas updated: http://localhost:7777/dashboard/__openwhale__/canvas`, metadata: { elementId: id } };
            }

            case "add_text": {
                const state = getOrCreateState();
                const id = generateId();
                state.elements.push({
                    id,
                    type: "text",
                    x: params.x,
                    y: params.y,
                    text: params.text,
                    fontSize: params.fontSize,
                    fill: params.fill,
                });
                syncToWebCanvas(state);
                return { success: true, content: `Added text: ${id}. Canvas updated: http://localhost:7777/dashboard/__openwhale__/canvas`, metadata: { elementId: id } };
            }

            case "add_line": {
                const state = getOrCreateState();
                const id = generateId();
                state.elements.push({
                    id,
                    type: "line",
                    x: params.x1,
                    y: params.y1,
                    points: [{ x: params.x2, y: params.y2 }],
                    stroke: params.stroke,
                    strokeWidth: params.strokeWidth,
                });
                syncToWebCanvas(state);
                return { success: true, content: `Added line: ${id}. Canvas updated: http://localhost:7777/dashboard/__openwhale__/canvas`, metadata: { elementId: id } };
            }

            case "remove": {
                const state = getOrCreateState();
                const idx = state.elements.findIndex(e => e.id === params.elementId);
                if (idx === -1) {
                    return { success: false, content: "", error: `Element not found: ${params.elementId}` };
                }
                state.elements.splice(idx, 1);
                syncToWebCanvas(state);
                return { success: true, content: `Removed element: ${params.elementId}. Canvas updated: http://localhost:7777/dashboard/__openwhale__/canvas` };
            }

            case "clear": {
                const state = getOrCreateState();
                state.elements = [];
                syncToWebCanvas(state);
                return { success: true, content: "Canvas cleared. View at: http://localhost:7777/dashboard/__openwhale__/canvas" };
            }

            case "export": {
                const state = getOrCreateState();

                if (params.format === "json") {
                    return { success: true, content: JSON.stringify(state, null, 2) };
                }

                // Generate SVG
                const svgElements = state.elements.map(el => {
                    switch (el.type) {
                        case "rect":
                            return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill ?? "none"}" stroke="${el.stroke ?? "none"}"/>`;
                        case "circle":
                            return `<circle cx="${el.x}" cy="${el.y}" r="${el.radius}" fill="${el.fill ?? "none"}" stroke="${el.stroke ?? "none"}"/>`;
                        case "text":
                            return `<text x="${el.x}" y="${el.y}" font-size="${el.fontSize}" fill="${el.fill}">${el.text}</text>`;
                        case "line":
                            const p = el.points?.[0];
                            return `<line x1="${el.x}" y1="${el.y}" x2="${p?.x}" y2="${p?.y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`;
                        default:
                            return "";
                    }
                }).join("\n  ");

                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}">
  <rect width="100%" height="100%" fill="${state.background}"/>
  ${svgElements}
</svg>`;

                return { success: true, content: svg, metadata: { format: "svg" } };
            }

            case "get_state": {
                const state = getOrCreateState();
                return {
                    success: true,
                    content: `Canvas: ${state.width}x${state.height}, ${state.elements.length} elements`,
                    metadata: { elementCount: state.elements.length, size: { width: state.width, height: state.height } },
                };
            }
        }
    },
};
