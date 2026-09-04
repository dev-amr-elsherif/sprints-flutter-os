'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { TrackType, GlobalStats } from '@/lib/types'
import { TRACK_META, ALL_TRACKS } from '@/lib/utils'
import { formatDuration } from '@/lib/utils'

interface RadarStatsProps {
  stats: GlobalStats
}

const SIZE = 120 // SVG center (viewBox 240×240)

// Diamond layout: Mobile=top, Systems=right, Quality=bottom, Career=left
const AXES: Record<TrackType, { angle: number }> = {
  Mobile: { angle: -90 },
  Systems: { angle: 0 },
  Quality: { angle: 90 },
  Career: { angle: 180 },
}

function polarToXY(angleDeg: number, r: number, cx = SIZE, cy = SIZE) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function radarPoints(tracks: TrackType[], values: number[], maxR: number): string {
  return tracks.map((track, i) => {
    const pct = values[i] / 100
    const { x, y } = polarToXY(AXES[track].angle, pct * maxR)
    return `${x},${y}`
  }).join(' ')
}

export function RadarStats({ stats }: RadarStatsProps) {
  const percentages = useMemo(
    () => ALL_TRACKS.map((t) => stats.byTrack[t]?.percentage ?? 0),
    [stats]
  )

  const maxR = SIZE * 0.72
  const gridLevels = [25, 50, 75, 100]

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-widest">
          Skill Balance
        </h3>
        <span className="text-xs text-white/30">% completion per track</span>
      </div>

      <div className="flex items-center gap-6">
        {/* SVG Radar */}
        <div className="shrink-0">
          <svg
            viewBox={`0 0 ${SIZE * 2} ${SIZE * 2}`}
            width={200}
            height={200}
            className="overflow-visible"
          >
            {/* Grid rings */}
            {gridLevels.map((lvl) => {
              const r = (lvl / 100) * maxR
              const pts = ALL_TRACKS.map((t) => {
                const { x, y } = polarToXY(AXES[t].angle, r)
                return `${x},${y}`
              }).join(' ')
              return (
                <polygon
                  key={lvl}
                  points={pts}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
              )
            })}

            {/* Axis lines */}
            {ALL_TRACKS.map((track) => {
              const end = polarToXY(AXES[track].angle, maxR)
              return (
                <line
                  key={track}
                  x1={SIZE}
                  y1={SIZE}
                  x2={end.x}
                  y2={end.y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
              )
            })}

            {/* Data polygon */}
            <motion.polygon
              points={radarPoints(ALL_TRACKS, percentages, maxR)}
              fill="rgba(99,102,241,0.15)"
              stroke="rgba(99,102,241,0.6)"
              strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ transformOrigin: `${SIZE}px ${SIZE}px` }}
            />

            {/* Data dots */}
            {ALL_TRACKS.map((track, i) => {
              const pct = percentages[i] / 100
              const { x, y } = polarToXY(AXES[track].angle, pct * maxR)
              const meta = TRACK_META[track]
              return (
                <motion.circle
                  key={track}
                  cx={x}
                  cy={y}
                  r={4}
                  fill={meta.color}
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={1.5}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.1, type: 'spring', stiffness: 300 }}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
              )
            })}

            {/* Axis labels */}
            {ALL_TRACKS.map((track) => {
              const meta = TRACK_META[track]
              const labelR = maxR + 20
              const { x, y } = polarToXY(AXES[track].angle, labelR)
              return (
                <text
                  key={track}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={meta.color}
                  fontWeight="600"
                >
                  {meta.emoji}
                </text>
              )
            })}
          </svg>
        </div>

        {/* Per-track bars */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {ALL_TRACKS.map((track) => {
            const meta = TRACK_META[track]
            const ts = stats.byTrack[track]
            const done = (ts?.completed ?? 0) + (ts?.passed ?? 0)
            return (
              <div key={track} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                <span className="text-xs text-white/50 w-16 shrink-0">{meta.shortLabel}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: meta.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${ts?.percentage ?? 0}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
                <span className="text-xs font-mono text-white/50 shrink-0 w-14 text-right">
                  {done}/{ts?.total ?? 0}
                </span>
              </div>
            )
          })}

          {/* Time stats */}
          <div className="mt-2 pt-2 border-t border-white/5 flex gap-4 text-xs text-white/30">
            <span>
              <span className="text-white/60 font-medium">{formatDuration(stats.completedMinutes)}</span>{' '}done
            </span>
            <span>
              <span className="text-white/60 font-medium">{formatDuration(stats.totalMinutes)}</span>{' '}total
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
