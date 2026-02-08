import { NextRequest, NextResponse } from "next/server";
import { generateLearningArticle, generateQuickSummary, generateExercises } from "@/lib/article-generator";

export async function POST(req: NextRequest) {
    try {
        const { userId, topic, difficulty, language, type, count, context } = await req.json();

        if (!userId || !topic) {
            return NextResponse.json(
                { error: "Missing required fields: userId and topic" },
                { status: 400 }
            );
        }

        const validDifficulties = ["beginner", "intermediate", "advanced"];
        const diff = validDifficulties.includes(difficulty) ? difficulty : "beginner";

        // Generate content based on type
        switch (type) {
            case "summary":
                const summary = await generateQuickSummary(userId, topic, language || "en");
                return NextResponse.json({
                    type: "summary",
                    content: summary,
                });

            case "exercises":
                const exerciseResult = await generateExercises(
                    userId,
                    topic,
                    diff as any,
                    language || "en",
                    count || 3
                );
                return NextResponse.json({
                    type: "exercises",
                    exercises: exerciseResult.exercises,
                });

            case "article":
            default:
                const article = await generateLearningArticle(
                    userId,
                    topic,
                    diff as any,
                    language || "en",
                    context
                );
                return NextResponse.json({
                    type: "article",
                    ...article,
                });
        }
    } catch (error) {
        console.error("Article generation error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
