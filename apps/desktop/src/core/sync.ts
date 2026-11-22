import { startOfLocalDay, startOfLocalWeek } from './counts'
import { parseCountsRow, toPomodoroRows, type PomodoroRecord, type PomodoroRow } from './syncRows'
import type { Counts } from '../shared/types'

/** The remote side of sync. src/main/sync.ts implements it with supabase-js. */
export interface SyncBackend {
  /** The signed-in user's id, or null when signed out. */
  currentUserId(): Promise<string | null>
  /** Inserts rows, skipping ids that already exist (ON CONFLICT DO NOTHING). */
  insertPomodoros(rows: PomodoroRow[]): Promise<{ error: unknown }>
  /** Calls pomodoro_counts(today_start, week_start). */
  fetchCounts(todayStart: Date, weekStart: Date): Promise<{ data: unknown; error: unknown }>
}

/** The local side of sync. src/main/store.ts implements it with electron-store. */
export interface LocalPomodoros {
  unsynced(): PomodoroRecord[]
  markSynced(ids: string[]): void
  localCounts(): Counts
  deviceId(): string
}

export interface SyncService {
  /** Pushes what is unsynced, then returns the best counts available. Never throws. */
  refreshCounts(): Promise<Counts>
  /** The counts from the last refresh (local counts before the first one). */
  cachedCounts(): Counts
}

type Logger = (message: string, error: unknown) => void

/**
 * Builds the sync loop. With `backend` null (an offline build) every refresh
 * just recounts the local store. With a backend, failures are logged and
 * fall back to local counts; unsynced rows stay unsynced and are retried on
 * the next refresh, so a lost connection never loses a pomodoro.
 */
export function createSyncService(
  backend: SyncBackend | null,
  local: LocalPomodoros,
  options: { now?: () => Date; log?: Logger } = {}
): SyncService {
  const now = options.now ?? (() => new Date())
  const log: Logger = options.log ?? ((message, error) => console.error(`pomodoro sync: ${message}`, error))
  let cached = local.localCounts()

  async function pushUnsynced(remote: SyncBackend, userId: string): Promise<void> {
    const pending = local.unsynced()
    if (pending.length === 0) return
    const { error } = await remote.insertPomodoros(toPomodoroRows(pending, userId, local.deviceId()))
    if (error) {
      log('push failed, will retry', error)
      return
    }
    local.markSynced(pending.map((record) => record.id))
  }

  async function fetchServerCounts(remote: SyncBackend): Promise<Counts | null> {
    const at = now()
    const { data, error } = await remote.fetchCounts(startOfLocalDay(at), startOfLocalWeek(at))
    if (error) {
      log('fetching counts failed', error)
      return null
    }
    return parseCountsRow(data)
  }

  async function serverCounts(): Promise<Counts | null> {
    if (!backend) return null
    try {
      const userId = await backend.currentUserId()
      if (!userId) return null
      await pushUnsynced(backend, userId)
      return await fetchServerCounts(backend)
    } catch (error) {
      log('sync failed', error)
      return null
    }
  }

  return {
    async refreshCounts() {
      cached = (await serverCounts()) ?? local.localCounts()
      return cached
    },
    cachedCounts: () => cached
  }
}
