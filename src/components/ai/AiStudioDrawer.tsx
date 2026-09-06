'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import {
  X, Sparkles, Code2, MessageSquare, Linkedin, Send, RotateCcw,
  Bot, FlaskConical, Clipboard, Check, Wifi, WifiOff, RefreshCw,
  LayoutGrid, ListOrdered, Timer, Play, HelpCircle, Zap,
} from 'lucide-react'
import type { AiMode, TrackType } from '@/lib/types'
import { useAiStream, ChatMessage } from './useAiStream'
import { getModuleById } from '@/lib/curriculum'
import { TRACK_META, SPRINT_META, cn } from '@/lib/utils'
import { useProgressStore } from '@/store/progressStore'

// ─── Types ─────────────────────────────────────────────────────────────────────
type StudioMode = AiMode | 'sherif-chat' | 'interview-simulator'

interface AiStudioDrawerProps {
  open: boolean
  onClose: () => void
  initialMode: AiMode
  moduleId: string | null
}

type HealthStatus = 'idle' | 'checking' | 'connected' | 'error'
type LinkedInScope = 'module' | 'sprint' | 'track'
type InterviewBadge = 'solid' | 'needs-depth' | 'gap' | null

interface InterviewMsg {
  id: string
  role: 'sherif' | 'user'
  text: string
  badge?: InterviewBadge
  timerAction?: { minutes: number; title: string }
}

const SPRINT_OPTIONS = [1, 2, 3, 4, 5] as const
const TRACK_OPTIONS: TrackType[] = ['Mobile', 'Systems', 'Quality', 'Career']

// ─── Action tag parser ────────────────────────────────────────────────────────
const ACTION_RE = /\[\[ACTION:SET_TIMER:(\d+):([^\]]+)\]\]/

function parseAndStripAction(text: string): { clean: string; action: { minutes: number; title: string } | null } {
  const match = text.match(ACTION_RE)
  if (!match) return { clean: text, action: null }
  return {
    clean: text.replace(ACTION_RE, '').trim(),
    action: { minutes: parseInt(match[1], 10), title: match[2].trim() },
  }
}

