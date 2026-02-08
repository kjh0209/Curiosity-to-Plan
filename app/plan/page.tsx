"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getDictionary, Language } from "@/lib/i18n";

interface DayPlan {
  id: string;
  dayNumber: number;
  missionTitle: string;
  difficulty: number;
  status: string;
  result?: string;
  resources?: string;
}

interface Plan {
  id: string;
  planTitle: string;
  totalDays: number;
  minutesPerDay: number;
  language?: string; // Original language of the plan
  days: DayPlan[];
  recommendedBook?: string; // JSON
}

interface FollowUpRecommendation {
  interest: string;
  goal: string;
  minutesPerDay: number;
  totalDays: number;
  description: string;
  rationale: string;
}

const difficultyLabels: Record<string, string[]> = {
  en: ["Easy", "Medium", "Hard"],
  ko: ["쉬움", "보통", "어려움"],
  ja: ["簡単", "普通", "難しい"],
  zh: ["简单", "中等", "困难"],
  es: ["Fácil", "Medio", "Difícil"],
  fr: ["Facile", "Moyen", "Difficile"],
  de: ["Leicht", "Mittel", "Schwer"],
};

function PlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const planId = searchParams.get("id");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Localization
  const [language, setLanguage] = useState<Language>("ko");
  const dict = getDictionary(language);

  // Translation state for plan/day titles
  const [translatedTitle, setTranslatedTitle] = useState<string>("");
  const [translatedMissions, setTranslatedMissions] = useState<Record<number, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const userId = (session?.user as any)?.id || "";

  // Follow-up Plans State
  const [followUpPlans, setFollowUpPlans] = useState<FollowUpRecommendation[]>([]);
  const [loadingFollowUp, setLoadingFollowUp] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Record<number, string>>({});

  // Direct translation function
  const translateContent = useCallback(async (
    planData: Plan,
    fromLang: string,
    toLang: string,
    uid: string
  ) => {
    console.log('[Translation] Starting:', { from: fromLang, to: toLang, title: planData.planTitle });

    // Skip if languages match
    if (fromLang === toLang) {
      console.log('[Translation] Languages match, skipping');
      setTranslatedTitle(planData.planTitle);
      const missions: Record<number, string> = {};
      planData.days.forEach(d => { missions[d.dayNumber] = d.missionTitle; });
      setTranslatedMissions(missions);
      return;
    }

    if (!toLang || !uid) {
      console.log('[Translation] Missing toLang or uid, using original');
      setTranslatedTitle(planData.planTitle);
      const missions: Record<number, string> = {};
      planData.days.forEach(d => { missions[d.dayNumber] = d.missionTitle; });
      setTranslatedMissions(missions);
      return;
    }

    setIsTranslating(true);
    try {
      // Translate plan title
      const titleRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, text: planData.planTitle, fromLang, toLang }),
      });

      if (titleRes.ok) {
        const titleData = await titleRes.json();
        console.log('[Translation] Title:', titleData.translated);
        setTranslatedTitle(titleData.translated || planData.planTitle);
      } else {
        setTranslatedTitle(planData.planTitle);
      }

      // Translate day missions
      const missionTitles = planData.days.map(d => d.missionTitle);
      const missionsRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, texts: missionTitles, fromLang, toLang }),
      });

      if (missionsRes.ok) {
        const missionsData = await missionsRes.json();
        console.log('[Translation] Missions:', missionsData.translated?.length, 'items');
        const missions: Record<number, string> = {};
        planData.days.forEach((d, i) => {
          missions[d.dayNumber] = missionsData.translated?.[i] || d.missionTitle;
        });
        setTranslatedMissions(missions);
      } else {
        const missions: Record<number, string> = {};
        planData.days.forEach(d => { missions[d.dayNumber] = d.missionTitle; });
        setTranslatedMissions(missions);
      }
    } catch (err) {
      console.error('[Translation] Error:', err);
      setTranslatedTitle(planData.planTitle);
      const missions: Record<number, string> = {};
      planData.days.forEach(d => { missions[d.dayNumber] = d.missionTitle; });
      setTranslatedMissions(missions);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  // Fetch user language - with visibility change listener for navigation back
  useEffect(() => {
    const fetchLanguage = async () => {
      if (status !== "authenticated" || !session?.user) return;
      const uid = (session.user as any).id;
      try {
        const res = await fetch(`/api/profile?userId=${uid}&t=${Date.now()}`);
        const data = await res.json();
        if (data.profile?.language) {
          const newLang = data.profile.language as Language;
          console.log('[Language] Fetched:', newLang, 'Current:', language);
          if (newLang !== language) {
            setLanguage(newLang);
          }
        }
      } catch (err) {
        console.error("Failed to load user language", err);
      }
    };

    fetchLanguage();

    // Re-fetch when page becomes visible (user returned from profile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Language] Page visible, refreshing...');
        fetchLanguage();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, session, language]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "loading" || !session) return;

    const loadPlan = async () => {
      try {
        const userId = (session.user as any).id;

        if (!userId) {
          router.push("/auth/login");
          return;
        }

        if (!planId) {
          router.push("/plans");
          return;
        }

        const response = await fetch(`/api/plans/${planId}?userId=${userId}&t=${Date.now()}`);
        if (!response.ok) {
          throw new Error("Failed to load plan");
        }

        const data = await response.json();
        setPlan(data.plan);

        const userResponse = await fetch(`/api/user?userId=${userId}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setStreak(userData.user?.streak || 0);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [router, session, status, planId]);

  // Translate plan title and day missions to user's preferred language
  useEffect(() => {
    console.log('[Translation Effect] Plan:', plan?.planTitle, 'UserLang:', language);

    if (!plan || !userId || !language) return;

    translateContent(plan, plan.language || "en", language, userId);
  }, [plan, language, userId, translateContent]);

  // Fetch follow-up recommendations when plan is completed
  useEffect(() => {
    if (plan && plan.days.length > 0 && userId) {
      const allDone = plan.days.every(d => d.status === "DONE");
      if (allDone && followUpPlans.length === 0 && !loadingFollowUp) {
        setLoadingFollowUp(true);
        fetch('/api/plan/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, completedPlanId: plan.id })
        })
          .then(res => res.json())
          .then(data => {
            if (data.recommendations) setFollowUpPlans(data.recommendations);
            setLoadingFollowUp(false);
          })
          .catch(err => {
            console.error("Failed to fetch recommendations:", err);
            setLoadingFollowUp(false);
          });
      }
    }
  }, [plan, userId]);

  const createFollowUpPlan = async (rec: FollowUpRecommendation, level: string) => {
    if (creatingPlan) return;
    setCreatingPlan(true);
    try {
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          interest: rec.interest,
          goal: rec.goal,
          minutesPerDay: rec.minutesPerDay,
          totalDays: rec.totalDays,
          baselineLevel: level,
          language: language,
          // Inherit style from current user profile/plan? 
          // Plan generation API updates user profile so checking defaults there is enough.
        })
      });
      const data = await res.json();
      if (data.plan) {
        router.push(`/plan?id=${data.plan.id}`);
      } else {
        console.error("Failed to create plan", data.error);
        setCreatingPlan(false);
      }
    } catch (e) {
      console.error("Error creating follow-up plan:", e);
      setCreatingPlan(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-[var(--text-secondary)]">{dict.common.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="card p-8 max-w-md text-center animate-fade-in">
          <h1 className="text-xl font-semibold mb-2">Plan Not Found</h1>
          <p className="text-[var(--error)] mb-6">{error || "Plan not found"}</p>
          <button
            onClick={() => router.push("/plans")}
            className="btn btn-primary"
          >
            View All Plans
          </button>
        </div>
      </div>
    );
  }

  const completedDays = plan.days.filter(d => d.status === "DONE").length;
  const progress = (completedDays / plan.totalDays) * 100;

  return (
    <div className="container-wide py-6 md:py-8">
      {/* Plan Header */}
      <div className="card p-6 md:p-8 mb-8 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          {/* Left: Title & Info */}
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-semibold mb-4">
              {translatedTitle || plan.planTitle}
              {isTranslating && <span className="ml-2 text-xs text-gray-400">...</span>}
            </h1>

            <div className="flex flex-wrap gap-2">
              <span className="badge">{plan.totalDays} Days</span>
              <span className="badge">{plan.minutesPerDay} min/day</span>
              <span className="badge badge-success">{completedDays} Completed</span>
            </div>
          </div>

          {/* Right: Streak */}
          {streak > 0 && (
            <div className="surface-raised rounded-xl p-5 flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)] mb-1">
                  Current Streak
                </p>
                <span className="text-4xl font-bold text-[var(--text-primary)]">
                  {streak}
                </span>
              </div>
              <div className="text-3xl">
                <svg className="w-10 h-10 text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 23C6.477 23 2 18.523 2 13c0-3.906 2.377-7.262 5.75-8.695C7.25 3.553 7 2.798 7 2c0-.552.448-1 1-1 .213 0 .41.066.573.18C9.934 1.064 10.94 1 12 1c1.06 0 2.066.064 3.427.18.163-.114.36-.18.573-.18.552 0 1 .448 1 1 0 .798-.25 1.553-.75 2.305C19.623 5.738 22 9.094 22 13c0 5.523-4.477 10-10 10zm0-2c4.418 0 8-3.582 8-8 0-3.192-1.874-5.95-4.578-7.227.269.665.078 1.441-.478 1.93-.556.49-1.372.554-1.994.158-.622-.396-.894-1.127-.662-1.786.232-.66.85-1.075 1.512-1.075.182 0 .361.032.528.094C14.285 5.032 13.157 5 12 5c-1.157 0-2.285.032-3.328.094.167-.062.346-.094.528-.094.662 0 1.28.415 1.512 1.075.232.659-.04 1.39-.662 1.786-.622.396-1.438.332-1.994-.158-.556-.489-.747-1.265-.478-1.93C4.874 7.05 3 9.808 3 13c0 4.418 3.582 8 8 8z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--text-secondary)]">
              Progress: {completedDays} / {plan.totalDays} completed
            </span>
            <span className="font-semibold text-[var(--primary)]">{Math.round(progress)}%</span>
          </div>
          <div className="progress-track h-2">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Day Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {plan.days.map((day) => {
          const isDone = day.status === "DONE";
          const isReady = day.status === "READY";
          const isLocked = day.status === "LOCKED";
          const diffIndex = day.difficulty - 1;
          const diffLabel = (difficultyLabels[language] || difficultyLabels["en"])[diffIndex] || "Medium";

          let score = null;
          if (isDone && day.result) {
            try {
              const res = JSON.parse(day.result);
              score = res.score;
            } catch (e) { }
          }

          return (
            <div
              key={day.id}
              className={`card card-hover p-5 ${isDone
                ? "border-[var(--success)]/30"
                : isReady
                  ? "border-[var(--primary)]/30"
                  : "opacity-60"
                }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-3">
                <span
                  className={`badge ${isDone
                    ? "badge-success"
                    : isReady
                      ? "badge-primary"
                      : ""
                    }`}
                >
                  Day {day.dayNumber}
                </span>

                <span
                  className={`badge ${day.difficulty === 3
                    ? "difficulty-hard"
                    : day.difficulty === 2
                      ? "difficulty-medium"
                      : "difficulty-easy"
                    }`}
                >
                  {diffLabel}
                </span>
              </div>

              {/* Title */}
              <h3
                className={`font-medium mb-4 line-clamp-2 leading-snug text-sm ${isLocked ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
                  }`}
              >
                {translatedMissions[day.dayNumber] || day.missionTitle}
              </h3>

              {/* Footer */}
              <div className="mt-auto pt-4 border-t border-[var(--border)] flex justify-between items-center">
                <span
                  className={`text-xs font-medium flex items-center gap-1 ${isDone
                    ? "text-[var(--success)]"
                    : isReady
                      ? "text-[var(--primary)]"
                      : "text-[var(--text-tertiary)]"
                    }`}
                >
                  {isDone ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {score !== null && <span>{score}/3</span>}
                    </>
                  ) : isLocked ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Locked
                    </>
                  ) : (
                    "Ready"
                  )}
                </span>

                {isReady && (
                  <Link href={`/day/${day.dayNumber}?planId=${plan.id}`}>
                    <button className="btn btn-primary text-xs py-1.5 px-3">
                      Start
                    </button>
                  </Link>
                )}

                {isDone && (
                  <Link href={`/day/${day.dayNumber}?planId=${plan.id}&mode=review`}>
                    <button className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
                      {dict.day.review}
                    </button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Follow-up Recommendations (Only when plan is completed) */}
      {plan && plan.days.length > 0 && plan.days.every(d => d.status === "DONE") && (
        <div className="mt-12 animate-fade-in border-t border-[var(--border)] pt-12">
          <div className="text-center mb-8">
            <span className="text-4xl mb-4 block">🎉</span>
            <h2 className="text-2xl font-bold mb-2">
              {language === "ko" ? "플랜 완주를 축하합니다!" : "Plan Completed!"}
            </h2>
            <p className="text-[var(--text-secondary)]">
              {language === "ko" ? "학습 열기를 이어갈 다음 목표를 선택해보세요." : "Establish your habit with these recommended next steps."}
            </p>
          </div>

          {loadingFollowUp ? (
            <div className="flex justify-center p-12">
              <div className="flex flex-col items-center gap-3">
                <div className="spinner" style={{ width: 30, height: 30, borderWidth: 3 }} />
                <p className="text-sm text-[var(--text-tertiary)]">
                  {language === "ko" ? "AI가 맞춤형 후속 커리큘럼을 분석 중입니다..." : "AI is analyzing your next steps..."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {followUpPlans.map((rec, idx) => (
                <div key={idx} className="card p-6 flex flex-col border border-[var(--primary)]/30 hover:border-[var(--primary)] transition-colors relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="mb-5">
                    <span className="text-[10px] font-bold text-[var(--primary)] tracking-widest uppercase mb-2 block bg-[var(--primary)]/5 w-fit px-2 py-1 rounded">
                      {idx === 0 ? (language === "ko" ? "심화 과정" : "DEEP DIVE") : idx === 1 ? (language === "ko" ? "기술 확장" : "EXPAND SKILL") : (language === "ko" ? "실전 응용" : "PROJECT")}
                    </span>
                    <h3 className="text-lg font-bold mb-2 line-clamp-2 min-h-[3.5rem]">{rec.interest}</h3>
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4 min-h-[3.75rem]">
                      {rec.description}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm text-[var(--text-tertiary)] mb-6 bg-[var(--bg-secondary)] p-3 rounded-lg">
                    <div className="flex justify-between">
                      <span>Goal</span>
                      <span className="font-medium text-[var(--text-primary)] truncate max-w-[60%] text-right">{rec.goal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration</span>
                      <span className="font-medium text-[var(--text-primary)]">{rec.totalDays} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily</span>
                      <span className="font-medium text-[var(--text-primary)]">{rec.minutesPerDay} min</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                      <span>{language === "ko" ? "숙련도" : "Level"}</span>
                      <div className="flex gap-1">
                        {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setSelectedLevels(prev => ({ ...prev, [idx]: level }))}
                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                              (selectedLevels[idx] || "BEGINNER") === level
                                ? "bg-[var(--primary)] text-white shadow-sm"
                                : "bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                            }`}
                          >
                            {level === "BEGINNER" ? (language === "ko" ? "입문" : "Beginner") :
                              level === "INTERMEDIATE" ? (language === "ko" ? "중급" : "Intermediate") :
                                (language === "ko" ? "고급" : "Advanced")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => createFollowUpPlan(rec, selectedLevels[idx] || "BEGINNER")}
                    disabled={creatingPlan}
                    className="btn btn-primary w-full mt-auto flex items-center justify-center gap-2"
                  >
                    {creatingPlan ? <span className="spinner w-4 h-4" /> : (language === "ko" ? "이 커리큘럼 시작하기" : "Start Curriculum")}
                    {!creatingPlan && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex flex-wrap gap-3 mt-8 justify-center">
        <Link href="/plans">
          <button className="btn btn-secondary text-sm">
            {dict.dashboard.allPlans}
          </button>
        </Link>
        <Link href="/">
          <button className="btn btn-secondary text-sm">
            {dict.dashboard.newPlan}
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const [isDark, setIsDark] = useState(false);
  const { data: session, status } = useSession();
  const [language, setLanguage] = useState<Language>("ko");
  const dict = getDictionary(language);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const darkMode = document.documentElement.classList.contains('dark');
      setIsDark(darkMode);
    }
  }, []);

  // Fetch user language
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const uid = (session.user as any).id;
      fetch(`/api/profile?userId=${uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.profile?.language) {
            setLanguage(data.profile.language as Language);
          }
        })
        .catch(err => console.error("Failed to load user language", err));
    }
  }, [status, session]);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <main className="page-bg-gradient">
      <div className="container-wide py-6 md:py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Logo size="md" />

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="btn btn-ghost p-2"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <span className="text-sm hidden md:block text-[var(--text-secondary)]">
              {session?.user?.name || session?.user?.email}
            </span>
            <Link href="/profile" className="btn btn-ghost p-2" title="Profile">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <button onClick={() => signOut()} className="btn btn-danger text-sm">
              {dict.common.signOut}
            </button>
          </div>
        </header>

        <Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="text-center animate-fade-in">
              <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
              <p className="text-[var(--text-secondary)]">{dict.common.loading}</p>
            </div>
          </div>
        }>
          <PlanContent />
        </Suspense>
      </div>
    </main>
  );
}

