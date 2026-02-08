"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface TraceLog {
    id: string;
    traceId: string;
    traceName: string;
    createdAt: string;
}

export default function ObservabilityPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [traces, setTraces] = useState<TraceLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
            return;
        }

        if (status === "loading" || !session) return;

        const loadTraces = async () => {
            try {
                const response = await fetch("/api/traces");
                if (response.ok) {
                    const data = await response.json();
                    setTraces(data.traces || []);
                }
            } catch (err) {
                console.error("Failed to load traces:", err);
            } finally {
                setLoading(false);
            }
        };

        loadTraces();
    }, [router, session, status]);

    // Opik project URL for future use
    // const opikProjectUrl = `https://www.comet.com/${process.env.NEXT_PUBLIC_OPIK_WORKSPACE_NAME || "your-workspace"}/opik/projects?name=${process.env.NEXT_PUBLIC_OPIK_PROJECT_NAME || "skillloop"}`;

    if (status === "loading" || loading) {
        return (
            <main className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Loading...</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="SkillLoop Logo" width={40} height={40} className="rounded-lg" />
                        <h1 className="text-3xl font-bold text-gray-900">📊 Opik Observability</h1>
                    </div>
                    <Link href="/" className="text-blue-600 hover:text-blue-700">
                        ← Back to App
                    </Link>
                </div>

                {/* Opik Dashboard Link */}
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-6 text-white mb-8">
                    <h2 className="text-2xl font-bold mb-2">Opik Dashboard</h2>
                    <p className="mb-4 opacity-90">
                        View all LLM traces, spans, and performance metrics in the Opik dashboard.
                    </p>
                    <a
                        href="https://www.comet.com/opik"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block bg-white text-indigo-600 font-semibold px-6 py-2 rounded-lg hover:bg-gray-100 transition"
                    >
                        Open Opik Dashboard →
                    </a>
                </div>

                {/* How Opik is Used */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 How SkillLoop Uses Opik</h2>

                    <div className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">1. LLM Tracing</h3>
                            <p className="text-gray-600 mb-2">
                                Every LLM call in SkillLoop is traced using Opik. This includes:
                            </p>
                            <ul className="list-disc list-inside text-gray-600 ml-4 space-y-1">
                                <li><strong>generate_plan</strong> - Creating personalized learning plans</li>
                                <li><strong>generate_day_mission</strong> - Generating daily missions and quizzes</li>
                                <li><strong>grade_quiz</strong> - Grading quiz answers with AI</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">2. Trace Structure</h3>
                            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                                <pre className="text-gray-700">{`// Example trace structure
const trace = opik.trace({
  name: "generate_plan",
  input: { interest, goal, minutesPerDay },
  metadata: { model: "gpt-4o-mini" }
});

// Create span for LLM call
const span = trace.span({
  name: "SkillGraphBuilder",
  type: "llm",
  input: { prompt },
  output: { response }
});

span.end();
trace.end();
await opik.flush();`}</pre>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">3. What's Logged</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <h4 className="font-semibold text-blue-900 mb-2">Input</h4>
                                    <ul className="text-sm text-blue-800 space-y-1">
                                        <li>• User interest & goal</li>
                                        <li>• Settings (minutes, days)</li>
                                        <li>• Prompt content</li>
                                    </ul>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4">
                                    <h4 className="font-semibold text-green-900 mb-2">Output</h4>
                                    <ul className="text-sm text-green-800 space-y-1">
                                        <li>• Generated plan/mission</li>
                                        <li>• Quiz questions</li>
                                        <li>• Grading results</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">4. Metadata Tracked</h3>
                            <div className="flex flex-wrap gap-2">
                                {["model", "latency_ms", "dayNumber", "difficulty", "totalDays", "riskStyle", "baselineLevel"].map(tag => (
                                    <span key={tag} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Evaluation Guide */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">📈 LLM Evaluation with Opik</h2>

                    <div className="space-y-4">
                        <p className="text-gray-600">
                            SkillLoop includes evaluation scripts to test and improve LLM outputs:
                        </p>

                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="font-semibold text-gray-900 mb-2">Running Evaluations</h3>
                            <div className="font-mono text-sm bg-gray-800 text-green-400 p-3 rounded">
                                npx tsx scripts/opik_eval_plan.ts
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Evaluation Metrics</h3>
                            <ul className="space-y-2">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    <div>
                                        <strong>IsJson</strong> - Validates that outputs are valid JSON
                                    </div>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    <div>
                                        <strong>Usefulness</strong> - LLM-as-judge metric for output quality
                                    </div>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500">✓</span>
                                    <div>
                                        <strong>TimeBudgetFit</strong> - Custom metric to check if plan fits time constraints
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Environment Setup */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">⚙️ Environment Configuration</h2>

                    <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                        <pre className="text-gray-700">{`# .env.local
OPIK_API_KEY=your-opik-api-key
OPIK_PROJECT_NAME=skillloop
OPIK_WORKSPACE_NAME=your-workspace
OPIK_URL_OVERRIDE=https://www.comet.com/opik/api`}</pre>
                    </div>

                    <p className="mt-4 text-gray-600 text-sm">
                        Get your API key from <a href="https://www.comet.com/opik" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">comet.com/opik</a>
                    </p>
                </div>

                {/* Recent Traces */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">🕐 Recent Traces</h2>

                    {traces.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            No traces recorded yet. Generate a plan or complete a quiz to see traces here.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {traces.map((trace) => (
                                <div key={trace.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <span className="font-medium text-gray-900">{trace.traceName}</span>
                                        <span className="text-gray-500 text-sm ml-2">
                                            {new Date(trace.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <code className="text-xs bg-gray-200 px-2 py-1 rounded">
                                        {trace.traceId.substring(0, 12)}...
                                    </code>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
