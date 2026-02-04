/**
 * Google API OAuth Client
 * Handles authentication for Gmail, Calendar, Drive, Tasks
 */

import { google, Auth } from "googleapis";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Scopes for all Google services
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/tasks.readonly",
    "https://www.googleapis.com/auth/tasks",
];

// Store tokens in persistent location
const CONFIG_DIR = join(homedir(), ".openwhale", "google");
const TOKEN_PATH = join(CONFIG_DIR, "token.json");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

let oauth2Client: Auth.OAuth2Client | null = null;
let isAuthenticated = false;

/**
 * Initialize OAuth client from credentials
 */
export function initializeGoogleAuth(): Auth.OAuth2Client | null {
    try {
        // Ensure config directory exists
        if (!existsSync(CONFIG_DIR)) {
            mkdirSync(CONFIG_DIR, { recursive: true });
        }

        // Check for credentials file
        if (!existsSync(CREDENTIALS_PATH)) {
            console.log("[Google] No credentials.json found at", CREDENTIALS_PATH);
            console.log("[Google] Copy your Google OAuth credentials to:", CREDENTIALS_PATH);
            return null;
        }

        const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
        const { client_id, client_secret } = credentials.installed || credentials.web;

        // Always use our dashboard callback URL - for desktop apps, you need to add this
        // to your OAuth consent screen's authorized redirect URIs in Google Cloud Console
        const redirectUri = "http://localhost:7777/dashboard/callback/google";

        oauth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirectUri
        );

        // Try to load existing tokens
        if (existsSync(TOKEN_PATH)) {
            const tokens = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
            oauth2Client.setCredentials(tokens);
            isAuthenticated = true;
            console.log("[Google] Loaded existing tokens");
        }

        return oauth2Client;
    } catch (err) {
        console.error("[Google] Failed to initialize auth:", err);
        return null;
    }
}

/**
 * Get the OAuth2 client
 */
export function getGoogleAuth(): Auth.OAuth2Client | null {
    if (!oauth2Client) {
        return initializeGoogleAuth();
    }
    return oauth2Client;
}

/**
 * Check if authenticated
 */
export function isGoogleAuthenticated(): boolean {
    return isAuthenticated && oauth2Client !== null;
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthUrl(): string | null {
    const client = getGoogleAuth();
    if (!client) return null;

    return client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
    });
}

/**
 * Exchange authorization code for tokens
 */
export async function handleAuthCallback(code: string): Promise<boolean> {
    const client = getGoogleAuth();
    if (!client) return false;

    try {
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        // Save tokens for future use
        writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        isAuthenticated = true;
        console.log("[Google] Successfully authenticated and saved tokens");
        return true;
    } catch (err) {
        console.error("[Google] Failed to exchange code for tokens:", err);
        return false;
    }
}

/**
 * Revoke authentication
 */
export async function revokeAuth(): Promise<void> {
    if (oauth2Client) {
        try {
            await oauth2Client.revokeCredentials();
        } catch (e) {
            // Ignore errors
        }
    }
    isAuthenticated = false;
    if (existsSync(TOKEN_PATH)) {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(TOKEN_PATH);
    }
}

/**
 * Get credentials path for dashboard display
 */
export function getCredentialsPath(): string {
    return CREDENTIALS_PATH;
}

/**
 * Copy credentials from a path
 */
export function copyCredentials(sourcePath: string): boolean {
    try {
        if (!existsSync(CONFIG_DIR)) {
            mkdirSync(CONFIG_DIR, { recursive: true });
        }
        const content = readFileSync(sourcePath, "utf-8");
        writeFileSync(CREDENTIALS_PATH, content);
        console.log("[Google] Copied credentials from", sourcePath);
        return true;
    } catch (err) {
        console.error("[Google] Failed to copy credentials:", err);
        return false;
    }
}
