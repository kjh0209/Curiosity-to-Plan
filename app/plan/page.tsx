"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
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
      <div className="flex-1 flex items-center justify-center p-8">
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
    <div className="container-default pt-24 pb-12 max-w-5xl">
      {/* Plan Header */}
      <div className="glass-card p-8 mb-12 animate-fade-in relative overflow-hidden border-slate-700/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row justify-between gap-8 relative z-10">
          {/* Left: Title & Info */}
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold uppercase tracking-wider border border-sky-500/20">
                Active Plan
              </span>
              {isTranslating && <span className="text-xs text-slate-500 animate-pulse">Translating...</span>}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-slate-100 leading-tight">
              {translatedTitle || plan.planTitle}
            </h1>

            <div className="flex flex-wrap gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {plan.totalDays} Days
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-sm text-slate-300">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {plan.minutesPerDay} min/day
              </div>
            </div>

            {/* Progress Bar */}
            <div className="max-w-md">
              <div className="flex justify-between text-xs font-semibold uppercase tracking-wider mb-2">
                <span className="text-sky-400">Progress</span>
                <span className="text-slate-400">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                {completedDays} of {plan.totalDays} days completed
              </p>
            </div>
          </div>

          {/* Right: Streak - Premium Flame Design */}
          {streak > 0 && (
            <div className="relative group">
              {/* Outer glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-red-500/20 blur-xl rounded-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>

              <div className="relative bg-gradient-to-br from-orange-950/60 to-red-950/60 backdrop-blur-md rounded-2xl p-6 border border-orange-500/20 min-w-[140px]">
                {/* Flame Icon */}
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <svg className="w-12 h-12 text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 23C16.1421 23 19.5 19.6421 19.5 15.5C19.5 14.1695 19.1389 12.9233 18.5046 11.8507L12 2L5.49541 11.8507C4.86113 12.9233 4.5 14.1695 4.5 15.5C4.5 19.6421 7.85786 23 12 23Z" />
                      <path d="M12 23C14.4853 23 16.5 20.9853 16.5 18.5C16.5 17.6347 16.2487 16.8286 15.8191 16.1451L12 10L8.18094 16.1451C7.75126 16.8286 7.5 17.6347 7.5 18.5C7.5 20.9853 9.51472 23 12 23Z" fill="#FDE047" />
                    </svg>
                    {/* Animated pulse ring */}
                    <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping opacity-75"></div>
                  </div>

                  {/* Streak Number */}
                  <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-orange-400 via-amber-400 to-red-500 tabular-nums leading-none">
                    {streak}
                  </span>
                  <span className="text-xs font-bold text-orange-400/90 uppercase tracking-widest mt-1">
                    Day Streak
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline / Days Grid */}
      <div className="relative">
        {/* Timeline Line (Desktop) */}
        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-sky-500/50 via-slate-700/30 to-transparent -ml-px"></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {plan.days.map((day, index) => {
            const isEven = index % 2 === 0;
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
                className={`relative ${isEven ? 'lg:text-right lg:pr-8' : 'lg:text-left lg:pl-8 lg:col-start-2'}`}
                style={{ marginTop: index === 0 ? '0' : index === 1 ? '4rem' : '0' }}
              >
                {/* Timeline Dot */}
                <div className={`hidden lg:flex absolute top-6 ${isEven ? '-right-[33px]' : '-left-[33px]'} w-16 h-16 items-center justify-center z-10`}>
                  <div className={`w-4 h-4 rounded-full border-2 ${isDone ? 'bg-green-500 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' :
                    isReady ? 'bg-sky-500 border-sky-500 animate-pulse shadow-[0_0_15px_rgba(14,165,233,0.5)]' :
                      'bg-slate-900 border-slate-700'
                    }`}></div>
                </div>

                <div
                  className={`glass-card p-6 rounded-2xl transition-all duration-300 relative group
                          ${isDone ? 'border-green-500/20 bg-green-900/5 hover:border-green-500/40' :
                      isReady ? 'border-sky-500/30 bg-sky-900/5 hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/10 hover:-translate-y-1 cursor-pointer' :
                        'border-slate-800 bg-slate-900/40 opacity-70 grayscale hover:opacity-100 hover:grayscale-0'
                    }
                       `}
                >
                  {/* Header */}
                  <div className={`flex items-center gap-3 mb-3 ${isEven ? 'lg:flex-row-reverse' : ''}`}>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${isDone ? 'bg-green-500/20 text-green-400' :
                      isReady ? 'bg-sky-500/20 text-sky-400' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                      Day {day.dayNumber}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${day.difficulty === 3 ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                      day.difficulty === 2 ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' :
                        'border-green-500/30 text-green-400 bg-green-500/5'
                      }`}>
                      {diffLabel}
                    </span>
                  </div>

                  <h3 className={`text-lg font-bold mb-4 line-clamp-2 ${isLocked ? 'text-slate-500' : 'text-slate-100'}`}>
                    {translatedMissions[day.dayNumber] || day.missionTitle}
                  </h3>

                  {/* Action Area */}
                  <div className={`flex items-center gap-3 pt-4 border-t border-white/5 ${isEven ? 'lg:flex-row-reverse' : ''}`}>
                    {isDone ? (
                      <>
                        <div className="flex items-center gap-1.5 text-green-400 font-medium text-sm">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Completed
                        </div>
                        {score !== null && (
                          <span className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-slate-300">
                            Score: {score}/3
                          </span>
                        )}
                        <Link href={`/day/${day.dayNumber}?planId=${plan.id}&mode=review`} className="ml-auto">
                          <button className="text-xs text-slate-400 hover:text-white transition-colors">
                            {dict.day.review}
                          </button>
                        </Link>
                      </>
                    ) : isReady ? (
                      <Link href={`/day/${day.dayNumber}?planId=${plan.id}`} className="w-full">
                        <button className="btn btn-primary w-full py-2.5 text-sm shadow-lg shadow-sky-500/20 relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                          Start Mission
                          <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:animate-shimmer"></div>
                        </button>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Locked
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-up Recommendations */}
      {plan && plan.days.length > 0 && plan.days.every(d => d.status === "DONE") && (
        <div className="mt-20 animate-slide-up">
          <div className="text-center mb-12 relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/20 blur-[100px] rounded-full pointer-events-none"></div>
            <span className="text-6xl mb-4 block animate-bounce">🎉</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
              {language === "ko" ? "플랜 정복 완료!" : "Plan Mastered!"}
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {language === "ko" ? "당신의 끈기가 결실을 맺었습니다. 이제 다음 단계로 나아갈 준비가 되셨나요?" : "Your persistence has paid off. Are you ready to take the next step in your journey?"}
            </p>
          </div>

          {loadingFollowUp ? (
            <div className="flex justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="spinner w-8 h-8 border-4 border-sky-500 border-t-transparent" />
                <p className="text-sm text-sky-400 font-medium animate-pulse">
                  {language === "ko" ? "AI가 맞춤형 후속 커리큘럼을 분석 중입니다..." : "AI is analyzing your next steps..."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {followUpPlans.map((rec, idx) => (
                <div key={idx} className="glass-card p-6 flex flex-col border border-slate-700 hover:border-sky-500/50 transition-all duration-300 relative group hover:shadow-2xl hover:shadow-sky-900/20 hover:-translate-y-2">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="mb-6">
                    <span className="text-[10px] font-bold text-sky-400 tracking-widest uppercase mb-3 block bg-sky-900/20 w-fit px-2 py-1 rounded border border-sky-500/20">
                      {idx === 0 ? (language === "ko" ? "심화 과정" : "DEEP DIVE") : idx === 1 ? (language === "ko" ? "기술 확장" : "EXPAND SKILL") : (language === "ko" ? "실전 응용" : "PROJECT")}
                    </span>
                    <h3 className="text-xl font-bold mb-3 text-slate-100 min-h-[3.5rem] group-hover:text-sky-300 transition-colors">{rec.interest}</h3>
                    <p className="text-sm text-slate-400 line-clamp-3 mb-4 min-h-[3.75rem] leading-relaxed">
                      {rec.description}
                    </p>
                  </div>

                  <div className="space-y-3 text-sm text-slate-400 mb-8 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between">
                      <span>Goal</span>
                      <span className="font-medium text-slate-200 truncate max-w-[60%] text-right">{rec.goal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration</span>
                      <span className="font-medium text-slate-200">{rec.totalDays} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily</span>
                      <span className="font-medium text-slate-200">{rec.minutesPerDay} min</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-700/50 mt-3">
                      <span>{language === "ko" ? "숙련도" : "Level"}</span>
                      <div className="flex gap-1">
                        {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setSelectedLevels(prev => ({ ...prev, [idx]: level }))}
                            className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${(selectedLevels[idx] || "BEGINNER") === level
                              ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                              : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                              }`}
                          >
                            {level === "BEGINNER" ? "BEG" : level === "INTERMEDIATE" ? "INT" : "ADV"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => createFollowUpPlan(rec, selectedLevels[idx] || "BEGINNER")}
                    disabled={creatingPlan}
                    className="btn btn-primary w-full mt-auto flex items-center justify-center gap-2 py-3 shadow-lg shadow-sky-500/20"
                  >
                    {creatingPlan ? <span className="spinner w-4 h-4 border-2" /> : (language === "ko" ? "이 커리큘럼 시작하기" : "Start Curriculum")}
                    {!creatingPlan && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex flex-wrap gap-4 mt-16 justify-center animate-fade-in">
        <Link href="/plans">
          <button className="btn btn-ghost text-slate-400 hover:text-white px-6">
            {dict.dashboard.allPlans}
          </button>
        </Link>
        <Link href="/">
          <button className="btn btn-secondary px-8 border-slate-700 hover:bg-slate-800">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {dict.dashboard.newPlan}
          </button>
        </Link>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <main className="page-bg-gradient min-h-screen flex flex-col">
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-pulse">
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400 font-medium">Loading Journey...</p>
          </div>
        </div>
      }>
        <PlanContent />
      </Suspense>
    </main>
  );
}

