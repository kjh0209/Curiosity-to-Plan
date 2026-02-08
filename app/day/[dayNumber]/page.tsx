"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { LogoIcon } from "@/components/Logo";

interface QuizQuestion {
  q: string;
  type: "mcq" | "short";
  choices?: string[];
  answer: string;
  alternativeAnswers?: string[];
  explanation?: string;
}

interface Resource {
  type: "youtube" | "article" | "wikipedia" | "documentation" | "tutorial" | "textbook";
  title: string;
  url: string;
  description?: string;
  duration?: string;
}

interface DayData {
  id?: string;
  missionTitle: string;
  steps: string[];
  quiz: QuizQuestion[];
  resources: Resource[];
  difficulty: number;
  recommendedBook?: {
    title: string;
    author: string;
    reason: string;
  };
}

interface SavedResult {
  score: number;
  feedback: string;
  difficultySignal: string;
  userAnswers: string[];
  timestamp: string;
  passed?: boolean;
  failureReason?: string;
}

const resourceIcons: Record<string, string> = {
  youtube: "Video",
  article: "Article",
  wikipedia: "Wiki",
  documentation: "Docs",
  tutorial: "Tutorial",
  textbook: "Book",
};

const difficultyConfig = {
  1: { label: "Easy", class: "difficulty-easy" },
  2: { label: "Medium", class: "difficulty-medium" },
  3: { label: "Hard", class: "difficulty-hard" },
};

import { getDictionary, Language } from "@/lib/i18n";

// ... existing imports

// ... interfaces



