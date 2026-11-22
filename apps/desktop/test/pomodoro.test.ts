import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PomodoroTimer } from '../src/core/pomodoro'
import { BREAK_SECONDS, WORK_SECONDS, phaseSeconds } from '../src/shared/phases'
import type { TimerState } from '../src/shared/types'

function makeTimer() {
  const completed: Date[] = []
  const timer = new PomodoroTimer({
    onWorkCompleted: (startedAt) => {
      completed.push(startedAt)
    },
    getCounts: () => ({ today: completed.length, week: completed.length, allTime: completed.length })
  })
  const states: TimerState[] = []
  timer.on('state', (s: TimerState) => states.push(s))
  return { timer, completed, states }
}

function tickN(timer: PomodoroTimer, n: number): void {
  for (let i = 0; i < n; i++) timer.tick()
}

describe('phaseSeconds', () => {
  it('is 25 minutes of work and 5 of break', () => {
    expect(phaseSeconds('work')).toBe(25 * 60)
    expect(phaseSeconds('break')).toBe(5 * 60)
  })
})

describe('PomodoroTimer', () => {
  it('starts paused at the top of a work phase', () => {
    const { timer } = makeTimer()
    expect(timer.getState()).toMatchObject({ phase: 'work', remainingSeconds: WORK_SECONDS, paused: true })
  })

  it('does not count down while paused', () => {
    const { timer, states } = makeTimer()
    tickN(timer, 10)
    expect(timer.getState().remainingSeconds).toBe(WORK_SECONDS)
    expect(states).toHaveLength(0)
  })

  it('counts down once started and emits each second', () => {
    const { timer, states } = makeTimer()
    timer.togglePause()
    tickN(timer, 3)
    expect(timer.getState()).toMatchObject({ remainingSeconds: WORK_SECONDS - 3, paused: false })
    expect(states).toHaveLength(4) // the toggle plus three ticks
  })

  it('records a pomodoro when a work phase runs its full length, then starts the break', async () => {
    const { timer, completed } = makeTimer()
    timer.togglePause()
    tickN(timer, WORK_SECONDS)
    expect(completed).toHaveLength(1)
    expect(timer.getState()).toMatchObject({ phase: 'break', remainingSeconds: BREAK_SECONDS, paused: false })
  })

  it('goes back to work after the break, without recording another pomodoro', () => {
    const { timer, completed } = makeTimer()
    timer.togglePause()
    tickN(timer, WORK_SECONDS + BREAK_SECONDS)
    expect(completed).toHaveLength(1)
    expect(timer.getState()).toMatchObject({ phase: 'work', remainingSeconds: WORK_SECONDS })
  })

  it('does not count a skipped work phase', () => {
    const { timer, completed } = makeTimer()
    timer.togglePause()
    tickN(timer, 60)
    timer.skipPhase()
    expect(completed).toHaveLength(0)
    expect(timer.getState().phase).toBe('break')
  })

  it('reset restarts the current phase without changing it or counting it', () => {
    const { timer, completed } = makeTimer()
    timer.togglePause()
    tickN(timer, WORK_SECONDS + 30) // 30 s into the break
    timer.resetPhase()
    expect(timer.getState()).toMatchObject({ phase: 'break', remainingSeconds: BREAK_SECONDS })
    expect(completed).toHaveLength(1)
  })

  it('re-emits state once the completion handler settles, so new counts reach the widget', async () => {
    const { timer, states } = makeTimer()
    timer.togglePause()
    tickN(timer, WORK_SECONDS)
    const before = states.length
    await Promise.resolve()
    await Promise.resolve()
    expect(states.length).toBe(before + 1)
    expect(states.at(-1)?.counts.today).toBe(1)
  })

  describe('start time of a pomodoro', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('is stamped when the user first starts the phase, not when the app launched', () => {
      vi.setSystemTime(new Date('2026-03-18T08:00:00Z'))
      const { timer, completed } = makeTimer()
      vi.setSystemTime(new Date('2026-03-18T09:00:00Z'))
      timer.togglePause()
      tickN(timer, WORK_SECONDS)
      expect(completed[0]).toEqual(new Date('2026-03-18T09:00:00Z'))
    })

    it('keeps the original start time across a pause and resume', () => {
      vi.setSystemTime(new Date('2026-03-18T09:00:00Z'))
      const { timer, completed } = makeTimer()
      timer.togglePause()
      tickN(timer, 60)
      timer.togglePause()
      vi.setSystemTime(new Date('2026-03-18T09:30:00Z'))
      timer.togglePause()
      tickN(timer, WORK_SECONDS - 60)
      expect(completed[0]).toEqual(new Date('2026-03-18T09:00:00Z'))
    })

    it('start() drives the countdown from a one-second interval', () => {
      const { timer } = makeTimer()
      timer.start()
      timer.togglePause()
      vi.advanceTimersByTime(5000)
      expect(timer.getState().remainingSeconds).toBe(WORK_SECONDS - 5)
      timer.stop()
      vi.advanceTimersByTime(5000)
      expect(timer.getState().remainingSeconds).toBe(WORK_SECONDS - 5)
    })
  })
})
