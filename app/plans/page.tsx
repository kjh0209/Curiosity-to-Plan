"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "loading" || !session) return;

    const loadPlans = async () => {
      try {
        const userId = (session.user as any).id;
        if (!userId) {
          router.push("/auth/login");
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
  }, [router, session, status]);

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your plans...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="SkillLoop Logo" width={40} height={40} className="rounded-lg" />
            <h1 className="text-3xl font-bold text-gray-900">My Plans</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              + New Plan
            </Link>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
            {error}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No plans yet</h2>
            <p className="text-gray-600 mb-6">Start your learning journey by creating your first plan!</p>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              Create Your First Plan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const progress = (plan.completedDays / plan.totalDays) * 100;
              const isComplete = plan.completedDays === plan.totalDays;

              return (
                <Link
                  key={plan.id}
                  href={`/plan?id=${plan.id}`}
                  className={`bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition cursor-pointer border-2 ${isComplete ? "border-green-300" : "border-transparent hover:border-blue-300"
                    }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {plan.planTitle}
                    </h2>
                    {isComplete && <span className="text-2xl">🎉</span>}
                  </div>

                  <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                    <span>
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-medium">
                      {plan.completedDays}/{plan.totalDays} days
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-blue-600"
                        }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <p className={`text-xs ${isComplete ? "text-green-600" : "text-gray-500"}`}>
                    {isComplete ? "✓ Completed!" : `${Math.round(progress)}% complete`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer Links */}
        <div className="mt-8 flex justify-center gap-6">
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
