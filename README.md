# 📱 Sprints Flutter OS & Learning Tracker

> A modular, high-aesthetic **Learning Operating System & Tracker** architected for the intensive **ACC × Sprints - Flutter Bootcamp** (delivered by the American Center Cairo & Sprints Inc.).

---

## 🌟 Key Features

### 🔀 Dual-Lens Architecture
- **Parallel Swimlanes (4 Tracks)**: Visualizes the curriculum concurrently across 4 specialization pillars:
  - 📱 **Mobile Track** (Flutter, Dart, BLoC, Clean Architecture, Firebase)
  - ⚙️ **Systems Track** (Software Engineering, Git VCS, PostgreSQL, Linux, Networks, Docker)
  - 🎨 **Quality Track** (UI/UX Design, Accessibility WCAG, STLC, Appium Automation)
  - 🚀 **Career Track** (Leadership, Agile Scrum, Presentation, CV Optimization, Technical Interviews)
- **Official Sprints LMS View (5 Sprints)**: Reconciles all 38 modules and 400+ lesson topics into the official sprint sequence (S1 to S5) with accurate proportional runtime tracking (67h total).

### 🔒 Cyberpunk Auth Gate & Security Lock
- **Operator Authentication**: Full-screen glassmorphic lock screen requiring verified credentials before workspace access.
- **Session Persistence**: Managed via `sessionStorage` with instant manual lock trigger (`🔒 Lock`) in the header.
- **Defensive Error Handling**: Cyberpunk shake animation and security cipher validation via `/api/auth`.

### 🧠 Gemini AI Studio & Senior Architect Adaptive Scheduler
- **Real-Time Streaming (`/api/ai`)**: Integrated with Google Generative AI (`gemini-flash-latest`, `gemini-3.6-flash` fallback chain).
- **Task Reviewer**: Evaluates Flutter/Dart code submissions against official rubrics, patterns, and clean architecture standards.
- **Technical & STAR Interview Simulator**: Generates realistic interview scenarios with STAR frameworks.
- **LinkedIn Portfolio Launch Generator**: Crafts authentic, high-reach milestone posts for completed modules, sprints, and tracks.
- **AI Daily Planner (DAG-Aware Scheduler)**: Evaluates prerequisite graphs and time availability to build optimal **Core Mission (75-85%)** and **Bonus Stretch Goals (15-25m)**.

### ⏱️ Integrated Productivity Suite
- **Minimizable Pomodoro Dial**: Circular timer with custom phases (Focus, Short Break, Long Break) and compact floating pill mode.
- **Capsule Quick-Dump**: Modal notepad with markdown parser to dump raw lecture notes into AI-synthesized Core Takeaways and Recall Flashcards.
- **Artifact Vault**: Per-module storage for GitHub repository URLs, Pull Request links, and live demonstration endpoints.
- **Zen Mode**: Focus mode that dims non-relevant boards when deep work is active.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14.2.5 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI primitives, Lucide React icons, Glassmorphism
- **Animations**: Framer Motion, Canvas Confetti
- **State & Persistence**: Zustand with `persist` middleware (`localStorage` & `sessionStorage`)
- **AI Engine**: Google Gemini API via `@google/generative-ai` with automated candidate model fallback

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/dev-amr-elsherif/sprints-flutter-os.git
cd sprints-flutter-os
npm install
```

### 2. Configure Environment
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Add your credentials in `.env.local`:
```env
GEMINI_API_KEY="your_gemini_api_key"
APP_USERNAME="dev.amrelsherif"
APP_PASSWORD="your_password"
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 License
Developed with 💙 for the ACC × Sprints Flutter Bootcamp.