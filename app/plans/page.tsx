"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getDictionary, Language, getInitialLanguage, saveLanguage } from "@/lib/i18n";

interface PlanSummary {
  id: string;
  planTitle: string;
  createdAt: string;
  completedDays: number;
  totalDays: number;
  minutesPerDay?: number;
}


export default function PlansPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [translatedTitles, setTranslatedTitles] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Localization
  const dict = getDictionary(language);

  // ... useEffects

  useEffect(() => {
    // ... auth check

    if (status === "loading" || !session) return;

    const loadPlans = async () => {
      try {
        const userId = (session.user as any).id;
        // ... check userId

        const response = await fetch(`/api/plans?userId=${userId}`);
        // ... check response

        const data = await response.json();
        setPlans(data.plans);
        if (data.language) {
          const lang = data.language as Language;
          saveLanguage(lang);
          setLanguage(lang);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, [router, session, status]);

  // Translate plan titles
  useEffect(() => {
    if (plans.length === 0 || !language || !session?.user) return;

    const translatePlanTitles = async () => {
      const titlesToTranslate = plans
        .filter(p => !translatedTitles[p.id]) // Only translate if not already done
        .map(p => p.planTitle);

      if (titlesToTranslate.length === 0) return;

      try {
        const userId = (session.user as any).id;
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            texts: titlesToTranslate,
            toLang: language,
            context: "These are titles of personalized learning plans. Translate them naturally to match the user's language, keeping the core meaning and tone. Examples: 'Python for Beginners' -> '파이썬 입문', 'Advanced Cooking' -> '고급 요리'"
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translated && Array.isArray(data.translated)) {
            const newTranslations: Record<string, string> = {};
            let index = 0;
            plans.forEach(p => {
              if (!translatedTitles[p.id]) {
                newTranslations[p.id] = data.translated[index] || p.planTitle;
                index++;
              }
            });
            setTranslatedTitles(prev => ({ ...prev, ...newTranslations }));
          }
        }
      } catch (err) {
        console.error("Failed to translate plan titles", err);
      }
    };

    translatePlanTitles();
  }, [plans, language, session]);



  const handleDeletePlan = async (planId: string) => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    setDeletingPlanId(planId);
    try {
      const res = await fetch(`/api/plans/${planId}?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlans(prev => prev.filter(p => p.id !== planId));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete plan");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setDeletingPlanId(null);
      setConfirmDeleteId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="page-bg-gradient min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="relative w-16 h-16">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-700/50"></div>
            {/* Spinning Ring */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 border-r-purple-500 animate-spin"></div>
            {/* Inner Pulse */}
            <div className="absolute inset-4 rounded-full bg-slate-800 animate-pulse flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white/50"></div>
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg-gradient min-h-screen">
      <div className="container-default pt-24 pb-12">
        {/* Page Title & Action */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              <span className="text-gradient">My Journey</span>
            </h1>
            <p className="text-slate-400">
              {plans.length} {dict.dashboard.plansCreated}
            </p>
          </div>
          <Link href="/">
            <button className="btn btn-primary shadow-lg shadow-sky-500/20">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {dict.dashboard.createPlan}
            </button>
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-fade-in flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Empty State */}
        {plans.length === 0 ? (
          <div className="glass-card p-12 text-center animate-slide-up max-w-lg mx-auto border-dashed border-2 border-slate-700/50 bg-slate-900/30">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-3 text-slate-200">{dict.dashboard.noPlansYet}</h2>
            <p className="text-slate-400 mb-8 max-w-sm mx-auto">
              {dict.dashboard.startJourney}
            </p>
            <Link href="/">
              <button className="btn btn-primary btn-lg">
                {dict.dashboard.createFirstPlan}
              </button>
            </Link>
          </div>
        ) : (
          /* Plans Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plans.map((plan, index) => {
              const progress = (plan.completedDays / plan.totalDays) * 100;
              const isComplete = plan.completedDays === plan.totalDays;

              return (
                <div
                  key={plan.id}
                  className={`glass-card p-5 h-full relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-900/10 flex flex-col ${isComplete ? "border-green-500/20 bg-green-900/5" : ""
                    }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDeleteId(plan.id);
                    }}
                    className="absolute top-4 right-4 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-red-400 hover:bg-red-500/10 z-10"
                    title={language === "ko" ? "플랜 삭제" : "Delete plan"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <Link href={`/plan?id=${plan.id}`} className="block flex-1 flex flex-col">
                    {/* Header */}
                    <div className="mb-4 pr-8">
                      <h2 className="text-xl font-bold line-clamp-2 text-slate-100 group-hover:text-sky-400 transition-colors">
                        {translatedTitles[plan.id] || plan.planTitle}
                      </h2>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50">
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50">
                        {plan.totalDays} Days
                      </span>
                    </div>

                    <div className="mt-auto">
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs font-semibold uppercase tracking-wider mb-2">
                          <span className={isComplete ? "text-green-400" : "text-sky-400"}>
                            {isComplete ? "Completed" : "In Progress"}
                          </span>
                          <span className="text-slate-400">
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isComplete
                              ? "bg-gradient-to-r from-green-500 to-emerald-400"
                              : "bg-gradient-to-r from-sky-500 to-blue-500"
                              }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Status Text */}
                      <p className="text-xs text-slate-500 font-medium">
                        {isComplete
                          ? dict.dashboard.completed
                          : `${plan.completedDays}/${plan.totalDays} days completed`}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="glass-card p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-100">
                  {language === "ko" ? "플랜 삭제" : "Delete Plan"}
                </h3>
              </div>
              <p className="text-slate-400 mb-2 leading-relaxed">
                {language === "ko"
                  ? "이 플랜과 모든 학습 기록이 영구적으로 삭제됩니다."
                  : "This plan and all learning progress will be permanently deleted."}
              </p>
              <p className="text-sm text-red-400 font-medium mb-8">
                {language === "ko" ? "이 작업은 되돌릴 수 없습니다." : "This action cannot be undone."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={!!deletingPlanId}
                  className="btn btn-secondary flex-1 py-3"
                >
                  {language === "ko" ? "취소" : "Cancel"}
                </button>
                <button
                  onClick={() => handleDeletePlan(confirmDeleteId)}
                  disabled={!!deletingPlanId}
                  className="btn btn-danger flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20"
                >
                  {deletingPlanId === confirmDeleteId
                    ? <span className="spinner w-4 h-4 border-2" />
                    : (language === "ko" ? "삭제" : "Delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
