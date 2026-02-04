/**
 * GitHub Skill - GitHub integration
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const GITHUB_API = "https://api.github.com";

async function githubFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    return fetch(`${GITHUB_API}${endpoint}`, {
        ...options,
        headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "OpenWhale/1.0",
            ...options.headers,
        },
    });
}

const tools: SkillTool[] = [
    {
        name: "github_repos",
        description: "List your GitHub repositories",
        parameters: {
            type: "object",
            properties: {
                type: { type: "string", description: "Filter by type: all, owner, public, private, member" },
                sort: { type: "string", description: "Sort by: created, updated, pushed, full_name" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const params = new URLSearchParams();
                if (args.type) params.append("type", args.type as string);
                if (args.sort) params.append("sort", args.sort as string);

                const res = await githubFetch(`/user/repos?${params}`);
                const repos = await res.json() as Array<{ full_name: string; description: string; stargazers_count: number; language: string }>;

                const formatted = repos.slice(0, 10).map(r =>
                    `📁 **${r.full_name}**\n   ⭐ ${r.stargazers_count} | ${r.language || "N/A"}\n   ${r.description || "(No description)"}`
                ).join("\n\n");

                return { success: true, content: `📚 **Your Repositories**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "github_issues",
        description: "List issues for a repository",
        parameters: {
            type: "object",
            properties: {
                repo: { type: "string", description: "Repository in owner/repo format" },
                state: { type: "string", description: "Filter by state: open, closed, all" },
            },
            required: ["repo"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { repo, state = "open" } = args;
                const res = await githubFetch(`/repos/${repo}/issues?state=${state}`);
                const issues = await res.json() as Array<{ number: number; title: string; state: string; user: { login: string } }>;

                const formatted = issues.slice(0, 10).map(i =>
                    `#${i.number} ${i.title}\n   by @${i.user.login} | ${i.state}`
                ).join("\n\n");

                return { success: true, content: `🐛 **Issues for ${repo}**\n\n${formatted || "No issues"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "github_create_issue",
        description: "Create a new GitHub issue",
        parameters: {
            type: "object",
            properties: {
                repo: { type: "string", description: "Repository in owner/repo format" },
                title: { type: "string", description: "Issue title" },
                body: { type: "string", description: "Issue body/description" },
            },
            required: ["repo", "title"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { repo, title, body } = args;
                const res = await githubFetch(`/repos/${repo}/issues`, {
                    method: "POST",
                    body: JSON.stringify({ title, body }),
                });
                const issue = await res.json() as { number: number; html_url: string };

                return { success: true, content: `✅ Created issue #${issue.number}\n${issue.html_url}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "github_prs",
        description: "List pull requests for a repository",
        parameters: {
            type: "object",
            properties: {
                repo: { type: "string", description: "Repository in owner/repo format" },
                state: { type: "string", description: "Filter by state: open, closed, all" },
            },
            required: ["repo"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { repo, state = "open" } = args;
                const res = await githubFetch(`/repos/${repo}/pulls?state=${state}`);
                const prs = await res.json() as Array<{ number: number; title: string; user: { login: string }; draft: boolean }>;

                const formatted = prs.slice(0, 10).map(pr =>
                    `#${pr.number} ${pr.title}${pr.draft ? " (draft)" : ""}\n   by @${pr.user.login}`
                ).join("\n\n");

                return { success: true, content: `🔀 **Pull Requests for ${repo}**\n\n${formatted || "No PRs"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "github_search",
        description: "Search GitHub for code, repos, issues, or users",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                type: { type: "string", description: "Search type: repositories, code, issues, users" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query, type = "repositories" } = args;
                const res = await githubFetch(`/search/${type}?q=${encodeURIComponent(query as string)}`);
                const data = await res.json() as { items: Array<{ full_name?: string; name?: string; login?: string; title?: string; html_url: string }> };

                const formatted = data.items?.slice(0, 10).map(item => {
                    const name = item.full_name || item.name || item.login || item.title;
                    return `📌 **${name}**\n   ${item.html_url}`;
                }).join("\n\n") || "No results";

                return { success: true, content: `🔍 **Search: "${query}"**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const githubSkill: Skill = createSkill(
    {
        name: "github",
        description: "GitHub integration for repos, issues, and pull requests",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "GITHUB_TOKEN",
    },
    tools,
    () => !!process.env.GITHUB_TOKEN
);
