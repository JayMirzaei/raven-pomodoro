import type { Counts } from '../shared/types'

// Pure date and counting helpers, kept free of Electron imports so they can
// be unit-tested. "Today" and "this week" use the machine's local clock;
// weeks start on Sunday.

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function startOfLocalWeek(d: Date): Date {
  const start = startOfLocalDay(d)
  start.setDate(start.getDate() - start.getDay()) // getDay(): 0 = Sunday
  return start
}

/** Counts completions for today, this week and all time, relative to `now`. */
export function countCompletions(completedAt: Iterable<string>, now: Date): Counts {
  const todayStart = startOfLocalDay(now)
  const weekStart = startOfLocalWeek(now)

  let today = 0
  let week = 0
  let allTime = 0
  for (const iso of completedAt) {
    const completed = new Date(iso)
    allTime++
    if (completed >= weekStart) week++
    if (completed >= todayStart) today++
  }
  return { today, week, allTime }
}
