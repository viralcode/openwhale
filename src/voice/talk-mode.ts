/**
 * Talk Mode - Continuous Voice Conversation
 * 
 * Always-on speech with ElevenLabs TTS and speech recognition.
 */

import { EventEmitter } from "node:events";

export interface TalkModeConfig {
    enabled: boolean;
    voiceId: string;
    model: string;
    autoListen: boolean;
    pushToTalk: boolean;
}

export interface TalkModeState {
    isListening: boolean;
    isSpeaking: boolean;
    lastTranscript: string;
    lastResponse: string;
}

const DEFAULT_CONFIG: TalkModeConfig = {
    enabled: false,
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel - ElevenLabs default
    model: "eleven_monolingual_v1",
    autoListen: true,
    pushToTalk: false,
};

const talkEvents = new EventEmitter();
let config: TalkModeConfig = { ...DEFAULT_CONFIG };
let state: TalkModeState = {
    isListening: false,
    isSpeaking: false,
    lastTranscript: "",
    lastResponse: "",
};

/**
 * Get current talk mode config
 */
export function getTalkModeConfig(): TalkModeConfig {
    return { ...config };
}

/**
 * Update talk mode config
 */
export function setTalkModeConfig(updates: Partial<TalkModeConfig>): TalkModeConfig {
    config = { ...config, ...updates };
    talkEvents.emit("configChanged", config);
    return { ...config };
}

/**
 * Get current state
 */
export function getTalkModeState(): TalkModeState {
    return { ...state };
}

/**
 * Enable talk mode
 */
export function enableTalkMode(): void {
    config.enabled = true;
    talkEvents.emit("enabled");
    console.log("[TalkMode] Enabled");
}

/**
 * Disable talk mode
 */
export function disableTalkMode(): void {
    config.enabled = false;
    state.isListening = false;
    state.isSpeaking = false;
    talkEvents.emit("disabled");
    console.log("[TalkMode] Disabled");
}

/**
 * Start listening
 */
export function startListening(): void {
    if (!config.enabled) return;
    state.isListening = true;
    talkEvents.emit("listeningStarted");
    console.log("[TalkMode] Listening...");
}

/**
 * Stop listening
 */
export function stopListening(): void {
    state.isListening = false;
    talkEvents.emit("listeningStopped");
}

/**
 * Process speech transcript
 */
export function processTranscript(transcript: string): void {
    state.lastTranscript = transcript;
    state.isListening = false;
    talkEvents.emit("transcript", transcript);
    console.log(`[TalkMode] Transcript: ${transcript}`);
}

/**
 * Speak response using TTS
 */
export async function speak(text: string, apiKey?: string): Promise<void> {
    if (!config.enabled) return;

    state.isSpeaking = true;
    state.lastResponse = text;
    talkEvents.emit("speakingStarted", text);

    if (apiKey) {
        try {
            // ElevenLabs TTS API
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "xi-api-key": apiKey,
                    },
                    body: JSON.stringify({
                        text,
                        model_id: config.model,
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                        },
                    }),
                }
            );

            if (response.ok) {
                const audioBuffer = await response.arrayBuffer();
                talkEvents.emit("audioReady", audioBuffer);
                console.log(`[TalkMode] Speaking: ${text.slice(0, 50)}...`);
            } else {
                console.error("[TalkMode] TTS failed:", await response.text());
            }
        } catch (err) {
            console.error("[TalkMode] TTS error:", err);
        }
    } else {
        // Fallback: emit text for browser TTS
        talkEvents.emit("speakText", text);
    }

    state.isSpeaking = false;
    talkEvents.emit("speakingEnded");

    // Auto-listen after speaking
    if (config.autoListen && !config.pushToTalk) {
        startListening();
    }
}

/**
 * Listen for talk mode events
 */
export function onTalkEvent(
    event: "enabled" | "disabled" | "listeningStarted" | "listeningStopped" |
        "transcript" | "speakingStarted" | "speakingEnded" | "audioReady" | "speakText",
    handler: (...args: unknown[]) => void
): () => void {
    talkEvents.on(event, handler);
    return () => talkEvents.off(event, handler);
}

/**
 * Get ElevenLabs voices (requires API key)
 */
export async function getVoices(apiKey: string): Promise<Array<{ voice_id: string; name: string }>> {
    try {
        const response = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: { "xi-api-key": apiKey },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status}`);
        }

        const data = await response.json() as { voices: Array<{ voice_id: string; name: string }> };
        return data.voices || [];
    } catch (err) {
        console.error("[TalkMode] Failed to fetch voices:", err);
        return [];
    }
}

export default {
    getTalkModeConfig,
    setTalkModeConfig,
    getTalkModeState,
    enableTalkMode,
    disableTalkMode,
    startListening,
    stopListening,
    processTranscript,
    speak,
    onTalkEvent,
    getVoices,
};
