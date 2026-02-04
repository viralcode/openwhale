import { z } from "zod";
import { spawn, execSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const ScreenshotParamsSchema = z.object({
    region: z.enum(["fullscreen", "window", "selection"]).optional().default("fullscreen")
        .describe("What to capture: fullscreen (entire screen), window (frontmost window), or selection (interactive)"),
    display: z.number().optional().describe("Display number for multi-monitor setups (0 = main display)"),
    delay: z.number().optional().describe("Delay in seconds before capture"),
    hideCursor: z.boolean().optional().default(false).describe("Hide the mouse cursor"),
});

type ScreenshotParams = z.infer<typeof ScreenshotParamsSchema>;

// Max size for Claude API (4MB with some margin)
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Compress image using sips (macOS built-in) to JPEG
 */
function compressImage(inputPath: string, outputPath: string, quality: number = 80): boolean {
    try {
        // Convert to JPEG with specified quality
        execSync(`sips -s format jpeg -s formatOptions ${quality} "${inputPath}" --out "${outputPath}"`, {
            stdio: 'pipe',
            timeout: 30000
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Resize image using sips to reduce file size
 */
function resizeImage(imagePath: string, scale: number): boolean {
    try {
        // Get current dimensions
        const dimOutput = execSync(`sips -g pixelWidth -g pixelHeight "${imagePath}"`, { encoding: 'utf8' });
        const widthMatch = dimOutput.match(/pixelWidth:\s*(\d+)/);
        const heightMatch = dimOutput.match(/pixelHeight:\s*(\d+)/);

        if (widthMatch && heightMatch) {
            const newWidth = Math.floor(parseInt(widthMatch[1]) * scale);
            execSync(`sips --resampleWidth ${newWidth} "${imagePath}"`, { stdio: 'pipe', timeout: 30000 });
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Screenshot tool - captures the screen and returns base64 for vision analysis
 * Uses macOS screencapture command with JPEG compression for smaller file sizes
 */
export const screenshotTool: AgentTool<ScreenshotParams> = {
    name: "screenshot",
    description: `Capture a screenshot of the screen. Use this to SEE what's on the user's display. 
You can then analyze the screenshot using your vision capabilities.
This tool captures the screen and returns the image as base64 data.
Works on macOS using the native screencapture command.`,
    category: "system",
    parameters: ScreenshotParamsSchema,
    requiresElevated: true,

    async execute(params: ScreenshotParams, context: ToolCallContext): Promise<ToolResult> {
        const { region, display, delay, hideCursor } = params;

        // Create temp directory for screenshots
        const tempDir = join(context.workspaceDir || process.cwd(), ".openwhale-temp");
        if (!existsSync(tempDir)) {
            mkdirSync(tempDir, { recursive: true });
        }

        const pngFilename = `screenshot-${randomUUID()}.png`;
        const jpgFilename = `screenshot-${randomUUID()}.jpg`;
        const pngPath = join(tempDir, pngFilename);
        const jpgPath = join(tempDir, jpgFilename);

        // Build screencapture command for macOS
        const args: string[] = [];

        // Region type
        switch (region) {
            case "window":
                args.push("-w"); // Interactive window selection
                break;
            case "selection":
                args.push("-s"); // Interactive selection
                break;
            // fullscreen is default (no flag needed)
        }

        // Display
        if (display !== undefined) {
            args.push("-D", String(display));
        }

        // Delay
        if (delay !== undefined && delay > 0) {
            args.push("-T", String(delay));
        }

        // Hide cursor
        if (hideCursor) {
            args.push("-C");
        }

        // Output file (PNG first, then convert)
        args.push(pngPath);

        return new Promise((resolve) => {
            // Check if we're on macOS
            if (process.platform !== "darwin") {
                resolve({
                    success: false,
                    content: "",
                    error: "Screenshot tool currently only supports macOS. Use 'exec' with appropriate commands for other platforms.",
                });
                return;
            }

            const child = spawn("screencapture", args, {
                cwd: context.workspaceDir || process.cwd(),
                timeout: 30000,
            });

            let stderr = "";

            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            child.on("error", (err) => {
                resolve({
                    success: false,
                    content: "",
                    error: `Failed to capture screenshot: ${err.message}`,
                });
            });

            child.on("close", (code) => {
                if (code !== 0) {
                    resolve({
                        success: false,
                        content: "",
                        error: `Screenshot failed with code ${code}: ${stderr}`,
                    });
                    return;
                }

                try {
                    if (!existsSync(pngPath)) {
                        resolve({
                            success: false,
                            content: "",
                            error: "Screenshot was cancelled or failed to save",
                        });
                        return;
                    }

                    // Compress to JPEG
                    let finalPath = pngPath;
                    let quality = 85;

                    if (compressImage(pngPath, jpgPath, quality)) {
                        finalPath = jpgPath;

                        // Check size and progressively reduce quality/size if needed
                        let imageBuffer = readFileSync(jpgPath);
                        let attempts = 0;

                        while (imageBuffer.length > MAX_IMAGE_BYTES && attempts < 5) {
                            attempts++;
                            if (attempts <= 2) {
                                // First try reducing quality
                                quality -= 15;
                                compressImage(pngPath, jpgPath, quality);
                            } else {
                                // Then try resizing
                                resizeImage(jpgPath, 0.7);
                            }
                            imageBuffer = readFileSync(jpgPath);
                        }
                    }

                    const imageBuffer = readFileSync(finalPath);
                    const base64 = imageBuffer.toString("base64");
                    const sizeKB = Math.round(imageBuffer.length / 1024);

                    // Clean up temp files
                    try { unlinkSync(pngPath); } catch { }
                    try { unlinkSync(jpgPath); } catch { }

                    resolve({
                        success: true,
                        content: `Screenshot captured successfully (${sizeKB}KB). The image data is available for vision analysis.`,
                        metadata: {
                            base64,
                            mimeType: finalPath.endsWith('.jpg') ? "image/jpeg" : "image/png",
                            sizeBytes: imageBuffer.length,
                            filepath: finalPath,
                        },
                    });
                } catch (err: any) {
                    // Clean up on error
                    try { unlinkSync(pngPath); } catch { }
                    try { unlinkSync(jpgPath); } catch { }

                    resolve({
                        success: false,
                        content: "",
                        error: `Failed to read screenshot: ${err.message}`,
                    });
                }
            });
        });
    },
};
