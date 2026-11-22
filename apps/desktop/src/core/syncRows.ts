import type { Counts } from '../shared/types'

/** A finished pomodoro as kept in the local store. */
export interface PomodoroRecord {
  id: string
  startedAt: string // ISO timestamp
  completedAt: string // ISO timestamp
  synced: boolean
}

/** A row of `public.pomodoros` as the client inserts it (see supabase/migrations). */
export interface PomodoroRow {
  id: string
  user_id: string
  started_at: string
  completed_at: string
  device_id: string
}

/** What `pomodoro_counts()` returns; Postgres bigints may arrive as strings. */
export interface CountsRow {
  today_count: number | string
  week_count: number | string
  all_time_count: number | string
}

/** Maps local records to database rows for one user and device. */
export function toPomodoroRows(records: PomodoroRecord[], userId: string, deviceId: string): PomodoroRow[] {
  return records.map((record) => ({
    id: record.id,
    user_id: userId,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    device_id: deviceId
  }))
}

/** Reads the single row `pomodoro_counts()` returns, or null if there is none. */
export function parseCountsRow(data: unknown): Counts | null {
  if (!Array.isArray(data) || data.length === 0 || !data[0]) return null
  const row = data[0] as CountsRow
  return {
    today: Number(row.today_count),
    week: Number(row.week_count),
    allTime: Number(row.all_time_count)
  }
}
