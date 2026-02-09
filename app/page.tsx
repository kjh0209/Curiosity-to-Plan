"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getDictionary, Language } from "@/lib/i18n";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("en");

  // Fetch profile language when logged in, otherwise default to English
  useEffect(() => {
    if (status === "loading") return;

    if (session) {
      // User is logged in - fetch their profile language
      const fetchProfileLanguage = async () => {
        try {
          const userId = (session.user as any).id;
          const res = await fetch(`/api/profile?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.profile?.language) {
              setLanguage(data.profile.language as Language);
            }
          }
        } catch (err) {
          console.error("Failed to fetch profile language", err);
        }
      };
      fetchProfileLanguage();
    } else {
      // User is not logged in - always use English
      setLanguage("en");
    }
  }, [session, status]);

  const dict = getDictionary(language);

  const handleStart = () => {
    if (status === "loading") return;
    if (session) {
      router.push("/new-plan"); // Redirect to plan creation flow
    } else {
      router.push("/auth/login");
    }
  };

  return (
    <main className="page-bg-gradient min-h-screen relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-sky-500/10 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] -z-10" />

      {/* Hero Section */}
      <section className="container-default pt-40 pb-24 md:pt-48 md:pb-32 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sky-400 text-sm font-medium mb-8 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </span>
          {dict.landing.heroTag}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 tracking-tight leading-tight"
        >
          {dict.landing.heroTitle1} <br />
          <span className="text-gradient">{dict.landing.heroTitle2}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          {dict.landing.heroDesc}
        </motion.p>

        <button
          onClick={handleStart}
          disabled={status === "loading"}
          className="btn btn-primary h-14 px-8 text-lg font-bold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 relative overflow-hidden group w-full sm:w-auto disabled:opacity-70 disabled:cursor-wait"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span className="relative">{dict.landing.startBtn}</span>
        </button>
      </section>

      {/* Features Grid */}
      <section className="container-default py-24 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{dict.landing.featuresTitle}</h2>
          <p className="text-slate-400 text-lg">{dict.landing.featuresDesc}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="glass-card p-8 rounded-2xl border border-slate-700/50 hover:border-sky-500/30 transition-colors duration-300 group">
            <div className="w-14 h-14 bg-sky-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{dict.landing.feature1Title}</h3>
            <p className="text-slate-400 leading-relaxed">
              {dict.landing.feature1Desc}
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-card p-8 rounded-2xl border border-slate-700/50 hover:border-purple-500/30 transition-colors duration-300 group">
            <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{dict.landing.feature2Title}</h3>
            <p className="text-slate-400 leading-relaxed">
              {dict.landing.feature2Desc}
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-card p-8 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 transition-colors duration-300 group">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3 text-white">{dict.landing.feature3Title}</h3>
            <p className="text-slate-400 leading-relaxed">
              {dict.landing.feature3Desc}
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container-default py-24 border-t border-slate-800/50">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{dict.landing.howItWorksTitle}</h2>
        </div>

        <div className="relative">
          {/* Connector Line */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-sky-500/0 via-sky-500/20 to-sky-500/0 hidden md:block -translate-y-1/2"></div>

          <div className="grid md:grid-cols-4 gap-8 relative z-10">
            {[
              { step: "01", title: dict.landing.step1Title, desc: dict.landing.step1Desc },
              { step: "02", title: dict.landing.step2Title, desc: dict.landing.step2Desc },
              { step: "03", title: dict.landing.step3Title, desc: dict.landing.step3Desc },
              { step: "04", title: dict.landing.step4Title, desc: dict.landing.step4Desc }
            ].map((item, i) => (
              <div key={i} className="glass-card p-6 rounded-xl border border-slate-700/50 text-center bg-slate-900/80">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-bold mx-auto mb-4 relative z-10">
                  {item.step}
                </div>
                <h3 className="font-bold text-lg mb-2 text-white">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-slate-500 text-sm border-t border-slate-800/50">
        &copy; {new Date().getFullYear()} SkillLoop. All rights reserved.
      </footer>
    </main >
  );
}
