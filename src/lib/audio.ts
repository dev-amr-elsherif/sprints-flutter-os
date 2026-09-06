/**
 * Synthesized audio chimes via Web Audio API — no external files, no CORS issues.
 * All audio is generated procedurally using oscillators and gain envelopes.
 */

type ChimePhase = 'focus' | 'short-break' | 'long-break'

/**
 * Internal helper: plays a sequence of sine-wave tones.
 * Each note: { freq, startAt, duration, peak } — all times relative to AudioContext.currentTime
 */
function playToneSequence(
  ctx: AudioContext,
  notes: { freq: number; startAt: number; duration: number; peak: number; type?: OscillatorType }[]
) {
  for (const note of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = note.type ?? 'sine'
    osc.frequency.value = note.freq
    osc.connect(gain)
    gain.connect(ctx.destination)

    const t = ctx.currentTime + note.startAt
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(note.peak, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, t + note.duration)

    osc.start(t)
    osc.stop(t + note.duration + 0.05)
  }
}

/**
 * Play a completion chime appropriate for the given session phase.
 *
 * Focus complete  → uplifting 2-note ascending chime (D5 → A5) with soft harmonic layer
 * Short break     → triple alert (A4 → C5 → E5) — "get back to work"
 * Long break      → warmer triple (G4 → B4 → D5)
 */
export function playSessionCompletedChime(phase: ChimePhase = 'focus'): void {
  if (typeof window === 'undefined') return

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx() as AudioContext

    // Resume if suspended by browser autoplay policy
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => null)
    }

    if (phase === 'focus') {
      // Uplifting ascending 2-note chime: D5 (587Hz) → A5 (880Hz)
      // Main tones at boosted gain + quiet octave harmonics for acoustic richness
      playToneSequence(ctx, [
        // Primary D5
        { freq: 587.33,  startAt: 0,    duration: 0.95, peak: 0.50 },
        // Soft octave harmonic D6 — adds body without harshness
        { freq: 1174.66, startAt: 0,    duration: 0.75, peak: 0.14 },
        // Primary A5
        { freq: 880,     startAt: 0.30, duration: 1.25, peak: 0.48 },
        // Soft harmonic A6 — shimmer layer
        { freq: 1760,    startAt: 0.30, duration: 0.90, peak: 0.10 },
      ])
    } else if (phase === 'short-break') {
      // Triple alert: A4 → C5 → E5
      playToneSequence(ctx, [
        { freq: 440,    startAt: 0,    duration: 0.40, peak: 0.46 },
        { freq: 523.25, startAt: 0.18, duration: 0.40, peak: 0.46 },
        { freq: 659.25, startAt: 0.36, duration: 0.75, peak: 0.44 },
      ])
    } else {
      // Long break complete — warmer triple: G4 → B4 → D5
      playToneSequence(ctx, [
        { freq: 392,    startAt: 0,    duration: 0.48, peak: 0.44 },
        { freq: 493.88, startAt: 0.22, duration: 0.48, peak: 0.44 },
        { freq: 587.33, startAt: 0.44, duration: 0.95, peak: 0.42 },
      ])
    }

    // Auto-close after chime finishes
    setTimeout(() => ctx.close().catch(() => null), 2800)
  } catch {
    /* noop — autoplay blocked or AudioContext not supported */
  }
}

/**
 * Play a short test pip so the user can verify their audio output.
 */
export function playTestChime(): void {
  if (typeof window === 'undefined') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx() as AudioContext
    if (ctx.state === 'suspended') ctx.resume().catch(() => null)
    playToneSequence(ctx, [
      { freq: 523.25, startAt: 0,    duration: 0.30, peak: 0.46 },
      { freq: 659.25, startAt: 0.15, duration: 0.55, peak: 0.44 },
    ])
    setTimeout(() => ctx.close().catch(() => null), 1200)
  } catch { /* noop */ }
}
