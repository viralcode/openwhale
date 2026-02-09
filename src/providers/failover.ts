/**
 * Model Failover - Auto-switch providers on errors
 */

import type { AIProvider } from "../providers/index.js";
import { logger } from "../logger.js";

export interface FailoverConfig {
    providers: string[];  // Ordered list of provider names
    maxRetries: number;
    retryDelayMs: number;
}

const defaultFailoverConfig: FailoverConfig = {
    providers: [
        "anthropic",   // Primary
        "openai",      // First fallback
        "ollama",      // Local fallback
    ],
    maxRetries: 3,
    retryDelayMs: 1000,
};

let currentConfig = { ...defaultFailoverConfig };
let currentProviderIndex = 0;
let consecutiveFailures = 0;

/**
 * Configure failover behavior
 */
export function configureFailover(config: Partial<FailoverConfig>): void {
    currentConfig = { ...currentConfig, ...config };
    currentProviderIndex = 0;
    consecutiveFailures = 0;
}

/**
 * Get current failover configuration
 */
export function getFailoverConfig(): FailoverConfig {
    return { ...currentConfig };
}

/**
 * Record a successful call - resets failure count
 */
export function recordSuccess(): void {
    consecutiveFailures = 0;
}

/**
 * Record a failed call - may trigger failover
 */
export function recordFailure(error: Error): boolean {
    consecutiveFailures++;

    const shouldFailover =
        consecutiveFailures >= currentConfig.maxRetries ||
        isRateLimitError(error) ||
        isQuotaError(error) ||
        isProviderDownError(error);

    if (shouldFailover) {
        return switchToNextProvider();
    }

    return false;
}

/**
 * Switch to next provider in the chain
 */
function switchToNextProvider(): boolean {
    if (currentProviderIndex >= currentConfig.providers.length - 1) {
        console.error("[Failover] All providers exhausted!");
        logger.error("provider", "All failover providers exhausted");
        return false;
    }

    currentProviderIndex++;
    consecutiveFailures = 0;

    const newProvider = currentConfig.providers[currentProviderIndex];
    console.log(`[Failover] Switching to provider: ${newProvider}`);
    logger.warn("provider", `Failover: switching to ${newProvider}`, { index: currentProviderIndex });

    return true;
}

/**
 * Get current active provider name
 */
export function getCurrentProvider(): string {
    return currentConfig.providers[currentProviderIndex];
}

/**
 * Reset to primary provider
 */
export function resetToPrimary(): void {
    currentProviderIndex = 0;
    consecutiveFailures = 0;
    console.log(`[Failover] Reset to primary: ${currentConfig.providers[0]}`);
    logger.info("provider", `Failover reset to primary: ${currentConfig.providers[0]}`);
}

/**
 * Check if error is a rate limit
 */
function isRateLimitError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes("rate limit") ||
        msg.includes("429") ||
        msg.includes("too many requests");
}

/**
 * Check if error is a quota exceeded
 */
function isQuotaError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes("quota") ||
        msg.includes("insufficient_quota") ||
        msg.includes("billing");
}

/**
 * Check if provider is down
 */
function isProviderDownError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes("503") ||
        msg.includes("502") ||
        msg.includes("service unavailable") ||
        msg.includes("overloaded");
}

/**
 * Wrap an AI call with failover support
 */
export async function withFailover<T>(
    getProvider: (name: string) => AIProvider | undefined,
    operation: (provider: AIProvider) => Promise<T>
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < currentConfig.providers.length; attempt++) {
        const providerName = getCurrentProvider();
        const provider = getProvider(providerName);

        if (!provider) {
            console.warn(`[Failover] Provider not found: ${providerName}`);
            logger.warn("provider", `Failover: provider not found: ${providerName}`);
            switchToNextProvider();
            continue;
        }

        try {
            const result = await operation(provider);
            recordSuccess();
            return result;
        } catch (err) {
            lastError = err as Error;
            console.error(`[Failover] ${providerName} failed:`, lastError.message);
            logger.error("provider", `Failover: ${providerName} failed`, { error: lastError.message });

            const switched = recordFailure(lastError);
            if (!switched) {
                break;
            }

            // Brief delay before retry
            await new Promise(r => setTimeout(r, currentConfig.retryDelayMs));
        }
    }

    throw lastError || new Error("All providers failed");
}
