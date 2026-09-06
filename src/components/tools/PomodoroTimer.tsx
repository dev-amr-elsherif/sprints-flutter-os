'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  FlaskConical,
  X,
} from 'lucide-react'
import { useProgressStore } from '@/store/progressStore'
import { getModuleById } from '@/lib/curriculum'
import { cn } from '@/lib/utils'
import { playSessionCompletedChime, playTestChime } from '@/lib/audio'

type Phase = 'focus' | 'short-break' | 'long-break'
type TimerState = 'idle' | 'running' | 'paused' | 'complete'

const FOCUS_PRESETS = [
  { label: '25m', minutes: 25 },
  { label: '50m', minutes: 50 },
]
const BREAK_PRESETS = [
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
]

// ── localStorage helpers ────────────────────────────────────────────────────
function getLS(key: string, def: string): string {
  if (typeof window === 'undefined') return def
  return localStorage.getItem(key) ?? def
}
function setLS(key: string, val: string) {
  if (typeof window !== 'undefined') localStorage.setItem(key, val)
}

export function PomodoroTimer() {
  const {
    zenMode,
    setZenMode,
    focusedModuleId,
    setFocusedModule,
    focusedTaskTitle,
    focusedTaskDurationSecs,
    setFocusedTask,
  } = useProgressStore()

  const [phase, setPhase] = useState<Phase>('focus')
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [seconds, setSeconds] = useState(25 * 60)
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [customInput, setCustomInput] = useState('')
  const [editingCustom, setEditingCustom] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track which "injected" duration we've already applied so we don't re-apply on re-renders
  const appliedDurationRef = useRef<number | null>(null)

  // ── Load persisted preferences ──────────────────────────────────────────
  useEffect(() => {
    const minimized = getLS('pomodoro-minimized', 'false')
    setIsMinimized(minimized === 'true')
    const sound = getLS('pomodoro-sound-enabled', 'true')
    setSoundEnabled(sound === 'true')
  }, [])

  const toggleMinimized = useCallback((val?: boolean) => {
    setIsMinimized((prev) => {
      const next = typeof val === 'boolean' ? val : !prev
      setLS('pomodoro-minimized', String(next))
      return next
    })
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      setLS('pomodoro-sound-enabled', String(!prev))
      return !prev
    })
  }, [])

  const focusedModule = focusedModuleId ? getModuleById(focusedModuleId) : null

  // ── Auto-expand when a module/task is focused externally ────────────────
  useEffect(() => {
    if (focusedModuleId) {
      toggleMinimized(false)
      setIsExpanded(true)
    }
  }, [focusedModuleId, toggleMinimized])

  // ── Apply injected task duration from planner / lesson click ────────────
  useEffect(() => {
    if (
      focusedTaskDurationSecs !== null &&
      focusedTaskDurationSecs !== appliedDurationRef.current
    ) {
      appliedDurationRef.current = focusedTaskDurationSecs
      const mins = Math.round(focusedTaskDurationSecs / 60)
      const clamped = Math.max(1, Math.min(180, mins))
      setPhase('focus')
      setSelectedMinutes(clamped)
      setSeconds(clamped * 60)
      setTimerState('idle')
      toggleMinimized(false)
      setIsExpanded(true)
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [focusedTaskDurationSecs, toggleMinimized])

  // ── Timer tick ──────────────────────────────────────────────────────────
  const clearTick = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const start = useCallback(() => {
    setTimerState('running')
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearTick()
          setTimerState('complete')
          setSessionsCompleted((n) => n + 1)
          if (getLS('pomodoro-sound-enabled', 'true') === 'true') {
            playSessionCompletedChime(
              // read phase from closure isn't reliable; we use a dataset trick below
              document.getElementById('pomo-phase-data')?.dataset.phase as Phase ?? 'focus'
            )
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [clearTick])

  const pause = useCallback(() => { clearTick(); setTimerState('paused') }, [clearTick])

  const reset = useCallback((mins: number) => {
    clearTick()
    setSeconds(mins * 60)
    setTimerState('idle')
  }, [clearTick])

  useEffect(() => () => clearTick(), [clearTick])

  // ── Custom duration input ─────────────────────────────────────────────
  const applyCustom = useCallback(() => {
    const n = parseInt(customInput, 10)
    if (!isNaN(n) && n >= 1 && n <= 180) {
      setSelectedMinutes(n)
      reset(n)
    }
    setEditingCustom(false)
  }, [customInput, reset])

  const openCustomEdit = useCallback(() => {
    setCustomInput(String(selectedMinutes))
    setEditingCustom(true)
  }, [selectedMinutes])

  // ── Derived display values ────────────────────────────────────────────
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const totalSecs = selectedMinutes * 60
  const pct = totalSecs > 0 ? (1 - seconds / totalSecs) * 100 : 0
  const circumference = 2 * Math.PI * 44

  const phaseColor =
    phase === 'focus' ? '#a855f7' : phase === 'short-break' ? '#06b6d4' : '#10b981'
  const phaseEmoji = phase === 'focus' ? '🎯' : phase === 'short-break' ? '☕' : '🌙'
  const phaseLabel = phase === 'focus' ? 'Deep Work' : phase === 'short-break' ? 'Short Break' : 'Long Break'

  // Active task display label: injected title wins over module title
  const activeTaskLabel = focusedTaskTitle ?? focusedModule?.title ?? null

  // Truncate for pill
  const pillLabel = activeTaskLabel
    ? activeTaskLabel.length > 22 ? activeTaskLabel.slice(0, 22) + '…' : activeTaskLabel
    : null

  const clearTask = () => {
    // Clear injected task
    setFocusedModule(null)
    setFocusedTask('', 0, undefined)
    appliedDurationRef.current = null
    // Keep current timer state as-is (don't reset)
  }

  return (
    <>
      {/* Hidden data element so the interval closure can read phase */}
      <span id="pomo-phase-data" data-phase={phase} className="hidden" />

      {/* Zen mode overlay */}
      <AnimatePresence>
        {zenMode && (
          <motion.div
            key="zen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/75 backdrop-blur-md pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Minimized pill — anchored bottom-left to avoid Sherif FAB */}
      <div className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-30 select-none">
        <AnimatePresence mode="wait">
          {isMinimized ? (
            /* ── Minimized Pill ── */
            <motion.div
              key="minimized"
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'glass-strong h-10 px-3.5 py-1.5 rounded-full shadow-2xl flex items-center gap-2 backdrop-blur-xl',
                'border',
                timerState === 'running'
                  ? phase === 'focus'
                    ? 'border-purple-400/30'
                    : phase === 'short-break'
                    ? 'border-cyan-400/30'
                    : 'border-emerald-400/30'
                  : 'border-white/15'
              )}
            >
              {/* Phase emoji + time */}
              <span className="text-xs">{phaseEmoji}</span>
              <span className="text-xs font-bold font-mono text-white tabular-nums tracking-tight">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>

              {/* Running dot */}
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  timerState === 'running' ? 'animate-pulse' : 'opacity-30'
                )}
                style={{ backgroundColor: phaseColor }}
              />

              {/* Task label */}
              {pillLabel && (
                <>
                  <div className="h-3.5 w-px bg-white/10 shrink-0" />
                  <span className="text-[10px] text-white/50 truncate max-w-[120px]">{pillLabel}</span>
                </>
              )}

              <div className="h-3.5 w-px bg-white/10 shrink-0" />

              {/* Quick play/pause */}
              {timerState === 'running' ? (
                <button onClick={pause} className="flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors" title="Pause">
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </button>
              ) : timerState === 'complete' ? (
                <button onClick={() => reset(selectedMinutes)} className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 hover:text-emerald-200 transition-colors" title="Next">
                  <Play className="w-3 h-3 fill-current" />
                  <span>Next</span>
                </button>
              ) : (
                <button onClick={start} className="flex items-center gap-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors" title={timerState === 'paused' ? 'Resume' : 'Start'}>
                  <Play className="w-3 h-3 fill-current" />
                  <span>{timerState === 'paused' ? 'Resume' : 'Start'}</span>
                </button>
              )}

              <div className="h-3.5 w-px bg-white/10 shrink-0" />

              {/* Maximize */}
              <button onClick={() => toggleMinimized(false)} className="text-white/40 hover:text-white transition-colors p-0.5 rounded" title="Maximize timer">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>

          ) : null}
        </AnimatePresence>
      </div>

      {/* Expanded Dial — centered modal (zero collision with any FAB) */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            key="expanded-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
            onClick={() => toggleMinimized(true)}
          >
            <motion.div
              key="expanded-modal-card"
              initial={{ scale: 0.93, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-zinc-950/95 border border-white/[0.10] shadow-2xl overflow-hidden">
              {/* Accent line */}
              <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${phaseColor}80, transparent)` }} />

              {/* Top bar */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/[0.06]">
                <div className={cn('w-2 h-2 rounded-full shrink-0', timerState === 'running' ? 'animate-pulse' : 'opacity-40')} style={{ backgroundColor: phaseColor }} />
                <span className="text-xs font-medium text-white/60 flex-1 truncate">
                  {phaseEmoji} {phaseLabel}
                </span>

                {/* Sound toggle */}
                <button
                  onClick={toggleSound}
                  title={soundEnabled ? 'Mute chime' : 'Unmute chime'}
                  className="text-white/25 hover:text-white/60 transition-colors p-0.5"
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-400/50" />}
                </button>

                {/* Test chime */}
                <button
                  onClick={() => soundEnabled && playTestChime()}
                  title={soundEnabled ? 'Test audio chime' : 'Unmute to test'}
                  className={cn('text-white/20 hover:text-white/50 transition-colors p-0.5', !soundEnabled && 'opacity-30 cursor-not-allowed')}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                </button>

                {/* Zen toggle */}
                <button
                  onClick={() => setZenMode(!zenMode)}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium border transition-all',
                    zenMode
                      ? 'text-purple-300 border-purple-400/40 bg-purple-500/15'
                      : 'text-white/25 border-white/[0.06] hover:text-white/50'
                  )}
                >
                  Zen
                </button>

                {/* Expand toggle */}
                <button onClick={() => setIsExpanded((v) => !v)} className="text-white/25 hover:text-white/60 transition-colors p-0.5" title={isExpanded ? 'Collapse' : 'Expand'}>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>

                {/* Minimize */}
                <button onClick={() => toggleMinimized(true)} className="text-white/25 hover:text-white/60 transition-colors p-0.5" title="Minimize to pill">
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Active task banner */}
              {activeTaskLabel && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] bg-white/[0.02]">
                  <span className="text-[10px] text-white/25 shrink-0">Working on:</span>
                  <span className="text-[11px] text-white/60 truncate flex-1 font-medium leading-snug" title={activeTaskLabel}>
                    {activeTaskLabel}
                  </span>
                  <button onClick={clearTask} className="text-white/15 hover:text-white/50 shrink-0 transition-colors" title="Detach task">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Timer face */}
              <div className="px-4 pt-4 pb-3 flex flex-col items-center gap-3">
                {/* Circular ring — clickable to enter custom duration while idle/paused */}
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r="44"
                      fill="none"
                      stroke={phaseColor}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - pct / 100)}
                      style={{ transition: 'stroke-dashoffset 0.8s linear' }}
                    />
                  </svg>

                  {/* Center: clickable time display or custom input */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                    {editingCustom ? (
                      <div className="flex flex-col items-center gap-1.5 px-1">
                        <input
                          type="number"
                          min={1}
                          max={180}
                          autoFocus
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') applyCustom()
                            if (e.key === 'Escape') setEditingCustom(false)
                          }}
                          className="w-14 text-center bg-transparent text-xl font-bold font-mono text-white focus:outline-none border-b-2 border-cyan-400/60"
                          placeholder="min"
                        />
                        <div className="flex gap-1">
                          <button
                            onMouseDown={(e) => { e.preventDefault(); applyCustom() }}
                            className="text-[9px] px-2 py-0.5 rounded border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20 transition-all font-semibold"
                          >✓ Set</button>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); setEditingCustom(false) }}
                            className="text-[9px] px-2 py-0.5 rounded border border-white/10 text-white/30 hover:bg-white/5 transition-all"
                          >✕</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={openCustomEdit}
                        title="Click to set custom duration"
                        className="flex flex-col items-center gap-0.5 group cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        <span className="text-2xl font-bold font-mono text-white tabular-nums tracking-tight group-hover:text-cyan-200 transition-colors">
                          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                        </span>
                        <span className="text-[9px] text-white/25 font-mono uppercase">
                          {timerState === 'complete' ? '✓ done' : `${sessionsCompleted} 🍅`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                  {timerState === 'running' ? (
                    <button onClick={pause} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-medium border border-amber-500/30 hover:bg-amber-500/25 transition-all">
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  ) : timerState === 'complete' ? (
                    <button onClick={() => reset(selectedMinutes)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/25 transition-all">
                      <Play className="w-3.5 h-3.5" /> Next
                    </button>
                  ) : (
                    <button onClick={start} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium border transition-all"
                      style={{ backgroundColor: `${phaseColor}25`, borderColor: `${phaseColor}50` }}>
                      <Play className="w-3.5 h-3.5" />
                      {timerState === 'paused' ? 'Resume' : 'Start'}
                    </button>
                  )}
                  <button onClick={() => reset(selectedMinutes)} className="p-2 rounded-xl text-white/20 hover:text-white/60 hover:bg-white/5 transition-all">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded controls panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/[0.06]"
                  >
                    <div className="p-3 space-y-3">
                      {/* Phase selector */}
                      <div>
                        <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Phase</p>
                        <div className="flex gap-1">
                          {([
                            { id: 'focus' as Phase, icon: '🎯' },
                            { id: 'short-break' as Phase, icon: '☕' },
                            { id: 'long-break' as Phase, icon: '🌙' },
                          ]).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setPhase(p.id)
                                const m = p.id === 'focus' ? selectedMinutes : p.id === 'short-break' ? 5 : 10
                                reset(m)
                                setSelectedMinutes(p.id === 'focus' ? selectedMinutes : p.id === 'short-break' ? 5 : 10)
                              }}
                              className={cn(
                                'flex-1 py-1.5 rounded-lg text-sm border transition-all',
                                phase === p.id ? 'bg-white/10 border-white/20' : 'text-white/30 border-white/[0.06] hover:text-white/60'
                              )}
                            >
                              {p.icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duration presets + custom */}
                      <div>
                        <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Duration</p>
                        <div className="flex gap-1">
                          {(phase === 'focus' ? FOCUS_PRESETS : BREAK_PRESETS).map((p) => (
                            <button
                              key={p.minutes}
                              onClick={() => { setSelectedMinutes(p.minutes); reset(p.minutes); setEditingCustom(false) }}
                              className={cn(
                                'flex-1 py-1.5 rounded-lg text-xs font-mono border transition-all',
                                selectedMinutes === p.minutes && !editingCustom
                                  ? 'text-white border-white/25 bg-white/10'
                                  : 'text-white/30 border-white/[0.06] hover:text-white/60'
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                          {/* Custom preset button */}
                          <button
                            onClick={openCustomEdit}
                            className={cn(
                              'flex-1 py-1.5 rounded-lg text-xs font-mono border transition-all',
                              editingCustom
                                ? 'text-cyan-300 border-cyan-400/40 bg-cyan-500/15 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                                : 'text-white/40 border-white/[0.08] hover:text-cyan-300 hover:border-cyan-400/30 hover:bg-cyan-500/[0.06]'
                            )}
                            title="Set custom duration (1–180 min)"
                          >
                            ✎ custom
                          </button>
                        </div>

                        {/* Custom inline editor in expanded panel */}
                        {editingCustom && (
                          <div className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded-lg bg-cyan-500/[0.06] border border-cyan-400/25">
                            <span className="text-[10px] text-cyan-300/50 shrink-0">min:</span>
                            <input
                              type="number"
                              min={1}
                              max={180}
                              autoFocus
                              value={customInput}
                              onChange={(e) => setCustomInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') applyCustom()
                                if (e.key === 'Escape') setEditingCustom(false)
                              }}
                              className="flex-1 bg-transparent text-sm font-mono text-cyan-300 focus:outline-none"
                              placeholder="e.g. 45"
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); applyCustom() }}
                              className="text-[10px] text-cyan-300 hover:text-white px-2 py-0.5 rounded border border-cyan-400/35 hover:border-cyan-300 hover:bg-cyan-500/20 transition-all font-semibold"
                            >✓ Set</button>
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setEditingCustom(false) }}
                              className="text-[10px] text-white/25 hover:text-white/50 px-1.5 py-0.5 rounded border border-white/10 transition-all"
                            >✕</button>
                          </div>
                        )}
                      </div>

                      {/* Session counter */}
                      <div className="flex justify-between text-[10px] text-white/20">
                        <span>Sessions today</span>
                        <span className="font-mono text-white/40">{sessionsCompleted} 🍅</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}