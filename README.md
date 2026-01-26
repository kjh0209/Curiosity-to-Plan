
# � SkillLoop: Curiosity to Mastery

> **AI-Powered Adaptive Learning Platform**  
> *Generating structured curriculums from a single keyword.*

<div align="center">

![SkillLoop Banner](https://img.shields.io/badge/Status-Active_Development-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![OpenAI](https://img.shields.io/badge/AI-GPT--4o--Mini-412991?style=for-the-badge&logo=openai)
![Prisma](https://img.shields.io/badge/Database-Prisma_SQLite-2D3748?style=for-the-badge&logo=prisma)

</div>

---

## 🌟 What is SkillLoop?

**SkillLoop** is an intelligent learning companion that transforms your vague interest (e.g., *"I want to learn Guitar"*, *"Master React Hooks"*) into a **structured, day-by-day curriculum**. 

Unlike generic plans, SkillLoop dynamically curates **real-world resources** (Medium, YouTube, Wikipedia) and adapts to your progress with daily quizzes.

---

## ✨ Key Features

### 🧠 Smart Resource Engine (New!)
Our enhanced engine intelligently selects the best materials based on your topic context:

- **Context-Aware Fetching**: 
  - 💻 **Tech topics** (e.g., React, Python) → Fetches **Dev.to** tutorials & **Medium** tech blogs.
  - 🎸 **Hobby topics** (e.g., Guitar, Cooking) → Skips coding sites, focuses on **YouTube** & General Articles.
- **Medium RSS Integration**: Direct integration with Medium's RSS to fetch the freshest, curated articles without relying on generic search pages.
- **Strict Relevance Filter**: Automatically rejects clickbait or irrelevant content (e.g., "Giveaway", "Challenge") to ensure high-quality learning.
- **Wikipedia Validation**: Verifies API endpoints real-time to ensure no broken "Search Results" links.

### 🎯 Adaptive Learning Path
- **Custom Schedules**: 7-100 day plans, customizable from 5 mins to 2 hours/day.
- **Dynamic Difficulty**: 
  - Aced the quiz? The next day gets harder.
  - Struggled? The system eases the curve to help you reinforce basics.

### � Deterministic Grading System
- **Fair & Precise**: No more "AI hallucinations" grading your quizzes. 
- **Exact Match Logic**: If your answer matches the key (even broadly), you get the point. 
- **AI Feedback**: AI is used strictly for *encouragement* and *tips*, not for determining the score.

### 📊 Observability & Analytics
- **Opik Integration**: Full tracing of every LLM interaction to monitor cost and quality.
- **Streak System**: Gamified daily streaks to keep you motivated.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- OpenAI API Key

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/skillloop.git

# 2. Install dependencies
npm install

# 3. Setup Environment
cp .env.example .env.local
# (Add your OPENAI_API_KEY in .env.local)

# 4. Run Development Server
npm run dev
```

Visit `http://localhost:3000` to start your journey!

---

## �️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), TailwindCSS, Lucide Icons |
| **Backend** | Next.js API Routes, Prisma ORM |
| **AI Engine** | OpenAI GPT-4o-mini (Structured Outputs via Zod) |
| **External APIs** | YouTube Data API, Wikipedia API, Medium RSS, Dev.to API |
| **Observability** | Opik (Comet ML) |

---

## � Screenshots

*(Add screenshots of the Plan Generation and Daily Mission view here)*

---

<div align="center">

**Crafted with ❤️ for Lifelong Learners**

</div>
