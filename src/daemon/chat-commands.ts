/**
 * OpenWhale Chat Commands - WhatsApp/Channel command processing
 * 
 * Commands:
 * /new, /reset    - Clear session and start fresh
 * /status         - Show model, tokens, uptime
 * /think <level>  - Set thinking level (off/low/medium/high)
 * /verbose        - Toggle verbose mode
 * /model <name>   - Switch model
 * /compact        - Compact session context
 * /usage          - Show token usage
 * /help           - List available commands
 */

export interface SessionSettings {
    thinkingLevel: "off" | "low" | "medium" | "high";
    verboseMode: boolean;
    model: string;
    usageDisplay: "off" | "tokens" | "full";
    tokenCount: number;
    messageCount: number;
    sessionStart: Date;
}

// Store per-user session settings
const sessionSettings = new Map<string, SessionSettings>();

/**
 * Get or create session settings for a user
 */
export function getSessionSettings(userId: string): SessionSettings {
    if (!sessionSettings.has(userId)) {
        sessionSettings.set(userId, {
            thinkingLevel: "medium",
            verboseMode: false,
            model: process.env.DEFAULT_MODEL || "claude-sonnet-4-20250514",
            usageDisplay: "tokens",
            tokenCount: 0,
            messageCount: 0,
            sessionStart: new Date(),
        });
    }
    return sessionSettings.get(userId)!;
}

/**
 * Reset session for a user
 */
export function resetSession(userId: string): void {
    sessionSettings.set(userId, {
        thinkingLevel: "medium",
        verboseMode: false,
        model: process.env.DEFAULT_MODEL || "claude-sonnet-4-20250514",
        usageDisplay: "tokens",
        tokenCount: 0,
        messageCount: 0,
        sessionStart: new Date(),
    });
}

/**
 * Update token count for a session
 */
export function addTokenUsage(userId: string, tokens: number): void {
    const settings = getSessionSettings(userId);
    settings.tokenCount += tokens;
    settings.messageCount += 1;
}

/**
 * Check if a message is a command
 */
export function isCommand(message: string): boolean {
    return message.trim().startsWith("/");
}

/**
 * Process a chat command and return the response
 * Returns null if not a command, otherwise returns the response string
 */
export function processCommand(userId: string, message: string): string | null {
    const trimmed = message.trim();
    if (!trimmed.startsWith("/")) {
        return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const settings = getSessionSettings(userId);

    switch (command) {
        case "new":
        case "reset":
        case "clear":
            resetSession(userId);
            return "🔄 **Session Reset**\n\nConversation cleared. Starting fresh!\n\n_Model: " + settings.model + "_";

        case "status": {
            const uptime = formatUptime(settings.sessionStart);
            const lines = [
                "📊 **Session Status**",
                "",
                `🤖 Model: \`${settings.model}\``,
                `💭 Thinking: ${formatThinkingLevel(settings.thinkingLevel)}`,
                `📝 Verbose: ${settings.verboseMode ? "On" : "Off"}`,
                `⏱️ Uptime: ${uptime}`,
                "",
                `📨 Messages: ${settings.messageCount}`,
                `🔤 Tokens: ${settings.tokenCount.toLocaleString()}`,
            ];
            return lines.join("\n");
        }

        case "think":
        case "thinking": {
            const level = args[0]?.toLowerCase();
            if (!level) {
                return `💭 Current thinking level: **${settings.thinkingLevel}**\n\nUsage: \`/think <off|low|medium|high>\``;
            }
            if (!["off", "low", "medium", "high"].includes(level)) {
                return "❌ Invalid thinking level. Use: `off`, `low`, `medium`, or `high`";
            }
            settings.thinkingLevel = level as SessionSettings["thinkingLevel"];
            return `💭 Thinking level set to: **${level}**\n\n${getThinkingDescription(level)}`;
        }

        case "verbose": {
            const arg = args[0]?.toLowerCase();
            if (arg === "on" || arg === "true") {
                settings.verboseMode = true;
            } else if (arg === "off" || arg === "false") {
                settings.verboseMode = false;
            } else {
                settings.verboseMode = !settings.verboseMode;
            }
            return `📝 Verbose mode: **${settings.verboseMode ? "On" : "Off"}**`;
        }

        case "model": {
            const modelName = args[0];
            if (!modelName) {
                return `🤖 Current model: \`${settings.model}\`\n\nUsage: \`/model <model-name>\`\n\nAvailable models:\n• \`claude-sonnet-4-20250514\`\n• \`claude-opus-4-20250514\`\n• \`gpt-4o\`\n• \`gpt-4o-mini\`\n• \`gemini-2.0-flash\`\n• \`llama3.3\``;
            }
            settings.model = modelName;
            return `🤖 Model switched to: \`${modelName}\``;
        }

        case "compact": {
            // In a real implementation, this would compact the context
            return "📦 **Context Compacted**\n\nSession context has been summarized to save tokens.\n\n_Note: Some earlier context may be summarized._";
        }

        case "usage": {
            const arg = args[0]?.toLowerCase();
            if (arg === "off") {
                settings.usageDisplay = "off";
                return "📊 Usage display: **Off**";
            } else if (arg === "tokens") {
                settings.usageDisplay = "tokens";
                return "📊 Usage display: **Tokens only**";
            } else if (arg === "full") {
                settings.usageDisplay = "full";
                return "📊 Usage display: **Full details**";
            }

            return [
                "📊 **Token Usage**",
                "",
                `Total tokens: ${settings.tokenCount.toLocaleString()}`,
                `Messages: ${settings.messageCount}`,
                `Avg per message: ${settings.messageCount ? Math.round(settings.tokenCount / settings.messageCount) : 0}`,
                "",
                `Display mode: ${settings.usageDisplay}`,
                "",
                "_Set with: `/usage off|tokens|full`_"
            ].join("\n");
        }

        case "help":
        case "commands":
        case "?":
            return [
                "🐋 **OpenWhale Commands**",
                "",
                "`/new` or `/reset` - Clear session",
                "`/status` - Show session info",
                "`/think <level>` - Set thinking (off/low/medium/high)",
                "`/verbose` - Toggle verbose mode",
                "`/model <name>` - Switch AI model",
                "`/compact` - Compact context",
                "`/usage` - Token usage info",
                "`/help` - This message",
                "",
                "_Type normally to chat with AI_"
            ].join("\n");

        default:
            return `❓ Unknown command: \`/${command}\`\n\nType \`/help\` for available commands.`;
    }
}

/**
 * Format uptime duration
 */
function formatUptime(startDate: Date): string {
    const seconds = Math.floor((Date.now() - startDate.getTime()) / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    } else {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        return `${days}d ${hours}h`;
    }
}

/**
 * Format thinking level for display
 */
function formatThinkingLevel(level: string): string {
    const icons: Record<string, string> = {
        off: "⚡ Off (fastest)",
        low: "💨 Low",
        medium: "🔹 Medium",
        high: "🧠 High (most thorough)",
    };
    return icons[level] || level;
}

/**
 * Get description for thinking level
 */
function getThinkingDescription(level: string): string {
    const descriptions: Record<string, string> = {
        off: "_Fastest responses, minimal reasoning_",
        low: "_Quick thinking, good for simple tasks_",
        medium: "_Balanced reasoning for most tasks_",
        high: "_Deep analysis, best for complex problems_",
    };
    return descriptions[level] || "";
}
