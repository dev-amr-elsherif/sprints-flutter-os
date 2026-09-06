'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Zap,
  Brain,
  Moon,
  Send,
  Bot,
  Target,
  Gift,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Play,
  Timer,
  Lock,
  AlertTriangle,
  Shuffle,
  CheckCircle2,
  Circle,
  Tag,
} from 'lucide-react'
import { useProgressStore } from '@/store/progressStore'
import { CURRICULUM } from '@/lib/curriculum'
import { getEligibleNextModules, cn } from '@/lib/utils'
import type { DailyPlanSchedule, DailyPlanTask } from '@/lib/types'

// --- Types ---
type EnergyLevel = 'deep-code' | 'balanced' | 'micro'

// --- JSON schedule parser ---
function parseSchedule(raw: string): DailyPlanSchedule | null {
  const startIdx = raw.indexOf('---SCHEDULE_START---')
  const endIdx = raw.indexOf('---SCHEDULE_END---')
  if (startIdx === -1 || endIdx === -1) return null

  const block = raw.slice(startIdx + '---SCHEDULE_START---'.length, endIdx).trim()

  // Strip markdown code fences if present
  const stripped = block.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    const parsed = JSON.parse(stripped)
    if (!parsed.coreTasks || !Array.isArray(parsed.coreTasks)) return null
    return {
      strategySummary: parsed.strategySummary || '',
      focusTags: Array.isArray(parsed.focusTags) ? parsed.focusTags : [],
      totalAllocatedMinutes: Number(parsed.totalAllocatedMinutes) || 0,
      coreTasks: parsed.coreTasks.map((t: any) => ({
        moduleId: t.moduleId || '',
        title: t.title || '',
        durationMinutes: Number(t.durationMinutes) || 30,
        deliverableGoal: t.deliverableGoal || '',
      })),
      bonusTask: parsed.bonusTask
        ? {
            moduleId: parsed.bonusTask.moduleId || 'custom',
            title: parsed.bonusTask.title || '',
            durationMinutes: Number(parsed.bonusTask.durationMinutes) || 20,
            deliverableGoal: parsed.bonusTask.deliverableGoal || '',
          }
        : null,
      bufferMinutes: Number(parsed.bufferMinutes) || 0,
    }
  } catch {
    return null
  }
}

// --- Constants ---
const ENERGY_OPTIONS: { id: EnergyLevel; label: string; icon: React.ReactNode; short: string }[] = [
  { id: 'deep-code', label: 'Deep Code', icon: <Zap className="w-3 h-3" />, short: '⚡' },
  { id: 'balanced', label: 'Balanced', icon: <Brain className="w-3 h-3" />, short: '⚖️' },
  { id: 'micro', label: 'Micro', icon: <Moon className="w-3 h-3" />, short: '🌙' },
]

const HOUR_OPTIONS = [1, 2, 3, 4] as const

const FOCUS_TAG_COLOR: Record<string, string> = {
  'Systems Track': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Mobile Track': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Quality Track': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Career Track': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'High Analytical Focus': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Deep Code': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Balanced': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Micro Learning': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
}

