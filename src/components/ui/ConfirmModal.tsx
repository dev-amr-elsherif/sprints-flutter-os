'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = '\u26a0\ufe0f Reset Everything',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            key="confirm-card"
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="w-full max-w-md bg-zinc-950/95 border border-rose-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/15 border border-rose-500/30 shadow-[0_0_16px_rgba(244,63,94,0.2)]">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white leading-snug">{title}</h2>
                <p className="text-sm text-white/50 leading-relaxed mt-1">{description}</p>
              </div>
            </div>
            <div className="mb-5 px-3 py-2.5 rounded-xl bg-rose-500/[0.06] border border-rose-500/20">
              <p className="text-xs text-rose-300/80 leading-relaxed">
                This will clear all checked lessons, module statuses, and custom artifact links.
                <strong className="text-rose-300"> This action is irreversible.</strong>
              </p>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white/50 border border-white/10 hover:text-white/80 hover:border-white/20 hover:bg-white/5 transition-all"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => { onConfirm(); onCancel() }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95 shadow-[0_0_16px_rgba(244,63,94,0.3)]"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
