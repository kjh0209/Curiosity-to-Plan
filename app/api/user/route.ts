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

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                streak: true,
                freezeCount: true,
                lastCompletedDate: true,
                interest: true,
                goal: true,
                minutesPerDay: true,
                totalDays: true,
                riskStyle: true,
                baselineLevel: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error("User fetch error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
