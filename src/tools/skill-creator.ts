/**
 * OpenWhale Skill Creator Tool
 *
 * Allows the AI to create, update, list, get, and delete markdown skills
 * (SKILL.md) at runtime. Skills are hot-loaded into the registry without
 * requiring a server restart. Works from any channel (dashboard, WhatsApp,
 * Telegram, Discord, CLI, etc.).
 */

import { z } from "zod";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { reloadMarkdownSkills } from "../skills/markdown-loader.js";

// Skills directory
const SKILLS_DIR = join(homedir(), ".openwhale", "skills");

// Ensure skills directory exists
if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
}

// Action schema
const SkillCreatorSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("create"),
        name: z.string().describe("Unique name for the skill (lowercase, hyphens allowed, e.g. 'daily-standup')"),
        description: z.string().describe("Short description of what this skill does"),
        content: z.string().describe("The full markdown body with instructions, commands, and examples for the AI to use"),
        emoji: z.string().optional().describe("Emoji icon for the skill (e.g. '📊')"),
        requires_bins: z.array(z.string()).optional().describe("Required CLI binaries (e.g. ['git', 'node'])"),
    }),
    z.object({
        action: z.literal("update"),
        name: z.string().describe("Name of the skill to update"),
        description: z.string().optional().describe("New description"),
        content: z.string().optional().describe("New markdown body content"),
        emoji: z.string().optional().describe("New emoji icon"),
    }),
    z.object({
        action: z.literal("list"),
    }),
    z.object({
        action: z.literal("get"),
        name: z.string().describe("Name of the skill to read"),
    }),
    z.object({
        action: z.literal("delete"),
        name: z.string().describe("Name of the skill to delete"),
    }),
]);

type SkillCreatorAction = z.infer<typeof SkillCreatorSchema>;

/**
 * Validate skill name
 */
function validateSkillName(name: string): string | null {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        return "Name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens";
    }
    if (name.length > 50) {
        return "Name must be 50 characters or less";
    }
    return null;
}

/**
 * Build a SKILL.md file from components
 */
function buildSkillMd(name: string, description: string, content: string, emoji?: string, requiresBins?: string[]): string {
    // Build frontmatter
    let frontmatter = `---\nname: ${name}\ndescription: ${description}\n`;

    // Add metadata if we have emoji or requirements
    if (emoji || requiresBins?.length) {
        const openclawMeta: Record<string, unknown> = {};
        if (emoji) openclawMeta.emoji = emoji;
        if (requiresBins?.length) {
            openclawMeta.requires = { bins: requiresBins };
        }
        frontmatter += `metadata: ${JSON.stringify({ openclaw: openclawMeta })}\n`;
    }

    frontmatter += `---\n\n`;

    return frontmatter + content;
}

/**
 * Parse an existing SKILL.md to extract name, description, content, emoji
 */
function parseSkillMd(filePath: string): { name: string; description: string; content: string; emoji?: string } | null {
    try {
        const raw = readFileSync(filePath, "utf-8");
        const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) return null;

        const yamlBlock = match[1];
        const body = match[2].trim();

        // Simple extraction
        const nameMatch = yamlBlock.match(/^name:\s*(.+)$/m);
        const descMatch = yamlBlock.match(/^description:\s*(.+)$/m);

        const name = nameMatch?.[1]?.trim() || "";
        const description = descMatch?.[1]?.trim() || "";

        // Try to extract emoji
        let emoji: string | undefined;
        const metaMatch = yamlBlock.match(/metadata:\s*(\{[\s\S]*\})/);
        if (metaMatch) {
            try {
                const meta = JSON.parse(metaMatch[1]);
                emoji = meta?.openclaw?.emoji;
            } catch { /* ignore */ }
        }

        return { name, description, content: body, emoji };
    } catch {
        return null;
    }
}

