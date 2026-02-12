/**
 * Shared Context Tools — Read/write shared memory between agents
 */

import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { writeContext, readContext, readNamespace, listNamespaces, deleteContextKey, clearNamespace } from "../agents/shared-context.js";

// ============== WRITE ==============

export const sharedContextWriteTool: AgentTool = {
    name: "shared_context_write",
    description: `Write a key-value pair to a shared context namespace. Other agents in the same coordination group can read this data.

Use this to:
- Share research findings between agents
- Pass intermediate results
- Set flags or status indicators
- Store structured data for other agents to consume

Namespaces isolate different coordination groups. Use a coordination ID, task name, or custom namespace.`,

    category: "utility",

    parameters: z.object({
        namespace: z.string().describe("Namespace to write to (e.g. coordination ID or task group name)"),
        key: z.string().describe("Key for the data entry"),
        value: z.string().describe("Value to store (can be JSON, text, etc.)"),
        ttlMs: z.number().optional().describe("Time-to-live in ms. Entry auto-expires after this. Default: never expires"),
        metadata: z.record(z.string()).optional().describe("Optional metadata tags"),
    }),

    async execute(params: {
        namespace: string;
        key: string;
        value: string;
        ttlMs?: number;
        metadata?: Record<string, string>;
    }, context: ToolCallContext): Promise<ToolResult> {
        try {
            const entry = writeContext({
                namespace: params.namespace,
                key: params.key,
                value: params.value,
                writtenBy: context.agentId || context.sessionId || "unknown",
                ttlMs: params.ttlMs,
                metadata: params.metadata,
            });

            return {
                success: true,
                content: [
                    `✅ Wrote to shared context`,
                    `Namespace: ${params.namespace}`,
                    `Key: ${params.key}`,
                    `Version: ${entry.version}`,
                    entry.expiresAt ? `Expires: ${new Date(entry.expiresAt).toISOString()}` : '',
                ].filter(Boolean).join('\n'),
            };
        } catch (e: any) {
            return { success: false, content: `Failed to write context: ${e.message}`, error: e.message };
        }
    },
};

// ============== READ ==============

export const sharedContextReadTool: AgentTool = {
    name: "shared_context_read",
    description: `Read from a shared context namespace. Retrieve data written by other agents in the same coordination group.

You can read a specific key or list all entries in a namespace.`,

    category: "utility",

    parameters: z.object({
        namespace: z.string().describe("Namespace to read from"),
        key: z.string().optional().describe("Specific key to read. If omitted, returns all entries in the namespace"),
        listNamespaces: z.boolean().optional().describe("If true, list all available namespaces instead"),
    }),

    async execute(params: {
        namespace: string;
        key?: string;
        listNamespaces?: boolean;
    }, _context: ToolCallContext): Promise<ToolResult> {
        try {
            if (params.listNamespaces) {
                const nsList = listNamespaces();
                if (nsList.length === 0) {
                    return { success: true, content: "No shared context namespaces exist yet." };
                }
                const lines = nsList.map(ns =>
                    `- **${ns.name}**: ${ns.entryCount} entries (updated ${new Date(ns.lastUpdatedAt).toLocaleString()})`
                );
                return { success: true, content: `**Shared Context Namespaces:**\n${lines.join('\n')}` };
            }

            if (params.key) {
                const entry = readContext(params.namespace, params.key);
                if (!entry) {
                    return { success: true, content: `No entry found for key "${params.key}" in namespace "${params.namespace}"` };
                }
                return {
                    success: true,
                    content: [
                        `**${params.namespace}/${params.key}** (v${entry.version})`,
                        `Written by: ${entry.writtenBy}`,
                        `At: ${new Date(entry.writtenAt).toLocaleString()}`,
                        '',
                        entry.value,
                    ].join('\n'),
                };
            }

            // Read all entries in namespace
            const entries = readNamespace(params.namespace);
            if (entries.length === 0) {
                return { success: true, content: `No entries in namespace "${params.namespace}"` };
            }

            const lines = entries.map(e =>
                `### ${e.key} (v${e.version})\n*by ${e.writtenBy} at ${new Date(e.writtenAt).toLocaleString()}*\n${e.value}`
            );
            return {
                success: true,
                content: `**Namespace: ${params.namespace}** (${entries.length} entries)\n\n${lines.join('\n\n')}`,
            };
        } catch (e: any) {
            return { success: false, content: `Failed to read context: ${e.message}`, error: e.message };
        }
    },
};

// ============== DELETE ==============

export const sharedContextDeleteTool: AgentTool = {
    name: "shared_context_delete",
    description: `Delete a key or clear an entire namespace from shared context.`,

    category: "utility",

    parameters: z.object({
        namespace: z.string().describe("Namespace to delete from"),
        key: z.string().optional().describe("Specific key to delete. If omitted, clears the entire namespace"),
    }),

    async execute(params: {
        namespace: string;
        key?: string;
    }, _context: ToolCallContext): Promise<ToolResult> {
        try {
            if (params.key) {
                const deleted = deleteContextKey(params.namespace, params.key);
                return { success: true, content: deleted ? `✅ Deleted key "${params.key}" from "${params.namespace}"` : `Key not found` };
            }

            clearNamespace(params.namespace);
            return { success: true, content: `✅ Cleared namespace "${params.namespace}"` };
        } catch (e: any) {
            return { success: false, content: `Failed to delete: ${e.message}`, error: e.message };
        }
    },
};
