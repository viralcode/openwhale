/**
 * OpenWhale Context Compaction
 * 
 * When conversation history grows too long, this module summarizes
 * older messages into a compact context block. This prevents token
 * limit issues during long multi-step tasks.
 * 
 * Inspired by OpenClaw's compaction/pruning system.
 */

import { registry } from "../providers/index.js";
import { appendMessage } from "./transcript.js";

// ============== TYPES ==============

interface CompactionResult {
    compacted: boolean;
    originalCount: number;
    newCount: number;
    summary?: string;
}

// ============== CONFIG ==============

const COMPACTION_THRESHOLD = 30;    // Compact when history exceeds this many messages
const KEEP_RECENT = 10;             // Keep the most recent N messages uncompacted
const SUMMARY_MAX_TOKENS = 500;     // Max tokens for the compaction summary

// ============== COMPACTION ==============

/**
 * Check if compaction is needed and perform it if so.
 * Mutates the msgHistory array in place.
 */
export async function compactIfNeeded(
    msgHistory: Array<{ role: string; content: string;[key: string]: unknown }>,
    model: string,
    sessionId?: string,
): Promise<CompactionResult> {
    if (msgHistory.length <= COMPACTION_THRESHOLD) {
        return { compacted: false, originalCount: msgHistory.length, newCount: msgHistory.length };
    }

    const originalCount = msgHistory.length;
    const toSummarize = msgHistory.slice(0, msgHistory.length - KEEP_RECENT);
    const toKeep = msgHistory.slice(msgHistory.length - KEEP_RECENT);

    console.log(`[Compaction] Compacting ${toSummarize.length} messages, keeping ${toKeep.length} recent`);

    try {
        // Build a summary of the older messages
        const summaryPrompt = toSummarize
            .map(m => `${m.role}: ${m.content.slice(0, 500)}`)
            .join("\n");

        const summaryResponse = await registry.complete({
            model,
            messages: [
                {
                    role: "user",
                    content: `Summarize this conversation history in a concise paragraph. Focus on key decisions, tool results, and context needed to continue the conversation:\n\n${summaryPrompt}`,
                },
            ],
            systemPrompt: "You are a conversation summarizer. Produce a concise summary that preserves key context, decisions made, tool results, and any important data. Be factual and brief.",
            maxTokens: SUMMARY_MAX_TOKENS,
            stream: false,
        });

        const summary = summaryResponse.content || "Previous conversation context was compacted.";

        // Record the compaction to transcript
        if (sessionId) {
            appendMessage(sessionId, "system", `[Compaction] ${summary}`);
        }

        // Replace the msgHistory in place
        msgHistory.length = 0;
        msgHistory.push({
            role: "assistant",
            content: `[Previous conversation summary]\n${summary}`,
        });
        for (const msg of toKeep) {
            msgHistory.push(msg);
        }

        console.log(`[Compaction] ✅ Compacted ${originalCount} → ${msgHistory.length} messages`);

        return {
            compacted: true,
            originalCount,
            newCount: msgHistory.length,
            summary,
        };
    } catch (err) {
        console.warn(`[Compaction] Failed to compact:`, err);

        // Fallback: just trim without AI summary
        const fallbackSummary = `[Earlier conversation with ${toSummarize.length} messages was truncated to save context]`;
        msgHistory.length = 0;
        msgHistory.push({
            role: "assistant",
            content: fallbackSummary,
        });
        for (const msg of toKeep) {
            msgHistory.push(msg);
        }

        return {
            compacted: true,
            originalCount,
            newCount: msgHistory.length,
            summary: fallbackSummary,
        };
    }
}
