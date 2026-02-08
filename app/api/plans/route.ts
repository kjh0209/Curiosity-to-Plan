import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

        const plans = await prisma.plan.findMany({
            where: { userId },
            include: {
                days: {
                    select: {
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Fetch user language preference
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { language: true },
        });

        const planSummaries = plans.map((plan) => ({
            id: plan.id,
            planTitle: plan.planTitle,
            createdAt: plan.createdAt.toISOString(),
            completedDays: plan.days.filter((d) => d.status === "DONE").length,
            totalDays: plan.days.length,
        }));

        return NextResponse.json({
            plans: planSummaries,
            language: user?.language || "en"
        });
    } catch (error) {
        console.error("Plans fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
