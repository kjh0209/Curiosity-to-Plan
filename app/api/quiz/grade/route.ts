import { NextRequest, NextResponse } from "next/server";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { generateWithAI } from "@/lib/ai-provider";

// Resolve MCQ letter answer (e.g., "A") to actual choice text
function resolveAnswer(question: any): string {
  if (question.type === "mcq" && Array.isArray(question.choices)) {
    const ans = question.answer.trim();
    if (ans.length === 1) {
      const idx = ans.toLowerCase().charCodeAt(0) - 97;
      if (idx >= 0 && idx < question.choices.length) {
        return question.choices[idx];
      }
    }
  }
  return question.answer;
}

// Helper to check answer correctness (Same logic as Frontend to ensure consistency)
function isAnswerCorrect(question: any, userAnswer: string): boolean {
  if (!userAnswer) return false;

  const cleanUser = userAnswer.trim().toLowerCase();
  const cleanCorrect = question.answer.trim().toLowerCase();

  // 1. Direct match
  if (cleanUser === cleanCorrect) return true;

  // 2. MCQ Letter match
  if (question.type === "mcq" && Array.isArray(question.choices)) {
    const selectedIndex = question.choices.findIndex((c: string) => c.trim().toLowerCase() === cleanUser);
    if (selectedIndex !== -1) {
      const letter = String.fromCharCode(97 + selectedIndex); // 'a', 'b', etc.
      if (letter === cleanCorrect) return true;
    }
    // Also match against resolved answer text
    const resolved = resolveAnswer(question).trim().toLowerCase();
    if (cleanUser === resolved) return true;
  }

  // 3. Alternative answers match (for bilingual concept equivalents)
  if (Array.isArray(question.alternativeAnswers)) {
    for (const alt of question.alternativeAnswers) {
      if (cleanUser === alt.trim().toLowerCase()) return true;
    }
  }

  // 4. Substring/Fuzzy match for short answers
  if (cleanUser.includes(cleanCorrect)) return true;
  if (cleanCorrect.includes(cleanUser) && cleanUser.length > 3) return true;

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      planId,
      dayNumber,
      quiz,
      userAnswers,
      currentDifficulty = 1,
      resourcesCompleted,
    } = await req.json();

    if (!userId || !planId || !dayNumber || !quiz || !userAnswers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const gradeResult = await withOpikTrace(
      "grade_quiz",
      { dayNumber, quizCount: quiz.length, userAnswersCount: userAnswers.length },
      async () => {
        // 1. Calculate Score Deterministically
        let correctCount = 0;
        const gradingDetails = quiz.map((q: any, i: number) => {
          const isCorrect = isAnswerCorrect(q, userAnswers[i]);
          if (isCorrect) correctCount++;
          return {
            q: q.q,
            userAnswer: userAnswers[i],
            correctAnswer: resolveAnswer(q),
            isCorrect,
          };
        });

        const score = correctCount;

        // 2. Generate Feedback using LLM (but verify score matches)
        const quizSummary = gradingDetails
          .map(
            (d: any, i: number) =>
              `Q${i + 1}: ${d.q}
User Answer: "${d.userAnswer}"
Correct Answer: "${d.correctAnswer}"
Result: ${d.isCorrect ? "CORRECT" : "INCORRECT"}`
          )
          .join("\n\n");

        const prompt = `You are a fair learning assessment grader.
User Score: ${score}/3

Quiz Details:
${quizSummary}

Task:
Provide a concise, encouraging feedback sentence (max 1-2 sentences) explaining what they got right/wrong.
If Score is 3, be very celebratory.
If Score is < 3, give a specific tip on what to review based on the INCORRECT answers.

Return ONLY JSON:
{
  "feedback": "string",
  "difficultySignal": "TOO_EASY" | "ON_TRACK" | "TOO_HARD"
}
(Note: difficultySignal should be based on: 3->"TOO_EASY", 2->"ON_TRACK", <=1->"TOO_HARD")`;


        const aiResult = await generateWithAI(userId, prompt, 200);
        const content = aiResult.text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        // Default values if LLM fails
        let feedback = "Good effort! Review the missed questions.";
        let difficultySignal = score === 3 ? "TOO_EASY" : score === 2 ? "ON_TRACK" : "TOO_HARD";

        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            feedback = parsed.feedback || feedback;
            // We can trust LLM's difficulty signal or enforce it:
            // Enforcing it is safer to align with score.
            difficultySignal = score === 3 ? "TOO_EASY" : score === 2 ? "ON_TRACK" : "TOO_HARD";
          } catch (e) {
            console.error("Error parsing LLM feedback JSON", e);
          }
        }

        return {
          score,
          feedback,
          difficultySignal,
        };
      },
      { model: "gpt-4o-mini-hybrid", dayNumber, currentDifficulty }
    );

    // 2. Determine passed
    let passed = false;
    let failureReason = "";

    if (gradeResult.score === 3 && resourcesCompleted) {
      passed = true;
    } else {
      if (gradeResult.score !== 3) {
        failureReason = "Quiz not passed (score less than 3).";
      } else if (!resourcesCompleted) {
        failureReason = "Resources not completed.";
      }
    }

    // Augment gradeResult
    const augmentedGradeResult = {
      ...gradeResult,
      passed,
      failureReason,
    };

    // 3. Update Database if passed
    if (passed) {
      const dayPlan = await prisma.dayPlan.findFirst({
        where: { planId: planId, dayNumber },
      });

      if (dayPlan) {
        await prisma.dayPlan.update({
          where: { id: dayPlan.id },
          data: { status: "DONE", result: JSON.stringify(augmentedGradeResult) },
        });

        // Update Streak
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let newStreak = 1;
          if (user.lastCompletedDate) {
            const lastDate = new Date(user.lastCompletedDate);
            lastDate.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastDate.getTime() === yesterday.getTime()) newStreak = (user.streak || 0) + 1;
            else if (lastDate.getTime() === today.getTime()) newStreak = user.streak || 1;
          }
          await prisma.user.update({
            where: { id: userId },
            data: { streak: newStreak, lastCompletedDate: new Date() },
          });
        }

        // Unlock next day
        const nextDayNum = Number(dayNumber) + 1;
        const nextDay = await prisma.dayPlan.findFirst({
          where: { planId: planId, dayNumber: nextDayNum },
        });

        if (nextDay) {
          let nextDifficulty = currentDifficulty;
          if (augmentedGradeResult.difficultySignal === "TOO_EASY") nextDifficulty = Math.min(3, currentDifficulty + 1);
          else if (augmentedGradeResult.difficultySignal === "TOO_HARD") nextDifficulty = Math.max(1, currentDifficulty - 1);

          await prisma.dayPlan.update({
            where: { id: nextDay.id },
            data: { status: "READY", difficulty: nextDifficulty },
          });
        }
      }
    }

    return NextResponse.json(augmentedGradeResult);
  } catch (error) {
    console.error("Quiz grading error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
