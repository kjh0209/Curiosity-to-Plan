"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { getDictionary, Language } from "@/lib/i18n";

interface Article {
    title: string;
    content: string;
    estimatedMinutes: number;
}

export default function ArticlePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    const dayNumber = params.dayNumber;
    const planId = searchParams.get("planId");

    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [language, setLanguage] = useState<Language>("en");

    // Localization
    const dict = getDictionary(language);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
            return;
        }
        if (status === "loading" || !session) return;

        const fetchArticle = async () => {
            try {
                const userId = (session.user as any).id;

                // Fetch profile language
                const profileRes = await fetch(`/api/profile?userId=${userId}`);
                const profileData = await profileRes.json();
                const userLang = (profileData.profile?.language || "en") as Language;
                setLanguage(userLang);

                const res = await fetch("/api/day/article", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        planId,
                        dayNumber,
                        language: userLang,
                    }),
                });

                if (!res.ok) throw new Error("Failed to load article");

                const data = await res.json();
                setArticle(data);
            } catch (err) {
                setError(String(err));
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [status, session, router, dayNumber, planId]);

    if (loading) {
        return (
            <main className="page-bg flex items-center justify-center">
                <div className="text-center animate-pulse">
                    <div className="h-4 w-48 bg-gray-200 rounded mb-4 mx-auto"></div>
                    <p className="text-[var(--text-secondary)]">{dict.article.writing}</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="page-bg flex items-center justify-center">
                <div className="card p-8 text-center max-w-md">
                    <h1 className="text-xl font-bold mb-2 text-[var(--error)]">{dict.common.error}</h1>
                    <p className="mb-4">{error}</p>
                    <button onClick={() => router.back()} className="btn btn-primary">
                        {dict.common.back}
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="page-bg min-h-screen">
            <div className="container-default py-8 max-w-3xl">
                {/* Navigation */}
                <div className="flex items-center justify-between mb-8">
                    <Link href={`/day/${dayNumber}?planId=${planId}`}>
                        <button className="btn btn-ghost text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {dict.article.backToMission}
                        </button>
                    </Link>
                    <div className="text-sm text-[var(--text-tertiary)]">
                        {article?.estimatedMinutes} {dict.article.minRead}
                    </div>
                </div>

                {/* Article Content */}
                <article className="card p-8 md:p-12 animate-fade-in shadow-sm">
                    <h1 className="text-3xl md:text-4xl font-bold mb-8 text-[var(--text-primary)] leading-tight">
                        {article?.title}
                    </h1>

                    <div className="prose prose-lg dark:prose-invert max-w-none 
                        prose-headings:text-[var(--text-primary)] prose-headings:font-bold
                        prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-p:mb-6
                        prose-strong:text-[var(--text-primary)] prose-strong:font-semibold
                        prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-6
                        prose-li:text-[var(--text-secondary)] prose-li:mb-2
                        prose-a:text-[var(--primary)] prose-a:no-underline hover:prose-a:underline
                        prose-blockquote:border-l-4 prose-blockquote:border-[var(--primary)] prose-blockquote:pl-4 prose-blockquote:italic
                        ">
                        <ReactMarkdown>{article?.content || ""}</ReactMarkdown>
                    </div>
                </article>
            </div>
        </main>
    );
}
