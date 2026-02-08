"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getDictionary, Language } from "@/lib/i18n";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [interest, setInterest] = useState("");
  const [goal, setGoal] = useState("");
  const [minutesPerDay, setMinutesPerDay] = useState(20);
  const [totalDays, setTotalDays] = useState(14);
  const [riskStyle, setRiskStyle] = useState("BALANCED");
  const [baselineLevel, setBaselineLevel] = useState("BEGINNER");
  const [language, setLanguage] = useState("ko");
  const [resourceSort, setResourceSort] = useState("relevance");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);

  // Localization
  const dict = getDictionary(language as Language);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(darkMode);
      if (darkMode) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  // Fetch user language preference
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const userId = (session.user as any).id;
      fetch(`/api/profile?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.profile?.language) {
            setLanguage(data.profile.language);
          }
        })
        .catch(err => console.error("Failed to load user language", err));
    }
  }, [status, session]);

  useEffect(() => {
    if (!loading) return;

    const estimatedTime = totalDays <= 20 ? 15000 : totalDays * 1200;
    const interval = 200;
    const increment = (100 / (estimatedTime / interval)) * 0.9;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return Math.min(prev + increment, 90);
      });
    }, interval);

    const messages = [
      "Analyzing your learning goals...",
      "Building curriculum structure...",
      "Mapping daily progression...",
      "Connecting milestones...",
      "Finalizing your plan...",
    ];

    let messageIndex = 0;
    const messageTimer = setInterval(() => {
      setProgressMessage(messages[messageIndex % messages.length]);
      messageIndex++;
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(messageTimer);
    };
  }, [loading, totalDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setProgress(0);
    setProgressMessage("Starting curriculum generation...");

    try {
      if (!session?.user) throw new Error("Not authenticated");

      const userId = (session.user as any).id;

      const response = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          interest,
          goal,
          minutesPerDay,
          totalDays,
          riskStyle,
          baselineLevel,
          language,
          resourceSort,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate plan");
      }

      setProgress(100);
      setProgressMessage("Plan generated successfully!");

      const data = await response.json();
      await new Promise(resolve => setTimeout(resolve, 800));
      router.push("/plan?id=" + data.plan.id);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  if (status === "loading") {
    return (
      <main className="page-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-[var(--text-secondary)]">{dict.common.loading}</p>
        </div>
      </main>
    );
  }

  if (!session) return null;

  return (
    <main className="page-bg-gradient">
      <div className="container-default py-8 md:py-12">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
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

            <Link href="/plans" className="btn btn-secondary">
              {dict.dashboard.myPlans}
            </Link>

            <Link href="/profile" className="btn btn-ghost p-2" title="Profile">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>

            <button onClick={() => signOut()} className="btn btn-danger">
              {dict.common.signOut}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-xl mx-auto">
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="mb-3">{dict.plan.setupTitle}</h1>
            <p className="text-[var(--text-secondary)] text-lg">
              {dict.plan.generating}
            </p>
          </div>

          {/* Form Card */}
          <div className="card p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Interest */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                  {dict.plan.topicLabel}
                </label>
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  placeholder={dict.plan.topicPlaceholder}
                  required
                  disabled={loading}
                />
              </div>

              {/* Goal */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                  {dict.day.todayFocus}
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Build a recommendation system from scratch"
                  required
                  rows={2}
                  disabled={loading}
                  className="resize-none"
                />
              </div>

              {/* Time Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">
                      {dict.plan.dailyTime}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        step={5}
                        value={minutesPerDay}
                        onChange={(e) => {
                          const val = Math.max(5, Math.min(120, parseInt(e.target.value) || 5));
                          setMinutesPerDay(val);
                        }}
                        disabled={loading}
                        className="w-16 text-right text-sm font-semibold px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--text-secondary)]">min</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={minutesPerDay}
                    onChange={(e) => setMinutesPerDay(parseInt(e.target.value))}
                    disabled={loading}
                  />
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                    <span>5 min</span>
                    <span>120 min</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">
                      {dict.plan.daysLabel}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={7}
                        max={100}
                        step={1}
                        value={totalDays}
                        onChange={(e) => {
                          const val = Math.max(7, Math.min(100, parseInt(e.target.value) || 7));
                          setTotalDays(val);
                        }}
                        disabled={loading}
                        className="w-16 text-right text-sm font-semibold px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]"
                      />
                      <span className="text-sm text-[var(--text-secondary)]">{dict.dashboard.daysLeft}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={7}
                    max={100}
                    step={1}
                    value={totalDays}
                    onChange={(e) => setTotalDays(parseInt(e.target.value))}
                    disabled={loading}
                  />
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                    <span>7 days</span>
                    <span>100 days</span>
                  </div>
                </div>
              </div>

              {/* Options Row 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                    {dict.plan.resourceSort}
                  </label>
                  <select
                    value={resourceSort}
                    onChange={(e) => setResourceSort(e.target.value)}
                    disabled={loading}
                  >
                    <option value="relevance">{dict.plan.sortRelevance}</option>
                    <option value="viewCount">{dict.plan.sortViewed}</option>
                    <option value="rating">{dict.plan.sortRated}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                    {dict.plan.levelLabel}
                  </label>
                  <select
                    value={baselineLevel}
                    onChange={(e) => setBaselineLevel(e.target.value)}
                    disabled={loading}
                  >
                    <option value="BEGINNER">{dict.plan.levelBeginner}</option>
                    <option value="INTERMEDIATE">{dict.plan.levelIntermediate}</option>
                    <option value="ADVANCED">{dict.plan.levelAdvanced}</option>
                  </select>
                </div>
              </div>

              {/* Options Row 2 */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                    {dict.plan.learningPace}
                  </label>
                  <select
                    value={riskStyle}
                    onChange={(e) => setRiskStyle(e.target.value)}
                    disabled={loading}
                  >
                    <option value="CONSERVATIVE">{dict.plan.paceSteady}</option>
                    <option value="BALANCED">{dict.plan.paceBalanced}</option>
                    <option value="CHALLENGER">{dict.plan.paceIntensive}</option>
                  </select>
                </div>
              </div>

              {/* Progress */}
              {loading && (
                <div className="py-4 animate-fade-in">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-[var(--text-secondary)]">
                      {progressMessage}
                    </span>
                    <span className="text-sm font-semibold text-[var(--primary)]">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 rounded-lg bg-[var(--error-bg)] border border-[var(--error)]/20 text-[var(--error)] text-sm animate-fade-in">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg w-full"
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    {dict.common.loading}
                  </>
                ) : (
                  dict.plan.createButton
                )}
              </button>
            </form>
          </div>

          {/* Footer Tags */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <span className="badge">{dict.plan.tags.aiPowered}</span>
            <span className="badge">{dict.plan.tags.personalized}</span>
            <span className="badge">{dict.plan.tags.progressive}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
