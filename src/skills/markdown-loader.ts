/**
 * OpenWhale Markdown Skill Loader
 * 
 * Loads OpenClaw-style SKILL.md skills from directories.
 * These skills define commands via markdown and shell execution.
 */

import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const execAsync = promisify(exec);

// ============== TYPES ==============

interface OpenClawMetadata {
    emoji?: string;
    homepage?: string;
    primaryEnv?: string;
    requires?: {
        bins?: string[];
        anyBins?: string[];
        env?: string[];
        config?: string[];
    };
    install?: Array<{
        id?: string;
        kind: "brew" | "apt" | "node" | "go" | "uv" | "download";
        formula?: string;
        package?: string;
        bins?: string[];
        label?: string;
    }>;
}

interface SkillFrontmatter {
    name: string;
    description: string;
    metadata?: {
        openclaw?: OpenClawMetadata;
    };
}

interface ParsedMarkdownSkill {
    frontmatter: SkillFrontmatter;
    content: string;  // The markdown body (instructions for AI)
    filePath: string;
    baseDir: string;
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Sanitize a skill name to be a valid OpenAI tool name.
 * Must match pattern: ^[a-zA-Z0-9_-]+$
 */
function sanitizeToolName(name: string): string {
    return name
        .replace(/\s+/g, '_')           // spaces to underscores
        .replace(/[^a-zA-Z0-9_-]/g, '')  // remove invalid chars
        .slice(0, 64);                   // max 64 chars
}

// ============== FRONTMATTER PARSING ==============

/**
 * Parse YAML frontmatter from a SKILL.md file
 */
function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        throw new Error("Invalid SKILL.md: missing frontmatter");
    }

    const yamlContent = match[1];
    const body = match[2];

    // Parse YAML (handles both simple key:value and inline JSON)
    const frontmatter = parseSimpleYaml(yamlContent);

    if (!frontmatter.name) {
        throw new Error("Invalid SKILL.md: missing 'name' in frontmatter");
    }

    return {
        frontmatter: frontmatter as unknown as SkillFrontmatter,
        body: body.trim(),
    };
}

/**
 * Simple YAML parser (handles basic nested structures and inline JSON)
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        // Find the first colon that separates key from value
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx <= 0) continue;

        const key = trimmed.slice(0, colonIdx).trim();
        let value: unknown = trimmed.slice(colonIdx + 1).trim();

        // Handle inline JSON (e.g., metadata: { "openclaw": {...} })
        if (typeof value === "string" && value.startsWith("{")) {
            try {
                value = JSON.parse(value as string);
            } catch {
                // If JSON parse fails, keep as string
            }
        }
        // Handle inline arrays
        else if (typeof value === "string" && (value as string).startsWith("[")) {
            try {
                value = JSON.parse((value as string).replace(/'/g, '"'));
            } catch {
                // If JSON parse fails, keep as string
            }
        }
        // Handle quoted strings
        else if (typeof value === "string") {
            value = (value as string).replace(/^["']|["']$/g, "");
        }

        if (value !== "") {
            result[key] = value;
        }
    }

    return result;
}

// ============== BINARY CHECKING ==============

/**
 * Check if a binary exists in PATH
 */
