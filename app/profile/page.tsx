"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Logo from "@/components/Logo";
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
  const [isDark, setIsDark] = useState(false);

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
      const darkMode = document.documentElement.classList.contains('dark');
      setIsDark(darkMode);
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

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

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

  if (status === "loading" || loading) {
    return (
      <main className="page-bg flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="text-[var(--text-secondary)]">{dict.common.loading}</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="page-bg flex items-center justify-center p-4">
        <div className="card p-8 max-w-md text-center animate-fade-in">
          <h1 className="text-xl font-semibold mb-2">{dict.common.error}</h1>
          <p className="text-[var(--error)] mb-6">{error || "Profile not found"}</p>
          <Link href="/">
            <button className="btn btn-primary">Go Home</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg-gradient">
      <div className="container-default py-6 md:py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <Logo size="md" />

          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="btn btn-ghost p-2"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link href="/" className="btn btn-secondary text-sm">
              {dict.dashboard.title}
            </Link>
            <button onClick={() => signOut()} className="btn btn-danger text-sm">
              {dict.common.signOut}
            </button>
          </div>
        </header>

        {/* Page Title */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl font-semibold mb-1">{dict.profile.title}</h1>
          <p className="text-[var(--text-secondary)]">
            {dict.profile.manageAccount}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              {/* Basic Info Card */}
              <div className="card p-6 mb-6 animate-fade-in">
                <h2 className="font-semibold mb-4">{dict.profile.accountInfo}</h2>

                <div className="space-y-4">
                  {/* Email (readonly) */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                      {dict.profile.email}
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="opacity-60"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                      {dict.profile.emailNotice}
                    </p>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                      {dict.profile.displayName}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>

                  {/* Password Change Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(!showPasswordChange)}
                      className="text-sm font-medium text-[var(--primary)] hover:underline"
                    >
                      {showPasswordChange ? dict.common.cancel : dict.profile.changePassword}
                    </button>

                    {showPasswordChange && (
                      <div className="mt-4 p-4 rounded-lg bg-[var(--bg-secondary)] space-y-4 animate-fade-in">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            {dict.profile.currentPassword}
                          </label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder={dict.profile.enterCurrentPassword}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            {dict.profile.newPassword}
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={dict.profile.enterNewPassword}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            {dict.profile.confirmPassword}
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={dict.profile.confirmNewPassword}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preferences Card */}
              <div className="card p-6 mb-6 animate-fade-in">
                <h2 className="font-semibold mb-4">{dict.profile.preferences}</h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                      {dict.profile.language}
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {languageOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                      {dict.plan.resourceSort}
                    </label>
                    <select
                      value={resourceSort}
                      onChange={(e) => setResourceSort(e.target.value)}
                    >
                      {sortOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value === 'relevance' ? dict.plan.sortRelevance :
                            opt.value === 'viewCount' ? dict.plan.sortViewed :
                              opt.value === 'rating' ? dict.plan.sortRated : opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                      {dict.plan.learningPace}
                    </label>
                    <select
                      value={riskStyle}
                      onChange={(e) => setRiskStyle(e.target.value)}
                    >
                      {paceOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value === 'CONSERVATIVE' ? dict.plan.paceSteady :
                            opt.value === 'BALANCED' ? dict.plan.paceBalanced :
                              opt.value === 'CHALLENGER' ? dict.plan.paceIntensive : opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* API Settings Card */}
              <div className="card p-6 mb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold">{dict.profile.apiSettings}</h2>
                  <button
                    type="button"
                    onClick={() => setShowApiSettings(!showApiSettings)}
                    className="text-sm text-[var(--primary)] hover:underline"
                  >
                    {showApiSettings ? dict.profile.hide : dict.profile.show}
                  </button>
                </div>

                {/* Current Status */}
                <div className="p-4 rounded-lg bg-[var(--bg-secondary)] mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{dict.profile.currentProvider}</span>
                    <span className={`badge ${profile.hasOpenAiKey ? "badge-primary" : "badge-success"}`}>
                      {profile.hasOpenAiKey ? "OpenAI" : "Gemini (Free)"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {profile.hasOpenAiKey
                      ? dict.profile.usingOpenAi.replace("{model}", profile.openaiModel)
                      : dict.profile.usingGemini}
                  </p>
                </div>

                {showApiSettings && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="p-4 rounded-lg border border-dashed border-[var(--border)]">
                      <h3 className="text-sm font-medium mb-3">{dict.profile.openAiKeyTitle}</h3>
                      <p className="text-xs text-[var(--text-tertiary)] mb-4">
                        {dict.profile.openAiKeyDesc}
                      </p>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            API Key
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={openaiApiKey}
                              onChange={(e) => setOpenaiApiKey(e.target.value)}
                              placeholder={profile.hasOpenAiKey ? dict.profile.enterKey : "sk-..."}
                              className="flex-1"
                            />
                            {profile.hasOpenAiKey && (
                              <button
                                type="button"
                                onClick={handleRemoveOpenAiKey}
                                className="btn btn-danger text-sm"
                              >
                                {dict.profile.remove}
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Model
                          </label>
                          <select
                            value={openaiModel}
                            onChange={(e) => setOpenaiModel(e.target.value)}
                            className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                          >
                            {openAIModels.map(model => (
                              <option key={model.value} value={model.value}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium">
                              {dict.profile.tokenLimit}
                            </label>
                            <span className="text-xs text-[var(--text-tertiary)]">
                              Use slider or enter amount
                            </span>
                          </div>

                          <div className="flex flex-col gap-4 mb-2">
                            <div className="flex items-center gap-4">
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
                                className="w-full p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-mono"
                              />
                            </div>
                            <input
                              type="range"
                              min={100000}
                              max={100000000}
                              step={100000}
                              value={Math.min(openaiMonthlyTokenLimit, 100000000)}
                              onChange={(e) => setOpenaiMonthlyTokenLimit(parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                          </div>

                          <div className="flex justify-between items-start">
                            <div className="text-xs text-[var(--text-tertiary)]">
                              <span>{dict.profile.minToken}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-[var(--primary)]">
                                ≈ {formatCurrency(estimatedCost)} / mo
                              </p>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                {dict.profile.basedOnRates}
                              </p>
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
                <div className="p-4 rounded-lg bg-[var(--error-bg)] border border-[var(--error)]/20 text-[var(--error)] mb-4 animate-fade-in">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-4 rounded-lg bg-[var(--success-bg)] border border-[var(--success)]/20 text-[var(--success)] mb-4 animate-fade-in">
                  {success}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-lg w-full"
              >
                {saving ? (
                  <>
                    <span className="spinner" />
                    {dict.common.loading}
                  </>
                ) : (
                  dict.profile.saveChanges
                )}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Usage Stats */}
            <div className="card p-6 mb-6 animate-fade-in">
              <h2 className="font-semibold mb-4">{dict.profile.currentUsage}</h2>

              <div className="space-y-6">
                {profile.hasOpenAiKey && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--text-secondary)]">OpenAI</span>
                      <span className="font-medium">
                        {formatNumber(profile.quota.openai.used)} / {formatNumber(profile.quota.openai.limit)}
                      </span>
                    </div>
                    <div className="progress-track h-2 mb-1">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, (profile.quota.openai.used / profile.quota.openai.limit) * 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {dict.profile.estimatedCost}: ≈ {formatCurrency(profile.quota.openai.costEstimate)}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[var(--text-secondary)]">Gemini (Free)</span>
                    <span className="font-medium">
                      {formatNumber(profile.quota.gemini.used)} / {formatNumber(profile.quota.gemini.limit)}
                    </span>
                  </div>
                  <div className="progress-track h-2 mb-1">
                    <div
                      className="progress-fill progress-fill-success"
                      style={{
                        width: `${Math.min(100, (profile.quota.gemini.used / profile.quota.gemini.limit) * 100)}%`
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-[var(--text-tertiary)] pt-2 border-t border-[var(--border)]">
                  {dict.profile.tokensReset}
                </p>
              </div>
            </div>

            {/* Account Stats */}
            <div className="card p-6 animate-fade-in">
              <h2 className="font-semibold mb-4">{dict.profile.accountInfo}</h2>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{dict.dashboard.streak}</span>
                  <span className="font-semibold text-[var(--accent)]">{profile.streak} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{dict.dashboard.freeze}</span>
                  <span className="font-medium">{profile.freezeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{dict.profile.memberSince}</span>
                  <span className="font-medium">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div >
    </main >
  );
}
