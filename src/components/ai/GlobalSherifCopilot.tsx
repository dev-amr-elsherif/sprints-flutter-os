'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, RotateCcw, Zap, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/store/progressStore'
import { computeStats, getEffectiveStatus, getEligibleNextModules } from '@/lib/utils'
import { CURRICULUM } from '@/lib/curriculum'
import type { SherifAction, DailyPlanSchedule } from '@/lib/types'

interface ChatMessage {
  id: string
  role: 'user' | 'sherif'
  text: string
  executedActions?: string[]
}

// ── XML-style action tag — immune to JSON bracket collisions ──────────────────
// eslint-disable-next-line no-control-regex
const ACTION_BLOCK_REGEX = /<sherif_actions>([\s\S]*?)<\/sherif_actions>/

// ── Intent safety-net patterns ────────────────────────────────────────────────
const TIMER_CLAIM_RE  = /(?:set|locked|primed|started).*?(?:pomodoro|timer).*?(\d+)[-\s]?(?:minute|min|m).*?(?:for|on)\s+([^.\n,!?]+)/i
const TIMER_CLAIM_RE2 = /(\d+)[-\s]?(?:minute|min|m).*?(?:deep work|session|timer|pomodoro).*?(?:for|on)\s+([^.\n,!?]+)/i
const PLAN_CLAIM_RE   = /(?:2-hour|study plan|execution strategy|deep code plan|plan for)/i

// ── Schedule parser — mirrors AiDailyPlanner's parseSchedule ─────────────────
function parseScheduleFromRaw(raw: string): DailyPlanSchedule | null {
  const startIdx = raw.indexOf('---SCHEDULE_START---')
  const endIdx   = raw.indexOf('---SCHEDULE_END---')
  if (startIdx === -1 || endIdx === -1) return null
  const block    = raw.slice(startIdx + '---SCHEDULE_START---'.length, endIdx).trim()
  const stripped = block.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const p = JSON.parse(stripped)
    if (!p.coreTasks || !Array.isArray(p.coreTasks)) return null
    return {
      strategySummary:      p.strategySummary || '',
      focusTags:            Array.isArray(p.focusTags) ? p.focusTags : [],
      totalAllocatedMinutes: Number(p.totalAllocatedMinutes) || 0,
      coreTasks: p.coreTasks.map((t: { moduleId?: string; title?: string; durationMinutes?: number; deliverableGoal?: string }) => ({
        moduleId:        t.moduleId        || '',
        title:           t.title           || '',
        durationMinutes: Number(t.durationMinutes) || 30,
        deliverableGoal: t.deliverableGoal || '',
      })),
      bonusTask: p.bonusTask ? {
        moduleId:        p.bonusTask.moduleId || 'custom',
        title:           p.bonusTask.title    || '',
        durationMinutes: Number(p.bonusTask.durationMinutes) || 20,
        deliverableGoal: p.bonusTask.deliverableGoal || '',
      } : null,
      bufferMinutes: Number(p.bufferMinutes) || 0,
    }
  } catch { return null }
}

