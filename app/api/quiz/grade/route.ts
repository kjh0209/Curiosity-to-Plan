import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { QuizGradeResponseSchema } from "@/lib/schemas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      dayNumber,
      quiz,
      userAnswers,
      currentDifficulty,
    } = await req.json();

    if (!userId || !dayNumber || !quiz || !userAnswers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const gradeResult = await withOpikTrace(
      "grade_quiz",
      { dayNumber, quizCount: quiz.length, userAnswersCount: userAnswers.length },
      async () => {
        const quizText = quiz
          .map(
            (q: any, i: number) =>
              `Q${i + 1}: ${q.q}
Answer: ${userAnswers[i] || "NO ANSWER"}`
          )
          .join("\n\n");

        const prompt = `You are a strict but fair learning assessment grader. Grade this quiz and provide feedback.

Quiz Questions and User Answers:
${quizText}

Expected Answers:
${quiz.map((q: any, i: number) => `Q${i + 1}: ${q.answer}`).join("\n")}

Grading rules:
- 1 point per correct question (max 3)
- Accept minor variations for short answers
- Provide ONE feedback sentence max (concise)
- Determine difficulty signal:
  - If score == 3: "TOO_EASY"
  - If score == 2: "ON_TRACK"
  - If score <= 1: "TOO_HARD"

Return ONLY JSON:
{
  "score": number,
  "feedback": "string",
  "difficultySignal": "TOO_EASY" | "ON_TRACK" | "TOO_HARD"
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 300,
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
        return QuizGradeResponseSchema.parse(parsed);
      },
      { model: "gpt-4o-mini", dayNumber, currentDifficulty }
    );

    // Find and update day
    const dayPlan = await prisma.dayPlan.findFirst({
      where: {
        plan: { userId },
        dayNumber,
      },
    });

    if (!dayPlan) {
      return NextResponse.json({ error: "Day not found" }, { status: 404 });
    }

    // Mark day as DONE
    await prisma.dayPlan.update({
      where: { id: dayPlan.id },
      data: {
        status: "DONE",
        result: JSON.stringify(gradeResult),
      },
    });

    // Update streak
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let newStreak = 1;
      if (user.lastCompletedDate) {
        const lastDate = new Date(user.lastCompletedDate);
        lastDate.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastDate.getTime() === yesterday.getTime()) {
          newStreak = (user.streak || 0) + 1;
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          streak: newStreak,
          lastCompletedDate: new Date(),
        },
      });
    }

    // Unlock next day if applicable
    if (dayNumber < 14) {
      const nextDay = await prisma.dayPlan.findFirst({
        where: {
          plan: { userId },
          dayNumber: dayNumber + 1,
        },
      });

      if (nextDay) {
        let nextDifficulty = currentDifficulty;

        if (gradeResult.difficultySignal === "TOO_EASY") {
          nextDifficulty = Math.min(3, currentDifficulty + 1);
        } else if (gradeResult.difficultySignal === "TOO_HARD") {
          nextDifficulty = Math.max(1, currentDifficulty - 1);
        }

        await prisma.dayPlan.update({
          where: { id: nextDay.id },
          data: {
            status: "READY",
            difficulty: nextDifficulty,
          },
        });
      }
    }

    return NextResponse.json(gradeResult);
  } catch (error) {
    console.error("Quiz grading error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
