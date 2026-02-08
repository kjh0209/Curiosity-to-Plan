"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoIcon } from "@/components/Logo";

interface FeedbackItem {
    id: string;
    contentRating: number;
    difficultyRating: number;
    resourceRating: number;
    textFeedback: string | null;
    createdAt: string;
    dayPlan?: {
        dayNumber: number;
        missionTitle: string;
    };
}

interface FeedbackStats {
    avgContent: number;
    avgDifficulty: number;
    avgResource: number;
    total: number;
}

export default function FeedbackPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [stats, setStats] = useState<FeedbackStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [generalFeedback, setGeneralFeedback] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
            return;
        }
        if (status === "loading" || !session) return;

        loadFeedback();
    }, [status, session, router]);

    const loadFeedback = async () => {
        try {
            if (!session?.user) return;
            const userId = (session.user as any).id;
            const res = await fetch(`/api/feedback?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data.feedbacks);
                setStats(data.stats);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitGeneralFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!generalFeedback.trim()) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: (session?.user as any).id,
                    dayPlanId: null, // Global feedback
                    contentRating: 5, // Default for general feedback if not specified
                    difficultyRating: 3,
                    resourceRating: 3,
                    textFeedback: `[Global] ${generalFeedback}`,
                }),
            });

            if (res.ok) {
                setGeneralFeedback("");
                setSuccessMsg("Thank you for your feedback!");
                setTimeout(() => setSuccessMsg(""), 3000);
                loadFeedback();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    // Simple translations
    const t: any = {
        en: {
            title: "Feedback & History",
            back: "Back to Home",
            totalReviews: "Total Reviews",
            avgContent: "Avg Content",
            avgDifficulty: "Avg Difficulty",
            avgResources: "Avg Resources",
            sendHeader: "Send General Feedback",
            placeholder: "Tell us what you think about SkillLoop...",
            submit: "Send Feedback",
            sending: "Sending...",
            recent: "Recent Feedback",
            noHistory: "No feedback history yet.",
            day: "Day",
            global: "Global",
            success: "Thank you for your feedback!",
            content: "Content",
            difficulty: "Difficulty",
            resources: "Resources"
        },
        ko: {
            title: "피드백 및 기록",
            back: "홈으로 돌아가기",
            totalReviews: "총 리뷰 수",
            avgContent: "콘텐츠 평점",
            avgDifficulty: "난이도 평점",
            avgResources: "자료 평점",
            sendHeader: "일반 피드백 보내기",
            placeholder: "SkillLoop에 대한 의견을 자유롭게 적어주세요...",
            submit: "피드백 보내기",
            sending: "전송 중...",
            recent: "최근 피드백",
            noHistory: "아직 피드백 기록이 없습니다.",
            day: "Day",
            global: "전체",
            success: "피드백 감사합니다!",
            content: "콘텐츠",
            difficulty: "난이도",
            resources: "자료"
        }
    };

    // Default to English if language not found
    const lang = (session?.user as any)?.language || "en";
    const text = t[lang] || t["en"];

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <main className="min-h-screen page-bg p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <LogoIcon size={32} />
                        </Link>
                        <h1 className="text-2xl font-bold">{text.title}</h1>
                    </div>
                    <Link href="/" className="btn btn-ghost">{text.back}</Link>
                </header>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="card p-4 text-center">
                            <p className="text-sm text-[var(--text-secondary)]">{text.totalReviews}</p>
                            <p className="text-3xl font-bold text-[var(--primary)]">{stats.total}</p>
                        </div>
                        <div className="card p-4 text-center">
                            <p className="text-sm text-[var(--text-secondary)]">{text.avgContent}</p>
                            <p className="text-3xl font-bold">{stats.avgContent.toFixed(1)}</p>
                        </div>
                        <div className="card p-4 text-center">
                            <p className="text-sm text-[var(--text-secondary)]">{text.avgDifficulty}</p>
                            <p className="text-3xl font-bold">{stats.avgDifficulty.toFixed(1)}</p>
                        </div>
                        <div className="card p-4 text-center">
                            <p className="text-sm text-[var(--text-secondary)]">{text.avgResources}</p>
                            <p className="text-3xl font-bold">{stats.avgResource.toFixed(1)}</p>
                        </div>
                    </div>
                )}

                {/* General Feedback Form */}
                <div className="card p-6">
                    <h2 className="text-xl font-semibold mb-4">{text.sendHeader}</h2>
                    <form onSubmit={handleSubmitGeneralFeedback}>
                        <textarea
                            className="w-full p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] focus:border-[var(--primary)] outline-none min-h-[100px]"
                            placeholder={text.placeholder}
                            value={generalFeedback}
                            onChange={(e) => setGeneralFeedback(e.target.value)}
                        />
                        <div className="flex justify-end mt-4 items-center gap-4">
                            {successMsg && <span className="text-[var(--success)]">{text.success}</span>}
                            <button
                                type="submit"
                                disabled={submitting || !generalFeedback.trim()}
                                className="btn btn-primary"
                            >
                                {submitting ? text.sending : text.submit}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Feedback History */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">{text.recent}</h2>
                    {feedbacks.length === 0 ? (
                        <p className="text-[var(--text-tertiary)]">{text.noHistory}</p>
                    ) : (
                        feedbacks.map((item) => (
                            <div key={item.id} className="card p-4 flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        {item.dayPlan ? (
                                            <span className="badge badge-primary">{text.day} {item.dayPlan.dayNumber}</span>
                                        ) : (
                                            <span className="badge bg-gray-600 text-white">{text.global}</span>
                                        )}
                                        <span className="text-sm text-[var(--text-tertiary)]">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {item.dayPlan && (
                                        <p className="font-medium mb-2">{item.dayPlan.missionTitle}</p>
                                    )}
                                    {item.textFeedback && (
                                        <p className="text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-3 rounded">
                                            "{item.textFeedback}"
                                        </p>
                                    )}
                                </div>
                                <div className="flex md:flex-col gap-4 md:gap-2 text-sm text-[var(--text-secondary)] min-w-[140px]">
                                    <div className="flex justify-between">
                                        <span>{text.content}</span>
                                        <span className="font-bold">{item.contentRating}/5</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{text.difficulty}</span>
                                        <span className="font-bold">{item.difficultyRating}/5</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>{text.resources}</span>
                                        <span className="font-bold">{item.resourceRating}/5</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}
