import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const EmailSendActionSchema = z.object({
    action: z.enum(["send"]).describe("Action to perform"),
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (plain text or HTML)"),
    cc: z.string().optional().describe("CC recipients (comma-separated)"),
    bcc: z.string().optional().describe("BCC recipients (comma-separated)"),
    isHtml: z.boolean().optional().default(false).describe("Whether body is HTML"),
    attachments: z.array(z.string()).optional().describe("Array of file paths to attach"),
});

type EmailSendAction = z.infer<typeof EmailSendActionSchema>;

export const emailSendTool: AgentTool<EmailSendAction> = {
    name: "email_send",
    description: "Send emails via Gmail API using configured OAuth tokens. Supports HTML, CC/BCC, and file attachments.",
    category: "communication",
    parameters: EmailSendActionSchema,

    async execute(params: EmailSendAction, _context: ToolCallContext): Promise<ToolResult> {
        try {
            // Dynamic import to avoid requiring googleapis at module level
            const { google } = await import("googleapis");

            // Load OAuth tokens
            const { homedir } = await import("node:os");
            const { join } = await import("node:path");
            const tokenPath = join(homedir(), ".openwhale", "google-tokens.json");
            const credPath = join(homedir(), ".openwhale", "google-credentials.json");

            let tokens: any;
            let credentials: any;
            try {
                tokens = JSON.parse(await readFile(tokenPath, "utf-8"));
                credentials = JSON.parse(await readFile(credPath, "utf-8"));
            } catch {
                return { success: false, content: "", error: "Gmail not configured. Set up Google OAuth in the dashboard first." };
            }

            const clientId = credentials.web?.client_id || credentials.installed?.client_id;
            const clientSecret = credentials.web?.client_secret || credentials.installed?.client_secret;

            if (!clientId || !clientSecret) {
                return { success: false, content: "", error: "Invalid Google credentials file" };
            }

            const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
            oauth2Client.setCredentials(tokens);

            const gmail = google.gmail({ version: "v1", auth: oauth2Client });

            // Build the email
            const boundary = `boundary_${Date.now()}`;
            const mimeType = params.isHtml ? "text/html" : "text/plain";

            let emailParts = [
                `To: ${params.to}`,
                `Subject: ${params.subject}`,
            ];
            if (params.cc) emailParts.push(`Cc: ${params.cc}`);
            if (params.bcc) emailParts.push(`Bcc: ${params.bcc}`);

            if (params.attachments && params.attachments.length > 0) {
                emailParts.push(`MIME-Version: 1.0`);
                emailParts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
                emailParts.push(``);
                emailParts.push(`--${boundary}`);
                emailParts.push(`Content-Type: ${mimeType}; charset="UTF-8"`);
                emailParts.push(``);
                emailParts.push(params.body);

                for (const filePath of params.attachments) {
                    const fileBuffer = await readFile(filePath);
                    const fileName = basename(filePath);
                    const base64File = fileBuffer.toString("base64");
                    emailParts.push(`--${boundary}`);
                    emailParts.push(`Content-Type: application/octet-stream; name="${fileName}"`);
                    emailParts.push(`Content-Disposition: attachment; filename="${fileName}"`);
                    emailParts.push(`Content-Transfer-Encoding: base64`);
                    emailParts.push(``);
                    emailParts.push(base64File);
                }
                emailParts.push(`--${boundary}--`);
            } else {
                emailParts.push(`Content-Type: ${mimeType}; charset="UTF-8"`);
                emailParts.push(``);
                emailParts.push(params.body);
            }

            const rawEmail = emailParts.join("\r\n");
            const encodedEmail = Buffer.from(rawEmail)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");

            const result = await gmail.users.messages.send({
                userId: "me",
                requestBody: { raw: encodedEmail },
            });

            return {
                success: true,
                content: `Email sent to ${params.to}: "${params.subject}"${params.attachments ? ` with ${params.attachments.length} attachment(s)` : ""}`,
                metadata: {
                    messageId: result.data.id,
                    to: params.to,
                    subject: params.subject,
                },
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Email error: ${message}` };
        }
    },
};
