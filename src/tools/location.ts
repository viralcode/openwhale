/**
 * Location Tool - GPS and geocoding
 */

import { z } from "zod";
import type { AgentTool, ToolResult } from "./base.js";

async function getLocationByIP(): Promise<{ lat: number; lon: number; city: string; country: string } | null> {
    try {
        const res = await fetch("http://ip-api.com/json/?fields=lat,lon,city,country");
        const data = await res.json() as { lat: number; lon: number; city: string; country: string };
        return data;
    } catch {
        return null;
    }
}

async function geocode(address: string): Promise<{ lat: number; lon: number; display: string } | null> {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
            headers: { "User-Agent": "OpenWhale/1.0" }
        });
        const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
        if (data[0]) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                display: data[0].display_name,
            };
        }
    } catch {
        // Ignore
    }
    return null;
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { "User-Agent": "OpenWhale/1.0" }
        });
        const data = await res.json() as { display_name: string };
        return data.display_name;
    } catch {
        return null;
    }
}

export const locationGetTool: AgentTool<{ use_ip?: boolean }> = {
    name: "location_get",
    description: "Get current location via IP geolocation",
    category: "device",
    parameters: z.object({
        use_ip: z.boolean().optional().describe("Use IP-based location (default: true)"),
    }),
    execute: async (_params, _context): Promise<ToolResult> => {
        try {
            const ipLoc = await getLocationByIP();

            if (!ipLoc) {
                return { success: false, content: "", error: "Could not determine location" };
            }

            const address = await reverseGeocode(ipLoc.lat, ipLoc.lon);

            return {
                success: true,
                content: [
                    "📍 **Current Location**",
                    "",
                    `Lat: ${ipLoc.lat.toFixed(6)}`,
                    `Lon: ${ipLoc.lon.toFixed(6)}`,
                    address ? `📌 ${address}` : "",
                    "",
                    `_Source: IP geolocation_`,
                ].filter(Boolean).join("\n"),
                metadata: { lat: ipLoc.lat, lon: ipLoc.lon, source: "ip" },
            };
        } catch (err) {
            return { success: false, content: "", error: String(err) };
        }
    },
};

export const geocodeTool: AgentTool<{ address: string }> = {
    name: "location_geocode",
    description: "Convert an address to coordinates",
    category: "utility",
    parameters: z.object({
        address: z.string().describe("Address to geocode"),
    }),
    execute: async (params: { address: string }, _context): Promise<ToolResult> => {
        try {
            const result = await geocode(params.address);

            if (!result) {
                return { success: false, content: "", error: "Could not geocode address" };
            }

            return {
                success: true,
                content: [
                    `📍 **Geocode: "${params.address}"**`,
                    "",
                    `Lat: ${result.lat.toFixed(6)}`,
                    `Lon: ${result.lon.toFixed(6)}`,
                    `📌 ${result.display}`,
                ].join("\n"),
                metadata: result,
            };
        } catch (err) {
            return { success: false, content: "", error: String(err) };
        }
    },
};

export const reverseGeocodeTool: AgentTool<{ lat: number; lon: number }> = {
    name: "location_reverse",
    description: "Convert coordinates to an address",
    category: "utility",
    parameters: z.object({
        lat: z.number().describe("Latitude"),
        lon: z.number().describe("Longitude"),
    }),
    execute: async (params: { lat: number; lon: number }, _context): Promise<ToolResult> => {
        try {
            const address = await reverseGeocode(params.lat, params.lon);

            if (!address) {
                return { success: false, content: "", error: "Could not reverse geocode" };
            }

            return {
                success: true,
                content: `📍 ${address}`,
                metadata: { lat: params.lat, lon: params.lon, address },
            };
        } catch (err) {
            return { success: false, content: "", error: String(err) };
        }
    },
};

export const locationTools = [locationGetTool, geocodeTool, reverseGeocodeTool];
