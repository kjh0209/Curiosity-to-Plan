<div align="center">

# 🚀 SkillLoop

### *Curiosity to Plan*

**AI가 만들어주는 나만의 14일 학습 커리큘럼**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-skillloop--one.vercel.app-00D9FF?style=for-the-badge)](https://skillloop-one.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/kjh0209/Curiosity-to-Plan)

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Opik](https://img.shields.io/badge/Opik-FF6B6B?style=flat-square)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## 💡 Problem

> **"Python 배우고 싶은데... 어디서 시작하지?"**

유튜브에 검색하면 **1,000만 개**의 결과.  
첫 번째 영상은 너무 어렵고, 두 번째는 너무 쉽고...  
결국 **95%의 온라인 학습자**가 끝까지 완주하지 못합니다.

---

## ✨ Solution

**SkillLoop**는 당신의 호기심을 **14일 학습 계획**으로 바꿔줍니다.

```
🎯 "React 배우고 싶어"  →  14일 맞춤형 커리큘럼 생성!
```

### 핵심 기능

| 기능 | 설명 |
|------|------|
| 📚 **AI 커리큘럼 생성** | 주제 입력 → 14일 학습 계획 자동 생성 |
| 🎨 **인터랙티브 슬라이드** | 매일 새로운 AI 생성 학습 자료 |
| 📖 **심화 아티클** | 깊이 있는 읽기 자료 제공 |
| ✅ **스마트 퀴즈** | AI 채점 + 상세 피드백 |
| 🔥 **스트릭 시스템** | 매일 학습 동기부여 |
| 🌍 **다국어 지원** | 한국어, 영어, 일본어, 중국어, 스페인어 |

---

## 🛠️ Tech Stack

```
Frontend     →  Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend      →  Next.js API Routes + Prisma ORM
Database     →  PostgreSQL (Supabase)
AI           →  OpenAI GPT-4o-mini / Google Gemini 2.0
Observability→  Opik (Comet ML) - LLM 호출 추적 & 분석
Deployment   →  Vercel
```

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/kjh0209/Curiosity-to-Plan.git
cd Curiosity-to-Plan

# 2. Install
npm install

# 3. Environment
cp .env.example .env.local
# Add your API keys in .env.local

# 4. Database
npx prisma generate
npx prisma db push

# 5. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📊 Opik Integration

SkillLoop는 **Opik**으로 모든 LLM 호출을 추적합니다:

- ✅ 슬라이드/아티클/퀴즈 생성 추적
- ✅ 번역 요청 모니터링
- ✅ 사용자 피드백 로깅
- ✅ 지연시간 & 에러 분석

---

## 🌐 Live Demo

<div align="center">

### 👉 [https://skillloop-one.vercel.app/](https://skillloop-one.vercel.app/)

</div>

---

## 📁 Project Structure

```
├── app/
│   ├── api/              # API Routes
│   ├── day/[dayNumber]/  # Daily Learning Pages
│   ├── new-plan/         # Plan Creation
│   └── plan/             # Plan Dashboard
├── lib/
│   ├── ai-provider.ts    # OpenAI/Gemini Integration
│   ├── slide-generator.ts
│   ├── article-generator.ts
│   ├── translate.ts
│   └── opik.ts           # LLM Observability
├── prisma/
│   └── schema.prisma     # Database Schema
└── components/
```

---

## 👨‍💻 Author

**김지혁** (Kim Ji-Hyuk)

---

<div align="center">

**Built with ❤️ for Lifelong Learners**

*Curiosity to Plan. 호기심을 계획으로.*

</div>
