import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    { params }: { params: { dayNumber: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        const planId = searchParams.get("planId");
        const dayNumber = parseInt(params.dayNumber, 10);

        if (!userId || !planId || isNaN(dayNumber)) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const dayPlan = await prisma.dayPlan.findFirst({
            where: {
                planId,
                dayNumber,
            },
            include: {
                plan: {
                    select: { userId: true }
                }
            }
        });

        if (!dayPlan) {
            return NextResponse.json(
                { error: "Day not found" },
                { status: 404 }
            );
        }

        if (dayPlan.plan.userId !== userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 }
            );
        }

        // Check for existing quiz attempt for this day
        const quizAttempt = await prisma.quizAttempt.findFirst({
            where: {
                userId,
                planId,
                dayNumber
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        let parsedQuizAttempt = null;
        if (quizAttempt) {
            parsedQuizAttempt = {
                score: quizAttempt.score,
                passed: quizAttempt.score >= 0.7,
                feedback: quizAttempt.feedback,
                userAnswers: parseJsonSafe(quizAttempt.answers),
                timestamp: quizAttempt.createdAt
            };
        }

        const responseData = {
            id: dayPlan.id,
            missionTitle: dayPlan.missionTitle,
            steps: parseJsonSafe(dayPlan.steps),
            quiz: parseJsonSafe(dayPlan.quiz),
            resources: dayPlan.resources ? parseJsonSafe(dayPlan.resources) : [],
            difficulty: dayPlan.difficulty,
            status: dayPlan.status,
            quizAttempt: parsedQuizAttempt
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error("Day fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

function parseJsonSafe(jsonString: string | null) {
    if (!jsonString) return null;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return null;
    }
}
