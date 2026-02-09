/**
 * Gemini API Key Pool
 *
 * Manages multiple Gemini API keys from different Google Cloud projects.
 * Each project has its own independent free tier quota, so distributing
 * users across multiple keys maximizes free tier usage.
 *
 * Setup: Set GEMINI_API_KEYS=key1,key2,key3 in .env
 * Falls back to GEMINI_API_KEY for single-key setups.
 */

import crypto from "crypto";

interface KeyState {
    key: string;
    cooldownUntil: number; // timestamp ms
    failCount: number;
}

class GeminiKeyPool {
    private keys: KeyState[] = [];

    constructor() {
        this.loadKeys();
    }

    private loadKeys() {
        // Priority: GEMINI_API_KEYS (comma-separated pool) > GEMINI_API_KEY (single)
        const multiKeys = process.env.GEMINI_API_KEYS;
        if (multiKeys) {
            const keyList = multiKeys
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0);
            this.keys = keyList.map((key) => ({
                key,
                cooldownUntil: 0,
                failCount: 0,
            }));
        }

        if (this.keys.length === 0) {
            const singleKey = process.env.GEMINI_API_KEY;
            if (singleKey) {
                this.keys = [{ key: singleKey, cooldownUntil: 0, failCount: 0 }];
            }
        }

        if (this.keys.length > 0) {
            console.log(`Gemini key pool initialized with ${this.keys.length} key(s)`);
        }
    }

    get poolSize(): number {
        return this.keys.length;
    }

    /**
     * Consistent hash: same user always maps to same primary key
     */
    private hashUser(userId: string): number {
        if (this.keys.length === 0) return -1;
        const hash = crypto.createHash("md5").update(userId).digest();
        return hash.readUInt32BE(0) % this.keys.length;
    }

    /**
     * Get an available API key for a user.
     * Starts with the user's assigned key, rotates if in cooldown.
     */
    getKeyForUser(userId: string): string | null {
        if (this.keys.length === 0) return null;

        const now = Date.now();
        const startIndex = this.hashUser(userId);

        // Try each key starting from user's assigned one
        for (let i = 0; i < this.keys.length; i++) {
            const index = (startIndex + i) % this.keys.length;
            if (this.keys[index].cooldownUntil <= now) {
                return this.keys[index].key;
            }
        }

        // All in cooldown — return the one that expires soonest
        let best = this.keys[0];
        for (const ks of this.keys) {
            if (ks.cooldownUntil < best.cooldownUntil) best = ks;
        }
        return best.key;
    }

    /**
     * Mark a key as rate-limited with cooldown.
     */
    markRateLimited(apiKey: string, retryAfterSeconds: number = 60) {
        const ks = this.keys.find((k) => k.key === apiKey);
        if (ks) {
            ks.failCount++;
            ks.cooldownUntil = Date.now() + retryAfterSeconds * 1000;
            console.warn(
                `Gemini key ...${apiKey.slice(-6)} cooldown ${retryAfterSeconds}s (fail #${ks.failCount})`
            );
        }
    }

    /**
     * Get the next available key after a failed one.
     * Returns null if no alternative is available.
     */
    getNextKey(failedKey: string): string | null {
        if (this.keys.length <= 1) return null;

        const now = Date.now();
        const failedIndex = this.keys.findIndex((k) => k.key === failedKey);

        for (let i = 1; i < this.keys.length; i++) {
            const index = (failedIndex + i) % this.keys.length;
            if (this.keys[index].cooldownUntil <= now) {
                return this.keys[index].key;
            }
        }
        return null;
    }

    /**
     * Mark a key as healthy after a successful request.
     */
    markSuccess(apiKey: string) {
        const ks = this.keys.find((k) => k.key === apiKey);
        if (ks) {
            ks.failCount = 0;
            ks.cooldownUntil = 0;
        }
    }
}

// Singleton
export const geminiKeyPool = new GeminiKeyPool();
