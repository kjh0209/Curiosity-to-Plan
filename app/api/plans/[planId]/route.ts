import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

        if (!plan) {
            return NextResponse.json(
                { error: "Plan not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ plan });
    } catch (error) {
        console.error("Plan fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
