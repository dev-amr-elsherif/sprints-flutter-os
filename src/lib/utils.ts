import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  TrackType,
  TrackMeta,
  CurriculumModule,
  GlobalStats,
  TrackStats,
  ItemStatus,
} from './types'
import { CURRICULUM } from './curriculum'

// ─── Tailwind className merge ──────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Track metadata registry ──────────────────────────────────────────────────
export const TRACK_META: Record<TrackType, TrackMeta> = {
  Mobile: {
    id: 'Mobile',
    label: 'Mobile & Flutter Core',
    shortLabel: 'Flutter',
    emoji: '📱',
    color: '#06b6d4',
    shadowClass: 'shadow-glow-cyan',
    borderClass: 'border-cyan-400/40',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-400/10',
    glowClass: 'shadow-glow-cyan',
    description: 'Dart, Flutter, State Management, Firebase & Clean Architecture',
  },
  Systems: {
    id: 'Systems',
    label: 'Systems, DevOps & Backend',
    shortLabel: 'Systems',
    emoji: '⚙️',
    color: '#f59e0b',
    shadowClass: 'shadow-glow-amber',
    borderClass: 'border-amber-400/40',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-400/10',
    glowClass: 'shadow-glow-amber',
    description: 'SE Fundamentals, Git, SQL, Linux, Networking & Docker',
  },
  Quality: {
    id: 'Quality',
    label: 'Product Design & Quality Engineering',
    shortLabel: 'Design/QA',
    emoji: '🎨',
    color: '#a855f7',
    shadowClass: 'shadow-glow-purple',
    borderClass: 'border-purple-400/40',
    textClass: 'text-purple-400',
    bgClass: 'bg-purple-400/10',
    glowClass: 'shadow-glow-purple',
    description: 'UX Foundations, Visual Design, STLC & Appium Automation',
  },
  Career: {
    id: 'Career',
    label: 'Leadership, Agile & Career Readiness',
    shortLabel: 'Career',
    emoji: '🚀',
    color: '#10b981',
    shadowClass: 'shadow-glow-emerald',
    borderClass: 'border-emerald-400/40',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400/10',
    glowClass: 'shadow-glow-emerald',
    description: 'Design Thinking, Agile, Project Mgmt & Career Readiness',
  },
}

export const ALL_TRACKS: TrackType[] = ['Mobile', 'Systems', 'Quality', 'Career']

// ─── Status cycling ────────────────────────────────────────────────────────────
export const STATUS_CYCLE: Record<ItemStatus, ItemStatus> = {
  'not-started': 'in-progress',
  'in-progress': 'completed',
  'completed': 'not-started',
  'passed': 'in-progress',  // clicking "passed" re-opens for re-study
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'passed': 'Passed ✓',
}

