import { describe, expect, it } from 'vitest'
import { countCompletions, startOfLocalDay, startOfLocalWeek } from '../src/core/counts'

// Dates are built from local-time parts, so the tests hold in any time zone.
const local = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min)

describe('startOfLocalDay', () => {
  it('drops the time of day', () => {
    expect(startOfLocalDay(local(2026, 3, 18, 15, 42))).toEqual(local(2026, 3, 18))
  })
})

describe('startOfLocalWeek', () => {
  it('goes back to the previous Sunday', () => {
    // 2026-03-18 is a Wednesday.
    expect(startOfLocalWeek(local(2026, 3, 18, 9))).toEqual(local(2026, 3, 15))
  })

  it('is the same day on a Sunday', () => {
    expect(startOfLocalWeek(local(2026, 3, 15, 23, 59))).toEqual(local(2026, 3, 15))
  })

  it('crosses a month boundary', () => {
    // 2026-04-01 is a Wednesday; its week starts on Sunday 2026-03-29.
    expect(startOfLocalWeek(local(2026, 4, 1))).toEqual(local(2026, 3, 29))
  })
})

describe('countCompletions', () => {
  const now = local(2026, 3, 18, 12) // Wednesday noon

  it('counts nothing for an empty log', () => {
    expect(countCompletions([], now)).toEqual({ today: 0, week: 0, allTime: 0 })
  })

  it('splits completions into today, this week and all time', () => {
    const log = [
      local(2026, 3, 18, 9), // today
      local(2026, 3, 18, 0, 0), // today, at midnight exactly
      local(2026, 3, 17, 23, 59), // yesterday, same week
      local(2026, 3, 15, 0, 0), // Sunday: first moment of this week
      local(2026, 3, 14, 23, 59), // Saturday: last week
      local(2025, 12, 31, 10) // last year
    ].map((d) => d.toISOString())

    expect(countCompletions(log, now)).toEqual({ today: 2, week: 4, allTime: 6 })
  })
})
