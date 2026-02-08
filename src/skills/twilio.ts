/**
 * Twilio Skill - SMS, WhatsApp messaging, and AI-powered voice calls
 * Supports coupling with ElevenLabs for high-quality agent voice calls
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/** Helper: make authenticated Twilio API request */
async function twilioRequest(
    path: string,
    body: Record<string, string>
): Promise<{ ok: boolean; data?: any; error?: string }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
        return { ok: false, error: "Twilio credentials not configured. Add them in Dashboard → Skills." };
    }

    const formBody = Object.entries(body)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");

    const response = await fetch(`${TWILIO_API}/Accounts/${sid}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        },
        body: formBody,
    });

    const data: any = await response.json();
    if (!response.ok) {
        return { ok: false, error: `Twilio error (${response.status}): ${data.message || JSON.stringify(data)}` };
    }
    return { ok: true, data };
}

/** Helper: Generate ElevenLabs TTS audio and get a base64 data URI */
async function generateElevenLabsAudio(text: string): Promise<{ ok: boolean; audioBase64?: string; error?: string }> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return { ok: false, error: "ELEVENLABS_API_KEY not configured" };
    }

    // Use ulaw_8000 format — optimal for Twilio phone calls
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel
    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=ulaw_8000`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "xi-api-key": apiKey,
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        return { ok: false, error: `ElevenLabs error: ${errText}` };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { ok: true, audioBase64: base64 };
}

