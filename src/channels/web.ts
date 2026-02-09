import type { ChannelAdapter, IncomingMessage, OutgoingMessage, SendResult } from "./base.js";
import { randomBytes } from "node:crypto";
import { logger } from "../logger.js";

type MessageHandler = (message: IncomingMessage) => void;

// Web adapter for HTTP/WebSocket web clients
export class WebAdapter implements ChannelAdapter {
    name = "web" as const;
    private connected = false;
    private handlers: MessageHandler[] = [];

    // Store for web client connections (WebSocket references would go here)
    private clients: Map<string, {
        id: string;
        send: (data: string) => void;
    }> = new Map();

    isConnected(): boolean {
        return this.connected;
    }

    async connect(): Promise<void> {
        this.connected = true;
        logger.info("channel", "Web adapter ready");
    }

    async disconnect(): Promise<void> {
        logger.info("channel", "Web adapter disconnected", { clientCount: this.clients.size });
        this.connected = false;
        this.clients.clear();
    }

    async send(message: OutgoingMessage): Promise<SendResult> {
        const client = this.clients.get(message.to);
        if (!client) {
            return { success: false, error: `Client not connected: ${message.to}` };
        }

        try {
            const messageId = randomBytes(8).toString("hex");
            client.send(JSON.stringify({
                type: "message",
                id: messageId,
                content: message.content,
                timestamp: new Date().toISOString(),
            }));

            return { success: true, messageId };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            return { success: false, error };
        }
    }

    onMessage(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    // Called when a web client connects
    registerClient(clientId: string, sendFn: (data: string) => void): void {
        this.clients.set(clientId, { id: clientId, send: sendFn });
        logger.info("channel", `Web client connected`, { clientId, totalClients: this.clients.size });
    }

    unregisterClient(clientId: string): void {
        this.clients.delete(clientId);
        logger.info("channel", `Web client disconnected`, { clientId, totalClients: this.clients.size });
    }

    // Called when receiving a message from a web client
    handleIncoming(clientId: string, data: { content: string; replyTo?: string }): void {
        const incoming: IncomingMessage = {
            id: randomBytes(8).toString("hex"),
            channel: "web",
            from: clientId,
            content: data.content,
            timestamp: new Date(),
            replyTo: data.replyTo,
        };

        for (const handler of this.handlers) {
            handler(incoming);
        }
    }

    getConnectedClients(): string[] {
        return Array.from(this.clients.keys());
    }
}

// Singleton
export const webAdapter = new WebAdapter();
