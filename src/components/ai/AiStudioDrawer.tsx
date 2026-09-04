'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import {
  X,
  Sparkles,
  Code2,
  MessageSquare,
  Linkedin,
  Send,
  RotateCcw,
  Bot,
  FlaskConical,
  Clipboard,
  Check,
  Wifi,
  WifiOff,
  RefreshCw,
  LayoutGrid,
  ListOrdered,
  ChevronDown,
} from 'lucide-react'
import type { AiMode, TrackType } from '@/lib/types'
import { useAiStream } from './useAiStream'
import { getModuleById } from '@/lib/curriculum'
import { TRACK_META, SPRINT_META, cn } from '@/lib/utils'

interface AiStudioDrawerProps {
  open: boolean
  onClose: () => void
  initialMode: AiMode
  moduleId: string | null
}

// ─── AI health status ─────────────────────────────────────────────────────────
type HealthStatus = 'idle' | 'checking' | 'connected' | 'error'

// ─── LinkedIn scope ───────────────────────────────────────────────────────────
type LinkedInScope = 'module' | 'sprint' | 'track'

const SPRINT_OPTIONS = [1, 2, 3, 4, 5] as const
const TRACK_OPTIONS: TrackType[] = ['Mobile', 'Systems', 'Quality', 'Career']

const TABS_CONFIG: { id: AiMode; label: string; icon: React.ReactNode; placeholder: string }[] = [
  {
    id: 'task-checker',
    label: 'Task Review',
    icon: <Code2 className="w-3.5 h-3.5" />,
    placeholder:
      'Paste your code, schema, SQL query, Dockerfile, or written work here for AI rubric-based review...',
  },
  {
    id: 'interview',
    label: 'Mock Interview',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    placeholder:
      'Optional: Add context about your experience — or paste a text capsule for automatic flashcard generation...',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn Post',
    icon: <Linkedin className="w-3.5 h-3.5" />,
    placeholder: 'Optional: What did you build? What surprised you? Any challenges you overcame?',
  },
]

// ─── Minimal markdown renderer ─────────────────────────────────────────────
function MarkdownContent({ text }: { text: string }) {
  const html = text
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
    <div
      className="prose-custom text-sm text-white/60 leading-relaxed space-y-1"
      dangerouslySetInnerHTML={{ __html: `<p class="text-sm text-white/55 leading-relaxed">${html}</p>` }}
    />
  )
}

function formatModelDisplay(modelName?: string) {
  if (!modelName) return 'Gemini 2.5 Flash'
  if (modelName === 'gemini-2.5-flash') return 'Gemini 2.5 Flash'
  if (modelName === 'gemini-2.0-flash') return 'Gemini 2.0 Flash'
  if (modelName === 'gemini-flash-latest') return 'Gemini Flash (Latest)'
  if (modelName === 'gemini-3.6-flash') return 'Gemini 3.6 Flash'
  return modelName
}

