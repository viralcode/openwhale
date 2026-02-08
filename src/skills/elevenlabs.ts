/**
 * ElevenLabs Skill - Text-to-Speech and voice management
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

// Popular default voices
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const DEFAULT_MODEL = "eleven_multilingual_v2";

const tools: SkillTool[] = [
    {
        name: "elevenlabs_tts",
        description:
            "Convert text to high-quality speech audio using ElevenLabs. Returns audio that plays in the chat. Use this when the user wants you to speak, read aloud, or generate audio.",
        parameters: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The text to convert to speech",
                },
                voice_id: {
                    type: "string",
                    description:
                        "Voice ID to use. Defaults to Rachel. Use elevenlabs_voices to list available voices.",
                },
                model_id: {
                    type: "string",
                    description:
                        "Model ID. Defaults to eleven_multilingual_v2. Options: eleven_monolingual_v1, eleven_multilingual_v2, eleven_turbo_v2_5",
                },
                stability: {
                    type: "number",
                    description: "Voice stability (0-1). Higher = more consistent. Default: 0.5",
                },
                similarity_boost: {
                    type: "number",
                    description: "Similarity boost (0-1). Higher = closer to original voice. Default: 0.75",
                },
            },
            required: ["text"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const apiKey = process.env.ELEVENLABS_API_KEY;
                if (!apiKey)
                    return {
                        success: false,
                        content: "",
                        error: "ELEVENLABS_API_KEY not configured. Add it in Dashboard → Skills.",
                    };

                const text = args.text as string;
                const voiceId = (args.voice_id as string) || DEFAULT_VOICE_ID;
                const modelId = (args.model_id as string) || DEFAULT_MODEL;
                const stability = (args.stability as number) ?? 0.5;
                const similarityBoost = (args.similarity_boost as number) ?? 0.75;

                const response = await fetch(
                    `${ELEVENLABS_API}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "xi-api-key": apiKey,
                        },
                        body: JSON.stringify({
                            text,
                            model_id: modelId,
                            voice_settings: {
                                stability,
                                similarity_boost: similarityBoost,
                            },
                        }),
                    }
                );

                if (!response.ok) {
                    const errText = await response.text();
                    return {
                        success: false,
                        content: "",
                        error: `ElevenLabs API error (${response.status}): ${errText}`,
                    };
                }

                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString("base64");

                return {
                    success: true,
                    content: `🔊 Generated speech (${(buffer.byteLength / 1024).toFixed(1)} KB) using ElevenLabs`,
                    metadata: {
                        audio: `data:audio/mpeg;base64,${base64}`,
                        voice: voiceId,
                        textLength: text.length,
                        provider: "elevenlabs",
                    },
                };
            } catch (err) {
                return { success: false, content: "", error: `ElevenLabs TTS error: ${String(err)}` };
            }
        },
    },
    {
        name: "elevenlabs_voices",
        description: "List all available ElevenLabs voices with their IDs, names, and preview URLs",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
        execute: async (): Promise<ToolResult> => {
            try {
                const apiKey = process.env.ELEVENLABS_API_KEY;
                if (!apiKey)
                    return {
                        success: false,
                        content: "",
                        error: "ELEVENLABS_API_KEY not configured",
                    };

                const response = await fetch(`${ELEVENLABS_API}/voices`, {
                    headers: { "xi-api-key": apiKey },
                });

                if (!response.ok) {
                    return {
                        success: false,
                        content: "",
                        error: `ElevenLabs API error: ${response.status}`,
                    };
                }

                const data = (await response.json()) as {
                    voices: Array<{
                        voice_id: string;
                        name: string;
                        category: string;
                        labels?: Record<string, string>;
                        preview_url?: string;
                    }>;
                };

                const voiceList = data.voices
                    .map((v) => {
                        const labels = v.labels
                            ? Object.values(v.labels).join(", ")
                            : "";
                        return `- **${v.name}** (ID: \`${v.voice_id}\`) — ${v.category}${labels ? ` [${labels}]` : ""}`;
                    })
                    .join("\n");

                return {
                    success: true,
                    content: `🎙️ **Available ElevenLabs Voices** (${data.voices.length}):\n\n${voiceList}`,
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const elevenlabsSkill: Skill = createSkill(
    {
        name: "elevenlabs",
        description: "High-quality text-to-speech with ElevenLabs voices",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "ELEVENLABS_API_KEY",
    },
    tools,
    () => !!process.env.ELEVENLABS_API_KEY
);