export default function DayPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const dayNumber = parseInt(params.dayNumber as string, 10);
  const planId = searchParams.get("planId");
  const mode = searchParams.get("mode") || "default";

  // State
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Localization state - Default to 'ko' as per request, but will fetch profile
  const [language, setLanguage] = useState<Language>("ko");
  const dict = getDictionary(language);

  // Missing State Variables
  const [totalDays, setTotalDays] = useState(0);
  const [allDays, setAllDays] = useState<any[]>([]);
  const [savedResult, setSavedResult] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>(["", "", ""]);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [clickedResources, setClickedResources] = useState<Set<number>>(new Set());
  const [bookCoverUrl, setBookCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "loading" || !session) return;

    const fetchData = async () => {
      try {
        const userId = (session.user as any).id;
        if (!userId) {
          router.push("/auth/login");
          return;
        }

        // 1. Fetch User Profile for Language Preference (PRIORITY)
        const profileRes = await fetch(`/api/profile?userId=${userId}`);
        const profileData = await profileRes.json();
        const userLang = (profileData.profile?.language || "ko") as Language; // Default to Korean if missing
        setLanguage(userLang);

        // 2. Fetch Plan Data
        const planRes = await fetch(`/api/plans/${planId}?userId=${userId}&t=${Date.now()}`);
        if (!planRes.ok) throw new Error("Failed to fetch plan");

        const planData = await planRes.json();
        if (!planData.plan) throw new Error("Plan not found");

        const plan = planData.plan;
        setTotalDays(plan.totalDays || plan.days.length);
        setAllDays(plan.days);

        // 3. Find Day Metadata
        const dayMeta = planData.plan.days.find((d: any) => d.dayNumber === dayNumber);
        if (!dayMeta) {
          setError("Day not found");
          setLoading(false);
          return;
        }

        // 4. Restore Quiz Results
        const resultKey = `result_${planId}_${dayNumber}`;
        const savedResultStr = localStorage.getItem(resultKey);
        if (savedResultStr) {
          const parsed = JSON.parse(savedResultStr);
          setSavedResult(parsed);
          if (mode === "review") {
            setUserAnswers(parsed.userAnswers || ["", "", ""]);
            setCurrentResult(parsed);
          }
        }

        // 5. Restore Clicked Resources
        const clickedKey = `clicked_${planId}_${dayNumber}`;
        const savedClicks = localStorage.getItem(clickedKey);
        if (savedClicks) {
          setClickedResources(new Set(JSON.parse(savedClicks)));
        }

        // 6. Content Loading Strategy (Cache -> Pre-gen -> Generate)
        const cacheKey = `day_${planId}_${dayNumber}_${userLang}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          setDayData(JSON.parse(cachedData));
          setDayData(JSON.parse(cachedData));
        } else if (dayMeta.steps && dayMeta.quiz && userLang === planData.plan.language) {
          // Use Pre-generated content from DB (only if languages match)
          const data: DayData = {
            id: dayMeta.id,
            missionTitle: dayMeta.missionTitle,
            steps: JSON.parse(dayMeta.steps),
            quiz: JSON.parse(dayMeta.quiz),
            resources: dayMeta.resources ? JSON.parse(dayMeta.resources) : [],
            difficulty: dayMeta.difficulty,
            recommendedBook: dayMeta.recommendedBook ? JSON.parse(dayMeta.recommendedBook) : undefined,
          };
          setDayData(data);
          setDayData(data);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } else {
          // Generate Fresh Content (e.g. for translation or missing content)
          const genRes = await fetch("/api/day/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              planId,
              dayNumber,
              missionTitle: dayMeta.missionTitle,
              focus: dayMeta.focus,
              difficulty: dayMeta.difficulty,
              language: userLang
            }),
          });

          if (!genRes.ok) throw new Error("Failed to generate day content");

          const genData = await genRes.json();
          const dayDataObj: DayData = {
            id: genData.id,
            missionTitle: dayMeta.missionTitle,
            steps: genData.steps,
            quiz: genData.quiz,
            resources: genData.resources || [],
            difficulty: genData.difficulty,
            recommendedBook: genData.recommendedBook,
          };

          setDayData(dayDataObj);
          setDayData(dayDataObj);
          localStorage.setItem(cacheKey, JSON.stringify(dayDataObj));
        }

        // Check for existing quiz results from DB (backfilled)
        const dayRes = await fetch(`/api/day/${dayNumber}?planId=${planId}&userId=${userId}`);
        const dayDBData = await dayRes.json();
        if (dayDBData.quizAttempt) {
          // Quiz result backfill logic removed as state is handled by savedResult/currentResult
          if (dayDBData.quizAttempt.passed) {
            setSavedResult({
              score: dayDBData.quizAttempt.score,
              passed: true,
              feedback: dayDBData.quizAttempt.feedback
            });
          }
        }

      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [status, session, router, planId, dayNumber, mode]);





  const [bookCoverDone, setBookCoverDone] = useState(false);

  // Fetch book cover image from multiple sources
  useEffect(() => {
    if (!dayData?.recommendedBook) return;
    setBookCoverUrl(null);
    setBookCoverDone(false);

    const fetchCover = async () => {
      try {
        const { title, author } = dayData.recommendedBook!;

        // --- Source 1: Google Books API ---
        const googleCover = async (): Promise<string | null> => {
          const extractCover = (data: any): string | null => {
            for (const item of (data.items || [])) {
              const links = item.volumeInfo?.imageLinks;
              if (links?.thumbnail || links?.smallThumbnail) {
                return (links.thumbnail || links.smallThumbnail).replace('http://', 'https://');
              }
            }
            return null;
          };

          // Try intitle+inauthor, then title only, then general
          for (const q of [
            `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`,
            `intitle:${encodeURIComponent(title)}`,
            encodeURIComponent(title),
          ]) {
            try {
              const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=5`);
              const data = await res.json();
              const url = extractCover(data);
              if (url) return url;
            } catch { /* continue */ }
          }
          return null;
        };

        // --- Source 2: Open Library API ---
        const openLibraryCover = async (): Promise<string | null> => {
          try {
            const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3`);
            const data = await res.json();
            for (const doc of (data.docs || [])) {
              if (doc.cover_i) {
                return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
              }
              // Try ISBN-based cover as backup
              if (doc.isbn?.length > 0) {
                return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
              }
            }
          } catch { /* continue */ }
          return null;
        };

        // Run both in parallel, use whichever returns first
        const [googleResult, openLibResult] = await Promise.allSettled([
          googleCover(),
          openLibraryCover(),
        ]);

        const gUrl = googleResult.status === 'fulfilled' ? googleResult.value : null;
        const oUrl = openLibResult.status === 'fulfilled' ? openLibResult.value : null;

        if (gUrl) setBookCoverUrl(gUrl);
        else if (oUrl) setBookCoverUrl(oUrl);
      } catch (err) {
        console.error('Failed to fetch book cover:', err);
      } finally {
        setBookCoverDone(true);
      }
    };
    fetchCover();
  }, [dayData?.recommendedBook?.title]);

  const handleResourceClick = (index: number) => {
    const newSet = new Set(clickedResources);
    newSet.add(index);
    setClickedResources(newSet);
    localStorage.setItem(`clicked_${planId}_${dayNumber}`, JSON.stringify(Array.from(newSet)));
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingQuiz(true);
    setError("");

    try {
      const userId = (session?.user as any)?.id;
      if (!userId || !dayData) throw new Error("Missing data");

      const resourcesCompleted = clickedResources.size === dayData.resources.length;

      const response = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          planId,
          dayNumber,
          quiz: dayData.quiz,
          userAnswers,
          currentDifficulty: dayData.difficulty,
          resourcesCompleted,
        }),
      });

      if (!response.ok) throw new Error("Failed to grade quiz");

      const gradeResult = await response.json();

      const result: SavedResult = {
        ...gradeResult,
        userAnswers,
        timestamp: new Date().toISOString(),
      };

      setCurrentResult(result);

      const resultKey = `result_${planId}_${dayNumber}`;
      localStorage.setItem(resultKey, JSON.stringify(result));
      setSavedResult(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const navigateToDay = (targetDay: number) => {
    if (targetDay >= 1 && targetDay <= totalDays) {
      router.push(`/day/${targetDay}?planId=${planId}`);
    }
  };

  // Resolve MCQ letter answer (e.g., "A") to actual choice text
  const getDisplayAnswer = (question: QuizQuestion): string => {
    if (question.type === "mcq" && question.choices) {
      const ans = question.answer.trim();
      if (ans.length === 1) {
        const idx = ans.toLowerCase().charCodeAt(0) - 97;
        if (idx >= 0 && idx < question.choices.length) {
          return question.choices[idx];
        }
      }
    }
    return question.answer;
  };

  const isAnswerCorrect = (question: QuizQuestion, userAnswer: string): boolean => {
    if (!userAnswer) return false;
    const cleanUser = userAnswer.trim().toLowerCase();
    const cleanCorrect = question.answer.trim().toLowerCase();
    if (cleanUser === cleanCorrect) return true;
    if (question.type === "mcq" && question.choices) {
      const selectedIndex = question.choices.findIndex(c => c.trim().toLowerCase() === cleanUser);
      if (selectedIndex !== -1) {
        const letter = String.fromCharCode(97 + selectedIndex);
        if (letter === cleanCorrect) return true;
      }
      // Also match against resolved answer text
      const resolved = getDisplayAnswer(question).trim().toLowerCase();
      if (cleanUser === resolved) return true;
    }
    // Alternative answers match (bilingual concept equivalents)
    if (Array.isArray(question.alternativeAnswers)) {
      for (const alt of question.alternativeAnswers) {
        if (cleanUser === alt.trim().toLowerCase()) return true;
      }
    }
    if (cleanUser.includes(cleanCorrect)) return true;
    if (cleanCorrect.includes(cleanUser) && cleanUser.length > 3) return true;
    return false;
  };

  if (status === "loading" || loading) {
    return (
      <main className="page-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-[var(--text-secondary)]">{dict.common.loading}</p>
        </div>
      </main>
    );
  }

  if (error || !dayData) {
    return (
      <main className="page-bg flex items-center justify-center p-4">
        <div className="card p-8 max-w-md text-center animate-fade-in">
          <h1 className="text-xl font-semibold mb-2">{dict.common.error}</h1>
          <p className="text-[var(--error)] mb-6">{error}</p>
          <button
            onClick={() => router.push(`/plan?id=${planId}`)}
            className="btn btn-primary"
          >
            {dict.day.backToPlan}
          </button>
        </div>
      </main>
    );
  }

  const isReviewMode = mode === "review" && savedResult;
  const showResult = currentResult !== null;
  const diffConfig = difficultyConfig[dayData.difficulty as 1 | 2 | 3] || difficultyConfig[2];

  return (
    <main className="page-bg-gradient">
      <div className="container-default py-6 md:py-8">
        {/* Navigation Header */}
        <header className="flex items-center justify-between mb-6">
          <Link href={`/plan?id=${planId}`}>
            <button className="btn btn-ghost text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {dict.day.backToPlan}
            </button>
          </Link>

          <Link href="/">
            <LogoIcon size={36} />
          </Link>
        </header>

        {/* Day Navigation */}
        <div className="card p-4 mb-6 flex items-center justify-between animate-fade-in">
          <button
            onClick={() => navigateToDay(dayNumber - 1)}
            disabled={dayNumber <= 1}
            className="btn btn-ghost text-sm disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {dict.day.prevDay}
          </button>

          <span className="font-medium">
            {dict.day.day} {dayNumber} <span className="text-[var(--text-tertiary)]">{dict.day.of} {totalDays}</span>
          </span>

          <button
            onClick={() => navigateToDay(dayNumber + 1)}
            disabled={(() => {
              if (dayNumber >= totalDays) return true;
              const nextDay = allDays.find(d => d.dayNumber === dayNumber + 1);
              return !nextDay || nextDay.status === "LOCKED";
            })()}
            className="btn btn-ghost text-sm disabled:opacity-40"
          >
            {dict.day.nextDay}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Review Mode Indicator */}
        {isReviewMode && (
          <div className="mb-4 animate-fade-in">
            <span className="badge badge-primary py-2 px-3">
              {dict.day.reviewNotice}
            </span>
          </div>
        )}

        {/* Main Content Card */}
        <div className="card p-6 md:p-8 mb-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold mb-2">{dict.day.day} {dayNumber}</h1>
              <p className="text-[var(--text-secondary)]">{dayData.missionTitle}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/day/${dayNumber}/slide?planId=${planId}`}>
                <button className="btn btn-secondary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  {dict.day.startClass}
                </button>
              </Link>
              <Link href={`/day/${dayNumber}/article?planId=${planId}`}>
                <button className="btn btn-secondary flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  {dict.day.readLesson}
                </button>
              </Link>
              <span className={`badge ${diffConfig.class}`}>
                {diffConfig.label}
              </span>
            </div>
          </div>

          {/* Recommended Book */}
          {dayData.recommendedBook && (
            <div className="mb-8 p-6 bg-[var(--surface-highlight)] rounded-xl border border-[var(--primary)]/20 shadow-sm">
              <div className="flex items-start gap-4">
                {bookCoverUrl ? (
                  <img
                    src={bookCoverUrl}
                    alt={dayData.recommendedBook.title}
                    className="w-20 h-auto rounded-md shadow-md flex-shrink-0 object-cover"
                    onError={() => { setBookCoverUrl(null); setBookCoverDone(true); }}
                  />
                ) : (
                  <div
                    className="w-20 h-28 rounded-md shadow-md flex-shrink-0 flex flex-col items-center justify-center p-2 text-center"
                    style={{
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary, var(--primary)))',
                      opacity: bookCoverDone ? 1 : 0.5,
                    }}
                  >
                    {!bookCoverDone ? (
                      <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                    ) : (
                      <>
                        <span className="text-white text-[10px] font-bold leading-tight line-clamp-3">
                          {dayData.recommendedBook.title}
                        </span>
                        <span className="text-white/70 text-[8px] mt-1 leading-tight line-clamp-1">
                          {dayData.recommendedBook.author}
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-[var(--primary)] mb-1 uppercase tracking-wide">
                    {language === "ko" ? "오늘의 추천 도서" : "Recommended Book"}
                  </h3>
                  <p className="font-bold text-lg mb-1">{dayData.recommendedBook.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] mb-3">{dayData.recommendedBook.author}</p>
                  <p className="text-[var(--text-primary)] italic border-l-2 border-[var(--primary)] pl-3">
                    "{dayData.recommendedBook.reason}"
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Resources Section */}
          {dayData.resources?.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold">{dict.day.resources}</h2>
                <span className="text-sm text-[var(--text-tertiary)]">
                  ({clickedResources.size}/{dayData.resources.length} {dict.day.completedStatus})
                </span>
              </div>
              <div className="space-y-2">
                {dayData.resources.map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleResourceClick(idx)}
                    className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${clickedResources.has(idx)
                      ? "bg-[var(--success-bg)] border border-[var(--success)]/20"
                      : "surface-raised hover:border-[var(--border-hover)]"
                      }`}
                  >
                    <span className={`text-sm font-medium px-2 py-1 rounded ${clickedResources.has(idx) ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                      }`}>
                      {clickedResources.has(idx) ? dict.day.completedStatus : (resourceIcons[resource.type] || "Link")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${clickedResources.has(idx) ? "text-[var(--success)]" : ""}`}>
                          {resource.title}
                        </p>
                        {resource.duration && (
                          <span className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                            {resource.duration}
                          </span>
                        )}
                      </div>
                      {resource.description && (
                        <p className="text-sm text-[var(--text-tertiary)] truncate">
                          {resource.description}
                        </p>
                      )}
                    </div>
                    <svg className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Steps Section */}
          <div className="mb-8">
            <h2 className="font-semibold mb-4">{dict.day.steps}</h2>
            <div className="space-y-3">
              {dayData.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-secondary)]"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-[var(--text-primary)]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quiz Section */}
          {!showResult && !isReviewMode ? (
            <form onSubmit={handleSubmitQuiz}>
              <h2 className="font-semibold mb-4">{dict.day.quiz} ({dayData.quiz.length})</h2>

              <div className="space-y-6">
                {dayData.quiz.map((question, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-lg bg-[var(--bg-secondary)] border-l-4 border-[var(--primary)]"
                  >
                    <p className="font-medium mb-4">
                      Q{idx + 1}: {question.q}
                    </p>

                    {question.type === "mcq" && question.choices ? (
                      <div className="space-y-2">
                        {question.choices.map((choice, cidx) => (
                          <label
                            key={cidx}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${userAnswers[idx] === choice
                              ? "border-[var(--primary)] bg-[var(--primary-subtle)]"
                              : "border-transparent bg-[var(--surface)] hover:border-[var(--border)]"
                              }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${userAnswers[idx] === choice
                              ? "border-[var(--primary)] bg-[var(--primary)]"
                              : "border-[var(--border)]"
                              }`}>
                              {userAnswers[idx] === choice && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                            <input
                              type="radio"
                              name={`q${idx}`}
                              value={choice}
                              checked={userAnswers[idx] === choice}
                              onChange={(e) => {
                                const newAnswers = [...userAnswers];
                                newAnswers[idx] = e.target.value;
                                setUserAnswers(newAnswers);
                              }}
                              className="sr-only"
                            />
                            <span>{choice}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={userAnswers[idx]}
                          onChange={(e) => {
                            const newAnswers = [...userAnswers];
                            newAnswers[idx] = e.target.value;
                            setUserAnswers(newAnswers);
                          }}
                          placeholder="Enter your answer"
                        />
                        <p className="text-xs text-[var(--text-tertiary)] mt-2">
                          1-3 words
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-4 rounded-lg bg-[var(--error-bg)] border border-[var(--error)]/20 text-[var(--error)] animate-fade-in">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingQuiz || clickedResources.size < dayData.resources.length}
                className="btn btn-primary btn-lg w-full mt-6"
              >
                {submittingQuiz ? (
                  <>
                    <span className="spinner" />
                    {dict.day.grading}
                  </>
                ) : clickedResources.size < dayData.resources.length ? (
                  dict.day.completeResources
                ) : (
                  dict.day.submit
                )}
              </button>
            </form>
          ) : (
            /* Results Section */
            <div className="space-y-6">
              {/* Score Card */}
              <div className="surface-raised rounded-xl p-6 text-center">
                <h3 className="font-medium mb-4">
                  {isReviewMode ? dict.day.reviewNotice : dict.day.result}
                </h3>
                <div className={`text-5xl font-bold mb-2 ${(currentResult || savedResult)!.score === 3
                  ? "text-[var(--success)]"
                  : (currentResult || savedResult)!.score >= 2
                    ? "text-[var(--warning)]"
                    : "text-[var(--error)]"
                  }`}>
                  {(currentResult || savedResult)!.score}/3
                </div>
                <p className="text-[var(--text-secondary)]">{(currentResult || savedResult)!.feedback}</p>

                {!(currentResult || savedResult)!.passed && (
                  <div className="mt-4 p-4 rounded-lg bg-[var(--error-bg)] text-[var(--error)]">
                    <p className="font-medium">Mission Not Complete</p>
                    <p className="text-sm mt-1">You need a perfect score (3/3) to proceed.</p>
                  </div>
                )}
              </div>

              {/* Answer Review */}
              <div>
                <h3 className="font-medium mb-4">Answer Review</h3>
                <div className="space-y-3">
                  {dayData.quiz.map((question, idx) => {
                    const displayAnswers = (currentResult || savedResult)!.userAnswers;
                    const isCorrect = isAnswerCorrect(question, displayAnswers[idx]);
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${isCorrect
                          ? "border-[var(--success)]/30 bg-[var(--success-bg)]"
                          : "border-[var(--error)]/30 bg-[var(--error-bg)]"
                          }`}
                      >
                        <p className="font-medium mb-2">Q{idx + 1}: {question.q}</p>
                        <p className="text-sm">
                          <span className="font-medium">Your answer: </span>
                          <span className={isCorrect ? "text-[var(--success)]" : "text-[var(--error)]"}>
                            {displayAnswers[idx] || "(no answer)"} {isCorrect ? " (correct)" : " (incorrect)"}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-sm mt-1">
                            <span className="font-medium">Correct: </span>
                            <span className="text-[var(--success)]">{getDisplayAnswer(question)}</span>
                          </p>
                        )}
                        {question.explanation && (
                          <p className="text-sm mt-2 text-[var(--text-tertiary)] italic">
                            {question.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/plan?id=${planId}`)}
                  className="btn btn-primary flex-1"
                >
                  {dict.day.backToPlan}
                </button>
                {savedResult && mode !== "doagain" && (
                  <button
                    onClick={() => {
                      setUserAnswers(["", "", ""]);
                      setCurrentResult(null);
                      router.push(`/day/${dayNumber}?planId=${planId}&mode=doagain`);
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    {dict.day.tryAgain}
                  </button>
                )}
              </div>

              {/* Next Day Button */}
              {(currentResult || savedResult)?.passed && dayNumber < totalDays && (
                <div className="text-center pt-4">
                  <p className="text-[var(--text-secondary)] mb-3">
                    Great job! You've completed Day {dayNumber}!
                  </p>
                  <button
                    onClick={() => navigateToDay(dayNumber + 1)}
                    className="btn btn-primary btn-lg"
                  >
                    {dict.day.nextDay}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Persistent Feedback Section */}
          <div className="mt-12 pt-8 border-t border-[var(--border)]">
            <h3 className="text-lg font-semibold mb-4">Rate this Day</h3>
            <FeedbackForm dayPlanId={dayData.id || ""} userId={(session?.user as any)?.id} />
          </div>
        </div>
      </div>
    </main >
  );
}

// ... FeedbackForm (unchanged or localized if needed, but skipping for now to save complexity)

function FeedbackForm({ dayPlanId, userId }: { dayPlanId: string; userId: string }) {
  const [ratings, setRatings] = useState({ content: 0, difficulty: 0, resource: 0 });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratings.content) return;

    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          dayPlanId,
          contentRating: ratings.content,
          difficultyRating: ratings.difficulty,
          resourceRating: ratings.resource,
          textFeedback: text
        })
      });
      setSubmitted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[var(--success-bg)] p-4 rounded-lg text-[var(--success)] text-center">
        Thank you for your feedback! We will use this to improve your future lessons.
      </div>
    );
  }

  const StarRating = ({ label, value, onChange }: any) => (
    <div className="flex items-center justify-between max-w-xs mb-2">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-xl ${star <= value ? "text-yellow-400" : "text-gray-300 hover:text-yellow-200"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--bg-secondary)] p-6 rounded-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <StarRating
            label="Quality"
            value={ratings.content}
            onChange={(v: number) => setRatings({ ...ratings, content: v })}
          />
          <StarRating
            label="Difficulty"
            value={ratings.difficulty}
            onChange={(v: number) => setRatings({ ...ratings, difficulty: v })}
          />
          <StarRating
            label="Resources"
            value={ratings.resource}
            onChange={(v: number) => setRatings({ ...ratings, resource: v })}
          />
        </div>
        <textarea
          placeholder="What was good? What was bad?"
          className="w-full p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] resize-none h-full"
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </div>
      <div className="text-right">
        <button
          type="submit"
          disabled={submitting || !ratings.content}
          className="btn btn-secondary text-sm"
        >
          {submitting ? "Sending..." : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}
