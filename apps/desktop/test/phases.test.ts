import { describe, expect, it } from 'vitest'
import {
  BREAK_SECONDS,
  WORK_SECONDS,
  formatRemaining,
  isUnstartedWork,
  pauseActionLabel,
  remainingFraction
} from '../src/shared/phases'
import { readableIpcError } from '../src/shared/ipc'

describe('formatRemaining', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatRemaining(WORK_SECONDS)).toBe('25:00')
    expect(formatRemaining(BREAK_SECONDS)).toBe('5:00')
    expect(formatRemaining(61)).toBe('1:01')
    expect(formatRemaining(9)).toBe('0:09')
  })
})

describe('remainingFraction', () => {
  it('runs from 1 at the start of a phase to 0 at its end', () => {
    expect(remainingFraction({ phase: 'work', remainingSeconds: WORK_SECONDS })).toBe(1)
    expect(remainingFraction({ phase: 'break', remainingSeconds: BREAK_SECONDS / 2 })).toBe(0.5)
    expect(remainingFraction({ phase: 'work', remainingSeconds: 0 })).toBe(0)
  })
})

describe('isUnstartedWork and pauseActionLabel', () => {
  it('offers Start only at the top of a work phase', () => {
    expect(isUnstartedWork('work', WORK_SECONDS)).toBe(true)
    expect(isUnstartedWork('break', BREAK_SECONDS)).toBe(false)
    expect(pauseActionLabel({ phase: 'work', remainingSeconds: WORK_SECONDS, paused: true })).toBe('Start')
    expect(pauseActionLabel({ phase: 'work', remainingSeconds: 100, paused: true })).toBe('Resume')
    expect(pauseActionLabel({ phase: 'break', remainingSeconds: BREAK_SECONDS, paused: true })).toBe('Resume')
    expect(pauseActionLabel({ phase: 'work', remainingSeconds: 100, paused: false })).toBe('Pause')
  })
})

describe('readableIpcError', () => {
  it("drops the prefix Electron adds to a handler's error", () => {
    const error = new Error("Error invoking remote method 'auth:sign-in': Error: Incorrect password.")
    expect(readableIpcError(error, 'fallback')).toBe('Incorrect password.')
  })

  it('keeps a plain message and falls back when there is none', () => {
    expect(readableIpcError(new Error('Network down'), 'fallback')).toBe('Network down')
    expect(readableIpcError(undefined, 'fallback')).toBe('fallback')
  })
})
