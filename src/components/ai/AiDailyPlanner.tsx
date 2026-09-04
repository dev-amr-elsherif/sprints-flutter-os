'use client'

import { useState, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import { useProgressStore } from '@/store/progressStore'
import { CURRICULUM } from '@/lib/curriculum'
import { getEligibleNextModules, cn } from '@/lib/utils'

// --- Types ---
type EnergyLevel = 'deep-code' | 'balanced' | 'micro'
type StudyHours = 1 | 2 | 3 | 4

interface CoreTask {
  moduleId: string
  title: string
  durationMinutes: number
  sprint: number
  track: string
  why: string
  pomodoroTip: string
}

interface ParsedSchedule {
  totalMinutes: number
  strategy: string
  coreTasks: CoreTask[]
  bonusTitle: string
  bonusDurationMinutes: number
  bonusDescription: string
  bufferMinutes: number
}

// --- Schedule parser ---
function parseSchedule(raw: string): ParsedSchedule | null {
  const startIdx = raw.indexOf('---SCHEDULE_START---')
  const endIdx = raw.indexOf('---SCHEDULE_END---')
  if (startIdx === -1 || endIdx === -1) return null

  const block = raw.slice(startIdx + '---SCHEDULE_START---'.length, endIdx).trim()
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)

  const get = (key: string) => {
    const line = lines.find((l) => l.startsWith(key + ':'))
    return line ? line.slice(key.length + 1).trim() : ''
  }

  const totalMinutes = parseInt(get('TOTAL_MINUTES')) || 0
  const strategy = get('STRATEGY')
  const bufferMinutes = parseInt(get('BUFFER_MINUTES')) || 0

  // Bonus section
  const bonusStartIdx = lines.findIndex((l) => l.startsWith('BONUS_GOAL:'))
  let bonusTitle = ''
  let bonusDurationMinutes = 20
  let bonusDescription = ''

  if (bonusStartIdx !== -1) {
    const bonusLines = lines.slice(bonusStartIdx + 1)
    for (const bl of bonusLines) {
      if (bl.startsWith('TITLE:') && !bonusTitle) bonusTitle = bl.slice('TITLE:'.length).trim()
      else if (bl.startsWith('DURATION_MINUTES:') && bonusTitle) {
        bonusDurationMinutes = parseInt(bl.slice('DURATION_MINUTES:'.length).trim()) || 20
      } else if (bl.startsWith('DESCRIPTION:')) bonusDescription = bl.slice('DESCRIPTION:'.length).trim()
      else if (bl.startsWith('BUFFER_MINUTES:')) break
    }
  }

  // Parse CORE_MISSION tasks
  const coreTasks: CoreTask[] = []
  let currentTask: Partial<CoreTask> | null = null

  for (const line of lines) {
    if (line.startsWith('- MODULE_ID:')) {
      if (currentTask?.title) coreTasks.push(currentTask as CoreTask)
      currentTask = { moduleId: line.replace('- MODULE_ID:', '').trim(), durationMinutes: 30, sprint: 1, track: '', why: '', pomodoroTip: '' }
    } else if (currentTask) {
      if (line.startsWith('TITLE:')) currentTask.title = line.slice('TITLE:'.length).trim()
      else if (line.startsWith('DURATION_MINUTES:')) currentTask.durationMinutes = parseInt(line.slice('DURATION_MINUTES:'.length).trim()) || 30
      else if (line.startsWith('SPRINT:')) currentTask.sprint = parseInt(line.slice('SPRINT:'.length).trim()) || 1
      else if (line.startsWith('TRACK:')) currentTask.track = line.slice('TRACK:'.length).trim()
      else if (line.startsWith('WHY:')) currentTask.why = line.slice('WHY:'.length).trim()
      else if (line.startsWith('POMODORO_TIP:')) {
        currentTask.pomodoroTip = line.slice('POMODORO_TIP:'.length).trim()
        coreTasks.push(currentTask as CoreTask)
        currentTask = null
      }
    }
  }
  if (currentTask?.title) coreTasks.push(currentTask as CoreTask)

  if (coreTasks.length === 0 && !bonusTitle) return null

  return { totalMinutes, strategy, coreTasks, bonusTitle, bonusDurationMinutes, bonusDescription, bufferMinutes }
}

