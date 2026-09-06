'use client'

import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  BookOpen,
  Award,
  Github,
  Link2,
  ExternalLink,
  Save,
  Archive,
  Trash2,
  Lock,
  Play,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import type { CurriculumModule, ItemStatus, AiMode, ArtifactUrls } from '@/lib/types'
import {
  cn,
  TRACK_META,
  BADGE_CONFIG,
  STATUS_LABEL,
  getEffectiveStatus,
  computeLessonProgress,
} from '@/lib/utils'
import { CURRICULUM } from '@/lib/curriculum'
import { LessonAccordion } from './LessonAccordion'
import { useProgressStore } from '@/store/progressStore'

interface ModuleCardProps {
  module: CurriculumModule
  moduleStatuses: Record<string, ItemStatus>
  lessonStatuses: Record<string, boolean>
  artifacts: Record<string, ArtifactUrls>
  onCycleStatus: (id: string, currentEffective: ItemStatus) => void
  onToggleLesson: (lessonId: string, defaultChecked?: boolean) => void
  onOpenAi: (mode: AiMode, moduleId: string) => void
  onSaveArtifact: (moduleId: string, urls: ArtifactUrls) => void
}

function fireConfetti(color: string) {
  confetti({
    particleCount: 80,
    spread: 65,
    origin: { y: 0.65 },
    colors: [color, '#ffffff', '#a855f7', '#06b6d4'],
    ticks: 200,
    gravity: 1.2,
  })
}

const STATUS_ICONS: Record<ItemStatus, React.ReactNode> = {
  'not-started': <Circle className="w-5 h-5" />,
  'in-progress': <Loader2 className="w-5 h-5 animate-spin" />,
  'completed': <CheckCircle2 className="w-5 h-5" />,
  'passed': <Award className="w-5 h-5" />,
}

const STATUS_RING: Record<ItemStatus, string> = {
  'not-started': 'text-white/20 hover:text-white/50',
  'in-progress': 'text-amber-400',
  'completed': 'text-cyan-400',
  'passed': 'text-emerald-400',
}