// --- Lesson Checklist for a single core task card ---
function TaskLessonChecklist({ task }: { task: DailyPlanTask }) {
  const { lessonStatuses, toggleLesson } = useProgressStore()
  const module = useMemo(
    () => CURRICULUM.find((m) => m.id === task.moduleId),
    [task.moduleId]
  )

  if (!module || module.lessons.length === 0) {
    return (
      <p className="text-[11px] text-white/30 mt-2 px-1 italic">
        No granular lessons available — mark whole module from board.
      </p>
    )
  }

  const checkedCount = module.lessons.filter((l) => lessonStatuses[l.id] === true).length
  const total = module.lessons.length
  const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0

  return (
    <div className="mt-2.5 space-y-1.5">
      {/* Mini progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="text-[10px] font-mono text-cyan-400/60 shrink-0">
          {checkedCount}/{total} ({pct}%)
        </span>
      </div>

      {/* Lesson rows */}
      <div className="space-y-0.5 max-h-[380px] overflow-y-auto custom-scrollbar">
        {module.lessons.map((lesson) => {
          const checked = lessonStatuses[lesson.id] === true

          // Parse duration string like "4m 16s", "1h 30m", "24s" into minutes
          const parseLessonMinutes = (dur?: string): number => {
            if (!dur) return 25
            let m = 0
            const hMatch = dur.match(/(\d+)\s*h/)
            const mMatch = dur.match(/(\d+)\s*m/)
            if (hMatch) m += parseInt(hMatch[1]) * 60
            if (mMatch) m += parseInt(mMatch[1])
            return Math.max(1, m || 25)
          }

          return (
            <div key={lesson.id} className={cn('flex items-center gap-2 px-2 py-1 rounded-lg group hover:bg-white/[0.04] transition-all', checked ? 'opacity-60' : 'opacity-100')}>
              {/* Checkbox toggle */}
              <button
                onClick={() => toggleLesson(lesson.id)}
                className="shrink-0 flex-shrink-0"
              >
                {checked ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors" />
                )}
              </button>

              {/* Title */}
              <span className={cn('text-[11px] leading-snug flex-1 text-left min-w-0 break-words', checked ? 'text-white/30 line-through' : 'text-white/65')}>
                {lesson.title}
              </span>

              {/* Duration + focus button */}
              <div className="flex items-center gap-1 shrink-0">
                {lesson.duration && (
                  <span className="text-[10px] font-mono text-white/20">{lesson.duration}</span>
                )}
                <button
                  onClick={() => useProgressStore.getState().setFocusedTask(lesson.title, parseLessonMinutes(lesson.duration), task.moduleId)}
                  title={`Focus Pomodoro on: ${lesson.title}`}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-cyan-400/70 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/15 transition-all"
                >
                  <Play className="w-2 h-2" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Core Task Card ---
function CoreTaskCard({
  task,
  index,
  eligibleModules,
  currentPlanModuleIds,
  onSwap,
}: {
  task: DailyPlanTask
  index: number
  eligibleModules: typeof CURRICULUM
  currentPlanModuleIds: string[]
  onSwap: (index: number, newTask: DailyPlanTask) => void
}) {
  const [lessonsOpen, setLessonsOpen] = useState(false)

  const handleSwap = useCallback(() => {
    const candidate = eligibleModules.find(
      (m) => !currentPlanModuleIds.includes(m.id) && m.id !== task.moduleId
    )
    if (!candidate) return
    const swapped: DailyPlanTask = {
      moduleId: candidate.id,
      title: candidate.title,
      durationMinutes: task.durationMinutes,
      deliverableGoal: `Complete the core lessons and exercises for ${candidate.title}.`,
    }
    onSwap(index, swapped)
  }, [eligibleModules, currentPlanModuleIds, task, index, onSwap])

  const handleFocus = () => {
    const found = CURRICULUM.find((m) => m.id === task.moduleId)
    // Inject title + duration into Pomodoro timer
    useProgressStore.getState().setFocusedTask(task.title, task.durationMinutes, found?.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="px-4 py-3"
    >
      <div className="flex items-start gap-3">
        {/* Index badge */}
        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-300 shrink-0 mt-0.5">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white/85 leading-snug">{task.title}</span>
            <span className="text-[10px] text-cyan-400/60 font-mono shrink-0">{task.durationMinutes}m</span>
          </div>

          {/* Deliverable goal */}
          {task.deliverableGoal && (
            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">🎯 {task.deliverableGoal}</p>
          )}

          {/* Lesson toggle */}
          <button
            onClick={() => setLessonsOpen((v) => !v)}
            className="flex items-center gap-1 mt-1.5 text-[10px] text-cyan-400/50 hover:text-cyan-300 transition-colors"
          >
            {lessonsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {lessonsOpen ? 'Hide lesson checklist' : 'Show lesson checklist'}
          </button>

          <AnimatePresence>
            {lessonsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <TaskLessonChecklist task={task} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={handleFocus}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/20 hover:border-cyan-400/40 transition-all"
          >
            <Play className="w-2.5 h-2.5" />
            Focus
          </button>
          <button
            onClick={handleSwap}
            title="Swap to a different unlocked module"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-white/30 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 transition-all"
          >
            <Shuffle className="w-2.5 h-2.5" />
            Swap
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// --- Main component ---
export function AiDailyPlanner() {
  const { moduleStatuses, setFocusedModule, activeDailyPlan, setActiveDailyPlan } = useProgressStore()
  const [studyHours, setStudyHours] = useState<1 | 2 | 3 | 4>(2)
  const [customMinutes, setCustomMinutes] = useState('')
  const [energy, setEnergy] = useState<EnergyLevel>('balanced')
  const [rawResponse, setRawResponse] = useState('')
  const [localSchedule, setLocalSchedule] = useState<DailyPlanSchedule | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isMock, setIsMock] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Sherif's dispatched plan takes priority over locally generated plan
  const schedule = activeDailyPlan ?? localSchedule
  const isFromSherif = !!activeDailyPlan

  const eligibleModules = useMemo(() => getEligibleNextModules(moduleStatuses), [moduleStatuses])
  const completedCount = useMemo(
    () => CURRICULUM.filter((m) => {
      const s = moduleStatuses[m.id]
      return s === 'completed' || s === 'passed'
    }).length,
    [moduleStatuses]
  )
  const totalLocked = CURRICULUM.length - eligibleModules.length - completedCount

  // Effective study minutes: custom input beats preset hours
  const effectiveMinutes = useMemo(() => {
    if (customMinutes.trim()) {
      const n = parseInt(customMinutes)
      if (!isNaN(n) && n > 0) return n
    }
    return studyHours * 60
  }, [customMinutes, studyHours])

  // Swap a core task in the current schedule
  const handleSwapTask = useCallback((index: number, newTask: DailyPlanTask) => {
    if (isFromSherif) {
      // Swap inside Sherif's plan via store
      const updated = schedule ? { ...schedule, coreTasks: [...schedule.coreTasks] } : null
      if (updated) {
        updated.coreTasks[index] = newTask
        setActiveDailyPlan(updated)
      }
    } else {
      setLocalSchedule((prev) => {
        if (!prev) return prev
        const updated = [...prev.coreTasks]
        updated[index] = newTask
        return { ...prev, coreTasks: updated }
      })
    }
  }, [isFromSherif, schedule, setActiveDailyPlan])

  const handleGenerate = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRawResponse('')
    setLocalSchedule(null)
    setActiveDailyPlan(null) // Clear any Sherif plan when manually generating
    setIsLoading(true)
    setIsStreaming(false)
    setIsMock(false)

    const topModules = eligibleModules.slice(0, 10)
    const moduleList = topModules
      .map((m) => `  - ${m.id} | ${m.title} | ${m.totalDurationText} | Sprint ${m.sprint} | ${m.track} track${m.prerequisites?.length ? ` (requires: ${m.prerequisites.join(', ')})` : ''}`)
      .join('\n')

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate-schedule',
          moduleTitle: `Available: ${effectiveMinutes} minutes, Energy: ${energy}`,
          userInput: moduleList || '(all modules completed)',
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      if (res.headers.get('X-AI-Mode') === 'mock') setIsMock(true)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No body')
      const decoder = new TextDecoder()
      setIsLoading(false)
      setIsStreaming(true)

      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setRawResponse(full)
      }
      setIsStreaming(false)
      setLocalSchedule(parseSchedule(full))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [effectiveMinutes, energy, eligibleModules, setActiveDailyPlan])

  const handleReset = () => {
    abortRef.current?.abort()
    setRawResponse('')
    setLocalSchedule(null)
    setActiveDailyPlan(null) // Also clear Sherif's plan
  }

  const coreMinutes = schedule?.coreTasks.reduce((s, t) => s + t.durationMinutes, 0) ?? 0
  const currentPlanModuleIds = schedule?.coreTasks.map((t) => t.moduleId) ?? []


  return (
    <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setIsCollapsed((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-white/80">AI Daily Planner</span>
          <span className="text-xs text-white/30 ml-2">— adaptive · prerequisite-aware · lesson-synced</span>
        </div>
        {isMock && <span className="text-[10px] text-amber-400/50">mock</span>}
        {isCollapsed ? <ChevronDown className="w-4 h-4 text-white/25" /> : <ChevronUp className="w-4 h-4 text-white/25" />}
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] p-4 space-y-3">

              {/* ── Compact Control Bar ── */}
              <div className="flex flex-wrap items-center gap-2">

                {/* Duration presets */}
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  {HOUR_OPTIONS.map((h) => (
                    <button
                      key={h}
                      onClick={() => { setStudyHours(h); setCustomMinutes('') }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-mono transition-all',
                        !customMinutes && studyHours === h
                          ? 'bg-purple-500/25 text-purple-200 border border-purple-400/30'
                          : 'text-white/35 hover:text-white/70 hover:bg-white/5'
                      )}
                    >
                      {h}h
                    </button>
                  ))}
                </div>

                {/* Custom minutes input */}
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <input
                    type="number"
                    min={15}
                    max={600}
                    placeholder="custom"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="w-14 bg-transparent text-xs font-mono text-white/70 placeholder:text-white/20 focus:outline-none"
                  />
                  <span className="text-[10px] text-white/25">min</span>
                </div>

                {/* Energy selector */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  {ENERGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEnergy(opt.id)}
                      title={opt.label}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all',
                        energy === opt.id
                          ? opt.id === 'deep-code' ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                            : opt.id === 'balanced' ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                          : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                      )}
                    >
                      {opt.icon}
                      <span className="hidden sm:inline">{opt.label}</span>
                      <span className="sm:hidden">{opt.short}</span>
                    </button>
                  ))}
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || isStreaming || eligibleModules.length === 0}
                  className={cn(
                    'w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold',
                    'bg-gradient-to-r from-purple-500/80 to-cyan-500/80 hover:from-purple-500 hover:to-cyan-500',
                    'text-white transition-all duration-200 active:scale-95',
                    'disabled:opacity-40 disabled:cursor-not-allowed shadow-md'
                  )}
                >
                  {isLoading || isStreaming ? <Bot className="w-3.5 h-3.5 animate-pulse" /> : <Send className="w-3.5 h-3.5" />}
                  {isLoading ? 'Planning...' : isStreaming ? 'Building...' : '✨ Generate Plan'}
                </button>
              </div>

              {/* Status sub-bar */}
              <div className="flex items-center gap-3 text-[10px] text-white/25">
                <span className="text-cyan-400/60">{eligibleModules.length} modules unlocked</span>
                {totalLocked > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />{totalLocked} locked by prerequisites
                    </span>
                  </>
                )}
                {completedCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400/50">{completedCount} completed</span>
                  </>
                )}
                <span className="ml-auto font-mono text-white/20">{effectiveMinutes}m available</span>
              </div>

              {/* Loading state */}
              {isLoading && !rawResponse && (
                <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                  <Bot className="w-4 h-4 animate-pulse text-purple-400" />
                  Analyzing prerequisites and designing adaptive session...
                </div>
              )}

              {/* Streaming preview */}
              {isStreaming && !schedule && rawResponse && (
                <div className="rounded-xl p-3 bg-white/[0.025] border border-white/[0.05]">
                  <div className="flex items-center gap-2 text-xs text-white/30 mb-1">
                    <Bot className="w-3 h-3 animate-pulse text-purple-400" /> Structuring your session...
                  </div>
                  <pre className="text-[10px] text-white/20 font-mono leading-relaxed whitespace-pre-wrap line-clamp-4 overflow-hidden">
                    {rawResponse.slice(-300)}
                  </pre>
                </div>
              )}

              {/* Schedule output */}
              <AnimatePresence>
                {schedule && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    {/* Executive Summary */}
                    {schedule.strategySummary && (
                      <div className="rounded-xl p-3.5 bg-white/[0.03] border border-white/10 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-white/30" />
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">Today's Strategy</span>
                          {isFromSherif && (
                            <span className="ml-auto flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/25">
                              ⚡ Synced by Sherif
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">{schedule.strategySummary}</p>
                        {schedule.focusTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {schedule.focusTags.map((tag) => (
                              <span
                                key={tag}
                                className={cn(
                                  'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                                  FOCUS_TAG_COLOR[tag] ?? 'bg-white/5 text-white/40 border-white/10'
                                )}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Time allocation bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-400/70">Core: {coreMinutes}m</span>
                        {schedule.bonusTask && (
                          <span className="text-amber-400/70">Bonus: {schedule.bonusTask.durationMinutes}m</span>
                        )}
                        <span className="text-white/25">Buffer: {schedule.bufferMinutes}m</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.05] flex overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-l-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (coreMinutes / effectiveMinutes) * 100)}%` }}
                        />
                        {schedule.bonusTask && (
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                            style={{ width: `${Math.min(100, (schedule.bonusTask.durationMinutes / effectiveMinutes) * 100)}%` }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Core Mission */}
                    {schedule.coreTasks.length > 0 && (
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cyan-500/10">
                          <Target className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Core Mission</span>
                          <span className="ml-auto text-[10px] text-cyan-400/50 font-mono">{coreMinutes}m</span>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                          {schedule.coreTasks.map((task, i) => (
                            <CoreTaskCard
                              key={`${task.moduleId}-${i}`}
                              task={task}
                              index={i}
                              eligibleModules={eligibleModules}
                              currentPlanModuleIds={currentPlanModuleIds}
                              onSwap={handleSwapTask}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bonus Stretch Goal */}
                    {schedule.bonusTask && (
                      <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <Gift className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Bonus Stretch Goal</span>
                          <span className="ml-auto text-[10px] text-amber-400/50 font-mono">{schedule.bonusTask.durationMinutes}m</span>
                        </div>
                        <p className="text-sm font-semibold text-white/80">{schedule.bonusTask.title}</p>
                        {schedule.bonusTask.deliverableGoal && (
                          <p className="text-xs text-white/45 leading-relaxed">🎯 {schedule.bonusTask.deliverableGoal}</p>
                        )}
                      </motion.div>
                    )}

                    {/* Buffer */}
                    {schedule.bufferMinutes > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <Timer className="w-3 h-3 text-white/20" />
                        <span className="text-[10px] text-white/25">
                          {schedule.bufferMinutes}m buffer — breaks, review, or overruns
                        </span>
                      </div>
                    )}

                    {/* Parse warning */}
                    {schedule.coreTasks.length === 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-amber-300/70">Schedule parsed partially. Try regenerating.</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state */}
              {eligibleModules.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400/40" />
                  All modules are either completed or locked by prerequisites.
                </div>
              )}

              {/* Clear plan */}
              {(rawResponse || schedule) && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Clear plan
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}