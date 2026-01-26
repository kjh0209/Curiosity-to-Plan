"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface PlanSummary {
  id: string;
  planTitle: string;
  createdAt: string;
  completedDays: number;
  totalDays: number;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) {
          router.push("/");
          return;
        }

        const response = await fetch(`/api/plans?userId=${userId}`);
        if (!response.ok) {
          throw new Error("Failed to load plans");
        }

        const data = await response.json();
        setPlans(data.plans);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, [router]);

  const handleSelectPlan = (plan: PlanSummary) => {
    localStorage.setItem("planId", plan.id);
    // Fetch and store plan data for the selected plan
    fetch(`/api/plans/${plan.id}?userId=${localStorage.getItem("userId")}`)
      .then(res => res.json())
      .then(data => {
        if (data.plan) {
          const planData = {
            id: data.plan.id,
            planTitle: data.plan.planTitle,
            days: data.plan.days.map((day: any) => ({
              id: day.id,
              dayNumber: day.dayNumber,
              missionTitle: day.missionTitle,
              focus: day.focus,
              difficulty: day.difficulty,
              status: day.status,
            })),
          };
          localStorage.setItem("planData", JSON.stringify(planData));
          router.push("/plan");
        }
      });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your plans...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="SkillLoop Logo" width={40} height={40} className="rounded-lg" />
            <h1 className="text-3xl font-bold text-gray-900">My Plans</h1>
          </div>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            + New Plan
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-600 mb-4">You haven't created any plans yet.</p>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Create Your First Plan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleSelectPlan(plan)}
                className="bg-white rounded-lg shadow-lg p-6 text-left hover:shadow-xl transition cursor-pointer border-2 border-transparent hover:border-blue-300"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {plan.planTitle}
                </h2>
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>
                    Created: {new Date(plan.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-medium">
                    {plan.completedDays}/{plan.totalDays} days
                  </span>
                </div>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${(plan.completedDays / plan.totalDays) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
