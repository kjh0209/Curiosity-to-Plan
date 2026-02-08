/**
 * AI Provider Abstraction Layer
 *
 * Priority:
 * 1. User's own OpenAI key (if configured and within quota)
 * 2. User's dedicated Gemini key (if provisioned)
 * 3. Shared Gemini key (fallback)
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";
import { resolveGeminiKey, isUserSpecificKey } from "./gemini-provisioner";

// Server-side Gemini API key as fallback
const GEMINI_MASTER_KEY = process.env.GEMINI_API_KEY || "";

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
 * Generate text using Gemini's API
 */
async function generateWithGemini(
    userGeminiKey: string | null,
    model: string = "gemini-flash-latest",
    prompt: string
): Promise<{ text: string; tokens: number }> {
    const actualKey = resolveGeminiKey(userGeminiKey);

    if (!actualKey) {
        throw new Error("Gemini API key not configured");
    }

    const genAI = new GoogleGenerativeAI(actualKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Gemini usage metadata might be missing in some SDK versions, estimate fallback
    const tokens = (prompt.length / 4) + (text.length / 4);

    return { text, tokens: Math.round(tokens) };
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
        },
    });

    if (!rawUser) throw new Error("User not found");

    // Cast and check period
    let user = rawUser as unknown as User;
    user = await checkPeriodReset(user);

    // Try OpenAI first
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
            `Monthly AI token limit exceeded (${user.geminiTokenUsagePeriod} / ${user.geminiMonthlyTokenLimit}). Please upgrade or add your own OpenAI key.`
        );
    }

    // Use Gemini
    const { text, tokens } = await generateWithGemini(
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

    let geminiKeyType: "dedicated" | "shared" | "none" = "none";
    if (user.geminiApiKey) {
        geminiKeyType = isUserSpecificKey(user.geminiApiKey) ? "shared" : "dedicated";
    } else if (GEMINI_MASTER_KEY) {
        geminiKeyType = "shared";
    }

    // Calculate Estimated Cost
    // Cost = (Limit / 1,000,000) * Model Rate
    // e.g. 2M limit * $0.30 (mini) = $0.60
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
            hasKey: !!user.geminiApiKey || !!GEMINI_MASTER_KEY,
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
