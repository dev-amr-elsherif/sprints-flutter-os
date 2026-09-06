// ─── Track (swimlane) identifiers ─────────────────────────────────────────────
export type TrackType = 'Mobile' | 'Systems' | 'Quality' | 'Career'

// ─── Sprint numbers ────────────────────────────────────────────────────────────
export type SprintNumber = 1 | 2 | 3 | 4 | 5

// ─── Module / lesson lifecycle ────────────────────────────────────────────────
export type ItemStatus = 'not-started' | 'in-progress' | 'completed' | 'passed'

// ─── Board view mode ──────────────────────────────────────────────────────────
export type ViewMode = 'parallel-tracks' | 'official-sprints'

// ─── AI Studio modes ──────────────────────────────────────────────────────────
export type AiMode = 'task-checker' | 'interview' | 'linkedin'

// ─── Energy filter ────────────────────────────────────────────────────────────
export type EnergyFilter = 'all' | 'high-energy' | 'micro-learning'

// ─── Individual lesson / content item ─────────────────────────────────────────
export interface LessonItem {
  id: string
  title: string
  duration?: string  // e.g. "4m 16s", "24s", "1h 30m"
  type: 'video' | 'capsule' | 'quiz' | 'task' | 'capstone' | 'survey' | 'lab'
}

// ─── A curriculum module (one LMS row) ────────────────────────────────────────
export interface CurriculumModule {
  id: string
  sprint: SprintNumber
  sprintName: string
  track: TrackType
  title: string
  totalTopicsCount: number
  totalDurationText: string  // e.g. "3h 40m", "45m"
  taskName?: string
  isTask: boolean
  isCapstone: boolean
  isPassed?: boolean         // true = pre-marked as passed in the LMS
  prerequisites?: string[]   // module IDs that must be completed first
  lessons: LessonItem[]
  badges: ('task-required' | 'capstone' | 'passed' | 'high-energy' | 'micro-learning')[]
}

// ─── Track display metadata ───────────────────────────────────────────────────
export interface TrackMeta {
  id: TrackType
  label: string
  shortLabel: string
  emoji: string
  color: string
  shadowClass: string
  borderClass: string
  textClass: string
  bgClass: string
  glowClass: string
  description: string
}

// ─── Per-track stats ──────────────────────────────────────────────────────────
export interface TrackStats {
  track: TrackType
  total: number
  completed: number
  inProgress: number
  passed: number
  notStarted: number
  percentage: number           // (completed + passed) / total * 100
  totalMinutes: number
  completedMinutes: number
}

// ─── Global stats ─────────────────────────────────────────────────────────────
export interface GlobalStats {
  totalModules: number
  completedModules: number
  inProgressModules: number
  passedModules: number
  overallPercentage: number
  totalMinutes: number
  completedMinutes: number
  byTrack: Record<TrackType, TrackStats>
}

// ─── Artifact vault ───────────────────────────────────────────────────────────
export interface ArtifactUrls {
  repoUrl?: string
  prUrl?: string
  demoUrl?: string
  savedAt?: string
}

// ─── Zustand store shape ──────────────────────────────────────────────────────
export interface ProgressStore {
  moduleStatuses: Record<string, ItemStatus>
  lessonStatuses: Record<string, boolean>   // lessonId → checked
  viewMode: ViewMode
  activeTrack: TrackType | 'all'
  activeSprint: SprintNumber | 'all'
  energyFilter: EnergyFilter
  aiDrawerOpen: boolean
  aiMode: AiMode
  selectedModuleId: string | null
  // Artifact vault
  artifacts: Record<string, ArtifactUrls>
  // Pomodoro / Zen
  zenMode: boolean
  focusedModuleId: string | null
  focusedTaskTitle: string | null          // display label on timer
  focusedTaskDurationSecs: number | null   // custom duration (seconds) injected from planner
  // Sherif OS Controller — active daily plan (non-persisted, set by Sherif dispatch)
  activeDailyPlan: DailyPlanSchedule | null

  // Actions
  cycleModuleStatus: (id: string, currentEffective: ItemStatus) => void
  setModuleStatus: (id: string, status: ItemStatus) => void
  toggleLesson: (lessonId: string, defaultChecked?: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setActiveTrack: (track: TrackType | 'all') => void
  setActiveSprint: (sprint: SprintNumber | 'all') => void
  setEnergyFilter: (filter: EnergyFilter) => void
  openAiDrawer: (mode: AiMode, moduleId: string) => void
  closeAiDrawer: () => void
  setAiMode: (mode: AiMode) => void
  exportProgress: () => string
  importProgress: (json: string) => boolean
  resetProgress: () => void
  resetAllProgress: () => void
  // Artifact vault actions
  saveTaskArtifact: (moduleId: string, urls: ArtifactUrls) => void
  // Pomodoro / Zen actions
  setZenMode: (v: boolean) => void
  setFocusedModule: (id: string | null) => void
  /** Inject a task into the Pomodoro timer from the planner or module card */
  setFocusedTask: (taskTitle: string, durationMinutes: number, moduleId?: string) => void
  /** Set or clear the active daily plan (dispatched by Sherif OS Controller) */
  setActiveDailyPlan: (plan: DailyPlanSchedule | null) => void
}

// ─── AI Daily Planner schedule types ─────────────────────────────────────────
export interface DailyPlanTask {
  moduleId: string
  title: string
  durationMinutes: number
  deliverableGoal: string
}

export interface DailyPlanSchedule {
  strategySummary: string
  focusTags: string[]
  totalAllocatedMinutes: number
  coreTasks: DailyPlanTask[]
  bonusTask: DailyPlanTask | null
  bufferMinutes: number
}

// ─── AI request payload ───────────────────────────────────────────────────────
export interface AiRequestPayload {
  mode: AiMode
  moduleTitle: string
  userInput?: string
}

// ─── Sherif OS Controller — Action Protocol ───────────────────────────────────
export type SherifActionType =
  | 'SET_VIEW'
  | 'SET_DAILY_PLAN'
  | 'SET_TIMER'
  | 'TOGGLE_LESSON'
  | 'SET_MODULE_STATUS'
  | 'NAVIGATE_TO_MODULE'
  | 'TOGGLE_ZEN_MODE'
  | 'SAVE_ARTIFACT'
  | 'RESET_PROGRESS'
  | 'TRIGGER_PLAN_GEN'

export type SherifAction =
  | { type: 'SET_VIEW'; payload: { viewMode: ViewMode; sprint?: SprintNumber | 'all' } }
  | { type: 'SET_DAILY_PLAN'; payload: DailyPlanSchedule }
  | { type: 'SET_TIMER'; payload: { durationMinutes: number; taskTitle: string; moduleId?: string } }
  | { type: 'TOGGLE_LESSON'; payload: { lessonId: string; completed: boolean } }
  | { type: 'SET_MODULE_STATUS'; payload: { moduleId: string; status: ItemStatus } }
  | { type: 'NAVIGATE_TO_MODULE'; payload: { moduleId: string } }
  | { type: 'TOGGLE_ZEN_MODE'; payload: { enabled: boolean } }
  | { type: 'SAVE_ARTIFACT'; payload: { moduleId: string; repoUrl?: string; prUrl?: string; demoUrl?: string } }
  | { type: 'RESET_PROGRESS'; payload: Record<string, never> }
  | { type: 'TRIGGER_PLAN_GEN'; payload: { hours: number; energy: 'deep' | 'balanced' | 'micro' } }


