import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWithAI } from "@/lib/ai-provider";

// Language display names
const languageNames: Record<string, string> = {
    en: "English",
    ko: "Korean (한국어)",
    ja: "Japanese (日本語)",
    zh: "Chinese (中文)",
    es: "Spanish (Español)",
    fr: "French (Français)",
    de: "German (Deutsch)",
};

interface FollowUpRecommendation {
    interest: string;
    goal: string;
    minutesPerDay: number;
    totalDays: number;
    description: string;
    rationale: string;
}

/**
 * Generate follow-up plan recommendations for a completed plan
 * POST /api/plan/recommend
 */
export async function POST(req: NextRequest) {
    try {
        const { userId, completedPlanId } = await req.json();

        if (!userId || !completedPlanId) {
            return NextResponse.json(
                { error: "Missing required fields: userId, completedPlanId" },
                { status: 400 }
            );
        }

        // Fetch the completed plan with all its days
        const completedPlan = await prisma.plan.findUnique({
            where: { id: completedPlanId },
            include: {
                days: { orderBy: { dayNumber: "asc" } },
                user: {
                    select: {
                        interest: true,
                        goal: true,
                        minutesPerDay: true,
                        totalDays: true,
                        language: true,
                        baselineLevel: true,
                    }
                }
            },
        });

        if (!completedPlan) {
            return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }

        // Verify all days are completed
        const allDone = completedPlan.days.every(d => d.status === "DONE");
        if (!allDone) {
            return NextResponse.json(
                { error: "Plan is not fully completed" },
                { status: 400 }
            );
        }

        const user = completedPlan.user;
        const userLanguage = user?.language || "en";
        const languageName = languageNames[userLanguage] || "English";
        const currentMinutes = completedPlan.minutesPerDay;
        const currentDays = completedPlan.totalDays;

        // Build context from completed plan
        const daysSummary = completedPlan.days
            .slice(0, 10) // First 10 days for context
            .map(d => `Day ${d.dayNumber}: ${d.missionTitle}`)
            .join("\n");

        const prompt = `You are an expert curriculum designer helping a learner plan their next steps after completing a learning plan.

COMPLETED PLAN CONTEXT:
- Plan Title: "${completedPlan.planTitle}"
- Original Interest: "${user?.interest || 'unknown'}"
- Original Goal: "${user?.goal || 'unknown'}"
- Duration: ${currentDays} days at ${currentMinutes} minutes/day
- User Level: ${user?.baselineLevel || 'BEGINNER'}

SAMPLE OF COMPLETED CONTENT:
${daysSummary}

YOUR TASK:
Generate exactly 3 follow-up learning plan recommendations. Each recommendation MUST:
1. Be a natural progression from the completed plan (not a repeat)
2. Either deepen skills in the same area OR expand to related adjacent skills
3. Be realistic and achievable

STRICT REQUIREMENTS:
- Recommendation 1: DEEPER MASTERY - More advanced version of the same skill
- Recommendation 2: ADJACENT SKILL - A related but different skill that complements what was learned
- Recommendation 3: PRACTICAL APPLICATION - A project-focused plan to apply learned skills

For each recommendation, provide:
- interest: The specific field/topic (e.g., "Classical Guitar", not vague like "Music")
- goal: A SPECIFIC, MEASURABLE goal (e.g., "Play 'Recuerdos de la Alhambra' at 80 BPM", not "Get better at guitar")
- minutesPerDay: Between ${Math.max(10, currentMinutes - 10)} and ${currentMinutes + 20} (realistic based on user's proven commitment)
- totalDays: Between ${Math.max(7, currentDays - 7)} and ${currentDays + 30}
- description: One sentence describing what this plan covers (in ${languageName})
- rationale: Why this is a good next step (in ${languageName})

LANGUAGE: All text fields (interest, goal, description, rationale) MUST be in ${languageName}.

OUTPUT FORMAT:
Return ONLY a valid JSON array with exactly 3 objects. No markdown, no explanation.
[
  {
    "interest": "...",
    "goal": "...",
    "minutesPerDay": number,
    "totalDays": number,
    "description": "...",
    "rationale": "..."
  }
]`;

        const aiResult = await generateWithAI(userId, prompt, 2000);
        let response = aiResult.text.trim();

        // Clean up markdown if present
        if (response.startsWith("```json")) {
            response = response.replace(/^```json\s*/, "").replace(/```\s*$/, "");
        } else if (response.startsWith("```")) {
            response = response.replace(/^```\s*/, "").replace(/```\s*$/, "");
        }

        let recommendations: FollowUpRecommendation[];
        try {
            recommendations = JSON.parse(response);

            // Validate structure
            if (!Array.isArray(recommendations) || recommendations.length !== 3) {
                throw new Error("Invalid response structure");
            }

            // Validate each recommendation
            recommendations = recommendations.map((rec, idx) => ({
                interest: String(rec.interest || `Follow-up ${idx + 1}`).substring(0, 100),
                goal: String(rec.goal || "Continue learning").substring(0, 200),
                minutesPerDay: Math.max(10, Math.min(120, Number(rec.minutesPerDay) || currentMinutes)),
                totalDays: Math.max(7, Math.min(100, Number(rec.totalDays) || 14)),
                description: String(rec.description || "").substring(0, 300),
                rationale: String(rec.rationale || "").substring(0, 300),
            }));

        } catch (e) {
            console.error("Failed to parse follow-up recommendations:", response, e);

            // Fallback recommendations
            recommendations = [
                {
                    interest: user?.interest || "Advanced Study",
                    goal: `${user?.goal || "Continue learning"} - Advanced Level`,
                    minutesPerDay: currentMinutes,
                    totalDays: currentDays,
                    description: "심화 학습을 위한 고급 과정입니다.",
                    rationale: "기초를 다졌으니 이제 심화 학습을 진행하세요.",
                },
                {
                    interest: `${user?.interest || "Study"} Applications`,
                    goal: "실전 프로젝트 완성",
                    minutesPerDay: currentMinutes + 10,
                    totalDays: Math.min(30, currentDays + 7),
                    description: "배운 내용을 실전에 적용하는 프로젝트입니다.",
                    rationale: "이론을 실전에 적용하여 실력을 굳히세요.",
                },
                {
                    interest: `Related ${user?.interest || "Skills"}`,
                    goal: "관련 기술 습득",
                    minutesPerDay: currentMinutes,
                    totalDays: 14,
                    description: "관련된 새로운 기술을 배웁니다.",
                    rationale: "인접 분야로 확장하여 역량을 넓히세요.",
                },
            ];
        }

        return NextResponse.json({ recommendations });
    } catch (error) {
        console.error("Follow-up recommendation error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