// ─── Badge display config ─────────────────────────────────────────────────────
export const BADGE_CONFIG = {
  'task-required': { label: 'Task', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  'capstone': { label: 'Capstone', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  'quiz': { label: 'Quiz', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  'bonus': { label: 'Bonus', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  'passed': { label: '✓ Passed', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  'high-energy': { label: '⚡ Deep Work', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  'micro-learning': { label: '🌙 Micro', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
} as const

// ─── Lesson type icons (as emoji) ─────────────────────────────────────────────
export const LESSON_TYPE_ICON: Record<string, string> = {
  video: '▶',
  capsule: '💊',
  quiz: '📝',
  task: '📋',
  capstone: '🏆',
  lab: '🔬',
  survey: '📊',
}

// ─── Derive effective status for a module ─────────────────────────────────────
export function getEffectiveStatus(
  moduleId: string,
  isPassed: boolean | undefined,
  moduleStatuses: Record<string, ItemStatus>
): ItemStatus {
  const stored = moduleStatuses[moduleId]
  if (stored) return stored
  if (isPassed) return 'passed'
  return 'not-started'
}

// ─── Parse "3h 40m", "45m", "2h" → minutes ───────────────────────────────────
export function parseDurationToMinutes(duration: string): number {
  const hMatch = duration.match(/(\d+)h/)
  const mMatch = duration.match(/(\d+)m/)
  return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
}

// ─── Format minutes → "3h 40m" ───────────────────────────────────────────────
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// ─── Official sprint durations (minutes) from LMS ────────────────────────────
// Sprint 1: 22h 55m, Sprint 2: 12h 24m, Sprint 3: 6h 49m, Sprint 4: 6h 58m, Sprint 5: 17h 37m
export const SPRINT_OFFICIAL_MINUTES: Record<number, number> = {
  1: 1375,
  2: 744,
  3: 409,
  4: 418,
  5: 1057,
}

// Pre-compute sprint topic totals once (used for proportional duration allocation)
let _sprintTopicTotals: Record<number, number> | null = null
function getSprintTopicTotals(): Record<number, number> {
  if (_sprintTopicTotals) return _sprintTopicTotals
  _sprintTopicTotals = {}
  for (const m of CURRICULUM) {
    _sprintTopicTotals[m.sprint] = (_sprintTopicTotals[m.sprint] ?? 0) + m.totalTopicsCount
  }
  return _sprintTopicTotals
}

/**
 * Returns calibrated module duration in minutes, proportional to its topic count
 * within the official sprint total — eliminating the 139h bug.
 */
export function getModuleMinutes(module: { sprint: number; totalTopicsCount: number; totalDurationText: string }): number {
  const sprintTotals = getSprintTopicTotals()
  const sprintTopics = sprintTotals[module.sprint]
  const sprintMins = SPRINT_OFFICIAL_MINUTES[module.sprint]
  if (!sprintTopics || !sprintMins) return parseDurationToMinutes(module.totalDurationText)
  return Math.round((module.totalTopicsCount / sprintTopics) * sprintMins)
}

// ─── Compute global stats ─────────────────────────────────────────────────────
export function computeStats(
  moduleStatuses: Record<string, ItemStatus>
): GlobalStats {
  const byTrack = {} as Record<TrackType, TrackStats>

  let totalModules = 0
  let completedModules = 0
  let inProgressModules = 0
  let passedModules = 0
  let totalMinutes = 0
  let completedMinutes = 0

  for (const track of ALL_TRACKS) {
    const modules = CURRICULUM.filter((m) => m.track === track)
    const tTotal = modules.length
    let tCompleted = 0
    let tInProgress = 0
    let tPassed = 0
    let tTotalMin = 0
    let tCompletedMin = 0

    for (const m of modules) {
      const effectiveStatus = getEffectiveStatus(m.id, m.isPassed, moduleStatuses)
      const moduleMin = getModuleMinutes(m) // ← calibrated duration

      tTotalMin += moduleMin

      if (effectiveStatus === 'completed') {
        tCompleted++
        tCompletedMin += moduleMin
      } else if (effectiveStatus === 'passed') {
        tPassed++
        tCompletedMin += moduleMin
      } else if (effectiveStatus === 'in-progress') {
        tInProgress++
        tCompletedMin += Math.round(moduleMin * 0.5)
      }
    }

    byTrack[track] = {
      track,
      total: tTotal,
      completed: tCompleted,
      inProgress: tInProgress,
      passed: tPassed,
      notStarted: tTotal - tCompleted - tInProgress - tPassed,
      percentage: tTotal > 0 ? Math.round(((tCompleted + tPassed) / tTotal) * 100) : 0,
      totalMinutes: tTotalMin,
      completedMinutes: tCompletedMin,
    }

    totalModules += tTotal
    completedModules += tCompleted
    inProgressModules += tInProgress
    passedModules += tPassed
    totalMinutes += tTotalMin
    completedMinutes += tCompletedMin
  }

  return {
    totalModules,
    completedModules,
    inProgressModules,
    passedModules,
    overallPercentage:
      totalModules > 0
        ? Math.round(((completedModules + passedModules) / totalModules) * 100)
        : 0,
    totalMinutes,
    completedMinutes,
    byTrack,
  }
}

// ─── Compute lesson progress for a module (0–100) ─────────────────────────────
export function computeLessonProgress(
  lessons: CurriculumModule['lessons'],
  lessonStatuses: Record<string, boolean>,
  _isPassed?: boolean
): number {
  if (!lessons || lessons.length === 0) return 0
  const checked = lessons.filter((l) => lessonStatuses[l.id] === true).length
  return Math.round((checked / lessons.length) * 100)
}

// ─── DAG helper: get eligible (unlocked, not completed) modules ───────────────
/**
 * Returns modules that are:
 *  1. Not yet completed/passed in moduleStatuses
 *  2. All prerequisites are completed or passed (or have no prerequisites)
 *
 * Result is sorted: in-progress first, then by sprint/track order.
 */
export function getEligibleNextModules(
  moduleStatuses: Record<string, ItemStatus>
): CurriculumModule[] {
  const completedIds = new Set(
    CURRICULUM
      .filter((m) => {
        const s = getEffectiveStatus(m.id, m.isPassed, moduleStatuses)
        return s === 'completed' || s === 'passed'
      })
      .map((m) => m.id)
  )

  return CURRICULUM.filter((m) => {
    const status = getEffectiveStatus(m.id, m.isPassed, moduleStatuses)
    // Exclude already completed / passed
    if (status === 'completed' || status === 'passed') return false
    // Check all prerequisites are met
    if (m.prerequisites && m.prerequisites.length > 0) {
      return m.prerequisites.every((prereqId) => completedIds.has(prereqId))
    }
    return true
  }).sort((a, b) => {
    // In-progress floats to top
    const aStatus = getEffectiveStatus(a.id, a.isPassed, moduleStatuses)
    const bStatus = getEffectiveStatus(b.id, b.isPassed, moduleStatuses)
    if (aStatus === 'in-progress' && bStatus !== 'in-progress') return -1
    if (bStatus === 'in-progress' && aStatus !== 'in-progress') return 1
    // Then by sprint, then by curriculum order (index)
    if (a.sprint !== b.sprint) return a.sprint - b.sprint
    return CURRICULUM.indexOf(a) - CURRICULUM.indexOf(b)
  })
}

// ─── Download JSON helper ─────────────────────────────────────────────────────
export function downloadJson(data: string, filename: string) {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sprint display info ──────────────────────────────────────────────────────
export const SPRINT_META: Record<
  number,
  { name: string; duration: string; emoji: string; color: string }
> = {
  1: { name: 'Engineering Foundations', duration: '22h 55m', emoji: '🏗️', color: '#f59e0b' },
  2: { name: 'Flutter Development Essentials', duration: '12h 24m', emoji: '📱', color: '#06b6d4' },
  3: { name: 'Advanced Mobile Development', duration: '6h 49m', emoji: '🚀', color: '#06b6d4' },
  4: { name: 'Mobile Deployment & Testing', duration: '6h 58m', emoji: '🧪', color: '#a855f7' },
  5: { name: 'Delivery, Leadership & Career', duration: '17h 37m', emoji: '🎓', color: '#10b981' },
}
