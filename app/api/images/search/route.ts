import { NextRequest, NextResponse } from "next/server";
import { searchImages } from "@/lib/image-search";

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get("query");
    const count = parseInt(req.nextUrl.searchParams.get("count") || "1");

    if (!query) {
        return NextResponse.json({ error: "Query parameter required" }, { status: 400 });
    }

    try {
        const images = await searchImages(query, count);
        return NextResponse.json({ images });
    } catch (error) {
        console.error("Image search error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
