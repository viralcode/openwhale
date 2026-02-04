/**
 * Google Calendar Skill
 */

import { createSkill, type Skill, type SkillTool } from "../../skills/base.js";
import type { ToolResult } from "../../tools/base.js";
import { googleFetch, isGoogleConfigured, hasValidToken } from "./auth.js";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const tools: SkillTool[] = [
    {
        name: "calendar_list",
        description: "List your Google calendars",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                const res = await googleFetch(`${CALENDAR_API}/users/me/calendarList`);
                const data = await res.json() as { items: Array<{ id: string; summary: string; primary?: boolean }> };

                const formatted = data.items?.map(c =>
                    `📅 **${c.summary}**${c.primary ? " (Primary)" : ""}\n   ID: \`${c.id}\``
                ).join("\n\n") || "No calendars";

                return { success: true, content: `📅 **Your Calendars**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "calendar_today",
        description: "Get today's agenda from your primary calendar",
        parameters: { type: "object", properties: {} },
        execute: async (): Promise<ToolResult> => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const params = new URLSearchParams({
                    timeMin: today.toISOString(),
                    timeMax: tomorrow.toISOString(),
                    singleEvents: "true",
                    orderBy: "startTime",
                });

                const res = await googleFetch(`${CALENDAR_API}/calendars/primary/events?${params}`);
                const data = await res.json() as { items: Array<{ summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string } }> };

                if (!data.items?.length) {
                    return { success: true, content: "📅 **Today's Agenda**\n\nNo events scheduled." };
                }

                const formatted = data.items.map(e => {
                    const start = e.start.dateTime
                        ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "All day";
                    return `⏰ ${start} - **${e.summary}**`;
                }).join("\n");

                return { success: true, content: `📅 **Today's Agenda**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "calendar_upcoming",
        description: "Get upcoming events",
        parameters: {
            type: "object",
            properties: {
                days: { type: "number", description: "Number of days to look ahead (default: 7)" },
                max: { type: "number", description: "Maximum events to return (default: 10)" },
            },
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { days = 7, max = 10 } = args;

                const now = new Date();
                const until = new Date();
                until.setDate(until.getDate() + (days as number));

                const params = new URLSearchParams({
                    timeMin: now.toISOString(),
                    timeMax: until.toISOString(),
                    singleEvents: "true",
                    orderBy: "startTime",
                    maxResults: String(max),
                });

                const res = await googleFetch(`${CALENDAR_API}/calendars/primary/events?${params}`);
                const data = await res.json() as { items: Array<{ summary: string; start: { dateTime?: string; date?: string } }> };

                if (!data.items?.length) {
                    return { success: true, content: `📅 **Next ${days} Days**\n\nNo events scheduled.` };
                }

                const formatted = data.items.map(e => {
                    const date = e.start.dateTime
                        ? new Date(e.start.dateTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : new Date(e.start.date!).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
                    return `📌 ${date}\n   **${e.summary}**`;
                }).join("\n\n");

                return { success: true, content: `📅 **Next ${days} Days**\n\n${formatted}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "calendar_create_event",
        description: "Create a new calendar event",
        parameters: {
            type: "object",
            properties: {
                summary: { type: "string", description: "Event title" },
                start: { type: "string", description: "Start time (ISO format)" },
                end: { type: "string", description: "End time (ISO format)" },
                description: { type: "string", description: "Event description" },
                location: { type: "string", description: "Location" },
            },
            required: ["summary", "start", "end"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { summary, start, end, description, location } = args;

                const event = {
                    summary,
                    description,
                    location,
                    start: { dateTime: start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                };

                const res = await googleFetch(`${CALENDAR_API}/calendars/primary/events`, {
                    method: "POST",
                    body: JSON.stringify(event),
                });

                const created = await res.json() as { id: string; htmlLink: string };

                return { success: true, content: `✅ **Event Created**\n\n📅 ${summary}\n🔗 ${created.htmlLink}` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "calendar_delete_event",
        description: "Delete a calendar event",
        parameters: {
            type: "object",
            properties: {
                event_id: { type: "string", description: "Event ID to delete" },
            },
            required: ["event_id"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { event_id } = args;

                await googleFetch(`${CALENDAR_API}/calendars/primary/events/${event_id}`, {
                    method: "DELETE",
                });

                return { success: true, content: `✅ Event deleted` };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const googleCalendarSkill: Skill = createSkill(
    {
        name: "google_calendar",
        description: "Google Calendar integration - events, scheduling, agenda",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "GOOGLE_CLIENT_ID",
    },
    tools,
    () => isGoogleConfigured() && hasValidToken()
);
