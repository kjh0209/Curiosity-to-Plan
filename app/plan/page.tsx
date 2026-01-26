"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

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
  days: DayPlan[];
}

const motivationalMessages = [
  "🔥 Keep the fire burning!",
  "⚡ You're on a roll!",
  "🚀 Unstoppable momentum!",
  "💪 Crushing it!",
  "🌟 Star learner!",
];

const difficultyLabels: Record<string, string[]> = {
  en: ["Easy", "Normal", "Hard"],
  ko: ["하", "중", "상"],
  ja: ["初級", "中級", "上級"],
  zh: ["简单", "中等", "困难"],
  es: ["Fácil", "Medio", "Difícil"],
  fr: ["Facile", "Moyen", "Difficile"],
  de: ["Einfach", "Mittel", "Schwer"],
};

export default function PlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const planId = searchParams.get("id");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        // If no planId, redirect to plans list
        if (!planId) {
          router.push("/plans");
          return;
        }

        // Fetch plan data with cache busting
        const response = await fetch(`/api/plans/${planId}?userId=${userId}&t=${Date.now()}`);
        if (!response.ok) {
          throw new Error("Failed to load plan");
        }

        const data = await response.json();
        setPlan(data.plan);

        // Fetch user streak
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

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plan...</p>
        </div>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600">{error || "Plan not found"}</p>
          <button
            onClick={() => router.push("/plans")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            View All Plans
          </button>
        </div>
      </main>
    );
  }

  const completedDays = plan.days.filter(d => d.status === "DONE").length;
  const progress = (completedDays / plan.totalDays) * 100;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="SkillLoop Logo" width={40} height={40} className="rounded-lg" />
            <span className="text-xl font-bold text-gray-900">SkillLoop</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {session?.user?.name || session?.user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Plan Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-8 border border-white/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-100 rounded-full blur-3xl opacity-30 -mr-32 -mt-32 pointer-events-none"></div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-3 leading-tight">
                {plan.planTitle}
              </h1>
              <div className="flex items-center gap-3 text-gray-600 text-sm md:text-base bg-gray-100/50 inline-flex px-3 py-1 rounded-full">
                <span>🗓️ {plan.totalDays} Days</span>
                <span>•</span>
                <span>⏱️ {plan.minutesPerDay} min/day</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="relative group cursor-default">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-red-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white rounded-xl border border-orange-100 px-6 py-4 shadow-lg flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Current Streak</p>
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-500 to-red-600 font-mono tracking-tighter">
                      {streak}
                    </span>
                  </div>
                  <div className="text-5xl animate-bounce-slow filter drop-shadow-md">
                    🔥
                  </div>
                </div>
              </div>
              {streak > 0 && (
                <p className="text-xs font-semibold text-orange-500 mt-3 animate-pulse">
                  {motivationalMessages[streak % motivationalMessages.length]}
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-8">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
              <span>Progress: {completedDays} / {plan.totalDays} completed</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 shadow-inner overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-full rounded-full transition-all duration-1000 ease-out shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Day Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plan.days.map((day) => {
            const isDone = day.status === "DONE";
            const isReady = day.status === "READY";
            const diffIndex = day.difficulty - 1; // 0, 1, 2
            const diffLabel = (difficultyLabels["ko"] || difficultyLabels["en"])[diffIndex] || "Normal";

            return (
              <div
                key={day.id}
                className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all duration-300 group ${isDone
                  ? "bg-green-50/50 border-green-200 shadow-sm"
                  : isReady
                    ? "bg-white border-blue-200 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-blue-300 ring-2 ring-transparent hover:ring-blue-100"
                    : "bg-gray-50 border-gray-100 opacity-60 grayscale-[0.5]"
                  }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${isReady ? "bg-blue-100 text-blue-700" : isDone ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                      }`}>
                      Day {day.dayNumber}
                    </span>

                    {/* Difficulty Badge */}
                    <span className={`text-xs md:text-sm font-extrabold px-2 py-0.5 rounded-full border ${day.difficulty === 3 ? "bg-red-50 text-red-600 border-red-100" :
                      day.difficulty === 2 ? "bg-yellow-50 text-yellow-600 border-yellow-100" :
                        "bg-green-50 text-green-600 border-green-100"
                      }`}>
                      {diffLabel}
                    </span>
                  </div>

                  <h3 className={`font-bold text-gray-800 leading-snug mb-3 ${isReady ? "text-lg" : "text-base"}`}>
                    {day.missionTitle}
                  </h3>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100/50 flex justify-between items-center">
                  <span className={`text-xs font-bold uppercase ${isDone ? "text-green-600 flex items-center gap-1" : isReady ? "text-blue-600" : "text-gray-400"
                    }`}>
                    {isDone ? (
                      (() => {
                        if (!day.result) return "Completed";
                        try {
                          const res = JSON.parse(day.result);
                          return (
                            <>
                              <span>✓ Scored:</span>
                              <span className={res.score === 3 ? "text-green-700 font-black" : "text-yellow-600 font-bold"}>
                                {res.score}/3
                              </span>
                            </>
                          );
                        } catch (e) { return "Completed"; }
                      })()
                    ) : day.status === "LOCKED" ? "🔒 Locked" : "Ready"}
                  </span>

                  {isReady && (
                    <Link
                      href={`/day/${day.dayNumber}?planId=${plan.id}`}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95"
                    >
                      Start Mission →
                    </Link>
                  )}
                  {isDone && (
                    <Link
                      href={`/day/${day.dayNumber}?planId=${plan.id}&mode=review`}
                      className="text-xs text-slate-500 hover:text-blue-600 font-medium underline decoration-slate-300 hover:decoration-blue-600 underline-offset-2 transition-colors"
                    >
                      Review
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/plans"
            className="text-blue-600 hover:text-blue-700 underline text-sm"
          >
            ← View All Plans
          </Link>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 underline text-sm"
          >
            + Create New Plan
          </Link>
          <Link
            href="/observability"
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            📊 Opik Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
