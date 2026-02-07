import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const CalendarActionSchema = z.object({
    action: z.enum(["create", "list", "delete", "search"]).describe("Action to perform"),
    // For create
    title: z.string().optional().describe("Event title"),
    startDate: z.string().optional().describe("Start date/time ISO 8601 (e.g. 2025-02-07T10:00:00)"),
    endDate: z.string().optional().describe("End date/time ISO 8601"),
    location: z.string().optional().describe("Event location"),
    notes: z.string().optional().describe("Event notes/description"),
    calendar: z.string().optional().default("Calendar").describe("Calendar name to use"),
    allDay: z.boolean().optional().default(false).describe("All-day event"),
    // For list
    days: z.number().optional().default(7).describe("Number of days to look ahead for list"),
    // For search/delete
    query: z.string().optional().describe("Search query for finding events"),
});

type CalendarAction = z.infer<typeof CalendarActionSchema>;

export const calendarEventTool: AgentTool<CalendarAction> = {
    name: "calendar_event",
    description: "Create, list, search, and delete Apple Calendar events on macOS using AppleScript.",
    category: "utility",
    parameters: CalendarActionSchema,

    async execute(params: CalendarAction, _context: ToolCallContext): Promise<ToolResult> {
        if (process.platform !== "darwin") {
            return { success: false, content: "", error: "Calendar tool only available on macOS" };
        }

        try {
            switch (params.action) {
                case "create": {
                    if (!params.title || !params.startDate) {
                        return { success: false, content: "", error: "title and startDate are required" };
                    }
                    const start = new Date(params.startDate);
                    const end = params.endDate ? new Date(params.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
                    const cal = params.calendar || "Calendar";

                    const script = `
                        tell application "Calendar"
                            tell calendar "${cal}"
                                set newEvent to make new event with properties {summary:"${params.title.replace(/"/g, '\\"')}", start date:date "${start.toLocaleString("en-US")}", end date:date "${end.toLocaleString("en-US")}"${params.allDay ? ", allday event:true" : ""}${params.location ? `, location:"${params.location.replace(/"/g, '\\"')}"` : ""}${params.notes ? `, description:"${params.notes.replace(/"/g, '\\"')}"` : ""}}
                                return uid of newEvent
                            end tell
                        end tell
                    `;

                    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
                    return {
                        success: true,
                        content: `Created event: "${params.title}" on ${start.toLocaleDateString()} at ${start.toLocaleTimeString()} → ${end.toLocaleTimeString()}${params.location ? ` at ${params.location}` : ""}`,
                        metadata: { uid: stdout.trim(), title: params.title, start: params.startDate, end: params.endDate },
                    };
                }

                case "list": {
                    const days = params.days || 7;
                    const script = `
                        set output to ""
                        tell application "Calendar"
                            set startDate to current date
                            set endDate to startDate + (${days} * days)
                            repeat with cal in calendars
                                set calEvents to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
                                repeat with evt in calEvents
                                    set output to output & (summary of evt) & " | " & (start date of evt as string) & " | " & (end date of evt as string) & " | " & (location of evt) & linefeed
                                end repeat
                            end repeat
                        end tell
                        return output
                    `;

                    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
                    const events = stdout.trim().split("\n").filter(Boolean).map(line => {
                        const [title, start, end, location] = line.split(" | ");
                        return { title: title?.trim(), start: start?.trim(), end: end?.trim(), location: location?.trim() };
                    });

                    return {
                        success: true,
                        content: events.length > 0
                            ? `Found ${events.length} events in the next ${days} days:\n${events.map(e => `• ${e.title} — ${e.start}${e.location ? ` (${e.location})` : ""}`).join("\n")}`
                            : `No events found in the next ${days} days.`,
                        metadata: { events, count: events.length },
                    };
                }

                case "search": {
                    if (!params.query) {
                        return { success: false, content: "", error: "query is required for search" };
                    }
                    const script = `
                        set output to ""
                        tell application "Calendar"
                            repeat with cal in calendars
                                set calEvents to (every event of cal whose summary contains "${params.query.replace(/"/g, '\\"')}")
                                repeat with evt in calEvents
                                    set output to output & (summary of evt) & " | " & (start date of evt as string) & " | " & (location of evt) & linefeed
                                end repeat
                            end repeat
                        end tell
                        return output
                    `;

                    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
                    return {
                        success: true,
                        content: stdout.trim() || `No events found matching "${params.query}"`,
                    };
                }

                case "delete": {
                    return {
                        success: false,
                        content: "",
                        error: "Delete requires manual confirmation. Use Calendar app to delete events.",
                    };
                }

                default:
                    return { success: false, content: "", error: `Unknown action: ${params.action}` };
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, content: "", error: `Calendar error: ${message}` };
        }
    },
};
