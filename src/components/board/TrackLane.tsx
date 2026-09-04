'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Award } from 'lucide-react'
import type { CurriculumModule, ItemStatus, EnergyFilter, AiMode } from '@/lib/types'
import { TRACK_META, getEffectiveStatus, cn } from '@/lib/utils'
import { ModuleCard } from './ModuleCard'

interface TrackLaneProps {
  track: 'Mobile' | 'Systems' | 'Quality' | 'Career'
  modules: CurriculumModule[]
  moduleStatuses: Record<string, ItemStatus>
  lessonStatuses: Record<string, boolean>
  artifacts: Record<string, import('@/lib/types').ArtifactUrls>
  energyFilter: EnergyFilter
  onCycleStatus: (id: string, currentEffective: ItemStatus) => void
  onToggleLesson: (lessonId: string, defaultChecked?: boolean) => void
  onOpenAi: (mode: AiMode, moduleId: string) => void
  onSaveArtifact: (moduleId: string, urls: import('@/lib/types').ArtifactUrls) => void
}

export function TrackLane({
  track,
  modules,
  moduleStatuses,
  lessonStatuses,
  artifacts,
  energyFilter,
  onCycleStatus,
  onToggleLesson,
  onOpenAi,
  onSaveArtifact,
}: TrackLaneProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const meta = TRACK_META[track]

  const visibleModules = useMemo(() => {
    if (energyFilter === 'all') return modules
    return modules.filter((m) => m.badges.includes(energyFilter as 'high-energy' | 'micro-learning'))
  }, [modules, energyFilter])

  const passedCount = useMemo(
    () => modules.filter((m) => getEffectiveStatus(m.id, m.isPassed, moduleStatuses) === 'passed').length,
    [modules, moduleStatuses]
  )
  const completedCount = useMemo(
    () => modules.filter((m) => moduleStatuses[m.id] === 'completed').length,
    [modules, moduleStatuses]
  )
  const inProgressCount = useMemo(
    () => modules.filter((m) => moduleStatuses[m.id] === 'in-progress').length,
    [modules, moduleStatuses]
  )

  const doneCount = completedCount + passedCount
  const pct = modules.length > 0 ? Math.round((doneCount / modules.length) * 100) : 0

  return (
    <motion.div
      layout
      className={cn(
        'relative rounded-2xl overflow-hidden border transition-colors duration-700',
        doneCount === modules.length && modules.length > 0 ? meta.borderClass : 'border-white/[0.06]'
      )}
    >
      {/* Left glow bar */}
      <div
        className="absolute top-0 left-0 w-[3px] h-full rounded-l-2xl"
        style={{ background: `linear-gradient(to bottom, ${meta.color}cc, ${meta.color}33)` }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-b border-white/[0.05]"
        onClick={() => setIsCollapsed((v) => !v)}
      >
        <span className="text-xl shrink-0">{meta.emoji}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold tracking-wide" style={{ color: meta.color }}>
              {track.toUpperCase()}
            </h2>
            <span className="text-sm font-semibold text-white/70 truncate">{meta.label}</span>
          </div>
          <p className="text-xs text-white/30 mt-0.5 hidden sm:block">{meta.description}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 shrink-0">
          {passedCount > 0 && (
            <div className="flex items-center gap-1 text-emerald-400 text-xs">
              <Award className="w-3.5 h-3.5" />
              <span className="font-mono">{passedCount}</span>
            </div>
          )}
          {completedCount > 0 && (
            <div className="flex items-center gap-1 text-cyan-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-mono">{completedCount}</span>
            </div>
          )}
          {inProgressCount > 0 && (
            <div className="flex items-center gap-1 text-amber-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="font-mono">{inProgressCount}</span>
            </div>
          )}

          <span className="text-xs text-white/25 font-mono">
            {visibleModules.length}/{modules.length}
          </span>

          <div
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
          >
            {pct}%
          </div>

          <div className="text-white/30">
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-white/[0.03]">
        <motion.div
          className="h-full"
          style={{ backgroundColor: meta.color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Module grid */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4">
              {visibleModules.length === 0 ? (
                <div className="py-8 text-center text-sm text-white/25">
                  No modules match the current energy filter in this track.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  <AnimatePresence>
                    {visibleModules.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        moduleStatuses={moduleStatuses}
                        lessonStatuses={lessonStatuses}
                        artifacts={artifacts}
                        onCycleStatus={onCycleStatus}
                        onToggleLesson={onToggleLesson}
                        onOpenAi={onOpenAi}
                        onSaveArtifact={onSaveArtifact}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
