'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Play, FlaskConical, ClipboardCheck, Trophy, FileText, BarChart2 } from 'lucide-react'
import type { LessonItem, CurriculumModule } from '@/lib/types'
import { LESSON_TYPE_ICON, cn } from '@/lib/utils'

interface LessonAccordionProps {
  module: CurriculumModule
  lessonStatuses: Record<string, boolean>
  onToggleLesson: (lessonId: string, defaultChecked?: boolean) => void
}

const LESSON_TYPE_COLOR: Record<LessonItem['type'], string> = {
  video: 'text-cyan-400',
  capsule: 'text-purple-400',
  quiz: 'text-blue-400',
  task: 'text-orange-400',
  capstone: 'text-pink-400',
  lab: 'text-emerald-400',
  survey: 'text-yellow-400',
}

const LESSON_TYPE_ICON_COMPONENT: Record<LessonItem['type'], React.ReactNode> = {
  video: <Play className="w-3 h-3" />,
  capsule: <BarChart2 className="w-3 h-3" />,
  quiz: <FileText className="w-3 h-3" />,
  task: <ClipboardCheck className="w-3 h-3" />,
  capstone: <Trophy className="w-3 h-3" />,
  lab: <FlaskConical className="w-3 h-3" />,
  survey: <FileText className="w-3 h-3" />,
}

export function LessonAccordion({ module, lessonStatuses, onToggleLesson }: LessonAccordionProps) {
  const isLessonChecked = (lessonId: string) => lessonStatuses[lessonId] === true

  const checkedCount = module.lessons.filter((l) => isLessonChecked(l.id)).length
  const progressPct = module.lessons.length > 0
    ? Math.round((checkedCount / module.lessons.length) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="overflow-hidden border-t border-white/[0.06]"
    >
      {/* Lesson progress header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
          Lessons — {checkedCount}/{module.lessons.length}
        </span>
        <span className="text-[10px] font-mono text-white/40">{progressPct}%</span>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-2 h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Lesson list */}
      <div className="px-2 pb-3 max-h-72 overflow-y-auto scrollbar-none space-y-0.5">
        {module.lessons.map((lesson, idx) => {
          const checked = isLessonChecked(lesson.id)
          const isSpecialType = lesson.type === 'task' || lesson.type === 'capstone'

          return (
            <motion.button
              key={lesson.id}
              onClick={() => onToggleLesson(lesson.id)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.02, duration: 0.2 }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left',
                'transition-all duration-150 group/lesson',
                checked
                  ? 'bg-white/[0.04] hover:bg-white/[0.06]'
                  : 'hover:bg-white/[0.03]',
                isSpecialType && 'mt-1 border border-dashed border-white/10'
              )}
            >
              {/* Checkbox */}
              <div className="shrink-0">
                <AnimatePresence mode="wait">
                  {checked ? (
                    <motion.div
                      key="checked"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.5 }}
                      transition={{ duration: 0.15, type: 'spring', stiffness: 400 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="unchecked">
                      <Circle className="w-4 h-4 text-white/20 group-hover/lesson:text-white/40 transition-colors" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Type icon */}
              <span className={cn('shrink-0', LESSON_TYPE_COLOR[lesson.type])}>
                {LESSON_TYPE_ICON_COMPONENT[lesson.type]}
              </span>

              {/* Title */}
              <span
                className={cn(
                  'flex-1 text-xs leading-snug transition-colors duration-150',
                  checked ? 'text-white/35 line-through' : 'text-white/60',
                  isSpecialType && !checked && 'text-white/70 font-medium'
                )}
              >
                {lesson.title}
              </span>

              {/* Duration */}
              {lesson.duration && (
                <span className="shrink-0 text-[10px] font-mono text-white/20">
                  {lesson.duration}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
