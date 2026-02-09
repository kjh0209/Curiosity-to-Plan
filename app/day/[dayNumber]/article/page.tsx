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
    const [scrollProgress, setScrollProgress] = useState(0);

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

    useEffect(() => {
        const handleScroll = () => {
            const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
            setScrollProgress(progress);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center justify-center p-8 space-y-6">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-2 border-slate-800"></div>
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-500 animate-spin"></div>
                    </div>
                    <div className="text-center">
                        <p className="text-slate-300 font-medium mb-1">{dict.article.writing}</p>
                        <p className="text-slate-500 text-sm">Generating your personalized article...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center max-w-md">
                    <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                        <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold mb-2 text-white">{dict.common.error}</h1>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button onClick={() => router.back()} className="btn btn-primary">
                        {dict.common.back}
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950">
            {/* Progress Bar - Thin, elegant */}
            <div className="fixed top-0 left-0 right-0 h-0.5 bg-slate-900 z-50">
                <div
                    className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-purple-500 transition-all duration-100 ease-out"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

            {/* Floating Navigation Header - Higher z-index to ensure clickability */}
            <header className="fixed top-4 left-4 right-4 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between pointer-events-none">
                    <Link href={`/day/${dayNumber}?planId=${planId}`} className="pointer-events-auto">
                        <button className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all duration-200 cursor-pointer group">
                            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm font-medium">{dict.article.backToMission}</span>
                        </button>
                    </Link>

                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-800 pointer-events-auto">
                        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-slate-300">{article?.estimatedMinutes} {dict.article.minRead}</span>
                    </div>
                </div>
            </header>

            {/* Article Container */}
            <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
                {/* Article Header */}
                <header className="mb-16 animate-fade-in">
                    {/* Meta Tags */}
                    <div className="flex items-center gap-3 mb-8">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-sky-500/10 text-sky-400 text-xs font-semibold uppercase tracking-wider border border-sky-500/20">
                            Day {dayNumber}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 text-sm">{article?.estimatedMinutes} min read</span>
                    </div>

                    {/* Title - Editorial Typography */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-8">
                        {article?.title}
                    </h1>

                    {/* Divider */}
                    <div className="w-20 h-1 bg-gradient-to-r from-sky-500 to-purple-500 rounded-full"></div>
                </header>

                {/* Article Content - Premium Blog Typography */}
                <article className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="
                        prose prose-lg prose-invert max-w-none
                        
                        /* Headings - Clear hierarchy */
                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-white
                        prose-h1:text-4xl prose-h1:mt-16 prose-h1:mb-8
                        prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-6 prose-h2:pt-8 prose-h2:border-t prose-h2:border-slate-800
                        prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-slate-200
                        prose-h4:text-lg prose-h4:mt-8 prose-h4:mb-3 prose-h4:text-slate-300
                        
                        /* Paragraphs - Optimal reading */
                        prose-p:text-slate-300 prose-p:text-lg prose-p:leading-[1.8] prose-p:mb-6
                        
                        /* Strong/Bold */
                        prose-strong:text-white prose-strong:font-semibold
                        
                        /* Links */
                        prose-a:text-sky-400 prose-a:font-medium prose-a:no-underline prose-a:border-b prose-a:border-sky-400/30 hover:prose-a:border-sky-400 prose-a:transition-colors
                        
                        /* Lists - Clean and readable */
                        prose-ul:my-8 prose-ul:pl-0
                        prose-ol:my-8 prose-ol:pl-0
                        prose-li:text-slate-300 prose-li:text-lg prose-li:leading-[1.7] prose-li:mb-3 prose-li:pl-8 prose-li:relative
                        
                        /* Blockquotes - Editorial style */
                        prose-blockquote:border-l-2 prose-blockquote:border-sky-500 prose-blockquote:pl-6 prose-blockquote:py-1 prose-blockquote:my-10 prose-blockquote:not-italic
                        prose-blockquote:text-slate-200 prose-blockquote:text-xl prose-blockquote:leading-relaxed prose-blockquote:font-normal
                        
                        /* Code - Inline */
                        prose-code:text-sky-300 prose-code:bg-slate-800/60 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[0.9em] prose-code:font-mono
                        prose-code:before:content-none prose-code:after:content-none
                        
                        /* Code - Blocks */
                        prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:my-10 prose-pre:p-6 prose-pre:overflow-x-auto
                        
                        /* Horizontal Rule */
                        prose-hr:border-slate-800 prose-hr:my-16
                        
                        /* Images */
                        prose-img:rounded-xl prose-img:shadow-2xl prose-img:my-12
                        
                        /* Tables */
                        prose-table:my-10 prose-table:w-full
                        prose-th:text-left prose-th:text-slate-200 prose-th:font-semibold prose-th:pb-4 prose-th:border-b prose-th:border-slate-700
                        prose-td:py-3 prose-td:text-slate-400 prose-td:border-b prose-td:border-slate-800
                    ">
                        <ReactMarkdown>{article?.content || ""}</ReactMarkdown>
                    </div>
                </article>

                {/* Footer */}
                <footer className="mt-20 pt-10 border-t border-slate-800 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="text-center sm:text-left">
                            <p className="text-slate-500 text-sm mb-1">Finished reading?</p>
                            <p className="text-slate-300 font-medium">Continue to your mission tasks</p>
                        </div>
                        <Link href={`/day/${dayNumber}?planId=${planId}`}>
                            <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white font-medium transition-all duration-200 cursor-pointer group">
                                <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                {dict.article.backToMission}
                            </button>
                        </Link>
                    </div>
                </footer>
            </div>
        </main>
    );
}
