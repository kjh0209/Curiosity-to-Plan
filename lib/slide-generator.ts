import { generateWithAI } from "./ai-provider";
import { withOpikTrace } from "./opik";

export interface Slide {
  title: string;
  content: string[];
  speakerNotes?: string;
  layout: "title" | "bullets" | "code" | "conclusion" | "image" | "split";
  code?: string;
  language?: string;
  imageQuery?: string; // For potential image search
  keyTakeaway?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ko: "Korean (한국어)",
  ja: "Japanese (日本語)",
  zh: "Chinese (中文)",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
};

export async function generateLearningSlides(
  userId: string,
  topic: string,
  missionTitle: string,
  level: string = "BEGINNER",
  language: string = "en"
): Promise<Slide[]> {
  return withOpikTrace(
    "generate_slides",
    { topic, missionTitle, level, language },
    async () => {
      const languageName = LANGUAGE_NAMES[language] || language;

      const prompt = `You are an expert educational content creator and AI Tutor.
Create a HIGH-QUALITY, VISUALLY RICH educational presentation.

Topic: "${topic}"
Mission: "${missionTitle}"
Student Level: ${level}

═══════════════════════════════════════════════════════════
🌍 CRITICAL LANGUAGE REQUIREMENT
═══════════════════════════════════════════════════════════
OUTPUT LANGUAGE: ${languageName}

EVERY piece of text in your response MUST be written in ${languageName}:
- All slide titles
- All bullet points and content
- All speaker notes
- All explanations and examples
- All key takeaways

DO NOT use English unless the topic involves code syntax or technical terms.
If ${language} is not English, translate everything including metaphors and analogies to sound natural in ${languageName}.
═══════════════════════════════════════════════════════════

📊 SLIDE STRUCTURE (8-10 slides required)

Create slides with the following layouts:

1. "title" - Opening slide with compelling hook
2. "bullets" - Core concepts with 4-5 detailed points each
3. "split" - Side-by-side comparison or before/after
4. "image" - Visual concept explanation (provide imageQuery for search)
5. "code" - Code examples (only for programming topics)
6. "conclusion" - Summary with key takeaways

📝 JSON FORMAT:
[
  {
    "layout": "title",
    "title": "Compelling Main Title",
    "content": ["Engaging subtitle that hooks the learner"],
    "speakerNotes": "Detailed introduction script (2-3 sentences) explaining why this topic matters",
    "keyTakeaway": "One sentence summary"
  },
  {
    "layout": "bullets",
    "title": "Core Concept Title",
    "content": [
      "Point 1: Detailed explanation with context",
      "Point 2: Real-world application example",
      "Point 3: Common mistake to avoid",
      "Point 4: Pro tip for mastery"
    ],
    "speakerNotes": "Deep explanation with analogies and examples",
    "keyTakeaway": "The essential insight"
  },
  {
    "layout": "image",
    "title": "Visual Concept",
    "content": ["Explanation of what the visual represents"],
    "imageQuery": "descriptive search query for relevant educational image",
    "speakerNotes": "How to interpret and understand this visual"
  },
  {
    "layout": "split",
    "title": "Comparison Title",
    "content": ["Left side concept", "Right side concept", "Key difference 1", "Key difference 2"],
    "speakerNotes": "Explanation of the comparison"
  },
  {
    "layout": "code",
    "title": "Code Example Title",
    "content": ["Explanation of what this code does", "Key concept being demonstrated"],
    "code": "// Actual working code example here\\nconst example = 'hello';\\nfunction demo() {\\n  return example;\\n}",
    "language": "javascript",
    "speakerNotes": "Walk through the code line by line"
  }
]

✅ QUALITY REQUIREMENTS:
1. Each bullet point should be 10-20 words (substantive, not just keywords)
2. Include real-world analogies and examples
3. Speaker notes should be conversational (as if explaining to a friend)
4. Use concrete examples, not abstract concepts
5. Include "imageQuery" for visual slides with good search terms
6. Include "keyTakeaway" for most slides
7. ⚠️ MANDATORY: If using "code" layout, you MUST include the "code" property with REAL, WORKING code examples (multi-line with \\n)

🚫 RESTRICTIONS:
- For non-technical topics (Music, Art, Sports, Languages):
  • DO NOT use "code" layout
  • Focus on "bullets", "split", and "image" layouts
- For technical topics (Programming, Math, Science):
  • Include relevant code examples with proper syntax
  • Use "code" layout with actual code in the "code" property
  • NEVER leave the "code" property empty or null

IMPORTANT: Return ONLY the raw JSON array. No markdown code blocks.`;

      const aiResult = await generateWithAI(userId, prompt, 4000);
      let text = aiResult.text.trim();

      // Clean up markdown code blocks if present
      if (text.startsWith("```json")) text = text.replace(/^```json/, "").replace(/```$/, "");
      else if (text.startsWith("```")) text = text.replace(/^```/, "").replace(/```$/, "");

      try {
        const slides = JSON.parse(text);
        return slides;
      } catch (e) {
        console.error("Failed to parse slides JSON:", text);
        throw new Error("Failed to generate valid slide content");
      }
    },
    { model: "gpt-4o-mini", topic }
  );
}

