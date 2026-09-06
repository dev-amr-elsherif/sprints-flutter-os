'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, RotateCcw, Zap, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/store/progressStore'
import { computeStats, getEffectiveStatus } from '@/lib/utils'
import { CURRICULUM } from '@/lib/curriculum'
import type { SherifAction, DailyPlanSchedule } from '@/lib/types'

interface ChatMessage {
  id: string
  role: 'user' | 'sherif'
  text: string
  executedActions?: string[]
}

// ── Dispatch block regex — matches [[ACTION:DISPATCH:...]] greedy, single-line or multi-line ──
const DISPATCH_RE = /\[\[ACTION:DISPATCH:([\s\S]*?)\]\]/

// ── Intent safety-net patterns — fire when LLM claims an action in text without dispatch block ──
const TIMER_CLAIM_RE = /(?:set|locked|primed|started).*?(?:pomodoro|timer).*?(\d+)[-\s]?(?:minute|min|m).*?(?:for|on)\s+([^.\n,!?]+)/i
const TIMER_CLAIM_RE2 = /(\d+)[-\s]?(?:minute|min|m).*?(?:deep work|session|timer|pomodoro).*?(?:for|on)\s+([^.\n,!?]+)/i

function stripDispatch(text: string): string {
  return text.replace(DISPATCH_RE, '').replace(/\n{3,}/g, '\n\n').trim()
}

/** Attempt to clean + parse JSON from a dispatch block match */
function safeParseActions(raw: string): SherifAction[] {
  // Step 1: trim whitespace
  let cleaned = raw.trim()
  // Step 2: remove trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
  // Step 3: attempt parse
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed as SherifAction[]
    return []
  } catch (e1) {
    // Step 4: try wrapping in array if it looks like a single object
    try {
      if (cleaned.trimStart().startsWith('{')) {
        const arr = JSON.parse(`[${cleaned}]`)
        if (Array.isArray(arr)) return arr as SherifAction[]
      }
    } catch { /* ignore */ }
    console.warn('[Sherif Parser] Could not parse dispatch JSON:', e1, 'Raw:', cleaned.slice(0, 200))
    return []
  }
}

function parseActions(text: string): SherifAction[] {
  const match = text.match(DISPATCH_RE)
  if (!match) return []
  return safeParseActions(match[1])
}

/** Intent safety net: if LLM claims setting a timer in text but didn't dispatch, synthesize the action */
function extractFallbackTimerAction(text: string, dispatchedActions: SherifAction[]): SherifAction | null {
  // Already dispatched a timer? No need for fallback.
  if (dispatchedActions.some((a) => a.type === 'SET_TIMER')) return null
  // Try to extract from text claims
  const m = text.match(TIMER_CLAIM_RE) || text.match(TIMER_CLAIM_RE2)
  if (!m) return null
  const mins = parseInt(m[1] || m[2] || '0', 10)
  const rawTitle = (m[2] || m[1] || '').trim().replace(/[.!?]+$/, '').slice(0, 60)
  if (!mins || mins < 1 || mins > 180 || !rawTitle) return null
  console.log('[Sherif Safety Net] Synthesizing SET_TIMER fallback:', mins, rawTitle)
  return { type: 'SET_TIMER', payload: { durationMinutes: mins, taskTitle: rawTitle } }
}

function actionLabel(action: SherifAction): string {
  switch (action.type) {
    case 'SET_VIEW': return `Switched to ${action.payload.viewMode === 'official-sprints' ? 'Sprints' : 'Tracks'} view${action.payload.sprint && action.payload.sprint !== 'all' ? ` · Sprint ${action.payload.sprint}` : ''}`
    case 'SET_DAILY_PLAN': return `Synced Daily Plan (${action.payload.coreTasks?.length ?? 0} tasks)`
    case 'SET_TIMER': return `Set ${action.payload.durationMinutes}m Timer: ${action.payload.taskTitle}`
    case 'TOGGLE_LESSON': return `Lesson ${action.payload.completed ? 'checked' : 'unchecked'}`
    case 'SET_MODULE_STATUS': return `Module → ${action.payload.status}`
    case 'NAVIGATE_TO_MODULE': return `Navigated to module`
    case 'TOGGLE_ZEN_MODE': return `Zen Mode ${action.payload.enabled ? 'ON' : 'OFF'}`
    case 'SAVE_ARTIFACT': return `Artifact saved`
    case 'RESET_PROGRESS': return `Progress reset`
    default: return 'Action executed'
  }
}

