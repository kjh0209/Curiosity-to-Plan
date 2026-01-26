"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface DayPlan {
  id: string;
  dayNumber: number;
  missionTitle: string;
  difficulty: number;
  status: string;
}

interface Plan {
  id: string;
  planTitle: string;
  days: DayPlan[];
}

export default function PlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const userId = localStorage.getItem("userId");
        const planId = localStorage.getItem("planId");

        if (!userId || !planId) {
          router.push("/");
          return;
        }

        // In a real app, fetch from DB. For now, reconstruct from localStorage
        const planData = localStorage.getItem("planData");
        if (!planData) {
          router.push("/");
          return;
        }

        const parsed = JSON.parse(planData);
        setPlan(parsed);
        setStreak(parseInt(localStorage.getItem("streak") || "0", 10));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPlan();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading plan...</p>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Start Over
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="SkillLoop Logo" width={40} height={40} className="rounded-lg" />
            <h1 className="text-3xl font-bold text-gray-900">
              {plan.planTitle}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-orange-600">{streak}</p>
            <p className="text-sm text-gray-600">day streak</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plan.days.map((day) => (
            <div
              key={day.id}
              className={`p-4 rounded-lg border-2 transition ${day.status === "DONE"
                  ? "bg-green-50 border-green-300"
                  : day.status === "READY"
                    ? "bg-blue-50 border-blue-300"
                    : "bg-gray-100 border-gray-300"
                }`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-900">
                  Day {day.dayNumber}
                </h3>
                <span className="text-xs bg-gray-600 text-white px-2 py-1 rounded">
                  {day.difficulty}/3
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-4">{day.missionTitle}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-600 uppercase">
                  {day.status}
                </span>
                {day.status === "READY" && (
                  <Link
                    href={`/day/${day.dayNumber}`}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                  >
                    Start
                  </Link>
                )}
                {day.status === "DONE" && (
                  <span className="text-xs text-green-600 font-semibold">
                    ✓ Completed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.push("/plans")}
            className="text-blue-600 hover:text-blue-700 underline text-sm"
          >
            ← View All Plans
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 hover:text-blue-700 underline text-sm"
          >
            + Start New Plan
          </button>
        </div>
      </div>
    </main>
  );
}
