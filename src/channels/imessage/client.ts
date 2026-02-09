/**
 * iMessage Channel (macOS only)
 * 
 * RPC client for `imsg` CLI for iMessage integration.
 * Based on OpenClaw's iMessage implementation.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { EventEmitter } from "node:events";
import os from "node:os";
import { logger } from "../../logger.js";

export type IMessageRpcError = {
    code?: number;
    message?: string;
    data?: unknown;
};

export type IMessageRpcResponse<T> = {
    jsonrpc?: string;
    id?: string | number | null;
    result?: T;
    error?: IMessageRpcError;
    method?: string;
    params?: unknown;
};

export type IMessageRpcNotification = {
    method: string;
    params?: unknown;
};

export type IMessageClientOptions = {
    cliPath?: string;
    dbPath?: string;
    onNotification?: (msg: IMessageRpcNotification) => void;
    onError?: (err: Error) => void;
};

type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer?: NodeJS.Timeout;
};

export interface IMessageAccount {
    id: string;
    displayName?: string;
    type: "iMessage" | "SMS";
}

export interface IMessageChat {
    id: string;
    displayName?: string;
    participants: string[];
    isGroup: boolean;
    lastMessageAt?: number;
}

export interface IMessageMessage {
    id: string;
    chatId: string;
    sender: string;
    text: string;
    timestamp: number;
    isFromMe: boolean;
}

/**
 * Check if running on macOS
 */
export function isIMMessageAvailable(): boolean {
    return os.platform() === "darwin";
}

/**
 * iMessage RPC Client
 * Communicates with imsg CLI via JSON-RPC over stdio
 */
export class IMessageClient extends EventEmitter {
    private readonly cliPath: string;
    private readonly dbPath?: string;
    private readonly onNotification?: (msg: IMessageRpcNotification) => void;
    private readonly pending = new Map<string, PendingRequest>();
    private child: ChildProcessWithoutNullStreams | null = null;
    private reader: Interface | null = null;
    private nextId = 1;
    private isRunning = false;

    constructor(opts: IMessageClientOptions = {}) {
        super();
        this.cliPath = opts.cliPath?.trim() || "imsg";
        this.dbPath = opts.dbPath?.trim() || undefined;
        this.onNotification = opts.onNotification;
    }

    /**
     * Start the RPC client
     */
    async start(): Promise<void> {
        if (!isIMMessageAvailable()) {
            throw new Error("iMessage is only available on macOS");
        }

        if (this.child) {
            return;
        }

        const args = ["rpc"];
        if (this.dbPath) {
            args.push("--db", this.dbPath);
        }

        const child = spawn(this.cliPath, args, {
            stdio: ["pipe", "pipe", "pipe"],
        });

        this.child = child;
        this.reader = createInterface({ input: child.stdout });
        this.isRunning = true;

        this.reader.on("line", (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            this.handleLine(trimmed);
        });

        child.stderr?.on("data", (chunk) => {
            const lines = chunk.toString().split(/\r?\n/);
            for (const line of lines) {
                if (line.trim()) {
                    logger.warn("channel", `iMessage RPC stderr`, { line: line.trim() });
                }
            }
        });

        child.on("error", (err) => {
            this.failAll(err);
            this.isRunning = false;
            this.emit("error", err);
        });

        child.on("close", (code, signal) => {
            if (code !== 0 && code !== null) {
                const reason = signal ? `signal ${signal}` : `code ${code}`;
                this.failAll(new Error(`imsg rpc exited (${reason})`));
            } else {
                this.failAll(new Error("imsg rpc closed"));
            }
            this.isRunning = false;
            this.emit("close");
        });

        logger.info("channel", "iMessage RPC client started", { cliPath: this.cliPath });
    }

