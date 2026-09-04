'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'
import { useProgressStore } from '@/store/progressStore'
import { getModuleById } from '@/lib/curriculum'
import { cn } from '@/lib/utils'

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

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 528
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 1)
  } catch { /* noop — autoplay blocked */ }
}

export function PomodoroTimer() {
  const { zenMode, setZenMode, focusedModuleId, setFocusedModule } = useProgressStore()
  const [phase, setPhase] = useState<Phase>('focus')
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [seconds, setSeconds] = useState(25 * 60)
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load minimized preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pomodoro-minimized')
      if (saved !== null) {
        setIsMinimized(saved === 'true')
      }
    }
  }, [])

  const toggleMinimized = useCallback((val?: boolean) => {
    setIsMinimized((prev) => {
      const next = typeof val === 'boolean' ? val : !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('pomodoro-minimized', String(next))
      }
      return next
    })
  }, [])

  const focusedModule = focusedModuleId ? getModuleById(focusedModuleId) : null

  // Auto-expand and maximize when a module is focused externally
  useEffect(() => {
    if (focusedModuleId) {
      toggleMinimized(false)
      setIsExpanded(true)
    }
  }, [focusedModuleId, toggleMinimized])

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
          beep()
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

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const totalSecs = selectedMinutes * 60
  const pct = totalSecs > 0 ? (1 - seconds / totalSecs) * 100 : 0
  const circumference = 2 * Math.PI * 44

  const phaseColor =
    phase === 'focus' ? '#a855f7' : phase === 'short-break' ? '#06b6d4' : '#10b981'

  const phaseEmoji = phase === 'focus' ? '🎯' : phase === 'short-break' ? '☕' : '🌙'

  return (
    <>
      {/* Zen mode overlay — sits below z-50 so only timer shows through */}
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

      {/* Floating timer widget */}
      <div className="fixed bottom-6 right-6 z-50 select-none">
        <AnimatePresence mode="wait">
          {isMinimized ? (
            /* ── Minimized Pill ── */
            <motion.div
              key="minimized"
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="glass-strong h-10 px-3.5 py-1.5 rounded-full border border-white/15 shadow-2xl flex items-center gap-2.5 backdrop-blur-xl"
            >
              {/* Pulse dot + Phase emoji + Time */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{phaseEmoji}</span>
                <span className="text-xs font-bold font-mono text-white tabular-nums tracking-tight">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    timerState === 'running'
                      ? 'animate-pulse'
                      : timerState === 'complete'
                      ? 'opacity-100'
                      : 'opacity-40'
                  )}
                  style={{ backgroundColor: phaseColor }}
                />
              </div>

              <div className="h-3.5 w-px bg-white/10" />

              {/* Quick Play/Pause/Next */}
              {timerState === 'running' ? (
                <button
                  onClick={pause}
                  className="flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
                  title="Pause"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </button>
              ) : timerState === 'complete' ? (
                <button
                  onClick={() => reset(selectedMinutes)}
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 hover:text-emerald-200 transition-colors"
                  title="Next session"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Next</span>
                </button>
              ) : (
                <button
                  onClick={start}
                  className="flex items-center gap-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                  title={timerState === 'paused' ? 'Resume' : 'Start'}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{timerState === 'paused' ? 'Resume' : 'Start'}</span>
                </button>
              )}

              <div className="h-3.5 w-px bg-white/10" />

              {/* Maximize Button */}
              <button
                onClick={() => toggleMinimized(false)}
                className="text-white/40 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                title="Maximize timer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            /* ── Expanded Dial Card ── */
            <motion.div
              key="expanded"
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'glass-strong rounded-2xl border border-white/[0.10] shadow-2xl overflow-hidden',
                isExpanded ? 'w-72' : 'w-56'
              )}
            >
              {/* Accent line */}
              <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${phaseColor}80, transparent)` }} />

              {/* Top bar */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
                <div className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  timerState === 'running' ? 'animate-pulse' :
                  timerState === 'complete' ? 'opacity-100' : 'opacity-40'
                )} style={{ backgroundColor: phaseColor }} />
                <span className="text-xs font-medium text-white/60 flex-1 truncate">
                  {phase === 'focus' ? '🎯 Deep Work' : phase === 'short-break' ? '☕ Short Break' : '🌙 Long Break'}
                </span>
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
                <button
                  onClick={() => setIsExpanded((v) => !v)}
                  className="text-white/25 hover:text-white/60 transition-colors p-0.5"
                  title={isExpanded ? 'Hide presets' : 'Show presets'}
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => toggleMinimized(true)}
                  className="text-white/25 hover:text-white/60 transition-colors p-0.5"
                  title="Minimize to pill"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Timer face */}
              <div className="px-4 pt-4 pb-3 flex flex-col items-center gap-3">
                {/* Circular progress ring */}
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-2xl font-bold font-mono text-white tabular-nums tracking-tight">
                      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-white/25 font-mono uppercase">
                      {timerState === 'complete' ? '✓ done' : `${sessionsCompleted} 🍅`}
                    </span>
                  </div>
                </div>

                {/* Focused module */}
                {focusedModule && (
                  <div className="flex items-center gap-1.5 max-w-full">
                    <span className="text-[10px] text-white/35 truncate">📌 {focusedModule.title}</span>
                    <button onClick={() => setFocusedModule(null)} className="text-white/15 hover:text-white/40 shrink-0 transition-colors">✕</button>
                  </div>
                )}

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

              {/* Expanded controls */}
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

                      {/* Duration presets */}
                      <div>
                        <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Duration</p>
                        <div className="flex gap-1">
                          {(phase === 'focus' ? FOCUS_PRESETS : BREAK_PRESETS).map((p) => (
                            <button
                              key={p.minutes}
                              onClick={() => { setSelectedMinutes(p.minutes); reset(p.minutes) }}
                              className={cn(
                                'flex-1 py-1.5 rounded-lg text-xs font-mono border transition-all',
                                selectedMinutes === p.minutes && timerState === 'idle'
                                  ? 'text-white border-white/25 bg-white/10'
                                  : 'text-white/30 border-white/[0.06] hover:text-white/60'
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between text-[10px] text-white/20">
                        <span>Sessions completed</span>
                        <span className="font-mono text-white/40">{sessionsCompleted} 🍅</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