function extractBadge(text: string): InterviewBadge {
  const t = text.toLowerCase()
  if (t.includes('solid answer') || t.includes('🟢')) return 'solid'
  if (t.includes('needs depth') || t.includes('🟡')) return 'needs-depth'
  if (t.includes('architectural gap') || t.includes('🔴')) return 'gap'
  return null
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function MD({ text }: { text: string }) {
  const { clean } = parseAndStripAction(text)
  const html = clean
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-white/80 mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-white/90 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-white mt-5 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-white/70">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 text-cyan-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^---$/gm, '<hr class="border-white/10 my-3"/>')
    .replace(/^\| (.+) \|$/gm, (row) => {
      const cells = row.slice(1, -1).split('|').map((c) => c.trim())
      return `<tr>${cells.map((c) => `<td class="px-3 py-1.5 text-xs text-white/60 border-b border-white/5">${c}</td>`).join('')}</tr>`
    })
    .replace(/^- (.+)$/gm, '<li class="flex gap-2 text-sm text-white/60 leading-relaxed"><span class="text-white/25 mt-1">•</span><span>$1</span></li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="flex gap-2 text-sm text-white/60 leading-relaxed"><span class="text-white/40 font-mono text-xs mt-0.5 shrink-0">›</span><span>$1</span></li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-white/55 leading-relaxed my-2">')
    .replace(/\n/g, '<br/>')
  return (
    <div className="prose-custom text-sm text-white/60 leading-relaxed space-y-1"
      dangerouslySetInnerHTML={{ __html: `<p class="text-sm text-white/55 leading-relaxed">${html}</p>` }} />
  )
}

// ─── Sherif avatar pill ───────────────────────────────────────────────────────
function SherifPill({ online }: { online?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/20">
      <Bot className="w-3.5 h-3.5 text-purple-300" />
      <span className="text-xs font-semibold text-purple-200">Sherif</span>
      <span className="text-[10px] text-purple-300/60 hidden sm:inline">Principal Technical Mentor</span>
      {online !== undefined && (
        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', online ? 'bg-emerald-400 animate-pulse' : 'bg-white/20')} />
      )}
    </div>
  )
}

// ─── Interview badge ──────────────────────────────────────────────────────────
function BadgePill({ badge }: { badge: InterviewBadge }) {
  if (!badge) return null
  const cfg = {
    solid: { label: '🟢 Solid Answer', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
    'needs-depth': { label: '🟡 Needs Depth', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
    gap: { label: '🔴 Architectural Gap', cls: 'text-red-300 bg-red-500/10 border-red-500/20' },
  }[badge]
  return (
    <span className={cn('inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.cls)}>{cfg.label}</span>
  )
}

// ─── Timer Notification ───────────────────────────────────────────────────────
function TimerNote({ minutes, title, moduleId }: { minutes: number; title: string; moduleId?: string | null }) {
  const setFocusedTask = useProgressStore((s) => s.setFocusedTask)
  const [primed, setPrimed] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20 mt-2">
      <Timer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <span className="text-[11px] text-cyan-300 flex-1 min-w-0">
        Pomodoro primed for <strong>{minutes}m</strong>: &ldquo;{title}&rdquo;
      </span>
      {!primed ? (
        <button onClick={() => { setFocusedTask(title, minutes, moduleId ?? undefined); setPrimed(true) }}
          className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-cyan-300 hover:text-white bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/30 transition-all">
          <Play className="w-2.5 h-2.5" /> Start
        </button>
      ) : (
        <span className="shrink-0 text-[10px] text-emerald-400 font-semibold">✓ Primed!</span>
      )}
    </motion.div>
  )
}

// ─── AI Status Pill ───────────────────────────────────────────────────────────
function StatusPill({ status, message, latency, modelName, onTest }: {
  status: HealthStatus; message: string; latency?: number; modelName?: string; onTest: () => void
}) {
  const fmt = (n?: string) => {
    if (!n) return 'Gemini 2.5 Flash'
    const map: Record<string, string> = { 'gemini-2.5-flash': 'Gemini 2.5 Flash', 'gemini-2.0-flash': 'Gemini 2.0 Flash', 'gemini-flash-latest': 'Gemini Flash', 'gemini-3.6-flash': 'Gemini 3.6 Flash' }
    return map[n] ?? n
  }
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.05] bg-white/[0.015]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {status === 'checking' && <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />}
        {status === 'connected' && <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
        {status === 'error' && <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />}
        {status === 'idle' && <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />}
        <span className={cn('text-[11px] font-medium truncate', status === 'connected' && 'text-emerald-300', status === 'error' && 'text-red-300', status === 'checking' && 'text-amber-300', status === 'idle' && 'text-white/30')}>
          {status === 'idle' && 'AI not checked'}
          {status === 'checking' && 'Checking connection...'}
          {status === 'connected' && `🟢 ${fmt(modelName)}${latency ? ` — ${latency}ms` : ''}`}
          {status === 'error' && `🔴 ${message || 'AI Error / Disconnected'}`}
        </span>
      </div>
      <button onClick={onTest} disabled={status === 'checking'}
        className={cn('shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all',
          status === 'checking' ? 'text-white/20 border-white/5 cursor-not-allowed' : 'text-white/40 border-white/10 hover:text-white/70 hover:border-white/20 hover:bg-white/5')}>
        <RefreshCw className={cn('w-3 h-3', status === 'checking' && 'animate-spin')} /> Test
      </button>
    </div>
  )
}

// ─── LinkedIn scope selector ──────────────────────────────────────────────────
function LIScope({ scope, onScopeChange, selectedSprint, onSprintChange, selectedTrack, onTrackChange }: {
  scope: LinkedInScope; onScopeChange: (s: LinkedInScope) => void
  selectedSprint: number | null; onSprintChange: (n: number) => void
  selectedTrack: TrackType | null; onTrackChange: (t: TrackType) => void
}) {
  return (
    <div className="shrink-0 space-y-3 p-3 bg-white/[0.025] rounded-xl border border-white/[0.06]">
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Post Scope</p>
        <div className="flex gap-1.5">
          {([
            { id: 'module' as LinkedInScope, label: 'Module', icon: <Sparkles className="w-3 h-3" /> },
            { id: 'sprint' as LinkedInScope, label: 'Sprint Milestone', icon: <ListOrdered className="w-3 h-3" /> },
            { id: 'track' as LinkedInScope, label: 'Track Mastery', icon: <LayoutGrid className="w-3 h-3" /> },
          ] as const).map((opt) => (
            <button key={opt.id} onClick={() => onScopeChange(opt.id)}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center border transition-all',
                scope === opt.id ? 'text-white bg-purple-500/20 border-purple-400/40' : 'text-white/35 border-white/[0.06] hover:border-white/15 hover:text-white/60')}>
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {scope === 'sprint' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Select Sprint</p>
            <div className="flex flex-wrap gap-1.5">
              {SPRINT_OPTIONS.map((s) => {
                const m = SPRINT_META[s]
                return (
                  <button key={s} onClick={() => onSprintChange(s)}
                    className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      selectedSprint === s ? 'text-white border' : 'text-white/40 border-white/[0.06] hover:border-white/15 hover:text-white/60')}
                    style={selectedSprint === s ? { color: m.color, borderColor: `${m.color}50`, backgroundColor: `${m.color}15` } : undefined}>
                    {m.emoji} Sprint {s}
                  </button>
                )
              })}
            </div>
            {selectedSprint && <p className="text-[10px] text-white/30 mt-1.5">{SPRINT_META[selectedSprint].name} · {SPRINT_META[selectedSprint].duration}</p>}
          </motion.div>
        )}
        {scope === 'track' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Select Track</p>
            <div className="flex flex-wrap gap-1.5">
              {TRACK_OPTIONS.map((t) => {
                const m = TRACK_META[t]
                return (
                  <button key={t} onClick={() => onTrackChange(t)}
                    className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      selectedTrack === t ? 'text-white border' : 'text-white/40 border-white/[0.06] hover:border-white/15 hover:text-white/60')}
                    style={selectedTrack === t ? { color: m.color, borderColor: `${m.color}50`, backgroundColor: `${m.color}15` } : undefined}>
                    {m.emoji} {m.shortLabel}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Shared chat bubble ───────────────────────────────────────────────────────
function ChatBubble({ msg, moduleId }: { msg: InterviewMsg; moduleId: string | null }) {
  const isSherif = msg.role === 'sherif'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={cn('flex gap-2.5', !isSherif && 'flex-row-reverse')}>
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
        isSherif ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300')}>
        {isSherif ? '🤖' : '👤'}
      </div>
      <div className={cn('flex-1 max-w-[88%]', !isSherif && 'flex flex-col items-end')}>
        <div className={cn('px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
          isSherif ? 'bg-white/[0.04] border border-white/[0.06] text-white/70' : 'bg-cyan-500/15 border border-cyan-400/20 text-cyan-100')}>
          {isSherif
            ? (msg.text ? <MD text={msg.text} /> : <span className="text-white/25 italic text-xs">Sherif is thinking...</span>)
            : <p className="text-sm">{msg.text}</p>
          }
        </div>
        {isSherif && (
          <div className="mt-1.5 space-y-1.5">
            {msg.badge && <BadgePill badge={msg.badge} />}
            {msg.timerAction && <TimerNote minutes={msg.timerAction.minutes} title={msg.timerAction.title} moduleId={moduleId} />}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Loading bubble ───────────────────────────────────────────────────────────
function ThinkingBubble() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs">🤖</div>
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
        <Bot className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
        <span className="text-xs text-white/30">Sherif is thinking...</span>
      </div>
    </motion.div>
  )
}

// ─── Interview panel ──────────────────────────────────────────────────────────
function InterviewPanel({ moduleId, moduleTitle }: { moduleId: string | null; moduleTitle: string }) {
  const [messages, setMessages] = useState<InterviewMsg[]>([])
  const [userInput, setUserInput] = useState('')
  const [round, setRound] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const MAX_ROUNDS = 3

  const historyMessages = useMemo((): ChatMessage[] =>
    messages.map((m) => ({ role: m.role === 'sherif' ? 'model' : 'user', content: m.text })),
    [messages])

  const scrollDown = useCallback(() => { setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80) }, [])

  const streamSherif = useCallback(async (history: ChatMessage[]) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const id = `sherif-${Date.now()}`
    let full = ''

    try {
      setIsLoading(true)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'interview-simulator', moduleTitle, moduleId, messages: history }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No body')
      const dec = new TextDecoder()
      setIsLoading(false)
      setIsStreaming(true)
      setMessages((p) => [...p, { id, role: 'sherif', text: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
        setMessages((p) => p.map((m) => m.id === id ? { ...m, text: full } : m))
      }

      setIsStreaming(false)
      const { clean, action } = parseAndStripAction(full)
      const badge = extractBadge(full)
      setMessages((p) => p.map((m) => m.id === id ? { ...m, text: clean, badge: badge ?? undefined, timerAction: action ?? undefined } : m))
      if (action) useProgressStore.getState().setFocusedTask(action.title, action.minutes, moduleId ?? undefined)
      scrollDown()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
      setMessages((p) => p.map((m) => m.id === id ? { ...m, text: `⚠️ ${(e as Error).message}` } : m))
    }
  }, [moduleId, moduleTitle, scrollDown])

  const startInterview = useCallback(() => {
    setMessages([]); setRound(1); setSessionDone(false); setUserInput('')
    streamSherif([{
      role: 'user',
      content: `You are conducting a 3-round technical mock interview for module: "${moduleTitle}". Ask ONE specific production-level technical question for Round 1 of 3. Format with the question in bold. Do NOT answer it. Wait for the student.`,
    }])
  }, [moduleTitle, streamSherif])

  const submitAnswer = useCallback(() => {
    if (!userInput.trim() || isStreaming || isLoading) return
    const next = round + 1
    const done = next > MAX_ROUNDS
    const userMsg: InterviewMsg = { id: `u-${Date.now()}`, role: 'user', text: userInput.trim() }
    const instruction = userInput.trim() + (done
      ? `\n\n[SYSTEM: Student answered Q${round}. This was the last question. Evaluate with badge, then output a "Hireability Verdict & Action Items" scorecard for all ${MAX_ROUNDS} rounds.]`
      : `\n\n[SYSTEM: Student answered Q${round}. Give assessment badge + brief critique, then immediately ask Q${next} of ${MAX_ROUNDS} on a DIFFERENT aspect of "${moduleTitle}".]`)

    setMessages((p) => [...p, userMsg])
    setUserInput('')
    setRound(next)
    if (done) setSessionDone(true)
    scrollDown()
    streamSherif([...historyMessages, { role: 'user', content: instruction }])
  }, [userInput, isStreaming, isLoading, round, historyMessages, streamSherif, scrollDown])

  const reset = () => { abortRef.current?.abort(); setMessages([]); setRound(0); setSessionDone(false); setUserInput(''); setIsLoading(false); setIsStreaming(false) }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <SherifPill online />
        {round > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 font-mono">{sessionDone ? 'Session Complete' : `Round ${Math.min(round, MAX_ROUNDS)} of ${MAX_ROUNDS}`}</span>
            <div className="flex gap-1">
              {Array.from({ length: MAX_ROUNDS }).map((_, i) => (
                <div key={i} className={cn('w-2 h-2 rounded-full transition-all',
                  i < round - 1 ? 'bg-emerald-400' : i === round - 1 ? 'bg-cyan-400 animate-pulse' : 'bg-white/15')} />
              ))}
            </div>
          </div>
        )}
      </div>

      {round === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <MessageSquare className="w-10 h-10 text-purple-400/50" />
          <div>
            <p className="text-sm text-white/50 max-w-xs">
              Sherif will ask you <strong className="text-white/70">3 production-level questions</strong> tailored to <em className="text-purple-300">{moduleTitle || 'this module'}</em>.
            </p>
            <p className="text-[11px] text-white/25 mt-1">STAR method answers preferred</p>
          </div>
          <button onClick={startInterview}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg transition-all active:scale-95">
            <Zap className="w-4 h-4" /> 🎯 Start Mock Interview
          </button>
        </div>
      )}

      {round > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-none space-y-4 pr-0.5">
          <AnimatePresence initial={false}>
            {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} moduleId={moduleId} />)}
          </AnimatePresence>
          {isLoading && <ThinkingBubble />}
          <div ref={endRef} />
        </div>
      )}

      {round > 0 && !sessionDone && (
        <div className="flex items-end gap-2 shrink-0">
          <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() } }}
            placeholder="Type your answer… (Shift+Enter for newline)" rows={3}
            disabled={isLoading || isStreaming}
            className="flex-1 rounded-xl px-3.5 py-2.5 resize-none scrollbar-none bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-all disabled:opacity-40" />
          <button onClick={submitAnswer} disabled={!userInput.trim() || isLoading || isStreaming}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
            {isLoading || isStreaming ? <Bot className="w-3.5 h-3.5 animate-pulse" /> : <Send className="w-3.5 h-3.5" />} Send
          </button>
        </div>
      )}

      {sessionDone && !isStreaming && (
        <div className="flex items-center justify-center shrink-0 pt-2">
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> 🔄 Reset Interview
          </button>
        </div>
      )}

      {round > 0 && !sessionDone && (
        <div className="flex justify-end shrink-0">
          <button onClick={reset} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/50 transition-colors">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Ask Sherif panel ─────────────────────────────────────────────────────────
function AskSherifPanel({ moduleId, moduleTitle }: { moduleId: string | null; moduleTitle: string }) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [displayMessages, setDisplayMessages] = useState<InterviewMsg[]>([])
  const [userInput, setUserInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const scrollDown = useCallback(() => { setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80) }, [])

  const send = useCallback(async () => {
    if (!userInput.trim() || isLoading || isStreaming) return
    const text = userInput.trim()
    const userMsg: ChatMessage = { role: 'user', content: text }
    const hist = [...chatHistory, userMsg]
    const id = `sherif-${Date.now()}`
    let full = ''

    setDisplayMessages((p) => [...p, { id: `u-${Date.now()}`, role: 'user', text }])
    setChatHistory(hist)
    setUserInput('')
    scrollDown()

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      setIsLoading(true)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sherif-chat', moduleTitle, moduleId, messages: hist }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No body')
      const dec = new TextDecoder()
      setIsLoading(false)
      setIsStreaming(true)
      setDisplayMessages((p) => [...p, { id, role: 'sherif', text: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += dec.decode(value, { stream: true })
        setDisplayMessages((p) => p.map((m) => m.id === id ? { ...m, text: full } : m))
      }

      setIsStreaming(false)
      const { clean, action } = parseAndStripAction(full)
      if (action) useProgressStore.getState().setFocusedTask(action.title, action.minutes, moduleId ?? undefined)
      setDisplayMessages((p) => p.map((m) => m.id === id ? { ...m, text: clean, timerAction: action ?? undefined } : m))
      setChatHistory((p) => [...p, { role: 'model', content: clean }])
      scrollDown()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setIsLoading(false); setIsStreaming(false)
      setDisplayMessages((p) => p.map((m) => m.id === id ? { ...m, text: `⚠️ ${(e as Error).message}` } : m))
    }
  }, [userInput, isLoading, isStreaming, chatHistory, moduleId, moduleTitle, scrollDown])

  const reset = () => { abortRef.current?.abort(); setChatHistory([]); setDisplayMessages([]); setUserInput(''); setIsLoading(false); setIsStreaming(false) }

  const QUICK_PROMPTS = ['How does BLoC differ from Riverpod?', 'Explain Clean Architecture layers', 'Debug my Dio interceptor', 'What should I study next?']

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <SherifPill online />
        {displayMessages.length > 0 && (
          <button onClick={reset} className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/50 transition-colors">
            <RotateCcw className="w-3 h-3" /> New chat
          </button>
        )}
      </div>

      {displayMessages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-50">
          <HelpCircle className="w-10 h-10 text-purple-400" />
          <p className="text-sm text-white/50 max-w-xs">Ask Sherif anything — architecture questions, debugging help, syllabus guidance, roadmap advice.</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {QUICK_PROMPTS.map((q) => (
              <button key={q} onClick={() => setUserInput(q)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayMessages.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-none space-y-4 pr-0.5">
          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => <ChatBubble key={msg.id} msg={msg} moduleId={moduleId} />)}
          </AnimatePresence>
          {isLoading && <ThinkingBubble />}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex items-end gap-2 shrink-0">
        <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask Sherif anything… (Shift+Enter for newline)" rows={2}
          disabled={isLoading || isStreaming}
          className="flex-1 rounded-xl px-3.5 py-2.5 resize-none scrollbar-none bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-all disabled:opacity-40" />
        <button onClick={send} disabled={!userInput.trim() || isLoading || isStreaming}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
          {isLoading || isStreaming ? <Bot className="w-3.5 h-3.5 animate-pulse" /> : <Send className="w-3.5 h-3.5" />} Ask
        </button>
      </div>
    </div>
  )
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export function AiStudioDrawer({ open, onClose, initialMode, moduleId }: AiStudioDrawerProps) {
  const [activeTab, setActiveTab] = useState<StudioMode>(initialMode)
  const [userInput, setUserInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle')
  const [healthMessage, setHealthMessage] = useState('')
  const [healthLatency, setHealthLatency] = useState<number | undefined>()
  const [healthModel, setHealthModel] = useState<string>('')
  const [linkedInScope, setLinkedInScope] = useState<LinkedInScope>('module')
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<TrackType | null>(null)

  const { response, isLoading, isStreaming, error, isMock, run, clear } = useAiStream()
  const module = moduleId ? getModuleById(moduleId) : null
  const meta = module ? TRACK_META[module.track] : null
  const moduleTitle = module?.title ?? 'General Module'

  useEffect(() => { setActiveTab(initialMode) }, [initialMode, moduleId])
  useEffect(() => { if (open && healthStatus === 'idle') checkHealth() }, [open]) // eslint-disable-line

  const checkHealth = useCallback(async () => {
    setHealthStatus('checking'); setHealthMessage(''); setHealthLatency(undefined); setHealthModel('')
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'health-check', moduleTitle: '' }) })
      const data = (await res.json()) as { status: string; message?: string; latency?: number; model?: string }
      if (data.status === 'ok') { setHealthStatus('connected'); setHealthLatency(data.latency); setHealthModel(data.model ?? '') }
      else { setHealthStatus('error'); setHealthMessage(data.message ?? 'Unknown error') }
    } catch (e) { setHealthStatus('error'); setHealthMessage((e as Error).message) }
  }, [])

  const handleRun = () => {
    const titleForAi =
      linkedInScope === 'sprint' && selectedSprint ? `Sprint ${selectedSprint}: ${SPRINT_META[selectedSprint].name}`
        : linkedInScope === 'track' && selectedTrack ? `${selectedTrack} Track — ${TRACK_META[selectedTrack].label}`
          : module?.title ?? 'General Module'
    run({
      mode: activeTab as AiMode,
      moduleTitle: titleForAi,
      userInput,
      ...(activeTab === 'linkedin' && {
        scope: linkedInScope,
        ...(linkedInScope === 'sprint' && selectedSprint ? { sprintNumber: selectedSprint, sprintName: SPRINT_META[selectedSprint].name } : {}),
        ...(linkedInScope === 'track' && selectedTrack ? { trackName: selectedTrack } : {}),
      }),
    })
  }

  const handleClear = () => { clear(); setUserInput('') }
  const canRun = activeTab === 'linkedin'
    ? linkedInScope === 'module' ? !!module : linkedInScope === 'sprint' ? !!selectedSprint : !!selectedTrack
    : !!module

  const TABS_CONFIG = [
    { id: 'task-checker' as StudioMode, label: 'Task Review', icon: <Code2 className="w-3.5 h-3.5" />, placeholder: 'Paste your code, schema, SQL query, Dockerfile, or written work here for AI rubric-based review...' },
    { id: 'interview' as StudioMode, label: 'Mock Interview', icon: <MessageSquare className="w-3.5 h-3.5" />, placeholder: '' },
    { id: 'sherif-chat' as StudioMode, label: 'Ask Sherif', icon: <HelpCircle className="w-3.5 h-3.5" />, placeholder: '' },
    { id: 'linkedin' as StudioMode, label: 'LinkedIn Post', icon: <Linkedin className="w-3.5 h-3.5" />, placeholder: 'Optional: What did you build? What surprised you? Any challenges?' },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl glass-strong flex flex-col border-l border-white/[0.08]"
              >
                {meta && <div className="h-[2px] w-full shrink-0" style={{ background: `linear-gradient(to right, ${meta.color}, transparent)` }} />}

                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <Dialog.Title className="text-base font-bold text-white">AI Study Studio</Dialog.Title>
                  </div>
                  {module && (
                    <div className="flex-1 min-w-0 ml-2 px-2.5 py-1 rounded-lg text-xs font-medium truncate"
                      style={{ color: meta?.color, backgroundColor: `${meta?.color}18` }}>
                      {module.title}
                    </div>
                  )}
                  <Dialog.Close asChild>
                    <button className="shrink-0 text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
                  </Dialog.Close>
                </div>

                <StatusPill status={healthStatus} message={healthMessage} latency={healthLatency} modelName={healthModel} onTest={checkHealth} />

                <Tabs.Root value={activeTab} onValueChange={(v) => { setActiveTab(v as StudioMode); handleClear() }} className="flex-1 flex flex-col overflow-hidden">
                  <Tabs.List className="flex px-5 gap-1 py-2 border-b border-white/[0.05] shrink-0 overflow-x-auto scrollbar-none">
                    {TABS_CONFIG.map((tab) => (
                      <Tabs.Trigger key={tab.id} value={tab.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all select-none text-white/40 hover:text-white/70 hover:bg-white/5 data-[state=active]:text-white data-[state=active]:bg-white/10">
                        {tab.icon}{tab.label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>

                  {/* Multi-turn tabs */}
                  <Tabs.Content value="interview" className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">
                    <InterviewPanel moduleId={moduleId} moduleTitle={moduleTitle} />
                  </Tabs.Content>
                  <Tabs.Content value="sherif-chat" className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">
                    <AskSherifPanel moduleId={moduleId} moduleTitle={moduleTitle} />
                  </Tabs.Content>

                  {/* Single-turn tabs */}
                  {(['task-checker', 'linkedin'] as const).map((tabId) => {
                    const tab = TABS_CONFIG.find((t) => t.id === tabId)!
                    return (
                      <Tabs.Content key={tabId} value={tabId} className="flex-1 flex flex-col gap-3 p-5 overflow-y-auto scrollbar-none">
                        {tabId === 'linkedin' && (
                          <LIScope scope={linkedInScope} onScopeChange={(s) => { setLinkedInScope(s); handleClear() }}
                            selectedSprint={selectedSprint} onSprintChange={(s) => { setSelectedSprint(s); handleClear() }}
                            selectedTrack={selectedTrack} onTrackChange={(t) => { setSelectedTrack(t); handleClear() }} />
                        )}
                        <div className="shrink-0">
                          <label className="block text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">
                            {tabId === 'task-checker' ? 'Your Submission' : 'Personal Context (optional)'}
                          </label>
                          <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={tab.placeholder}
                            rows={tabId === 'task-checker' ? 6 : 3}
                            className="w-full rounded-xl px-4 py-3 bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 focus:bg-white/[0.06] transition-all resize-none font-mono scrollbar-none" />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={handleRun} disabled={isLoading || isStreaming || !canRun}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-500/80 hover:bg-purple-500 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
                            {isLoading || isStreaming ? <Bot className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                            {isLoading ? 'Thinking...' : isStreaming ? 'Streaming...' : 'Evaluate with AI'}
                          </button>
                          {response && (
                            <>
                              <button onClick={async () => { await navigator.clipboard.writeText(response); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                                {copied ? 'Copied!' : 'Copy'}
                              </button>
                              <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
                                <RotateCcw className="w-3.5 h-3.5" /> Clear
                              </button>
                            </>
                          )}
                          {isMock && <span className="text-[10px] text-amber-400/60 flex items-center gap-1 ml-auto"><FlaskConical className="w-3 h-3" /> Mock mode</span>}
                        </div>

                        {(response || isLoading || error) && (
                          <div className="flex-1 min-h-0">
                            <div className={cn('rounded-xl p-4 min-h-[100px] bg-white/[0.03] border border-white/[0.06] overflow-y-auto', isStreaming && 'typing-cursor')}>
                              {error ? <p className="text-sm text-red-400">{error}</p>
                                : isLoading ? <div className="flex items-center gap-2 text-sm text-white/30"><Bot className="w-4 h-4 animate-pulse text-purple-400" /> Generating...</div>
                                  : <MD text={response} />}
                            </div>
                          </div>
                        )}

                        {!response && !isLoading && !error && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-30">
                            <Sparkles className="w-10 h-10 text-purple-400" />
                            <p className="text-sm text-white/50 max-w-xs">
                              {tabId === 'task-checker' && 'Paste your code, SQL schema, Dockerfile, or network config — then get rubric-based feedback from Sherif.'}
                              {tabId === 'linkedin' && 'Choose scope, add context, and generate a high-impact post for Module, Sprint, or Track mastery.'}
                            </p>
                          </div>
                        )}
                      </Tabs.Content>
                    )
                  })}
                </Tabs.Root>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
