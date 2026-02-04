/**
 * Session Management - Persistent User Sessions with JSONL Transcripts
 * 
 * This module provides OpenClaw-style session persistence for all channels.
 * Sessions are stored in ~/.openwhale/sessions/ with JSONL transcripts.
 */

// Re-export new persistent session management
export * from "./session-store.js";
export * from "./transcript.js";
export * from "./session-manager.js";

// Legacy compatibility exports (for existing code)
export interface Session {
    id: string;
    userId: string;
    channel: string;
    startedAt: Date;
    lastActivityAt: Date;
    messageCount: number;
    tokenCount: number;
    metadata?: Record<string, unknown>;
}

export interface SessionMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp: Date;
    tokenCount?: number;
}

// Legacy in-memory session storage (kept for backward compatibility)
const sessions = new Map<string, Session>();
const sessionMessages = new Map<string, SessionMessage[]>();

/**
 * Create or get a session for a user (legacy API - now wraps persistent sessions)
 */
export function getOrCreateSessionLegacy(userId: string, channel: string): Session {
    const existingId = `${channel}_${userId}`;

    let session = sessions.get(existingId);

    if (!session) {
        session = {
            id: existingId,
            userId,
            channel,
            startedAt: new Date(),
            lastActivityAt: new Date(),
            messageCount: 0,
            tokenCount: 0,
        };
        sessions.set(existingId, session);
        sessionMessages.set(existingId, []);
        console.log(`[Sessions] Created in-memory: ${existingId}`);
    }

    return session;
}

/**
 * Add a message to session history (legacy)
 */
export function addMessage(
    sessionId: string,
    role: SessionMessage["role"],
    content: string,
    tokenCount?: number
): void {
    const session = sessions.get(sessionId);
    const messages = sessionMessages.get(sessionId);

    if (!session || !messages) {
        console.warn(`[Sessions] Session not found: ${sessionId}`);
        return;
    }

    messages.push({
        role,
        content,
        timestamp: new Date(),
        tokenCount,
    });

    session.messageCount++;
    session.tokenCount += tokenCount || 0;
    session.lastActivityAt = new Date();
}

/**
 * Get message history for a session (legacy)
 */
export function getMessages(sessionId: string, limit?: number): SessionMessage[] {
    const messages = sessionMessages.get(sessionId) || [];

    if (limit) {
        return messages.slice(-limit);
    }

    return [...messages];
}

/**
 * Clear session history (legacy)
 */
export function clearSession(sessionId: string): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;

    sessionMessages.set(sessionId, []);
    session.messageCount = 0;
    session.tokenCount = 0;
    session.startedAt = new Date();

    return true;
}

/**
 * Close a session completely (legacy)
 */
export function closeSession(sessionId: string): boolean {
    sessions.delete(sessionId);
    sessionMessages.delete(sessionId);
    return true;
}

/**
 * List active sessions (legacy)
 */
export function listActiveSessions(maxAgeMinutes?: number): Session[] {
    const cutoff = maxAgeMinutes
        ? new Date(Date.now() - maxAgeMinutes * 60 * 1000)
        : new Date(0);

    return Array.from(sessions.values()).filter(
        s => s.lastActivityAt > cutoff
    );
}

/**
 * Update session metadata (legacy)
 */
export function updateSessionMetadata(
    sessionId: string,
    metadata: Record<string, unknown>
): void {
    const session = sessions.get(sessionId);
    if (session) {
        session.metadata = { ...session.metadata, ...metadata };
    }
}

/**
 * Get session summary (legacy)
 */
export function getSessionSummary(sessionId: string): string | null {
    const session = sessions.get(sessionId);
    const messages = sessionMessages.get(sessionId);

    if (!session || !messages) return null;

    const duration = Math.round((Date.now() - session.startedAt.getTime()) / 60000);

    return [
        `📊 **Session: ${sessionId}**`,
        "",
        `👤 User: ${session.userId}`,
        `📱 Channel: ${session.channel}`,
        `⏱️ Duration: ${duration} minutes`,
        `💬 Messages: ${session.messageCount}`,
        `🎟️ Tokens: ${session.tokenCount.toLocaleString()}`,
    ].join("\n");
}

/**
 * Get all messages for a specific channel (legacy)
 */
export function getMessagesByChannel(channel: string): Array<{ sessionId: string; messages: SessionMessage[] }> {
    const result: Array<{ sessionId: string; messages: SessionMessage[] }> = [];

    for (const [sessionId, session] of sessions.entries()) {
        if (session.channel === channel) {
            const messages = sessionMessages.get(sessionId) || [];
            if (messages.length > 0) {
                result.push({ sessionId, messages });
            }
        }
    }

    return result;
}

/**
 * Get flat list of all messages for a channel with metadata (legacy)
 */
export function getChannelHistory(channel: string): Array<SessionMessage & { sessionId: string; userId: string }> {
    const result: Array<SessionMessage & { sessionId: string; userId: string }> = [];

    for (const [sessionId, session] of sessions.entries()) {
        if (session.channel === channel) {
            const messages = sessionMessages.get(sessionId) || [];
            for (const msg of messages) {
                result.push({
                    ...msg,
                    sessionId,
                    userId: session.userId,
                });
            }
        }
    }

    // Sort by timestamp
    result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return result;
}
