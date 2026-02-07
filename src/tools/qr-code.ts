import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import QRCode from "qrcode";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const QRActionSchema = z.object({
    action: z.enum(["generate"]).describe("Action to perform"),
    content: z.string().describe("Content to encode: URL, text, WiFi string, vCard, etc."),
    type: z.enum(["url", "text", "wifi", "email", "phone"]).optional().default("text").describe("Type of QR content"),
    wifiSSID: z.string().optional().describe("WiFi network name (for type=wifi)"),
    wifiPassword: z.string().optional().describe("WiFi password (for type=wifi)"),
    wifiEncryption: z.enum(["WPA", "WEP", "nopass"]).optional().default("WPA").describe("WiFi encryption type"),
    outputPath: z.string().optional().describe("Output file path for the QR code PNG"),
    size: z.number().optional().default(400).describe("QR code image size in pixels"),
});

type QRAction = z.infer<typeof QRActionSchema>;

function buildQRContent(params: QRAction): string {
    switch (params.type) {
        case "wifi":
            const ssid = params.wifiSSID || params.content;
            const pass = params.wifiPassword || "";
            const enc = params.wifiEncryption || "WPA";
            return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
        case "email":
            return params.content.startsWith("mailto:") ? params.content : `mailto:${params.content}`;
        case "phone":
            return params.content.startsWith("tel:") ? params.content : `tel:${params.content}`;
        case "url":
            return params.content.startsWith("http") ? params.content : `https://${params.content}`;
        default:
            return params.content;
    }
}

export const qrCodeTool: AgentTool<QRAction> = {
    name: "qr_code",
    description: "Generate QR codes for URLs, text, WiFi networks, email addresses, phone numbers, or any text content. Returns a PNG image.",
    category: "utility",
    parameters: QRActionSchema,

    async execute(params: QRAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            const qrContent = buildQRContent(params);
            const outputPath = params.outputPath || join(homedir(), ".openwhale", "output", `qr-${Date.now()}.png`);

            // Ensure output directory exists
            const { mkdir } = await import("node:fs/promises");
            const { dirname } = await import("node:path");
            await mkdir(dirname(outputPath), { recursive: true });

            // Generate QR code as PNG buffer
            const buffer = await QRCode.toBuffer(qrContent, {
                width: params.size,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" },
                errorCorrectionLevel: "M",
            });

            // Save to file
            await writeFile(outputPath, buffer);

            return {
                success: true,
                content: `Generated QR code: ${outputPath} (${params.type}: ${qrContent.slice(0, 100)})`,
                metadata: {
                    path: outputPath,
                    type: params.type,
                    contentEncoded: qrContent,
                    sizeBytes: buffer.length,
                    image: `data:image/png;base64,${buffer.toString("base64")}`,
                },
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `QR generation failed: ${message}` };
        }
    },
};
