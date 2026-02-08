import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
    req: NextRequest,
    { params }: { params: { planId: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        const planId = params.planId;

        if (!userId || !planId) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const plan = await prisma.plan.findFirst({
            where: {
                id: planId,
                userId,
            },
            include: {
                days: {
                    orderBy: {
                        dayNumber: "asc",
                    },
                },
            },
        });

        // Fetch user language
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { language: true },
        });

        if (!plan) {
            return NextResponse.json(
                { error: "Plan not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            plan,
            language: user?.language || "en"
        });
    } catch (error) {
        console.error("Plan fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { planId: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        const planId = params.planId;

        if (!userId || !planId) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        // Verify the plan belongs to this user
        const plan = await prisma.plan.findFirst({
            where: { id: planId, userId },
        });

        if (!plan) {
            return NextResponse.json(
                { error: "Plan not found" },
                { status: 404 }
            );
        }

        // Delete plan (cascades to DayPlan, QuizAttempt, UserFeedback)
        await prisma.plan.delete({
            where: { id: planId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Plan delete error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
