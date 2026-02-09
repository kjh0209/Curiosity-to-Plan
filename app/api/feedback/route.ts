import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withOpikTrace } from "@/lib/opik";

export async function POST(req: NextRequest) {
    try {
        const {
            userId,
            dayPlanId,
            contentRating,
            difficultyRating,
            resourceRating,
            textFeedback,
        } = await req.json();

        if (!userId || !contentRating || !difficultyRating || !resourceRating) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Validate ratings are 1-5
        const ratings = [contentRating, difficultyRating, resourceRating];
        for (const rating of ratings) {
            if (rating < 1 || rating > 5) {
                return NextResponse.json(
                    { error: "Ratings must be between 1 and 5" },
                    { status: 400 }
                );
            }
        }

        // Create feedback and log to Opik
        // Only include dayPlanId if it's a valid non-empty string
        const validDayPlanId = dayPlanId && dayPlanId.trim() !== "" ? dayPlanId : null;

        // Fetch dayPlan context so Opik trace is self-contained for analysis
        let dayPlanContext: Record<string, unknown> = {};
        if (validDayPlanId) {
            const dayPlan = await prisma.dayPlan.findUnique({
                where: { id: validDayPlanId },
                select: {
                    dayNumber: true,
                    missionTitle: true,
                    focus: true,
                    difficulty: true,
                    steps: true,
                    resources: true,
                    plan: {
                        select: {
                            planTitle: true,
                            totalDays: true,
                            language: true,
                        },
                    },
                },
            });
            if (dayPlan) {
                dayPlanContext = {
                    dayNumber: dayPlan.dayNumber,
                    missionTitle: dayPlan.missionTitle,
                    focus: dayPlan.focus,
                    difficulty: dayPlan.difficulty,
                    steps: dayPlan.steps ? JSON.parse(dayPlan.steps) : [],
                    resources: dayPlan.resources ? JSON.parse(dayPlan.resources) : [],
                    plan: dayPlan.plan,
                };
            }
        }

        const feedback = await withOpikTrace(
            "user_feedback",
            {
                userId,
                dayPlanId: validDayPlanId,
                ratings: { contentRating, difficultyRating, resourceRating },
                textFeedback: textFeedback || null,
                dayPlan: dayPlanContext,
            },
            async () => {
                return await prisma.userFeedback.create({
                    data: {
                        userId,
                        dayPlanId: validDayPlanId,
                        contentRating,
                        difficultyRating,
                        resourceRating,
                        textFeedback: textFeedback || null,
                    },
                });
            },
            {
                feedbackType: "day_completion",
                ...(dayPlanContext.missionTitle ? { missionTitle: dayPlanContext.missionTitle } : {}),
                ...(dayPlanContext.difficulty ? { difficulty: dayPlanContext.difficulty } : {}),
                ...(dayPlanContext.dayNumber ? { dayNumber: dayPlanContext.dayNumber } : {}),
            }
        );

        return NextResponse.json({ success: true, feedback });
    } catch (error) {
        console.error("Feedback submission error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

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

        const feedbacks = await prisma.userFeedback.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: {
                dayPlan: {
                    select: {
                        dayNumber: true,
                        missionTitle: true,
                    },
                },
            },
        });

        // Calculate average ratings
        const totalFeedbacks = feedbacks.length;
        if (totalFeedbacks === 0) {
            return NextResponse.json({
                feedbacks: [],
                stats: {
                    avgContent: 0,
                    avgDifficulty: 0,
                    avgResource: 0,
                    total: 0,
                },
            });
        }

        const avgContent = feedbacks.reduce((sum: number, f: any) => sum + f.contentRating, 0) / totalFeedbacks;
        const avgDifficulty = feedbacks.reduce((sum: number, f: any) => sum + f.difficultyRating, 0) / totalFeedbacks;
        const avgResource = feedbacks.reduce((sum: number, f: any) => sum + f.resourceRating, 0) / totalFeedbacks;

        return NextResponse.json({
            feedbacks,
            stats: {
                avgContent: Math.round(avgContent * 10) / 10,
                avgDifficulty: Math.round(avgDifficulty * 10) / 10,
                avgResource: Math.round(avgResource * 10) / 10,
                total: totalFeedbacks,
            },
        });
    } catch (error) {
        console.error("Feedback fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
