import type { Phase, TimerState } from './types'

export const WORK_SECONDS = 25 * 60
export const BREAK_SECONDS = 5 * 60

/** Full length of a phase, used by the timer and by the widget's progress ring. */
export function phaseSeconds(phase: Phase): number {
  return phase === 'work' ? WORK_SECONDS : BREAK_SECONDS
}

/** True for a work phase that has not ticked yet, so starting it begins a new pomodoro. */
export function isUnstartedWork(phase: Phase, remainingSeconds: number): boolean {
  return phase === 'work' && remainingSeconds === WORK_SECONDS
}

/** "m:ss", as shown on the widget. */
export function formatRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Fraction of the current phase still to run, from 1 (just started) to 0. */
export function remainingFraction(state: Pick<TimerState, 'phase' | 'remainingSeconds'>): number {
  return state.remainingSeconds / phaseSeconds(state.phase)
}

/** Label of the tray's start/pause item. */
export function pauseActionLabel(state: Pick<TimerState, 'phase' | 'remainingSeconds' | 'paused'>): string {
  if (!state.paused) return 'Pause'
  return isUnstartedWork(state.phase, state.remainingSeconds) ? 'Start' : 'Resume'
}
