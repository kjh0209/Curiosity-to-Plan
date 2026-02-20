import { NextRequest, NextResponse } from "next/server";
import { withOpikTrace } from "@/lib/opik";
import { prisma } from "@/lib/db";
import { searchYouTubeVideos } from "@/lib/youtube";
import { getBestTechArticle } from "@/lib/articles";
import { getBestMediumArticle } from "@/lib/medium";
import { getBestWikiPage } from "@/lib/wikipedia";
import { generateWithAI } from "@/lib/ai-provider";
import { canOpenDay, incrementDayOpenCount } from "@/lib/subscription";
import { z } from "zod";

const DayMissionResponseSchema = z.object({
  steps: z.array(z.string()).min(3).max(10),
  quiz: z.array(
    z.object({
      q: z.string(),
      type: z.enum(["mcq", "short", "short_answer"]),
      choices: z.array(z.string()).optional(),
      answer: z.string(),
      alternativeAnswers: z.array(z.string()).optional(),
      explanation: z.string().optional(),
    })
  ).length(3),
  searchTerms: z.array(z.string()).min(2).max(4),
  isTechTopic: z.boolean().default(true),
  wikipediaSearchTerm: z.string().optional(),
  recommendedBook: z.object({
    title: z.string(),
    author: z.string(),
    reason: z.string()
  }).optional(),
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

    // Check daily day-opening limit
    const dayCheck = await canOpenDay(userId);
    if (!dayCheck.allowed) {
      return NextResponse.json({
        limitReached: true,
        type: "day_limit",
        tier: dayCheck.tier,
        remaining: dayCheck.remaining,
        total: dayCheck.total,
      }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userLanguage = user.language || "en";
    const resourceSort = (user.resourceSort || "relevance") as "relevance" | "viewCount" | "rating";
    const languageName = languageNames[userLanguage] || "English";

    // RAG: Fetch recent negative feedback to improve quality
    const negativeFeedback = await prisma.userFeedback.findMany({
      where: {
        userId,
        OR: [
          { contentRating: { lte: 2 } },
          { difficultyRating: { lte: 2 } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { dayPlan: true }
    });

    let ragContext = "";
    if (negativeFeedback.length > 0) {
      const feedbackTexts = negativeFeedback.map((f: any) =>
        `- On "${f.dayPlan?.missionTitle}": User rated it poorly (${f.contentRating}/5). Feedback: "${f.textFeedback || 'No details'}"`
      ).join("\n");

      ragContext = `
IMPORTANT - AVOID PREVIOUS MISTAKES:
The user has given negative feedback on previous content. You MUST avoid these patterns:
${feedbackTexts}
Ensure this new content addresses these concerns (e.g., if previous was too hard, make this easier).
`;
    }

    const result = await withOpikTrace(
      "generate_day_mission",
      { dayNumber, missionTitle, focus, difficulty, language: userLanguage, ragContext },
      async () => {
        const prompt = `Create day ${dayNumber} learning content for "${user.interest}" in ${languageName}.
IMPORTANT: ALL CONTENT MUST BE IN ${languageName} (except for search terms if English finds better results).
${ragContext}

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
   - For MCQ: 4 plausible choices with REAL CONTENT (not "A","B","C","D"). The "answer" field MUST be the EXACT FULL TEXT of the correct choice, NOT a letter.
   - For short answer: Answer must be a specific term (1-3 words).
   - For short answer: If the answer is a CONCEPT that can be expressed in multiple languages, include an "alternativeAnswers" array with ALL common equivalent terms across languages. Always include the English equivalent, and add equivalents in other languages the concept is commonly known by (e.g., answer "인터페이스" → alternativeAnswers: ["interface"], answer "インターフェース" → alternativeAnswers: ["interface", "인터페이스"], answer "interfaz" → alternativeAnswers: ["interface"]). Do NOT include alternatives for specific COMMANDS, KEYWORDS, or CODE SYNTAX that must be typed exactly (e.g., "type", "const", "npm install").
3. 3-4 search keywords for YouTube/Articles.
   - For Non-Tech topics (e.g. Guitar), use simple English or Korean terms.
4. Classify topic:
   - "isTechTopic": true if it is programming/IT/engineering. false for music, art, sports, etc.
   - "wikipediaSearchTerm": The single most relevant Wikipedia page title for TODAY's lesson.
5. "recommendedBook": Recommend ONE specific book that is best for TODAY's topic.
   - title, author, reason (why it fits today's mission, 1 sentence).

Return ONLY valid JSON:
{
  "steps": ["Step 1...", "Step 2..."],
  "quiz": [
    {"q":"Which pattern separates UI from logic?","type":"mcq","choices":["MVC 패턴","싱글톤 패턴","팩토리 패턴","옵저버 패턴"],"answer":"MVC 패턴","explanation":"MVC separates Model, View, Controller."},
    {"q":"What concept defines a contract for classes?","type":"short","answer":"인터페이스","alternativeAnswers":["interface"],"explanation":"Interfaces define contracts."},
    {"q":"Which keyword declares a constant?","type":"short","answer":"const","explanation":"const declares a constant variable."}
  ],
  "searchTerms": ["topic 1", "topic 2"],
  "isTechTopic": true,
  "wikipediaSearchTerm": "Exact Wiki Title",
  "recommendedBook": { "title": "Book Title", "author": "Author Name", "reason": "Reason..." }
}`;


        const aiResult = await generateWithAI(userId, prompt, 2500);
        const content = aiResult.text;
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

    // Fetch resources - all in parallel for speed
    const maxVideoMinutes = Math.max(5, Math.floor((user.minutesPerDay || 20) * 0.6));
    const wikiLang = userLanguage === "en" ? "en" : userLanguage;
    const wikiTerm = result.wikipediaSearchTerm || result.searchTerms[0] || user.interest;
    const wikiQuery = wikiTerm.replace(/(tutorial|guide|course|101|lesson|learn)/gi, "").trim();
    const articleTerm = result.searchTerms[0] || user.interest;

    // Run all external fetches concurrently
    const [ytResults, wikiPage, mediumArticle] = await Promise.all([
      // YouTube: all search terms in parallel
      Promise.all(
        result.searchTerms.slice(0, 3).map((term: string) =>
          searchYouTubeVideos(`${user.interest} ${term}`, userLanguage, resourceSort, 5, maxVideoMinutes)
        )
      ),
      // Wikipedia with language fallback
      getBestWikiPage(wikiQuery, wikiLang).then(page =>
        page || (wikiLang !== "en" ? getBestWikiPage(wikiQuery, "en") : null)
      ),
      // Medium article
      getBestMediumArticle(articleTerm),
    ]);

    // Dev.to fallback (only if Medium failed and it's a tech topic)
    let bestArticle = mediumArticle;
    if (!bestArticle && result.isTechTopic === true) {
      bestArticle = await getBestTechArticle(`${user.interest} ${articleTerm}`);
    }

    const resources: any[] = [];

    // 1. YouTube results
    for (const ytResult of ytResults) {
      if (ytResult.videos.length > 0) {
        const video = ytResult.videos[0];
        resources.push({
          type: "youtube",
          title: video.title,
          url: video.url,
          description: video.viewCount ? `${video.channelTitle} • ${video.viewCount}` : video.channelTitle,
          thumbnail: video.thumbnail,
          duration: video.duration,
          durationMinutes: video.durationMinutes,
        });
      }
    }

    // 2. Wikipedia
    if (wikiPage) {
      resources.push({
        type: "wikipedia",
        title: wikiPage.title,
        url: wikiPage.url,
        description: wikiPage.extract ? `${wikiPage.extract.slice(0, 100)}...` : "Encyclopedia entry",
      });
    }

    // 3. Article
    if (bestArticle) {
      resources.push({
        type: "article",
        title: bestArticle.title,
        url: bestArticle.url,
        description: bestArticle.description,
      });
    } else {
      resources.push({
        type: "article",
        title: `Explore: ${articleTerm} on Medium`,
        url: `https://medium.com/search?q=${encodeURIComponent(articleTerm)}`,
        description: "Search results",
      });
    }

    // 4. Textbook Recommendation (Removed: Now using daily specific book from AI)

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
        recommendedBook: result.recommendedBook ? JSON.stringify(result.recommendedBook) : null,
      },
    });

    // Increment daily day-open counter
    await incrementDayOpenCount(userId);

    return NextResponse.json({
      id: dayPlan.id,
      steps: result.steps,
      quiz: result.quiz,
      resources,
      recommendedBook: result.recommendedBook,
    });
  } catch (error: any) {
    console.error("Day mission generation error:", error);

    // User-friendly message for quota/rate limit errors
    const msg = String(error);
    if (error.status === 429 || msg.includes("capacity") || msg.includes("quota") || msg.includes("limit")) {
      return NextResponse.json({
        error: "AI service is temporarily at capacity. Please try again in a few minutes. If this issue persists, please contact us at kevin070209@gmail.com"
      }, { status: 429 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
