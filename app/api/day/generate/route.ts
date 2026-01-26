import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { DayMissionResponseSchema } from "@/lib/schemas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { userId, dayNumber, missionTitle, focus, difficulty } =
      await req.json();

    if (!userId || !dayNumber || !missionTitle) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await withOpikTrace(
      "generate_day_mission",
      { dayNumber, missionTitle, focus, difficulty },
      async () => {
        const prompt = `You are a learning mission designer. Create a day's learning mission as JSON.

Interest: "${user.interest}"
Goal: "${user.goal}"
Day ${dayNumber} Mission: "${missionTitle}"
Focus: "${focus}"
Difficulty Level: ${difficulty}/3
Time budget: ${user.minutesPerDay} minutes

Create:
1. 5-8 concrete learning steps that fit the time budget
2. Exactly 3 quiz questions (mix: prefer 2 MCQ + 1 short answer)
   - MCQ should have 3-4 choices
   - Short answer should be verifiable

Return ONLY valid JSON:
{
  "steps": ["step1", "step2", ...],
  "quiz": [
    { "q": "question", "type": "mcq", "choices": ["a", "b", "c"], "answer": "correct_choice" },
    { "q": "question", "type": "short", "answer": "expected_answer" }
  ]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 1500,
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
        return DayMissionResponseSchema.parse(parsed);
      },
      { model: "gpt-4o-mini", dayNumber, difficulty }
    );

    // Update DayPlan with steps and quiz
    const dayPlan = await prisma.dayPlan.findFirst({
      where: {
        plan: { userId },
        dayNumber,
      },
    });

    if (!dayPlan) {
      return NextResponse.json({ error: "Day not found" }, { status: 404 });
    }

    await prisma.dayPlan.update({
      where: { id: dayPlan.id },
      data: {
        steps: JSON.stringify(result.steps),
        quiz: JSON.stringify(result.quiz),
      },
    });

    return NextResponse.json({
      steps: result.steps,
      quiz: result.quiz,
    });
  } catch (error) {
    console.error("Day mission generation error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
