'use client'

import { useState, useRef, useCallback } from 'react'
import type { AiMode } from '@/lib/types'

interface UseAiStreamOptions {
  mode: AiMode
  moduleTitle: string
  userInput?: string
  // LinkedIn scope fields
  scope?: 'module' | 'sprint' | 'track'
  sprintNumber?: number
  sprintName?: string
  trackName?: string
}

interface UseAiStreamReturn {
  response: string
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  isMock: boolean
  run: (options: UseAiStreamOptions) => Promise<void>
  clear: () => void
}

export function useAiStream(): UseAiStreamReturn {
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMock, setIsMock] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    setResponse('')
    setError(null)
    setIsLoading(false)
    setIsStreaming(false)
    setIsMock(false)
  }, [])

  const run = useCallback(async ({
    mode,
    moduleTitle,
    userInput = '',
    scope,
    sprintNumber,
    sprintName,
    trackName,
  }: UseAiStreamOptions) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setResponse('')
    setError(null)
    setIsLoading(true)
    setIsStreaming(false)
    setIsMock(false)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          moduleTitle,
          userInput,
          ...(scope && { scope }),
          ...(sprintNumber !== undefined && { sprintNumber }),
          ...(sprintName && { sprintName }),
          ...(trackName && { trackName }),
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`)
      }

      const mockHeader = res.headers.get('X-AI-Mode')
      if (mockHeader === 'mock') setIsMock(true)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body received')

      const decoder = new TextDecoder()
      setIsLoading(false)
      setIsStreaming(true)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setResponse((prev) => prev + decoder.decode(value, { stream: true }))
      }

      setIsStreaming(false)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message ?? 'Unknown error occurred')
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [])

  return { response, isLoading, isStreaming, error, isMock, run, clear }
}
