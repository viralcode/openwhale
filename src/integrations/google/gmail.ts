/**
 * Gmail Skill
 */

import { createSkill, type Skill, type SkillTool } from "../../skills/base.js";
import type { ToolResult } from "../../tools/base.js";
import { googleFetch, isGoogleConfigured, hasValidToken } from "./auth.js";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

const tools: SkillTool[] = [
    {
        name: "gmail_inbox",
        description: "List recent emails from inbox",
        parameters: {
            type: "object",
            properties: {
                unread_only: { type: "boolean", description: "Show only unread emails" },
                max: { type: "number", description: "Maximum emails to return (default: 10)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { unread_only = false, max = 10 } = args;

                let query = "in:inbox";
                if (unread_only) query += " is:unread";

                const params = new URLSearchParams({
                    q: query,
                    maxResults: String(max),
                });

                const res = await googleFetch(`${GMAIL_API}/users/me/messages?${params}`);
                const data = await res.json() as { messages?: Array<{ id: string }> };

                if (!data.messages?.length) {
                    return { success: true, content: "📧 **Inbox**\n\nNo emails." };
                }

                // Fetch details for each message
                const emails = await Promise.all(
                    data.messages.slice(0, max as number).map(async (m) => {
                        const msgRes = await googleFetch(`${GMAIL_API}/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
                        return msgRes.json() as Promise<{
                            id: string;
                            labelIds: string[];
                            payload: { headers: Array<{ name: string; value: string }> };
                        }>;
                    })
                );

                const formatted = emails.map(e => {
                    const subject = e.payload.headers.find(h => h.name === "Subject")?.value || "(No subject)";
                    const from = e.payload.headers.find(h => h.name === "From")?.value || "Unknown";
                    const unread = e.labelIds.includes("UNREAD") ? "🔵 " : "";
                    return `${unread}**${subject}**\n   From: ${from}`;
                }).join("\n\n");

                return { success: true, content: `📧 **Inbox**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "gmail_search",
        description: "Search emails",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query (Gmail search syntax)" },
                max: { type: "number", description: "Maximum results (default: 10)" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query, max = 10 } = args;

                const params = new URLSearchParams({
                    q: query as string,
                    maxResults: String(max),
                });

                const res = await googleFetch(`${GMAIL_API}/users/me/messages?${params}`);
                const data = await res.json() as { messages?: Array<{ id: string }> };

                if (!data.messages?.length) {
                    return { success: true, content: `🔍 **Search: "${query}"**\n\nNo results.` };
                }

                const emails = await Promise.all(
                    data.messages.slice(0, max as number).map(async (m) => {
                        const msgRes = await googleFetch(`${GMAIL_API}/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
                        return msgRes.json() as Promise<{
                            payload: { headers: Array<{ name: string; value: string }> };
                        }>;
                    })
                );

                const formatted = emails.map(e => {
                    const subject = e.payload.headers.find(h => h.name === "Subject")?.value || "(No subject)";
                    const from = e.payload.headers.find(h => h.name === "From")?.value || "Unknown";
                    return `**${subject}**\n   From: ${from}`;
                }).join("\n\n");

                return { success: true, content: `🔍 **Search: "${query}"**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "gmail_send",
        description: "Send an email",
        parameters: {
            type: "object",
            properties: {
                to: { type: "string", description: "Recipient email address" },
                subject: { type: "string", description: "Email subject" },
                body: { type: "string", description: "Email body (plain text)" },
            },
            required: ["to", "subject", "body"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { to, subject, body } = args;

                const email = [
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    "Content-Type: text/plain; charset=utf-8",
                    "",
                    body,
                ].join("\r\n");

                const encodedMessage = Buffer.from(email)
                    .toString("base64")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=+$/, "");

                await googleFetch(`${GMAIL_API}/users/me/messages/send`, {
                    method: "POST",
                    body: JSON.stringify({ raw: encodedMessage }),
                });

                return { success: true, content: `✅ **Email Sent**\n\n📧 To: ${to}\n📝 Subject: ${subject}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "gmail_read",
        description: "Read a specific email's full content",
        parameters: {
            type: "object",
            properties: {
                message_id: { type: "string", description: "Message ID" },
            },
            required: ["message_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { message_id } = args;

                const res = await googleFetch(`${GMAIL_API}/users/me/messages/${message_id}?format=full`);
                const data = await res.json() as {
                    payload: {
                        headers: Array<{ name: string; value: string }>;
                        parts?: Array<{ mimeType: string; body: { data?: string } }>;
                        body?: { data?: string };
                    };
                };

                const subject = data.payload.headers.find(h => h.name === "Subject")?.value || "(No subject)";
                const from = data.payload.headers.find(h => h.name === "From")?.value || "Unknown";
                const date = data.payload.headers.find(h => h.name === "Date")?.value || "";

                // Get body
                let bodyData = data.payload.body?.data;
                if (!bodyData && data.payload.parts) {
                    const textPart = data.payload.parts.find(p => p.mimeType === "text/plain");
                    bodyData = textPart?.body?.data;
                }

                const body = bodyData
                    ? Buffer.from(bodyData, "base64").toString("utf-8")
                    : "(No content)";

                return {
                    success: true,
                    content: [
                        `📧 **${subject}**`,
                        "",
                        `From: ${from}`,
                        `Date: ${date}`,
                        "",
                        "---",
                        "",
                        body.slice(0, 2000),
                    ].join("\n"),
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const gmailSkill: Skill = createSkill(
    {
        name: "gmail",
        description: "Gmail integration - read, search, and send emails",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "GOOGLE_CLIENT_ID",
    },
    tools,
    () => isGoogleConfigured() && hasValidToken()
);
