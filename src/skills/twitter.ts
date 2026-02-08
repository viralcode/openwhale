/**
 * Twitter/X Skill - Twitter integration via bird CLI
 * Uses cookie-based authentication, no API keys required
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface BirdTweet {
    id: string;
    text: string;
    author: {
        username: string;
        name: string;
    };
    created_at: string;
    retweet_count?: number;
    like_count?: number;
}

interface BirdMention extends BirdTweet {
    in_reply_to_status_id?: string;
}

async function birdExec(command: string): Promise<string> {
    try {
        const { stdout } = await execAsync(`bird ${command}`);
        return stdout;
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        throw new Error(`bird CLI error: ${error}`);
    }
}

export async function checkBirdAvailable(): Promise<boolean> {
    try {
        await execAsync("which bird");
        return true;
    } catch {
        return false;
    }
}

const tools: SkillTool[] = [
    {
        name: "twitter_timeline",
        description: "Get your Twitter/X home timeline",
        parameters: {
            type: "object",
            properties: {
                count: { type: "number", description: "Number of tweets to fetch (default 10, max 50)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const count = Math.min(Number(args.count) || 10, 50);
                const stdout = await birdExec(`home -n ${count} --json`);
                const tweets: BirdTweet[] = JSON.parse(stdout);

                const formatted = tweets.map(t =>
                    `🐦 **@${t.author.username}** (${t.author.name})\n${t.text}\n❤️ ${t.like_count || 0} | 🔁 ${t.retweet_count || 0}`
                ).join("\n\n---\n\n");

                return { success: true, content: `📰 **Timeline** (${tweets.length} tweets)\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_mentions",
        description: "Get your recent mentions on Twitter/X",
        parameters: {
            type: "object",
            properties: {
                count: { type: "number", description: "Number of mentions to fetch (default 10)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const count = Math.min(Number(args.count) || 10, 50);
                const stdout = await birdExec(`mentions -n ${count} --json`);
                const mentions: BirdMention[] = JSON.parse(stdout);

                const formatted = mentions.map(m =>
                    `📢 **@${m.author.username}**\n${m.text}\n🆔 ${m.id}`
                ).join("\n\n---\n\n");

                return { success: true, content: `📬 **Mentions** (${mentions.length})\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_post",
        description: "Post a new tweet on Twitter/X",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string", description: "The tweet text (max 280 chars)" },
                media: { type: "string", description: "Optional path to image/video to attach" },
            },
            required: ["text"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { text, media } = args as { text: string; media?: string };

                // Escape the text for shell
                const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`');
                let command = `tweet "${escapedText}"`;

                if (media) {
                    command += ` --media "${media}"`;
                }

                const stdout = await birdExec(command);

                // Try to parse response for tweet ID
                try {
                    const result = JSON.parse(stdout);
                    return { success: true, content: `✅ Tweet posted!\n🆔 ${result.id || result.id_str || "Posted successfully"}` };
                } catch {
                    return { success: true, content: `✅ Tweet posted!\n${stdout}` };
                }
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_reply",
        description: "Reply to a tweet on Twitter/X",
        parameters: {
            type: "object",
            properties: {
                tweetId: { type: "string", description: "ID of the tweet to reply to" },
                text: { type: "string", description: "The reply text (max 280 chars)" },
            },
            required: ["tweetId", "text"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { tweetId, text } = args as { tweetId: string; text: string };

                const escapedText = text.replace(/"/g, '\\"').replace(/`/g, '\\`');
                const stdout = await birdExec(`reply "${tweetId}" "${escapedText}"`);

                try {
                    const result = JSON.parse(stdout);
                    return { success: true, content: `✅ Reply sent!\n🆔 ${result.id || "Replied successfully"}` };
                } catch {
                    return { success: true, content: `✅ Reply sent!\n${stdout}` };
                }
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_search",
        description: "Search for tweets on Twitter/X",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                count: { type: "number", description: "Number of results (default 10)" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query, count = 10 } = args as { query: string; count?: number };
                const escapedQuery = query.replace(/"/g, '\\"');
                const stdout = await birdExec(`search "${escapedQuery}" -n ${count} --json`);
                const tweets: BirdTweet[] = JSON.parse(stdout);

                const formatted = tweets.map(t =>
                    `🐦 **@${t.author.username}**\n${t.text}\n❤️ ${t.like_count || 0} | 🔁 ${t.retweet_count || 0}`
                ).join("\n\n---\n\n");

                return { success: true, content: `🔍 **Search: "${query}"** (${tweets.length} results)\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_user",
        description: "Get information about a Twitter/X user",
        parameters: {
            type: "object",
            properties: {
                username: { type: "string", description: "Username (without @)" },
            },
            required: ["username"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { username } = args as { username: string };
                const stdout = await birdExec(`about @${username} --json`);
                const user = JSON.parse(stdout);

                return {
                    success: true,
                    content: `👤 **@${user.username}** (${user.name})\n📝 ${user.description || "(No bio)"}\n👥 ${user.followers_count} followers | ${user.following_count} following\n📍 ${user.location || "N/A"}\n🔗 ${user.url || "N/A"}`
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_follow",
        description: "Follow a user on Twitter/X",
        parameters: {
            type: "object",
            properties: {
                username: { type: "string", description: "Username to follow (without @)" },
            },
            required: ["username"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { username } = args as { username: string };
                await birdExec(`follow @${username}`);
                return { success: true, content: `✅ Now following @${username}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "twitter_bookmarks",
        description: "Get your bookmarked tweets on Twitter/X",
        parameters: {
            type: "object",
            properties: {
                count: { type: "number", description: "Number of bookmarks to fetch (default 10)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const count = Math.min(Number(args.count) || 10, 50);
                const stdout = await birdExec(`bookmarks -n ${count} --json`);
                const tweets: BirdTweet[] = JSON.parse(stdout);

                const formatted = tweets.map(t =>
                    `🔖 **@${t.author.username}**\n${t.text}`
                ).join("\n\n---\n\n");

                return { success: true, content: `� **Bookmarks** (${tweets.length})\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const twitterSkill: Skill = createSkill(
    {
        name: "twitter",
        description: "Twitter/X integration for posting tweets, reading timeline, mentions, and more",
        version: "1.0.0",
        requiresAuth: false, // Uses bird CLI with cookie auth
        authConfigKey: "TWITTER_ENABLED",
    },
    tools,
    () => process.env.TWITTER_ENABLED === "true"
);
