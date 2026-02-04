/**
 * Camera Tool - Camera capture and screen recording (macOS)
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { z } from "zod";
import type { AgentTool, ToolResult } from "./base.js";

const execAsync = promisify(exec);

export const cameraSnapTool: AgentTool<Record<string, never>> = {
    name: "camera_snap",
    description: "Take a photo using the device camera (macOS, requires imagesnap or ffmpeg)",
    category: "device",
    parameters: z.object({}),
    execute: async (_params, _context): Promise<ToolResult> => {
        try {
            if (process.platform !== "darwin") {
                return { success: false, content: "", error: "Camera capture only supported on macOS" };
            }

            const tmpFile = join(tmpdir(), `camera_${Date.now()}.jpg`);

            try {
                // Try imagesnap first
                await execAsync(`imagesnap -q "${tmpFile}"`);
            } catch {
                try {
                    // Fallback to ffmpeg
                    await execAsync(`ffmpeg -f avfoundation -video_size 1280x720 -framerate 1 -i "0" -vframes 1 "${tmpFile}" -y 2>/dev/null`);
                } catch {
                    return {
                        success: false,
                        content: "",
                        error: "Could not capture from camera. Install: brew install imagesnap"
                    };
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
    description: "Record a short video from the camera (macOS, requires ffmpeg)",
    category: "device",
    parameters: z.object({
        duration: z.number().optional().describe("Recording duration in seconds (max 30)"),
    }),
    execute: async (params: { duration?: number }, _context): Promise<ToolResult> => {
        try {
            if (process.platform !== "darwin") {
                return { success: false, content: "", error: "Camera recording only supported on macOS" };
            }

            const actualDuration = Math.min(Math.max(1, params.duration || 5), 30);
            const tmpFile = join(tmpdir(), `camrec_${Date.now()}.mov`);

            await execAsync(`ffmpeg -f avfoundation -video_size 1280x720 -framerate 30 -i "0" -t ${actualDuration} "${tmpFile}" -y 2>/dev/null`);

            const buffer = await readFile(tmpFile);
            await unlink(tmpFile);

            return {
                success: true,
                content: `🎬 Camera recording captured (${actualDuration}s, ${Math.round(buffer.length / 1024)}KB)`,
                metadata: {
                    base64: buffer.toString("base64"),
                    mimeType: "video/quicktime",
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
    description: "Record the screen for a specified duration (macOS)",
    category: "device",
    parameters: z.object({
        duration: z.number().optional().describe("Recording duration in seconds (max 60)"),
    }),
    execute: async (params: { duration?: number }, _context): Promise<ToolResult> => {
        try {
            if (process.platform !== "darwin") {
                return { success: false, content: "", error: "Screen recording only supported on macOS" };
            }

            const actualDuration = Math.min(Math.max(1, params.duration || 5), 60);
            const tmpFile = join(tmpdir(), `screenrec_${Date.now()}.mov`);

            await execAsync(`screencapture -v -V ${actualDuration} "${tmpFile}" 2>/dev/null`);

            const buffer = await readFile(tmpFile);
            await unlink(tmpFile);

            return {
                success: true,
                content: `🎥 Screen recording captured (${actualDuration}s, ${Math.round(buffer.length / 1024)}KB)`,
                metadata: {
                    base64: buffer.toString("base64"),
                    mimeType: "video/quicktime",
                    size: buffer.length,
                    duration: actualDuration,
                },
            };
        } catch (err) {
            return { success: false, content: "", error: String(err) };
        }
    },
};

export const cameraTools = [cameraSnapTool, cameraRecordTool, screenRecordTool];
