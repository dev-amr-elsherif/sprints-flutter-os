'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  Upload,
  RotateCcw,
  Zap,
  Moon,
  Layers,
  GraduationCap,
  Trophy,
  LayoutGrid,
  ListOrdered,
  Lock,
} from 'lucide-react'
import type { TrackType, EnergyFilter, ViewMode, SprintNumber, GlobalStats } from '@/lib/types'
import { TRACK_META, ALL_TRACKS, cn, downloadJson, SPRINT_META } from '@/lib/utils'
import { TOTAL_MODULES, TOTAL_HOURS } from '@/lib/curriculum'
import { triggerAppLock } from '@/components/auth/AuthGate'

interface HeaderProps {
  stats: GlobalStats
  viewMode: ViewMode
  activeTrack: TrackType | 'all'
  activeSprint: SprintNumber | 'all'
  energyFilter: EnergyFilter
  onViewModeChange: (mode: ViewMode) => void
  onTrackChange: (track: TrackType | 'all') => void
  onSprintChange: (sprint: SprintNumber | 'all') => void
  onEnergyFilter: (f: EnergyFilter) => void
  onExport: () => string
  onImport: (json: string) => boolean
  onReset: () => void
  onHardReset: () => void
  onLock?: () => void
}

const TRACK_SWITCHER: Array<{ id: TrackType | 'all'; label: string; emoji?: string }> = [
  { id: 'all', label: 'All' },
  { id: 'Mobile', label: 'Flutter', emoji: '📱' },
  { id: 'Systems', label: 'Systems', emoji: '⚙️' },
  { id: 'Quality', label: 'Design/QA', emoji: '🎨' },
  { id: 'Career', label: 'Career', emoji: '🚀' },
]

const SPRINT_SWITCHER: Array<{ id: SprintNumber | 'all'; label: string; shortLabel: string; emoji?: string }> = [
  { id: 'all', label: 'All Sprints', shortLabel: 'All Sprints' },
  { id: 1, label: 'Sprint 1 · Foundations', shortLabel: 'S1', emoji: '🏗️' },
  { id: 2, label: 'Sprint 2 · Flutter Basics', shortLabel: 'S2', emoji: '📱' },
  { id: 3, label: 'Sprint 3 · Advanced Mobile', shortLabel: 'S3', emoji: '🚀' },
  { id: 4, label: 'Sprint 4 · Testing & Deploy', shortLabel: 'S4', emoji: '🧪' },
  { id: 5, label: 'Sprint 5 · Career', shortLabel: 'S5', emoji: '🎓' },
]

