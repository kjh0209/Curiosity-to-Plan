"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function OnboardingPage() {
  const router = useRouter();
  const [interest, setInterest] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Get or create user ID from localStorage
      let userId = localStorage.getItem("userId");
      if (!userId) {
        userId = Math.random().toString(36).substr(2, 9);
        localStorage.setItem("userId", userId);
      }

      const response = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          interest,
          goal,
          minutesPerDay: 20,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate plan");
      }

      const data = await response.json();
      const plan = data.plan;
      localStorage.setItem("planId", plan.id);

      // Store plan data locally
      const planData = {
        id: plan.id,
        planTitle: plan.planTitle,
        days: plan.days.map((day: any) => ({
          id: day.id,
          dayNumber: day.dayNumber,
          missionTitle: day.missionTitle,
          focus: day.focus,
          difficulty: day.difficulty,
          status: day.status,
        })),
      };
      localStorage.setItem("planData", JSON.stringify(planData));
      localStorage.setItem("streak", "0");
      localStorage.setItem("lastCompletedDate", "");

      router.push("/plan");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.svg" alt="SkillLoop Logo" width={48} height={48} className="rounded-lg" />
          <h1 className="text-3xl font-bold text-gray-900">SkillLoop</h1>
        </div>
        <p className="text-gray-600 mb-6">
          Convert your curiosity into a 14-day learning routine
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What do you want to learn?
            </label>
            <input
              type="text"
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              placeholder="e.g., machine learning, piano, cooking"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What's your goal?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Build a basic ML model, Play a simple song"
              required
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minutes per day (fixed at 20)
            </label>
            <input
              type="number"
              value={20}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            {loading ? "Generating..." : "Generate 14-day plan"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/plans")}
            className="text-blue-600 hover:text-blue-700 text-sm underline"
          >
            View My Existing Plans →
          </button>
        </div>
      </div>
    </main>
  );
}
