/**
 * Canvas / A2UI System
 * 
 * Agent-driven visual workspace with live WebSocket updates.
 * Based on OpenClaw's A2UI implementation.
 */

import { type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

export const A2UI_PATH = "/__openwhale__/a2ui";
export const CANVAS_HOST_PATH = "/__openwhale__/canvas";
export const CANVAS_WS_PATH = "/__openwhale__/canvas-ws";

// Connected canvas clients
const canvasClients = new Set<WebSocket>();

// Current canvas state
let currentCanvasHTML = `
<!DOCTYPE html>
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
            margin: 0;
        }
        .canvas-container {
            text-align: center;
            padding: 2rem;
        }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { color: #888; }
    </style>
</head>
<body>
    <div class="canvas-container">
        <h1>🐋 OpenWhale Canvas</h1>
        <p>Ready for agent-driven content</p>
    </div>
</body>
</html>
`;

/**
 * Inject live reload and OpenWhale bridge script
 */
export function injectCanvasScripts(html: string): string {
    const snippet = `
<script>
(() => {
    // OpenWhale Canvas Bridge
    function postToAgent(payload) {
        try {
            const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
            if (window.opener && window.opener.postMessage) {
                window.opener.postMessage({ type: "openwhale-canvas", data: raw }, "*");
            }
            return true;
        } catch { return false; }
    }
    
    function sendUserAction(userAction) {
        const id = (userAction && userAction.id) || (crypto.randomUUID ? crypto.randomUUID() : Date.now());
        const action = { ...userAction, id };
        return postToAgent({ userAction: action });
    }
    
    globalThis.OpenWhale = globalThis.OpenWhale ?? {};
    globalThis.OpenWhale.postMessage = postToAgent;
    globalThis.OpenWhale.sendUserAction = sendUserAction;

    // Polling-based live reload (until WebSocket is wired)
    let lastContent = document.documentElement.outerHTML;
    async function pollForUpdates() {
        try {
            const res = await fetch(window.location.href, { cache: 'no-store' });
            const newContent = await res.text();
            if (newContent !== lastContent && !newContent.includes('404')) {
                lastContent = newContent;
                // Check if content actually changed meaningfully
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(newContent, 'text/html');
                const newBody = newDoc.body.innerHTML;
                if (newBody !== document.body.innerHTML) {
                    document.body.innerHTML = newBody;
                    console.log('[Canvas] Content updated via polling');
                }
            }
        } catch (e) {
            console.log('[Canvas] Poll failed:', e);
        }
        setTimeout(pollForUpdates, 2000); // Poll every 2 seconds
    }
    setTimeout(pollForUpdates, 2000);
    console.log('[Canvas] Live polling started');
})();
</script>
`.trim();

    const idx = html.toLowerCase().lastIndexOf("</body>");
    if (idx >= 0) {
        return `${html.slice(0, idx)}\n${snippet}\n${html.slice(idx)}`;
    }
    return `${html}\n${snippet}\n`;
}

/**
 * Setup WebSocket server for canvas
 */
export function setupCanvasWebSocket(server: WebSocketServer): void {
    server.on("connection", (ws, req) => {
        if (req.url?.startsWith(CANVAS_WS_PATH)) {
            canvasClients.add(ws);
            console.log("[Canvas] Client connected");

            ws.on("close", () => {
                canvasClients.delete(ws);
                console.log("[Canvas] Client disconnected");
            });

            ws.on("message", (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    console.log("[Canvas] Received:", msg);
                } catch { }
            });
        }
    });
}

/**
 * Broadcast to all canvas clients
 */
export function broadcastToCanvas(message: { type: string;[key: string]: unknown }): void {
    const data = JSON.stringify(message);
    for (const client of canvasClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

/**
 * Push HTML content to canvas
 */
export function canvasPush(html: string): void {
    currentCanvasHTML = html;
    broadcastToCanvas({ type: "push", html });
    broadcastToCanvas({ type: "reload" });
}

/**
 * Reset canvas to default state
 */
export function canvasReset(): void {
    currentCanvasHTML = `
<!DOCTYPE html>
<html>
<head><title>OpenWhale Canvas</title></head>
<body style="font-family: system-ui; background: #1a1a2e; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
    <div style="text-align: center;">
        <h1>🐋 OpenWhale Canvas</h1>
        <p style="color: #888;">Canvas reset</p>
    </div>
</body>
</html>`;
    broadcastToCanvas({ type: "reload" });
}

/**
 * Evaluate JavaScript in canvas
 */
export function canvasEval(code: string): void {
    broadcastToCanvas({ type: "eval", code });
}

/**
 * Get current canvas state
 */
export function getCanvasHTML(): string {
    return currentCanvasHTML;
}

/**
 * Handle HTTP request for canvas page
 */
export async function handleCanvasHttpRequest(
    req: IncomingMessage,
    res: ServerResponse
): Promise<boolean> {
    const urlRaw = req.url;
    if (!urlRaw) return false;

    const url = new URL(urlRaw, "http://localhost");

    // Handle canvas host route
    if (url.pathname === CANVAS_HOST_PATH || url.pathname.startsWith(`${CANVAS_HOST_PATH}/`)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(injectCanvasScripts(currentCanvasHTML));
        return true;
    }

    // Handle A2UI assets route
    if (url.pathname === A2UI_PATH || url.pathname.startsWith(`${A2UI_PATH}/`)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(injectCanvasScripts(currentCanvasHTML));
        return true;
    }

    return false;
}

export default {
    canvasPush,
    canvasReset,
    canvasEval,
    getCanvasHTML,
    handleCanvasHttpRequest,
    setupCanvasWebSocket,
    broadcastToCanvas,
};