// ─── AI Status Pill ───────────────────────────────────────────────────────────
function AiStatusPill({
  status,
  message,
  latency,
  modelName,
  onTest,
}: {
  status: HealthStatus
  message: string
  latency?: number
  modelName?: string
  onTest: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.05] bg-white/[0.015]">
      {/* Status indicator */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {status === 'checking' && (
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
        )}
        {status === 'connected' && (
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        {status === 'error' && (
          <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
        )}
        {status === 'idle' && (
          <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
        )}

        <span
          className={cn(
            'text-[11px] font-medium truncate',
            status === 'connected' && 'text-emerald-300',
            status === 'error' && 'text-red-300',
            status === 'checking' && 'text-amber-300',
            status === 'idle' && 'text-white/30'
          )}
        >
          {status === 'idle' && 'AI not checked'}
          {status === 'checking' && 'Checking connection...'}
          {status === 'connected' && `🟢 ${formatModelDisplay(modelName)}${latency ? ` — ${latency}ms` : ''}`}
          {status === 'error' && `🔴 ${message || 'AI Error / Disconnected'}`}
        </span>
      </div>

      {/* Test button */}
      <button
        onClick={onTest}
        disabled={status === 'checking'}
        className={cn(
          'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium',
          'border transition-all duration-200',
          status === 'checking'
            ? 'text-white/20 border-white/5 cursor-not-allowed'
            : 'text-white/40 border-white/10 hover:text-white/70 hover:border-white/20 hover:bg-white/5'
        )}
      >
        <RefreshCw className={cn('w-3 h-3', status === 'checking' && 'animate-spin')} />
        Test
      </button>
    </div>
  )
}

// ─── LinkedIn Scope Selector ──────────────────────────────────────────────────
function LinkedInScopeSelector({
  scope,
  onScopeChange,
  selectedSprint,
  onSprintChange,
  selectedTrack,
  onTrackChange,
}: {
  scope: LinkedInScope
  onScopeChange: (s: LinkedInScope) => void
  selectedSprint: number | null
  onSprintChange: (n: number) => void
  selectedTrack: TrackType | null
  onTrackChange: (t: TrackType) => void
}) {
  return (
    <div className="shrink-0 space-y-3 p-3 bg-white/[0.025] rounded-xl border border-white/[0.06]">
      {/* Scope type selector */}
      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Post Scope</p>
        <div className="flex gap-1.5">
          {([
            { id: 'module' as LinkedInScope, label: 'Module', icon: <Sparkles className="w-3 h-3" /> },
            { id: 'sprint' as LinkedInScope, label: 'Sprint Milestone', icon: <ListOrdered className="w-3 h-3" /> },
            { id: 'track' as LinkedInScope, label: 'Track Mastery', icon: <LayoutGrid className="w-3 h-3" /> },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => onScopeChange(opt.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-1 justify-center',
                'border transition-all duration-200',
                scope === opt.id
                  ? 'text-white bg-purple-500/20 border-purple-400/40'
                  : 'text-white/35 border-white/[0.06] hover:border-white/15 hover:text-white/60'
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint selector */}
      <AnimatePresence>
        {scope === 'sprint' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Select Sprint</p>
            <div className="flex flex-wrap gap-1.5">
              {SPRINT_OPTIONS.map((s) => {
                const meta = SPRINT_META[s]
                return (
                  <button
                    key={s}
                    onClick={() => onSprintChange(s)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                      'border transition-all duration-200',
                      selectedSprint === s
                        ? 'text-white border'
                        : 'text-white/40 border-white/[0.06] hover:border-white/15 hover:text-white/60'
                    )}
                    style={
                      selectedSprint === s
                        ? { color: meta.color, borderColor: `${meta.color}50`, backgroundColor: `${meta.color}15` }
                        : undefined
                    }
                  >
                    <span>{meta.emoji}</span>
                    <span>Sprint {s}</span>
                  </button>
                )
              })}
            </div>
            {selectedSprint && (
              <p className="text-[10px] text-white/30 mt-1.5">
                {SPRINT_META[selectedSprint].name} · {SPRINT_META[selectedSprint].duration}
              </p>
            )}
          </motion.div>
        )}

        {scope === 'track' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Select Track</p>
            <div className="flex flex-wrap gap-1.5">
              {TRACK_OPTIONS.map((t) => {
                const meta = TRACK_META[t]
                return (
                  <button
                    key={t}
                    onClick={() => onTrackChange(t)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                      'border transition-all duration-200',
                      selectedTrack === t
                        ? 'text-white border'
                        : 'text-white/40 border-white/[0.06] hover:border-white/15 hover:text-white/60'
                    )}
                    style={
                      selectedTrack === t
                        ? { color: meta.color, borderColor: `${meta.color}50`, backgroundColor: `${meta.color}15` }
                        : undefined
                    }
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.shortLabel}</span>
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

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export function AiStudioDrawer({ open, onClose, initialMode, moduleId }: AiStudioDrawerProps) {
  const [activeTab, setActiveTab] = useState<AiMode>(initialMode)
  const [userInput, setUserInput] = useState('')
  const [copied, setCopied] = useState(false)

  // Health check state
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('idle')
  const [healthMessage, setHealthMessage] = useState('')
  const [healthLatency, setHealthLatency] = useState<number | undefined>()
  const [healthModel, setHealthModel] = useState<string>('')

  // LinkedIn scope state
  const [linkedInScope, setLinkedInScope] = useState<LinkedInScope>('module')
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<TrackType | null>(null)

  const { response, isLoading, isStreaming, error, isMock, run, clear } = useAiStream()

  const module = moduleId ? getModuleById(moduleId) : null
  const meta = module ? TRACK_META[module.track] : null

  // Sync tab when drawer reopens with different mode
  useEffect(() => {
    setActiveTab(initialMode)
  }, [initialMode, moduleId])

  // Auto-check health when drawer opens
  useEffect(() => {
    if (open && healthStatus === 'idle') {
      checkHealth()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const checkHealth = useCallback(async () => {
    setHealthStatus('checking')
    setHealthMessage('')
    setHealthLatency(undefined)
    setHealthModel('')
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'health-check', moduleTitle: '' }),
      })
      const data = (await res.json()) as { status: string; message?: string; latency?: number; model?: string }
      if (data.status === 'ok') {
        setHealthStatus('connected')
        setHealthLatency(data.latency)
        setHealthModel(data.model ?? '')
        setHealthMessage('')
      } else {
        setHealthStatus('error')
        setHealthMessage(data.message ?? 'Unknown error')
      }
    } catch (err) {
      setHealthStatus('error')
      setHealthMessage((err as Error).message ?? 'Network error')
    }
  }, [])

  const handleRun = () => {
    const titleForAi =
      linkedInScope === 'sprint' && selectedSprint
        ? `Sprint ${selectedSprint}: ${SPRINT_META[selectedSprint].name}`
        : linkedInScope === 'track' && selectedTrack
        ? `${selectedTrack} Track — ${TRACK_META[selectedTrack].label}`
        : module?.title ?? 'General Module'

    run({
      mode: activeTab,
      moduleTitle: titleForAi,
      userInput,
      ...(activeTab === 'linkedin' && {
        scope: linkedInScope,
        ...(linkedInScope === 'sprint' && selectedSprint
          ? { sprintNumber: selectedSprint, sprintName: SPRINT_META[selectedSprint].name }
          : {}),
        ...(linkedInScope === 'track' && selectedTrack
          ? { trackName: selectedTrack }
          : {}),
      }),
    })
  }

  const handleCopy = async () => {
    if (!response) return
    await navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    clear()
    setUserInput('')
  }

  const canRun =
    activeTab === 'linkedin'
      ? linkedInScope === 'module'
        ? !!module
        : linkedInScope === 'sprint'
        ? !!selectedSprint
        : !!selectedTrack
      : !!module

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* Drawer panel */}
            <Dialog.Content asChild>
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className={cn(
                  'fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl',
                  'glass-strong flex flex-col',
                  'border-l border-white/[0.08]'
                )}
              >
                {/* Track accent bar */}
                {meta && (
                  <div
                    className="h-[2px] w-full shrink-0"
                    style={{ background: `linear-gradient(to right, ${meta.color}, transparent)` }}
                  />
                )}

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <Dialog.Title className="text-base font-bold text-white">
                      AI Study Studio
                    </Dialog.Title>
                  </div>

                  {module && (
                    <div
                      className="flex-1 min-w-0 ml-2 px-2.5 py-1 rounded-lg text-xs font-medium truncate"
                      style={{ color: meta?.color, backgroundColor: `${meta?.color}18` }}
                    >
                      {module.title}
                    </div>
                  )}

                  <Dialog.Close asChild>
                    <button className="shrink-0 text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5">
                      <X className="w-4 h-4" />
                    </button>
                  </Dialog.Close>
                </div>

                {/* AI Status Pill */}
                <AiStatusPill
                  status={healthStatus}
                  message={healthMessage}
                  latency={healthLatency}
                  modelName={healthModel}
                  onTest={checkHealth}
                />

                {/* Tabs */}
                <Tabs.Root
                  value={activeTab}
                  onValueChange={(v) => { setActiveTab(v as AiMode); handleClear() }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <Tabs.List className="flex px-5 gap-1 py-2 border-b border-white/[0.05] shrink-0">
                    {TABS_CONFIG.map((tab) => (
                      <Tabs.Trigger
                        key={tab.id}
                        value={tab.id}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                          'transition-all duration-200 select-none',
                          'text-white/40 hover:text-white/70 hover:bg-white/5',
                          'data-[state=active]:text-white data-[state=active]:bg-white/10'
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>

                  {TABS_CONFIG.map((tab) => (
                    <Tabs.Content
                      key={tab.id}
                      value={tab.id}
                      className="flex-1 flex flex-col gap-3 p-5 overflow-y-auto scrollbar-none"
                    >
                      {/* LinkedIn scope selector — only on linkedin tab */}
                      {tab.id === 'linkedin' && (
                        <LinkedInScopeSelector
                          scope={linkedInScope}
                          onScopeChange={(s) => { setLinkedInScope(s); handleClear() }}
                          selectedSprint={selectedSprint}
                          onSprintChange={(s) => { setSelectedSprint(s); handleClear() }}
                          selectedTrack={selectedTrack}
                          onTrackChange={(t) => { setSelectedTrack(t); handleClear() }}
                        />
                      )}

                      {/* Input area */}
                      <div className="shrink-0">
                        <label className="block text-xs font-medium text-white/40 mb-2 uppercase tracking-wider">
                          {tab.id === 'task-checker'
                            ? 'Your Submission'
                            : tab.id === 'interview'
                            ? 'Context or Text Capsule'
                            : 'Personal Context (optional)'}
                        </label>
                        <textarea
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          placeholder={tab.placeholder}
                          rows={tab.id === 'task-checker' ? 6 : 3}
                          className={cn(
                            'w-full rounded-xl px-4 py-3',
                            'bg-white/[0.04] border border-white/[0.08]',
                            'text-sm text-white/80 placeholder:text-white/20',
                            'focus:outline-none focus:border-purple-400/40 focus:bg-white/[0.06]',
                            'transition-all duration-200 resize-none font-mono',
                            'scrollbar-none'
                          )}
                        />
                        {tab.id === 'interview' && (
                          <p className="text-[10px] text-white/25 mt-1.5">
                            💊 Paste raw lesson capsule text → AI auto-generates Core Takeaways, Flashcards & Code
                          </p>
                        )}
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleRun}
                          disabled={isLoading || isStreaming || !canRun}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold',
                            'bg-purple-500/80 hover:bg-purple-500 text-white',
                            'transition-all duration-200 active:scale-95',
                            'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
                            'shadow-lg'
                          )}
                        >
                          {isLoading || isStreaming ? (
                            <Bot className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          {isLoading ? 'Thinking...' : isStreaming ? 'Streaming...' : 'Evaluate with AI'}
                        </button>

                        {response && (
                          <>
                            <button
                              onClick={handleCopy}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
                            >
                              {copied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Clipboard className="w-3.5 h-3.5" />
                              )}
                              {copied ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                              onClick={handleClear}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Clear
                            </button>
                          </>
                        )}

                        {isMock && (
                          <span className="text-[10px] text-amber-400/60 flex items-center gap-1 ml-auto">
                            <FlaskConical className="w-3 h-3" />
                            Mock mode
                          </span>
                        )}
                      </div>

                      {/* Response area */}
                      {(response || isLoading || error) && (
                        <div className="flex-1 min-h-0">
                          <div
                            className={cn(
                              'rounded-xl p-4 min-h-[100px]',
                              'bg-white/[0.03] border border-white/[0.06]',
                              'overflow-y-auto',
                              isStreaming && 'typing-cursor'
                            )}
                          >
                            {error ? (
                              <p className="text-sm text-red-400">{error}</p>
                            ) : isLoading ? (
                              <div className="flex items-center gap-2 text-sm text-white/30">
                                <Bot className="w-4 h-4 animate-pulse text-purple-400" />
                                Generating response...
                              </div>
                            ) : (
                              <MarkdownContent text={response} />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {!response && !isLoading && !error && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-30">
                          <Sparkles className="w-10 h-10 text-purple-400" />
                          <p className="text-sm text-white/50 max-w-xs">
                            {tab.id === 'task-checker' &&
                              'Paste your code, SQL schema, Dockerfile, or network config — then get rubric-based feedback.'}
                            {tab.id === 'interview' &&
                              'Get a real interview question — or paste capsule notes for auto flashcard generation.'}
                            {tab.id === 'linkedin' &&
                              'Choose scope, add context, and generate a high-impact post for Module, Sprint, or Track mastery.'}
                          </p>
                        </div>
                      )}
                    </Tabs.Content>
                  ))}
                </Tabs.Root>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
