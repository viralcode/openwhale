/**
 * OpenWhale Transcript Manager
 * 
 * Handles reading and writing conversation transcripts in JSONL format.
 * Each session has its own transcript file that persists across restarts.
 * 
 * Based on OpenClaw's transcript format.
 */

import { appendFileSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { getTranscriptPath } from "./session-store.js";

/**
 * Message entry in transcript
 */
export interface TranscriptMessage {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: string;
}

/**
 * Tool use entry in transcript
 */
export interface TranscriptToolUse {
    name: string;
    args: Record<string, unknown>;
    timestamp?: string;
}

/**
 * Tool result entry in transcript
 */
export interface TranscriptToolResult {
    name: string;
    result: string;
    success: boolean;
    timestamp?: string;
}

/**
 * Transcript entry (line in JSONL file)
 */
export type TranscriptEntry =
    | { type: "message"; message: TranscriptMessage }
    | { type: "tool_use"; tool: TranscriptToolUse }
    | { type: "tool_result"; result: TranscriptToolResult }
    | { type: "compaction"; summary: string; timestamp: string };

/**
 * Append a message to the transcript
 */
export function appendMessage(
    sessionId: string,
    role: "user" | "assistant" | "system",
    content: string
): void {
    const path = getTranscriptPath(sessionId);
    const entry: TranscriptEntry = {
        type: "message",
        message: {
            role,
            content,
            timestamp: new Date().toISOString(),
        },
    };

    try {
        appendFileSync(path, JSON.stringify(entry) + "\n");
    } catch (err) {
        console.error(`[Transcript] Failed to append message to ${sessionId}:`, err);
    }
}

/**
 * Append a tool use to the transcript
 */
export function appendToolUse(
    sessionId: string,
    name: string,
    args: Record<string, unknown>
): void {
    const path = getTranscriptPath(sessionId);
    const entry: TranscriptEntry = {
        type: "tool_use",
        tool: {
            name,
            args,
            timestamp: new Date().toISOString(),
        },
    };

    try {
        appendFileSync(path, JSON.stringify(entry) + "\n");
    } catch (err) {
        console.error(`[Transcript] Failed to append tool use to ${sessionId}:`, err);
    }
}

/**
 * Append a tool result to the transcript
 */
export function appendToolResult(
    sessionId: string,
    name: string,
    result: string,
    success: boolean
): void {
    const path = getTranscriptPath(sessionId);
    const entry: TranscriptEntry = {
        type: "tool_result",
        result: {
            name,
            result,
            success,
            timestamp: new Date().toISOString(),
        },
    };

    try {
        appendFileSync(path, JSON.stringify(entry) + "\n");
    } catch (err) {
        console.error(`[Transcript] Failed to append tool result to ${sessionId}:`, err);
    }
}

/**
 * Load conversation history from transcript
 * Returns messages in the format needed for AI provider
 */
export function loadConversationHistory(
    sessionId: string,
    maxTurns: number = 20
): Array<{ role: "user" | "assistant"; content: string }> {
    const path = getTranscriptPath(sessionId);

    if (!existsSync(path)) {
        return [];
    }

    try {
        const content = readFileSync(path, "utf-8");
        const lines = content.split("\n").filter(line => line.trim());

        // Parse all message entries
        const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

        for (const line of lines) {
            try {
                const entry = JSON.parse(line) as TranscriptEntry;

                if (entry.type === "message") {
                    const { role, content } = entry.message;
                    // Filter out empty messages to prevent Claude API errors
                    if ((role === "user" || role === "assistant") && content && content.trim().length > 0) {
                        messages.push({ role, content });
                    }
                }
            } catch {
                // Skip malformed lines
            }
        }

        // Limit to last N turns (user + assistant pairs)
        // Count user messages to determine turns
        let userCount = 0;
        let startIndex = 0;

        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
                userCount++;
                if (userCount > maxTurns) {
                    startIndex = i + 1;
                    break;
                }
            }
        }

        return messages.slice(startIndex);
    } catch (err) {
        console.error(`[Transcript] Failed to load history for ${sessionId}:`, err);
        return [];
    }
}

/**
 * Get raw transcript entries
 */
export function loadTranscriptEntries(sessionId: string): TranscriptEntry[] {
    const path = getTranscriptPath(sessionId);

    if (!existsSync(path)) {
        return [];
    }

    try {
        const content = readFileSync(path, "utf-8");
        const lines = content.split("\n").filter(line => line.trim());

        return lines.map(line => {
            try {
                return JSON.parse(line) as TranscriptEntry;
            } catch {
                return null;
            }
        }).filter((entry): entry is TranscriptEntry => entry !== null);
    } catch (err) {
        console.error(`[Transcript] Failed to load entries for ${sessionId}:`, err);
        return [];
    }
}

/**
 * Clear transcript (for session reset)
 */
export function clearTranscript(sessionId: string): void {
    const path = getTranscriptPath(sessionId);

    try {
        if (existsSync(path)) {
            writeFileSync(path, "");
            console.log(`[Transcript] Cleared transcript for ${sessionId}`);
        }
    } catch (err) {
        console.error(`[Transcript] Failed to clear transcript for ${sessionId}:`, err);
    }
}

/**
 * Get transcript stats
 */
export function getTranscriptStats(sessionId: string): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
} {
    const entries = loadTranscriptEntries(sessionId);

    let userMessages = 0;
    let assistantMessages = 0;
    let toolCalls = 0;

    for (const entry of entries) {
        if (entry.type === "message") {
            if (entry.message.role === "user") userMessages++;
            if (entry.message.role === "assistant") assistantMessages++;
        } else if (entry.type === "tool_use") {
            toolCalls++;
        }
    }

    return {
        messageCount: userMessages + assistantMessages,
        userMessages,
        assistantMessages,
        toolCalls,
    };
}
