'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert, ShieldCheck, Terminal, Unlock, User } from 'lucide-react'
import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'sprints_auth_unlocked'
export const LOCK_EVENT = 'sprints-lock-app'

export function triggerAppLock() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new Event(LOCK_EVENT))
  }
}

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [shake, setShake] = useState(false)
  const [accessGranted, setAccessGranted] = useState(false)

  // Initialize from sessionStorage on mount
  useEffect(() => {
    const unlocked = sessionStorage.getItem(STORAGE_KEY) === 'true'
    setIsUnlocked(unlocked)

    const handleLock = () => {
      setIsUnlocked(false)
      setAccessGranted(false)
      setPassword('')
      setErrorMsg('')
    }

    window.addEventListener(LOCK_EVENT, handleLock)
    return () => window.removeEventListener(LOCK_EVENT, handleLock)
  }, [])

  const handleUnlock = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    setErrorMsg('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      })

      const data = await res.json()

      if (res.ok && data.ok) {
        setAccessGranted(true)
        sessionStorage.setItem(STORAGE_KEY, 'true')
        setTimeout(() => {
          setIsUnlocked(true)
          setIsLoading(false)
        }, 600)
      } else {
        setErrorMsg(data.error || 'Access Denied: Invalid operator credentials.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setIsLoading(false)
      }
    } catch {
      setErrorMsg('Security gateway unreachable. Check connection.')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setIsLoading(false)
    }
  }, [username, password, isLoading])

  // Prevent flash while checking sessionStorage
  if (isUnlocked === null) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono text-zinc-500 tracking-widest uppercase">Initializing Security Layer...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {!isUnlocked && (
          <motion.div
            key="cyberpunk-auth-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(16px)' }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-2xl overflow-y-auto"
          >
            {/* Ambient cyberpunk glow & grid */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-amber-500/5 blur-[120px]" />
              <div className="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full bg-emerald-500/5 blur-[100px]" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
            </div>

            {/* Lock Screen Card */}
            <motion.div
              animate={shake ? { x: [-14, 14, -10, 10, -5, 5, 0] } : { x: 0 }}
              transition={{ duration: 0.45 }}
              className="relative w-full max-w-md my-auto rounded-3xl p-6 sm:p-8 bg-zinc-900/80 border border-white/10 shadow-[0_0_50px_-12px_rgba(6,182,212,0.15)] backdrop-blur-xl"
            >
              {/* Corner tech accents */}
              <div className="absolute top-3 left-3 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/60" />
              <div className="absolute top-3 right-3 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400/60" />
              <div className="absolute bottom-3 left-3 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/60" />
              <div className="absolute bottom-3 right-3 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/60" />

              {/* Security Header badge */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative mb-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-zinc-800/80 border border-white/15 flex items-center justify-center shadow-inner">
                    {accessGranted ? (
                      <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse" />
                    ) : (
                      <Lock className="w-8 h-8 text-cyan-400" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-zinc-900 border border-white/15">
                    {accessGranted ? (
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 font-semibold">
                    {accessGranted ? 'ACCESS GRANTED' : 'SECURITY GATEWAY // LOCKED'}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight">Sprints Learning OS</h2>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                  Restricted session node. Provide authenticated operator credentials to decrypt workspace.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleUnlock} className="space-y-4">
                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3 text-cyan-400" />
                    OPERATOR ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter Your Username"
                      disabled={isLoading || accessGranted}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-purple-400" />
                    SECURITY CIPHER
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isLoading || accessGranted}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-black/40 border border-white/10 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-400/60 focus:ring-1 focus:ring-purple-400/30 transition-all disabled:opacity-50 tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-mono text-[11px]">{errorMsg}</span>
                  </motion.div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isLoading || accessGranted}
                  className="w-full relative group mt-2 py-3 px-4 rounded-xl font-mono text-xs uppercase tracking-widest font-semibold text-white bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AUTHENTICATING NODE...</span>
                    </>
                  ) : accessGranted ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-200" />
                      <span>CIPHER ACCEPTED // UNLOCKING</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>AUTHENTICATE & ENTER</span>
                    </>
                  )}
                </button>
              </form>

              {/* Terminal footer note */}
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3 text-cyan-400/50" />
                  ACC × Sprints Node v2.5
                </span>
                <span>Session Lock Active</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main app workspace */}
      <div className={!isUnlocked ? 'pointer-events-none select-none blur-sm filter transition-all duration-300' : ''}>
        {children}
      </div>
    </>
  )
}
