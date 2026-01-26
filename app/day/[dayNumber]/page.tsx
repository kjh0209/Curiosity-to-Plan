"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

interface QuizQuestion {
  q: string;
  type: "mcq" | "short";
  choices?: string[];
  answer: string;
}

interface DayData {
  missionTitle: string;
  steps: string[];
  quiz: QuizQuestion[];
  difficulty: number;
}

interface GradeResult {
  score: number;
  feedback: string;
  difficultySignal: string;
}

export default function DayPage() {
  const router = useRouter();
  const params = useParams();
  const dayNumber = parseInt(params.dayNumber as string, 10);

  const [dayData, setDayData] = useState<DayData | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>(["", "", ""]);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDay = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (!userId) {
          router.push("/");
          return;
        }

        // Fetch day data from storage or API
        const dayDataStr = localStorage.getItem(`day_${dayNumber}`);
        if (dayDataStr) {
          setDayData(JSON.parse(dayDataStr));
        } else {
          // Generate day mission
          const planData = localStorage.getItem("planData");
          if (!planData) {
            router.push("/plan");
            return;
          }

          const plan = JSON.parse(planData);
          const dayMeta = plan.days.find((d: any) => d.dayNumber === dayNumber);

          if (!dayMeta) {
            setError("Day not found");
            return;
          }

          const response = await fetch("/api/day/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              dayNumber,
              missionTitle: dayMeta.missionTitle,
              focus: dayMeta.focus,
              difficulty: dayMeta.difficulty,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to generate day mission");
          }

          const data = await response.json();
          setDayData({
            missionTitle: dayMeta.missionTitle,
            steps: data.steps,
            quiz: data.quiz,
            difficulty: dayMeta.difficulty,
          });
          localStorage.setItem(`day_${dayNumber}`, JSON.stringify({
            missionTitle: dayMeta.missionTitle,
            steps: data.steps,
            quiz: data.quiz,
            difficulty: dayMeta.difficulty,
          }));
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadDay();
  }, [dayNumber, router]);

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const userId = localStorage.getItem("userId");
      if (!userId || !dayData) {
        throw new Error("Missing data");
      }

      const response = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          dayNumber,
          quiz: dayData.quiz,
          userAnswers,
          currentDifficulty: dayData.difficulty,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to grade quiz");
      }

      const gradeResult = await response.json();
      setResult(gradeResult);

      // Update plan and streak in localStorage
      const planData = JSON.parse(localStorage.getItem("planData") || "{}");
      planData.days = planData.days.map((d: any) => 
        d.dayNumber === dayNumber 
          ? { ...d, status: "DONE" }
          : d.dayNumber === dayNumber + 1
            ? { 
                ...d, 
                status: "READY",
                difficulty: gradeResult.difficultySignal === "TOO_EASY" 
                  ? Math.min(3, d.difficulty + 1)
                  : gradeResult.difficultySignal === "TOO_HARD"
                    ? Math.max(1, d.difficulty - 1)
                    : d.difficulty
              }
            : d
      );
      localStorage.setItem("planData", JSON.stringify(planData));

      // Update streak
      const lastDate = localStorage.getItem("lastCompletedDate");
      const today = new Date().toDateString();
      let streak = parseInt(localStorage.getItem("streak") || "0", 10);

      if (lastDate === today) {
        // Already completed today
      } else if (lastDate === new Date(Date.now() - 86400000).toDateString()) {
        streak += 1;
      } else {
        streak = 1;
      }

      localStorage.setItem("streak", streak.toString());
      localStorage.setItem("lastCompletedDate", today);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading mission...</p>
      </main>
    );
  }

  if (error || !dayData) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push("/plan")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Plan
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/plan")}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            ← Back to Plan
          </button>
          <Image src="/logo.svg" alt="SkillLoop Logo" width={36} height={36} className="rounded-lg" />
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Day {dayNumber}
              </h1>
              <p className="text-lg text-gray-700 mt-2">
                {dayData.missionTitle}
              </p>
            </div>
            <span className="text-sm bg-gray-600 text-white px-3 py-1 rounded">
              Difficulty {dayData.difficulty}/3
            </span>
          </div>

          {/* Steps */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Today's Steps
            </h2>
            <ul className="space-y-2">
              {dayData.steps.map((step, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-600 font-bold mr-3">•</span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quiz */}
          {!result ? (
            <form onSubmit={handleSubmitQuiz} className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Quiz (3 Questions)
                </h2>
              </div>

              {dayData.quiz.map((question, idx) => (
                <div key={idx} className="border-l-4 border-blue-600 pl-4">
                  <p className="font-medium text-gray-900 mb-3">
                    Q{idx + 1}: {question.q}
                  </p>

                  {question.type === "mcq" && question.choices ? (
                    <div className="space-y-2">
                      {question.choices.map((choice, cidx) => (
                        <label key={cidx} className="flex items-center">
                          <input
                            type="radio"
                            name={`q${idx}`}
                            value={choice}
                            checked={userAnswers[idx] === choice}
                            onChange={(e) => {
                              const newAnswers = [...userAnswers];
                              newAnswers[idx] = e.target.value;
                              setUserAnswers(newAnswers);
                            }}
                            className="mr-3"
                          />
                          <span className="text-gray-700">{choice}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={userAnswers[idx]}
                      onChange={(e) => {
                        const newAnswers = [...userAnswers];
                        newAnswers[idx] = e.target.value;
                        setUserAnswers(newAnswers);
                      }}
                      placeholder="Your answer..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {submitting ? "Grading..." : "Submit Quiz"}
              </button>
            </form>
          ) : (
            /* Result Display */
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Quiz Result
                  </h3>
                  <span
                    className={`text-3xl font-bold ${
                      result.score === 3
                        ? "text-green-600"
                        : result.score === 2
                          ? "text-yellow-600"
                          : "text-orange-600"
                    }`}
                  >
                    {result.score}/3
                  </span>
                </div>

                <p className="text-gray-700 mb-3">{result.feedback}</p>

                <div className="flex items-center">
                  <span className="text-sm font-semibold text-gray-600 mr-2">
                    Difficulty:
                  </span>
                  <span
                    className={`text-sm font-bold px-3 py-1 rounded ${
                      result.difficultySignal === "TOO_EASY"
                        ? "bg-green-100 text-green-800"
                        : result.difficultySignal === "ON_TRACK"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {result.difficultySignal}
                  </span>
                </div>
              </div>

              <button
                onClick={() => router.push("/plan")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                Back to Plan
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
