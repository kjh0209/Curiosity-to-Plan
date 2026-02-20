"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

const features = [
  { name: "Plans per day", free: "3", pro: "5" },
  { name: "Days openable per day", free: "1", pro: "3" },
  { name: "AI Model", free: "Gemini Flash", pro: "GPT-4o Mini" },
  { name: "AI Tokens / month", free: "7,000", pro: "1,500,000" },
  { name: "Response speed", free: "Standard", pro: "Fast" },
  { name: "All learning features", free: "✓", pro: "✓" },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!session?.user) {
      window.location.href = "/auth/login";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: (session.user as any).id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-bg-gradient min-h-screen flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px]" />
      </div>

      <header className="relative z-10 p-4 md:p-6">
        <Logo size="md" />
      </header>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Start learning for free. Upgrade to Pro for faster AI, more plans, and unlimited day access.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          {/* Free Plan */}
          <div className="glass-card p-8 rounded-2xl border border-slate-700/50">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Free</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-slate-400">/month</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">Get started with AI-powered learning</p>
            </div>
            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f.name} className="flex justify-between text-sm">
                  <span className="text-slate-400">{f.name}</span>
                  <span className="text-white font-medium">{f.free}</span>
                </li>
              ))}
            </ul>
            <Link href={session ? "/plans" : "/auth/register"}>
              <button className="w-full py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors font-medium">
                {session ? "Current Plan" : "Get Started"}
              </button>
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="glass-card p-8 rounded-2xl border-2 border-amber-500/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-amber-500 text-black text-xs font-bold px-4 py-1 rounded-bl-lg">
              RECOMMENDED
            </div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-amber-400 mb-1">Pro</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$12</span>
                <span className="text-slate-400">/month</span>
              </div>
              <p className="text-sm text-slate-400 mt-2">Unlock your full learning potential</p>
            </div>
            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f.name} className="flex justify-between text-sm">
                  <span className="text-slate-400">{f.name}</span>
                  <span className="text-amber-400 font-medium">{f.pro}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                "Upgrade to Pro"
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-8 text-center max-w-md">
          Payments are processed securely via Stripe. You can cancel your subscription at any time from your profile settings.
        </p>
      </div>
    </main>
  );
}
