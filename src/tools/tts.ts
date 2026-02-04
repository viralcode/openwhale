import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const TTSActionSchema = z.object({
    text: z.string().describe("Text to convert to speech"),
    voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("nova"),
    speed: z.number().min(0.25).max(4.0).optional().default(1.0),
});

type TTSAction = z.infer<typeof TTSActionSchema>;

export const ttsTool: AgentTool<TTSAction> = {
    name: "tts",
    description: "Convert text to speech audio using OpenAI's TTS API.",
    category: "utility",
    parameters: TTSActionSchema,

    async execute(params: TTSAction, _context: ToolCallContext): Promise<ToolResult> {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
            return {
                success: false,
                content: "",
                error: "OPENAI_API_KEY not configured for TTS",
            };
        }

        try {
            const response = await fetch("https://api.openai.com/v1/audio/speech", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "tts-1",
                    input: params.text,
                    voice: params.voice,
                    speed: params.speed,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, content: "", error: `TTS failed: ${error}` };
            }

            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");

            return {
                success: true,
                content: `Generated audio (${buffer.byteLength} bytes)`,
                metadata: {
                    audio: `data:audio/mpeg;base64,${base64}`,
                    voice: params.voice,
                    textLength: params.text.length,
                },
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: message };
        }
    },
};
