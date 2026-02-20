/**
 * AI Provider Abstraction Layer
 *
 * Priority:
 * 1. User's own OpenAI key (if configured and within quota)
 * 2. Gemini via key pool (auto-distributed across multiple projects)
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";
import { resolveGeminiKey, isUserSpecificKey } from "./gemini-provisioner";
import { geminiKeyPool } from "./gemini-key-pool";

interface User {
    id: string;
    openaiApiKey: string | null;
    openaiModel: string;
    openaiMonthlyTokenLimit: number;
    openaiTokenUsagePeriod: number;
    openaiPeriodStart: Date;
    geminiApiKey: string | null;
    geminiModel: string;
    geminiMonthlyTokenLimit: number;
    geminiTokenUsagePeriod: number;
    geminiPeriodStart: Date;
    lastUsageReset: Date;
    subscriptionTier: string;
    subscriptionStatus: string;
}

interface AIGenerationResult {
    text: string;
    provider: "openai" | "gemini";
    model: string;
    tokens?: number;
}

// Cost per 1M tokens (Approximate blended input/output for simplicity)
export const MODEL_COSTS: Record<string, number> = {
    "gpt-4o": 5.00,       // ~$2.50 in / $10.00 out
    "gpt-4o-mini": 0.30,  // ~$0.15 in / $0.60 out
    "gpt-3.5-turbo": 1.00,// Legacy
    "gemini-1.5-flash": 0.00, // Free tier mostly
    "gemini-2.0-flash": 0.00, // Free tier mostly
};

/**
 * Check if we need to reset the monthly period
 */
async function checkPeriodReset(user: User): Promise<User> {
    const now = new Date();
    const lastStart = new Date(user.openaiPeriodStart);

    // Check if a month has passed
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (lastStart < oneMonthAgo) {
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                openaiTokenUsagePeriod: 0,
                openaiPeriodStart: now,
                geminiTokenUsagePeriod: 0,
                geminiPeriodStart: now,
            },
        });
        return updated as unknown as User;
    }
    return user;
}

/**
 * Increment usage counter for the specified provider
 */
async function incrementUsage(userId: string, provider: "openai" | "gemini", tokens: number): Promise<void> {
    if (provider === "openai") {
        await prisma.user.update({
            where: { id: userId },
            data: {
                openaiTokenUsagePeriod: { increment: tokens },
                openaiUsageToday: { increment: 1 } // Keep legacy counter for stats
            },
        });
    } else {
        await prisma.user.update({
            where: { id: userId },
            data: {
                geminiTokenUsagePeriod: { increment: tokens },
                geminiUsageToday: { increment: 1 }
            },
        });
    }
}

/**
 * Generate text using OpenAI's API with user's key
 */
async function generateWithOpenAI(
    apiKey: string,
    model: string,
    prompt: string,
    maxTokens: number = 2500
): Promise<{ text: string; tokens: number }> {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
        model: model,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content || "";
    const tokens = completion.usage?.total_tokens || (prompt.length / 4 + text.length / 4); // Estimate if missing

    return { text, tokens: Math.round(tokens) };
}

/**
 * Extract retry delay from Gemini 429 error
 */
function extractRetryDelay(error: any): number {
    // Try to parse retryDelay from error details
    if (error.errorDetails) {
        for (const detail of error.errorDetails) {
            if (detail["@type"]?.includes("RetryInfo") && detail.retryDelay) {
                const match = detail.retryDelay.match(/(\d+)/);
                if (match) return parseInt(match[1], 10);
            }
        }
    }
    // Default 60s cooldown
    return 60;
}

/**
 * Generate text using Gemini's API with automatic key rotation on 429
 */
async function generateWithGemini(
    userId: string,
    userGeminiKey: string | null,
    model: string = "gemini-2.0-flash",
    prompt: string
): Promise<{ text: string; tokens: number }> {
    const MAX_RETRIES = Math.max(geminiKeyPool.poolSize, 1);
    let lastError: any = null;
    let currentKey = resolveGeminiKey(userGeminiKey, userId);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (!currentKey) {
            throw new Error("Gemini API key not configured. Set GEMINI_API_KEYS in .env");
        }

        try {
            const genAI = new GoogleGenerativeAI(currentKey);
            const geminiModel = genAI.getGenerativeModel({ model });
            const result = await geminiModel.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            const tokens = Math.round((prompt.length / 4) + (text.length / 4));

            // Success — mark key healthy
            geminiKeyPool.markSuccess(currentKey);

            return { text, tokens };
        } catch (error: any) {
            lastError = error;

            if (error.status === 429) {
                const retryDelay = extractRetryDelay(error);
                geminiKeyPool.markRateLimited(currentKey, retryDelay);

                // Try next key in pool
                const nextKey = geminiKeyPool.getNextKey(currentKey);
                if (nextKey) {
                    console.log(`Gemini 429 on ...${currentKey.slice(-6)}, rotating to ...${nextKey.slice(-6)}`);
                    currentKey = nextKey;
                    continue;
                }

                // No more keys available — wait briefly and retry same key
                if (attempt < MAX_RETRIES - 1) {
                    const waitMs = Math.min(retryDelay * 1000, 10000); // max 10s wait
                    console.log(`All Gemini keys exhausted, waiting ${waitMs}ms...`);
                    await new Promise((r) => setTimeout(r, waitMs));
                    currentKey = geminiKeyPool.getKeyForUser(userId) || currentKey;
                    continue;
                }
            }

            // Non-429 error or exhausted retries — throw
            if (error.status === 429) {
                throw new Error(
                    "AI service is temporarily at capacity. Please try again in a few minutes. " +
                    "If this issue persists, please contact us at kevin070209@gmail.com"
                );
            }
            throw error;
        }
    }

    throw lastError?.status === 429
        ? new Error(
            "AI service is temporarily at capacity. Please try again in a few minutes. " +
            "If this issue persists, please contact us at kevin070209@gmail.com"
          )
        : lastError || new Error("Gemini generation failed after all retries");
}

