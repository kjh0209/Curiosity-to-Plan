import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const traces = await prisma.traceLog.findMany({
            orderBy: {
                createdAt: "desc",
            },
            take: 20,
        });

        return NextResponse.json({ traces });
    } catch (error) {
        console.error("Traces fetch error:", error);
        return NextResponse.json({ traces: [] });
    }
}
