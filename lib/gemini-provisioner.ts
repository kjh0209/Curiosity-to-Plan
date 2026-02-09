/**
 * Gemini API Key Provisioner
 *
 * Simplified: Uses the key pool for all users.
 * - Users with their own real API key (AIza...) → use directly
 * - Legacy users with gemini_user_xxx keys → use pool
 * - New users without a key → use pool
 */

import { geminiKeyPool } from "./gemini-key-pool";

/**
 * Check if this is a legacy user-specific identifier (not a real API key)
 */
function isLegacyKey(key: string): boolean {
    return key.startsWith("gemini_user_");
}

/**
 * Resolve which Gemini API key to actually use for a request.
 *
 * Priority:
 * 1. User's own real Gemini key (starts with AIza)
 * 2. Key from the pool (distributed across projects)
 */
export function resolveGeminiKey(userKey: string | null, userId: string = ""): string {
    // User has their own real API key
    if (userKey && !isLegacyKey(userKey)) {
        return userKey;
    }

    // Use key pool
    return geminiKeyPool.getKeyForUser(userId) || "";
}

// Backward-compat exports
export function isUserSpecificKey(key: string): boolean {
    return isLegacyKey(key);
}

export async function provisionGeminiKey(_userId: string, _email: string): Promise<string | null> {
    // No longer provisions fake keys — pool handles distribution
    return null;
}

export function isDedicatedKeyProvisioningAvailable(): boolean {
    return geminiKeyPool.poolSize > 0;
}
