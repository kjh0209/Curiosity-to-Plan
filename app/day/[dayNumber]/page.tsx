"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

interface QuizQuestion {
  q: string;
  type: "mcq" | "short";
  choices?: string[];
  answer: string;
  explanation?: string;
}

interface Resource {
  type: "youtube" | "article" | "wikipedia" | "documentation" | "tutorial";
  title: string;
  url: string;
  description?: string;
}

interface DayData {
  missionTitle: string;
  steps: string[];
  quiz: QuizQuestion[];
  resources: Resource[];
  difficulty: number;
}

interface SavedResult {
  score: number;
  feedback: string;
  difficultySignal: string;
  userAnswers: string[];
  timestamp: string;
  passed?: boolean;
  failureReason?: string;
}

const resourceIcons: Record<string, string> = {
  youtube: "🎬",
  article: "📝",
  wikipedia: "📚",
  documentation: "📖",
  tutorial: "💻",
};

export default function DayPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const dayNumber = parseInt(params.dayNumber as string, 10);
  const planId = searchParams.get("planId");
  const mode = searchParams.get("mode") || "default"; // "review" or "doagain"

  const [dayData, setDayData] = useState<DayData | null>(null);
  const [totalDays, setTotalDays] = useState(14);
  const [allDays, setAllDays] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<string[]>(["", "", ""]);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);
  const [currentResult, setCurrentResult] = useState<SavedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [clickedResources, setClickedResources] = useState<Set<number>>(new Set());

  // Load day data
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "loading" || !session) return;

    const loadDay = async () => {
      try {
        const userId = (session.user as any).id;
        if (!userId) {
          router.push("/auth/login");
          return;
        }

        // Fetch plan data
        const planResponse = await fetch(`/api/plans/${planId}?userId=${userId}&t=${Date.now()}`);
        if (!planResponse.ok) throw new Error("Failed to fetch plan");

        const planData = await planResponse.json();
        setTotalDays(planData.plan.totalDays || planData.plan.days.length);
        setAllDays(planData.plan.days);

        const dayMeta = planData.plan.days.find((d: any) => d.dayNumber === dayNumber);
        if (!dayMeta) {
          setError("Day not found");
          setLoading(false);
          return;
        }

        // Load saved result from localStorage
        const resultKey = `result_${planId}_${dayNumber}`;
        const savedResultStr = localStorage.getItem(resultKey);
        if (savedResultStr) {
          const parsed = JSON.parse(savedResultStr);
          setSavedResult(parsed);
          if (mode === "review") {
            setUserAnswers(parsed.userAnswers || ["", "", ""]);
            setCurrentResult(parsed);
          }
        }

        // Load saved clicks
        const clickedKey = `clicked_${planId}_${dayNumber}`;
        const savedClicks = localStorage.getItem(clickedKey);
        if (savedClicks) {
          setClickedResources(new Set(JSON.parse(savedClicks)));
        }

        // Check cache for day content
        const cacheKey = `day_${planId}_${dayNumber}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          setDayData(JSON.parse(cachedData));
        } else if (dayMeta.steps && dayMeta.quiz) {
          const data: DayData = {
            missionTitle: dayMeta.missionTitle,
            steps: JSON.parse(dayMeta.steps),
            quiz: JSON.parse(dayMeta.quiz),
            resources: dayMeta.resources ? JSON.parse(dayMeta.resources) : [],
            difficulty: dayMeta.difficulty,
          };
          setDayData(data);
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } else {
          // Generate day content
          const response = await fetch("/api/day/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              planId,
              dayNumber,
              missionTitle: dayMeta.missionTitle,
              focus: dayMeta.focus,
              difficulty: dayMeta.difficulty,
            }),
          });

          if (!response.ok) throw new Error("Failed to generate day");

          const data = await response.json();
          const dayDataObj: DayData = {
            missionTitle: dayMeta.missionTitle,
            steps: data.steps,
            quiz: data.quiz,
            resources: data.resources || [],
            difficulty: dayMeta.difficulty,
          };
          setDayData(dayDataObj);
          localStorage.setItem(cacheKey, JSON.stringify(dayDataObj));
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadDay();
  }, [dayNumber, router, session, status, planId, mode]);

  const handleResourceClick = (index: number) => {
    const newSet = new Set(clickedResources);
    newSet.add(index);
    setClickedResources(newSet);
    localStorage.setItem(`clicked_${planId}_${dayNumber}`, JSON.stringify(Array.from(newSet)));
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const userId = (session?.user as any)?.id;
      if (!userId || !dayData) throw new Error("Missing data");

      const resourcesCompleted = clickedResources.size === dayData.resources.length;

      const response = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          planId,
          dayNumber,
          quiz: dayData.quiz,
          userAnswers,
          currentDifficulty: dayData.difficulty,
          resourcesCompleted,
        }),
      });

      if (!response.ok) throw new Error("Failed to grade quiz");

      const gradeResult = await response.json();

      const result: SavedResult = {
        ...gradeResult,
        userAnswers,
        timestamp: new Date().toISOString(),
      };

      setCurrentResult(result);

      // Always save result
      const resultKey = `result_${planId}_${dayNumber}`;
      localStorage.setItem(resultKey, JSON.stringify(result));
      setSavedResult(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const difficultyLabels: Record<string, string[]> = {
    en: ["Easy", "Normal", "Hard"],
    ko: ["하", "중", "상"],
    ja: ["初級", "中級", "上級"],
    zh: ["简单", "中等", "困难"],
    es: ["Fácil", "Medio", "Difícil"],
    fr: ["Facile", "Moyen", "Difficile"],
    de: ["Einfach", "Mittel", "Schwer"],
  };

  const navigateToDay = (targetDay: number) => {
    if (targetDay >= 1 && targetDay <= totalDays) {
      router.push(`/day/${targetDay}?planId=${planId}`);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mission...</p>
        </div>
      </main>
    );
  }

  if (error || !dayData) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600">{error}</p>
          <button onClick={() => router.push(`/plan?id=${planId}`)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg">
            Back to Plan
          </button>
        </div>
      </main>
    );
  }

  const isReviewMode = mode === "review" && savedResult;
  const showResult = currentResult !== null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push(`/plan?id=${planId}`)} className="text-blue-600 hover:text-blue-700 text-sm">
            ← Back to Plan
          </button>
          <Image src="/logo.svg" alt="SkillLoop Logo" width={36} height={36} className="rounded-lg" />
        </div>

        {/* Day Navigation */}
        <div className="flex items-center justify-between bg-white rounded-lg shadow p-3 mb-6">
          <button
            onClick={() => navigateToDay(dayNumber - 1)}
            disabled={dayNumber <= 1}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev Day
          </button>
          <span className="font-semibold text-gray-700">
            Day {dayNumber} of {totalDays}
          </span>
          <button
            onClick={() => navigateToDay(dayNumber + 1)}
            disabled={(() => {
              if (dayNumber >= totalDays) return true;
              const nextDay = allDays.find(d => d.dayNumber === dayNumber + 1);
              return !nextDay || nextDay.status === "LOCKED";
            })()}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next Day →
          </button>
        </div>

        {/* Mode indicator */}
        {isReviewMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-center">
            📖 <span className="font-semibold">Review Mode</span> - Viewing your previous attempt
          </div>
        )}
        {mode === "doagain" && !showResult && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center">
            🔄 <span className="font-semibold">Do Again Mode</span> - Try the quiz again!
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Day {dayNumber}</h1>
              <p className="text-lg text-gray-700 mt-2">{dayData.missionTitle}</p>
            </div>
            {/* Difficulty Visualizer */}
            <div className="bg-gray-100 rounded-lg px-3 py-1 text-sm text-gray-600 self-start">
              <span className="mr-1 font-medium">Difficulty:</span>
              {[2, 1, 0].map((diffLevel) => (
                <span key={diffLevel} className={`mx-0.5 ${dayData.difficulty === diffLevel + 1 ? "font-bold text-blue-600" : "text-gray-400"}`}>
                  {(difficultyLabels["ko"] || difficultyLabels["en"])[diffLevel]}
                  {diffLevel > 0 && "/"}
                </span>
              ))}
            </div>
          </div>

          {/* Resources */}
          {dayData.resources?.length > 0 && (
            <div className="mb-8 bg-blue-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">📚 Learning Resources (Click all to unlock next day!)</h2>
              <div className="space-y-2">
                {dayData.resources.map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleResourceClick(idx)}
                    className={`flex items-start gap-3 p-3 rounded-lg hover:shadow-md transition ${clickedResources.has(idx) ? "bg-green-50 border border-green-200" : "bg-white"
                      }`}
                  >
                    <span className="text-2xl">{clickedResources.has(idx) ? "✅" : (resourceIcons[resource.type] || "🔗")}</span>
                    <div>
                      <p className={`font-medium ${clickedResources.has(idx) ? "text-green-800" : "text-blue-600 hover:text-blue-800"}`}>
                        {resource.title}
                      </p>
                      {resource.description && <p className="text-sm text-gray-600">{resource.description}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Steps</h2>
            <ul className="space-y-2">
              {dayData.steps.map((step, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-600 font-bold mr-3">•</span>
                  <span className="text-gray-700">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quiz Section */}
          {!showResult && !isReviewMode ? (
            <form onSubmit={handleSubmitQuiz} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quiz (3 Questions)</h2>

              {dayData.quiz.map((question, idx) => (
                <div key={idx} className="border-l-4 border-blue-600 pl-4">
                  <p className="font-medium text-gray-900 mb-3">Q{idx + 1}: {question.q}</p>
                  {question.type === "mcq" && question.choices ? (
                    <div className="space-y-2">
                      {question.choices.map((choice, cidx) => (
                        <label key={cidx} className="flex items-center cursor-pointer">
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
                    <div>
                      <input
                        type="text"
                        value={userAnswers[idx]}
                        onChange={(e) => {
                          const newAnswers = [...userAnswers];
                          newAnswers[idx] = e.target.value;
                          setUserAnswers(newAnswers);
                        }}
                        placeholder="Enter a single word or short phrase"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">💡 Answer with 1-3 words</p>
                    </div>
                  )}
                </div>
              ))}

              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <button
                type="submit"
                disabled={submitting || clickedResources.size < dayData.resources.length}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg relative group"
              >
                {submitting ? "Grading..." : "Submit Quiz"}
                {clickedResources.size < dayData.resources.length && (
                  <span className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap">
                    ⚠️ Please open all learning resources first
                  </span>
                )}
              </button>
            </form>
          ) : (
            /* Result/Review Display */
            <div className="space-y-6">
              {(currentResult || savedResult) && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {isReviewMode ? "Previous Result" : "Quiz Result"}
                    </h3>
                    <span className={`text-3xl font-bold ${(currentResult || savedResult)!.score >= 3 ? "text-green-600" :
                      (currentResult || savedResult)!.score >= 2 ? "text-yellow-600" : "text-orange-600"
                      }`}>
                      {(currentResult || savedResult)!.score}/3
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{(currentResult || savedResult)!.feedback}</p>

                  {/* Failure Reason */}
                  {!(currentResult || savedResult)!.passed && (
                    <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded text-red-800">
                      <div className="font-bold flex items-center gap-2"><span>🛑</span> Mission Not Complete</div>
                      <ul className="list-disc list-inside mt-1 text-sm space-y-1">
                        {!(currentResult || savedResult)!.passed && (currentResult || savedResult)!.score < 3 && (
                          <li>You need a perfect score (3/3).</li>
                        )}
                        {dayData.resources.length > clickedResources.size && (
                          <li>You must open all learning resources.</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {savedResult?.timestamp && (
                    <p className="text-xs text-gray-500 mt-3">
                      Completed: {new Date(savedResult.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {/* Answer Review */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 Answers</h3>
                <div className="space-y-4">
                  {dayData.quiz.map((question, idx) => {
                    const displayAnswers = isReviewMode || savedResult ? (currentResult || savedResult)!.userAnswers : userAnswers;
                    const isCorrect = isAnswerCorrect(question, displayAnswers[idx]);
                    return (
                      <div key={idx} className={`p-4 rounded-lg border-2 ${isCorrect ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
                        <p className="font-medium text-gray-900 mb-2">Q{idx + 1}: {question.q}</p>
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="font-semibold">Your answer:</span>{" "}
                            <span className={isCorrect ? "text-green-700" : "text-red-700"}>
                              {displayAnswers[idx] || "(no answer)"}
                            </span>
                            {isCorrect ? " ✓" : " ✗"}
                          </p>
                          {!isCorrect && (
                            <p>
                              <span className="font-semibold">Correct answer:</span>{" "}
                              <span className="text-green-700">{question.answer}</span>
                            </p>
                          )}
                          {question.explanation && (
                            <p className="text-gray-600 mt-2 italic">💡 {question.explanation}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => router.push(`/plan?id=${planId}`)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg"
                >
                  Back to Plan
                </button>
                {savedResult && mode !== "doagain" && (
                  <button
                    onClick={() => {
                      setUserAnswers(["", "", ""]);
                      setCurrentResult(null);
                      router.push(`/day/${dayNumber}?planId=${planId}&mode=doagain`);
                    }}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg"
                  >
                    🔄 Do Again
                  </button>
                )}
              </div>

              {/* Next Day Unlock Message - ONLY IF PASSED */}
              {(currentResult || savedResult) && (currentResult || savedResult)!.passed && dayNumber < totalDays && (
                <div className="mt-6 text-center">
                  <p className="text-gray-600 mb-2">Great job! You've completed Day {dayNumber}.</p>
                  <button
                    onClick={() => navigateToDay(dayNumber + 1)}
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg"
                  >
                    🚀 Start Day {dayNumber + 1}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode Switch for completed days (Review/DoAgain) */}
          {savedResult && !showResult && mode !== "doagain" && (
            <div className="mt-6 flex gap-3">
              <Link
                href={`/day/${dayNumber}?planId=${planId}&mode=review`}
                className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg"
              >
                📖 Review Answers
              </Link>
              <Link
                href={`/day/${dayNumber}?planId=${planId}&mode=doagain`}
                className="flex-1 text-center bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg"
              >
                🔄 Do Again
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Helper to check answer correctness with fuzzy matching
function isAnswerCorrect(question: QuizQuestion, userAnswer: string): boolean {
  if (!userAnswer) return false;

  const cleanUser = userAnswer.trim().toLowerCase();
  const cleanCorrect = question.answer.trim().toLowerCase();

  // 1. Direct match
  if (cleanUser === cleanCorrect) return true;

  // 2. MCQ Letter match
  if (question.type === "mcq" && question.choices) {
    const selectedIndex = question.choices.findIndex(c => c.trim().toLowerCase() === cleanUser);
    if (selectedIndex !== -1) {
      const letter = String.fromCharCode(97 + selectedIndex);
      if (letter === cleanCorrect) return true;
    }
  }

  // 3. Substring/Fuzzy match for short answers
  // If user answer contains the correct answer (e.g. "npx create-react-app my-app" contains "npx create-react-app")
  if (cleanUser.includes(cleanCorrect)) return true;
  // If correct answer contains user answer (rare, but possible for partials)
  if (cleanCorrect.includes(cleanUser) && cleanUser.length > 3) return true;

  // 4. Comma-separated list match (e.g. answer "node -v, npm -v" matches user "npm -v")
  if (cleanCorrect.includes(",")) {
    const parts = cleanCorrect.split(",").map(p => p.trim());
    if (parts.some(part => cleanUser.includes(part) || part.includes(cleanUser))) {
      return true;
    }
  }

  return false;
}