export function ModuleCard({
  module,
  moduleStatuses,
  lessonStatuses,
  artifacts,
  onCycleStatus,
  onToggleLesson,
  onOpenAi,
  onSaveArtifact,
}: ModuleCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [lessonsOpen, setLessonsOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)

  // Artifact vault local state (synced to saved)
  const savedArtifact = artifacts[module.id]
  const [repoUrl, setRepoUrl] = useState(savedArtifact?.repoUrl ?? '')
  const [prUrl, setPrUrl] = useState(savedArtifact?.prUrl ?? '')
  const [demoUrl, setDemoUrl] = useState(savedArtifact?.demoUrl ?? '')
  const [saved, setSaved] = useState(false)

  const meta = TRACK_META[module.track]
  const effectiveStatus = getEffectiveStatus(module.id, module.isPassed, moduleStatuses)
  const lessonProgress = computeLessonProgress(module.lessons, lessonStatuses)
  const hasTaskOrCapstone = module.isTask || module.isCapstone

  // ── Prerequisite lock state ────────────────────────────────────────────────
  // Build a quick lookup: moduleId → title for prereq display
  const moduleIdToTitle = Object.fromEntries(CURRICULUM.map((m) => [m.id, m.title]))

  const missingPrereqTitles: string[] = (module.prerequisites ?? [])
    .filter((prereqId) => {
      const prereqStatus = getEffectiveStatus(prereqId, undefined, moduleStatuses)
      return prereqStatus !== 'completed' && prereqStatus !== 'passed'
    })
    .map((prereqId) => moduleIdToTitle[prereqId] ?? prereqId)

  const isLocked = missingPrereqTitles.length > 0

  const handleSaveArtifact = () => {
    onSaveArtifact(module.id, { repoUrl: repoUrl.trim(), prUrl: prUrl.trim(), demoUrl: demoUrl.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── 3D Tilt ──────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (lessonsOpen) return
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    card.style.transform = `perspective(900px) rotateX(${(y - 0.5) * -14}deg) rotateY(${(x - 0.5) * 14}deg) scale3d(1.015,1.015,1.015)`
  }, [lessonsOpen])

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
  }, [])

  // ── Status toggle ──────────────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (isLocked) return
    if (effectiveStatus === 'in-progress') {
      fireConfetti(meta.color)
    }
    onCycleStatus(module.id, effectiveStatus)
  }, [isLocked, effectiveStatus, module.id, onCycleStatus, meta.color])

  const isCompleted = effectiveStatus === 'completed'
  const isPassed = effectiveStatus === 'passed'
  const isDone = isCompleted || isPassed
  const isCapstone = module.isCapstone

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group relative"
    >
      {/* Glow when done */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-2xl pointer-events-none z-0"
            style={{
              background: isPassed
                ? 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.12) 0%, transparent 70%)'
                : `radial-gradient(ellipse at 50% 0%, ${meta.color}12 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Card surface */}
      <div
        ref={cardRef}
        onMouseMove={isLocked ? undefined : handleMouseMove}
        onMouseLeave={isLocked ? undefined : handleMouseLeave}
        style={{ transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, opacity 0.3s ease-out' }}
        className={cn(
          'relative z-10 rounded-2xl flex flex-col overflow-hidden transition-all duration-300',
          // Locked state
          isLocked
            ? 'opacity-65 hover:opacity-90 border border-zinc-800/80 bg-zinc-950/40 backdrop-blur-md hover:border-amber-500/20'
            : 'glass shadow-card group-hover:shadow-card-hover',
          !isLocked && isDone && 'border-opacity-40',
          !isLocked && isDone && !isPassed && meta.borderClass,
          !isLocked && isPassed && 'border-emerald-400/30 border',
          isCapstone && !isLocked && 'ring-1 ring-inset ring-pink-500/20'
        )}
      >
        {/* Track accent bar */}
        <div
          className="h-[2px] w-full"
          style={{
            backgroundColor: isPassed ? '#10b981' : meta.color,
            opacity: 0.7,
          }}
        />

        {/* Passed banner */}
        {isPassed && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">Passed in LMS ✓</span>
          </div>
        )}

        {/* Capstone tag */}
        {isCapstone && !isPassed && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-pink-500/10 border-b border-pink-500/20">
            <span className="text-[10px] font-bold text-pink-300 tracking-wider">CAPSTONE</span>
          </div>
        )}

        {/* Main card body */}
        <div className="p-4 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Status button — replaced by lock badge when module is locked */}
            {isLocked ? (
              <div
                title="Prerequisites pending — complete previous modules first to unlock this track"
                className="shrink-0 mt-0.5 flex items-center gap-1 border border-amber-500/25 bg-amber-500/10 text-amber-300 text-[10px] font-semibold px-2 py-1 rounded-full cursor-default select-none"
              >
                <Lock className="w-3 h-3" />
                Locked
              </div>
            ) : (
              <button
                onClick={handleToggle}
                title={`Status: ${STATUS_LABEL[effectiveStatus]} — click to cycle`}
                className={cn(
                  'shrink-0 mt-0.5 transition-all duration-200 hover:scale-110 active:scale-95',
                  STATUS_RING[effectiveStatus]
                )}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={effectiveStatus}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15, type: 'spring', stiffness: 400 }}
                  >
                    {STATUS_ICONS[effectiveStatus]}
                  </motion.span>
                </AnimatePresence>
              </button>
            )}

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <h3
                className={cn(
                  'text-sm font-semibold leading-snug',
                  isDone ? 'text-white/45 line-through' : 'text-white/90'
                )}
              >
                {module.title}
              </h3>

              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                {/* Sprint badge */}
                <span className="text-[10px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
                  S{module.sprint}
                </span>
                {/* Duration */}
                <span className="flex items-center gap-1 text-[11px] text-white/30 font-mono">
                  <Clock className="w-2.5 h-2.5" />
                  {module.totalDurationText}
                </span>
                {/* Topic count */}
                <span className="flex items-center gap-1 text-[11px] text-white/25">
                  <BookOpen className="w-2.5 h-2.5" />
                  {module.totalTopicsCount} topics
                </span>
              </div>
            </div>
          </div>

          {/* Task name (if applicable) */}
          {module.taskName && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <span className="text-[10px] font-bold text-orange-400 shrink-0 mt-0.5">TASK</span>
              <span className="text-[11px] text-orange-300/80 leading-snug">{module.taskName}</span>
            </div>
          )}

          {/* Lesson progress bar */}
          {module.lessons.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-white/25">
                  {module.lessons.filter((l) =>
                    l.id in lessonStatuses ? lessonStatuses[l.id] : !!module.isPassed
                  ).length}/{module.lessons.length} lessons
                </span>
                <span className="text-[10px] font-mono text-white/25">{lessonProgress}%</span>
              </div>
              <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: isPassed
                      ? 'linear-gradient(to right, #10b981, #34d399)'
                      : `linear-gradient(to right, ${meta.color}99, ${meta.color})`,
                  }}
                  animate={{ width: `${lessonProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* Badges */}
          {module.badges.filter((b) => b !== 'passed').length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {module.badges
                .filter((b) => b !== 'passed')
                .map((badge) => (
                  <span
                    key={badge}
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                      BADGE_CONFIG[badge as keyof typeof BADGE_CONFIG]?.color ??
                        'bg-white/10 text-white/40 border-white/10'
                    )}
                  >
                    {BADGE_CONFIG[badge as keyof typeof BADGE_CONFIG]?.label ?? badge}
                  </span>
                ))}
            </div>
          )}

          {/* Prerequisites banner — shown when locked */}
          {isLocked && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-amber-500/[0.06] border border-amber-500/20"
            >
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-400/70 shrink-0" />
                <span className="text-[10px] font-bold text-amber-300/80 uppercase tracking-wider">
                  Prerequisites pending
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pl-4">
                {missingPrereqTitles.map((title) => (
                  <span key={title} className="text-[10px] text-amber-200/55 leading-snug">
                    → {title}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-white/25 pl-4 mt-0.5">
                Complete the above modules first to unlock this track
              </p>
            </motion.div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] gap-2">
            {/* Status pill — shows locked state when applicable */}
            <span
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 rounded-full',
                isLocked
                  ? 'text-amber-300/60 bg-amber-500/10 border border-amber-500/15'
                  : effectiveStatus === 'not-started' ? 'text-white/25 bg-white/5'
                  : effectiveStatus === 'in-progress' ? 'text-amber-300 bg-amber-500/10'
                  : effectiveStatus === 'completed' ? 'text-cyan-300 bg-cyan-500/10'
                  : 'text-emerald-300 bg-emerald-500/10'
              )}
            >
              {isLocked ? '🔒 Locked' : STATUS_LABEL[effectiveStatus]}
            </span>

            <div className="flex items-center gap-1.5">
              {/* Expand lessons */}
              {module.lessons.length > 0 && (
                <button
                  onClick={() => setLessonsOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg',
                    'border transition-all duration-200',
                    lessonsOpen
                      ? 'text-white/70 border-white/20 bg-white/8'
                      : 'text-white/35 border-white/[0.06] hover:border-white/15 hover:text-white/60'
                  )}
                >
                  <BookOpen className="w-3 h-3" />
                  {lessonsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              {/* Artifact Vault — only for tasks/capstones */}
              {hasTaskOrCapstone && (
                <button
                  onClick={() => setVaultOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition-all duration-200',
                    vaultOpen || savedArtifact
                      ? 'text-amber-300 border-amber-400/30 bg-amber-500/8'
                      : 'text-white/35 border-white/[0.06] hover:border-amber-400/25 hover:text-amber-300/70'
                  )}
                  title="Artifact Vault — save repo, PR & demo links"
                >
                  <Archive className="w-3 h-3" />
                  {savedArtifact && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              )}

              {/* AI Studio */}
              <button
                onClick={() => onOpenAi('task-checker', module.id)}
                className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border text-white/35 border-white/[0.06] hover:border-purple-400/30 hover:text-purple-300 hover:bg-purple-500/5 transition-all duration-200 active:scale-95"
              >
                <Sparkles className="w-3 h-3" />
                AI
              </button>

              {/* Focus — inject into Pomodoro */}
              {!isLocked && (
                <button
                  onClick={() => {
                    // Parse totalDurationText e.g. "3h 40m", "45m", "1h" → minutes
                    const txt = module.totalDurationText
                    let mins = 0
                    const hMatch = txt.match(/(\d+)\s*h/)
                    const mMatch = txt.match(/(\d+)\s*m/)
                    if (hMatch) mins += parseInt(hMatch[1]) * 60
                    if (mMatch) mins += parseInt(mMatch[1])
                    const duration = Math.max(1, mins || 25)
                    useProgressStore.getState().setFocusedTask(module.title, duration, module.id)
                  }}
                  title="Focus Pomodoro on this module"
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border text-white/35 border-white/[0.06] hover:border-cyan-400/30 hover:text-cyan-300 hover:bg-cyan-500/5 transition-all duration-200 active:scale-95"
                >
                  <Play className="w-3 h-3" />
                  Focus
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expandable lesson accordion */}
        <AnimatePresence>
          {lessonsOpen && (
            <div className="relative">
              {/* Locked overlay — blocks interaction but keeps accordion visible */}
              {isLocked && (
                <div className="absolute inset-0 z-10 rounded-b-2xl bg-zinc-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border-t border-amber-500/15">
                  <Lock className="w-5 h-5 text-amber-400/60" />
                  <p className="text-[11px] text-amber-200/60 font-medium text-center px-4">
                    Prerequisites pending — complete previous modules first to unlock this track
                  </p>
                </div>
              )}
              <LessonAccordion
                module={module}
                lessonStatuses={lessonStatuses}
                onToggleLesson={isLocked ? () => {} : onToggleLesson}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Artifact Vault Panel */}
        <AnimatePresence>
          {vaultOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="p-3 space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Archive className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-semibold text-white/60">Artifact Vault</span>
                  {savedArtifact?.savedAt && (
                    <span className="text-[9px] text-white/20 ml-auto">
                      saved {new Date(savedArtifact.savedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* URL Inputs */}
                {[
                  { icon: <Github className="w-3 h-3" />, label: 'GitHub Repo', value: repoUrl, setter: setRepoUrl, placeholder: 'https://github.com/user/repo' },
                  { icon: <Link2 className="w-3 h-3" />, label: 'Pull Request', value: prUrl, setter: setPrUrl, placeholder: 'https://github.com/user/repo/pull/1' },
                  { icon: <ExternalLink className="w-3 h-3" />, label: 'Live Demo', value: demoUrl, setter: setDemoUrl, placeholder: 'https://your-app.web.app' },
                ].map(({ icon, label, value, setter, placeholder }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-white/25 shrink-0">{icon}</span>
                    <input
                      type="url"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      className={cn(
                        'flex-1 px-2.5 py-1.5 rounded-lg text-[11px]',
                        'bg-white/[0.03] border border-white/[0.07]',
                        'text-white/70 placeholder:text-white/15',
                        'focus:outline-none focus:border-amber-400/30 transition-all'
                      )}
                    />
                    {value && (
                      <a href={value} target="_blank" rel="noopener noreferrer"
                        className="text-white/20 hover:text-amber-300 transition-colors shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}

                {/* Save / Clear */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={handleSaveArtifact}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      saved
                        ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-400/30'
                        : 'text-amber-300 bg-amber-500/10 border border-amber-400/25 hover:bg-amber-500/20'
                    )}
                  >
                    <Save className="w-3 h-3" />
                    {saved ? '✓ Saved!' : 'Save Links'}
                  </button>
                  {savedArtifact && (
                    <button
                      onClick={() => { setRepoUrl(''); setPrUrl(''); setDemoUrl(''); onSaveArtifact(module.id, {}) }}
                      className="flex items-center gap-1 text-xs text-white/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