export const skillCreatorTool: AgentTool<SkillCreatorAction> = {
    name: "skill_creator",
    description: `Create, update, list, get, and delete markdown skills. Skills are loaded instantly without a server restart. Use this when a user asks you to create a new skill or capability — for example "create a skill for writing standup reports" or "make a skill for querying databases". Skills provide the AI with domain-specific instructions and commands.`,
    category: "system",
    parameters: SkillCreatorSchema,

    async execute(params: SkillCreatorAction, _context: ToolCallContext): Promise<ToolResult> {
        switch (params.action) {
            case "create": {
                const nameError = validateSkillName(params.name);
                if (nameError) {
                    return { success: false, content: "", error: nameError };
                }

                const skillDir = join(SKILLS_DIR, params.name);
                if (existsSync(join(skillDir, "SKILL.md"))) {
                    return { success: false, content: "", error: `Skill '${params.name}' already exists. Use 'update' action to modify it.` };
                }

                // Create directory
                mkdirSync(skillDir, { recursive: true });

                // Build and write SKILL.md
                const skillMd = buildSkillMd(
                    params.name,
                    params.description,
                    params.content,
                    params.emoji,
                    params.requires_bins
                );
                writeFileSync(join(skillDir, "SKILL.md"), skillMd);

                // Hot-reload all markdown skills
                const reloaded = await reloadMarkdownSkills();

                let response = `✅ Skill '${params.name}' created and loaded!\n`;
                response += `📁 Location: ${skillDir}/SKILL.md\n`;
                response += `${params.emoji || "🔧"} ${params.description}\n`;
                response += `\n📊 Total markdown skills loaded: ${reloaded.length}`;

                return {
                    success: true,
                    content: response,
                    metadata: { name: params.name, path: skillDir },
                };
            }

            case "update": {
                const skillDir = join(SKILLS_DIR, params.name);
                const skillPath = join(skillDir, "SKILL.md");

                if (!existsSync(skillPath)) {
                    return { success: false, content: "", error: `Skill '${params.name}' not found.` };
                }

                // Parse existing skill
                const existing = parseSkillMd(skillPath);
                if (!existing) {
                    return { success: false, content: "", error: `Failed to parse existing skill '${params.name}'.` };
                }

                // Merge updates
                const newDescription = params.description || existing.description;
                const newContent = params.content || existing.content;
                const newEmoji = params.emoji || existing.emoji;

                // Rebuild and write
                const skillMd = buildSkillMd(params.name, newDescription, newContent, newEmoji);
                writeFileSync(skillPath, skillMd);

                // Hot-reload
                const reloaded = await reloadMarkdownSkills();

                return {
                    success: true,
                    content: `✅ Skill '${params.name}' updated and reloaded!\n📊 Total markdown skills loaded: ${reloaded.length}`,
                };
            }

            case "list": {
                if (!existsSync(SKILLS_DIR)) {
                    return { success: true, content: "No skills directory found. Create a skill first!" };
                }

                const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
                const skills: string[] = [];

                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    const skillPath = join(SKILLS_DIR, entry.name, "SKILL.md");
                    if (!existsSync(skillPath)) continue;

                    const parsed = parseSkillMd(skillPath);
                    if (parsed) {
                        const emoji = parsed.emoji || "🔧";
                        skills.push(`${emoji} **${parsed.name}**\n   ${parsed.description}`);
                    } else {
                        skills.push(`🔧 **${entry.name}** (unparseable)`);
                    }
                }

                if (skills.length === 0) {
                    return { success: true, content: "No markdown skills found. Use the 'create' action to make one!" };
                }

                return {
                    success: true,
                    content: `📚 Markdown Skills (${skills.length}):\n\n${skills.join("\n\n")}`,
                    metadata: { count: skills.length },
                };
            }

            case "get": {
                const skillPath = join(SKILLS_DIR, params.name, "SKILL.md");
                if (!existsSync(skillPath)) {
                    return { success: false, content: "", error: `Skill '${params.name}' not found.` };
                }

                const raw = readFileSync(skillPath, "utf-8");
                return {
                    success: true,
                    content: `📄 SKILL.md for '${params.name}':\n\n${raw}`,
                };
            }

            case "delete": {
                const skillDir = join(SKILLS_DIR, params.name);
                if (!existsSync(skillDir)) {
                    return { success: false, content: "", error: `Skill '${params.name}' not found.` };
                }

                // Delete directory
                rmSync(skillDir, { recursive: true, force: true });

                // Hot-reload to remove from registry
                const reloaded = await reloadMarkdownSkills();

                return {
                    success: true,
                    content: `🗑️ Skill '${params.name}' deleted.\n📊 Remaining markdown skills: ${reloaded.length}`,
                };
            }
        }
    },
};
