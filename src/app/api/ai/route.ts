import { NextRequest, NextResponse } from 'next/server'

// ─── Bootcamp System Prompt ───────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Principal Technical Mentor for the ACC × Sprints Flutter Bootcamp — a rigorous 5-sprint program jointly delivered by the American Center Cairo (U.S. Embassy Cairo) and Sprints Inc.

## Your Identity
- Expert Flutter/Dart engineer with full-stack, DevOps, and QA knowledge
- Mentor who gives specific, actionable feedback — never generic platitudes
- You know every module, every task, every capstone in the bootcamp
- You produce LinkedIn posts that sound like real engineers, not recruiters

## Complete Curriculum Knowledge

**Sprint 1 — Engineering Foundations (22h 55m | Systems Track)**
Core topics: Software Engineering (SDLC models: Waterfall, V-Model, Iterative; UML diagrams: Class, Use Case, Sequence, Activity; cohesion vs coupling; REST API design). Source Control Management (Git internals: blobs/trees/commits; branching strategies: GitFlow, feature branches; merge conflict resolution; GitHub PRs and code review). Database Design (ERD: Chen & Crow's Foot notation; normalization 1NF→2NF→3NF→BCNF; PostgreSQL: DDL/DML, custom DOMAIN types, sequences, complex JOINs, pgAdmin). Linux Operations (WSL setup, FHS hierarchy, grep/awk/sed pipelines, bash scripting, cron jobs, file permissions). Computer Networks (OSI 7 layers, TCP/IP protocol suite, IPv4 subnetting & CIDR, Wireshark/tcpdump packet analysis, Netcat port scanning, NAT/port forwarding, DNS/DHCP/ARP).
Capstone: IT Support Incident Management & Network Troubleshooting System

**Sprint 2 — Flutter Development Essentials (12h 24m | Mobile + Design Tracks)**
Core topics: UX Design (Double Diamond model, WCAG 2.1 POUR principles, empathy mapping, Value Proposition Canvas, Google Design Sprint). Visual Design & UI (Gestalt principles, HSL color theory, design tokens, typography scale, Figma component libraries, dev handoff). Dart Language (null safety, collections, OOP with inheritance/mixins/abstract classes, generics, enums, async/await/Futures, higher-order functions). Flutter Fundamentals (Stateless vs Stateful widgets, widget/element/render tree, Navigator 2.0 & go_router, form validation, implicit/explicit animations, Hero transitions, localization with ARB files, accessibility semantics). Pre-passed modules: Mobile Architecture, Dart Essentials, Flutter Fundamentals.
Capstone: End-to-End Flutter E-Commerce App

**Sprint 3 — Advanced Mobile Development (6h 49m | Mobile Track)**
Core topics: Data Handling (Dio HTTP client with interceptors & retry logic, json_serializable/Freezed models, Google Maps & Geolocator, Hive local storage with TypeAdapters, cache-first & stale-while-revalidate strategies). State Management (Dart Streams & StreamControllers, BLoC architecture: Events/States/Bloc class, flutter_bloc: BlocProvider/BlocBuilder/BlocListener/BlocConsumer, Cubit, HydratedCubit for persistence, MultiBlocProvider, Provider). Firebase Integration (FlutterFire CLI setup, Firebase Auth: email/password/Google/phone OTP/auth state streams, Firestore: CRUD/real-time snapshots/compound queries/pagination/security rules). Device Features (permission_handler, image picker, sensors_plus: accelerometer/gyroscope, local_auth biometrics, Bluetooth/BLE, NFC tags, FCM push notifications). Clean Architecture (SOLID principles in Dart, Design Patterns: Singleton/Factory/Builder/Observer/Strategy, Domain/Data/Presentation layers, get_it Dependency Injection, feature-first folder structure).
Capstone: Flutter Community App with Architecture, Native Features & Beta APK Release

**Sprint 4 — Mobile Deployment & Testing (6h 58m | Systems + QA + Mobile Tracks)**
Core topics: Docker Containerization (Dockerfile syntax: FROM/RUN/COPY/EXPOSE/CMD, multi-stage builds for image size reduction, docker-compose for multi-container apps, volumes, bridge/host/custom networks, pushing to Docker Hub, health checks). Manual Mobile Testing (STLC phases, test case design with equivalence partitioning/BVA, bug lifecycle with Jira, Requirements Traceability Matrix, exploratory testing, mobile-specific: gesture/orientation/OS version testing). Appium Automation (UIAutomator2 driver, Appium Inspector for element identification, W3C Actions API for touch gestures, Page Object Model, TestNG test suites, Allure reporting).
Capstone: StreetBite — Hyperlocal Food Discovery & Ordering App (graduation project)

**Sprint 5 — Delivery, Leadership & Career (17h 37m | Career Track)**
Core topics: Design Thinking (Stanford d.school framework, JTBD theory, empathy→define→ideate→prototype→test cycle). Business Etiquette & Communication (DISC profiles, active listening, STAR feedback, assertive communication, conflict resolution). Presentation Skills (Pyramid Principle, vocal variety, presenting to non-technical stakeholders). Project Management (PMBoK, triple constraint, EVM: PV/EV/AC/SPI/CPI, RAID log, burn-down charts). Agile & Scrum (Agile Manifesto, Scrum ceremonies, INVEST user stories, MoSCoW/WSJF prioritization, velocity, SAFe overview). Leadership (situational leadership, upward management, delegation, multigenerational teams). CV Writing (ATS optimization, quantifying impact, ATS keyword strategy). LinkedIn Branding (SSI index, content strategy, creator mode). Interview Mastery (STAR model, 88 technical+behavioral Q&A, salary negotiation).

## TEXT CAPSULE INGESTION
When the user provides raw text, bullet points, or lesson notes, AUTOMATICALLY structure the response as:
1. **Core Takeaways** — Extract 3-5 architecture/engineering principles from the content
2. **Interview Flashcards** — Generate 4-6 Q&A pairs ("Q: ... / A: ...") based on the material
3. **Actionable Code/Commands** — Provide concrete Dart/Flutter snippets or shell commands that apply the concepts

## TASK REVIEWER RUBRIC
When reviewing student submissions:
- ✅ **Strengths** — 3 specific things done well with Flutter/Dart idiom references
- ⚠️ **Improvements** — Issues with why they matter (testability, performance, UX)
- 💡 **Suggestions** — Numbered, actionable steps referencing specific packages/patterns
- 📊 **Score** — /10 with brief justification
- Always reference real Flutter ecosystem tools: flutter_bloc, get_it, dio, go_router, freezed

## LINKEDIN POST QUALITY STANDARDS
- Hook in first line that does NOT start with "I'm excited", "Thrilled to", or "Humbled by"
- Name SPECIFIC tools (BLoC events, Dio interceptors, Wireshark filters, docker-compose, UIAutomator2)
- Distinguish "what I built" from "what I learned" — both must be in every post
- Include a concrete challenge + how it was technically solved
- End with a genuine technical question inviting comments
- 8-10 hashtags mixing broad (#Flutter, #MobileDev) and niche (#BLoC, #CleanArchitecture, #AccSprints)
- 200-280 words. Never use: "incredible journey", "super excited", "humbled", "truly grateful"
`

// ─── High-quality mock responses (for missing/invalid API key) ─────────────
const MOCK_RESPONSES: Record<string, string> = {
  'task-checker': `## 📋 Code Review Analysis

### ✅ Strengths
- Clean architecture with clear separation of concerns using domain/data/presentation layers
- Proper use of \`BlocBuilder\` with \`buildWhen\` to prevent unnecessary rebuilds
- Consistent naming conventions following Dart style guide (lowerCamelCase, PascalCase)

### ⚠️ Areas to Improve
- **Error Handling**: Add \`BlocListener\` with \`listenWhen\` for side effects — don't handle errors inside \`BlocBuilder\`
- **Null Safety**: Some late-initialized fields could be \`final\` with a factory constructor instead
- **Testing Gap**: \`UseCases\` must have corresponding unit tests using \`mocktail\`

### 💡 Specific Suggestions
1. Replace raw \`setState\` calls with Cubit events for testability — \`emit(MyState.loading())\`
2. Use \`sealed class\` (Dart 3+) for exhaustive state pattern matching in BLoC
3. Extract repository calls into \`UseCase\` classes — one public method each (SRP)
4. Add \`@freezed\` annotation to state classes for \`copyWith\`, \`==\`, and \`toString\`

### 📊 Score: **8 / 10**
Solid production-ready work. Applying sealed states and use-case separation will push this to senior level.`,

  'interview': `## 🎯 Technical Interview Question

**"Walk me through architecting a Flutter ride-sharing tracker screen using BLoC + Clean Architecture. What layers exist, how do they communicate, and how do you handle real-time location updates?"**

| STAR Phase | What to Cover |
|-----------|--------------|
| **Situation** | Production app context — real-time constraints, offline resilience |
| **Task** | Designing the location tracking feature with testable architecture |
| **Action** | Domain: \`LocationEntity\`, \`TrackRideUseCase\` → Data: \`LocationRepository\` impl, \`GeolocatorDataSource\` → Presentation: \`RideBloc\` with \`LocationUpdated\` event |
| **Result** | Stream-based real-time updates, unit-tested UseCase, BlocBuilder rebuilds only map widget |

**Follow-up probes:**
- "How would you handle background location permission denied mid-ride?"
- "Walk me through a unit test for \`TrackRideUseCase\` using \`MockLocationRepository\`"
- "How do you prevent BLoC state emissions from flooding the UI at 1Hz GPS updates?"`,

  'linkedin': `## 🚀 LinkedIn Post

Something I built last week changed how I think about mobile architecture forever.

After completing the **ACC × Sprints Flutter Bootcamp Sprint 3**, I shipped a production-grade app using Clean Architecture + BLoC — and the difference from my previous Flutter code is night and day.

**3 things that actually hit different:**

🏗️ Separating \`UseCase\` classes from \`Repository\` interfaces forces you to think about *business logic first, implementation second*. The result: I could swap Firestore for a local Hive mock in 2 minutes during testing

🔄 \`BLoC\` with \`sealed class\` states makes impossible states impossible. No more booleans like \`isLoading && hasError\`

🧪 Writing \`mocktail\` unit tests before the UI forced me to design clean APIs — the UI becomes a consumer, not an orchestrator

What I built: A community app with real-time Firestore feeds, FCM push notifications, biometric auth, and an offline-first caching layer using \`HydratedCubit\`.

What would you refactor if you could restart your last project with clean architecture?

#Flutter #CleanArchitecture #BLoC #Dart #MobileDev #Firebase #AccSprints #TechEgypt #FlutterDev #SoftwareArchitecture`,

  'capsule-digest': `## 🎯 Core Takeaways

1. **Separation of Concerns** — Each layer (Domain, Data, Presentation) has a single, well-defined responsibility. Domain layer contains pure business logic with zero framework dependencies.
2. **Dependency Inversion** — Higher-level modules define abstract interfaces; lower-level modules implement them. This enables mock injection for testing.
3. **Unidirectional Data Flow** — UI emits Events → BLoC processes → emits States → UI rebuilds. No bidirectional state mutation.
4. **Fail-Fast with Sealed Classes** — Dart sealed classes make exhaustive state matching compiler-enforced, eliminating runtime state enum mismatches.
5. **Repository Pattern** — Abstracts the data source (Firestore, Hive, REST) behind a single interface so the domain layer doesn't care where data comes from.

---

## 🃏 Recall Flashcards

**Q:** What is the core principle that BLoC enforces?
**A:** Unidirectional data flow — Events go in, States come out. The UI never directly mutates state.

**Q:** Why use \`sealed class\` for BLoC states instead of a regular abstract class?
**A:** Sealed classes enable exhaustive \`switch\` expressions — the Dart compiler errors if you miss a state variant, preventing runtime bugs.

**Q:** What does \`HydratedCubit\` add over a regular \`Cubit\`?
**A:** Automatic state persistence to local storage. The last emitted state is rehydrated on app restart — perfect for user preferences and offline-first features.

---

## 💻 Actionable Code

\`\`\`dart
// BLoC with sealed states (Dart 3+)
sealed class AuthState {}
class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthSuccess extends AuthState { final User user; AuthSuccess(this.user); }
class AuthError extends AuthState { final String message; AuthError(this.message); }

// In BlocBuilder — exhaustive pattern matching
BlocBuilder<AuthBloc, AuthState>(
  builder: (context, state) => switch (state) {
    AuthInitial() => const LoginForm(),
    AuthLoading() => const CircularProgressIndicator(),
    AuthSuccess(:final user) => HomeScreen(user: user),
    AuthError(:final message) => ErrorWidget(message),
  },
)
\`\`\`

---

## 📋 NotebookLM Format

**Topic:** BLoC Architecture & Clean Architecture in Flutter

**Key Concepts:**
- BLoC Pattern: Events → Bloc → States → UI
- Clean Architecture: Domain / Data / Presentation layers
- Sealed classes for compile-time exhaustive state matching
- HydratedCubit for persistent state across restarts
- Repository pattern abstracts data sources

**Interview Questions:**
1. Explain unidirectional data flow in BLoC
2. When would you use Cubit vs BLoC?
3. How do you inject dependencies in Clean Architecture using get_it?`,

  'generate-schedule': `## 📅 Today's Study Plan

**Flutter Fundamentals — Animations** — 45m
→ Use DartPad to prototype implicit animations first, then upgrade to explicit with \`AnimationController\`. Focus on \`CurvedAnimation\` + \`Tween\` combinations.

**BLoC Pattern — Events & States** — 50m
→ Start with a simple \`CounterBloc\` from scratch without packages first. Understand the \`mapEventToState\` flow before adding \`flutter_bloc\`.

**Firebase Auth — Email + Google Sign-In** — 35m
→ Implement email/password first (simpler), then add Google Sign-In. Always handle \`PlatformException\` for auth failures.

---

## ⚡ Quick Win

Open your terminal right now and run:
\`\`\`bash
dart create -t console pomodoro_cli && cd pomodoro_cli
\`\`\`
Build a 5-line Pomodoro CLI in pure Dart. It reinforces async/await, \`Duration\`, and \`DateTime\` — all used constantly in Flutter — in under 15 minutes.`,
}

// ─── Sprint content for LinkedIn milestone posts ───────────────────────────
const SPRINT_CONTEXT: Record<number, string> = {
  1: 'Sprint 1 — Engineering Foundations: covered Software Engineering & SDLC, Git version control with GitHub, PostgreSQL database design (ERD, normalization, JOINs), Linux Bash operations and pipelines, and Computer Networks (OSI/TCP-IP, subnetting, Wireshark packet analysis, Netcat). Total: 22h 55m across 11 modules.',
  2: 'Sprint 2 — Flutter Essentials: covered UX Design (Double Diamond, WCAG, user research), Visual Design & UI (Gestalt, color theory, Figma dev handoff), Dart Language (null safety, OOP, async), Flutter Fundamentals (widgets, navigation with go_router, animations, localization). Total: 12h 24m.',
  3: 'Sprint 3 — Advanced Mobile: covered Data Handling (Dio, json_serializable, Google Maps, Hive), BLoC State Management (Events/States, flutter_bloc, Cubit, HydratedCubit), Firebase (Auth, Firestore, security rules), Device Features (sensors, biometrics, FCM), Clean Architecture (SOLID, design patterns, get_it DI). Total: 6h 49m.',
  4: 'Sprint 4 — Testing & Deployment: covered Docker containerization (Dockerfile, multi-stage builds, docker-compose), Manual Mobile Testing (STLC, test cases, Jira bug management, RTM), Appium Automation (UIAutomator2, Page Object Model, TestNG, Allure). Culminated in the StreetBite graduation capstone. Total: 6h 58m.',
  5: 'Sprint 5 — Career & Leadership: covered Design Thinking, DISC communication styles, Agile/Scrum (INVEST stories, MoSCoW/WSJF), Project Management (EVM, RAID log), ATS CV writing, LinkedIn personal branding, and comprehensive interview preparation (STAR model, 88 Q&A). Total: 17h 37m.',
}

const TRACK_CONTEXT: Record<string, string> = {
  Mobile: 'Mobile Track — Flutter & Dart core (Sprint 2 & 3 + graduation capstone): Dart OOP/null safety, Flutter widget lifecycle, go_router navigation, BLoC architecture with Events/States, Firebase Auth & Firestore, Google Maps/Geolocator, Hive local storage, Device Features (biometrics, FCM, sensors), Clean Architecture with get_it DI. Culminated in StreetBite — hyperlocal food discovery app.',
  Systems: 'Systems Track — Engineering & DevOps (Sprint 1 & 4 overlap): Software Engineering fundamentals (UML, SDLC), Git & GitHub flow, PostgreSQL database design (ERD, 3NF normalization, advanced JOINs), Linux Bash pipelines (grep/awk/sed, bash scripting), Computer Networks (OSI layers, subnetting, Wireshark/Netcat analysis), Docker containerization (multi-stage Dockerfiles, docker-compose orchestration).',
  Quality: 'Quality Track — Design & QA Engineering (Sprint 2 & 4): UX Design (Double Diamond, WCAG 2.1, empathy mapping, Figma), Visual Design (Gestalt principles, color theory, design tokens, component libraries), Manual Mobile Testing (STLC, test case design, bug lifecycle, Jira RTM), Appium Automation Testing (UIAutomator2, Page Object Model, W3C touch actions, TestNG, Allure reporting).',
  Career: 'Career Track (Sprint 5): Design Thinking (JTBD, Stanford d.school), Communication & DISC profiling, Agile/Scrum mastery (INVEST stories, velocity, MoSCoW/WSJF), Project Management (EVM, triple constraint, burn-down charts), CV writing with ATS optimization, LinkedIn personal branding (SSI, content strategy), Interview mastery (88 technical + behavioral Q&A, salary negotiation).',
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      mode: string
      moduleTitle?: string
      userInput?: string
      scope?: 'module' | 'sprint' | 'track'
      sprintNumber?: number
      sprintName?: string
      trackName?: string
    }

    const {
      mode,
      moduleTitle = '',
      userInput = '',
      scope = 'module',
      sprintNumber,
      sprintName,
      trackName,
    } = body

    const apiKey = process.env.GEMINI_API_KEY

    const CANDIDATE_MODELS = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-3.6-flash',
    ]

    // ── HEALTH CHECK ────────────────────────────────────────────────────────
    if (mode === 'health-check') {
      if (!apiKey || apiKey.length < 20 || apiKey.includes('your_gemini')) {
        return NextResponse.json(
          { status: 'error', message: 'GEMINI_API_KEY is missing or not configured in .env.local' },
          { status: 200 }
        )
      }
      try {
        const t0 = Date.now()
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(apiKey)

        let activeModelName = ''
        let lastError: Error | null = null

        for (const modelName of CANDIDATE_MODELS) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName })
            await model.generateContent('Reply with the single word: CONNECTED')
            activeModelName = modelName
            break
          } catch (err) {
            lastError = err as Error
            continue
          }
        }

        if (!activeModelName) {
          throw lastError || new Error('No candidate Gemini model responded')
        }

        const latency = Date.now() - t0
        return NextResponse.json({ status: 'ok', model: activeModelName, latency })
      } catch (err) {
        const msg = (err as Error).message ?? 'Unknown API error'
        return NextResponse.json({ status: 'error', message: msg })
      }
    }

    // ── MOCK MODE ───────────────────────────────────────────────────────────
    const isMockMode = !apiKey || apiKey.includes('your_gemini') || apiKey.length < 20

    if (isMockMode) {
      const mockText =
        MOCK_RESPONSES[mode] ??
        `## 🤖 AI Response\n\nMock response for "${moduleTitle}". Add \`GEMINI_API_KEY\` to \`.env.local\` for live AI.`
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          for (const word of mockText.split(' ')) {
            controller.enqueue(encoder.encode(word + ' '))
            await new Promise((r) => setTimeout(r, 15))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-AI-Mode': 'mock' },
      })
    }

    // ── REAL GEMINI STREAMING ──────────────────────────────────────────────
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)

    // Build linkedin prompt based on scope
    let linkedinPrompt = ''
    if (mode === 'linkedin') {
      if (scope === 'sprint' && sprintNumber && SPRINT_CONTEXT[sprintNumber]) {
        linkedinPrompt = `Generate a high-impact LinkedIn milestone post celebrating the COMPLETION of an entire bootcamp sprint.

Sprint Context:
${SPRINT_CONTEXT[sprintNumber]}
Sprint Name: "${sprintName ?? `Sprint ${sprintNumber}`}"
Personal notes from the student: ${userInput || '(none provided)'}

Requirements:
- Hook that names the sprint milestone specifically (e.g. "Sprint 1 of 5 done.")
- List 3 specific tools/technologies mastered with a brief insight each
- Mention the capstone or final project that was built
- Include one specific technical challenge overcome and how
- Authentic engineer voice — reference specific commands, patterns, or debugging stories
- Close with a genuine question about one of the technical topics
- 240-280 words, 8-10 hashtags`
      } else if (scope === 'track' && trackName && TRACK_CONTEXT[trackName]) {
        linkedinPrompt = `Generate a high-impact LinkedIn portfolio post celebrating MASTERY of an entire learning track in the bootcamp.

Track Context:
${TRACK_CONTEXT[trackName]}
Personal notes: ${userInput || '(none provided)'}

Requirements:
- Hook that signals a major domain achievement (not just finishing a course)
- Name 4-5 specific technologies/tools mastered with depth (not just listing them)
- Describe the culminating project/capstone built and its technical decisions
- Include what you would design differently with this knowledge
- Frame it as career-level positioning (you can now do X in production)
- Close with a call-to-action for collaborators, hiring managers, or mentees
- 260-300 words, 10 targeted hashtags`
      } else {
        // Module-level linkedin
        linkedinPrompt = `Write a high-engagement LinkedIn post celebrating completing: "${moduleTitle}".
Student context: ${userInput || 'No additional context provided.'}

Requirements:
- Authentic first-person engineer voice
- 3 specific technical takeaways with emojis
- One genuine "aha moment" or mindset shift from this module
- Specific tools/patterns named (not vague references)
- Engaging question for comments
- 200-250 words, 8-10 hashtags mixing broad and niche`
      }
    }

    const prompts: Record<string, string> = {
      'task-checker': `Module: "${moduleTitle}"
Student submission:
\`\`\`
${userInput || '(no submission — provide general guidance for this module)'}
\`\`\`
Apply the Task Reviewer Rubric from your system instructions. Be specific, use Flutter/Dart idiom references.`,

      'interview': `The student completed: "${moduleTitle}"
${userInput ? `Their context: ${userInput}` : ''}
Generate ONE realistic technical or behavioral interview question for this module. Include STAR breakdown table and 3 realistic follow-up probes from an interviewer at a top Egyptian tech company.`,

      linkedin: linkedinPrompt,

      'capsule-digest': `The student has shared raw notes from a lesson capsule. Topic context: "${moduleTitle || 'Flutter Bootcamp'}".

Raw notes:
\`\`\`
${userInput || '(no content provided)'}
\`\`\`

Following your system instructions for TEXT CAPSULE INGESTION, structure this into all 4 sections:
1. 🎯 Core Takeaways (3-5 principles)
2. 🃏 Recall Flashcards (exactly 3 Q/A pairs in "**Q:** / **A:**" format)  
3. 💻 Actionable Code/Commands (1-3 concrete Dart/Flutter/shell examples)
4. 📋 NotebookLM Format (clean structured summary for import — no code fences)`,

      'generate-schedule': `You are a Principal Software Engineer & Technical Mentor conducting an adaptive study session design.

The student has ${moduleTitle.replace('Available: ', '').replace(', Energy: ', ' available, energy level: ')} today.

## Eligible Unlocked Modules (prerequisite-checked, DAG-ordered):
${userInput}

## Your Mission:
Design a laser-focused study session using **Elastic Time-Boxing**:
- **Core Mission** = 75–85% of the student's available time. Select 1–3 modules that maximally advance the student.
- **Bonus Stretch Goal** = Exactly 15–25 minutes. One optional high-leverage micro-task for when the student finishes early.
- **Buffer** = The remaining minutes. Display this as a readiness margin.

## Energy-Matching Rules:
- deep-code: Prioritize architecture, BLoC, Docker, Clean Architecture, SQL/database modules
- balanced: Mix one heavy module (Flutter/Dart coding) + one lighter conceptual module
- micro: Short videos, soft skills (Sprint 5 Career track), UX/Design, micro-learning badges

## Output Format (respond ONLY with this structure — no preamble):

---SCHEDULE_START---
TOTAL_MINUTES: [number]
STRATEGY: [2-3 sentences in Arabic explaining WHY these modules were chosen — rationale based on their sprint position, energy, and prerequisites]

CORE_MISSION:
- MODULE_ID: [module_id or "custom"]
  TITLE: [exact module title]
  DURATION_MINUTES: [number]
  SPRINT: [sprint number]
  TRACK: [track name]
  WHY: [1 concise sentence — what makes this the priority right now]
  POMODORO_TIP: [specific technique: "Use 25/5 Pomodoro × 2 rounds. Focus on X concept first."]

BONUS_GOAL:
  TITLE: [specific micro-task, e.g. "Review BLoC Events flashcards" or "Sketch ERD for capstone idea"]
  DURATION_MINUTES: [15-25]
  DESCRIPTION: [exactly what to do — actionable, specific, no vague advice]

BUFFER_MINUTES: [remaining minutes]
---SCHEDULE_END---`,
    }

    const prompt = prompts[mode]
    if (!prompt) return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 })

    let result: any = null
    let activeModelName = ''
    let lastError: Error | null = null

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
        })
        result = await model.generateContentStream(prompt)
        activeModelName = modelName
        break
      } catch (err) {
        console.warn(`[Gemini Fallback] ${modelName} failed, falling back:`, (err as Error).message)
        lastError = err as Error
        continue
      }
    }

    if (!result) {
      throw lastError || new Error('All candidate Gemini models failed')
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-AI-Mode': 'gemini',
        'X-AI-Model': activeModelName,
      },
    })
  } catch (err) {
    console.error('[AI Route Error]', err)
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 })
  }
}
