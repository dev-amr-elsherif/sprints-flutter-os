import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ItemStatus,
  TrackType,
  SprintNumber,
  EnergyFilter,
  AiMode,
  ViewMode,
  ArtifactUrls,
  ProgressStore,
} from '@/lib/types'
import { STATUS_CYCLE } from '@/lib/utils'
import { CURRICULUM } from '@/lib/curriculum'

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────
      moduleStatuses: {} as Record<string, ItemStatus>,
      lessonStatuses: {} as Record<string, boolean>,
      viewMode: 'parallel-tracks' as ViewMode,
      activeTrack: 'all' as TrackType | 'all',
      activeSprint: 'all' as SprintNumber | 'all',
      energyFilter: 'all' as EnergyFilter,
      aiDrawerOpen: false,
      aiMode: 'task-checker' as AiMode,
      selectedModuleId: null,
      // Artifact vault
      artifacts: {} as Record<string, ArtifactUrls>,
      // Pomodoro / Zen
      zenMode: false,
      focusedModuleId: null,
      focusedTaskTitle: null,
      focusedTaskDurationSecs: null,
      // Sherif OS Controller — non-persisted active plan
      activeDailyPlan: null,

      // ─── Module status actions ───────────────────────────────────────────
      cycleModuleStatus: (id: string, currentEffective: ItemStatus) =>
        set((state) => ({
          moduleStatuses: {
            ...state.moduleStatuses,
            [id]: STATUS_CYCLE[currentEffective],
          },
        })),

      setModuleStatus: (id: string, status: ItemStatus) =>
        set((state) => ({
          moduleStatuses: { ...state.moduleStatuses, [id]: status },
        })),

      // ─── Lesson checkbox actions ─────────────────────────────────────────
      toggleLesson: (lessonId: string, defaultChecked = false) =>
        set((state) => {
          const current =
            lessonId in state.lessonStatuses
              ? state.lessonStatuses[lessonId]
              : defaultChecked
          return {
            lessonStatuses: { ...state.lessonStatuses, [lessonId]: !current },
          }
        }),

      // ─── View / filter actions ───────────────────────────────────────────
      setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
      setActiveTrack: (track: TrackType | 'all') => set({ activeTrack: track }),
      setActiveSprint: (sprint: SprintNumber | 'all') => set({ activeSprint: sprint }),
      setEnergyFilter: (filter: EnergyFilter) => set({ energyFilter: filter }),

      // ─── AI Drawer ───────────────────────────────────────────────────────
      openAiDrawer: (mode: AiMode, moduleId: string) =>
        set({ aiDrawerOpen: true, aiMode: mode, selectedModuleId: moduleId }),
      closeAiDrawer: () => set({ aiDrawerOpen: false, selectedModuleId: null }),
      setAiMode: (mode: AiMode) => set({ aiMode: mode }),

      // ─── Export / Import ──────────────────────────────────────────────────
      exportProgress: () => {
        const { moduleStatuses, lessonStatuses, artifacts } = get()
        return JSON.stringify(
          {
            version: '2.0',
            exportedAt: new Date().toISOString(),
            moduleStatuses,
            lessonStatuses,
            artifacts,
          },
          null,
          2
        )
      },

      importProgress: (json: string): boolean => {
        try {
          const data = JSON.parse(json) as {
            moduleStatuses?: Record<string, ItemStatus>
            lessonStatuses?: Record<string, boolean>
            artifacts?: Record<string, ArtifactUrls>
          }
          if (data?.moduleStatuses) {
            set({
              moduleStatuses: data.moduleStatuses,
              lessonStatuses: data.lessonStatuses ?? {},
              artifacts: data.artifacts ?? {},
            })
            return true
          }
          return false
        } catch {
          return false
        }
      },

      // ─── Reset progress: ALL modules set to not-started (0%) ───────────
      resetProgress: () => {
        const allReset: Record<string, ItemStatus> = {}
        for (const m of CURRICULUM) {
          allReset[m.id] = 'not-started'
        }
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('sprints-os-v2-progress')
            localStorage.removeItem('sprints-os-progress')
          } catch { /* noop */ }
        }
        set({ moduleStatuses: allReset, lessonStatuses: {}, artifacts: {} })
      },

      // ─── Hard reset: ALL modules explicitly set to not-started (0%) ───
      resetAllProgress: () => {
        const allReset: Record<string, ItemStatus> = {}
        for (const m of CURRICULUM) {
          allReset[m.id] = 'not-started'
        }
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('sprints-os-v2-progress')
            localStorage.removeItem('sprints-os-progress')
          } catch { /* noop */ }
        }
        set({ moduleStatuses: allReset, lessonStatuses: {}, artifacts: {} })
      },

      // ─── Artifact vault ───────────────────────────────────────────────────
      saveTaskArtifact: (moduleId: string, urls: ArtifactUrls) =>
        set((state) => ({
          artifacts: {
            ...state.artifacts,
            [moduleId]: { ...urls, savedAt: new Date().toISOString() },
          },
        })),

      // ─── Pomodoro / Zen ───────────────────────────────────────────────────
      setZenMode: (v: boolean) => set({ zenMode: v }),
      setFocusedModule: (id: string | null) => set({ focusedModuleId: id }),
      setFocusedTask: (taskTitle: string, durationMinutes: number, moduleId?: string) =>
        set({
          focusedTaskTitle: taskTitle,
          focusedTaskDurationSecs: durationMinutes * 60,
          focusedModuleId: moduleId ?? null,
        }),

      // ─── Sherif OS Controller ─────────────────────────────────────────────
      setActiveDailyPlan: (plan) => set({ activeDailyPlan: plan }),
    }),
    {
      name: 'sprints-os-v2-progress',
      partialize: (state) => ({
        moduleStatuses: state.moduleStatuses,
        lessonStatuses: state.lessonStatuses,
        artifacts: state.artifacts,
      }),
    }
  )
)
