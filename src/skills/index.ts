/**
 * Skills Registry - aggregates all skills and provides tool discovery
 */

export { skillRegistry, createSkill } from "./base.js";
export type { Skill, SkillMetadata, SkillStatus } from "./base.js";

// Import all skills
import { githubSkill } from "./github.js";
import { weatherSkill } from "./weather.js";
import { notionSkill } from "./notion.js";
import { onePasswordSkill } from "./onepassword.js";
import { appleNotesSkill, appleRemindersSkill } from "./apple.js";
import { twitterSkill } from "./twitter.js";
import { elevenlabsSkill } from "./elevenlabs.js";
import { twilioSkill } from "./twilio.js";

// Import Google skills
import { googleCalendarSkill } from "../integrations/google/calendar.js";
import { gmailSkill } from "../integrations/google/gmail.js";
import { googleDriveSkill } from "../integrations/google/drive.js";
import { googleTasksSkill } from "../integrations/google/tasks.js";

// Import markdown skill loader
import { loadAllMarkdownSkills } from "./markdown-loader.js";

import { skillRegistry } from "./base.js";

/**
 * Register all available skills
 */
export async function registerAllSkills(): Promise<void> {
    // Core skills
    skillRegistry.register(githubSkill);
    skillRegistry.register(weatherSkill);
    skillRegistry.register(notionSkill);
    skillRegistry.register(onePasswordSkill);
    skillRegistry.register(twitterSkill);
    skillRegistry.register(elevenlabsSkill);
    skillRegistry.register(twilioSkill);

    // Apple (macOS only)
    if (process.platform === "darwin") {
        skillRegistry.register(appleNotesSkill);
        skillRegistry.register(appleRemindersSkill);
    }

    // Google APIs
    skillRegistry.register(googleCalendarSkill);
    skillRegistry.register(gmailSkill);
    skillRegistry.register(googleDriveSkill);
    skillRegistry.register(googleTasksSkill);

    // Load markdown skills (OpenClaw-style SKILL.md files)
    try {
        const markdownSkills = await loadAllMarkdownSkills();
        for (const skill of markdownSkills) {
            skillRegistry.register(skill);
        }
        if (markdownSkills.length > 0) {
            console.log(`[Skills] Loaded ${markdownSkills.length} markdown skills`);
        }
    } catch (err) {
        console.error("[Skills] Failed to load markdown skills:", err);
    }

    console.log(`[Skills] Registered ${skillRegistry.list().length} skills`);
}

/**
 * Get summary of all skills and their status
 */
export function getSkillsSummary(): string {
    const skills = skillRegistry.list();
    const lines: string[] = ["🔧 **Available Skills**", ""];

    for (const skill of skills) {
        const status = skill.getStatus();
        const icon = status.ready ? "✅" : "❌";
        const toolCount = skill.getTools().length;
        lines.push(`${icon} **${skill.metadata.name}** (${toolCount} tools)`);
        lines.push(`   ${skill.metadata.description}`);
        if (!status.ready && skill.metadata.authConfigKey) {
            lines.push(`   ⚠️ Requires: \`${skill.metadata.authConfigKey}\``);
        }
    }

    return lines.join("\n");
}
