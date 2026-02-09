"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";


interface Slide {
    title: string;
    content: string[];
    speakerNotes?: string;
    layout: "title" | "bullets" | "code" | "conclusion" | "image" | "split";
    code?: string;
    language?: string;
    imageQuery?: string;
    keyTakeaway?: string;
}

import { getDictionary, Language } from "@/lib/i18n";

// ... imports

export default function SlidePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session, status } = useSession();

    const dayNumber = params.dayNumber;
    const planId = searchParams.get("planId");

    const [slides, setSlides] = useState<Slide[]>([]);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");
    const [language, setLanguage] = useState<Language>("en");
    const [slideImages, setSlideImages] = useState<Record<number, { url: string; credit: string; creditUrl: string }>>({});

    // Localization
    const dict = getDictionary(language);

    // This useEffect is now solely for handling authentication redirection.
    // The language setting logic is moved to the slide generation useEffect.
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
            return;
        }
        if (status === "loading" || !session || !planId || !dayNumber) return;

        const generateSlides = async () => {
            try {
                const userId = (session.user as any).id;

                // 1. Fetch USER's current language from profile (most up-to-date)
                const userRes = await fetch(`/api/profile?userId=${userId}`);
                const userData = await userRes.json();
                const userLang = userData.profile?.language as Language || "en";
                setLanguage(userLang);

                // 2. Fetch Plan & Day Data
                const planRes = await fetch(`/api/plans/${planId}?userId=${userId}`);
                const planData = await planRes.json();

                if (!planData.plan) throw new Error("Plan not found");

                const day = planData.plan.days.find((d: any) => d.dayNumber === Number(dayNumber));
                if (!day) throw new Error("Day not found");

                const topic = day.missionTitle;
                const missionTitle = day.missionTitle;

                // 3. Check Cache - use USER's current language, not plan language
                const cacheKey = `slides_${planId}_${dayNumber}_${userLang}`;
                const cachedSlides = localStorage.getItem(cacheKey);

                if (cachedSlides) {
                    // Validate cache is for current language
                    const cached = JSON.parse(cachedSlides);
                    setSlides(cached);
                    setLoading(false);
                    return;
                }

                // 4. Generate Slides with user's CURRENT language
                setGenerating(true);
                console.log(`Generating slides for Day ${dayNumber} in ${userLang}...`);

                const res = await fetch("/api/slides/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        topic,
                        missionTitle,
                        level: (session.user as any).baselineLevel || "BEGINNER",
                        language: userLang, // Use user's current language
                        planId,
                        dayNumber
                    })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || "Failed to generate slides");
                }

                const data = await res.json();
                setSlides(data.slides);
                localStorage.setItem(cacheKey, JSON.stringify(data.slides));

            } catch (err) {
                console.error(err);
                setError("Failed to create AI Tutor session");
            } finally {
                setLoading(false);
                setGenerating(false);
            }
        };

        generateSlides();
    }, [status, session, planId, dayNumber, router]);

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(c => c + 1);
    };

    const prevSlide = () => {
        if (currentSlide > 0) setCurrentSlide(c => c - 1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight") nextSlide();
        if (e.key === "ArrowLeft") prevSlide();
    };

    // Fetch images for image layout slides
    useEffect(() => {
        if (!slides.length) return;

        const fetchImages = async () => {
            for (let i = 0; i < slides.length; i++) {
                const slide = slides[i];
                if (slide.layout === "image" && slide.imageQuery && !slideImages[i]) {
                    try {
                        const res = await fetch(`/api/images/search?query=${encodeURIComponent(slide.imageQuery)}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.images?.[0]) {
                                setSlideImages(prev => ({
                                    ...prev,
                                    [i]: {
                                        url: data.images[0].url,
                                        credit: data.images[0].credit,
                                        creditUrl: data.images[0].creditUrl
                                    }
                                }));
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch image for slide", i, e);
                    }
                }
            }
        };

        fetchImages();
    }, [slides]);

    if (loading || generating) {
        return (
            <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
                <div className="relative w-20 h-20 mb-8">
                    <div className="absolute inset-0 rounded-full border-t-4 border-blue-500 animate-spin"></div>
                    <div className="absolute inset-2 rounded-full border-r-4 border-purple-500 animate-spin-reverse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-2 animate-pulse">{dict.slide.loadingTitle}</h2>
                <p className="text-gray-400">{dict.slide.loadingSubtitle}</p>
                <style jsx>{`
                    @keyframes spin-reverse {
                        to { transform: rotate(-360deg); }
                    }
                    .animate-spin-reverse {
                        animation: spin-reverse 1s linear infinite;
                    }
                `}</style>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h2 className="text-2xl font-bold mb-2">Error</h2>
                <p className="text-gray-400 mb-6">{error}</p>
                <Link href={`/day/${dayNumber}?planId=${planId}`} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                    {dict.slide.exit}
                </Link>
            </main>
        );
    }

    // ... error state (use dict if generic, but error message is from state)

    const slide = slides[currentSlide];

    return (
        <main
            className="min-h-screen bg-[#111] text-white overflow-hidden flex flex-col"
            onKeyDown={handleKeyDown}
            tabIndex={0}
            autoFocus
        >
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-black/50 backdrop-blur-md border-b border-white/5">
                <Link href={`/day/${dayNumber}?planId=${planId}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition group">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <span className="hidden sm:inline font-medium">{dict.slide.exit}</span>
                </Link>
                <div className="px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700 text-sm font-medium text-gray-300">
                    <span className="text-blue-400">{currentSlide + 1}</span>
                    <span className="mx-1 opacity-50">/</span>
                    <span>{slides.length}</span>
                </div>
            </header>

            {/* Slide Content */}
            <div className="flex-1 flex items-center justify-center p-4 md:p-12 relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, x: 50, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -50, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="w-full max-w-4xl aspect-video bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col"
                    >
                        {/* Slide Decoration */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                        <div className="flex-1 p-12 flex flex-col justify-center">
                            {/* ... existing layouts ... */}
                            {slide.layout === "title" && (
                                <div className="text-center">
                                    <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6 leading-tight">
                                        {slide.title}
                                    </h1>
                                    <div className="h-1 w-24 bg-blue-500 mx-auto mb-8 rounded-full"></div>
                                    <div className="text-xl text-gray-400 max-w-2xl mx-auto space-y-2">
                                        {slide.content.map((item, i) => (
                                            <p key={i}>{item}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {slide.layout === "bullets" && (
                                <div>
                                    <h2 className="text-4xl font-bold text-white mb-8 border-b border-gray-800 pb-4 inline-block pr-12">
                                        {slide.title}
                                    </h2>
                                    <ul className="space-y-6">
                                        {slide.content.map((item, i) => (
                                            <motion.li
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 + 0.3 }}
                                                className="flex items-start gap-4 text-xl md:text-2xl text-gray-300"
                                            >
                                                <span className="w-2 h-2 rounded-full bg-blue-500 mt-3 flex-shrink-0" />
                                                <span>{item}</span>
                                            </motion.li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {slide.layout === "code" && (
                                <div className="h-full flex flex-col">
                                    <h2 className="text-3xl font-bold text-white mb-6">
                                        {slide.title}
                                    </h2>
                                    <div className="flex-1 flex gap-6 min-h-0">
                                        <div className="w-1/3 text-gray-300 text-lg space-y-4 pt-4">
                                            {slide.content.map((item, i) => (
                                                <p key={i}>{item}</p>
                                            ))}
                                        </div>
                                        <div className="w-2/3 bg-[#1e1e1e] rounded-xl p-6 overflow-auto font-mono text-sm border border-gray-700 shadow-inner">
                                            <pre className="text-blue-300">
                                                <code>{slide.code || "// No code example"}</code>
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {slide.layout === "conclusion" && (
                                <div className="text-center">
                                    <h2 className="text-4xl font-bold text-white mb-8">{dict.slide.summary}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-3xl mx-auto">
                                        {slide.content.map((item, i) => (
                                            <div key={i} className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                                                <span className="text-blue-400 font-bold mr-2">✓</span>
                                                <span className="text-gray-200 text-lg">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* New: Image Layout */}
                            {slide.layout === "image" && (
                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    <div className="md:w-1/2">
                                        <h2 className="text-3xl font-bold text-white mb-6">{slide.title}</h2>
                                        <div className="space-y-4 text-gray-300 text-lg">
                                            {slide.content.map((item, i) => (
                                                <p key={i}>{item}</p>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="md:w-1/2 flex items-center justify-center">
                                        {slideImages[currentSlide]?.url ? (
                                            <div className="rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
                                                <img
                                                    src={slideImages[currentSlide].url}
                                                    alt={slide.imageQuery || slide.title}
                                                    className="max-h-[400px] object-cover"
                                                />
                                                {slideImages[currentSlide].credit && (
                                                    <div className="bg-black/80 px-3 py-1 text-xs text-gray-400 text-center">
                                                        Photo by <a href={slideImages[currentSlide].creditUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{slideImages[currentSlide].credit}</a>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-2xl p-8 border border-gray-700 text-center animate-pulse">
                                                <div className="text-4xl mb-4">🔍</div>
                                                <p className="text-gray-400 text-sm">{dict.common.loading}...</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* New: Split Layout (Comparison) */}
                            {slide.layout === "split" && (
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-8 text-center">{slide.title}</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        {slide.content.length >= 2 && (
                                            <>
                                                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 p-6 rounded-xl border border-blue-700/50">
                                                    <div className="text-blue-400 font-semibold mb-4 text-lg">
                                                        {slide.content[0]}
                                                    </div>
                                                    {slide.content.slice(2).filter((_, i) => i % 2 === 0).map((item, i) => (
                                                        <div key={i} className="text-gray-300 mt-3 flex items-start gap-2">
                                                            <span className="text-blue-400">•</span>
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 p-6 rounded-xl border border-purple-700/50">
                                                    <div className="text-purple-400 font-semibold mb-4 text-lg">
                                                        {slide.content[1]}
                                                    </div>
                                                    {slide.content.slice(2).filter((_, i) => i % 2 === 1).map((item, i) => (
                                                        <div key={i} className="text-gray-300 mt-3 flex items-start gap-2">
                                                            <span className="text-purple-400">•</span>
                                                            <span>{item}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Speaker Notes */}
                        {slide.speakerNotes && (
                            <div className="absolute bottom-4 right-4 group">
                                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 cursor-help border border-gray-700">
                                    ?
                                </div>
                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 p-4 rounded-lg border border-gray-700 text-sm text-gray-300 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                                    <p className="font-semibold mb-1 text-blue-400">{dict.slide.tutorNotes}</p>
                                    {slide.speakerNotes}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="p-8 flex justify-center gap-6 z-10">
                <button
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                    className="p-4 rounded-full bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 transition"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                    onClick={nextSlide}
                    disabled={currentSlide === slides.length - 1}
                    className="p-4 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 transition shadow-lg shadow-blue-900/50"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </main>
    );
}
