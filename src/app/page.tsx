'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FlaskConical } from 'lucide-react'
import { useProgressStore } from '@/store/progressStore'
import { CURRICULUM, getCurriculumByTrack, getCurriculumBySprint } from '@/lib/curriculum'
import { computeStats, ALL_TRACKS, SPRINT_META, TRACK_META, getEffectiveStatus, cn } from '@/lib/utils'
import type { TrackType, SprintNumber, ItemStatus } from '@/lib/types'

import { Header } from '@/components/layout/Header'
import { RadarStats } from '@/components/layout/RadarStats'
import { TrackLane } from '@/components/board/TrackLane'
import { SprintLane } from '@/components/board/SprintLane'
import { EnergyFilterBanner } from '@/components/board/EnergyFilterBanner'
import { AiStudioDrawer } from '@/components/ai/AiStudioDrawer'
import { AiDailyPlanner } from '@/components/ai/AiDailyPlanner'
import { GlobalSherifCopilot } from '@/components/ai/GlobalSherifCopilot'
import { PomodoroTimer } from '@/components/tools/PomodoroTimer'
import { CapsuleQuickDump } from '@/components/tools/CapsuleQuickDump'
import { AuthGate } from '@/components/auth/AuthGate'

const SPRINTS: { number: SprintNumber; name: string; subtitle: string; color: string }[] = [
  { number: 1, name: "Sprint 1: Engineering Foundations", subtitle: "22h 55m • Systems, OS, Git, DB & Networks", color: "from-amber-500/20 to-orange-500/10" },
  { number: 2, name: "Sprint 2: Flutter Development Essentials", subtitle: "12h 24m • UI/UX, Dart OOP & Flutter Fundamentals", color: "from-cyan-500/20 to-blue-500/10" },
  { number: 3, name: "Sprint 3: Advanced Mobile Development", subtitle: "6h 49m • BLoC, APIs, Firebase, Clean Architecture", color: "from-blue-500/20 to-indigo-500/10" },
  { number: 4, name: "Sprint 4: Mobile Deployment & Testing", subtitle: "6h 58m • Docker, Manual QA & Appium Automation", color: "from-purple-500/20 to-pink-500/10" },
  { number: 5, name: "Sprint 5: Delivery, Leadership & Career", subtitle: "17h 37m • Agile, Scrum, Soft Skills, CV & Interviews", color: "from-emerald-500/20 to-teal-500/10" },
]