function executeActions(actions: SherifAction[]): string[] {
  const store = useProgressStore.getState()
  const labels: string[] = []

  for (const action of actions) {
    try {
      console.log('⚡ [Sherif Dispatcher] Executing action:', action)
      switch (action.type) {
        case 'SET_VIEW': {
          store.setViewMode(action.payload.viewMode)
          if (action.payload.sprint !== undefined) store.setActiveSprint(action.payload.sprint)
          break
        }
        case 'SET_DAILY_PLAN': {
          const plan = action.payload as DailyPlanSchedule
          if (plan && Array.isArray(plan.coreTasks)) {
            store.setActiveDailyPlan(plan)
            console.log('⚡ [Sherif Dispatcher] Daily plan committed:', plan.coreTasks.length, 'tasks')
          } else {
            console.warn('[Sherif Dispatcher] SET_DAILY_PLAN payload missing coreTasks:', plan)
          }
          break
        }
        case 'SET_TIMER': {
          const { taskTitle, durationMinutes, moduleId } = action.payload
          store.setFocusedTask(taskTitle, durationMinutes, moduleId)
          console.log('⚡ [Sherif Dispatcher] Timer set:', durationMinutes, 'min for', taskTitle)
          break
        }
        case 'TOGGLE_LESSON': {
          const current = store.lessonStatuses[action.payload.lessonId] === true
          if (current !== action.payload.completed) store.toggleLesson(action.payload.lessonId)
          break
        }
        case 'SET_MODULE_STATUS': {
          store.setModuleStatus(action.payload.moduleId, action.payload.status)
          break
        }
        case 'NAVIGATE_TO_MODULE': {
          setTimeout(() => {
            const el = document.getElementById(`module-${action.payload.moduleId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.classList.add('prereq-highlight-ring')
              setTimeout(() => el.classList.remove('prereq-highlight-ring'), 3000)
            }
          }, 300)
          break
        }
        case 'TOGGLE_ZEN_MODE': {
          store.setZenMode(action.payload.enabled)
          break
        }
        case 'SAVE_ARTIFACT': {
          store.saveTaskArtifact(action.payload.moduleId, {
            repoUrl: action.payload.repoUrl,
            prUrl: action.payload.prUrl,
            demoUrl: action.payload.demoUrl,
          })
          break
        }
      }
      labels.push(actionLabel(action))
    } catch (e) {
      console.warn('[Sherif Dispatcher] Action failed:', action, e)
    }
  }
  return labels
}

function MiniMD({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-white/70">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 text-cyan-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-white/80 mt-3 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-1.5 text-[12px] text-white/60 leading-relaxed ml-1"><span class="shrink-0">&bull;</span><span>$1</span></li>')
    .replace(/\n\n/g, '</p><p class="text-[13px] text-white/60 leading-relaxed mt-2">')
    .replace(/\n/g, '<br/>')
  return (
    <div className="text-[13px] text-white/60 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class="text-[13px] text-white/60 leading-relaxed">${html}</p>` }} />
  )
}

function ExecutionPill({ labels }: { labels: string[] }) {
  if (!labels.length) return null
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="mt-2.5 flex items-start gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold text-emerald-300/80 flex items-center gap-1 shrink-0 mt-0.5">
        <Zap className="w-2.5 h-2.5" /> Executed:
      </span>
      <div className="flex flex-wrap gap-1">
        {labels.map((l, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300/80 border border-emerald-400/15">
            {l}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isSherif = msg.role === 'sherif'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      className={cn('flex gap-2.5', !isSherif && 'flex-row-reverse')}>
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5',
        isSherif ? 'bg-purple-500/20 text-purple-300 border border-purple-400/20' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/20')}>
        {isSherif ? '🤖' : '👤'}
      </div>
      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5',
        isSherif ? 'bg-white/[0.04] border border-white/[0.07] rounded-tl-none' : 'bg-cyan-500/15 border border-cyan-400/20 text-cyan-100 rounded-tr-none')}>
        {isSherif
          ? msg.text
            ? <><MiniMD text={msg.text} />{msg.executedActions && <ExecutionPill labels={msg.executedActions} />}</>
            : <span className="text-[12px] text-white/30 italic flex items-center gap-1.5"><Bot className="w-3 h-3 animate-pulse text-purple-400" /> Sherif is thinking…</span>
          : <p className="text-[13px] leading-relaxed">{msg.text}</p>
        }
      </div>
    </motion.div>
  )
}

export function GlobalSherifCopilot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [apiHistory, setApiHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    moduleStatuses, focusedTaskTitle, focusedTaskDurationSecs,
    viewMode, activeSprint, activeDailyPlan,
  } = useProgressStore()
  const stats = computeStats(moduleStatuses)

  const buildContext = useCallback(() => {
    const completedIds = CURRICULUM
      .filter((m) => { const s = moduleStatuses[m.id]; return s === 'completed' || s === 'passed' })
      .map((m) => m.id)
    const nextMods = CURRICULUM
      .filter((m) => getEffectiveStatus(m.id, m.isPassed, moduleStatuses) === 'not-started')
      .slice(0, 5)
      .map((m) => ({ id: m.id, title: m.title, sprint: m.sprint }))
    const activePomodoro = focusedTaskTitle
      ? { title: focusedTaskTitle, durationMins: focusedTaskDurationSecs ? Math.round(focusedTaskDurationSecs / 60) : null }
      : null
    return JSON.stringify({
      viewMode, activeSprint,
      overallPercentage: stats.overallPercentage,
      completedModules: completedIds.length,
      totalModules: stats.totalModules,
      recentCompletedIds: completedIds.slice(-5),
      nextModules: nextMods,
      activePomodoro,
      hasDailyPlan: !!activeDailyPlan,
    })
  }, [moduleStatuses, focusedTaskTitle, focusedTaskDurationSecs, viewMode, activeSprint, activeDailyPlan, stats])

  const scrollDown = useCallback(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200)
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isStreaming) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: text.trim() }
    const systemContext = buildContext()
    const nextHist = [...apiHistory, { role: 'user' as const, content: text.trim() }]
    setMessages((p) => [...p, userMsg])
    setInput('')
    // Reset textarea height
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }
    setApiHistory(nextHist)
    scrollDown()

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const sherifId = `s-${Date.now()}`
    let full = ''

    try {
      setIsLoading(true)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'sherif-chat',
          moduleTitle: 'Global Mentor Session',
          messages: nextHist,
          systemContext,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`AI error ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No body')
      const dec = new TextDecoder()
      setIsLoading(false)
      setIsStreaming(true)
      setMessages((p) => [...p, { id: sherifId, role: 'sherif', text: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
        setMessages((p) => p.map((m) => m.id === sherifId ? { ...m, text: stripDispatch(full) } : m))
      }
      setIsStreaming(false)

      // ── Parse & execute dispatched actions ──
      const actions = parseActions(full)
      const hasReset = actions.some((a) => a.type === 'RESET_PROGRESS')
      if (hasReset) setResetPending(true)
      const safeActions = actions.filter((a) => a.type !== 'RESET_PROGRESS')
      let labels = safeActions.length > 0 ? executeActions(safeActions) : []

      // ── Intent safety net: fallback timer synthesis ──
      const cleanText = stripDispatch(full)
      const fallbackTimer = extractFallbackTimerAction(full, safeActions)
      if (fallbackTimer) {
        const fallbackLabels = executeActions([fallbackTimer])
        labels = [...labels, ...fallbackLabels]
      }

      setMessages((p) => p.map((m) => m.id === sherifId
        ? { ...m, text: cleanText, executedActions: labels.length ? labels : undefined }
        : m
      ))
      setApiHistory((h) => [...h, { role: 'model', content: cleanText }])
      scrollDown()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
      setMessages((p) => p.map((m) => m.id === sherifId
        ? { ...m, text: `⚠️ ${(e as Error).message}` } : m
      ))
    }
  }, [isLoading, isStreaming, apiHistory, buildContext, scrollDown])

  const handleClear = () => {
    abortRef.current?.abort()
    setMessages([])
    setApiHistory([])
    setInput('')
    setIsLoading(false)
    setIsStreaming(false)
    setResetPending(false)
  }

  const QUICK_PROMPTS = [
    '🗺️ What should I study next?',
    '🗓️ Build me a 2-hour Deep Code study plan',
    '⏱️ Set a 45m timer for Dart OOP',
    '💻 Switch to Sprint 2 modules',
    '🏗️ Explain Clean Architecture simply',
  ]

  return (
    <>
      {/* ── Reset Confirmation Modal ── */}
      <AnimatePresence>
        {resetPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-strong border border-red-400/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-sm font-bold text-red-300 mb-2">⚠️ Confirm Progress Reset</h3>
              <p className="text-xs text-white/50 mb-4">Sherif wants to reset all module progress to 0%. This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => { useProgressStore.getState().resetProgress(); setResetPending(false) }}
                  className="flex-1 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold transition-all">
                  Yes, Reset Everything
                </button>
                <button onClick={() => setResetPending(false)}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-all">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB Button ── */}
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 300 }}
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 right-6 z-40 flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-2xl glass-strong border shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95',
          open ? 'border-purple-400/40 bg-purple-500/10' : 'border-white/[0.09] hover:border-purple-400/30'
        )}
        title="Open Sherif AI Co-Pilot"
      >
        <div className="relative">
          <span className="text-lg">🤖</span>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xs font-bold text-purple-200">Sherif AI</span>
          <span className="text-[9px] text-white/30">OS Controller</span>
        </div>
      </motion.button>

      {/* ── Mobile Backdrop ── */}
      <AnimatePresence>
        {open && (
          <motion.div key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[59] sm:hidden" />
        )}
      </AnimatePresence>

      {/* ── Slide-Over Panel (replaces clipping floating box) ── */}
      <AnimatePresence>
        {open && (
          <motion.div key="copilot"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-[60] w-full sm:w-[440px] max-w-full flex flex-col bg-zinc-950/98 backdrop-blur-2xl border-l border-white/[0.10] shadow-2xl overflow-hidden"
          >
            {/* Purple accent line */}
            <div className="h-[2px] w-full shrink-0 bg-gradient-to-r from-purple-500/60 via-cyan-500/40 to-transparent" />

            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
              <div className="relative shrink-0">
                <span className="text-xl">🤖</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Sherif</p>
                <p className="text-[11px] text-purple-300/60 mt-0.5 flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" /> Autonomous OS Controller · {stats.overallPercentage}% complete
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button onClick={handleClear} title="Clear conversation"
                    className="p-2 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} title="Close"
                  className="p-2 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message stream — flex-1, scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-8">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center text-3xl">🤖</div>
                  <div>
                    <p className="text-sm font-semibold text-white/60">Sherif — OS Controller</p>
                    <p className="text-[12px] text-white/30 mt-1.5 max-w-[260px] leading-relaxed">
                      I can build study plans, set timers, switch views, mark progress, and navigate your board. Just ask me anything.
                    </p>
                  </div>
                  <div className="w-full space-y-1.5">
                    {QUICK_PROMPTS.map((q) => (
                      <button key={q} onClick={() => sendMessage(q)}
                        className="w-full text-[12px] px-4 py-2.5 rounded-xl border border-white/[0.07] text-white/40 hover:text-white/75 hover:border-purple-400/30 hover:bg-purple-500/5 transition-all text-left">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
              </AnimatePresence>
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/20 flex items-center justify-center text-sm shrink-0">🤖</div>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-tl-none bg-white/[0.04] border border-white/[0.07]">
                    <Bot className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    <span className="text-[12px] text-white/30">Thinking…</span>
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>

            {/* Pinned input bar */}
            <div className="shrink-0 border-t border-white/[0.07] px-4 py-3 bg-zinc-950/80">
              <div className="flex items-end gap-2">
                <textarea ref={textareaRef} value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
                  }}
                  placeholder="Ask Sherif or give a command… (Shift+Enter for new line)"
                  rows={1} disabled={isLoading || isStreaming}
                  className="flex-1 rounded-xl px-3.5 py-2.5 resize-none scrollbar-none bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-all disabled:opacity-40 leading-relaxed"
                  style={{ minHeight: '42px', maxHeight: '140px' }} />
                <button onClick={() => sendMessage(input)}  disabled={!input.trim() || isLoading || isStreaming}
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                  {isLoading || isStreaming ? <Bot className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[9px] text-white/15 mt-1.5 text-center">
                {focusedTaskTitle ? `🍅 Active: ${focusedTaskTitle}` : 'No active task'} · Enter to send
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