// --- Constants ---
const ENERGY_OPTIONS: { id: EnergyLevel; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'deep-code', label: 'Deep Code', icon: <Zap className="w-3.5 h-3.5" />, desc: 'Architecture, BLoC, Docker' },
  { id: 'balanced', label: 'Balanced', icon: <Brain className="w-3.5 h-3.5" />, desc: 'Mix of theory & practice' },
  { id: 'micro', label: 'Micro', icon: <Moon className="w-3.5 h-3.5" />, desc: 'Short videos, soft skills' },
]

const HOUR_OPTIONS: StudyHours[] = [1, 2, 3, 4]

const TRACK_COLOR: Record<string, string> = {
  Mobile: 'text-cyan-300',
  Systems: 'text-amber-300',
  Quality: 'text-purple-300',
  Career: 'text-emerald-300',
}

// --- Main component ---
export function AiDailyPlanner() {
  const { moduleStatuses, setFocusedModule } = useProgressStore()
  const [studyHours, setStudyHours] = useState<StudyHours>(2)
  const [energy, setEnergy] = useState<EnergyLevel>('balanced')
  const [rawResponse, setRawResponse] = useState('')
  const [schedule, setSchedule] = useState<ParsedSchedule | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isMock, setIsMock] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const eligibleModules = getEligibleNextModules(moduleStatuses)
  const completedCount = CURRICULUM.filter((m) => {
    const s = moduleStatuses[m.id]
    return s === 'completed' || s === 'passed'
  }).length
  const totalLocked = CURRICULUM.length - eligibleModules.length - completedCount

  const handleGenerate = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRawResponse('')
    setSchedule(null)
    setIsLoading(true)
    setIsStreaming(false)
    setIsMock(false)

    const studyMinutes = studyHours * 60
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
          moduleTitle: `Available: ${studyMinutes} minutes, Energy: ${energy}`,
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
      setSchedule(parseSchedule(full))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [studyHours, energy, eligibleModules])

  const handleFocusPomodoro = (moduleId: string, title: string) => {
    const found = CURRICULUM.find((m) => m.id === moduleId) || CURRICULUM.find((m) => m.title === title)
    if (found) setFocusedModule(found.id)
  }

  const handleReset = () => {
    abortRef.current?.abort()
    setRawResponse('')
    setSchedule(null)
  }

  const coreMinutes = schedule?.coreTasks.reduce((s, t) => s + t.durationMinutes, 0) ?? 0
  const totalAvailableMinutes = studyHours * 60

  return (
    <div className="glass rounded-2xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setIsCollapsed((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-white/80">AI Daily Planner</span>
          <span className="text-xs text-white/30 ml-2">-- adaptive schedule . prerequisite-aware</span>
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
            <div className="border-t border-white/[0.05] p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Available Today</p>
                  <div className="flex gap-1.5">
                    {HOUR_OPTIONS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setStudyHours(h)}
                        className={cn(
                          'flex-1 py-1.5 rounded-xl text-xs font-mono border transition-all',
                          studyHours === h
                            ? 'text-white bg-purple-500/20 border-purple-400/40'
                            : 'text-white/30 border-white/[0.06] hover:text-white/60 hover:border-white/15'
                        )}
                      >{h}h</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Energy Level</p>
                  <div className="flex gap-1.5">
                    {ENERGY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setEnergy(opt.id)}
                        title={opt.desc}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs border transition-all',
                          energy === opt.id
                            ? opt.id === 'deep-code' ? 'text-red-300 bg-red-500/15 border-red-400/30'
                              : opt.id === 'balanced' ? 'text-purple-300 bg-purple-500/15 border-purple-400/30'
                              : 'text-indigo-300 bg-indigo-500/15 border-indigo-400/30'
                            : 'text-white/30 border-white/[0.06] hover:text-white/60 hover:border-white/15'
                        )}
                      >
                        {opt.icon}
                        <span className="hidden sm:inline">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-white/25">
                <span className="text-cyan-400/60">{eligibleModules.length} modules unlocked</span>
                {totalLocked > 0 && (
                  <>
                    <span>.</span>
                    <span className="flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />{totalLocked} locked by prerequisites
                    </span>
                  </>
                )}
                {completedCount > 0 && (
                  <>
                    <span>.</span>
                    <span className="text-emerald-400/50">{completedCount} completed</span>
                  </>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isLoading || isStreaming || eligibleModules.length === 0}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold',
                  'bg-gradient-to-r from-purple-500/80 to-cyan-500/80 hover:from-purple-500 hover:to-cyan-500',
                  'text-white transition-all duration-200 active:scale-95',
                  'disabled:opacity-40 disabled:cursor-not-allowed shadow-lg'
                )}
              >
                {isLoading || isStreaming ? <Bot className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                {isLoading ? 'Planning...' : isStreaming ? 'Building schedule...' : 'Generate My Study Plan'}
              </button>

              {isLoading && !rawResponse && (
                <div className="flex items-center gap-2 text-sm text-white/30 py-2">
                  <Bot className="w-4 h-4 animate-pulse text-purple-400" />
                  Analyzing prerequisites and designing adaptive session...
                </div>
              )}

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

              <AnimatePresence>
                {schedule && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    {schedule.strategy && (
                      <div className="rounded-xl p-3.5 bg-white/[0.025] border border-white/[0.05]">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Strategy</p>
                        <p className="text-xs text-white/55 leading-relaxed">{schedule.strategy}</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-cyan-400/70">Core: {coreMinutes}m</span>
                        <span className="text-amber-400/70">Bonus: {schedule.bonusDurationMinutes}m</span>
                        <span className="text-white/25">Buffer: {schedule.bufferMinutes}m</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.05] flex overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-l-full transition-all duration-700"
                          style={{ width: `${Math.min(100, (coreMinutes / totalAvailableMinutes) * 100)}%` }}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-700"
                          style={{ width: `${Math.min(100, (schedule.bonusDurationMinutes / totalAvailableMinutes) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {schedule.coreTasks.length > 0 && (
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cyan-500/10">
                          <Target className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Core Mission</span>
                          <span className="ml-auto text-[10px] text-cyan-400/50 font-mono">{coreMinutes}m</span>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                          {schedule.coreTasks.map((task, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.07 }}
                              className="px-4 py-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-300 shrink-0 mt-0.5">
                                  {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-white/85 leading-snug">{task.title}</span>
                                    <span className="text-[10px] text-cyan-400/60 font-mono shrink-0">{task.durationMinutes}m</span>
                                    {task.track && (
                                      <span className={cn('text-[9px] font-medium shrink-0', TRACK_COLOR[task.track] ?? 'text-white/40')}>
                                        {task.track}
                                      </span>
                                    )}
                                  </div>
                                  {task.why && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">-{task.why}</p>}
                                  {task.pomodoroTip && <p className="text-[10px] text-cyan-400/50 mt-1 leading-relaxed">{task.pomodoroTip}</p>}
                                </div>
                                <button
                                  onClick={() => handleFocusPomodoro(task.moduleId, task.title)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-400/20 hover:border-cyan-400/40 transition-all shrink-0"
                                >
                                  <Play className="w-2.5 h-2.5" />
                                  Focus
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {schedule.bonusTitle && (
                      <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Gift className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Bonus Stretch Goal</span>
                          <span className="ml-auto text-[10px] text-amber-400/50 font-mono">{schedule.bonusDurationMinutes}m</span>
                        </div>
                        <p className="text-sm font-semibold text-white/80">{schedule.bonusTitle}</p>
                        {schedule.bonusDescription && (
                          <p className="text-xs text-white/45 leading-relaxed">{schedule.bonusDescription}</p>
                        )}
                      </motion.div>
                    )}

                    {schedule.bufferMinutes > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <Timer className="w-3 h-3 text-white/20" />
                        <span className="text-[10px] text-white/25">
                          {schedule.bufferMinutes}m buffer for breaks, review, or overruns
                        </span>
                      </div>
                    )}

                    {schedule.coreTasks.length === 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs text-amber-300/70">Schedule parsed partially. The AI may not have followed the exact format.</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {eligibleModules.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400/40" />
                  All modules are either completed or locked by prerequisites.
                </div>
              )}

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