/**
 * Main AI generation function with automatic provider selection
 */
export async function generateWithAI(
    userId: string,
    prompt: string,
    maxTokens: number = 2500
): Promise<AIGenerationResult> {
    // Fetch user with updated schema fields
    const rawUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            openaiApiKey: true,
            openaiModel: true,
            openaiMonthlyTokenLimit: true,
            openaiTokenUsagePeriod: true,
            openaiPeriodStart: true,
            geminiApiKey: true,
            geminiModel: true,
            geminiMonthlyTokenLimit: true,
            geminiTokenUsagePeriod: true,
            geminiPeriodStart: true,
            lastUsageReset: true,
            subscriptionTier: true,
            subscriptionStatus: true,
        },
    });

    if (!rawUser) throw new Error("User not found");

    // Cast and check period
    let user = rawUser as unknown as User;
    user = await checkPeriodReset(user);

    // Pro users: use server-side OpenAI API key
    const isPro = user.subscriptionTier === "pro" && user.subscriptionStatus === "active";
    if (isPro && process.env.OPENAI_API_KEY) {
        try {
            const { text, tokens } = await generateWithOpenAI(
                process.env.OPENAI_API_KEY,
                "gpt-4o-mini",
                prompt,
                maxTokens
            );
            await incrementUsage(userId, "openai", tokens);
            return {
                text,
                provider: "openai",
                model: "gpt-4o-mini",
                tokens,
            };
        } catch (error) {
            console.error("Server OpenAI failed for pro user, falling back to Gemini:", error);
        }
    }

    // Try user's own OpenAI key
    if (user.openaiApiKey && user.openaiTokenUsagePeriod < user.openaiMonthlyTokenLimit) {
        try {
            const { text, tokens } = await generateWithOpenAI(
                user.openaiApiKey,
                user.openaiModel,
                prompt,
                maxTokens
            );
            await incrementUsage(userId, "openai", tokens);

            return {
                text,
                provider: "openai",
                model: user.openaiModel,
                tokens,
            };
        } catch (error) {
            console.error("OpenAI generation failed, falling back to Gemini:", error);
        }
    }

    // Check Gemini quota
    if (user.geminiTokenUsagePeriod >= user.geminiMonthlyTokenLimit) {
        throw new Error(
            "Monthly AI usage limit reached. Please try again later or contact us at kevin070209@gmail.com for assistance."
        );
    }

    // Use Gemini with key pool + retry
    const { text, tokens } = await generateWithGemini(
        userId,
        user.geminiApiKey,
        user.geminiModel || "gemini-2.0-flash",
        prompt
    );
    await incrementUsage(userId, "gemini", tokens);

    return {
        text,
        provider: "gemini",
        model: user.geminiModel || "gemini-2.0-flash",
        tokens,
    };
}

/**
 * Get remaining quota for a user
 */
export async function getRemainingQuota(userId: string): Promise<{
    openai: { used: number; limit: number; hasKey: boolean; costEstimate: number };
    gemini: { used: number; limit: number; hasKey: boolean; keyType: "dedicated" | "shared" | "none" };
}> {
    // Internal test account: hardcode pro limits
    if (userId === "__TEST_PRO_ACCOUNT__") {
        return {
            openai: { used: 0, limit: 1_500_000, hasKey: true, costEstimate: 0 },
            gemini: { used: 0, limit: 1_500_000, hasKey: true, keyType: "shared" },
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            openaiApiKey: true,
            openaiModel: true,
            openaiMonthlyTokenLimit: true,
            openaiTokenUsagePeriod: true,
            geminiApiKey: true,
            geminiMonthlyTokenLimit: true,
            geminiTokenUsagePeriod: true,
        },
    });

    if (!user) throw new Error("User not found");

    // Determine key type
    let geminiKeyType: "dedicated" | "shared" | "none" = "none";
    if (user.geminiApiKey && !isUserSpecificKey(user.geminiApiKey)) {
        geminiKeyType = "dedicated"; // User's own real key
    } else if (geminiKeyPool.poolSize > 0) {
        geminiKeyType = "shared"; // Using the pool
    }

    const rate = MODEL_COSTS[user.openaiModel] || 0.30;
    const costEstimate = (user.openaiMonthlyTokenLimit / 1000000) * rate;

    return {
        openai: {
            used: user.openaiTokenUsagePeriod,
            limit: user.openaiMonthlyTokenLimit,
            hasKey: !!user.openaiApiKey,
            costEstimate: parseFloat(costEstimate.toFixed(2)),
        },
        gemini: {
            used: user.geminiTokenUsagePeriod,
            limit: user.geminiMonthlyTokenLimit,
            hasKey: !!user.geminiApiKey || geminiKeyPool.poolSize > 0,
            keyType: geminiKeyType,
        },
    };
}

export async function isAIAvailable(userId: string): Promise<boolean> {
    try {
        const quota = await getRemainingQuota(userId);
        if (quota.openai.hasKey && quota.openai.used < quota.openai.limit) return true;
        if (quota.gemini.hasKey && quota.gemini.used < quota.gemini.limit) return true;
        return false;
    } catch {
        return false;
    }
}
