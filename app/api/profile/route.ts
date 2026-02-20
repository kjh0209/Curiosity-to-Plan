import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getRemainingQuota } from "@/lib/ai-provider";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { error: "Missing userId" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                interest: true,
                goal: true,
                minutesPerDay: true,
                totalDays: true,
                riskStyle: true,
                baselineLevel: true,
                language: true,
                resourceSort: true,
                streak: true,
                freezeCount: true,
                lastCompletedDate: true,
                // Subscription
                subscriptionTier: true,
                subscriptionStatus: true,
                stripeCustomerId: true,
                subscriptionEnd: true,
                authProvider: true,
                // Daily counters
                plansCreatedToday: true,
                daysOpenedToday: true,
                lastDailyReset: true,
                // API settings (don't expose the actual keys)
                openaiApiKey: true,
                openaiModel: true,
                openaiMonthlyTokenLimit: true,
                openaiTokenUsagePeriod: true,
                geminiApiKey: true,
                geminiModel: true,
                geminiMonthlyTokenLimit: true,
                geminiTokenUsagePeriod: true,
                lastUsageReset: true,
                createdAt: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Get quota info
        const quota = await getRemainingQuota(userId);



        const profile = {
            ...user,
            openaiApiKey: user.openaiApiKey ? maskApiKey(user.openaiApiKey) : null,
            geminiApiKey: user.geminiApiKey ? maskApiKey(user.geminiApiKey) : null,
            hasOpenAiKey: !!user.openaiApiKey,
            hasGeminiKey: !!user.geminiApiKey,
            quota,
        };

        return NextResponse.json({ profile });
    } catch (error) {
        console.error("Profile fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            userId,
            name,
            currentPassword,
            newPassword,
            language,
            resourceSort,
            riskStyle,
            baselineLevel,
            // API Settings
            openaiApiKey,
            openaiModel,
            openaiMonthlyTokenLimit, // Changed from dailyQuota
            removeOpenaiKey,
        } = body;

        if (!userId) {
            return NextResponse.json(
                { error: "Missing userId" },
                { status: 400 }
            );
        }

        // Fetch current user
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: any = {};

        // Profile info
        if (name !== undefined) updateData.name = name;
        if (language !== undefined) updateData.language = language;
        if (resourceSort !== undefined) updateData.resourceSort = resourceSort;
        if (riskStyle !== undefined) updateData.riskStyle = riskStyle;
        if (baselineLevel !== undefined) updateData.baselineLevel = baselineLevel;

        // Password change (only for credentials users who have a password)
        if (newPassword && currentPassword) {
            if (!user.password) {
                return NextResponse.json(
                    { error: "Cannot change password for Google OAuth accounts" },
                    { status: 400 }
                );
            }
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                return NextResponse.json(
                    { error: "Current password is incorrect" },
                    { status: 400 }
                );
            }
            if (newPassword.length < 6) {
                return NextResponse.json(
                    { error: "New password must be at least 6 characters" },
                    { status: 400 }
                );
            }
            updateData.password = await bcrypt.hash(newPassword, 12);
        }



        if (removeOpenaiKey) {
            updateData.openaiApiKey = null;
        } else if (openaiApiKey && openaiApiKey !== maskApiKey(user.openaiApiKey || "")) {
            // Only update if it's a new key (not the masked version)
            if (!openaiApiKey.startsWith("sk-...")) {
                updateData.openaiApiKey = openaiApiKey;
            }
        }
        if (openaiModel !== undefined) updateData.openaiModel = openaiModel;
        if (openaiMonthlyTokenLimit !== undefined) {
            // Ensure it's an integer
            updateData.openaiMonthlyTokenLimit = parseInt(String(openaiMonthlyTokenLimit).replace(/,/g, ""), 10);
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                language: true,
                resourceSort: true,
                riskStyle: true,
                baselineLevel: true,
                openaiModel: true,
                openaiMonthlyTokenLimit: true,
                openaiApiKey: true,
            },
        });

        // Check for OpenAI key
        const userWithKey = await prisma.user.findUnique({
            where: { id: userId },
            select: { openaiApiKey: true, geminiApiKey: true },
        });

        return NextResponse.json({
            success: true,
            profile: {
                ...updatedUser,
                hasOpenAiKey: !!userWithKey?.openaiApiKey,
                hasGeminiKey: !!userWithKey?.geminiApiKey,
            },
        });
    } catch (error) {
        console.error("Profile update error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { error: "Missing userId" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Delete user (cascades to Plans, DayPlans, QuizAttempts, UserFeedback)
        await prisma.user.delete({
            where: { id: userId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Account deletion error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

function maskApiKey(key: string): string {
    if (!key || key.length < 10) return "sk-...";
    return `${key.slice(0, 5)}...${key.slice(-4)}`;
}
