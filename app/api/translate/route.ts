import { NextRequest, NextResponse } from "next/server";
import { translateText, translateTexts } from "@/lib/translate";

export async function POST(req: NextRequest) {
    try {
        const { userId, text, texts, fromLang = "auto", toLang, context } = await req.json();

        if (!userId || !toLang) {
            return NextResponse.json(
                { error: "Missing required fields: userId, toLang" },
                { status: 400 }
            );
        }

        // Single text translation
        if (text) {
            // translateText doesn't support context yet, but we are focused on batch for now.
            const translated = await translateText(userId, text, fromLang, toLang);
            return NextResponse.json({ translated });
        }

        // Batch translation
        if (texts && Array.isArray(texts)) {
            const translated = await translateTexts(userId, texts, fromLang, toLang, context);
            return NextResponse.json({ translated });
        }

        return NextResponse.json(
            { error: "Must provide 'text' or 'texts' array" },
            { status: 400 }
        );

    } catch (error) {
        console.error("Translation error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
