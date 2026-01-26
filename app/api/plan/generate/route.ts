import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { PlanResponseSchema } from "@/lib/schemas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { userId, interest, goal, minutesPerDay } = await req.json();

    if (!userId || !interest || !goal) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await withOpikTrace(
      "generate_plan",
      { interest, goal, minutesPerDay },
      async () => {
        const prompt = `You are an expert learning curriculum designer. Create a structured 14-day learning plan as JSON.

User wants to learn: "${interest}"
Goal: "${goal}"
Time available per day: ${minutesPerDay} minutes

Generate exactly 14 days of learning missions. Each day should have:
- dayNumber (1-14)
- missionTitle (short, concrete)
- focus (brief focus area)
- difficulty (1, 2, or 3 - gradually increasing but realistic)

Return ONLY valid JSON matching this exact format:
{
  "planTitle": "string",
  "days": [
    { "dayNumber": 1, "missionTitle": "string", "focus": "string", "difficulty": "1" },
    ...
  ]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const content = completion.choices[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return PlanResponseSchema.parse(parsed);
      },
      { model: "gpt-4o-mini" }
    );

    // Store in database - upsert user first
    await prisma.user.upsert({
      where: { id: userId },
      update: {
        interest,
        goal,
        minutesPerDay,
      },
      create: {
        id: userId,
        interest,
        goal,
        minutesPerDay,
      },
    });

    const plan = await prisma.plan.create({
      data: {
        userId,
        planTitle: result.planTitle,
        days: {
          createMany: {
            data: result.days.map((day, idx) => ({
              dayNumber: day.dayNumber,
              missionTitle: day.missionTitle,
              focus: day.focus,
              difficulty: day.difficulty,
              status: idx === 0 ? "READY" : "LOCKED",
            })),
          },
        },
      },
      include: {
        days: {
          orderBy: {
            dayNumber: "asc",
          },
        },
      },
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Plan generation error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
