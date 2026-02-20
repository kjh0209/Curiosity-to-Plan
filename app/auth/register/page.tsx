"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { getDictionary, Language, getInitialLanguage } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [lang] = useState<Language>(() => getInitialLanguage());

  const dict = getDictionary(lang);
  const a = dict.auth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(a.passwordsMismatch);
      return;
    }

    if (password.length < 6) {
      setError(a.passwordTooShort);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      if (data.requiresVerification) {
        setSuccess(true);
      } else {
        router.push("/auth/login?registered=true");
      }
    } catch (err) {
      setError(String(err).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    signIn("google", { callbackUrl: "/" });
  };

  if (success) {
    return (
      <main className="page-bg-gradient min-h-screen flex flex-col">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px]" />
        </div>
        <header className="relative z-10 p-4 md:p-6">
          <Logo size="md" />
        </header>
        <div className="relative z-10 flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="glass-card p-8 md:p-10 rounded-2xl border border-slate-700/50 shadow-2xl text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sky-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">{a.checkEmail}</h2>
              <p className="text-slate-400 mb-6">
                {a.verificationSentTo} <span className="text-white font-medium">{email}</span>.
                {" "}{a.clickLinkToVerify}
              </p>
              <p className="text-xs text-slate-500 mb-6">
                {a.linkExpires}
              </p>
              <Link href="/auth/login?registered=true">
                <button className="btn btn-primary w-full py-3">
                  {a.goToSignIn}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg-gradient min-h-screen flex flex-col">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px]" />
      </div>

      <header className="relative z-10 p-4 md:p-6">
        <Logo size="md" />
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          <div className="glass-card p-8 md:p-10 rounded-2xl border border-slate-700/50 shadow-2xl shadow-purple-900/10">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">{a.registerTitle}</h1>
              <p className="text-slate-400">
                {a.registerSubtitle}
              </p>
            </div>

            {/* Google Sign Up */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-gray-800 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {googleLoading ? (
                <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              {a.continueWithGoogle}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700/50"></div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">{a.or}</span>
              <div className="flex-1 h-px bg-slate-700/50"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{a.nameLabel}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={a.namePlaceholder}
                  required
                  disabled={loading}
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{a.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{a.passwordLabel}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={a.passwordPlaceholderRegister}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">{a.confirmPasswordLabel}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={a.confirmPasswordPlaceholder}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors outline-none"
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3.5 text-base font-semibold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all mt-2"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {a.creatingAccount}
                  </div>
                ) : (
                  a.createAccount
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700/50"></div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">{a.or}</span>
              <div className="flex-1 h-px bg-slate-700/50"></div>
            </div>

            <p className="text-center text-sm text-slate-400">
              {a.alreadyAccount}{" "}
              <Link href="/auth/login" className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
                {a.signIn}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
