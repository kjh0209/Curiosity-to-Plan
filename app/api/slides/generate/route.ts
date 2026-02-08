import { NextRequest, NextResponse } from "next/server";
import { generateLearningSlides } from "@/lib/slide-generator";
import { translateSlides } from "@/lib/translate";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const { userId, topic, missionTitle, level, language, planId, dayNumber } = await req.json();

        if (!userId || !topic) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Check Cache if planId and dayNumber are provided
        let dayPlan = null;
        let slideCache: Record<string, any> = {};
        let baseLang: string | null = null;

        if (planId && dayNumber) {
            dayPlan = await prisma.dayPlan.findUnique({
                where: {
                    planId_dayNumber: {
                        planId,
                        dayNumber: parseInt(dayNumber),
                    },
                },
            });

            if (dayPlan?.slides) {
                try {
                    slideCache = JSON.parse(dayPlan.slides);

                    // Check if we have cached slides for this language
                    if (slideCache[language]) {
                        console.log(`Returning cached slides for Day ${dayNumber} in ${language}`);
                        return NextResponse.json({ slides: slideCache[language] });
                    }

                    // Find base language (first available cached language)
                    baseLang = Object.keys(slideCache).find(key => key !== "_baseLang" && slideCache[key]) || null;
                    if (slideCache._baseLang) {
                        baseLang = slideCache._baseLang;
                    }

                    // If we have base slides in another language, TRANSLATE instead of regenerating
                    if (baseLang && slideCache[baseLang]) {
                        console.log(`Translating slides from ${baseLang} to ${language}...`);
                        const translatedSlides = await translateSlides(
                            userId,
                            slideCache[baseLang],
                            baseLang,
                            language
                        );

                        // Cache the translation
                        slideCache[language] = translatedSlides;
                        await prisma.dayPlan.update({
                            where: { id: dayPlan.id },
                            data: { slides: JSON.stringify(slideCache) },
                        });

                        return NextResponse.json({ slides: translatedSlides });
                    }
                } catch (e) {
                    console.error("Failed to parse slide cache", e);
                }
            }
        }

        // 2. Generate NEW base slides (no base exists)
        console.log(`Generating new BASE slides for ${topic} in ${language}...`);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const slides = await generateLearningSlides(
            userId,
            topic,
            missionTitle || topic,
            level || user.baselineLevel,
            language || user.language
        );

        // 3. Store as BASE and cache
        if (dayPlan) {
            slideCache[language] = slides;
            slideCache._baseLang = language; // Mark this as the base language
            await prisma.dayPlan.update({
                where: { id: dayPlan.id },
                data: {
                    slides: JSON.stringify(slideCache),
                },
            });
        }

        return NextResponse.json({ slides });
    } catch (error) {
        console.error("Slide generation error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

