"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { formatNumber, formatCurrency } from "@/lib/format-utils";
import { getDictionary, Language } from "@/lib/i18n";

interface Profile {
  id: string;
  name: string;
  email: string;
  language: string;
  resourceSort: string;
  riskStyle: string;
  streak: number;
  freezeCount: number;
  createdAt: string;
  // API settings
  hasOpenAiKey: boolean;
  hasGeminiKey: boolean;
  openaiApiKey: string | null;
  openaiModel: string;
  openaiMonthlyTokenLimit: number;
  openaiTokenUsagePeriod: number;
  quota: {
    openai: { used: number; limit: number; hasKey: boolean; costEstimate: number };
    gemini: { used: number; limit: number; hasKey: boolean; keyType: string };
  };
}

const openAIModels = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Affordable)" },
  { value: "gpt-4o", label: "GPT-4o (Best Quality)" },
];

const MODEL_COSTS: Record<string, number> = {
  "gpt-4o": 5.00,
  "gpt-4o-mini": 0.30,
};

const languageOptions = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
];

const sortOptions = [
  { value: "relevance", label: "Most Relevant" },
  { value: "viewCount", label: "Most Viewed" },
  { value: "rating", label: "Highest Rated" },
];

const paceOptions = [
  { value: "CONSERVATIVE", label: "Steady" },
  { value: "BALANCED", label: "Balanced" },
  { value: "CHALLENGER", label: "Intensive" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [resourceSort, setResourceSort] = useState("relevance");
  const [riskStyle, setRiskStyle] = useState("BALANCED");

  // Password change
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // API settings
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [openaiMonthlyTokenLimit, setOpenaiMonthlyTokenLimit] = useState(2000000);

  // Computed cost check
  const estimatedCost = (openaiMonthlyTokenLimit / 1000000) * (MODEL_COSTS[openaiModel] || 0.30);

  // Dictionary
  const dict = getDictionary((profile?.language as Language) || "en");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Force dark mode for sleek look
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "loading" || !session) return;

    const loadProfile = async () => {
      try {
        const userId = (session.user as any).id;
        if (!userId) {
          router.push("/auth/login");
          return;
        }

        const response = await fetch(`/api/profile?userId=${userId}`);
        if (!response.ok) {
          throw new Error("Failed to load profile");
        }

        const data = await response.json();
        setProfile(data.profile);

        // Set form values
        setName(data.profile.name || "");
        setLanguage(data.profile.language || "en");
        setResourceSort(data.profile.resourceSort || "relevance");

        setRiskStyle(data.profile.riskStyle || "BALANCED");
        setOpenaiModel(data.profile.openaiModel || "gpt-4o-mini");
        setOpenaiMonthlyTokenLimit(data.profile.openaiMonthlyTokenLimit || 2000000);
        if (data.profile.openaiApiKey) {
          setOpenaiApiKey(data.profile.openaiApiKey);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, session, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const userId = (session?.user as any)?.id;
      if (!userId) throw new Error("Not authenticated");

      // Validate password change
      if (showPasswordChange) {
        if (!currentPassword) {
          setError("Current password is required");
          setSaving(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setError("New passwords do not match");
          setSaving(false);
          return;
        }
        if (newPassword.length < 6) {
          setError("New password must be at least 6 characters");
          setSaving(false);
          return;
        }
      }

      const updateData: any = {
        userId,
        name,
        language,
        resourceSort,
        riskStyle,
        openaiModel,
        openaiMonthlyTokenLimit,
      };

      // Only include password if changing
      if (showPasswordChange && newPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      // Only include API key if it was changed (not the masked version)
      if (openaiApiKey && !openaiApiKey.includes("...")) {
        updateData.openaiApiKey = openaiApiKey;
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess("Profile updated successfully");
      setShowPasswordChange(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Refresh profile
      const refreshResponse = await fetch(`/api/profile?userId=${userId}`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setProfile(data.profile);
        if (data.profile.openaiApiKey) {
          setOpenaiApiKey(data.profile.openaiApiKey);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOpenAiKey = async () => {
    if (!confirm("Are you sure you want to remove your OpenAI API key?")) return;

    try {
      const userId = (session?.user as any)?.id;

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, removeOpenaiKey: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove API key");
      }

      setOpenaiApiKey("");
      setSuccess("OpenAI API key removed");

      // Refresh profile
      const refreshResponse = await fetch(`/api/profile?userId=${userId}`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setProfile(data.profile);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const userId = (session?.user as any)?.id;
      const response = await fetch(`/api/profile?userId=${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete account");
      }
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(String(err));
      setDeleting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="page-bg-gradient min-h-screen flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">{dict.common.loading}</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="page-bg-gradient min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-10 max-w-lg text-center animate-scale-in">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">{dict.common.error}</h1>
          <p className="text-slate-400 mb-8">{error || "Profile not found"}</p>
          <Link href="/">
            <button className="btn btn-primary w-full shadow-lg shadow-sky-500/20">Go Home</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg-gradient min-h-screen pb-20">
      <div className="container-default pt-24 max-w-5xl">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 animate-fade-in">
          <div className="flex items-center gap-4">
            <Link href="/">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 hover:scale-105 transition-transform duration-300">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">{dict.profile.title}</h1>
              <p className="text-slate-400 text-sm">{dict.profile.manageAccount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link href="/" className="btn btn-secondary flex-1 md:flex-none text-sm bg-slate-800 border-slate-700 hover:bg-slate-700">
              {dict.dashboard.title}
            </Link>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-danger flex-1 md:flex-none text-sm bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400">
              {dict.common.signOut}
            </button>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSubmit}>
              {/* Basic Info Card */}
              <div className="glass-card p-8 animate-slide-up mb-8 hover:shadow-2xl hover:shadow-sky-900/10 transition-shadow duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <h2 className="font-bold text-lg text-white">{dict.profile.accountInfo}</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Email (readonly) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {dict.profile.email}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-slate-400 opacity-70 cursor-not-allowed"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 pl-1">
                      {dict.profile.emailNotice}
                    </p>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {dict.profile.displayName}
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors outline-none"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password Change Toggle */}
                <div className="mt-8 pt-6 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(!showPasswordChange)}
                    className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-2 group"
                  >
                    <span className="p-1 rounded-full bg-sky-500/10 group-hover:bg-sky-500/20">
                      {showPasswordChange ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                    </span>
                    {showPasswordChange ? dict.common.cancel : dict.profile.changePassword}
                  </button>

                  {showPasswordChange && (
                    <div className="mt-6 p-6 rounded-2xl bg-slate-900/50 border border-slate-700/50 space-y-5 animate-scale-in">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {dict.profile.currentPassword}
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder={dict.profile.enterCurrentPassword}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 transition-colors outline-none"
                        />
                      </div>
                      <div className="grid md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            {dict.profile.newPassword}
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={dict.profile.enterNewPassword}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 transition-colors outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            {dict.profile.confirmPassword}
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={dict.profile.confirmNewPassword}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-sky-500 transition-colors outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Password must be at least 6 characters long.
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* Preferences Card */}
              <div className="glass-card p-8 animate-slide-up mb-8 hover:shadow-2xl hover:shadow-purple-900/10 transition-shadow duration-500" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                  </div>
                  <h2 className="font-bold text-lg text-white">{dict.profile.preferences}</h2>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {dict.profile.language}
                    </label>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white appearance-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors outline-none cursor-pointer"
                      >
                        {languageOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {dict.plan.resourceSort}
                    </label>
                    <div className="relative">
                      <select
                        value={resourceSort}
                        onChange={(e) => setResourceSort(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white appearance-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors outline-none cursor-pointer"
                      >
                        {sortOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.value === 'relevance' ? dict.plan.sortRelevance :
                              opt.value === 'viewCount' ? dict.plan.sortViewed :
                                opt.value === 'rating' ? dict.plan.sortRated : opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {dict.plan.learningPace}
                    </label>
                    <div className="relative">
                      <select
                        value={riskStyle}
                        onChange={(e) => setRiskStyle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white appearance-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors outline-none cursor-pointer"
                      >
                        {paceOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.value === 'CONSERVATIVE' ? dict.plan.paceSteady :
                              opt.value === 'BALANCED' ? dict.plan.paceBalanced :
                                opt.value === 'CHALLENGER' ? dict.plan.paceIntensive : opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* API Settings Card */}
              <div className="glass-card p-8 animate-slide-up mb-8 hover:shadow-2xl hover:shadow-green-900/10 transition-shadow duration-500" style={{ animationDelay: '0.2s' }}>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    </div>
                    <h2 className="font-bold text-lg text-white">{dict.profile.apiSettings}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowApiSettings(!showApiSettings)}
                    className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {showApiSettings ? dict.profile.hide : dict.profile.show}
                  </button>
                </div>

                {/* Current Status */}
                <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-700/50 mb-6 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-300 mb-1">{dict.profile.currentProvider}</div>
                    <p className="text-xs text-slate-500">
                      {profile.hasOpenAiKey
                        ? dict.profile.usingOpenAi.replace("{model}", profile.openaiModel)
                        : dict.profile.usingGemini}
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${profile.hasOpenAiKey
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-sky-500/10 text-sky-400 border-sky-500/20"}`}>
                    {profile.hasOpenAiKey ? "OpenAI" : "Gemini (Free)"}
                  </div>
                </div>

                {showApiSettings && (
                  <div className="space-y-6 animate-fade-in pt-2">
                    <div className="p-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <svg className="w-20 h-20 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M22.281 9.821a5.98 5.98 0 0 0-.515-4.853 6.046 6.046 0 0 0-4.502-2.784 6.002 6.002 0 0 0-3.376-7.387 6.03 6.03 0 0 0-5.744.757 5.993 5.993 0 0 0-5.32 1.492 6.004 6.004 0 0 0-2.31 4.756 6.027 6.027 0 0 0 .524 4.847 6.05 6.05 0 0 0 4.498 2.774 6.006 6.006 0 0 0 3.36 7.391 6.03 6.03 0 0 0 5.75-.76c1.655.975 3.714.711 5.32-1.481a5.988 5.988 0 0 0 2.315-4.752zM12.793 1.543c.277-.123.57-.188.874-.188a4.01 4.01 0 0 1 3.52 2.158 3.998 3.998 0 0 1 1.096 3.12 3.99 3.99 0 0 1 2.228 1.42 4.02 4.02 0 0 1 .53 3.155 4.008 4.008 0 0 1-1.411 2.923 4.02 4.02 0 0 1-.309 3.393 4.018 4.018 0 0 1-3.03 1.846 3.99 3.99 0 0 1-2.617-.417 4.01 4.01 0 0 1-2.872.247 4.022 4.022 0 0 1-2.903-2.31 4.007 4.007 0 0 1 .573-3.618 4.004 4.004 0 0 1-2.138-2.668 4.008 4.008 0 0 1 .741-3.322 4.02 4.02 0 0 1 2.71-1.576 4.027 4.027 0 0 1 2.61.9 4.024 4.024 0 0 1 1.83-2.673c.475-.285 1.012-.42 1.56-.39zm-2.02 18.068a2.003 2.003 0 0 0 1.258.455c.345.006.685-.091.986-.27l4.137-2.388a1.996 1.996 0 0 0-.012-3.46l-4.138-2.396a2.007 2.007 0 0 0-2.228 3.208l1.246.726-2.583 1.492-2.584-1.492 1.247-.726a2.005 2.005 0 0 0-.25-3.483l-4.139 2.397a2 2 0 0 0 2.234 3.203l1.25-.721 2.584 1.488z" /></svg>
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-sm font-bold text-slate-200 mb-2">{dict.profile.openAiKeyTitle}</h3>
                        <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-xl">
                          {dict.profile.openAiKeyDesc}
                        </p>

                        <div className="space-y-6">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                              API Key
                            </label>
                            <div className="flex gap-3">
                              <input
                                type="password"
                                value={openaiApiKey}
                                onChange={(e) => setOpenaiApiKey(e.target.value)}
                                placeholder={profile.hasOpenAiKey ? dict.profile.enterKey : "sk-..."}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors outline-none font-mono text-sm"
                              />
                              {profile.hasOpenAiKey && (
                                <button
                                  type="button"
                                  onClick={handleRemoveOpenAiKey}
                                  className="btn btn-danger px-4 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                                >
                                  {dict.profile.remove}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Model
                              </label>
                              <div className="relative">
                                <select
                                  value={openaiModel}
                                  onChange={(e) => setOpenaiModel(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white appearance-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors outline-none cursor-pointer"
                                >
                                  {openAIModels.map(model => (
                                    <option key={model.value} value={model.value}>
                                      {model.label}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                  {dict.profile.tokenLimit}
                                </label>
                                <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                  Per Month
                                </span>
                              </div>

                              <div className="flex flex-col gap-3">
                                <input
                                  type="number"
                                  min="100000"
                                  max="500000000"
                                  step="100000"
                                  value={openaiMonthlyTokenLimit}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setOpenaiMonthlyTokenLimit(isNaN(val) ? 0 : val);
                                  }}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors outline-none font-mono text-sm"
                                />
                                <input
                                  type="range"
                                  min={100000}
                                  max={100000000}
                                  step={100000}
                                  value={Math.min(openaiMonthlyTokenLimit, 100000000)}
                                  onChange={(e) => setOpenaiMonthlyTokenLimit(parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                              </div>

                              <div className="flex justify-between items-start mt-2">
                                <div className="text-[10px] text-slate-500">
                                  <span>{dict.profile.minToken}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-emerald-400">
                                    ≈ {formatCurrency(estimatedCost)} / mo
                                  </p>
                                  <p className="text-[10px] text-slate-600">
                                    {dict.profile.basedOnRates}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>


              {/* Messages */}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 animate-fade-in flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6 animate-fade-in flex items-center gap-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {success}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full py-4 text-base font-bold shadow-lg shadow-sky-900/20 hover:shadow-sky-500/30 transition-shadow duration-300"
              >
                {saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="spinner w-5 h-5 border-2" />
                    {dict.common.loading}
                  </div>
                ) : (
                  dict.profile.saveChanges
                )}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Account Stats */}
            <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <h2 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {dict.profile.accountInfo}
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                  <span className="text-sm font-medium text-slate-400">{dict.dashboard.streak}</span>
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                    {profile.streak} days
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                  <span className="text-sm font-medium text-slate-400">{dict.dashboard.freeze}</span>
                  <span className="font-bold text-sky-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    {profile.freezeCount}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                  <span className="text-sm font-medium text-slate-400">{dict.profile.memberSince}</span>
                  <span className="font-medium text-slate-200 text-sm">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <h2 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                {dict.profile.currentUsage}
              </h2>

              <div className="space-y-6">
                {profile.hasOpenAiKey && (
                  <div className="p-4 rounded-xl bg-slate-900/30 border border-emerald-500/20">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider">OpenAI ({profile.openaiModel})</span>
                      <span className="font-mono text-xs text-emerald-300">
                        {formatNumber(profile.quota.openai.used)} / {formatNumber(profile.quota.openai.limit)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, (profile.quota.openai.used / profile.quota.openai.limit) * 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {dict.profile.estimatedCost}: ≈ {formatCurrency(profile.quota.openai.costEstimate)}
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-900/30 border border-sky-500/20">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-sky-400 font-bold text-xs uppercase tracking-wider">Gemini (Free)</span>
                    <span className="font-mono text-xs text-sky-300">
                      {formatNumber(profile.quota.gemini.used)} / {formatNumber(profile.quota.gemini.limit)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, (profile.quota.gemini.used / profile.quota.gemini.limit) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Free Tier Usage</p>
                </div>

                <p className="text-xs text-slate-500 pt-4 border-t border-slate-700/50 italic text-center">
                  {dict.profile.tokensReset}
                </p>
              </div>
            </div>

            {/* Delete Account */}
            <div className="glass-card p-6 animate-slide-up border-red-500/20" style={{ animationDelay: '0.5s' }}>
              <h2 className="font-bold text-lg text-red-400 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {dict.profile.deleteAccount}
              </h2>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 px-4 rounded-xl text-sm font-medium text-red-400 bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                >
                  {dict.profile.deleteAccount}
                </button>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {dict.profile.deleteAccountWarning}
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {dict.profile.deleteAccountConfirm}
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full bg-slate-900 border border-red-500/30 rounded-xl p-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors outline-none font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                      className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-slate-400 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                    >
                      {dict.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "DELETE" || deleting}
                      className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {deleting ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="spinner w-4 h-4 border-2" />
                        </div>
                      ) : (
                        dict.profile.deleteAccountButton
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div >
    </main >
  );
}
