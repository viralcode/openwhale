/**
 * Screen Recording Tool
 * 
 * Start/stop screen recording for automation and demos.
 * Platform-specific implementations.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const ScreenRecordToolSchema = z.object({
    action: z.enum(["start", "stop", "status"]).describe("Action to perform"),
    duration: z.number().min(1).max(300).optional()
        .describe("Recording duration in seconds (max 300, for 'start' action)"),
    filename: z.string().optional()
        .describe("Output filename (without extension)"),
});

type ScreenRecordParams = z.infer<typeof ScreenRecordToolSchema>;

let currentRecording: ChildProcess | null = null;
let recordingPath: string | null = null;
let recordingStartTime: number | null = null;

/**
 * Get temp directory for recordings
 */
function getRecordingDir(): string {
    return path.join(os.tmpdir(), "openwhale-recordings");
}

/**
 * Start screen recording (macOS)
 */
async function startRecordingMacOS(outputPath: string, duration?: number): Promise<void> {
    const args = ["-t", String(duration || 60), "-v", "-g", outputPath];
    currentRecording = spawn("screencapture", args, { stdio: "ignore" });
    recordingPath = outputPath;
    recordingStartTime = Date.now();

    currentRecording.on("close", () => {
        currentRecording = null;
        console.log(`[ScreenRecord] Recording saved to ${outputPath}`);
    });
}

/**
 * Start screen recording (Linux - ffmpeg)
 */
async function startRecordingLinux(outputPath: string, duration?: number): Promise<void> {
    const display = process.env.DISPLAY || ":0";
    const args = [
        "-f", "x11grab",
        "-video_size", "1920x1080",
        "-i", display,
        "-t", String(duration || 60),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        outputPath,
    ];

    currentRecording = spawn("ffmpeg", args, { stdio: "ignore" });
    recordingPath = outputPath;
    recordingStartTime = Date.now();

    currentRecording.on("close", () => {
        currentRecording = null;
        console.log(`[ScreenRecord] Recording saved to ${outputPath}`);
    });
}

/**
 * Stop current recording
 */
async function stopRecording(): Promise<string | null> {
    if (!currentRecording) {
        return null;
    }

    const savedPath = recordingPath;
    currentRecording.kill("SIGINT");

    // Wait for process to close
    await new Promise<void>(resolve => {
        if (currentRecording) {
            currentRecording.once("close", resolve);
        } else {
            resolve();
        }
    });

    currentRecording = null;
    recordingPath = null;
    recordingStartTime = null;

    return savedPath;
}

/**
 * Get recording status
 */
function getRecordingStatus(): { isRecording: boolean; path?: string; durationMs?: number } {
    if (!currentRecording || !recordingStartTime) {
        return { isRecording: false };
    }

    return {
        isRecording: true,
        path: recordingPath || undefined,
        durationMs: Date.now() - recordingStartTime,
    };
}

export const screenRecordTool: AgentTool<ScreenRecordParams> = {
    name: "screen_record",
    description: `Control screen recording. Actions:
- start: Start recording the screen (optional duration in seconds)
- stop: Stop current recording
- status: Check if recording is in progress`,
    category: "device",
    parameters: ScreenRecordToolSchema,

    async execute(params: ScreenRecordParams, _context: ToolCallContext): Promise<ToolResult> {
        try {
            const platform = os.platform();

            switch (params.action) {
                case "start": {
                    if (currentRecording) {
                        return {
                            success: false,
                            content: "",
                            error: "Recording already in progress",
                        };
                    }

                    const dir = getRecordingDir();
                    await fs.mkdir(dir, { recursive: true });

                    const filename = params.filename || `recording-${Date.now()}`;
                    const ext = platform === "darwin" ? "mov" : "mp4";
                    const outputPath = path.join(dir, `${filename}.${ext}`);

                    if (platform === "darwin") {
                        await startRecordingMacOS(outputPath, params.duration);
                    } else if (platform === "linux") {
                        await startRecordingLinux(outputPath, params.duration);
                    } else {
                        return {
                            success: false,
                            content: "",
                            error: `Screen recording not supported on ${platform}`,
                        };
                    }

                    return {
                        success: true,
                        content: `Recording started: ${outputPath}`,
                        metadata: { path: outputPath, duration: params.duration },
                    };
                }

                case "stop": {
                    const savedPath = await stopRecording();
                    if (!savedPath) {
                        return {
                            success: false,
                            content: "",
                            error: "No recording in progress",
                        };
                    }

                    return {
                        success: true,
                        content: `Recording stopped and saved to: ${savedPath}`,
                        metadata: { path: savedPath },
                    };
                }

                case "status": {
                    const status = getRecordingStatus();
                    if (status.isRecording) {
                        return {
                            success: true,
                            content: `Recording in progress: ${status.path} (${Math.round((status.durationMs || 0) / 1000)}s)`,
                            metadata: status,
                        };
                    }
                    return {
                        success: true,
                        content: "No recording in progress",
                        metadata: { isRecording: false },
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

export default screenRecordTool;