export function Header({
  stats,
  viewMode,
  activeTrack,
  activeSprint,
  energyFilter,
  onViewModeChange,
  onTrackChange,
  onSprintChange,
  onEnergyFilter,
  onExport,
  onImport,
  onReset,
  onHardReset,
  onLock,
}: HeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const json = onExport()
    downloadJson(json, `sprints-progress-${new Date().toISOString().split('T')[0]}.json`)
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const ok = onImport(ev.target?.result as string)
      if (!ok) alert('Invalid progress file. Please check the format.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const pct = stats.overallPercentage
  const doneCount = stats.completedModules + stats.passedModules

  return (
    <header className="sticky top-0 z-30 glass border-b border-white/[0.06] backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">

        {/* ── Row 1: Logo + Progress + Actions ── */}
        <div className="flex items-center gap-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white leading-none">Sprints Flutter OS</h1>
              <p className="text-[10px] text-white/30 mt-0.5">ACC × Sprints Bootcamp</p>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="flex-1 min-w-0 max-w-xs hidden md:block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/40 font-mono">
                {doneCount} / {stats.totalModules} done
              </span>
              <span className="text-[11px] font-bold text-white/60 font-mono">{pct}%</span>
            </div>
            <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Curriculum stats */}
          <div className="hidden lg:flex items-center gap-4 text-xs text-white/30">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <span className="text-white/60 font-medium">{stats.passedModules}</span> passed
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                <span className="text-white/60 font-medium">{TOTAL_HOURS}h</span> curriculum
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-white/20">
              <span>{TOTAL_MODULES} modules</span>
            </div>
          </div>

          <div className="flex-1 hidden lg:block" />

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.05] rounded-xl border border-white/[0.08] shrink-0">
            <button
              onClick={() => onViewModeChange('parallel-tracks')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                viewMode === 'parallel-tracks'
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-white/35 hover:text-white/60'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">4 Tracks</span>
            </button>
            <button
              onClick={() => onViewModeChange('official-sprints')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                viewMode === 'official-sprints'
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'text-white/35 hover:text-white/60'
              )}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">5 Sprints</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/50 hover:text-white/80 border border-white/[0.08] hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/50 hover:text-white/80 border border-white/[0.08] hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Reset ALL course progress to 0%?\n\nThis will clear every module status (including pre-passed modules) and all lesson checkboxes. This cannot be undone.')) {
                  onHardReset()
                }
              }}
              title="Reset all progress to 0% — clears even pre-passed modules"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white/30 hover:text-red-400 border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/5 transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline text-[11px]">Reset 0%</span>
            </button>
            <button
              onClick={() => {
                triggerAppLock()
                onLock?.()
              }}
              title="Lock OS Session (Cyberpunk Security Gate)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-amber-300/80 hover:text-amber-200 border border-amber-500/25 hover:border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 transition-all shadow-sm"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-mono text-[11px]">Lock</span>
            </button>
          </div>


          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ── Row 2: Filter bar (changes by view mode) ── */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-none scroll-smooth">
          {viewMode === 'parallel-tracks' ? (
            /* Track filter tabs */
            <div className="flex items-center gap-1 shrink-0 py-0.5">
              {TRACK_SWITCHER.map((item) => {
                const isActive = activeTrack === item.id
                const trackMeta = item.id !== 'all' ? TRACK_META[item.id as TrackType] : null
                return (
                  <button
                    key={item.id}
                    onClick={() => onTrackChange(item.id as TrackType | 'all')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
                      'transition-all duration-200 whitespace-nowrap select-none shrink-0',
                      isActive
                        ? 'text-white border'
                        : 'text-white/35 hover:text-white/65 hover:bg-white/5 border border-transparent'
                    )}
                    style={
                      isActive && trackMeta
                        ? { backgroundColor: `${trackMeta.color}18`, borderColor: `${trackMeta.color}50`, color: trackMeta.color }
                        : isActive
                        ? { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }
                        : undefined
                    }
                  >
                    {item.emoji && <span>{item.emoji}</span>}
                    {item.label}
                    {item.id !== 'all' && trackMeta && (
                      <span className="text-[9px] font-bold opacity-60" style={{ color: trackMeta.color }}>
                        {stats.byTrack[item.id as TrackType]?.percentage ?? 0}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            /* Sprint filter tabs */
            <div className="flex items-center gap-1 shrink-0 py-0.5">
              {SPRINT_SWITCHER.map((item) => {
                const isActive =
                  (item.id === 'all' && (!activeSprint || activeSprint === 'all')) ||
                  String(activeSprint) === String(item.id)
                const sprintMeta = item.id !== 'all' ? SPRINT_META[item.id as number] : null
                return (
                  <button
                    key={item.id}
                    onClick={() => onSprintChange(item.id as SprintNumber | 'all')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium',
                      'transition-all duration-200 whitespace-nowrap select-none shrink-0',
                      isActive
                        ? 'text-white border shadow-sm'
                        : 'text-white/35 hover:text-white/65 hover:bg-white/5 border border-transparent'
                    )}
                    style={
                      isActive && sprintMeta
                        ? { backgroundColor: `${sprintMeta.color}18`, borderColor: `${sprintMeta.color}50`, color: sprintMeta.color }
                        : isActive
                        ? { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }
                        : undefined
                    }
                  >
                    {item.emoji && <span className="text-xs">{item.emoji}</span>}
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden font-mono">{item.shortLabel}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />

          {/* Energy filter */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEnergyFilter('all')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all select-none whitespace-nowrap shrink-0',
                energyFilter === 'all'
                  ? 'text-white bg-white/10 border border-white/20'
                  : 'text-white/35 hover:text-white/65 border border-transparent hover:bg-white/5'
              )}
            >
              <Layers className="w-3 h-3" />
              All
            </button>
            <button
              onClick={() => onEnergyFilter('high-energy')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all select-none whitespace-nowrap shrink-0',
                energyFilter === 'high-energy'
                  ? 'text-red-300 bg-red-500/15 border border-red-500/30'
                  : 'text-white/35 hover:text-white/65 border border-transparent hover:bg-white/5'
              )}
            >
              <Zap className="w-3 h-3" />
              ⚡ Deep
            </button>
            <button
              onClick={() => onEnergyFilter('micro-learning')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all select-none whitespace-nowrap shrink-0',
                energyFilter === 'micro-learning'
                  ? 'text-indigo-300 bg-indigo-500/15 border border-indigo-500/30'
                  : 'text-white/35 hover:text-white/65 border border-transparent hover:bg-white/5'
              )}
            >
              <Moon className="w-3 h-3" />
              Micro
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
