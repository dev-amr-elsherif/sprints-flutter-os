'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Moon, Layers } from 'lucide-react'
import type { EnergyFilter } from '@/lib/types'
import { cn } from '@/lib/utils'

interface EnergyFilterBannerProps {
  filter: EnergyFilter
  onClear: () => void
}

const FILTER_CONFIG: Record<
  Exclude<EnergyFilter, 'all'>,
  { label: string; description: string; color: string; icon: React.ReactNode }
> = {
  'high-energy': {
    label: 'High Energy / Deep Code',
    description: 'Showing coding sessions, architecture, Docker, PostgreSQL & Flutter builds',
    color: 'border-red-400/30 bg-red-500/5',
    icon: <Zap className="w-4 h-4 text-red-400" />,
  },
  'micro-learning': {
    label: 'Micro-Learning / Low Energy',
    description: 'Showing short conceptual videos ≤ 30 min — Soft Skills, Agile & UI Theory',
    color: 'border-indigo-400/30 bg-indigo-500/5',
    icon: <Moon className="w-4 h-4 text-indigo-400" />,
  },
}

export function EnergyFilterBanner({ filter, onClear }: EnergyFilterBannerProps) {
  return (
    <AnimatePresence>
      {filter !== 'all' && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 rounded-xl border glass',
              FILTER_CONFIG[filter].color
            )}
          >
            {FILTER_CONFIG[filter].icon}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white/80 mr-2">
                {FILTER_CONFIG[filter].label}
              </span>
              <span className="text-xs text-white/40 hidden sm:inline">
                — {FILTER_CONFIG[filter].description}
              </span>
            </div>
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 
                         transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <Layers className="w-3 h-3" />
              Show All
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