export default function HomePage() {
  const {
    moduleStatuses,
    lessonStatuses,
    viewMode,
    activeTrack,
    activeSprint,
    energyFilter,
    aiDrawerOpen,
    aiMode,
    selectedModuleId,
    artifacts,
    zenMode,
    setActiveTrack,
    setActiveSprint,
    setEnergyFilter,
    setViewMode,
    cycleModuleStatus,
    toggleLesson,
    openAiDrawer,
    closeAiDrawer,
    exportProgress,
    importProgress,
    resetProgress,
    resetAllProgress,
    saveTaskArtifact,
  } = useProgressStore()

  const [capsuleDumpOpen, setCapsuleDumpOpen] = useState(false)

  // Global stats
  const stats = useMemo(() => computeStats(moduleStatuses), [moduleStatuses])

  // Visible tracks (parallel-tracks view)
  const visibleTracks = useMemo(
    () => (!activeTrack || activeTrack === 'all' ? ALL_TRACKS : [activeTrack as TrackType]),
    [activeTrack]
  )

  // Visible sprints (official-sprints view)
  const visibleSprints = useMemo(() => {
    if (!activeSprint || activeSprint === 'all') {
      return SPRINTS
    }
    const sprintNum = Number(activeSprint) as SprintNumber
    const found = SPRINTS.filter((s) => s.number === sprintNum)
    return found.length > 0 ? found : SPRINTS
  }, [activeSprint])

  return (
    <AuthGate>
      <div className="min-h-[100dvh] overflow-x-hidden w-full">
      {/* ── Header ── */}
      <Header
        stats={stats}
        viewMode={viewMode}
        activeTrack={activeTrack}
        activeSprint={activeSprint}
        energyFilter={energyFilter}
        onViewModeChange={setViewMode}
        onTrackChange={setActiveTrack}
        onSprintChange={setActiveSprint}
        onEnergyFilter={setEnergyFilter}
        onExport={exportProgress}
        onImport={importProgress}
        onReset={resetProgress}
        onHardReset={resetAllProgress}
      />

      {/* ── Main ── */}
      <main className="w-full max-w-[1680px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* ── Stats Row ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Radar chart */}
          <div className="lg:col-span-1">
            <RadarStats stats={stats} />
          </div>

          {/* Per-track mini stat cards */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {ALL_TRACKS.map((track) => {
              const meta = TRACK_META[track]
              const ts = stats.byTrack[track]
              const done = (ts?.completed ?? 0) + (ts?.passed ?? 0)
              const isActive = viewMode === 'parallel-tracks' && activeTrack === track

              return (
                <motion.button
                  key={track}
                  onClick={() => {
                    if (viewMode === 'parallel-tracks') {
                      setActiveTrack(activeTrack === track ? 'all' : track)
                    }
                  }}
                  whileTap={{ scale: 0.97 }}
                  className={`
                    p-3 sm:p-3.5 rounded-2xl text-left transition-all duration-200 cursor-pointer
                    glass border
                    ${isActive ? 'border-white/20 bg-white/[0.07]' : 'border-white/[0.06] hover:border-white/12 hover:bg-white/[0.04]'}
                  `}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                    <span className="text-sm sm:text-base shrink-0">{meta.emoji}</span>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-white/60 line-clamp-1">{meta.shortLabel}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold text-white tabular-nums">
                    {Math.round(ts?.percentage ?? 0)}%
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: meta.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${ts?.percentage ?? 0}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] text-white/25 font-mono">
                    {done}/{ts?.total ?? 0}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* ── AI Daily Planner ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <AiDailyPlanner />
        </motion.div>

        {/* ── View mode label & sprint tabs ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between gap-3 flex-wrap"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-widest flex items-center gap-2">
                <span>{viewMode === 'parallel-tracks' ? '📱' : '📋'}</span>
                <span>{viewMode === 'parallel-tracks' ? 'Parallel Track View' : 'Official Sprints View'}</span>
              </span>
              <span className="text-[11px] font-mono text-white/25">
                ({viewMode === 'parallel-tracks' ? `${visibleTracks.length} tracks` : `${visibleSprints.length} sprints`})
              </span>
            </div>

            {/* In-page sprint tabs when in official-sprints view */}
            {viewMode === 'official-sprints' && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] shrink-0 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveSprint('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all select-none whitespace-nowrap',
                    (!activeSprint || activeSprint === 'all')
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-sm'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                  )}
                >
                  All Sprints
                </button>
                {SPRINTS.map((s) => {
                  const isActive = String(activeSprint) === String(s.number)
                  return (
                    <button
                      key={s.number}
                      onClick={() => setActiveSprint(s.number)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all select-none whitespace-nowrap',
                        isActive
                          ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
                      )}
                    >
                      S{s.number}
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Energy filter banner ── */}
        <EnergyFilterBanner
          filter={energyFilter}
          onClear={() => setEnergyFilter('all')}
        />

        {/* ── Board: Parallel Tracks OR Official Sprints ── */}
        {/* Zen mode dims the board when active */}
        <div className={`transition-opacity duration-500 ${zenMode ? 'opacity-20 pointer-events-none select-none' : 'opacity-100'}`}>
          <AnimatePresence mode="wait">
            {viewMode === 'parallel-tracks' ? (
              <motion.div
                key="parallel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {visibleTracks.map((track, idx) => (
                  <motion.div
                    key={track}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx * 0.07 }}
                  >
                    <TrackLane
                      track={track}
                      modules={getCurriculumByTrack(track)}
                      moduleStatuses={moduleStatuses}
                      lessonStatuses={lessonStatuses}
                      artifacts={artifacts}
                      energyFilter={energyFilter}
                      onCycleStatus={cycleModuleStatus}
                      onToggleLesson={toggleLesson}
                      onOpenAi={openAiDrawer}
                      onSaveArtifact={saveTaskArtifact}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="sprints"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {visibleSprints.map((sprint, idx) => {
                  const sprintModules = CURRICULUM.filter((m) => m.sprint === sprint.number)
                  return (
                    <motion.div
                      key={sprint.number}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: idx * 0.07 }}
                    >
                      <SprintLane
                        sprint={sprint.number}
                        name={sprint.name}
                        subtitle={sprint.subtitle}
                        modules={sprintModules}
                        moduleStatuses={moduleStatuses}
                        lessonStatuses={lessonStatuses}
                        artifacts={artifacts}
                        energyFilter={energyFilter}
                        onCycleStatus={cycleModuleStatus}
                        onToggleLesson={toggleLesson}
                        onOpenAi={openAiDrawer}
                        onSaveArtifact={saveTaskArtifact}
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ── */}
        <footer className="py-8 text-center text-xs text-white/15 space-y-1">
          <p>ACC × Sprints — Flutter Bootcamp OS · Modular Learning Tracker v2</p>
          <p>
            {viewMode === 'parallel-tracks' ? '🔀 4 Parallel Tracks' : '📋 5 Official Sprints'} ·
            {' '}Progress auto-saved to localStorage · Export JSON anytime
          </p>
        </footer>
      </main>

      {/* ── AI Studio Drawer ── */}
      <AiStudioDrawer
        open={aiDrawerOpen}
        onClose={closeAiDrawer}
        initialMode={aiMode}
        moduleId={selectedModuleId}
      />

      {/* ── Capsule Quick-Dump ── */}
      <CapsuleQuickDump
        open={capsuleDumpOpen}
        onClose={() => setCapsuleDumpOpen(false)}
      />

      {/* ── Floating: Capsule Dump Trigger ── */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1 }}
        onClick={() => setCapsuleDumpOpen(true)}
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-30 flex items-center gap-2 px-3 py-2.5 rounded-2xl glass-strong border border-white/[0.09] text-white/50 hover:text-cyan-300 hover:border-cyan-400/25 shadow-xl transition-all duration-200 hover:scale-105"
        title="Capsule Quick-Dump — paste lesson notes for AI synthesis"
      >
        <FlaskConical className="w-4 h-4" />
        <span className="text-xs font-medium hidden sm:inline">Capsule</span>
      </motion.button>

      {/* ── Global Sherif AI Co-Pilot ── */}
      <GlobalSherifCopilot />

      {/* ── Pomodoro Timer (fixed bottom-right) ── */}
      <PomodoroTimer />
    </div>
  </AuthGate>
  )
}

