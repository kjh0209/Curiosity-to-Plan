/**
 * LLM-based Article Generator
 * 
 * Generates educational content tailored to the user's learning topic and level.
 * Uses the AI Provider abstraction to respect user's API key settings.
 */

import { generateWithAI } from "./ai-provider";

interface GeneratedArticle {
    title: string;
    content: string;
    estimatedMinutes: number;
    sections: string[];
}

const difficultyDescriptions = {
    beginner: "basic concepts, simple explanations, many examples, no prior knowledge assumed",
    intermediate: "moderate depth, some technical terms, practical applications, builds on basics",
    advanced: "in-depth analysis, advanced concepts, expert-level techniques, assumes solid foundation",
};

const languageNames: Record<string, string> = {
    en: "English",
    ko: "Korean (한국어)",
    ja: "Japanese (日本語)",
    zh: "Chinese (中文)",
    es: "Spanish (Español)",
    fr: "French (Français)",
    de: "German (Deutsch)",
};

/**
 * Generate an educational article for a specific topic
 */
export async function generateLearningArticle(
    userId: string,
    topic: string,
    difficulty: "beginner" | "intermediate" | "advanced" = "beginner",
    language: string = "en",
    context?: string
): Promise<GeneratedArticle> {
    const languageName = languageNames[language] || "English";
    const difficultyDesc = difficultyDescriptions[difficulty];

    const prompt = `You are an expert educational content creator. 
Generate a comprehensive learning article about "${topic}" in ${languageName}.

Target audience: ${difficulty} level (${difficultyDesc})
${context ? `Additional context: ${context}` : ""}

Requirements:
1. Write a clear, engaging article that teaches the topic effectively
2. Use markdown formatting (headers, bullet points, code blocks if relevant)
3. Include practical examples where applicable
4. The article should take approximately 5-15 minutes to read
5. Make the content memorable and actionable

Structure your article with:
- An engaging introduction
- 3-5 main sections with headers
- Practical examples or exercises
- A brief conclusion with key takeaways

Write ONLY the article content in markdown format. Do not include any JSON or metadata.`;

    const result = await generateWithAI(userId, prompt, 3000);

    // Extract title (first H1 or first line)
    const titleMatch = result.text.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `Learning ${topic}`;

    // Extract section headers
    const sectionMatches = result.text.match(/^##\s+.+$/gm) || [];
    const sections = sectionMatches.map(s => s.replace(/^##\s+/, ""));

    // Estimate reading time (200 words per minute)
    const wordCount = result.text.split(/\s+/).length;
    const estimatedMinutes = Math.max(5, Math.ceil(wordCount / 200));

    return {
        title,
        content: result.text,
        estimatedMinutes,
        sections,
    };
}

/**
 * Generate a quick summary/overview of a topic
 */
export async function generateQuickSummary(
    userId: string,
    topic: string,
    language: string = "en"
): Promise<string> {
    const languageName = languageNames[language] || "English";

    const prompt = `Generate a brief, 2-3 paragraph summary about "${topic}" in ${languageName}.
    
Focus on:
- What it is
- Why it matters
- Key concepts to understand

Keep it concise and beginner-friendly.`;

    const result = await generateWithAI(userId, prompt, 500);
    return result.text;
}

/**
 * Generate practice exercises for a topic
 */
export async function generateExercises(
    userId: string,
    topic: string,
    difficulty: "beginner" | "intermediate" | "advanced" = "beginner",
    language: string = "en",
    count: number = 3
): Promise<{ exercises: Array<{ question: string; hint?: string; solution?: string }> }> {
    const languageName = languageNames[language] || "English";

    const prompt = `Generate ${count} practice exercises about "${topic}" in ${languageName}.
Difficulty: ${difficulty}

For each exercise, provide:
1. A clear question or task
2. A helpful hint (optional)
3. A solution or answer

Return as JSON array:
[
    {"question": "...", "hint": "...", "solution": "..."},
    ...
]`;

    const result = await generateWithAI(userId, prompt, 1500);

    // Parse JSON from response
    const jsonMatch = result.text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
        try {
            const exercises = JSON.parse(jsonMatch[0]);
            return { exercises };
        } catch (e) {
            console.error("Failed to parse exercises JSON:", e);
        }
    }

    return { exercises: [] };
}
