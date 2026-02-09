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

const platform = process.platform;

/**
 * Compress image using sips (macOS built-in) to JPEG
 */
function compressImageMac(inputPath: string, outputPath: string, quality: number = 80): boolean {
    try {
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
 * Resize image using sips to reduce file size (macOS only)
 */
function resizeImageMac(imagePath: string, scale: number): boolean {
    try {
        const dimOutput = execSync(`sips -g pixelWidth -g pixelHeight "${imagePath}"`, { encoding: 'utf8' });
        const widthMatch = dimOutput.match(/pixelWidth:\s*(\d+)/);
        if (widthMatch) {
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
 * Capture screenshot on macOS using screencapture
 */
function captureMacOS(args: string[], outputPath: string, workDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        args.push(outputPath);
        const child = spawn("screencapture", args, { cwd: workDir, timeout: 30000 });
        let stderr = "";
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
            if (code !== 0) reject(new Error(`screencapture failed (code ${code}): ${stderr}`));
            else resolve();
        });
    });
}

/**
 * Capture screenshot on Windows using PowerShell
 */
async function captureWindows(outputPath: string): Promise<void> {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screens = [System.Windows.Forms.Screen]::AllScreens
$bounds = [System.Drawing.Rectangle]::Empty
foreach ($s in $screens) { $bounds = [System.Drawing.Rectangle]::Union($bounds, $s.Bounds) }
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$g.Dispose()
$bmp.Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;
    return new Promise((resolve, reject) => {
        const child = spawn("powershell", ["-NoProfile", "-Command", psScript], { timeout: 30000 });
        let stderr = "";
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
            if (code !== 0) reject(new Error(`PowerShell screenshot failed (code ${code}): ${stderr}`));
            else resolve();
        });
    });
}

/**
 * Capture screenshot on Linux using available tools
 */
async function captureLinux(outputPath: string): Promise<void> {
    // Try multiple tools in order of preference
    const tools = [
        { cmd: "scrot", args: [outputPath] },
        { cmd: "gnome-screenshot", args: ["-f", outputPath] },
        { cmd: "import", args: ["-window", "root", outputPath] },  // ImageMagick
        { cmd: "xdg-screenshot", args: ["-o", outputPath] },
    ];

    for (const tool of tools) {
        try {
            execSync(`which ${tool.cmd}`, { stdio: "pipe" });
            return new Promise((resolve, reject) => {
                const child = spawn(tool.cmd, tool.args, { timeout: 30000 });
                let stderr = "";
                child.stderr.on("data", (d) => { stderr += d.toString(); });
                child.on("error", (err) => reject(err));
                child.on("close", (code) => {
                    if (code !== 0) reject(new Error(`${tool.cmd} failed (code ${code}): ${stderr}`));
                    else resolve();
                });
            });
        } catch {
            continue; // Tool not found, try next
        }
    }

    throw new Error("No screenshot tool found. Install scrot, gnome-screenshot, or ImageMagick (import).");
}

/**
 * Screenshot tool - captures the screen and returns base64 for vision analysis
 * Supports macOS (screencapture), Windows (PowerShell), and Linux (scrot/gnome-screenshot/import)
 */
export const screenshotTool: AgentTool<ScreenshotParams> = {
    name: "screenshot",
    description: `Capture a screenshot of the screen. Use this to SEE what's on the user's display. 
You can then analyze the screenshot using your vision capabilities.
This tool captures the screen and returns the image as base64 data.
Works on macOS, Windows, and Linux.`,
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

        try {
            // Capture screenshot based on platform
            if (platform === "darwin") {
                const args: string[] = [];
                switch (region) {
                    case "window": args.push("-w"); break;
                    case "selection": args.push("-s"); break;
                }
                if (display !== undefined) args.push("-D", String(display));
                if (delay !== undefined && delay > 0) args.push("-T", String(delay));
                if (hideCursor) args.push("-C");

                await captureMacOS(args, pngPath, context.workspaceDir || process.cwd());
            } else if (platform === "win32") {
                if (delay && delay > 0) {
                    await new Promise(r => setTimeout(r, delay * 1000));
                }
                await captureWindows(pngPath);
            } else {
                // Linux
                if (delay && delay > 0) {
                    await new Promise(r => setTimeout(r, delay * 1000));
                }
                await captureLinux(pngPath);
            }

            if (!existsSync(pngPath)) {
                return { success: false, content: "", error: "Screenshot was cancelled or failed to save" };
            }

            // Compress to JPEG (macOS uses sips, other platforms keep PNG)
            let finalPath = pngPath;

            if (platform === "darwin") {
                let quality = 85;
                if (compressImageMac(pngPath, jpgPath, quality)) {
                    finalPath = jpgPath;

                    let imageBuffer = readFileSync(jpgPath);
                    let attempts = 0;
                    while (imageBuffer.length > MAX_IMAGE_BYTES && attempts < 5) {
                        attempts++;
                        if (attempts <= 2) {
                            quality -= 15;
                            compressImageMac(pngPath, jpgPath, quality);
                        } else {
                            resizeImageMac(jpgPath, 0.7);
                        }
                        imageBuffer = readFileSync(jpgPath);
                    }
                }
            }

            const imageBuffer = readFileSync(finalPath);
            const base64 = imageBuffer.toString("base64");
            const sizeKB = Math.round(imageBuffer.length / 1024);

            // Clean up temp files
            try { unlinkSync(pngPath); } catch { }
            try { unlinkSync(jpgPath); } catch { }

            return {
                success: true,
                content: `Screenshot captured successfully (${sizeKB}KB). The image data is available for vision analysis.`,
                metadata: {
                    base64,
                    mimeType: finalPath.endsWith('.jpg') ? "image/jpeg" : "image/png",
                    sizeBytes: imageBuffer.length,
                    filepath: finalPath,
                },
            };
        } catch (err: any) {
            try { unlinkSync(pngPath); } catch { }
            try { unlinkSync(jpgPath); } catch { }
            return { success: false, content: "", error: `Failed to capture screenshot: ${err.message}` };
        }
    },
};
