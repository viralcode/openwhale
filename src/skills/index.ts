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

// Import Google skills
import { googleCalendarSkill } from "../integrations/google/calendar.js";
import { gmailSkill } from "../integrations/google/gmail.js";
import { googleDriveSkill } from "../integrations/google/drive.js";
import { googleTasksSkill } from "../integrations/google/tasks.js";

import { skillRegistry } from "./base.js";

/**
 * Register all available skills
 */
export function registerAllSkills(): void {
    // Core skills
    skillRegistry.register(githubSkill);
    skillRegistry.register(weatherSkill);
    skillRegistry.register(notionSkill);
    skillRegistry.register(onePasswordSkill);

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
