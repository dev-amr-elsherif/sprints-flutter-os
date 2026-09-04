'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import { X, FlaskConical, Clipboard, Check, Zap, Sparkles, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CapsuleQuickDumpProps {
  open: boolean
  onClose: () => void
}

function MarkdownContent({ text }: { text: string }) {
  const html = text
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold text-white/90 mt-4 mb-2 flex items-center gap-1.5">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xs font-semibold text-white/80 mt-3 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 text-cyan-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
    .replace(/^---$/gm, '<hr class="border-white/[0.08] my-3"/>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-2 text-xs text-white/70 leading-relaxed my-0.5"><span class="text-cyan-400/60 shrink-0 mt-0.5">•</span><span>$1</span></li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="flex gap-2 text-xs text-white/70 leading-relaxed my-0.5"><span class="text-purple-400/80 font-mono shrink-0">›</span><span>$1</span></li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
  return (
    <div
      className="text-xs text-white/70 leading-relaxed space-y-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function CapsuleQuickDump({ open, onClose }: CapsuleQuickDumpProps) {
  const [capsuleText, setCapsuleText] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isMock, setIsMock] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedNotebook, setCopiedNotebook] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleDigest = useCallback(async () => {
    if (!capsuleText.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setResponse('')
    setIsLoading(true)
    setIsStreaming(false)
    setIsMock(false)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'capsule-digest',
          moduleTitle: 'Text Capsule',
          userInput: capsuleText,
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
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setResponse(full)
      }
      setIsStreaming(false)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [capsuleText])

  const extractNotebookLMSection = (text: string) => {
    const match = text.match(/## 📋 NotebookLM Format([\s\S]*)/)
    return match ? match[1].trim() : text
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(response)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyNotebook = async () => {
    await navigator.clipboard.writeText(extractNotebookLMSection(response))
    setCopiedNotebook(true)
    setTimeout(() => setCopiedNotebook(false), 2000)
  }

  const handleClose = () => {
    abortRef.current?.abort()
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* True Centered Modal Container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="pointer-events-auto max-w-2xl w-full max-h-[85vh] flex flex-col rounded-2xl border border-white/15 bg-zinc-950/95 shadow-2xl p-6 overflow-hidden backdrop-blur-2xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div>
                        <Dialog.Title className="text-base font-bold text-white">
                          Capsule Quick-Dump
                        </Dialog.Title>
                        <p className="text-xs text-white/40 mt-0.5">
                          Paste raw lesson notes → AI synthesizes Takeaways, Flashcards & Code
                        </p>
                      </div>
                    </div>

                    <Dialog.Close asChild>
                      <button
                        aria-label="Close"
                        className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </Dialog.Close>
                  </div>

                  {/* Scrollable Body */}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 my-4 min-h-0">
                    {/* Input Area */}
                    <div>
                      <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                        Raw Capsule Text / Bullet Points
                      </label>
                      <textarea
                        value={capsuleText}
                        onChange={(e) => setCapsuleText(e.target.value)}
                        placeholder="Paste any raw notes, bullet points, or text from a lesson capsule here...

Example:
- BLoC separates UI from business logic
- Events go in, States come out
- sealed class for exhaustive state matching
- HydratedCubit persists state across restarts"
                        rows={5}
                        className={cn(
                          'w-full rounded-xl px-4 py-3',
                          'bg-white/[0.04] border border-white/[0.08]',
                          'text-sm text-white/90 placeholder:text-white/20',
                          'focus:outline-none focus:border-cyan-400/40 focus:bg-white/[0.06]',
                          'resize-none font-mono transition-all duration-200'
                        )}
                      />
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={handleDigest}
                        disabled={isLoading || isStreaming || !capsuleText.trim()}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold',
                          'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-all duration-200 active:scale-95',
                          'disabled:opacity-40 disabled:cursor-not-allowed shadow-lg'
                        )}
                      >
                        {isLoading || isStreaming ? (
                          <Bot className="w-4 h-4 animate-pulse" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        {isLoading ? 'Thinking...' : isStreaming ? 'Synthesizing...' : 'Synthesize with AI'}
                      </button>

                      {response && (
                        <>
                          <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/60 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                            {copied ? 'Copied!' : 'Copy All'}
                          </button>
                          <button
                            onClick={handleCopyNotebook}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                          >
                            {copiedNotebook ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {copiedNotebook ? 'Copied for NotebookLM!' : 'Copy for NotebookLM'}
                          </button>
                        </>
                      )}

                      {isMock && (
                        <span className="ml-auto text-xs text-amber-400/70 flex items-center gap-1">
                          <FlaskConical className="w-3.5 h-3.5" /> Mock Mode
                        </span>
                      )}
                    </div>

                    {/* AI Response Area */}
                    {(response || isLoading) && (
                      <div className={cn(
                        'rounded-xl p-4 bg-white/[0.03] border border-white/[0.08]',
                        isStreaming && 'typing-cursor'
                      )}>
                        {isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-white/40 py-2">
                            <Bot className="w-4 h-4 animate-pulse text-cyan-400" />
                            Synthesizing your notes...
                          </div>
                        ) : (
                          <MarkdownContent text={response} />
                        )}
                      </div>
                    )}

                    {/* Empty state */}
                    {!response && !isLoading && (
                      <div className="flex flex-col items-center justify-center py-6 text-center opacity-30">
                        <FlaskConical className="w-8 h-8 text-cyan-400 mb-1.5" />
                        <p className="text-xs text-white/60">Paste your lesson notes above and click Synthesize</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
