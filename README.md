# 🔄 SkillLoop

> **Turn your curiosity into a personalized learning journey with AI-powered plans, adaptive quizzes, and rich learning resources**

<div align="center">

![SkillLoop Demo](https://img.shields.io/badge/Next.js-14+-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai)
![Opik](https://img.shields.io/badge/Opik-LLM_Observability-orange?style=for-the-badge)
![NextAuth](https://img.shields.io/badge/NextAuth-Authentication-green?style=for-the-badge)

</div>

---

## ✨ Features

### 🔐 User Authentication
- Secure email/password registration and login
- Session-based authentication with NextAuth.js
- Personal learning history and progress tracking

### 🎯 Fully Customizable Learning Plans
- **Duration**: 7 to 100 days
- **Daily Time**: 5 to 120 minutes per session
- **Difficulty**: Conservative, Balanced, or Challenger modes
- **Experience Level**: Beginner, Intermediate, or Advanced

### 📚 Rich Learning Resources
Each day includes curated links to real learning materials:
- 🎬 **YouTube Videos** - Tutorial and educational content
- 📝 **Medium Articles** - In-depth blog posts
- 📖 **Wikipedia** - Reference material
- 💻 **Documentation** - Official guides and tutorials

### 🧠 Smart Quizzes with Answer Reveal
- Mix of multiple choice (MCQ) and short answer questions
- **Short answers are single-word/phrase** for easy grading
- Detailed explanations for each answer
- See correct answers after submission

### 📈 Adaptive Difficulty System
- AI adjusts difficulty based on your quiz performance
- Score 3/3? Next day gets more challenging
- Struggling? Next day eases up to help you learn

### 🔥 Streak Tracking with Freeze
- Track consecutive learning days
- Motivational Duolingo-style messages
- Streak freeze protection (coming soon)

### � LLM Observability with Opik
- Full tracing of all AI interactions
- Performance monitoring and evaluation
- Dedicated observability dashboard at `/observability`

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key
- Opik account (for LLM tracing)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/skillloop.git
cd skillloop

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Initialize the database
npx prisma db push

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="file:./dev.db"

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# NextAuth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Opik (LLM Tracing)
OPIK_API_KEY=your-opik-api-key
OPIK_PROJECT_NAME=skillloop
OPIK_WORKSPACE_NAME=your-workspace
OPIK_URL_OVERRIDE=https://www.comet.com/opik/api
```

---

## 📖 Usage Guide

### 1. Create an Account
- Visit the app and click "Sign Up"
- Enter your email and password
- You'll be redirected to create your first plan

### 2. Create a Learning Plan
Configure your personalized plan:
- **Interest**: What do you want to learn?
- **Goal**: What do you want to achieve?
- **Duration**: 7-100 days
- **Daily Time**: 5-120 minutes
- **Experience Level**: Beginner/Intermediate/Advanced
- **Challenge Style**: Conservative/Balanced/Challenger

### 3. Complete Daily Missions
Each day includes:
- 📚 **Learning Resources** - YouTube, Wikipedia, articles
- ✅ **Step-by-step tasks** - Concrete learning activities
- 🧪 **Quiz** - 3 questions to test understanding

### 4. Review & Progress
- See correct answers after each quiz
- Track your streak on the dashboard
- View all your plans in the Plans page

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **TailwindCSS** | Styling and responsive design |
| **NextAuth.js** | Authentication |
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
│   │   ├── auth/             # NextAuth routes
│   │   ├── plan/generate/    # Generate learning plan
│   │   ├── day/generate/     # Generate daily mission
│   │   ├── quiz/grade/       # Grade quiz answers
│   │   ├── plans/            # Fetch user plans
│   │   ├── user/             # User data
│   │   └── traces/           # Opik trace logs
│   ├── auth/
│   │   ├── login/            # Login page
│   │   └── register/         # Registration page
│   ├── plan/                 # View current plan
│   ├── plans/                # Plan history
│   ├── day/[dayNumber]/      # Daily mission page
│   ├── observability/        # Opik dashboard
│   └── page.tsx              # Onboarding
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── db.ts                 # Prisma client
│   ├── opik.ts               # Opik tracing helper
│   └── schemas.ts            # Zod schemas
├── prisma/
│   └── schema.prisma         # Database schema
└── scripts/
    └── opik_eval_plan.ts     # Evaluation script
```

---

## 🔬 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth handler

### Plans
- `POST /api/plan/generate` - Generate new plan
- `GET /api/plans` - List user's plans
- `GET /api/plans/[planId]` - Get specific plan

### Daily Missions
- `POST /api/day/generate` - Generate day content
- `POST /api/quiz/grade` - Grade quiz answers

### User & Observability
- `GET /api/user` - Get user data
- `GET /api/traces` - Get recent trace logs

---

## 📊 Opik Observability

### What's Traced
- **generate_plan** - Plan creation with all settings
- **generate_day_mission** - Daily mission generation
- **grade_quiz** - Quiz grading with AI

### Viewing Traces
1. Visit `/observability` in the app
2. Click "Open Opik Dashboard" 
3. View detailed traces in Comet's Opik interface

### Running Evaluations

```bash
npx tsx scripts/opik_eval_plan.ts
```

Metrics evaluated:
- **IsJson** - Valid JSON output
- **Usefulness** - Quality of generated content
- **TimeBudgetFit** - Fits user's time constraints

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

[Report Bug](https://github.com/yourusername/skillloop/issues) · [Request Feature](https://github.com/yourusername/skillloop/issues)

</div>
