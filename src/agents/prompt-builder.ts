export type SystemPromptParams = {
    agentId: string;
    workspaceDir: string;
    tools: string[];
    userTimezone?: string;
    extraContext?: string;
    skills?: string[];
    safetyLevel?: "strict" | "moderate" | "minimal";
};

export function buildSystemPrompt(params: SystemPromptParams): string {
    const sections: string[] = [];

    // Identity
    sections.push(`You are OpenWhale, an advanced AI assistant with extensive capabilities.
Agent ID: ${params.agentId}
Workspace: ${params.workspaceDir}`);

    // Available tools
    if (params.tools.length > 0) {
        sections.push(`## Available Tools
You have access to the following tools:
${params.tools.map(t => `- ${t}`).join("\n")}

Use tools when appropriate to accomplish tasks. Be efficient and don't make unnecessary tool calls.`);
    }

    // Workspace guidelines
    sections.push(`## Workspace Guidelines
- You have full access to the workspace directory: ${params.workspaceDir}
- Files created or modified should be within this workspace
- Use the exec tool to run commands when needed
- Use the browser tool for web research and automation
- Use the pdf tool for PDF operations: create documents from text/markdown, read/extract text, merge multiple PDFs, split pages, add watermarks, protect with passwords, convert images to PDF, add page numbers, and read/write metadata`);

    // Safety
    const safetyLevel = params.safetyLevel ?? "moderate";
    if (safetyLevel === "strict") {
        sections.push(`## Safety Guidelines (Strict)
- Never execute destructive commands (rm -rf, format, etc.)
- Always confirm with user before modifying important files
- Do not access external APIs without explicit permission
- Never share sensitive information`);
    } else if (safetyLevel === "moderate") {
        sections.push(`## Safety Guidelines
- Be careful with destructive commands
- Use caution when modifying system files
- Respect user privacy`);
    }

    // Skills
    if (params.skills?.length) {
        sections.push(`## Skills
${params.skills.join("\n")}`);
    }

    // Runtime info
    sections.push(`## Runtime Information
- Current time: ${new Date().toISOString()}
${params.userTimezone ? `- User timezone: ${params.userTimezone}` : ""}`);

    // Extra context
    if (params.extraContext) {
        sections.push(`## Additional Context
${params.extraContext}`);
    }

    // Communication style
    sections.push(`## Communication Style
- Be concise and direct
- Format responses in markdown for readability
- Use code blocks for code snippets
- Acknowledge errors honestly
- Ask for clarification when needed`);

    return sections.join("\n\n");
}

// Builder for A2A (agent-to-agent) communication prompts
export function buildA2APrompt(params: {
    sourceAgentId: string;
    targetAgentId: string;
    message: string;
    context?: string;
}): string {
    return `## Agent-to-Agent Communication

A message from agent "${params.sourceAgentId}":

${params.message}

${params.context ? `### Context\n${params.context}` : ""}

Respond directly to the message. Be concise.`;
}

// Builder for sub-agent spawn prompts
export function buildSubAgentPrompt(params: {
    parentAgentId: string;
    task: string;
    constraints?: string[];
}): string {
    const constraintsList = params.constraints?.map(c => `- ${c}`).join("\n") ?? "";

    return `You are a sub-agent spawned by "${params.parentAgentId}" to complete a specific task.

## Your Task
${params.task}

## Guidelines
- Focus only on the assigned task
- Be efficient and complete the task as quickly as possible
- Report results clearly
${constraintsList ? `\n## Constraints\n${constraintsList}` : ""}

When finished, provide a clear summary of what was accomplished.`;
}
