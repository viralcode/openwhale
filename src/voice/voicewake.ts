/**
 * Voice Wake System
 * 
 * Always-on speech trigger detection.
 * Default triggers: "openwhale", "claude", "computer"
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

export type VoiceWakeConfig = {
    triggers: string[];
    enabled: boolean;
    updatedAtMs: number;
};

const DEFAULT_TRIGGERS = ["openwhale", "claude", "computer"];
const voiceEvents = new EventEmitter();
let currentConfig: VoiceWakeConfig = {
    triggers: [...DEFAULT_TRIGGERS],
    enabled: false,
    updatedAtMs: 0,
};

/**
 * Get config file path
 */
function getConfigPath(): string {
    const home = os.homedir();
    return path.join(home, ".openwhale", "settings", "voicewake.json");
}

/**
 * Read JSON file safely
 */
async function readJSON<T>(filePath: string): Promise<T | null> {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

/**
 * Write JSON file atomically
 */
async function writeJSONAtomic(filePath: string, value: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(tmp, filePath);
}

/**
 * Get default voice wake triggers
 */
export function getDefaultTriggers(): string[] {
    return [...DEFAULT_TRIGGERS];
}

/**
 * Load voice wake configuration
 */
export async function loadVoiceWakeConfig(): Promise<VoiceWakeConfig> {
    const filePath = getConfigPath();
    const existing = await readJSON<VoiceWakeConfig>(filePath);

    if (existing) {
        currentConfig = {
            triggers: Array.isArray(existing.triggers) && existing.triggers.length > 0
                ? existing.triggers.map(t => String(t).trim()).filter(Boolean)
                : [...DEFAULT_TRIGGERS],
            enabled: existing.enabled === true,
            updatedAtMs: typeof existing.updatedAtMs === "number" ? existing.updatedAtMs : 0,
        };
    }

    return { ...currentConfig };
}

/**
 * Save voice wake configuration
 */
export async function saveVoiceWakeConfig(config: Partial<VoiceWakeConfig>): Promise<VoiceWakeConfig> {
    currentConfig = {
        ...currentConfig,
        ...config,
        updatedAtMs: Date.now(),
    };

    // Sanitize triggers
    if (config.triggers) {
        currentConfig.triggers = config.triggers
            .map(t => String(t).trim().toLowerCase())
            .filter(t => t.length > 0);

        if (currentConfig.triggers.length === 0) {
            currentConfig.triggers = [...DEFAULT_TRIGGERS];
        }
    }

    await writeJSONAtomic(getConfigPath(), currentConfig);
    return { ...currentConfig };
}

/**
 * Set voice wake triggers
 */
export async function setVoiceWakeTriggers(triggers: string[]): Promise<VoiceWakeConfig> {
    return saveVoiceWakeConfig({ triggers });
}

/**
 * Enable/disable voice wake
 */
export async function setVoiceWakeEnabled(enabled: boolean): Promise<VoiceWakeConfig> {
    return saveVoiceWakeConfig({ enabled });
}

/**
 * Get current config
 */
export function getVoiceWakeConfig(): VoiceWakeConfig {
    return { ...currentConfig };
}

/**
 * Check if text contains a trigger word
 */
export function containsTrigger(text: string, triggers = currentConfig.triggers): boolean {
    const lowerText = text.toLowerCase();
    return triggers.some(trigger => lowerText.includes(trigger.toLowerCase()));
}

/**
 * Listen for voice wake events
 */
export function onVoiceWake(handler: (trigger: string, transcript: string) => void): () => void {
    voiceEvents.on("wake", handler);
    return () => voiceEvents.off("wake", handler);
}

/**
 * Emit voice wake event (called by speech recognition)
 */
export function emitVoiceWake(trigger: string, transcript: string): void {
    voiceEvents.emit("wake", trigger, transcript);
    console.log(`[VoiceWake] Triggered by "${trigger}": ${transcript}`);
}

/**
 * Simulate voice wake detection (for testing)
 */
export function simulateVoiceWake(transcript: string): string | null {
    if (!currentConfig.enabled) return null;

    for (const trigger of currentConfig.triggers) {
        if (transcript.toLowerCase().includes(trigger.toLowerCase())) {
            emitVoiceWake(trigger, transcript);
            return trigger;
        }
    }
    return null;
}

export default {
    getDefaultTriggers,
    loadVoiceWakeConfig,
    saveVoiceWakeConfig,
    setVoiceWakeTriggers,
    setVoiceWakeEnabled,
    getVoiceWakeConfig,
    containsTrigger,
    onVoiceWake,
    emitVoiceWake,
    simulateVoiceWake,
};
