/**
 * Canvas Tool - Push/reset/eval content in the canvas workspace
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { canvasPush, canvasReset, canvasEval, getCanvasHTML } from "../canvas/index.js";

const CanvasToolSchema = z.object({
    action: z.enum(["push", "reset", "eval", "snapshot"]).describe("Action to perform on canvas"),
    content: z.string().optional().describe("HTML content for push, or JavaScript code for eval"),
    title: z.string().optional().describe("Title for the canvas page"),
});

type CanvasToolParams = z.infer<typeof CanvasToolSchema>;

export const canvasTool: AgentTool<CanvasToolParams> = {
    name: "canvas",
    description: `Control the visual canvas workspace. Actions:
- push: Push HTML/React content to the canvas (requires 'content')
- reset: Clear the canvas to default state
- eval: Execute JavaScript in the canvas (requires 'content' with JS code)
- snapshot: Get the current canvas HTML`,
    category: "device",
    parameters: CanvasToolSchema,

    async execute(params: CanvasToolParams, _context: ToolCallContext): Promise<ToolResult> {
        try {
            switch (params.action) {
                case "push": {
                    if (!params.content) {
                        return {
                            success: false,
                            content: "",
                            error: "Content is required for push action",
                        };
                    }

                    // Wrap content in HTML if not already
                    let html = params.content;
                    if (!html.toLowerCase().includes("<!doctype") && !html.toLowerCase().includes("<html")) {
                        html = `
<!DOCTYPE html>
<html>
<head>
    <title>${params.title || "OpenWhale Canvas"}</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            margin: 0;
            padding: 2rem;
        }
    </style>
</head>
<body>
${params.content}
</body>
</html>`;
                    }

                    canvasPush(html);
                    return {
                        success: true,
                        content: "Canvas updated. View at /__openwhale__/canvas",
                    };
                }

                case "reset": {
                    canvasReset();
                    return {
                        success: true,
                        content: "Canvas reset to default state",
                    };
                }

                case "eval": {
                    if (!params.content) {
                        return {
                            success: false,
                            content: "",
                            error: "Content (JavaScript code) is required for eval action",
                        };
                    }
                    canvasEval(params.content);
                    return {
                        success: true,
                        content: "JavaScript executed in canvas",
                    };
                }

                case "snapshot": {
                    const html = getCanvasHTML();
                    return {
                        success: true,
                        content: html,
                        metadata: { length: html.length },
                    };
                }

                default:
                    return {
                        success: false,
                        content: "",
                        error: `Unknown action: ${params.action}`,
                    };
            }
        } catch (err) {
            return {
                success: false,
                content: "",
                error: err instanceof Error ? err.message : String(err),
            };
        }
    },
};

export default canvasTool;