    /**
     * Stop the RPC client
     */
    async stop(): Promise<void> {
        if (!this.child) return;

        this.reader?.close();
        this.reader = null;
        this.child.stdin?.end();

        const child = this.child;
        this.child = null;
        this.isRunning = false;

        await Promise.race([
            new Promise<void>((resolve) => {
                child.once("close", resolve);
            }),
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill("SIGTERM");
                    }
                    resolve();
                }, 500);
            }),
        ]);

        logger.info("channel", "iMessage RPC client stopped");
    }

    /**
     * Make an RPC request
     */
    async request<T = unknown>(
        method: string,
        params?: Record<string, unknown>,
        opts?: { timeoutMs?: number }
    ): Promise<T> {
        if (!this.child || !this.child.stdin) {
            throw new Error("imsg rpc not running");
        }

        const id = this.nextId++;
        const payload = {
            jsonrpc: "2.0",
            id,
            method,
            params: params ?? {},
        };
        const line = `${JSON.stringify(payload)}\n`;
        const timeoutMs = opts?.timeoutMs ?? 10_000;

        const response = new Promise<T>((resolve, reject) => {
            const key = String(id);
            const timer = timeoutMs > 0
                ? setTimeout(() => {
                    this.pending.delete(key);
                    reject(new Error(`imsg rpc timeout (${method})`));
                }, timeoutMs)
                : undefined;

            this.pending.set(key, {
                resolve: (value) => resolve(value as T),
                reject,
                timer,
            });
        });

        this.child.stdin.write(line);
        return await response;
    }

    /**
     * List iMessage accounts
     */
    async listAccounts(): Promise<IMessageAccount[]> {
        return await this.request<IMessageAccount[]>("accounts.list");
    }

    /**
     * List recent chats
     */
    async listChats(limit = 50): Promise<IMessageChat[]> {
        return await this.request<IMessageChat[]>("chats.list", { limit });
    }

    /**
     * Get messages from a chat
     */
    async getMessages(chatId: string, limit = 20): Promise<IMessageMessage[]> {
        return await this.request<IMessageMessage[]>("messages.list", { chatId, limit });
    }

    /**
     * Send a message
     */
    async sendMessage(to: string, text: string): Promise<{ success: boolean; messageId?: string }> {
        return await this.request("message.send", { to, text });
    }

    /**
     * Handle incoming RPC line
     */
    private handleLine(line: string) {
        let parsed: IMessageRpcResponse<unknown>;
        try {
            parsed = JSON.parse(line) as IMessageRpcResponse<unknown>;
        } catch (err) {
            logger.warn("channel", "iMessage RPC failed to parse response", { line: line.slice(0, 100) });
            return;
        }

        if (parsed.id !== undefined && parsed.id !== null) {
            const key = String(parsed.id);
            const pending = this.pending.get(key);
            if (!pending) return;

            if (pending.timer) {
                clearTimeout(pending.timer);
            }
            this.pending.delete(key);

            if (parsed.error) {
                const msg = parsed.error.message ?? "imsg rpc error";
                pending.reject(new Error(msg));
                return;
            }
            pending.resolve(parsed.result);
            return;
        }

        if (parsed.method) {
            this.onNotification?.({
                method: parsed.method,
                params: parsed.params,
            });
            this.emit("notification", {
                method: parsed.method,
                params: parsed.params,
            });
        }
    }

    /**
     * Fail all pending requests
     */
    private failAll(err: Error) {
        for (const [key, pending] of this.pending.entries()) {
            if (pending.timer) {
                clearTimeout(pending.timer);
            }
            pending.reject(err);
            this.pending.delete(key);
        }
    }

    get running(): boolean {
        return this.isRunning;
    }
}

/**
 * Create and start an iMessage client
 */
export async function createIMessageClient(
    opts: IMessageClientOptions = {}
): Promise<IMessageClient> {
    const client = new IMessageClient(opts);
    await client.start();
    return client;
}

export default {
    isIMMessageAvailable,
    IMessageClient,
    createIMessageClient,
};
