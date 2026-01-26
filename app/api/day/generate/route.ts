import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { searchYouTubeVideos } from "@/lib/youtube";
import { getBestTechArticle } from "@/lib/articles";
import { getBestMediumArticle } from "@/lib/medium";
import { getBestWikiPage } from "@/lib/wikipedia";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DayMissionResponseSchema = z.object({
  steps: z.array(z.string()).min(3).max(10),
  quiz: z.array(
    z.object({
      q: z.string(),
      type: z.enum(["mcq", "short", "short_answer"]),
      choices: z.array(z.string()).optional(),
      answer: z.string(),
      explanation: z.string().optional(),
    })
  ).length(3),
  searchTerms: z.array(z.string()).min(2).max(4),
  isTechTopic: z.boolean().default(true),
  wikipediaSearchTerm: z.string().optional(),
});

// Language display names
const languageNames: Record<string, string> = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export async function POST(req: NextRequest) {
  try {
    const { userId, dayNumber, missionTitle, focus, difficulty, planId } = await req.json();

    if (!userId || !dayNumber || !missionTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userLanguage = user.language || "en";
    const resourceSort = (user.resourceSort || "relevance") as "relevance" | "viewCount" | "rating";
    const languageName = languageNames[userLanguage] || "English";

    const result = await withOpikTrace(
      "generate_day_mission",
      { dayNumber, missionTitle, focus, difficulty, language: userLanguage },
      async () => {
        const prompt = `Create day ${dayNumber} learning content for "${user.interest}" in ${languageName}.
IMPORTANT: ALL CONTENT MUST BE IN ${languageName} (except for search terms if English finds better results).

Mission: "${missionTitle}"
Focus: "${focus}"
Goal: "${user.goal}"
Time: ${user.minutesPerDay} minutes
Difficulty: ${difficulty}/3
Language: ${languageName}

Create:
1. ${Math.max(3, Math.min(8, Math.floor(user.minutesPerDay / 5)))} concrete learning steps (in ${languageName})
2. 3 HIGH-QUALITY quiz questions (in ${languageName}):
   - Questions must be specific and test actual knowledge.
   - For MCQ: 4 plausible choices.
   - For short answer: Answer must be a specific term (1-3 words).
3. 3-4 search keywords for YouTube/Articles.
   - For Non-Tech topics (e.g. Guitar), use simple English or Korean terms.
4. Classify topic:
   - "isTechTopic": true if it is programming/IT/engineering. false for music, art, sports, etc.
   - "wikipediaSearchTerm": The single most relevant Wikipedia page title for TODAY's lesson.

Return ONLY valid JSON:
{
  "steps": ["Step 1...", "Step 2..."],
  "quiz": [
    {"q":"Question?","type":"mcq","choices":["A","B","C","D"],"answer":"A","explanation":"Explanation..."},
    ...
  ],
  "searchTerms": ["topic 1", "topic 2"],
  "isTechTopic": true,
  "wikipediaSearchTerm": "Exact Wiki Title"
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 2500,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        });

        const content = completion.choices[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found");

        const jsonStr = jsonMatch[0].replace(/,(\s*[\]}])/g, '$1').replace(/[\r\n\t]/g, ' ');
        const parsed = JSON.parse(jsonStr);

        // Fix schema parsing result
        if (parsed.quiz) {
          parsed.quiz = parsed.quiz.map((q: any) => ({
            ...q,
            type: (q.type?.includes("short") || q.type === "short_answer") ? "short" : q.type
          }));
        }

        return DayMissionResponseSchema.parse(parsed);
      },
      { model: "gpt-4o-mini", dayNumber, difficulty, language: userLanguage }
    );

    // Fetch resources
    const resources: any[] = [];

    // 1. YouTube
    for (const term of result.searchTerms.slice(0, 3)) {
      const query = `${user.interest} ${term}`;
      const ytResult = await searchYouTubeVideos(query, userLanguage, resourceSort, 1);

      if (ytResult.videos.length > 0) {
        const video = ytResult.videos[0];
        resources.push({
          type: "youtube",
          title: video.title,
          url: video.url,
          description: video.viewCount ? `${video.channelTitle} • ${video.viewCount}` : video.channelTitle,
          thumbnail: video.thumbnail,
        });
      }
    }

    // 2. Wikipedia (Smart)
    const wikiLang = userLanguage === "en" ? "en" : userLanguage;
    const wikiTerm = result.wikipediaSearchTerm || result.searchTerms[0] || user.interest;
    const wikiQuery = wikiTerm.replace(/(tutorial|guide|course|101|lesson|learn)/gi, "").trim();

    let wikiPage = await getBestWikiPage(wikiQuery, wikiLang);
    // If local wiki failed, try English wiki as fallback
    if (!wikiPage && wikiLang !== "en") {
      wikiPage = await getBestWikiPage(wikiQuery, "en");
    }

    if (wikiPage) {
      resources.push({
        type: "wikipedia",
        title: wikiPage.title,
        url: wikiPage.url,
        description: wikiPage.extract
          ? `${wikiPage.extract.slice(0, 100)}...`
          : `Encyclopedia entry`,
      });
    }

    // 3. Recommended Article (Medium for All, Dev.to ONLY for Tech)
    const articleTerm = result.searchTerms[0] || user.interest;
    let bestArticle = await getBestMediumArticle(articleTerm); // Medium RSS works for mostly everything

    // Only try Dev.to IF it is explicitly a Tech Topic
    if (!bestArticle && result.isTechTopic === true) {
      bestArticle = await getBestTechArticle(`${user.interest} ${articleTerm}`);
    }

    if (bestArticle) {
      resources.push({
        type: "article",
        title: bestArticle.title,
        url: bestArticle.url,
        description: bestArticle.description,
      });
    } else {
      // Fallback to Medium Search
      resources.push({
        type: "article",
        title: `Explore: ${articleTerm} on Medium`,
        url: `https://medium.com/search?q=${encodeURIComponent(articleTerm)}`,
        description: "Search results",
      });
    }

    // Update DayPlan
    const dayPlan = await prisma.dayPlan.findFirst({
      where: {
        plan: { userId },
        dayNumber,
        ...(planId ? { planId } : {}),
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
        resources: JSON.stringify(resources),
      },
    });

    return NextResponse.json({
      steps: result.steps,
      quiz: result.quiz,
      resources,
    });
  } catch (error) {
    console.error("Day mission generation error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