function stripActions(text: string): string {
  return text
    .replace(ACTION_BLOCK_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function safeParseActions(innerText: string): SherifAction[] {
  let cleaned = innerText.trim()
  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed as SherifAction[]
    return []
  } catch (e1) {
    // Try wrapping a bare object in an array
    try {
      if (cleaned.trimStart().startsWith('{')) {
        const arr = JSON.parse(`[${cleaned}]`)
        if (Array.isArray(arr)) return arr as SherifAction[]
      }
    } catch { /* ignore */ }
    console.error('\u274C [Sherif Parser] Parse failed:', e1, '\nRaw:', cleaned.slice(0, 300))
    return []
  }
}

function parseActions(text: string): SherifAction[] {
  const m = text.match(ACTION_BLOCK_REGEX)
  if (!m) return []
  return safeParseActions(m[1])
}

function actionLabel(action: SherifAction): string {
  switch (action.type) {
    case 'SET_VIEW':           return `Switched to ${action.payload.viewMode === 'official-sprints' ? 'Sprints' : 'Tracks'} view${action.payload.sprint && action.payload.sprint !== 'all' ? ` · Sprint ${action.payload.sprint}` : ''}`
    case 'SET_DAILY_PLAN':     return `Synced Daily Plan (${action.payload.coreTasks?.length ?? 0} tasks)`
    case 'SET_TIMER':          return `Set ${action.payload.durationMinutes}m Timer: ${action.payload.taskTitle}`
    case 'TOGGLE_LESSON':      return `Lesson ${action.payload.completed ? 'checked' : 'unchecked'}`
    case 'SET_MODULE_STATUS':  return `Module → ${action.payload.status}`
    case 'NAVIGATE_TO_MODULE': return `Navigated to module`
    case 'TOGGLE_ZEN_MODE':    return `Zen Mode ${action.payload.enabled ? 'ON' : 'OFF'}`
    case 'SAVE_ARTIFACT':      return `Artifact saved`
    case 'RESET_PROGRESS':     return `Progress reset`
    case 'TRIGGER_PLAN_GEN':   return `Generating ${action.payload.hours}h plan (${action.payload.energy} mode)…`
    default:                   return 'Action executed'
  }
}

// ── TRIGGER_PLAN_GEN: call /api/ai generate-schedule and hydrate the store ────
async function triggerPlanGen(hours: number, energy: 'deep' | 'balanced' | 'micro', moduleStatuses: Record<string, string>): Promise<string> {
  const energyMap: Record<string, string> = { deep: 'deep-code', balanced: 'balanced', micro: 'micro' }
  const energyLevel = energyMap[energy] || 'balanced'
  const minutes = hours * 60
  const unlocked = getEligibleNextModules(moduleStatuses as Parameters<typeof getEligibleNextModules>[0]).slice(0, 10)
  const moduleList = unlocked
    .map((m) => `  - ${m.id} | ${m.title} | ${m.totalDurationText} | Sprint ${m.sprint} | ${m.track} track`)
    .join('\n')

  try {
    console.log(`\u26A1 [Sherif TRIGGER_PLAN_GEN] Requesting ${hours}h ${energyLevel} plan, ${unlocked.length} unlocked modules`)
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'generate-schedule',
        moduleTitle: `Available: ${minutes} minutes, Energy: ${energyLevel}`,
        userInput: moduleList || '(all modules completed)',
      }),
    })
    if (!res.ok) throw new Error(`generate-schedule HTTP ${res.status}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No body reader')
    const dec = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += dec.decode(value, { stream: true })
    }
    const plan = parseScheduleFromRaw(full)
    if (plan) {
      useProgressStore.getState().setActiveDailyPlan(plan)
      console.log(`\u26A1 [Sherif TRIGGER_PLAN_GEN] Plan committed: ${plan.coreTasks.length} tasks`)
      return `Generated Plan (${plan.coreTasks.length} tasks)`
    } else {
      console.warn('[Sherif TRIGGER_PLAN_GEN] parseScheduleFromRaw returned null — full response:', full.slice(0, 400))
      return 'Plan generation ran (no schedule block found)'
    }
  } catch (e) {
    console.error('[Sherif TRIGGER_PLAN_GEN] Failed:', e)
    return 'Plan generation failed'
  }
}

// ── Execute non-async actions synchronously ───────────────────────────────────
function executeSyncActions(actions: SherifAction[]): { labels: string[]; planGenAction: { hours: number; energy: 'deep' | 'balanced' | 'micro' } | null } {
  const store = useProgressStore.getState()
  const labels: string[] = []
  let planGenAction: { hours: number; energy: 'deep' | 'balanced' | 'micro' } | null = null

  for (const action of actions) {
    try {
      console.log('\u26A1 [Sherif Dispatcher] Executing action:', action)
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
            console.log('\u26A1 [Sherif Dispatcher] SET_DAILY_PLAN committed:', plan.coreTasks.length, 'tasks')
          } else {
            console.warn('[Sherif Dispatcher] SET_DAILY_PLAN missing coreTasks:', plan)
          }
          break
        }
        case 'SET_TIMER': {
          const { taskTitle, durationMinutes, moduleId } = action.payload
          store.setFocusedTask(taskTitle, durationMinutes, moduleId)
          console.log('\u26A1 [Sherif Dispatcher] SET_TIMER:', durationMinutes, 'min for', taskTitle)
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
        case 'TOGGLE_ZEN_MODE':  { store.setZenMode(action.payload.enabled); break }
        case 'SAVE_ARTIFACT': {
          store.saveTaskArtifact(action.payload.moduleId, {
            repoUrl: action.payload.repoUrl,
            prUrl:   action.payload.prUrl,
            demoUrl: action.payload.demoUrl,
          })
          break
        }
        case 'TRIGGER_PLAN_GEN': {
          // Handled async after this loop
          planGenAction = action.payload
          break
        }
      }
      labels.push(actionLabel(action))
    } catch (e) {
      console.warn('[Sherif Dispatcher] Action failed:', action, e)
    }
  }
  return { labels, planGenAction }
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
        {isSherif ? '\uD83E\uDD16' : '\uD83D\uDC64'}
      </div>
      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5',
        isSherif ? 'bg-white/[0.04] border border-white/[0.07] rounded-tl-none' : 'bg-cyan-500/15 border border-cyan-400/20 text-cyan-100 rounded-tr-none')}>
        {isSherif
          ? msg.text
            ? <><MiniMD text={msg.text} />{msg.executedActions && <ExecutionPill labels={msg.executedActions} />}</>
            : <span className="text-[12px] text-white/30 italic flex items-center gap-1.5"><Bot className="w-3 h-3 animate-pulse text-purple-400" /> Sherif is thinking\u2026</span>
          : <p className="text-[13px] leading-relaxed">{msg.text}</p>
        }
      </div>
    </motion.div>
  )
}

export function GlobalSherifCopilot() {
  const [open, setOpen]                 = useState(false)
  const [messages, setMessages]         = useState<ChatMessage[]>([])
  const [apiHistory, setApiHistory]     = useState<{ role: 'user' | 'model'; content: string }[]>([])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [isStreaming, setIsStreaming]    = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const abortRef    = useRef<AbortController | null>(null)
  const endRef      = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { moduleStatuses, focusedTaskTitle, focusedTaskDurationSecs, viewMode, activeSprint, activeDailyPlan } = useProgressStore()
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
    return JSON.stringify({ viewMode, activeSprint, overallPercentage: stats.overallPercentage, completedModules: completedIds.length, totalModules: stats.totalModules, recentCompletedIds: completedIds.slice(-5), nextModules: nextMods, activePomodoro, hasDailyPlan: !!activeDailyPlan })
  }, [moduleStatuses, focusedTaskTitle, focusedTaskDurationSecs, viewMode, activeSprint, activeDailyPlan, stats])

  const scrollDown = useCallback(() => { setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80) }, [])

  useEffect(() => { if (open) setTimeout(() => textareaRef.current?.focus(), 200) }, [open])
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
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
        body: JSON.stringify({ mode: 'sherif-chat', moduleTitle: 'Global Mentor Session', messages: nextHist, systemContext }),
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
        // Strip action tags from live preview
        setMessages((p) => p.map((m) => m.id === sherifId ? { ...m, text: stripActions(full) } : m))
      }
      setIsStreaming(false)

      // ── Parse dispatched actions ──
      const actions = parseActions(full)
      const hasReset = actions.some((a) => a.type === 'RESET_PROGRESS')
      if (hasReset) setResetPending(true)
      const safeActions = actions.filter((a) => a.type !== 'RESET_PROGRESS')
      const { labels: syncLabels, planGenAction } = executeSyncActions(safeActions)
      let allLabels = [...syncLabels]

      // ── Intent safety net: fallback timer ──
      const cleanText = stripActions(full)
      if (!safeActions.some((a) => a.type === 'SET_TIMER')) {
        const m1 = full.match(TIMER_CLAIM_RE) || full.match(TIMER_CLAIM_RE2)
        if (m1) {
          const mins = parseInt(m1[1] || m1[2] || '0', 10)
          const rawTitle = (m1[2] || m1[1] || '').trim().replace(/[.!?]+$/, '').slice(0, 60)
          if (mins >= 1 && mins <= 180 && rawTitle) {
            console.log('[Sherif Safety Net] Timer fallback:', mins, rawTitle)
            useProgressStore.getState().setFocusedTask(rawTitle, mins)
            allLabels.push(`Set ${mins}m Timer: ${rawTitle} (fallback)`)
          }
        }
      }

      // ── Intent safety net: fallback plan gen ──
      const hasPlanAction = safeActions.some((a) => a.type === 'SET_DAILY_PLAN' || a.type === 'TRIGGER_PLAN_GEN')
      if (!hasPlanAction && PLAN_CLAIM_RE.test(full)) {
        console.log('[Sherif Safety Net] Plan fallback — triggering TRIGGER_PLAN_GEN 2h balanced')
        const label = await triggerPlanGen(2, 'balanced', moduleStatuses as Record<string, string>)
        allLabels.push(`${label} (fallback)`)
      }

      // ── Handle TRIGGER_PLAN_GEN async ──
      if (planGenAction) {
        // Replace the "generating…" label with the real result
        allLabels = allLabels.filter((l) => !l.includes('Generating'))
        const label = await triggerPlanGen(planGenAction.hours, planGenAction.energy, moduleStatuses as Record<string, string>)
        allLabels.push(label)
      }

      setMessages((p) => p.map((m) => m.id === sherifId
        ? { ...m, text: cleanText, executedActions: allLabels.length ? allLabels : undefined }
        : m
      ))
      setApiHistory((h) => [...h, { role: 'model', content: cleanText }])
      scrollDown()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
      setMessages((p) => p.map((m) => m.id === sherifId ? { ...m, text: `\u26A0\uFE0F ${(e as Error).message}` } : m))
    }
  }, [isLoading, isStreaming, apiHistory, buildContext, scrollDown, moduleStatuses])

  const handleClear = () => {
    abortRef.current?.abort()
    setMessages([]); setApiHistory([]); setInput('')
    setIsLoading(false); setIsStreaming(false); setResetPending(false)
  }

  const QUICK_PROMPTS = [
    '\uD83D\uDDFA\uFE0F What should I study next?',
    '\uD83D\uDDD3\uFE0F Build me a 2-hour Deep Code study plan',
    '\u23F1\uFE0F Set a 45m timer for Dart OOP',
    '\uD83D\uDCBB Switch to Sprint 2 modules',
    '\uD83C\uDFD7\uFE0F Explain Clean Architecture simply',
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
              <h3 className="text-sm font-bold text-red-300 mb-2">\u26A0\uFE0F Confirm Progress Reset</h3>
              <p className="text-xs text-white/50 mb-4">Sherif wants to reset all module progress. This cannot be undone.</p>
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

      {/* ── FAB ── */}
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 300 }}
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-2xl glass-strong border shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95',
          open ? 'border-purple-400/40 bg-purple-500/10' : 'border-white/[0.09] hover:border-purple-400/30'
        )}
        title="Open Sherif AI Co-Pilot"
      >
        <div className="relative">
          <span className="text-lg">\uD83E\uDD16</span>
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

      {/* ── Slide-Over Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div key="copilot"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] max-w-full flex flex-col bg-zinc-950/98 backdrop-blur-2xl border-l border-white/[0.10] shadow-2xl overflow-hidden h-[100dvh]"
          >
            <div className="h-[2px] w-full shrink-0 bg-gradient-to-r from-purple-500/60 via-cyan-500/40 to-transparent" />

            {/* Header */}
            <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
              <div className="relative shrink-0">
                <span className="text-xl">\uD83E\uDD16</span>
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

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4 min-h-0">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-5 py-8">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-400/20 flex items-center justify-center text-3xl">\uD83E\uDD16</div>
                  <div>
                    <p className="text-sm font-semibold text-white/60">Sherif — OS Controller</p>
                    <p className="text-[12px] text-white/30 mt-1.5 max-w-[260px] leading-relaxed">
                      I can build study plans, set timers, switch views, mark progress, and navigate your board.
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
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/20 flex items-center justify-center text-sm shrink-0">\uD83E\uDD16</div>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-tl-none bg-white/[0.04] border border-white/[0.07]">
                    <Bot className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    <span className="text-[12px] text-white/30">Thinking\u2026</span>
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input bar */}
            <div className="shrink-0 border-t border-white/[0.07] px-4 pt-3 pb-safe bg-zinc-950/80">
              <div className="flex items-end gap-2">
                <textarea ref={textareaRef} value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                  placeholder="Ask Sherif or give a command... (Shift+Enter for new line)"
                  rows={1} disabled={isLoading || isStreaming}
                  className="flex-1 rounded-xl px-3.5 py-2.5 resize-none scrollbar-none bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-all disabled:opacity-40 leading-relaxed"
                  style={{ minHeight: '42px', maxHeight: '140px' }} />
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || isStreaming}
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                  {isLoading || isStreaming ? <Bot className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[9px] text-white/15 mt-1.5 text-center">
                {focusedTaskTitle ? `\uD83C\uDF45 Active: ${focusedTaskTitle}` : 'No active task'} · Enter to send
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
