/**
 * 1Password Skill - Password manager integration via 1Password CLI (op)
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";
import { spawn } from "child_process";

async function runOp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn("op", args, { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => { stdout += data; });
        proc.stderr.on("data", (data) => { stderr += data; });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || `op exited with code ${code}`));
            }
        });
    });
}

const tools: SkillTool[] = [
    {
        name: "1password_vaults",
        description: "List available 1Password vaults",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                const output = await runOp(["vault", "list", "--format=json"]);
                const vaults = JSON.parse(output) as Array<{ id: string; name: string }>;

                const formatted = vaults.map(v =>
                    `🔐 **${v.name}**\n   ID: \`${v.id}\``
                ).join("\n\n");

                return { success: true, content: `🔐 **1Password Vaults**\n\n${formatted || "No vaults"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "1password_items",
        description: "List items in a vault",
        parameters: {
            type: "object",
            properties: {
                vault: { type: "string", description: "Vault name or ID" },
                categories: { type: "string", description: "Filter by category (Login, Password, etc.)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { vault, categories } = args;

                const opArgs = ["item", "list", "--format=json"];
                if (vault) opArgs.push(`--vault=${vault}`);
                if (categories) opArgs.push(`--categories=${categories}`);

                const output = await runOp(opArgs);
                const items = JSON.parse(output) as Array<{ id: string; title: string; category: string; vault: { name: string } }>;

                const formatted = items.slice(0, 20).map(i =>
                    `🔑 **${i.title}**\n   Category: ${i.category} | Vault: ${i.vault.name}`
                ).join("\n\n");

                return { success: true, content: `🔑 **1Password Items**\n\n${formatted || "No items"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "1password_get",
        description: "Get a specific field from an item (e.g., password, username)",
        parameters: {
            type: "object",
            properties: {
                item: { type: "string", description: "Item name or ID" },
                field: { type: "string", description: "Field name (username, password, etc.)" },
                vault: { type: "string", description: "Vault name or ID" },
            },
            required: ["item", "field"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { item, field, vault } = args;

                const opArgs = ["item", "get", item as string, `--fields=${field}`];
                if (vault) opArgs.push(`--vault=${vault}`);

                await runOp(opArgs);

                // SECURITY: Don't return actual secrets
                return {
                    success: true,
                    content: `🔐 **Retrieved ${field} for "${item}"**\n\n⚠️ For security, the actual value is not displayed.`
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const onePasswordSkill: Skill = createSkill(
    {
        name: "1password",
        description: "1Password integration via CLI - secure credential access",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "OP_SERVICE_ACCOUNT_TOKEN",
    },
    tools,
    () => !!process.env.OP_SERVICE_ACCOUNT_TOKEN
);
