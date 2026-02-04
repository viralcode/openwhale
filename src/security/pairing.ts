/**
 * DM Pairing Security - Approve unknown senders via pairing codes
 */

import { randomBytes } from "crypto";

// Storage for approved numbers and pending pairing codes
const approvedNumbers = new Set<string>();
const pairingCodes = new Map<string, { number: string; expires: Date }>();

// Default approved number (owner)
const OWNER_NUMBER = process.env.OWNER_PHONE || "";
if (OWNER_NUMBER) {
    approvedNumbers.add(OWNER_NUMBER);
}

/**
 * Check if a number is approved for DMs
 */
export function isApproved(phoneNumber: string): boolean {
    return approvedNumbers.has(normalizeNumber(phoneNumber));
}

/**
 * Generate a pairing code for a number
 */
export function generatePairingCode(phoneNumber: string): string {
    const normalized = normalizeNumber(phoneNumber);

    // Generate a 6-digit code
    const code = randomBytes(3).toString("hex").toUpperCase().slice(0, 6);

    // Store with 10-minute expiration
    pairingCodes.set(code, {
        number: normalized,
        expires: new Date(Date.now() + 10 * 60 * 1000),
    });

    console.log(`[Pairing] Generated code ${code} for ${normalized}`);
    return code;
}

/**
 * Verify a pairing code and approve the number
 */
export function verifyPairingCode(code: string): { success: boolean; number?: string; error?: string } {
    const entry = pairingCodes.get(code.toUpperCase());

    if (!entry) {
        return { success: false, error: "Invalid pairing code" };
    }

    if (entry.expires < new Date()) {
        pairingCodes.delete(code);
        return { success: false, error: "Pairing code expired" };
    }

    // Approve the number
    approvedNumbers.add(entry.number);
    pairingCodes.delete(code);

    console.log(`[Pairing] Approved: ${entry.number}`);
    return { success: true, number: entry.number };
}

/**
 * Approve a number directly (for owner use)
 */
export function approveNumber(phoneNumber: string): void {
    approvedNumbers.add(normalizeNumber(phoneNumber));
}

/**
 * Revoke approval for a number
 */
export function revokeNumber(phoneNumber: string): void {
    approvedNumbers.delete(normalizeNumber(phoneNumber));
}

/**
 * List all approved numbers
 */
export function listApprovedNumbers(): string[] {
    return Array.from(approvedNumbers);
}

/**
 * Normalize phone number format
 */
function normalizeNumber(number: string): string {
    // Remove all non-digits
    return number.replace(/\D/g, "");
}

/**
 * Handle an incoming message from an unapproved sender
 */
export function handleUnapprovedMessage(phoneNumber: string): string {
    // Check if they sent a pairing code
    const code = generatePairingCode(phoneNumber);

    return [
        "⚠️ **Pairing Required**",
        "",
        "This number is not yet approved to send messages.",
        "",
        "To pair, ask the owner to share this code:",
        `\`${code}\``,
        "",
        "Then reply with the code to complete pairing.",
        "",
        "_Code expires in 10 minutes._",
    ].join("\n");
}

/**
 * Process a potential pairing response
 */
export function processPairingResponse(message: string): { isPairing: boolean; response?: string } {
    // Check if message looks like a pairing code (6 hex characters)
    const cleaned = message.trim().toUpperCase();

    if (/^[0-9A-F]{6}$/.test(cleaned)) {
        const result = verifyPairingCode(cleaned);

        if (result.success) {
            return {
                isPairing: true,
                response: [
                    "✅ **Pairing Complete!**",
                    "",
                    "Your number has been approved.",
                    "You can now send messages normally.",
                ].join("\n"),
            };
        } else {
            return {
                isPairing: true,
                response: `❌ ${result.error}`,
            };
        }
    }

    return { isPairing: false };
}
