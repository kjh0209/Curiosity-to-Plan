"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!loading) return;

    const estimatedTime = totalDays <= 20 ? 15000 : totalDays * 1200; // Longer estimate for deep generation
    const interval = 200;
    const increment = (100 / (estimatedTime / interval)) * 0.9;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return Math.min(prev + increment, 90);
      });
    }, interval);

    const messages = [
      "🔍 Analyzing your learning goals...",
      "📚 Developing sequential curriculum...",
      "📅 Mapping out daily progression...",
      "🎯 Connecting milestones to your target...",
      "✨ Generating unique daily titles...",
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
    setProgressMessage("🚀 Initiating deep curriculum generation...");

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
      setProgressMessage("✅ Detailed plan generated successfully!");

      const data = await response.json();
      await new Promise(resolve => setTimeout(resolve, 800));
      router.push("/plan?id=" + data.plan.id);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  if (status === "loading") return <main className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></main>;
  if (!session) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="SkillLoop Logo" width={40} height={40} className="rounded-lg" />
            <span className="text-xl font-bold text-gray-900">SkillLoop</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/plans" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              My Plans
            </Link>
            <button onClick={() => signOut()} className="text-sm text-red-600 hover:text-red-700">Logout</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Your Mastering Journey</h1>
          <p className="text-gray-600 mb-6">Design a deep, sequential curriculum tailored to your ultimate goal.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What do you want to master?</label>
              <input type="text" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g., Quantum Physics, Electric Guitar, React.js" required disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">What is your specific goal?</label>
              <textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g., I want to be able to play 'Sultans of Swing' perfectly from memory." required rows={2} disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Time: <span className="font-bold text-blue-600">{minutesPerDay}m</span></label>
                <input type="range" min={5} max={120} step={5} value={minutesPerDay} onChange={(e) => setMinutesPerDay(parseInt(e.target.value))} disabled={loading} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Duration: <span className="font-bold text-blue-600">{totalDays}d</span></label>
                <input type="range" min={7} max={100} step={1} value={totalDays} onChange={(e) => setTotalDays(parseInt(e.target.value))} disabled={loading} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en">English</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Sort Preference</label>
                <select value={resourceSort} onChange={(e) => setResourceSort(e.target.value)} disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="relevance">Most Relevant</option>
                  <option value="viewCount">Most Viewed</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
                <select value={baselineLevel} onChange={(e) => setBaselineLevel(e.target.value)} disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Style</label>
                <select value={riskStyle} onChange={(e) => setRiskStyle(e.target.value)} disabled={loading} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="CONSERVATIVE">Conservative</option>
                  <option value="BALANCED">Balanced</option>
                  <option value="CHALLENGER">Challenger</option>
                </select>
              </div>
            </div>

            {loading && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{progressMessage}</span>
                  <span className="font-semibold text-blue-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition text-lg">
              {loading ? "Generating Deep Curriculum..." : `Generate ${totalDays}-Day Mastery Plan`}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
