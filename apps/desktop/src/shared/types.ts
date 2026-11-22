/** Data shapes shared by the main process and the renderers. */

export type Phase = 'work' | 'break'

/** Finished pomodoros relative to the user's local clock. */
export interface Counts {
  today: number
  week: number
  allTime: number
}

/** Everything the widget and the tray need to draw themselves. */
export interface TimerState {
  phase: Phase
  remainingSeconds: number
  paused: boolean
  counts: Counts
}
