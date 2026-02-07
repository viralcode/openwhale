/**
 * iMessage Tool — read chats, history, and send messages via `imsg` CLI
 *
 * macOS only. Requires the `imsg` CLI (brew install steipete/tap/imsg)
 * and Full Disk Access + Automation permissions.
 */

import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const execAsync = promisify(exec);

// Augmented PATH so we can find imsg on macOS
const IMSG_PATH = ["/opt/homebrew/bin", "/usr/local/bin", `${process.env.HOME}/.cargo/bin`, process.env.PATH].join(":");
const EXEC_OPTS = { env: { ...process.env, PATH: IMSG_PATH }, timeout: 30000 };

export const imessageSchema = z.object({
    action: z.enum(["list_chats", "read_chat", "send"])
        .describe("Action: list_chats (list recent chats), read_chat (read messages from a chat), send (send a message)"),
    chatId: z.string().optional()
        .describe("Chat ID for read_chat action (from list_chats output)"),
    limit: z.number().min(1).max(100).optional().default(20)
        .describe("Number of items to return (default 20)"),
    to: z.string().optional()
        .describe("Recipient phone number or email for send action (e.g. '+14155551212')"),
    text: z.string().optional()
        .describe("Message text to send"),
});

export type IMessageParams = z.infer<typeof imessageSchema>;

async function executeIMessage(
    params: IMessageParams,
    _context: ToolCallContext
): Promise<ToolResult> {
    // Platform check
    if (process.platform !== "darwin") {
        return {
            success: false,
            content: "",
            error: "iMessage is only available on macOS",
        };
    }

    // Check imsg CLI availability
    try {
        await execAsync("which imsg", EXEC_OPTS);
    } catch {
        return {
            success: false,
            content: "",
            error: "imsg CLI not found. Install it with: brew install steipete/tap/imsg",
        };
    }

    try {
        switch (params.action) {
            case "list_chats": {
                const { stdout } = await execAsync(
                    `imsg chats --limit ${params.limit} --json`,
                    EXEC_OPTS
                );
                return {
                    success: true,
                    content: stdout.trim(),
                    metadata: { action: "list_chats" },
                };
            }

            case "read_chat": {
                if (!params.chatId) {
                    return {
                        success: false,
                        content: "",
                        error: "chatId is required for read_chat action. Use list_chats first to get chat IDs.",
                    };
                }
                const { stdout } = await execAsync(
                    `imsg history --chat-id ${JSON.stringify(params.chatId)} --limit ${params.limit} --json`,
                    EXEC_OPTS
                );
                return {
                    success: true,
                    content: stdout.trim(),
                    metadata: { action: "read_chat", chatId: params.chatId },
                };
            }

            case "send": {
                if (!params.to) {
                    return {
                        success: false,
                        content: "",
                        error: "\"to\" (recipient phone/email) is required for send action",
                    };
                }
                if (!params.text) {
                    return {
                        success: false,
                        content: "",
                        error: "\"text\" (message content) is required for send action",
                    };
                }
                const { stdout } = await execAsync(
                    `imsg send --to ${JSON.stringify(params.to)} --text ${JSON.stringify(params.text)}`,
                    EXEC_OPTS
                );
                return {
                    success: true,
                    content: stdout.trim() || `Message sent to ${params.to}`,
                    metadata: { action: "send", to: params.to },
                };
            }

            default:
                return {
                    success: false,
                    content: "",
                    error: `Unknown action: ${params.action}`,
                };
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Check for common permission errors
        if (msg.includes("not permitted") || msg.includes("privacy")) {
            return {
                success: false,
                content: "",
                error: `Permission denied. Ensure Full Disk Access and Automation permissions are granted in System Settings > Privacy & Security. Error: ${msg}`,
            };
        }
        return {
            success: false,
            content: "",
            error: `iMessage command failed: ${msg}`,
        };
    }
}

export const imessageTool: AgentTool<IMessageParams> = {
    name: "imessage",
    description: "Read and send iMessages on macOS. Use list_chats to see recent conversations, read_chat to read messages from a specific chat, and send to send a message to a phone number or email.",
    category: "communication",
    parameters: imessageSchema,
    execute: executeIMessage,
    disabled: process.platform !== "darwin",
};

export default imessageTool;