async function hasBinary(bin: string): Promise<boolean> {
    try {
        await execAsync(`which ${bin}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if required binaries are available
 */
async function checkRequirements(metadata?: OpenClawMetadata): Promise<boolean> {
    if (!metadata?.requires) return true;

    // Check required bins
    if (metadata.requires.bins) {
        for (const bin of metadata.requires.bins) {
            if (!(await hasBinary(bin))) {
                console.log(`[MarkdownSkill] Missing required binary: ${bin}`);
                return false;
            }
        }
    }

    // Check anyBins (at least one must exist)
    if (metadata.requires.anyBins && metadata.requires.anyBins.length > 0) {
        let hasAny = false;
        for (const bin of metadata.requires.anyBins) {
            if (await hasBinary(bin)) {
                hasAny = true;
                break;
            }
        }
        if (!hasAny) {
            console.log(`[MarkdownSkill] Missing any of required binaries: ${metadata.requires.anyBins.join(", ")}`);
            return false;
        }
    }

    // Check env vars
    if (metadata.requires.env) {
        for (const envVar of metadata.requires.env) {
            if (!process.env[envVar]) {
                console.log(`[MarkdownSkill] Missing required env var: ${envVar}`);
                return false;
            }
        }
    }

    return true;
}

// ============== SKILL LOADING ==============

/**
 * Load a single SKILL.md file
 */
export function loadMarkdownSkill(filePath: string): ParsedMarkdownSkill | null {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const { frontmatter, body } = parseFrontmatter(content);

        return {
            frontmatter,
            content: body,
            filePath,
            baseDir: path.dirname(filePath),
        };
    } catch (err) {
        console.error(`[MarkdownSkill] Failed to load ${filePath}:`, err);
        return null;
    }
}

/**
 * Load all SKILL.md files from a directory
 */
export function loadMarkdownSkillsFromDir(dir: string): ParsedMarkdownSkill[] {
    const skills: ParsedMarkdownSkill[] = [];

    if (!fs.existsSync(dir)) {
        return skills;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(dir, entry.name, "SKILL.md");
            if (fs.existsSync(skillPath)) {
                const skill = loadMarkdownSkill(skillPath);
                if (skill) {
                    skills.push(skill);
                }
            }
        }
    }

    return skills;
}

// ============== TOOL CREATION ==============

/**
 * Create an exec tool for a markdown skill
 * This tool allows the AI to execute shell commands described in the skill
 */
function createExecTool(skillName: string): SkillTool {
    const safeName = sanitizeToolName(skillName);
    return {
        name: `${safeName}_exec`,
        description: `Execute a shell command for the ${skillName} skill. Use commands from the skill documentation.`,
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The shell command to execute",
                },
            },
            required: ["command"],
        },
        execute: async (args): Promise<ToolResult> => {
            const command = args.command as string;

            // Security: basic validation
            if (!command || command.length > 2000) {
                return { success: false, content: "", error: "Invalid command" };
            }

            try {
                const { stdout, stderr } = await execAsync(command, {
                    timeout: 30000,
                    maxBuffer: 1024 * 1024,
                });

                const output = stdout || stderr || "(no output)";
                return {
                    success: true,
                    content: output.trim(),
                };
            } catch (err) {
                const error = err as { message?: string; stderr?: string };
                return {
                    success: false,
                    content: "",
                    error: error.stderr || error.message || "Command failed",
                };
            }
        },
    };
}

// ============== SKILL CONVERSION ==============

/**
 * Convert a parsed markdown skill to an OpenWhale Skill
 */
export async function markdownSkillToSkill(parsed: ParsedMarkdownSkill): Promise<Skill | null> {
    const { frontmatter, content } = parsed;
    const metadata = frontmatter.metadata?.openclaw;

    // Check requirements
    const meetsRequirements = await checkRequirements(metadata);

    // Create tools for this skill
    const tools: SkillTool[] = [
        createExecTool(frontmatter.name),
    ];

    // Add a help tool that returns the skill's documentation
    const safeName = sanitizeToolName(frontmatter.name);
    tools.push({
        name: `${safeName}_help`,
        description: `Get documentation and usage examples for the ${frontmatter.name} skill`,
        parameters: {
            type: "object",
            properties: {},
        },
        execute: async (): Promise<ToolResult> => {
            return {
                success: true,
                content: `# ${frontmatter.name} Skill\n\n${frontmatter.description}\n\n${content}`,
            };
        },
    });

    return createSkill(
        {
            name: frontmatter.name,
            description: frontmatter.description,
            version: "1.0.0",
            requiresAuth: !!(metadata?.requires?.env?.length),
            authConfigKey: metadata?.requires?.env?.[0],
        },
        tools,
        () => meetsRequirements
    );
}

/**
 * Load all markdown skills from default directories and convert to Skill objects
 */
export async function loadAllMarkdownSkills(): Promise<Skill[]> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const userSkillsDir = path.join(homeDir, ".openwhale", "skills");

    console.log(`[MarkdownSkill] Loading skills from ${userSkillsDir}`);

    const parsedSkills = loadMarkdownSkillsFromDir(userSkillsDir);
    console.log(`[MarkdownSkill] Found ${parsedSkills.length} markdown skills`);

    const skills: Skill[] = [];
    for (const parsed of parsedSkills) {
        const skill = await markdownSkillToSkill(parsed);
        if (skill) {
            skills.push(skill);
        }
    }

    return skills;
}

/**
 * Get the skill prompt for markdown skills (to inject into system prompt)
 */
export function getMarkdownSkillsPrompt(skills: ParsedMarkdownSkill[]): string {
    if (skills.length === 0) return "";

    const sections = skills.map(s => {
        const emoji = s.frontmatter.metadata?.openclaw?.emoji || "🔧";
        return `## ${emoji} ${s.frontmatter.name}\n${s.frontmatter.description}\n\n${s.content}`;
    });

    return `# Available Skills\n\n${sections.join("\n\n---\n\n")}`;
}
