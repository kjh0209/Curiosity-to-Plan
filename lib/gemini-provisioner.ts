/**
 * Gemini API Key Provisioner
 *
 * This module handles the provisioning of Gemini API keys for users.
 *
 * Strategy:
 * 1. If GOOGLE_CLOUD_PROJECT and service account are configured,
 *    create actual API keys via Google Cloud API Keys API
 * 2. Otherwise, generate a user-specific identifier that maps to the shared key
 */

import crypto from "crypto";
import { google } from "googleapis";

// Environment variables for Google Cloud API key provisioning
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GEMINI_MASTER_KEY = process.env.GEMINI_API_KEY || "";

// Secret for generating user-specific key identifiers
const PROVISIONING_SECRET = process.env.GEMINI_PROVISIONING_SECRET || "skillloop-gemini-secret";

/**
 * Provision a Gemini API key for a user
 *
 * @param userId - The unique user ID
 * @param email - The user's email (for key naming)
 * @returns The provisioned key (either dedicated or shared with user identifier)
 */
export async function provisionGeminiKey(userId: string, email: string): Promise<string> {
    // Check if Google Cloud project is configured for dedicated keys
    if (GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            const dedicatedKey = await createDedicatedGeminiKey(userId, email);
            if (dedicatedKey) {
                console.log(`Created dedicated Gemini key for user ${userId}`);
                return dedicatedKey;
            }
        } catch (error) {
            console.warn("Failed to create dedicated Gemini key:", error);
            // Fall through to shared key
        }
    }

    // Generate a user-specific identifier for the shared key
    const userKey = generateUserSpecificKey(userId);
    console.log(`Generated shared key identifier for user ${userId}`);
    return userKey;
}

/**
 * Generate a user-specific key identifier
 * This maps to the shared Gemini key but allows per-user tracking
 */
function generateUserSpecificKey(userId: string): string {
    const hash = crypto
        .createHmac("sha256", PROVISIONING_SECRET)
        .update(userId)
        .digest("hex")
        .substring(0, 16);

    return `gemini_user_${userId}_${hash}`;
}

/**
 * Create a dedicated Gemini API key using Google Cloud API Keys API
 * Requires: GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
 */
async function createDedicatedGeminiKey(userId: string, email: string): Promise<string | null> {
    try {
        // Authenticate using the service account
        const auth = new google.auth.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient as any });

        const apikeys = google.apikeys("v2");

        // Create a unique key ID (must be lowercase, alphanumeric, hyphens only)
        const keyId = `skillloop-${userId.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 50)}`;

        // Create the API key
        const createResponse = await apikeys.projects.locations.keys.create({
            parent: `projects/${GOOGLE_CLOUD_PROJECT}/locations/global`,
            keyId: keyId,
            requestBody: {
                displayName: `SkillLoop User: ${email}`,
                restrictions: {
                    apiTargets: [
                        {
                            service: "generativelanguage.googleapis.com",
                        },
                    ],
                },
            },
        });

        // The create operation returns a long-running operation
        // We need to wait for it to complete
        if (createResponse.data.name) {
            const operationName = createResponse.data.name;

            // Poll for operation completion
            let attempts = 0;
            const maxAttempts = 30;

            while (attempts < maxAttempts) {
                const opResponse = await apikeys.operations.get({
                    name: operationName,
                });

                if (opResponse.data.done) {
                    if (opResponse.data.error) {
                        throw new Error(opResponse.data.error.message || "API key creation failed");
                    }

                    // Get the created key details
                    const keyResponse = opResponse.data.response as any;
                    if (keyResponse && keyResponse.keyString) {
                        return keyResponse.keyString;
                    }

                    // If keyString is not in response, fetch it separately
                    if (keyResponse && keyResponse.name) {
                        const getKeyResponse = await apikeys.projects.locations.keys.getKeyString({
                            name: keyResponse.name,
                        });
                        return getKeyResponse.data.keyString || null;
                    }

                    break;
                }

                // Wait before next poll
                await new Promise((resolve) => setTimeout(resolve, 1000));
                attempts++;
            }

            throw new Error("Timeout waiting for API key creation");
        }

        return null;
    } catch (error: any) {
        // Check if key already exists
        if (error.code === 409 || error.message?.includes("already exists")) {
            console.log(`API key already exists for user ${userId}, fetching existing key...`);
            return await getExistingGeminiKey(userId);
        }

        console.error("Error creating dedicated Gemini key:", error.message || error);
        throw error;
    }
}

/**
 * Get an existing Gemini API key for a user
 */
async function getExistingGeminiKey(userId: string): Promise<string | null> {
    try {
        const auth = new google.auth.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient as any });

        const apikeys = google.apikeys("v2");

        const keyId = `skillloop-${userId.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 50)}`;
        const keyName = `projects/${GOOGLE_CLOUD_PROJECT}/locations/global/keys/${keyId}`;

        const response = await apikeys.projects.locations.keys.getKeyString({
            name: keyName,
        });

        return response.data.keyString || null;
    } catch (error) {
        console.error("Error fetching existing Gemini key:", error);
        return null;
    }
}

/**
 * Validate if a key is a user-specific shared key
 */
export function isUserSpecificKey(key: string): boolean {
    return key.startsWith("gemini_user_");
}

/**
 * Extract userId from a user-specific key
 */
export function extractUserIdFromKey(key: string): string | null {
    if (!isUserSpecificKey(key)) return null;

    const parts = key.split("_");
    if (parts.length >= 3) {
        return parts[2]; // gemini_user_{userId}_{hash}
    }
    return null;
}

/**
 * Get the actual Gemini API key to use for a request
 * If the user has a dedicated key, use it
 * If they have a shared key identifier, use the master key
 */
export function resolveGeminiKey(userKey: string | null): string {
    if (!userKey) {
        return GEMINI_MASTER_KEY;
    }

    // If it's a user-specific shared key, use the master key
    if (isUserSpecificKey(userKey)) {
        return GEMINI_MASTER_KEY;
    }

    // Otherwise, it's a dedicated key - use it directly
    return userKey;
}

/**
 * Revoke/delete a dedicated Gemini API key
 */
export async function revokeGeminiKey(userId: string, key: string): Promise<boolean> {
    // Only revoke if it's a dedicated key (not a shared key identifier)
    if (isUserSpecificKey(key)) {
        // Nothing to revoke - it's just an identifier
        return true;
    }

    // For dedicated keys, delete via Google Cloud API
    if (!GOOGLE_CLOUD_PROJECT || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return true;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        const authClient = await auth.getClient();
        google.options({ auth: authClient as any });

        const apikeys = google.apikeys("v2");

        const keyId = `skillloop-${userId.toLowerCase().replace(/[^a-z0-9]/g, "-").substring(0, 50)}`;
        const keyName = `projects/${GOOGLE_CLOUD_PROJECT}/locations/global/keys/${keyId}`;

        await apikeys.projects.locations.keys.delete({
            name: keyName,
        });

        console.log(`Deleted Gemini API key for user ${userId}`);
        return true;
    } catch (error) {
        console.error("Error revoking Gemini key:", error);
        return false;
    }
}

/**
 * Check if dedicated key provisioning is available
 */
export function isDedicatedKeyProvisioningAvailable(): boolean {
    return !!(GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
