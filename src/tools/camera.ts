/**
 * Camera Tool - Camera capture and screen recording
 * Cross-platform: macOS (imagesnap/ffmpeg), Windows (ffmpeg dshow), Linux (ffmpeg v4l2)
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { z } from "zod";
import type { AgentTool, ToolResult } from "./base.js";

const execAsync = promisify(exec);
const platform = process.platform;

/**
 * Get the ffmpeg camera input flags for each platform
 */
function getCameraInput(): { format: string; input: string } | null {
    switch (platform) {
        case "darwin":
            return { format: "avfoundation", input: "0" };
        case "win32":
            return { format: "dshow", input: "video=Integrated Camera" };
        case "linux":
            return { format: "v4l2", input: "/dev/video0" };
        default:
            return null;
    }
}

export const cameraSnapTool: AgentTool<Record<string, never>> = {
    name: "camera_snap",
    description: "Take a photo using the device camera. Requires imagesnap (macOS) or ffmpeg (all platforms).",
    category: "device",
    parameters: z.object({}),
    execute: async (_params, _context): Promise<ToolResult> => {
        try {
            const tmpFile = join(tmpdir(), `camera_${Date.now()}.jpg`);

            if (platform === "darwin") {
                // Try imagesnap first (macOS-specific, simple)
                try {
                    await execAsync(`imagesnap -q "${tmpFile}"`);
                } catch {
                    // Fallback to ffmpeg with avfoundation
                    try {
                        await execAsync(`ffmpeg -f avfoundation -video_size 1280x720 -framerate 1 -i "0" -vframes 1 "${tmpFile}" -y 2>/dev/null`);
                    } catch {
                        return { success: false, content: "", error: "Could not capture from camera. Install: brew install imagesnap" };
                    }
                }
            } else {
                // Windows / Linux: use ffmpeg with platform-specific input
                const cam = getCameraInput();
                if (!cam) {
                    return { success: false, content: "", error: `Camera capture not supported on ${platform}` };
                }
                try {
                    const inputFlag = platform === "win32" ? `video="${cam.input}"` : cam.input;
                    await execAsync(`ffmpeg -f ${cam.format} -video_size 1280x720 -framerate 1 -i "${inputFlag}" -vframes 1 "${tmpFile}" -y 2>${platform === "win32" ? "NUL" : "/dev/null"}`);
                } catch {
                    return { success: false, content: "", error: "Could not capture from camera. Ensure ffmpeg is installed and a camera is connected." };
                }
            }

            const buffer = await readFile(tmpFile);
            await unlink(tmpFile);

            return {
                success: true,
                content: `📷 Camera snapshot captured (${Math.round(buffer.length / 1024)}KB)`,
                metadata: {
                    base64: buffer.toString("base64"),
                    mimeType: "image/jpeg",
                    size: buffer.length,
                },
            };
        } catch (err) {
            return { success: false, content: "", error: String(err) };
        }
    },
};

export const cameraRecordTool: AgentTool<{ duration?: number }> = {
    name: "camera_record",
    description: "Record a short video from the camera. Requires ffmpeg.",
    category: "device",
    parameters: z.object({
        duration: z.number().optional().describe("Recording duration in seconds (max 30)"),
    }),
    execute: async (params: { duration?: number }, _context): Promise<ToolResult> => {
        try {
            const cam = getCameraInput();
            if (!cam) {
                return { success: false, content: "", error: `Camera recording not supported on ${platform}` };
            }

            const actualDuration = Math.min(Math.max(1, params.duration || 5), 30);
            const ext = platform === "darwin" ? "mov" : "mp4";
            const tmpFile = join(tmpdir(), `camrec_${Date.now()}.${ext}`);
            const nullDev = platform === "win32" ? "NUL" : "/dev/null";

            const inputFlag = platform === "win32" ? `video="${cam.input}"` : cam.input;
            await execAsync(`ffmpeg -f ${cam.format} -video_size 1280x720 -framerate 30 -i "${inputFlag}" -t ${actualDuration} "${tmpFile}" -y 2>${nullDev}`);

            const buffer = await readFile(tmpFile);
            await unlink(tmpFile);

            return {
                success: true,
                content: `🎬 Camera recording captured (${actualDuration}s, ${Math.round(buffer.length / 1024)}KB)`,
                metadata: {
                    base64: buffer.toString("base64"),
                    mimeType: ext === "mov" ? "video/quicktime" : "video/mp4",
                    size: buffer.length,
                    duration: actualDuration,
                },
            };
        } catch (err) {
            return { success: false, content: "", error: `Recording failed: ${err}. Ensure ffmpeg is installed.` };
        }
    },
};

export const screenRecordTool: AgentTool<{ duration?: number }> = {
    name: "screen_record",
    description: "Record the screen for a specified duration. Uses screencapture (macOS) or ffmpeg (Windows/Linux).",
    category: "device",
    parameters: z.object({
        duration: z.number().optional().describe("Recording duration in seconds (max 60)"),
    }),
    execute: async (params: { duration?: number }, _context): Promise<ToolResult> => {
        try {
            const actualDuration = Math.min(Math.max(1, params.duration || 5), 60);
            const nullDev = platform === "win32" ? "NUL" : "/dev/null";

            if (platform === "darwin") {
                const tmpFile = join(tmpdir(), `screenrec_${Date.now()}.mov`);
                await execAsync(`screencapture -v -V ${actualDuration} "${tmpFile}" 2>/dev/null`);
                const buffer = await readFile(tmpFile);
                await unlink(tmpFile);
                return {
                    success: true,
                    content: `🎥 Screen recording captured (${actualDuration}s, ${Math.round(buffer.length / 1024)}KB)`,
                    metadata: { base64: buffer.toString("base64"), mimeType: "video/quicktime", size: buffer.length, duration: actualDuration },
                };
            } else if (platform === "win32") {
                const tmpFile = join(tmpdir(), `screenrec_${Date.now()}.mp4`);
                await execAsync(`ffmpeg -f gdigrab -framerate 30 -i desktop -t ${actualDuration} -c:v libx264 -preset ultrafast "${tmpFile}" -y 2>${nullDev}`);
                const buffer = await readFile(tmpFile);
                await unlink(tmpFile);
                return {
                    success: true,
                    content: `🎥 Screen recording captured (${actualDuration}s, ${Math.round(buffer.length / 1024)}KB)`,
                    metadata: { base64: buffer.toString("base64"), mimeType: "video/mp4", size: buffer.length, duration: actualDuration },
                };
            } else {
                // Linux
                const tmpFile = join(tmpdir(), `screenrec_${Date.now()}.mp4`);
                const display = process.env.DISPLAY || ":0";
                await execAsync(`ffmpeg -f x11grab -video_size 1920x1080 -i ${display} -t ${actualDuration} -c:v libx264 -preset ultrafast "${tmpFile}" -y 2>${nullDev}`);
                const buffer = await readFile(tmpFile);
                await unlink(tmpFile);
                return {
                    success: true,
                    content: `🎥 Screen recording captured (${actualDuration}s, ${Math.round(buffer.length / 1024)}KB)`,
                    metadata: { base64: buffer.toString("base64"), mimeType: "video/mp4", size: buffer.length, duration: actualDuration },
                };
            }
        } catch (err) {
            return { success: false, content: "", error: String(err) };
        }
    },
};

export const cameraTools = [cameraSnapTool, cameraRecordTool, screenRecordTool];
