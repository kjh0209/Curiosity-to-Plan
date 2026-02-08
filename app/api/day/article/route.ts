import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateLearningArticle } from "@/lib/article-generator";
import { translateArticle } from "@/lib/translate";

export async function POST(req: NextRequest) {
    try {
        const { userId, dayNumber, planId, language = "en" } = await req.json();

        if (!userId || !dayNumber || !planId) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // 1. Fetch DayPlan to check cache
        const dayPlan = await prisma.dayPlan.findUnique({
            where: {
                planId_dayNumber: {
                    planId,
                    dayNumber: parseInt(dayNumber),
                },
            },
        });

        if (!dayPlan) {
            return NextResponse.json({ error: "Day plan not found" }, { status: 404 });
        }

        // 2. Check Cache
        let articleCache: Record<string, any> = {};
        let baseLang: string | null = null;

        if (dayPlan.article) {
            try {
                articleCache = JSON.parse(dayPlan.article);
            } catch (e) {
                console.error("Failed to parse article cache", e);
            }
        }

        // Return cached if exists for this language
        if (articleCache[language]) {
            return NextResponse.json(articleCache[language]);
        }

        // Find base language
        baseLang = articleCache._baseLang || Object.keys(articleCache).find(key => key !== "_baseLang" && articleCache[key]) || null;

        // If we have base article, TRANSLATE instead of regenerating
        if (baseLang && articleCache[baseLang]) {
            console.log(`Translating article from ${baseLang} to ${language}...`);
            const translatedArticle = await translateArticle(
                userId,
                articleCache[baseLang],
                baseLang,
                language
            );

            // Cache the translation
            articleCache[language] = translatedArticle;
            await prisma.dayPlan.update({
                where: { id: dayPlan.id },
                data: { article: JSON.stringify(articleCache) },
            });

            return NextResponse.json(translatedArticle);
        }

        // 3. Generate New BASE Article (no base exists)
        console.log(`Generating new BASE article for Day ${dayNumber} in ${language}...`);

        const context = `Mission: ${dayPlan.missionTitle}. Focus: ${dayPlan.focus}. Steps: ${dayPlan.steps}`;

        const article = await generateLearningArticle(
            userId,
            dayPlan.missionTitle,
            "beginner",
            language,
            context
        );

        // 4. Store as BASE and cache
        articleCache[language] = article;
        articleCache._baseLang = language; // Mark this as the base language

        await prisma.dayPlan.update({
            where: { id: dayPlan.id },
            data: {
                article: JSON.stringify(articleCache),
            },
        });

        return NextResponse.json(article);

    } catch (error) {
        console.error("Article generation error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

