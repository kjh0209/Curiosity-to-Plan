"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getDictionary, Language, getInitialLanguage, saveLanguage } from "@/lib/i18n";

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

const resourceIcons: Record<string, JSX.Element> = {
  youtube: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg>,
  article: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>,
  wikipedia: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2l-2-6h2l1 4 1-4h2l1 4 1-4h2l-2 6z" /></svg>, // Placeholder
  documentation: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  tutorial: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>,
  textbook: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
};

const difficultyConfig = {
  1: { label: "Easy", class: "bg-green-500/10 text-green-400 border-green-500/20" },
  2: { label: "Medium", class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  3: { label: "Hard", class: "bg-red-500/10 text-red-400 border-red-500/20" },
};

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
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const dict = getDictionary(language);

  // Missing State Variables
  const [totalDays, setTotalDays] = useState(0);
  const [allDays, setAllDays] = useState<any[]>([]);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>(["", "", ""]);
  const [currentResult, setCurrentResult] = useState<SavedResult | null>(null);
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
        const userLang = (profileData.profile?.language || "en") as Language;
        saveLanguage(userLang);
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
          const parsed = JSON.parse(cachedData);
          // Ensure dayPlan id is always present (old caches may lack it)
          if (!parsed.id && dayMeta.id) {
            parsed.id = dayMeta.id;
            localStorage.setItem(cacheKey, JSON.stringify(parsed));
          }
          setDayData(parsed);
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

          if (!genRes.ok) {
            const errData = await genRes.json().catch(() => ({}));
            if (errData.limitReached) {
              const limitMsg = errData.tier === "free"
                ? (dict.limits?.dayLimitReachedUpgrade || "You've reached today's learning limit. Upgrade to Pro for more!")
                : (dict.limits?.dayLimitReached || "You've reached today's learning limit. Try again tomorrow.");
              setError(limitMsg);
              setLoading(false);
              return;
            }
            throw new Error(errData.error || "Failed to generate day content");
          }

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
              feedback: dayDBData.quizAttempt.feedback,
              timestamp: new Date().toISOString(),
              difficultySignal: "",
              userAnswers: [],

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


  // Fetch book cover image from multiple sources
  useEffect(() => {
    if (!dayData?.recommendedBook) return;
    setBookCoverUrl(null);

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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to grade quiz");
      }

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
      <main className="page-bg-gradient min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Loading Mission...</p>
        </div>
      </main>
    );
  }

  if (error || !dayData) {
    const isLimitError = error?.includes(dict.limits?.dayLimitReached || "__NO_MATCH__") ||
                         error?.includes(dict.limits?.dayLimitReachedUpgrade || "__NO_MATCH__");
    return (
      <main className="page-bg-gradient min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-10 max-w-lg text-center animate-scale-in">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isLimitError ? "bg-amber-500/10" : "bg-red-500/10"}`}>
            {isLimitError ? (
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">
            {isLimitError ? (dict.limits?.tryTomorrow || "Daily Limit Reached") : dict.common.error}
          </h1>
          <p className="text-slate-400 mb-8">{error}</p>
          {isLimitError && (
            <Link href="/pricing">
              <button className="btn w-full py-3 mb-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20">
                {dict.limits?.upgradeButton || "Upgrade to Pro"}
              </button>
            </Link>
          )}
          <button
            onClick={() => router.push(`/plan?id=${planId}`)}
            className="btn btn-primary w-full"
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
    <main className="page-bg-gradient min-h-screen pb-20">
      <div className="container-default pt-24 max-w-4xl">
        {/* Navigation Header */}
        <header className="flex items-center justify-between mb-8 animate-fade-in">
          <Link href={`/plan?id=${planId}`}>
            <button className="flex items-center text-slate-400 hover:text-white transition-colors group">
              <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center mr-3 group-hover:bg-sky-500/20 group-hover:text-sky-400 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              <span className="font-medium">{dict.day.backToPlan}</span>
            </button>
          </Link>

          <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
            <span className="font-bold text-xl tracking-tight">Skill<span className="text-sky-400">Loop</span></span>
          </Link>
        </header>

        {/* Day Navigation */}
        <div className="glass-card p-4 mb-8 flex items-center justify-between animate-fade-in relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 via-transparent to-sky-500/5 opacity-50"></div>
          <button
            onClick={() => navigateToDay(dayNumber - 1)}
            disabled={dayNumber <= 1}
            className="btn btn-ghost text-sm disabled:opacity-30 hover:bg-slate-800/50 relative z-10"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {dict.day.prevDay}
          </button>

          <div className="text-center relative z-10">
            <span className="block text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">Current Mission</span>
            <span className="font-bold text-lg text-white">
              Day {dayNumber} <span className="text-slate-600 mx-2">/</span> <span className="text-slate-400">{totalDays}</span>
            </span>
          </div>

          <button
            onClick={() => navigateToDay(dayNumber + 1)}
            disabled={(() => {
              if (dayNumber >= totalDays) return true;
              const nextDay = allDays.find(d => d.dayNumber === dayNumber + 1);
              return !nextDay || nextDay.status === "LOCKED";
            })()}
            className="btn btn-ghost text-sm disabled:opacity-30 hover:bg-slate-800/50 relative z-10"
          >
            {dict.day.nextDay}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Review Mode Indicator */}
        {isReviewMode && (
          <div className="mb-6 animate-fade-in flex justify-center">
            <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 py-2 px-4 rounded-full text-sm font-semibold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {dict.day.reviewNotice}
            </span>
          </div>
        )}

        {/* Main Content Card */}
        <div className="glass-card p-8 md:p-10 mb-8 animate-slide-up border-slate-700 shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-slate-700/50 pb-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${diffConfig.class}`}>
                  {diffConfig.label}
                </span>
                <span className="text-slate-500 text-xs font-medium bg-slate-800/50 px-2 py-0.5 rounded">{dayData.resources.length} resources</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight">{dayData.missionTitle}</h1>
            </div>
            <div className="flex gap-3">
              <Link href={`/day/${dayNumber}/slide?planId=${planId}`}>
                <button className="btn btn-secondary flex items-center gap-2 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span className="hidden sm:inline">{dict.day.startClass}</span>
                </button>
              </Link>
              <Link href={`/day/${dayNumber}/article?planId=${planId}`}>
                <button className="btn btn-secondary flex items-center gap-2 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span className="hidden sm:inline">{dict.day.readLesson}</span>
                </button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left Column: Recommended Book & Resources */}
            <div className="space-y-8 lg:col-span-1">
              {/* Recommended Book */}
              {dayData.recommendedBook && (
                <div className="relative group perspective-1000">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative glass-card bg-slate-900/90 p-5 rounded-xl border-amber-500/20 overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                      <svg className="w-24 h-24 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>

                    <div className="relative z-10">
                      <h3 className="text-xs font-bold text-amber-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {language === "ko" ? "오늘의 추천 도서" : "Recommended Book"}
                      </h3>

                      <div className="flex gap-4">
                        {bookCoverUrl ? (
                          <img
                            src={bookCoverUrl}
                            alt={dayData.recommendedBook.title}
                            className="w-20 h-28 rounded-lg shadow-lg shadow-black/50 object-cover flex-shrink-0 border border-slate-700"
                            onError={() => { setBookCoverUrl(null); }}
                          />
                        ) : (
                          <div className="w-20 h-28 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-base text-slate-100 leading-snug mb-1 line-clamp-2">{dayData.recommendedBook.title}</p>
                          <p className="text-xs text-slate-400 mb-3">{dayData.recommendedBook.author}</p>
                          <p className="text-xs text-slate-300 italic border-l-2 border-amber-500/50 pl-3 leading-relaxed opacity-80">
                            "{dayData.recommendedBook.reason}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resources Section */}
              {dayData.resources?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-slate-200">{dict.day.resources}</h2>
                    <span className="text-xs font-medium bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">
                      {clickedResources.size}/{dayData.resources.length} completed
                    </span>
                  </div>
                  <div className="space-y-3">
                    {dayData.resources.map((resource, idx) => {
                      const isClicked = clickedResources.has(idx);
                      return (
                        <a
                          key={idx}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleResourceClick(idx)}
                          className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-300 group border ${isClicked
                            ? "bg-green-500/5 border-green-500/20 hover:border-green-500/30"
                            : "bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50 hover:border-sky-500/30"
                            }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isClicked ? "bg-green-500/10 text-green-400" : "bg-slate-700/50 text-slate-400 group-hover:text-sky-400 group-hover:bg-sky-500/10"
                            }`}>
                            {isClicked ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : (resourceIcons[resource.type] || <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`font-medium text-sm truncate ${isClicked ? "text-green-400" : "text-slate-300 group-hover:text-sky-300"}`}>
                                {resource.title}
                              </p>
                            </div>
                            <p className="text-xs text-slate-500 truncate group-hover:text-slate-400 transition-colors">
                              {resource.description || "Click to open resource"}
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Steps & Quiz */}
            <div className="lg:col-span-2 space-y-10">
              {/* Steps Section */}
              <div>
                <h2 className="font-semibold text-xl text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm">01</span>
                  {dict.day.steps}
                </h2>
                <div className="space-y-4">
                  {dayData.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-4 p-5 rounded-2xl bg-slate-800/20 border border-slate-700/50 hover:bg-slate-800/40 transition-colors"
                    >
                      <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border border-slate-600">
                        {idx + 1}
                      </span>
                      <p className="text-slate-300 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quiz Section */}
              <div>
                <h2 className="font-semibold text-xl text-white mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm">02</span>
                  {dict.day.quiz}
                  <span className="text-sm font-normal text-slate-500 bg-slate-800 min-w-[24px] h-6 rounded px-2 flex items-center justify-center">{dayData.quiz.length}</span>
                </h2>

                {!showResult && !isReviewMode ? (
                  <form onSubmit={handleSubmitQuiz} className="space-y-8">
                    <div className="space-y-8">
                      {dayData.quiz.map((question, idx) => (
                        <div
                          key={idx}
                          className="p-6 rounded-2xl bg-slate-900/40 border border-slate-700/50"
                        >
                          <p className="font-medium text-lg text-slate-200 mb-6 flex gap-3">
                            <span className="text-sky-500 font-bold">Q{idx + 1}.</span>
                            {question.q}
                          </p>

                          {question.type === "mcq" && question.choices ? (
                            <div className="space-y-3 pl-4 border-l-2 border-slate-800 ml-2">
                              {question.choices.map((choice, cidx) => (
                                <label
                                  key={cidx}
                                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border ${userAnswers[idx] === choice
                                    ? "border-sky-500/50 bg-sky-500/10 text-white"
                                    : "border-slate-700 bg-slate-800/30 text-slate-400 hover:bg-slate-800 hover:border-slate-600"
                                    }`}
                                >
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${userAnswers[idx] === choice
                                    ? "border-sky-400 bg-sky-500"
                                    : "border-slate-600 group-hover:border-slate-500"
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
                                  <span className="text-sm md:text-base">{choice}</span>
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
                                placeholder="Enter your answer..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors outline-none"
                              />
                              <p className="text-xs text-slate-500 mt-2 ml-1">
                                Try to be concise (1-3 words)
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 animate-fade-in flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={submittingQuiz || clickedResources.size < dayData.resources.length}
                        className={`btn btn-primary w-full py-4 text-base font-bold shadow-lg shadow-sky-900/20 ${submittingQuiz ? 'opacity-80' : ''} ${clickedResources.size < dayData.resources.length ? 'opacity-50 cursor-not-allowed bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-700 shadow-none' : ''}`}
                      >
                        {submittingQuiz ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="spinner w-5 h-5 border-2" />
                            {dict.day.grading}
                          </div>
                        ) : clickedResources.size < dayData.resources.length ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            {dict.day.completeResources}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            {dict.day.submit}
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Results Section */
                  <div className="space-y-8 animate-fade-in">
                    {/* Score Card */}
                    <div className={`rounded-2xl p-8 text-center border-2 ${(currentResult || savedResult)!.score === 3
                      ? "bg-green-500/10 border-green-500/20"
                      : (currentResult || savedResult)!.score >= 2
                        ? "bg-yellow-500/10 border-yellow-500/20"
                        : "bg-red-500/10 border-red-500/20"
                      }`}>
                      <h3 className="font-bold text-lg mb-4 uppercase tracking-wider text-white/80">
                        {isReviewMode ? dict.day.reviewNotice : dict.day.result}
                      </h3>
                      <div className={`text-6xl font-black mb-4 ${(currentResult || savedResult)!.score === 3
                        ? "text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]"
                        : (currentResult || savedResult)!.score >= 2
                          ? "text-yellow-400"
                          : "text-red-400"
                        }`}>
                        {(currentResult || savedResult)!.score}/3
                      </div>
                      <p className="text-slate-300 text-lg font-medium leading-relaxed max-w-xl mx-auto">{(currentResult || savedResult)!.feedback}</p>

                      {!(currentResult || savedResult)!.passed && (
                        <div className="mt-6 p-4 rounded-xl bg-red-500/20 text-red-300 inline-block border border-red-500/20">
                          <p className="font-bold">Mission Not Complete</p>
                          <p className="text-sm mt-1 opacity-80">You need a perfect score (3/3) to proceed.</p>
                        </div>
                      )}
                    </div>

                    {/* Answer Review */}
                    <div className="space-y-6">
                      <h3 className="font-semibold text-xl text-white">Answer Review</h3>
                      <div className="space-y-6">
                        {dayData.quiz.map((question, idx) => {
                          const displayAnswers = (currentResult || savedResult)!.userAnswers;
                          const isCorrect = isAnswerCorrect(question, displayAnswers[idx]);
                          return (
                            <div
                              key={idx}
                              className={`p-6 rounded-2xl border ${isCorrect
                                ? "border-green-500/20 bg-green-500/5"
                                : "border-red-500/20 bg-red-500/5"
                                }`}
                            >
                              <p className="font-medium mb-3 text-slate-200">
                                <span className="text-sm font-bold opacity-50 mr-2">Q{idx + 1}</span>
                                {question.q}
                              </p>
                              <div className="flex flex-col gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 w-24">Your answer:</span>
                                  <span className={`font-medium ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                                    {displayAnswers[idx] || "(no answer)"}
                                  </span>
                                  {isCorrect ? (
                                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  )}
                                </div>

                                {!isCorrect && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 w-24">Correct:</span>
                                    <span className="text-green-400 font-medium">{getDisplayAnswer(question)}</span>
                                  </div>
                                )}
                                {question.explanation && (
                                  <div className="mt-3 p-3 rounded bg-slate-900/50 border border-slate-800 text-slate-400 text-xs italic leading-relaxed">
                                    <span className="font-bold text-slate-500 not-italic mr-2">Explanation:</span>
                                    {question.explanation}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button
                        onClick={() => router.push(`/plan?id=${planId}`)}
                        className="btn btn-secondary flex-1 py-3"
                      >
                        {dict.day.backToPlan}
                      </button>
                      {/* Always show Try Again button when quiz has been completed */}
                      <button
                        onClick={() => {
                          setUserAnswers(["", "", ""]);
                          setCurrentResult(null);
                          setSavedResult(null);
                          // Clear the saved result from localStorage to allow fresh retry
                          localStorage.removeItem(`result_${planId}_${dayNumber}`);
                        }}
                        className="btn btn-secondary flex-1 py-3 bg-slate-800 border-slate-700 hover:bg-slate-700"
                      >
                        {dict.day.tryAgain}
                      </button>
                      {(currentResult || savedResult)?.passed && dayNumber < totalDays && (
                        <button
                          onClick={() => navigateToDay(dayNumber + 1)}
                          className="btn btn-primary flex-1 py-3 shadow-lg shadow-sky-500/20"
                        >
                          {dict.day.nextDay}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Persistent Feedback Section */}
          <div className="mt-16 pt-10 border-t border-slate-800">
            <h3 className="text-lg font-bold mb-6 text-slate-300">Rate this Day</h3>
            <FeedbackForm dayPlanId={dayData.id || ""} userId={(session?.user as any)?.id} />
          </div>
        </div>
      </div>
    </main >
  );
}

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
      <div className="p-6 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-center animate-fade-in">
        <p className="font-bold mb-1">Thank you!</p>
        <p className="text-sm opacity-80">Your feedback helps improve the curriculum.</p>
      </div>
    );
  }

  const StarRating = ({ label, value, onChange }: any) => (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-slate-400 font-medium">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-xl transition-all hover:scale-110 ${star <= value ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]" : "text-slate-700 hover:text-slate-500"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        <div className="space-y-1">
          <StarRating
            label="Lesson Quality"
            value={ratings.content}
            onChange={(v: number) => setRatings({ ...ratings, content: v })}
          />
          <StarRating
            label="Difficulty"
            value={ratings.difficulty}
            onChange={(v: number) => setRatings({ ...ratings, difficulty: v })}
          />
          <StarRating
            label="Usefulness"
            value={ratings.resource}
            onChange={(v: number) => setRatings({ ...ratings, resource: v })}
          />
        </div>
        <div className="relative">
          <textarea
            placeholder="Any suggestions for improvement?"
            className="w-full h-full min-h-[120px] p-4 rounded-xl border border-slate-700 bg-slate-950/50 text-slate-200 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 transition-colors outline-none resize-none text-sm"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>
      </div>
      <div className="text-right">
        <button
          type="submit"
          disabled={submitting || !ratings.content}
          className="btn btn-secondary text-sm px-6 border-slate-600 hover:bg-slate-700 disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}
