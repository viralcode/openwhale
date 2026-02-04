/**
 * Google APIs Integration - OAuth2 and shared utilities
 * 
 * Supports:
 * - Google Calendar
 * - Gmail
 * - Google Drive
 * - Google Tasks
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Store tokens in persistent location (same as client.ts)
const CONFIG_DIR = join(homedir(), ".openwhale", "google");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
}

// In-memory token storage - synced from file
let googleTokens: GoogleTokens | null = null;
let credentialsLoaded = false;

/**
 * Load credentials from file and set env vars
 */
function loadCredentialsFromFile(): boolean {
    if (credentialsLoaded) return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    try {
        if (existsSync(CREDENTIALS_PATH)) {
            const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
            const { client_id, client_secret } = credentials.installed || credentials.web || {};
            if (client_id && client_secret) {
                process.env.GOOGLE_CLIENT_ID = client_id;
                process.env.GOOGLE_CLIENT_SECRET = client_secret;
                console.log("[Google Auth] Loaded credentials from file");
            }
        }

        // Also load tokens if they exist
        if (existsSync(TOKEN_PATH) && !googleTokens) {
            const tokens = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
            googleTokens = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expiry_date || (Date.now() + 3600000), // Default 1hr if not set
            };
            console.log("[Google Auth] Loaded tokens from file");
        }

        credentialsLoaded = true;
    } catch (err) {
        console.warn("[Google Auth] Failed to load from file:", err);
        credentialsLoaded = true;
    }

    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Check if Google is configured
 */
export function isGoogleConfigured(): boolean {
    // Try to load from file first
    loadCredentialsFromFile();
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Check if we have a valid token (or can refresh one)
 */
export function hasValidToken(): boolean {
    // Try to load from file first
    loadCredentialsFromFile();

    if (!googleTokens) {
        console.log("[Google Auth] hasValidToken: No tokens loaded");
        return false;
    }

    // If we have a refresh token, we can always get a new access token
    if (googleTokens.refresh_token) {
        return true;
    }

    // No refresh token, check if access token is still valid
    if (googleTokens.expires_at && Date.now() > googleTokens.expires_at) {
        console.log("[Google Auth] hasValidToken: Token expired and no refresh token");
        return false;
    }
    return true;
}

/**
 * Set tokens (called after OAuth flow completes)
 */
export function setGoogleTokens(tokens: GoogleTokens): void {
    googleTokens = tokens;
}

/**
 * Get the current access token, refreshing if needed
 */
export async function getAccessToken(): Promise<string> {
    if (!googleTokens) {
        throw new Error("Not authenticated with Google. Run OAuth flow first.");
    }

    // Check if token needs refresh
    if (googleTokens.expires_at && Date.now() > googleTokens.expires_at - 60000) {
        if (!googleTokens.refresh_token) {
            throw new Error("Token expired and no refresh token available");
        }
        await refreshToken();
    }

    return googleTokens.access_token;
}

/**
 * Refresh the access token
 */
async function refreshToken(): Promise<void> {
    if (!googleTokens?.refresh_token) {
        throw new Error("No refresh token available");
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: googleTokens.refresh_token,
            grant_type: "refresh_token",
        }),
    });

    const data = await res.json() as { access_token: string; expires_in: number };

    googleTokens = {
        access_token: data.access_token,
        refresh_token: googleTokens.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
    };
}

/**
 * Generate OAuth2 authorization URL
 */
export function getAuthUrl(scopes: string[], redirectUri: string): string {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        prompt: "consent",
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        }),
    });

    const data = await res.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number
    };

    const tokens: GoogleTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
    };

    googleTokens = tokens;
    return tokens;
}

/**
 * Make authenticated request to Google API
 */
export async function googleFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const accessToken = await getAccessToken();

    return fetch(url, {
        ...options,
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
}
