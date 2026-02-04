/**
 * Weather Skill - OpenWeatherMap integration
 */

import { createSkill, type Skill, type SkillTool } from "./base.js";
import type { ToolResult } from "../tools/base.js";

const WEATHER_API = "https://api.openweathermap.org/data/2.5";

function weatherEmoji(code: string): string {
    const first = code[0];
    switch (first) {
        case "2": return "⛈️";  // Thunderstorm
        case "3": return "🌧️";  // Drizzle
        case "5": return "🌧️";  // Rain
        case "6": return "❄️";  // Snow
        case "7": return "🌫️";  // Atmosphere
        case "8": return code === "800" ? "☀️" : "☁️";  // Clear or Clouds
        default: return "🌡️";
    }
}

const tools: SkillTool[] = [
    {
        name: "weather_current",
        description: "Get current weather for a location",
        parameters: {
            type: "object",
            properties: {
                location: { type: "string", description: "City name or 'City, Country code'" },
                units: { type: "string", description: "Units: metric (°C) or imperial (°F)" },
            },
            required: ["location"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { location, units = "metric" } = args;
                const apiKey = process.env.OPENWEATHERMAP_API_KEY;
                if (!apiKey) return { success: false, content: "", error: "OPENWEATHERMAP_API_KEY not configured" };

                const res = await fetch(`${WEATHER_API}/weather?q=${encodeURIComponent(location as string)}&units=${units}&appid=${apiKey}`);
                const data = await res.json() as {
                    name: string;
                    sys: { country: string };
                    main: { temp: number; feels_like: number; humidity: number };
                    weather: Array<{ id: number; description: string }>;
                    wind: { speed: number };
                };

                const emoji = weatherEmoji(String(data.weather[0].id));
                const tempUnit = units === "metric" ? "°C" : "°F";
                const windUnit = units === "metric" ? "m/s" : "mph";

                return {
                    success: true,
                    content: [
                        `${emoji} **Weather in ${data.name}, ${data.sys.country}**`,
                        "",
                        `🌡️ Temperature: ${Math.round(data.main.temp)}${tempUnit}`,
                        `🤔 Feels like: ${Math.round(data.main.feels_like)}${tempUnit}`,
                        `💧 Humidity: ${data.main.humidity}%`,
                        `💨 Wind: ${data.wind.speed} ${windUnit}`,
                        `📋 Conditions: ${data.weather[0].description}`,
                    ].join("\n"),
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
    {
        name: "weather_forecast",
        description: "Get 5-day weather forecast for a location",
        parameters: {
            type: "object",
            properties: {
                location: { type: "string", description: "City name or 'City, Country code'" },
                units: { type: "string", description: "Units: metric (°C) or imperial (°F)" },
            },
            required: ["location"],
        },
        execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
            try {
                const { location, units = "metric" } = args;
                const apiKey = process.env.OPENWEATHERMAP_API_KEY;
                if (!apiKey) return { success: false, content: "", error: "OPENWEATHERMAP_API_KEY not configured" };

                const res = await fetch(`${WEATHER_API}/forecast?q=${encodeURIComponent(location as string)}&units=${units}&appid=${apiKey}`);
                const data = await res.json() as {
                    city: { name: string; country: string };
                    list: Array<{
                        dt: number;
                        main: { temp: number };
                        weather: Array<{ id: number; description: string }>;
                    }>;
                };

                const tempUnit = units === "metric" ? "°C" : "°F";

                // Get one forecast per day (noon)
                const daily = data.list.filter((_, i) => i % 8 === 4).slice(0, 5);
                const forecast = daily.map(d => {
                    const date = new Date(d.dt * 1000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    const emoji = weatherEmoji(String(d.weather[0].id));
                    return `${emoji} **${date}**: ${Math.round(d.main.temp)}${tempUnit} - ${d.weather[0].description}`;
                }).join("\n");

                return {
                    success: true,
                    content: `📅 **5-Day Forecast for ${data.city.name}, ${data.city.country}**\n\n${forecast}`,
                };
            } catch (err) {
                return { success: false, content: "", error: String(err) };
            }
        },
    },
];

export const weatherSkill: Skill = createSkill(
    {
        name: "weather",
        description: "Get current weather and forecasts",
        version: "1.0.0",
        requiresAuth: true,
        authConfigKey: "OPENWEATHERMAP_API_KEY",
    },
    tools,
    () => !!process.env.OPENWEATHERMAP_API_KEY
);
