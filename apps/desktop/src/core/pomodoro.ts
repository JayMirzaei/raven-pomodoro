import { EventEmitter } from 'events'
import { WORK_SECONDS, isUnstartedWork, phaseSeconds } from '../shared/phases'
import type { Counts, Phase, TimerState } from '../shared/types'

export interface PomodoroTimerDeps {
  /** Called when a work phase runs its full length. May return a promise; state is re-emitted when it settles. */
  onWorkCompleted(startedAt: Date): Promise<unknown> | void
  /** Current pomodoro counts to include in each state snapshot. */
  getCounts(): Counts
  /** Clock, injectable for tests. */
  now?: () => Date
}

/**
 * The 25/5 Pomodoro state machine. It has no Electron or storage imports:
 * persistence and sync are supplied through `deps`, which keeps it testable.
 * Emits 'state' with a TimerState snapshot whenever anything visible changes.
 */
export class PomodoroTimer extends EventEmitter {
  private phase: Phase = 'work'
  private remainingSeconds = WORK_SECONDS
  // Starts paused: launching (by hand or via autostart) should never silently
  // begin counting a work session; the user clicks the widget to start one.
  private paused = true
  private workStartedAt: Date
  private interval: ReturnType<typeof setInterval> | null = null
  private readonly now: () => Date

  constructor(private readonly deps: PomodoroTimerDeps) {
    super()
    this.now = deps.now ?? (() => new Date())
    this.workStartedAt = this.now()
  }

  /** Starts the one-second clock. Safe to call more than once. */
  start(): void {
    if (this.interval) return
    this.interval = setInterval(() => this.tick(), 1000)
  }

  /** Stops the clock (used by tests; the app runs it for its whole life). */
  stop(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  }

  /** Advances the countdown by one second (driven by `start`, public for tests). */
  tick(): void {
    if (this.paused) return
    this.remainingSeconds -= 1
    if (this.remainingSeconds <= 0) {
      this.advancePhase(true)
    } else {
      this.emitState()
    }
  }

  // Only a full, natural 25:00 countdown counts as a completed pomodoro;
  // skipping a work phase early advances to the break without counting it.
  private advancePhase(reachedNaturally: boolean): void {
    if (this.phase === 'work') {
      if (reachedNaturally) {
        Promise.resolve(this.deps.onWorkCompleted(this.workStartedAt)).then(() => this.emitState())
      }
      this.phase = 'break'
    } else {
      this.phase = 'work'
      this.workStartedAt = this.now()
    }
    this.remainingSeconds = phaseSeconds(this.phase)
    this.emitState()
  }

  togglePause(): TimerState {
    const wasPaused = this.paused
    this.paused = !this.paused
    // Starting a fresh, never-yet-ticked work phase: stamp the real start
    // time now, not whenever the process happened to launch.
    if (wasPaused && !this.paused && isUnstartedWork(this.phase, this.remainingSeconds)) {
      this.workStartedAt = this.now()
    }
    this.emitState()
    return this.getState()
  }

  skipPhase(): TimerState {
    this.advancePhase(false)
    return this.getState()
  }

  // Restarts the current phase's countdown from the top (e.g. the user got
  // distracted mid-pomodoro and wants a fresh 25:00), without counting it as
  // a completed pomodoro, unlike skipPhase, which moves to the next phase.
  resetPhase(): TimerState {
    this.remainingSeconds = phaseSeconds(this.phase)
    if (this.phase === 'work') this.workStartedAt = this.now()
    this.emitState()
    return this.getState()
  }

  getState(): TimerState {
    return {
      phase: this.phase,
      remainingSeconds: this.remainingSeconds,
      paused: this.paused,
      counts: this.deps.getCounts()
    }
  }

  private emitState(): void {
    this.emit('state', this.getState())
  }
}
