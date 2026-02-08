import { NextRequest, NextResponse } from "next/server";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { generateWithAI } from "@/lib/ai-provider";

// Language mapping for the prompt
const languageNames: Record<string, string> = {
  ko: "Korean (한국어)",
  en: "English",
  ja: "Japanese (日本語)",
  es: "Spanish (Español)",
};

async function generateDaysBatch(
  userId: string,
  interest: string,
  goal: string,
  minutesPerDay: number,
  totalDays: number,
  riskStyle: string,
  baselineLevel: string,
  language: string,
  startDay: number,
  endDay: number,
  previousDaysSummary: string
): Promise<{ days: any[], book: any }> {
  const progressPercent = Math.round(((startDay - 1) / totalDays) * 100);
  const languageName = languageNames[language] || "Korean";

  // Define phases to help LLM maintain context
  let currentPhase = "Foundation & Core Concepts";
  if (progressPercent >= 75) currentPhase = "Advanced Mastery & Project Completion";
  else if (progressPercent >= 50) currentPhase = "Intermediate Skills & Practical Application";
  else if (progressPercent >= 25) currentPhase = "Building Blocks & Progressive Difficulty";

  // Only ask for book recommendation in the first batch (startDay === 1)
  const bookRequest = startDay === 1 ? `
5. RECOMMEND A TEXTBOOK:
   Select ONE highly-rated, authoritative textbook involved in "${interest}" that is suitable for ${baselineLevel} level.
   It MUST be a real book.
   Provide: title, author, totalPages (approx), and a short description in ${languageName}.
` : "";

  const prompt = `You are a world-class curriculum designer specialized in long-term mastery. 
You are currently designing days ${startDay} to ${endDay} of a ${totalDays}-day mastery plan for: "${interest}".

ULTIMATE TARGET GOAL: "${goal}"
STUDENT LEVEL: ${baselineLevel}
CHALLENGE STYLE: ${riskStyle}
DAILY COMMITMENT: ${minutesPerDay} minutes
LANGUAGE: Generate titles and focus areas in ${languageName}.

CURRENT PROGRESS: ${progressPercent}% complete.
CURRENT PHASE: ${currentPhase}

PREVIOUSLY COVERED (DO NOT REPEAT):
${previousDaysSummary || "Start of the journey."}

STRICT INSTRUCTIONS:
1. Every daily title MUST be unique and show logical progress toward the "${goal}".
2. Titles must reflect the current phase. (e.g., "Day 45: Mastery - Deep Dive into X")
3. Titles must be specific, not generic like "Day 45: Continue Practice".
4. The content must be tailored to the ${totalDays}-day duration. If it's a 100-day plan, make sure the progression is realistic and deep.
5. Provide a "focus" for each day explaining the specific skill or concept to master.${bookRequest}

Return ONLY a JSON object with this structure:
{
  "days": [
    {
      "dayNumber": ${startDay},
      "missionTitle": "Phase: Specific Action/Concept",
      "focus": "A short sentence in ${languageName} describing the learning focus."
    },
    ...
  ]${startDay === 1 ? `,
  "book": {
    "title": "Exact Book Title",
    "author": "Author Name",
    "totalPages": 300,
    "description": "Why this book is good (in ${languageName})"
  }` : ""}
}`;

  try {
    const aiResult = await generateWithAI(userId, prompt, 3000);
    const content = aiResult.text;

    // Parse JSON
    let parsed: any;
    try {
      // Find JSON object
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found");
      }
    } catch (e) {
      console.error("AI generation or JSON parse error:", e);
      // Fallback for JSON parsing error
      const fallbackDays = generateFallbackDays(interest, goal, startDay, endDay, totalDays, languageName);
      return { days: fallbackDays, book: null };
    }

    const days = parsed.days.map((day: any, i: number) => ({
      dayNumber: day.dayNumber || startDay + i,
      missionTitle: String(day.missionTitle || `Day ${startDay + i}`).substring(0, 120),
      focus: String(day.focus || "").substring(0, 250),
      difficulty: 1, // Will be scaled/stored in DayPlan
    }));

    return { days, book: parsed.book || null };
  } catch (e) {
    console.error("AI generation error:", e);
    const fallbackDays = generateFallbackDays(interest, goal, startDay, endDay, totalDays, languageName);
    return { days: fallbackDays, book: null };
  }
}

function generateFallbackDays(interest: string, goal: string, startDay: number, endDay: number, _totalDays: number, lang: string): any[] {
  const days = [];
  for (let d = startDay; d <= endDay; d++) {
    days.push({
      dayNumber: d,
      missionTitle: `Phase Building - Day ${d}: ${interest} for ${goal}`,
      focus: `Progressive step toward mastery in your chosen language (${lang}).`,
      difficulty: 1,
    });
  }
  return days;
}

function summarizeDays(days: any[]): string {
  if (days.length === 0) return "";
  const lastFive = days.slice(-5);
  return lastFive.map(d => `Day ${d.dayNumber}: ${d.missionTitle}`).join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      interest,
      goal,
      minutesPerDay = 20,
      totalDays = 14,
      riskStyle = "BALANCED",
      baselineLevel = "BEGINNER",
      language = "ko",
      resourceSort = "viewCount"
    } = await req.json();

    if (!userId || !interest || !goal) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await withOpikTrace(
      "generate_plan",
      { interest, goal, minutesPerDay, totalDays, riskStyle, baselineLevel, language },
      async () => {
        const planTitle = `${totalDays}-Day Mastery: ${interest} (${goal})`;
        let allDays: any[] = [];
        const BATCH_SIZE = 12; // Slightly larger batches for efficiency

        let recommendedBook = null;

        for (let startDay = 1; startDay <= totalDays; startDay += BATCH_SIZE) {
          const endDay = Math.min(startDay + BATCH_SIZE - 1, totalDays);
          const previousSummary = summarizeDays(allDays);

          const result = await generateDaysBatch(
            userId, interest, goal, minutesPerDay, totalDays,
            riskStyle, baselineLevel, language, startDay, endDay,
            previousSummary
          );

          allDays = allDays.concat(result.days);

          // Capture book from the first batch
          if (startDay === 1 && result.book) {
            recommendedBook = result.book;
          }
        }

        return { planTitle, days: allDays, recommendedBook };
      }
    );

    // Save preferences
    await prisma.user.update({
      where: { id: userId },
      data: { interest, goal, minutesPerDay, totalDays, riskStyle, baselineLevel, language, resourceSort },
    });

    // Create plan
    const plan = await prisma.plan.create({
      data: {
        userId,
        planTitle: result.planTitle,
        totalDays,
        minutesPerDay,
        language, // Store the language the plan was created in
        skillGraph: null,
        recommendedBook: result.recommendedBook ? JSON.stringify(result.recommendedBook) : null,
        days: {
          createMany: {
            data: result.days.map((day: any, idx: number) => ({
              dayNumber: day.dayNumber || idx + 1,
              missionTitle: day.missionTitle,
              focus: day.focus,
              difficulty: Math.min(3, 1 + Math.floor((idx / totalDays) * 2.5)), // Dynamic difficulty baseline
              status: idx === 0 ? "READY" : "LOCKED",
            })),
          },
        },
      },
      include: {
        days: { orderBy: { dayNumber: "asc" } },
      },
    });

    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Plan generation error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
