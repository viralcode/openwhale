/**
 * Spotify Skill - Music playback control
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/api/token";

// Token storage
let spotifyToken: { access_token: string; expires_at: number } | null = null;

async function getSpotifyToken(): Promise<string> {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

    if (!clientId || !clientSecret) {
        throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET required");
    }

    // Check if token is still valid
    if (spotifyToken && Date.now() < spotifyToken.expires_at) {
        return spotifyToken.access_token;
    }

    // Use refresh token if available
    if (refreshToken) {
        const res = await fetch(SPOTIFY_AUTH_URL, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            }),
        });

        const data = await res.json() as { access_token: string; expires_in: number };
        spotifyToken = {
            access_token: data.access_token,
            expires_at: Date.now() + (data.expires_in * 1000),
        };
        return spotifyToken.access_token;
    }

    // Fall back to client credentials (limited functionality)
    const res = await fetch(SPOTIFY_AUTH_URL, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    const data = await res.json() as { access_token: string; expires_in: number };
    spotifyToken = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in * 1000),
    };
    return spotifyToken.access_token;
}

async function spotifyFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await getSpotifyToken();
    return fetch(`${SPOTIFY_API}${endpoint}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            ...options.headers,
        },
    });
}

function formatDuration(ms: number): string {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const tools: SkillTool[] = [
    {
        name: "spotify_now_playing",
        description: "Get currently playing track",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                const res = await spotifyFetch("/me/player/currently-playing");

                if (res.status === 204) {
                    return { success: true, content: "🎵 Nothing is currently playing" };
                }

                const data = await res.json() as {
                    item: { name: string; artists: Array<{ name: string }>; album: { name: string }; duration_ms: number };
                    is_playing: boolean;
                    progress_ms: number;
                };

                const track = data.item;
                const artists = track.artists.map(a => a.name).join(", ");
                const progress = formatDuration(data.progress_ms);
                const duration = formatDuration(track.duration_ms);

                return {
                    success: true,
                    content: [
                        `🎵 **Now Playing**${data.is_playing ? "" : " (Paused)"}`,
                        "",
                        `🎧 **${track.name}**`,
                        `👤 ${artists}`,
                        `💿 ${track.album.name}`,
                        `⏱️ ${progress} / ${duration}`,
                    ].join("\n"),
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "spotify_search",
        description: "Search Spotify for tracks, artists, albums, or playlists",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                type: { type: "string", description: "Type to search: track, artist, album, playlist" },
                limit: { type: "number", description: "Max results (default: 5)" },
            },
            required: ["query"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { query, type = "track", limit = 5 } = args;

                const params = new URLSearchParams({
                    q: query as string,
                    type: type as string,
                    limit: String(limit),
                });

                const res = await spotifyFetch(`/search?${params}`);
                const data = await res.json() as {
                    tracks?: { items: Array<{ name: string; artists: Array<{ name: string }>; uri: string }> };
                    artists?: { items: Array<{ name: string; followers: { total: number }; uri: string }> };
                    albums?: { items: Array<{ name: string; artists: Array<{ name: string }>; uri: string }> };
                    playlists?: { items: Array<{ name: string; owner: { display_name: string }; uri: string }> };
                };

                let formatted = "";

                if (data.tracks?.items) {
                    formatted = data.tracks.items.map(t =>
                        `🎵 **${t.name}**\n   by ${t.artists.map(a => a.name).join(", ")}`
                    ).join("\n\n");
                } else if (data.artists?.items) {
                    formatted = data.artists.items.map(a =>
                        `👤 **${a.name}**\n   ${a.followers.total.toLocaleString()} followers`
                    ).join("\n\n");
                } else if (data.albums?.items) {
                    formatted = data.albums.items.map(a =>
                        `💿 **${a.name}**\n   by ${a.artists.map(ar => ar.name).join(", ")}`
                    ).join("\n\n");
                } else if (data.playlists?.items) {
                    formatted = data.playlists.items.map(p =>
                        `📋 **${p.name}**\n   by ${p.owner.display_name}`
                    ).join("\n\n");
                }

                return { success: true, content: `🔍 **Search: "${query}"**\n\n${formatted || "No results"}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "spotify_play",
        description: "Start or resume playback",
        parameters: {
            type: "object",
            properties: {
                uri: { type: "string", description: "Spotify URI to play (track, album, playlist)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { uri } = args;
                const body = uri ? { uris: [uri] } : undefined;

                await spotifyFetch("/me/player/play", {
                    method: "PUT",
                    body: body ? JSON.stringify(body) : undefined,
                });

                return { success: true, content: uri ? `▶️ Playing: ${uri}` : "▶️ Resumed playback" };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "spotify_pause",
        description: "Pause playback",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                await spotifyFetch("/me/player/pause", { method: "PUT" });
                return { success: true, content: "⏸️ Paused" };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "spotify_next",
        description: "Skip to next track",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                await spotifyFetch("/me/player/next", { method: "POST" });
                return { success: true, content: "⏭️ Skipped to next track" };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "spotify_previous",
        description: "Go to previous track",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                await spotifyFetch("/me/player/previous", { method: "POST" });
                return { success: true, content: "⏮️ Previous track" };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const spotifySkill: Skill = createSkill(
    {
        name: "spotify",
        description: "Spotify integration - music playback and search",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "SPOTIFY_CLIENT_ID",
    },
    tools,
    () => !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
);
