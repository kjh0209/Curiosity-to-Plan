"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getDictionary, Language } from "@/lib/i18n";

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
  const [language, setLanguage] = useState<Language>("en");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);
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
          setLanguage(data.language as Language);
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

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

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
      <main className="page-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-[var(--text-secondary)]">{dict.common.loading}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg-gradient">
      <div className="container-default py-6 md:py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Logo size="md" />

          <div className="flex items-center gap-3">
            {/* ... Toggle ... */}
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
              Sign out
            </button>
          </div>
        </header>

        {/* Page Title & Action */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-2xl font-semibold mb-1">My Plans</h1>
            <p className="text-[var(--text-secondary)]">
              {plans.length} {dict.dashboard.plansCreated}
            </p>
          </div>
          <Link href="/">
            <button className="btn btn-primary">
              {dict.dashboard.createPlan}
            </button>
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--error-bg)] border border-[var(--error)]/20 text-[var(--error)] animate-fade-in">
            {error}
          </div>
        )}

        {/* Empty State */}
        {plans.length === 0 ? (
          <div className="card p-12 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">{dict.dashboard.noPlansYet}</h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const progress = (plan.completedDays / plan.totalDays) * 100;
              const isComplete = plan.completedDays === plan.totalDays;

              return (
                <div
                  key={plan.id}
                  className={`card card-hover p-6 h-full relative group ${isComplete ? "border-[var(--success)]/30" : ""}`}
                >
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDeleteId(plan.id);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-bg)]"
                    title={language === "ko" ? "플랜 삭제" : "Delete plan"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <Link href={`/plan?id=${plan.id}`} className="block">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <h2 className="text-lg font-medium line-clamp-2 pr-8">
                        {translatedTitles[plan.id] || plan.planTitle}
                      </h2>
                      {isComplete && (
                        <span className="flex-shrink-0 text-[var(--success)]">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="badge">
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </span>
                      <span className="badge">
                        {plan.totalDays} Days
                      </span>
                      {plan.minutesPerDay && (
                        <span className="badge">
                          {plan.minutesPerDay}m/day
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-[var(--text-secondary)]">
                          {plan.completedDays}/{plan.totalDays} {dict.dashboard.completed}
                        </span>
                        <span className={`font-medium ${isComplete ? "text-[var(--success)]" : "text-[var(--primary)]"}`}>
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <div className="progress-track h-1.5">
                        <div
                          className={`progress-fill ${isComplete ? "progress-fill-success" : ""}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <p className={`text-sm ${isComplete ? "text-[var(--success)]" : "text-[var(--text-tertiary)]"}`}>
                      {isComplete
                        ? dict.dashboard.completed
                        : `${plan.totalDays - plan.completedDays} ${dict.dashboard.remaining}`}
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in px-4">
            <div className="bg-[var(--surface)] p-6 rounded-xl shadow-xl max-w-sm w-full border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--error-bg)] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold">
                  {language === "ko" ? "플랜 삭제" : "Delete Plan"}
                </h3>
              </div>
              <p className="text-[var(--text-secondary)] mb-2">
                {language === "ko"
                  ? "이 플랜과 모든 학습 기록이 영구적으로 삭제됩니다."
                  : "This plan and all learning progress will be permanently deleted."}
              </p>
              <p className="text-sm text-[var(--error)] font-medium mb-6">
                {language === "ko" ? "이 작업은 되돌릴 수 없습니다." : "This action cannot be undone."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={!!deletingPlanId}
                  className="btn btn-secondary flex-1"
                >
                  {language === "ko" ? "취소" : "Cancel"}
                </button>
                <button
                  onClick={() => handleDeletePlan(confirmDeleteId)}
                  disabled={!!deletingPlanId}
                  className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  {deletingPlanId === confirmDeleteId
                    ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
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
