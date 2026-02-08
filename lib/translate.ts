import { generateWithAI } from "./ai-provider";
import { withOpikTrace } from "./opik";
import { Slide } from "./slide-generator";

// Language display names for translation prompts
const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    ko: "Korean (한국어)",
    ja: "Japanese (日本語)",
    zh: "Chinese (中文)",
    es: "Spanish (Español)",
    fr: "French (Français)",
    de: "German (Deutsch)",
};

/**
 * Translate slides from one language to another
 * Preserves structure, only translates text content
 */
export async function translateSlides(
    userId: string,
    slides: Slide[],
    fromLang: string,
    toLang: string
): Promise<Slide[]> {
    if (fromLang === toLang) return slides;

    return withOpikTrace(
        "translate_slides",
        { fromLang, toLang, slideCount: slides.length },
        async () => {
            const fromLangName = LANGUAGE_NAMES[fromLang] || fromLang;
            const toLangName = LANGUAGE_NAMES[toLang] || toLang;

            const prompt = `You are a professional translator. Translate the following educational slides from ${fromLangName} to ${toLangName}.

CRITICAL RULES:
1. Preserve the EXACT same JSON structure
2. Only translate text content (titles, content arrays, speakerNotes, keyTakeaway)
3. Do NOT translate:
   - Code snippets (inside "code" field)
   - Technical terms that should remain in original (API names, function names, etc.)
   - "layout" and "language" field values
4. Keep the same number of slides and bullet points
5. Translate naturally - don't be too literal

INPUT SLIDES (${fromLangName}):
${JSON.stringify(slides, null, 2)}

OUTPUT: Return ONLY the translated JSON array. No markdown code blocks.`;

            const result = await generateWithAI(userId, prompt, 4000);
            let text = result.text.trim();

            // Clean up markdown
            if (text.startsWith("```json")) text = text.replace(/^```json/, "").replace(/```$/, "");
            else if (text.startsWith("```")) text = text.replace(/^```/, "").replace(/```$/, "");

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse translated slides:", text);
                // Return original slides if translation fails
                return slides;
            }
        },
        { operation: "translate_slides" }
    );
}

/**
 * Translate an article from one language to another
 */
export async function translateArticle(
    userId: string,
    article: { title: string; content: string; estimatedMinutes: number },
    fromLang: string,
    toLang: string
): Promise<{ title: string; content: string; estimatedMinutes: number }> {
    if (fromLang === toLang) return article;

    return withOpikTrace(
        "translate_article",
        { fromLang, toLang },
        async () => {
            const fromLangName = LANGUAGE_NAMES[fromLang] || fromLang;
            const toLangName = LANGUAGE_NAMES[toLang] || toLang;

            const prompt = `You are a professional translator. Translate the following educational article from ${fromLangName} to ${toLangName}.

CRITICAL RULES:
1. Preserve markdown formatting
2. Translate naturally - don't be too literal
3. Keep code snippets in original language (don't translate code)
4. Technical terms can remain in original if commonly used that way

INPUT:
Title: ${article.title}

Content:
${article.content}

OUTPUT FORMAT (JSON):
{
  "title": "translated title",
  "content": "translated markdown content",
  "estimatedMinutes": ${article.estimatedMinutes}
}

Return ONLY the JSON object. No markdown code blocks.`;

            const result = await generateWithAI(userId, prompt, 4000);
            let text = result.text.trim();

            if (text.startsWith("```json")) text = text.replace(/^```json/, "").replace(/```$/, "");
            else if (text.startsWith("```")) text = text.replace(/^```/, "").replace(/```$/, "");

            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse translated article:", text);
                return article;
            }
        },
        { operation: "translate_article" }
    );
}

/**
 * Translate a simple text string
 */
export async function translateText(
    userId: string,
    text: string,
    fromLang: string,
    toLang: string
): Promise<string> {
    if (fromLang === toLang || !text) return text;

    return withOpikTrace(
        "translate_text",
        { fromLang, toLang },
        async () => {
            const toLangName = LANGUAGE_NAMES[toLang] || toLang;

            // Support auto-detection of source language
            const fromLangInstruction = fromLang === "auto"
                ? "Auto-detect the source language"
                : `From ${LANGUAGE_NAMES[fromLang] || fromLang}`;

            const prompt = `${fromLangInstruction}, translate the following text to ${toLangName}. Return ONLY the translated text, nothing else. If the text is already in ${toLangName}, return it unchanged.

Text: ${text}`;

            const result = await generateWithAI(userId, prompt, 500);
            return result.text.trim();
        },
        { operation: "translate_text" }
    );
}

/**
 * Batch translate multiple texts
 */
export async function translateTexts(
    userId: string,
    texts: string[],
    fromLang: string,
    toLang: string,
    context?: string
): Promise<string[]> {
    if (fromLang === toLang) return texts;

    return withOpikTrace(
        "translate_texts",
        { fromLang, toLang, count: texts.length, context },
        async () => {
            const toLangName = LANGUAGE_NAMES[toLang] || toLang;

            // Support auto-detection of source language
            const fromLangInstruction = fromLang === "auto"
                ? "Auto-detect the source language for each text"
                : `From ${LANGUAGE_NAMES[fromLang] || fromLang}`;

            const contextInstruction = context
                ? `\nCONTEXT and STYLE GUIDE:\n${context}\n`
                : "";

            const prompt = `You are a professional translator. ${contextInstruction}
${fromLangInstruction}, translate the following texts to ${toLangName}. 
Return a JSON array with the translated strings in the same order. 
If a text is already in ${toLangName}, keep it unchanged.
Ensure the translation is natural and fits the context.

INPUT:
${JSON.stringify(texts)}

OUTPUT: Return ONLY the JSON array of translated strings. No markdown code blocks.`;

            const result = await generateWithAI(userId, prompt, 2000);
            let response = result.text.trim();

            if (response.startsWith("```json")) response = response.replace(/^```json/, "").replace(/```$/, "");
            else if (response.startsWith("```")) response = response.replace(/^```/, "").replace(/```$/, "");

            try {
                const parsed = JSON.parse(response);
                if (Array.isArray(parsed)) return parsed;
                // If LLM returned object with keys, try to extract values
                if (typeof parsed === 'object') return Object.values(parsed);
                return texts;
            } catch (e) {
                console.error("Failed to parse batch translation:", response);
                return texts;
            }
        },
        { operation: "translate_texts" }
    );
}
