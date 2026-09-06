'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, RotateCcw, Minus, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/store/progressStore'
import { computeStats, getEffectiveStatus } from '@/lib/utils'
import { CURRICULUM } from '@/lib/curriculum'

interface ChatMessage {
  id: string
  role: 'user' | 'sherif'
  text: string
}

const ACTION_RE = /\[\[ACTION:SET_TIMER:(\d+):([^\]]+)\]\]/

function stripAction(text: string) {
  return text.replace(ACTION_RE, '').trim()
}

function MiniMD({ text }: { text: string }) {
  const clean = stripAction(text)
  const html = clean
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/90 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-white/70">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 text-cyan-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-1.5 text-[12px] text-white/60 leading-relaxed ml-1"><span>&bull;</span><span>$1</span></li>')
    .replace(/\n\n/g, '</p><p class="text-[13px] text-white/60 leading-relaxed mt-2">')
    .replace(/\n/g, '<br/>')
  return (
    <div className="text-[13px] text-white/60 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class="text-[13px] text-white/60 leading-relaxed">${html}</p>` }} />
  )
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isSherif = msg.role === 'sherif'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      className={cn('flex gap-2', !isSherif && 'flex-row-reverse')}>
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5',
        isSherif ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300')}>
        {isSherif ? '🤖' : '👤'}
      </div>
      <div className={cn('max-w-[85%] px-3 py-2.5 rounded-2xl',
        isSherif ? 'bg-white/[0.04] border border-white/[0.07] rounded-tl-sm' : 'bg-cyan-500/15 border border-cyan-400/20 text-cyan-100 rounded-tr-sm')}>
        {isSherif
          ? msg.text
            ? <MiniMD text={msg.text} />
            : <span className="text-[12px] text-white/30 italic flex items-center gap-1.5"><Bot className="w-3 h-3 animate-pulse text-purple-400" /> Sherif is thinking…</span>
          : <p className="text-[13px]">{msg.text}</p>
        }
      </div>
    </motion.div>
  )
}

export function GlobalSherifCopilot() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [apiHistory, setApiHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { moduleStatuses, focusedTaskTitle, focusedTaskDurationSecs } = useProgressStore()
  const stats = computeStats(moduleStatuses)

  const globalContext = (() => {
    const overall = `${stats.overallPercentage}% overall (${stats.completedModules + stats.passedModules}/${stats.totalModules} modules)`
    const nextMods = CURRICULUM
      .filter((m) => getEffectiveStatus(m.id, m.isPassed, moduleStatuses) === 'not-started')
      .slice(0, 3).map((m) => m.title).join(', ')
    const pomo = focusedTaskTitle
      ? `Active Pomodoro: "${focusedTaskTitle}" (${focusedTaskDurationSecs ? Math.round(focusedTaskDurationSecs / 60) : '?'}min)`
      : 'No active Pomodoro'
    return `[STUDENT CONTEXT: ${overall} | Next up: ${nextMods || 'All done!'} | ${pomo}]`
  })()

  const scrollDown = useCallback(() => { setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60) }, [])

  useEffect(() => { if (open && !minimized) setTimeout(() => textareaRef.current?.focus(), 150) }, [open, minimized])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isStreaming) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: text.trim() }
    const injected = `${text.trim()}\n\n${globalContext}`
    const nextHist = [...apiHistory, { role: 'user' as const, content: injected }]
    setMessages((p) => [...p, userMsg])
    setInput('')
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
        body: JSON.stringify({ mode: 'sherif-chat', moduleTitle: 'General Mentor Session', messages: nextHist }),
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
        setMessages((p) => p.map((m) => m.id === sherifId ? { ...m, text: full } : m))
      }
      setIsStreaming(false)
      const clean = stripAction(full)
      setMessages((p) => p.map((m) => m.id === sherifId ? { ...m, text: clean } : m))
      setApiHistory((h) => [...h, { role: 'model', content: clean }])
      scrollDown()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
      setMessages((p) => p.map((m) => m.id === sherifId ? { ...m, text: `⚠️ ${(e as Error).message}` } : m))
    }
  }, [isLoading, isStreaming, apiHistory, globalContext, scrollDown])

  const handleClear = () => {
    abortRef.current?.abort()
    setMessages([])
    setApiHistory([])
    setInput('')
    setIsLoading(false)
    setIsStreaming(false)
  }

  const QUICK_PROMPTS = [
    '🗺️ What should I study next?',
    '🏗️ Explain Clean Architecture simply',
    '🐛 Help me debug a BLoC issue',
    '⏱️ Build me a study schedule for today',
  ]

  return (
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 300 }}
        onClick={() => { setOpen(true); setMinimized(false) }}
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
          <span className="text-[9px] text-white/30">Principal Mentor</span>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div key="copilot"
            initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-36 right-6 z-50 glass-strong border border-white/[0.12] shadow-2xl rounded-2xl overflow-hidden flex flex-col w-[calc(100vw-48px)] sm:w-[420px] max-w-[95vw]"
            style={{ height: minimized ? 'auto' : 'min(600px, 85vh)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07] shrink-0 bg-purple-500/[0.04]">
              <div className="relative shrink-0">
                <span className="text-base">🤖</span>
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-purple-200 leading-none">Sherif</p>
                <p className="text-[10px] text-purple-300/50 mt-0.5">Principal Technical Mentor · Global Co-Pilot</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <button onClick={handleClear} title="Clear chat"
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setMinimized((v) => !v)} title={minimized ? 'Expand' : 'Minimize'}
                  className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-colors">
                  {minimized ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setOpen(false)} title="Close"
                  className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/5 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 min-h-0">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-60 py-8">
                      <Bot className="w-10 h-10 text-purple-400" />
                      <div>
                        <p className="text-sm text-white/50 font-medium">Ask Sherif anything</p>
                        <p className="text-[11px] text-white/25 mt-1 max-w-[240px]">Architecture, debugging, career advice, study roadmap — no limits.</p>
                      </div>
                      <div className="flex flex-col gap-1.5 w-full">
                        {QUICK_PROMPTS.map((q) => (
                          <button key={q} onClick={() => sendMessage(q)}
                            className="text-[11px] px-3 py-2 rounded-xl border border-white/[0.07] text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.03] transition-all text-left">
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs shrink-0">🤖</div>
                      <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                        <Bot className="w-3 h-3 text-purple-400 animate-pulse" />
                        <span className="text-[11px] text-white/30">Thinking…</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={endRef} />
                </div>

                <div className="shrink-0 border-t border-white/[0.07] p-3 bg-black/20">
                  <div className="flex items-end gap-2">
                    <textarea ref={textareaRef} value={input}
                      onChange={(e) => {
                        setInput(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                      placeholder="Ask Sherif… (Enter to send)" rows={1} disabled={isLoading || isStreaming}
                      className="flex-1 rounded-xl px-3 py-2.5 resize-none scrollbar-none bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-all disabled:opacity-40 leading-relaxed"
                      style={{ minHeight: '40px', maxHeight: '120px' }} />
                    <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading || isStreaming}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-500/80 hover:bg-purple-500 text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                      {isLoading || isStreaming ? <Bot className="w-3.5 h-3.5 animate-pulse" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-white/15 mt-1.5 text-center">
                    {stats.overallPercentage}% complete · {focusedTaskTitle ? `🍅 ${focusedTaskTitle}` : 'No active task'}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
