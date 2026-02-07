/**
 * OpenWhale Session Manager
 * 
 * High-level session orchestration for all channels.
 * Handles session resolution, slash commands, and history loading.
 */

import {
    getOrCreateSession,
    updateSession,
    resetSession,
    buildSessionKey,
    getSession,
    getAllSessions,
    type SessionEntry,
} from "./session-store.js";
import {
    loadConversationHistory,
    appendMessage,
    appendToolUse,
    appendToolResult,
    clearTranscript,
    getTranscriptStats,
} from "./transcript.js";
import {
    readMemory,
    readDailyMemory,
    appendDailyMemory,
    getMemoryContext,
} from "../memory/memory-files.js";

// Re-export for convenience
export {
    buildSessionKey,
    getSession,
    getAllSessions,
    getTranscriptStats,
    type SessionEntry,
};

/**
 * Channel types for session key generation
 */
export type ChannelType = "whatsapp" | "telegram" | "discord" | "slack" | "web" | "dashboard" | "cli" | "twitter" | "imessage";

/**
 * Session context passed to AI handlers
 */
export interface SessionContext {
    session: SessionEntry;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    isNewSession: boolean;
}

/**
 * Check if message is a slash command
 */
export function isSlashCommand(text: string): boolean {
    return text.startsWith("/") && !text.startsWith("/ ");
}

/**
 * Parse slash command from message
 */
export function parseSlashCommand(text: string): { command: string; args: string } | null {
    if (!isSlashCommand(text)) return null;

    const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
    if (!match) return null;

    return {
        command: match[1].toLowerCase(),
        args: match[2]?.trim() || "",
    };
}

/**
 * Get or create session and load conversation history
 */
export function getSessionContext(
    channel: ChannelType,
    chatType: "dm" | "group",
    userId: string,
    displayName?: string,
    maxHistoryTurns: number = 20
): SessionContext {
    const sessionKey = buildSessionKey(channel, chatType, userId);
    const existingSession = getSession(sessionKey);
    const session = getOrCreateSession(sessionKey, channel, userId, displayName);
    const isNewSession = !existingSession || existingSession.sessionId !== session.sessionId;

    // Load conversation history
    const history = loadConversationHistory(session.sessionId, maxHistoryTurns);

    if (isNewSession) {
        console.log(`[Sessions] New session started for ${channel}:${userId}`);
    } else {
        console.log(`[Sessions] Resumed session ${session.sessionId} with ${history.length} messages`);
    }

    return { session, history, isNewSession };
}

/**
 * Handle slash command, returns response message or null if not a command
 */
export function handleSlashCommand(
    text: string,
    session: SessionEntry
): { handled: boolean; response?: string; newSession?: SessionEntry } {
    const parsed = parseSlashCommand(text);
    if (!parsed) return { handled: false };

    switch (parsed.command) {
        case "reset":
        case "new": {
            const newSession = resetSession(session.sessionKey);
            if (newSession) {
                clearTranscript(session.sessionId);
                return {
                    handled: true,
                    response: "🔄 Session reset! Starting fresh.",
                    newSession,
                };
            }
            return { handled: true, response: "❌ Failed to reset session." };
        }

        case "status": {
            const stats = getTranscriptStats(session.sessionId);
            const created = new Date(session.createdAt).toLocaleString();
            const updated = new Date(session.updatedAt).toLocaleString();

            return {
                handled: true,
                response: [
                    "📊 **Session Status**",
                    `• Session ID: \`${session.sessionId}\``,
                    `• Channel: ${session.channel}`,
                    `• Messages: ${stats.messageCount} (${stats.userMessages} user, ${stats.assistantMessages} assistant)`,
                    `• Tool calls: ${stats.toolCalls}`,
                    `• Created: ${created}`,
                    `• Last update: ${updated}`,
                ].join("\n"),
            };
        }

        case "history": {
            const history = loadConversationHistory(session.sessionId, 5);
            if (history.length === 0) {
                return { handled: true, response: "📜 No conversation history." };
            }

            const formatted = history.map(m =>
                `**${m.role === "user" ? "You" : "AI"}**: ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`
            ).join("\n\n");

            return {
                handled: true,
                response: `📜 **Recent History** (last 5 turns)\n\n${formatted}`,
            };
        }

        case "help": {
            return {
                handled: true,
                response: [
                    "🐋 **OpenWhale Commands**",
                    "",
                    "`/reset` or `/new` - Start fresh session",
                    "`/status` - Show session info",
                    "`/history` - Show recent messages",
                    "`/memory` - Show memory files content",
                    "`/help` - Show this help",
                ].join("\n"),
            };
        }

        case "memory": {
            const memoryContent = readMemory();
            const dailyContent = readDailyMemory();

            const parts: string[] = ["📝 **Memory Files**"];

            if (memoryContent.trim()) {
                parts.push("");
                parts.push("**MEMORY.md (Long-Term):**");
                // Show first 500 chars
                const preview = memoryContent.slice(0, 500);
                parts.push(preview + (memoryContent.length > 500 ? "..." : ""));
            } else {
                parts.push("");
                parts.push("*No long-term memory saved yet.*");
            }

            if (dailyContent.trim()) {
                parts.push("");
                parts.push("**Today's Notes:**");
                const preview = dailyContent.slice(0, 300);
                parts.push(preview + (dailyContent.length > 300 ? "..." : ""));
            }

            parts.push("");
            parts.push("💡 Ask me to 'remember that...' or 'add to memory' to save info.");

            return { handled: true, response: parts.join("\n") };
        }

        default:
            return { handled: false };
    }
}

/**
 * Record user message to transcript
 */
export function recordUserMessage(sessionId: string, content: string): void {
    appendMessage(sessionId, "user", content);
}

/**
 * Record assistant message to transcript
 */
export function recordAssistantMessage(sessionId: string, content: string): void {
    appendMessage(sessionId, "assistant", content);
}

/**
 * Record tool use to transcript
 */
export function recordToolUse(sessionId: string, name: string, args: Record<string, unknown>): void {
    appendToolUse(sessionId, name, args);
}

/**
 * Record tool result to transcript
 */
export function recordToolResult(sessionId: string, name: string, result: string, success: boolean): void {
    appendToolResult(sessionId, name, result, success);
}

/**
 * Update session after exchange
 */
export function finalizeExchange(
    sessionKey: string,
    inputTokens: number = 0,
    outputTokens: number = 0
): void {
    updateSession(sessionKey, inputTokens, outputTokens);
}

/**
 * Pre-compaction flush - saves conversation summary to daily memory before reset
 * Call this before resetting a session to preserve context
 */
export function preCompactionFlush(
    sessionId: string,
    summary?: string
): void {
    const stats = getTranscriptStats(sessionId);

    // Only flush if there's actual content
    if (stats.messageCount < 2) {
        console.log(`[Sessions] Skipping flush - too few messages (${stats.messageCount})`);
        return;
    }

    // Generate a default summary if not provided
    const flushSummary = summary || `Session ended with ${stats.messageCount} messages (${stats.userMessages} user, ${stats.assistantMessages} assistant), ${stats.toolCalls} tool calls.`;

    // Append to daily memory
    const entry = `### Session Summary\n${flushSummary}`;
    appendDailyMemory(entry);

    console.log(`[Sessions] Flushed session ${sessionId} summary to daily memory`);
}

/**
 * Get full memory context for AI system prompt
 */
export function getFullMemoryContext(): string {
    return getMemoryContext();
}
