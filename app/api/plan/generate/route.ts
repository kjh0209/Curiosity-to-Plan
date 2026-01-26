import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Language mapping for the prompt
const languageNames: Record<string, string> = {
  ko: "Korean (한국어)",
  en: "English",
  ja: "Japanese (日本語)",
  es: "Spanish (Español)",
};

async function generateDaysBatch(
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
): Promise<any[]> {
  const batchSize = endDay - startDay + 1;
  const progressPercent = Math.round(((startDay - 1) / totalDays) * 100);
  const languageName = languageNames[language] || "Korean";

  // Define phases to help LLM maintain context
  let currentPhase = "Foundation & Core Concepts";
  if (progressPercent >= 75) currentPhase = "Advanced Mastery & Project Completion";
  else if (progressPercent >= 50) currentPhase = "Intermediate Skills & Practical Application";
  else if (progressPercent >= 25) currentPhase = "Building Blocks & Progressive Difficulty";

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
5. Provide a "focus" for each day explaining the specific skill or concept to master.

Return ONLY a JSON array of objects:
[
  {
    "dayNumber": ${startDay},
    "missionTitle": "Phase: Specific Action/Concept",
    "focus": "A short sentence in ${languageName} describing the learning focus."
  },
  ...
]`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Using 4o-mini for speed but with high instruction following
    max_tokens: 2500,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const content = completion.choices[0]?.message?.content || "";
  const arrayMatch = content.match(/\[[\s\S]*?\]/);

  if (!arrayMatch) return generateFallbackDays(interest, goal, startDay, endDay, totalDays, languageName);

  try {
    const jsonStr = arrayMatch[0].replace(/,(\s*[\]}])/g, '$1').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
    const parsed = JSON.parse(jsonStr);

    return parsed.map((day: any, i: number) => ({
      dayNumber: day.dayNumber || startDay + i,
      missionTitle: String(day.missionTitle || `Day ${startDay + i}`).substring(0, 120),
      focus: String(day.focus || "").substring(0, 250),
      difficulty: 1, // Will be scaled/stored in DayPlan
    }));
  } catch (e) {
    console.error("JSON parse error:", e);
    return generateFallbackDays(interest, goal, startDay, endDay, totalDays, languageName);
  }
}

function generateFallbackDays(interest: string, goal: string, startDay: number, endDay: number, totalDays: number, lang: string): any[] {
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

        for (let startDay = 1; startDay <= totalDays; startDay += BATCH_SIZE) {
          const endDay = Math.min(startDay + BATCH_SIZE - 1, totalDays);
          const previousSummary = summarizeDays(allDays);

          const batchDays = await generateDaysBatch(
            interest, goal, minutesPerDay, totalDays,
            riskStyle, baselineLevel, language, startDay, endDay,
            previousSummary
          );
          allDays = allDays.concat(batchDays);
        }

        return { planTitle, days: allDays };
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
