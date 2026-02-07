// Channel abstraction for unified messaging
export type MessageChannel = "whatsapp" | "telegram" | "discord" | "slack" | "web" | "api" | "twitter" | "imessage";

export type IncomingMessage = {
    id: string;
    channel: MessageChannel;
    from: string;
    to?: string;
    content: string;
    timestamp: Date;
    replyTo?: string;
    attachments?: MessageAttachment[];
    metadata?: Record<string, unknown>;
};

export type MessageAttachment = {
    type: "image" | "audio" | "video" | "document";
    url?: string;
    data?: Buffer;
    mimeType: string;
    filename?: string;
};

export type OutgoingMessage = {
    channel: MessageChannel;
    to: string;
    content: string;
    replyTo?: string;
    attachments?: MessageAttachment[];
    metadata?: Record<string, unknown>;
};

export type SendResult = {
    success: boolean;
    messageId?: string;
    error?: string;
};

export interface ChannelAdapter {
    name: MessageChannel;
    isConnected(): boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: OutgoingMessage): Promise<SendResult>;
    onMessage(handler: (message: IncomingMessage) => void): void;
}

// Channel registry
class ChannelRegistry {
    private adapters: Map<MessageChannel, ChannelAdapter> = new Map();
    private messageHandlers: Array<(message: IncomingMessage) => void> = [];

    register(adapter: ChannelAdapter): void {
        this.adapters.set(adapter.name, adapter);
        adapter.onMessage((msg) => {
            for (const handler of this.messageHandlers) {
                handler(msg);
            }
        });
    }

    get(channel: MessageChannel): ChannelAdapter | undefined {
        return this.adapters.get(channel);
    }

    async send(message: OutgoingMessage): Promise<SendResult> {
        const adapter = this.adapters.get(message.channel);
        if (!adapter) {
            return { success: false, error: `No adapter for channel: ${message.channel}` };
        }
        if (!adapter.isConnected()) {
            return { success: false, error: `Channel not connected: ${message.channel}` };
        }
        return adapter.send(message);
    }

    onMessage(handler: (message: IncomingMessage) => void): void {
        this.messageHandlers.push(handler);
    }

    async connectAll(): Promise<void> {
        for (const adapter of this.adapters.values()) {
            if (!adapter.isConnected()) {
                await adapter.connect();
            }
        }
    }

    async disconnectAll(): Promise<void> {
        for (const adapter of this.adapters.values()) {
            if (adapter.isConnected()) {
                await adapter.disconnect();
            }
        }
    }

    listConnected(): MessageChannel[] {
        return Array.from(this.adapters.values())
            .filter(a => a.isConnected())
            .map(a => a.name);
    }
}

export const channelRegistry = new ChannelRegistry();