const tools: SkillTool[] = [
    // ─── SMS ───
    {
        name: "twilio_send_sms",
        description:
            "Send an SMS text message to a phone number via Twilio. Phone numbers must be in E.164 format (e.g. +15551234567).",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Recipient phone number in E.164 format (e.g. +15551234567)",
                },
                body: {
                    type: "string",
                    description: "The message text to send",
                },
            },
            required: ["to", "body"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const fromNumber = process.env.TWILIO_FROM_NUMBER;
                if (!fromNumber) {
                    return { success: false, content: "", error: "TWILIO_FROM_NUMBER not configured" };
                }

                const result = await twilioRequest("/Messages.json", {
                    To: args.to as string,
                    From: fromNumber,
                    Body: args.body as string,
                });

                if (!result.ok) return { success: false, content: "", error: result.error! };

                return {
                    success: true,
                    content: `📱 SMS sent to ${args.to}: "${(args.body as string).substring(0, 80)}${(args.body as string).length > 80 ? "..." : ""}"`,
                    metadata: {
                        sid: result.data.sid,
                        status: result.data.status,
                        to: args.to,
                    },
                };
            } catch (err) {
                return { success: false, content: "", error: `SMS error: ${String(err)}` };
            }
        },
    },

    // ─── WhatsApp ───
    {
        name: "twilio_send_whatsapp",
        description:
            "Send a WhatsApp message to a phone number via Twilio. Phone numbers must be in E.164 format.",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Recipient phone number in E.164 format (e.g. +15551234567)",
                },
                body: {
                    type: "string",
                    description: "The message text to send",
                },
            },
            required: ["to", "body"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const fromNumber = process.env.TWILIO_FROM_NUMBER;
                if (!fromNumber) {
                    return { success: false, content: "", error: "TWILIO_FROM_NUMBER not configured" };
                }

                const result = await twilioRequest("/Messages.json", {
                    To: `whatsapp:${args.to as string}`,
                    From: `whatsapp:${fromNumber}`,
                    Body: args.body as string,
                });

                if (!result.ok) return { success: false, content: "", error: result.error! };

                return {
                    success: true,
                    content: `💬 WhatsApp message sent to ${args.to}`,
                    metadata: {
                        sid: result.data.sid,
                        status: result.data.status,
                        to: args.to,
                    },
                };
            } catch (err) {
                return { success: false, content: "", error: `WhatsApp error: ${String(err)}` };
            }
        },
    },

    // ─── Voice Call (basic Twilio TTS) ───
    {
        name: "twilio_make_call",
        description:
            "Make a phone call via Twilio that speaks a message. Uses Twilio's built-in text-to-speech. For higher-quality voice, use twilio_agent_call which uses ElevenLabs.",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Recipient phone number in E.164 format",
                },
                message: {
                    type: "string",
                    description: "The text message that will be spoken during the call",
                },
                voice: {
                    type: "string",
                    description: "Twilio voice to use: alice, man, woman, Polly.Joanna, etc. Default: Polly.Joanna",
                },
            },
            required: ["to", "message"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const fromNumber = process.env.TWILIO_FROM_NUMBER;
                if (!fromNumber) {
                    return { success: false, content: "", error: "TWILIO_FROM_NUMBER not configured" };
                }

                const voice = (args.voice as string) || "Polly.Joanna";
                const message = args.message as string;
                const twiml = `<Response><Say voice="${voice}">${escapeXml(message)}</Say></Response>`;

                const result = await twilioRequest("/Calls.json", {
                    To: args.to as string,
                    From: fromNumber,
                    Twiml: twiml,
                });

                if (!result.ok) return { success: false, content: "", error: result.error! };

                return {
                    success: true,
                    content: `📞 Call initiated to ${args.to} — speaking message with ${voice} voice`,
                    metadata: {
                        callSid: result.data.sid,
                        status: result.data.status,
                        to: args.to,
                    },
                };
            } catch (err) {
                return { success: false, content: "", error: `Call error: ${String(err)}` };
            }
        },
    },

    // ─── Agent Call (Twilio + ElevenLabs coupled) ───
    {
        name: "twilio_agent_call",
        description:
            "Make a phone call where the AI agent speaks using a high-quality ElevenLabs voice. This couples Twilio calling with ElevenLabs TTS for premium voice quality. The message is first converted to speech via ElevenLabs, then played through a Twilio call.",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Recipient phone number in E.164 format (e.g. +15551234567)",
                },
                message: {
                    type: "string",
                    description: "The text message the AI agent will speak during the call using ElevenLabs voice",
                },
                pause_before: {
                    type: "number",
                    description: "Seconds to wait after call connects before speaking. Default: 1",
                },
            },
            required: ["to", "message"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const fromNumber = process.env.TWILIO_FROM_NUMBER;
                if (!fromNumber) {
                    return { success: false, content: "", error: "TWILIO_FROM_NUMBER not configured" };
                }

                const message = args.message as string;
                const pauseBefore = (args.pause_before as number) ?? 1;

                // Step 1: Generate high-quality audio with ElevenLabs
                console.log("[Twilio+ElevenLabs] Generating speech for agent call...");
                const audioResult = await generateElevenLabsAudio(message);
                if (!audioResult.ok) {
                    return {
                        success: false,
                        content: "",
                        error: `Failed to generate speech: ${audioResult.error}`,
                    };
                }

                // Step 2: Place the call with inline audio via TwiML
                // Twilio supports <Play> with a base64 audio data URI for ulaw format
                const twiml = [
                    "<Response>",
                    pauseBefore > 0 ? `<Pause length="${pauseBefore}"/>` : "",
                    `<Play>data:audio/basic;base64,${audioResult.audioBase64}</Play>`,
                    "<Pause length=\"2\"/>",
                    "</Response>",
                ].join("");

                const result = await twilioRequest("/Calls.json", {
                    To: args.to as string,
                    From: fromNumber,
                    Twiml: twiml,
                });

                if (!result.ok) {
                    // Fallback: if inline audio fails, use Twilio's built-in TTS
                    console.log("[Twilio+ElevenLabs] Inline audio failed, falling back to Twilio Say...");
                    const fallbackTwiml = `<Response><Pause length="${pauseBefore}"/><Say voice="Polly.Joanna">${escapeXml(message)}</Say></Response>`;
                    const fallbackResult = await twilioRequest("/Calls.json", {
                        To: args.to as string,
                        From: fromNumber,
                        Twiml: fallbackTwiml,
                    });

                    if (!fallbackResult.ok) return { success: false, content: "", error: fallbackResult.error! };

                    return {
                        success: true,
                        content: `📞 Agent call initiated to ${args.to} (using Twilio voice fallback)`,
                        metadata: {
                            callSid: fallbackResult.data.sid,
                            status: fallbackResult.data.status,
                            to: args.to,
                            voiceProvider: "twilio-fallback",
                        },
                    };
                }

                return {
                    success: true,
                    content: `📞 Agent call initiated to ${args.to} with ElevenLabs voice — speaking: "${message.substring(0, 80)}${message.length > 80 ? "..." : ""}"`,
                    metadata: {
                        callSid: result.data.sid,
                        status: result.data.status,
                        to: args.to,
                        voiceProvider: "elevenlabs",
                        messageLength: message.length,
                    },
                };
            } catch (err) {
                return { success: false, content: "", error: `Agent call error: ${String(err)}` };
            }
        },
    },
];

/** Escape XML special characters for TwiML */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export const twilioSkill: Skill = createSkill(
    {
        name: "twilio",
        description: "Send SMS, WhatsApp messages, and make AI-powered voice calls via Twilio",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "TWILIO_ACCOUNT_SID",
    },
    tools,
    () => !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN
);
