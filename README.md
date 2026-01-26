# 🔄 SkillLoop

> **Turn your curiosity into a 14-day learning journey with AI-powered personalized learning plans**

<div align="center">

![SkillLoop Demo](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai)
![Opik](https://img.shields.io/badge/Opik-Tracing-orange?style=for-the-badge)

</div>

---

## ✨ Features

### 🎯 Personalized Learning Plans
- Enter your interest and learning goal
- AI generates a customized 14-day learning curriculum
- Each day includes specific missions tailored to your skill level

### 📚 Daily Missions & Quizzes
- Concrete learning steps for each day (~20 min sessions)
- 3-question quizzes to test your understanding
- Mix of multiple choice and short answer questions

### 📈 Adaptive Difficulty
- Automatic difficulty adjustment based on quiz performance
- Score 3/3? Next day gets harder
- Score 0-1/3? Next day gets easier
- Perfect balance of challenge and achievement

### 🔥 Streak Tracking
- Track your daily learning consistency
- Build momentum with consecutive day completions

### 🗂️ Plan History
- View all your created learning plans
- Switch between plans easily
- Track progress across multiple topics

### 🔍 LLM Observability with Opik
- Full tracing of all AI interactions
- Performance monitoring and evaluation
- Debug and optimize your prompts

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key
- Opik account (optional, for tracing)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/skillloop.git
cd skillloop

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Initialize the database
npx prisma db push

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Opik (optional - for LLM tracing)
OPIK_API_KEY=your-opik-api-key
OPIK_PROJECT_NAME=skillloop
OPIK_WORKSPACE_NAME=your-workspace
OPIK_URL_OVERRIDE=https://www.comet.com/opik/api
```

---

## 📖 Usage Guide

### Creating Your First Plan

1. **Open the app** at `http://localhost:3000`
2. **Enter your interest** (e.g., "machine learning", "piano", "cooking")
3. **Define your goal** (e.g., "Build a basic ML model")
4. **Click "Generate 14-day plan"** and wait for AI to create your curriculum

### Completing Daily Missions

1. Navigate to your plan and click **"Start"** on Day 1
2. Read through the **learning steps** for the day
3. Complete the **quiz** to test your knowledge
4. Get **instant feedback** and see your score
5. The next day automatically **unlocks** upon completion

### Managing Multiple Plans

- Click **"View My Existing Plans"** to see all your learning journeys
- Track progress with **visual completion bars**
- Switch between plans anytime

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **TailwindCSS** | Styling and responsive design |
| **Prisma** | Database ORM |
| **SQLite** | Local development database |
| **OpenAI** | GPT-4o-mini for content generation |
| **Opik** | LLM tracing and evaluation |
| **Zod** | Schema validation |

---

## 📁 Project Structure

```
skillloop/
├── app/
│   ├── api/
│   │   ├── plan/generate/     # Generate learning plan
│   │   ├── day/generate/      # Generate daily mission
│   │   ├── quiz/grade/        # Grade quiz answers
│   │   └── plans/             # Fetch user plans
│   ├── plan/                  # View current plan
│   ├── plans/                 # Plan history
│   ├── day/[dayNumber]/       # Daily mission page
│   └── page.tsx               # Onboarding
├── lib/
│   ├── db.ts                  # Prisma client
│   ├── opik.ts                # Opik tracing helper
│   └── schemas.ts             # Zod schemas
├── prisma/
│   └── schema.prisma          # Database schema
└── scripts/
    └── opik_eval_plan.ts      # Evaluation script
```

---

## 🔬 API Endpoints

### `POST /api/plan/generate`
Generate a new 14-day learning plan.

**Request Body:**
```json
{
  "userId": "string",
  "interest": "string",
  "goal": "string",
  "minutesPerDay": 20
}
```

### `POST /api/day/generate`
Generate mission content for a specific day.

**Request Body:**
```json
{
  "userId": "string",
  "dayNumber": 1,
  "missionTitle": "string",
  "focus": "string",
  "difficulty": 1
}
```

### `POST /api/quiz/grade`
Grade quiz answers and update progress.

**Request Body:**
```json
{
  "userId": "string",
  "dayNumber": 1,
  "quiz": [...],
  "userAnswers": ["answer1", "answer2", "answer3"],
  "currentDifficulty": 1
}
```

---

## 📊 Running Evaluations

Use the Opik evaluation script to test plan generation quality:

```bash
npx tsx scripts/opik_eval_plan.ts
```

This will:
- Create/use the "skillloop-plan-eval" dataset
- Test plan generation with 5 different interest/goal combinations
- Evaluate using IsJson and Usefulness metrics
- Output results URL for viewing in Opik dashboard

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for lifelong learners**

[Report Bug](https://github.com/kjh0209/Curiosity-to-Plan/issues) · [Request Feature](https://github.com/kjh0209/Curiosity-to-Plan/issues)

</div>
