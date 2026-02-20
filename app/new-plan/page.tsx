"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getDictionary, Language } from "@/lib/i18n";

export default function NewPlanPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [interest, setInterest] = useState("");
    const [goal, setGoal] = useState("");
    const [minutesPerDay, setMinutesPerDay] = useState(20);
    const [totalDays, setTotalDays] = useState(14);
    const [riskStyle, setRiskStyle] = useState("BALANCED");
    const [baselineLevel, setBaselineLevel] = useState("BEGINNER");
    const [language, setLanguage] = useState("en");
    const [resourceSort, setResourceSort] = useState("relevance");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState("");
    const [error, setError] = useState("");
    const [limitReached, setLimitReached] = useState(false);
    const [limitInfo, setLimitInfo] = useState<{ tier: string; remaining: number; total: number } | null>(null);
    // Localization
    const dict = getDictionary(language as Language);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        }
    }, [status, router]);

    // Fetch user language preference and plan limits
    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            const userId = (session.user as any).id;
            fetch(`/api/profile?userId=${userId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.profile?.language) {
                        setLanguage(data.profile.language);
                    }
                    // Calculate remaining plans
                    const tier = data.profile?.subscriptionTier || "free";
                    const total = tier === "pro" ? 5 : 3;
                    const used = data.profile?.plansCreatedToday || 0;
                    // Check if daily reset is needed
                    const lastReset = data.profile?.lastDailyReset ? new Date(data.profile.lastDailyReset) : new Date();
                    const now = new Date();
                    const isNewDay = now.toDateString() !== lastReset.toDateString();
                    const remaining = isNewDay ? total : Math.max(0, total - used);
                    setLimitInfo({ tier, remaining, total });
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

            const data = await response.json();

            if (!response.ok) {
                if (data.limitReached) {
                    setLimitReached(true);
                    setLimitInfo({ tier: data.tier, remaining: 0, total: data.total });
                    const limitMsg = data.tier === "free"
                        ? (dict.limits?.planLimitReachedUpgrade || "You've reached today's plan limit. Upgrade to Pro for more!")
                        : (dict.limits?.planLimitReached || "You've reached today's plan limit. Try again tomorrow.");
                    setError(limitMsg);
                    setLoading(false);
                    return;
                }
                throw new Error(data.error || "Failed to generate plan");
            }

            setProgress(100);
            setProgressMessage("Plan generated successfully!");

            await new Promise(resolve => setTimeout(resolve, 800));
            router.push("/plan?id=" + data.plan.id);
        } catch (err) {
            setError(String(err).replace("Error: ", ""));
            setLoading(false);
        }
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
        <main className="page-bg-gradient min-h-screen relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-sky-500/10 rounded-full blur-[100px] -z-10" />
            <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] -z-10" />

            <div className="container-default pt-32 pb-20">

                {/* Hero Section */}
                <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">
                        Create Your <span className="text-gradient">Custom Plan</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Tell us what you want to learn, and we will build a personalized curriculum just for you.
                    </p>
                </div>

                {/* Remaining Plans Indicator */}
                {limitInfo && (
                    <div className="max-w-xl mx-auto mb-6 animate-fade-in">
                        <div className={`flex items-center justify-between p-4 rounded-xl border ${
                            limitInfo.remaining === 0
                                ? "bg-red-500/10 border-red-500/20"
                                : limitInfo.remaining <= 1
                                    ? "bg-amber-500/10 border-amber-500/20"
                                    : "bg-slate-800/50 border-slate-700/50"
                        }`}>
                            <div className="flex items-center gap-3">
                                <svg className={`w-5 h-5 ${limitInfo.remaining === 0 ? "text-red-400" : limitInfo.remaining <= 1 ? "text-amber-400" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <span className="text-sm text-slate-300">
                                    {(dict.limits?.remainingPlans || "Plans remaining today: {remaining}/{total}")
                                        .replace("{remaining}", String(limitInfo.remaining))
                                        .replace("{total}", String(limitInfo.total))}
                                </span>
                            </div>
                            {limitInfo.tier === "free" && (
                                <a href="/pricing" className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap">
                                    {dict.limits?.upgradeButton || "Upgrade to Pro"}
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="max-w-xl mx-auto relative z-10">

                    {/* Form Glass Card */}
                    <div className="glass-card p-6 md:p-10 rounded-2xl border border-slate-700/50 shadow-2xl shadow-sky-900/10 animate-slide-up">
                        <div className="mb-8">
                            <h2 className="text-2xl font-semibold mb-2">{dict.plan.setupTitle}</h2>
                            <p className="text-slate-400">{dict.plan.generating}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Interest */}
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-300">
                                    {dict.plan.topicLabel}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={interest}
                                        onChange={(e) => setInterest(e.target.value)}
                                        placeholder={dict.plan.topicPlaceholder}
                                        required
                                        disabled={loading}
                                        className="w-full bg-slate-900/50 border border-slate-700 focus:border-sky-500 focus:ring-sky-500/20 rounded-xl pl-4 pr-4 py-3 text-slate-100 placeholder-slate-500 transition-all"
                                    />
                                    <div className="absolute right-3 top-3 text-slate-500">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Goal */}
                            <div>
                                <label className="block text-sm font-medium mb-2 text-slate-300">
                                    {dict.day.todayFocus}
                                </label>
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="e.g., Build a recommendation system from scratch"
                                    required
                                    rows={2}
                                    disabled={loading}
                                    className="w-full bg-slate-900/50 border border-slate-700 focus:border-sky-500 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 resize-none transition-all"
                                />
                            </div>

                            {/* Time Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm font-medium text-slate-300">
                                            {dict.plan.dailyTime}
                                        </label>
                                        <span className="text-sm font-bold text-sky-400">{minutesPerDay}m</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={5}
                                        max={120}
                                        step={5}
                                        value={minutesPerDay}
                                        onChange={(e) => setMinutesPerDay(parseInt(e.target.value))}
                                        disabled={loading}
                                        className="w-full accent-sky-500"
                                    />
                                </div>

                                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm font-medium text-slate-300">
                                            {dict.plan.daysLabel}
                                        </label>
                                        <span className="text-sm font-bold text-purple-400">{totalDays} days</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={7}
                                        max={100}
                                        step={1}
                                        value={totalDays}
                                        onChange={(e) => setTotalDays(parseInt(e.target.value))}
                                        disabled={loading}
                                        className="w-full accent-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Options Row 1 */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-300">
                                        {dict.plan.resourceSort}
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={resourceSort}
                                            onChange={(e) => setResourceSort(e.target.value)}
                                            disabled={loading}
                                            className="w-full appearance-none bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-sky-500 focus:ring-sky-500/20 transition-all"
                                        >
                                            <option value="relevance">{dict.plan.sortRelevance}</option>
                                            <option value="viewCount">{dict.plan.sortViewed}</option>
                                            <option value="rating">{dict.plan.sortRated}</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 text-slate-500 pointer-events-none">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-300">
                                        {dict.plan.levelLabel}
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={baselineLevel}
                                            onChange={(e) => setBaselineLevel(e.target.value)}
                                            disabled={loading}
                                            className="w-full appearance-none bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-sky-500 focus:ring-sky-500/20 transition-all"
                                        >
                                            <option value="BEGINNER">{dict.plan.levelBeginner}</option>
                                            <option value="INTERMEDIATE">{dict.plan.levelIntermediate}</option>
                                            <option value="ADVANCED">{dict.plan.levelAdvanced}</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 text-slate-500 pointer-events-none">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Options Row 2 */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-slate-300">
                                        {dict.plan.learningPace}
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={riskStyle}
                                            onChange={(e) => setRiskStyle(e.target.value)}
                                            disabled={loading}
                                            className="w-full appearance-none bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:border-sky-500 focus:ring-sky-500/20 transition-all"
                                        >
                                            <option value="CONSERVATIVE">{dict.plan.paceSteady}</option>
                                            <option value="BALANCED">{dict.plan.paceBalanced}</option>
                                            <option value="CHALLENGER">{dict.plan.paceIntensive}</option>
                                        </select>
                                        <div className="absolute right-3 top-3.5 text-slate-500 pointer-events-none">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Progress */}
                            {loading && (
                                <div className="py-4 animate-fade-in bg-slate-900/50 rounded-xl p-4 border border-slate-800">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm text-slate-400 flex items-center gap-2">
                                            <span className="spinner w-4 h-4 border-2"></span>
                                            {progressMessage}
                                        </span>
                                        <span className="text-sm font-semibold text-sky-400">
                                            {Math.round(progress)}%
                                        </span>
                                    </div>
                                    <div className="progress-track bg-slate-800 h-2">
                                        <div
                                            className="progress-fill bg-gradient-to-r from-sky-500 to-purple-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className={`p-4 rounded-xl text-sm animate-fade-in ${limitReached ? "bg-amber-500/10 border border-amber-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                                    <div className={`flex items-center gap-2 ${limitReached ? "text-amber-400" : "text-red-400"}`}>
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {error}
                                    </div>
                                    {limitReached && limitInfo?.tier === "free" && (
                                        <a href="/pricing" className="mt-3 block w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black text-center font-bold text-sm hover:from-amber-400 hover:to-orange-400 transition-all">
                                            {dict.limits?.upgradeButton || "Upgrade to Pro"}
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary btn-lg w-full h-14 text-lg shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                <span className="relative">
                                    {loading ? dict.common.loading : dict.plan.createButton}
                                </span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </main>
    );
}
