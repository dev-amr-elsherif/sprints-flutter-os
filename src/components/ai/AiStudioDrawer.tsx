'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import {
  X, Sparkles, Code2, MessageSquare, Linkedin, Send, RotateCcw,
  Bot, FlaskConical, Clipboard, Check, Wifi, WifiOff, RefreshCw,
  LayoutGrid, ListOrdered, Timer, Play, Zap, HelpCircle,
} from 'lucide-react'
import type { AiMode, TrackType } from '@/lib/types'
import { useAiStream, ChatMessage } from './useAiStream'
import { getModuleById } from '@/lib/curriculum'
import { TRACK_META, SPRINT_META, cn } from '@/lib/utils'
import { useProgressStore } from '@/store/progressStore'

// ─── Types ─────────────────────────────────────────────────────────────────────
type StudioMode = AiMode | 'interview-simulator'

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

// ─── Rubric Renderer (Task Review structured output) ──────────────────────────
type VerdictStatus = 'PRODUCTION_READY' | 'NEEDS_REFACTOR' | 'ARCHITECTURAL_GAP' | null

interface RubricSection {
  key: string
  heading: string
  body: string
}

function parseRubric(text: string): { verdict: { status: VerdictStatus; score: number | null; note: string } | null; sections: RubricSection[]; raw: string } {
  // Find verdict line: ### 🏆 VERDICT: STATUS (SCORE/100) rest
  const verdictRe = /###\s*🏆\s*VERDICT:\s*(PRODUCTION_READY|NEEDS_REFACTOR|ARCHITECTURAL_GAP)\s*\((\d+)\/100\)(.*)/
  const verdictMatch = text.match(verdictRe)
  const verdict = verdictMatch
    ? { status: verdictMatch[1] as VerdictStatus, score: parseInt(verdictMatch[2], 10), note: verdictMatch[3].trim() }
    : null

  const SECTION_KEYS = [
    { key: 'arch',    re: /###\s*🏗️\s*Architecture(?:\s*&\s*|\s+and\s+)Clean Code/i },
    { key: 'perf',    re: /###\s*⚡\s*Performance(?:\s*&\s*|\s+and\s+)State Efficiency/i },
    { key: 'edge',    re: /###\s*🛡️\s*Edge Cases(?:\s*&\s*|\s+and\s+)Error Handling/i },
    { key: 'refactor',re: /###\s*💡\s*Recommended Refactor/i },
  ]

  // Split by h3 section markers
  const sections: RubricSection[] = []
  const lines = text.split('\n')
  let current: { key: string; heading: string; lines: string[] } | null = null

  for (const line of lines) {
    // Check if this line starts a known section
    const match = SECTION_KEYS.find((s) => s.re.test(line))
    if (match) {
      if (current) sections.push({ key: current.key, heading: current.heading, body: current.lines.join('\n').trim() })
      current = { key: match.key, heading: line.replace(/^###\s*/, '').trim(), lines: [] }
    } else if (current && !verdictRe.test(line)) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ key: current.key, heading: current.heading, body: current.lines.join('\n').trim() })

  return { verdict, sections, raw: text }
}

function VerdictBadge({ verdict }: { verdict: NonNullable<ReturnType<typeof parseRubric>['verdict']> }) {
  const { status, score, note } = verdict
  const cfg =
    status === 'PRODUCTION_READY'
      ? { bg: 'bg-emerald-500/15 border-emerald-400/30', text: 'text-emerald-300', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]', label: '✅ PRODUCTION READY' }
      : status === 'NEEDS_REFACTOR'
        ? { bg: 'bg-amber-500/15 border-amber-400/30', text: 'text-amber-300', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]', label: '⚠️ NEEDS REFACTOR' }
        : { bg: 'bg-rose-500/15 border-rose-400/30', text: 'text-rose-300', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]', label: '🚨 ARCHITECTURAL GAP' }

  const scoreColor =
    (score ?? 0) >= 85 ? 'text-emerald-400' : (score ?? 0) >= 70 ? 'text-amber-400' : 'text-rose-400'

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className={cn('flex items-center gap-3 p-3 rounded-xl border', cfg.bg, cfg.glow)}>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className={cn('text-xs font-bold tracking-wide', cfg.text)}>{cfg.label}</span>
        {note && <span className="text-[11px] text-white/45 leading-snug">{note}</span>}
      </div>
      {score !== null && (
        <div className={cn('shrink-0 text-2xl font-black tabular-nums', scoreColor)}>
          {score}<span className="text-xs font-normal text-white/30">/100</span>
        </div>
      )}
    </motion.div>
  )
}

function RubricSectionCard({ section }: { section: RubricSection }) {
  const [copiedCode, setCopiedCode] = useState(false)

  const CARD_META: Record<string, { border: string; icon: string; iconCls: string }> = {
    arch:     { border: 'border-l-cyan-400/50',    icon: '🏗️', iconCls: 'text-cyan-300' },
    perf:     { border: 'border-l-purple-400/50',  icon: '⚡', iconCls: 'text-purple-300' },
    edge:     { border: 'border-l-amber-400/50',   icon: '🛡️', iconCls: 'text-amber-300' },
    refactor: { border: 'border-l-emerald-400/50', icon: '💡', iconCls: 'text-emerald-300' },
  }
  const m = CARD_META[section.key] ?? { border: 'border-l-white/20', icon: '📋', iconCls: 'text-white/40' }

  // For refactor card: extract code block for copy
  const codeMatch = section.body.match(/```[\w]*\n([\s\S]*?)```/)
  const codeSnippet = codeMatch?.[1]?.trim() ?? null

  const handleCopyCode = async () => {
    if (!codeSnippet) return
    await navigator.clipboard.writeText(codeSnippet)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  // Render body as simple HTML — minimal, since it's already structured markdown
  const bodyHtml = section.body
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="bg-black/30 border border-white/[0.07] rounded-lg p-3 text-[11px] font-mono text-cyan-200 overflow-x-auto my-2 leading-relaxed whitespace-pre-wrap">$1</pre>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-1.5 text-[12px] text-white/60 leading-relaxed"><span class="text-white/25 mt-0.5 shrink-0">•</span><span>$1</span></li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/80 font-semibold">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 text-cyan-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/\n\n/g, '</p><p class="text-[12px] text-white/55 my-1">')
    .replace(/\n/g, '<br/>')

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl bg-white/[0.03] border border-white/[0.07] border-l-2 overflow-hidden', m.border)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
        <span className={cn('text-xs font-semibold', m.iconCls)}>{section.heading}</span>
        {section.key === 'refactor' && codeSnippet && (
          <button onClick={handleCopyCode}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-emerald-300 transition-colors">
            {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
            {copiedCode ? 'Copied!' : 'Copy snippet'}
          </button>
        )}
      </div>
      <div className="px-3 py-2.5"
        dangerouslySetInnerHTML={{ __html: `<p class="text-[12px] text-white/55">${bodyHtml}</p>` }} />
    </motion.div>
  )
}

function RubricRenderer({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const { verdict, sections } = parseRubric(text)
  const hasStructure = verdict !== null || sections.length > 0

  if (!hasStructure) {
    // Streaming but no structured output yet — show raw MD with typing cursor
    return <MD text={text} />
  }

  return (
    <div className="space-y-3">
      {verdict && <VerdictBadge verdict={verdict} />}
      {sections.map((s) => <RubricSectionCard key={s.key} section={s} />)}
      {isStreaming && sections.length === 0 && <MD text={text} />}
    </div>
  )
}

// ─── LinkedIn Post Utilities ───────────────────────────────────────────────────
function LinkedInPostUtils({ text, onClear }: { text: string; onClear: () => void }) {
  const [copied, setCopied] = useState(false)

  const cleanText = text.replace(ACTION_RE, '').trim()
  const charCount = cleanText.length
  const wordCount = cleanText.trim().split(/\s+/).filter(Boolean).length

  // Hook preview: first 180 chars
  const hookPreview = cleanText.slice(0, 180)
  const hookLines = cleanText.split('\n').slice(0, 3).join('\n')

  const lengthStatus =
    charCount < 500
      ? { cls: 'text-amber-400', icon: '🟡', label: 'Too short for maximum reach' }
      : charCount <= 1800
        ? { cls: 'text-emerald-400', icon: '🟢', label: 'Optimal engagement length' }
        : charCount <= 2500
          ? { cls: 'text-amber-400', icon: '🟡', label: 'Getting long — trim for reach' }
          : { cls: 'text-rose-400', icon: '🔴', label: 'Approaching character limit' }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cleanText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-3 mt-2">
      {/* Hook Preview */}
      <div className="p-3 rounded-xl bg-blue-500/[0.06] border border-blue-400/20">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-sm">👁️</span>
          <span className="text-[11px] font-semibold text-blue-300">Above-The-Fold Hook Preview</span>
          <span className="text-[9px] text-white/25 ml-auto">~first 180 chars</span>
        </div>
        <p className="text-[11px] text-white/60 leading-relaxed font-medium border-l-2 border-blue-400/30 pl-2.5 italic">
          {hookLines || hookPreview}
          {cleanText.length > 180 && <span className="text-white/25 not-italic"> …see more</span>}
        </p>
        <p className="text-[9px] text-white/25 mt-1.5">Verify your hook captures attention before the fold</p>
      </div>

      {/* Metrics bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <span className="text-[11px] text-white/40 font-mono">{charCount.toLocaleString()} chars</span>
        <span className="text-white/15">•</span>
        <span className="text-[11px] text-white/40 font-mono">{wordCount} words</span>
        <span className="text-white/15 mx-1">|</span>
        <span className={cn('text-[11px] font-medium flex items-center gap-1', lengthStatus.cls)}>
          {lengthStatus.icon} {lengthStatus.label}
        </span>
      </div>

      {/* One-click actions */}
      <div className="flex items-center gap-2">
        <button onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95',
            copied
              ? 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30'
              : 'text-white/60 bg-white/[0.04] border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
          )}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
          {copied ? '✓ Copied to Clipboard!' : '📋 Copy Full Post'}
        </button>
        <a href="https://www.linkedin.com/feed/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-blue-400/25 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-all active:scale-95">
          <Linkedin className="w-3.5 h-3.5" />
          🚀 Open LinkedIn
        </a>
        <button onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-all ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
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
        <div className="shrink-0 rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4 space-y-3">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-purple-400/60 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white/70">3-Round STAR Mock Interview</p>
              <p className="text-[11px] text-white/35 mt-0.5 leading-relaxed">
                Sherif will ask you <strong className="text-white/55">3 production-level questions</strong> tailored to{' '}
                <em className="text-purple-300">{moduleTitle || 'this module'}</em>.
                Use the STAR method (Situation, Task, Action, Result) in your answers.
              </p>
            </div>
          </div>
          <button onClick={startInterview}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg transition-all active:scale-95">
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
        <div className="shrink-0 space-y-2.5">
          <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
            <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/45 leading-relaxed">Ask Sherif anything — architecture, debugging, syllabus guidance, or roadmap advice.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
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

                  {/* Single-turn tabs — strict flex-col, no overflow-y on container; result scrolls inside */}
                  {(['task-checker', 'linkedin'] as const).map((tabId) => {
                    const tab = TABS_CONFIG.find((t) => t.id === tabId)!
                    return (
                      <Tabs.Content key={tabId} value={tabId} className="flex-1 flex flex-col min-h-0 overflow-hidden">

                        {/* ── ZONE 1: PINNED INPUTS — always visible, never scrolls ── */}
                        <div className="shrink-0 p-5 pb-3 space-y-3.5 border-b border-white/[0.05] bg-zinc-950/40">
                          {tabId === 'linkedin' && (
                            <LIScope scope={linkedInScope} onScopeChange={(s) => { setLinkedInScope(s); handleClear() }}
                              selectedSprint={selectedSprint} onSprintChange={(s) => { setSelectedSprint(s); handleClear() }}
                              selectedTrack={selectedTrack} onTrackChange={(t) => { setSelectedTrack(t); handleClear() }} />
                          )}

                          <div>
                            <label className="block text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">
                              {tabId === 'task-checker' ? 'Your Submission' : 'Personal Context (optional)'}
                            </label>
                            <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={tab.placeholder}
                              rows={tabId === 'task-checker' ? 5 : 3}
                              className="w-full rounded-xl px-4 py-3 bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 focus:bg-white/[0.06] transition-all resize-none font-mono scrollbar-none" />
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={handleRun} disabled={isLoading || isStreaming || !canRun}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-500/80 hover:bg-purple-500 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg">
                              {isLoading || isStreaming ? <Bot className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                              {isLoading ? 'Thinking...' : isStreaming ? 'Streaming...' : tabId === 'task-checker' ? 'Review with Sherif' : 'Generate Post'}
                            </button>
                            {response && tabId === 'task-checker' && (
                              <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
                                <RotateCcw className="w-3.5 h-3.5" /> Clear
                              </button>
                            )}
                            {isMock && <span className="text-[10px] text-amber-400/60 flex items-center gap-1 ml-auto"><FlaskConical className="w-3 h-3" /> Mock mode</span>}
                          </div>
                        </div>

                        {/* ── ZONE 2: SCROLLABLE OUTPUT — only this area scrolls ── */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                          {(response || isLoading || error) ? (
                            <div className="p-5 space-y-4">
                              {error ? (
                                <div className="rounded-xl p-4 bg-red-500/[0.05] border border-red-400/20">
                                  <p className="text-sm text-red-400">{error}</p>
                                </div>
                              ) : isLoading ? (
                                <div className="flex items-center gap-2 text-sm text-white/30 py-2">
                                  <Bot className="w-4 h-4 animate-pulse text-purple-400" /> Sherif is preparing your review…
                                </div>
                              ) : tabId === 'task-checker' ? (
                                <div className={cn('rounded-xl p-4 bg-white/[0.02] border border-white/[0.05]', isStreaming && 'typing-cursor')}>
                                  <RubricRenderer text={response} isStreaming={isStreaming} />
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className={cn('rounded-xl p-4 bg-white/[0.02] border border-white/[0.05]', isStreaming && 'typing-cursor')}>
                                    <MD text={response} />
                                  </div>
                                  {!isStreaming && <LinkedInPostUtils text={response} onClear={handleClear} />}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center p-6 text-center">
                              <div className="flex flex-col items-center gap-2 opacity-20">
                                <Sparkles className="w-6 h-6 text-purple-400" />
                                <p className="text-xs text-white/50 leading-relaxed max-w-[200px]">
                                  {tabId === 'task-checker'
                                    ? 'Paste code above and click Review with Sherif'
                                    : 'Configure scope above and click Generate Post'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
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
