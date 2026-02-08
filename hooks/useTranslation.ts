"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface TranslationCache {
    [key: string]: string;
}

/**
 * Hook for translating dynamic content on the client side
 * Uses localStorage caching to minimize API calls
 */
export function useTranslation(userId: string, fromLang: string, toLang: string) {
    const [isTranslating, setIsTranslating] = useState(false);
    const cacheRef = useRef<TranslationCache>({});

    // Use refs to always have current values in callbacks
    const fromLangRef = useRef(fromLang);
    const toLangRef = useRef(toLang);
    const userIdRef = useRef(userId);

    useEffect(() => {
        fromLangRef.current = fromLang;
        toLangRef.current = toLang;
        userIdRef.current = userId;
    }, [fromLang, toLang, userId]);

    // Load cache from localStorage on mount
    const cacheKey = `translations_${fromLang}_${toLang}`;

    const getCachedTranslation = useCallback((text: string): string | null => {
        // Check memory cache first
        if (cacheRef.current[text]) {
            return cacheRef.current[text];
        }

        // Check localStorage
        try {
            const stored = localStorage.getItem(cacheKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed[text]) {
                    cacheRef.current[text] = parsed[text];
                    return parsed[text];
                }
            }
        } catch (e) {
            console.error("Failed to read translation cache", e);
        }

        return null;
    }, [cacheKey]);

    const setCachedTranslation = useCallback((text: string, translation: string) => {
        cacheRef.current[text] = translation;

        try {
            const stored = localStorage.getItem(cacheKey);
            const cache = stored ? JSON.parse(stored) : {};
            cache[text] = translation;
            localStorage.setItem(cacheKey, JSON.stringify(cache));
        } catch (e) {
            console.error("Failed to write translation cache", e);
        }
    }, [cacheKey]);

    const translateText = useCallback(async (text: string): Promise<string> => {
        const currentFromLang = fromLangRef.current;
        const currentToLang = toLangRef.current;
        const currentUserId = userIdRef.current;

        console.log('[useTranslation] translateText called:', { text: text.substring(0, 30), currentFromLang, currentToLang });

        if (!text || currentFromLang === currentToLang) return text;

        // Check cache
        const cached = getCachedTranslation(text);
        if (cached) return cached;

        // Call API
        setIsTranslating(true);
        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: currentUserId, text, fromLang: currentFromLang, toLang: currentToLang }),
            });

            if (!res.ok) throw new Error("Translation failed");

            const data = await res.json();
            const translated = data.translated || text;

            // Cache result
            setCachedTranslation(text, translated);

            return translated;
        } catch (e) {
            console.error("Translation error:", e);
            return text;
        } finally {
            setIsTranslating(false);
        }
    }, [getCachedTranslation, setCachedTranslation]);

    const translateTexts = useCallback(async (texts: string[]): Promise<string[]> => {
        const currentFromLang = fromLangRef.current;
        const currentToLang = toLangRef.current;
        const currentUserId = userIdRef.current;

        console.log('[useTranslation] translateTexts called:', { count: texts.length, currentFromLang, currentToLang });

        if (!texts.length || currentFromLang === currentToLang) return texts;

        // Check which texts need translation
        const results: string[] = [];
        const toTranslate: { index: number; text: string }[] = [];

        for (let i = 0; i < texts.length; i++) {
            const cached = getCachedTranslation(texts[i]);
            if (cached) {
                results[i] = cached;
            } else {
                toTranslate.push({ index: i, text: texts[i] });
            }
        }

        if (toTranslate.length === 0) return results;

        // Batch translate uncached texts
        setIsTranslating(true);
        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUserId,
                    texts: toTranslate.map(t => t.text),
                    fromLang: currentFromLang,
                    toLang: currentToLang
                }),
            });

            if (!res.ok) throw new Error("Translation failed");

            const data = await res.json();
            const translated = data.translated || [];

            // Merge results and cache
            for (let i = 0; i < toTranslate.length; i++) {
                const originalText = toTranslate[i].text;
                const translatedText = translated[i] || originalText;
                results[toTranslate[i].index] = translatedText;
                setCachedTranslation(originalText, translatedText);
            }

            return results;
        } catch (e) {
            console.error("Batch translation error:", e);
            // Return original texts for failed translations
            for (const item of toTranslate) {
                results[item.index] = item.text;
            }
            return results;
        } finally {
            setIsTranslating(false);
        }
    }, [getCachedTranslation, setCachedTranslation]);

    return {
        translateText,
        translateTexts,
        isTranslating,
        getCachedTranslation,
    };
}
