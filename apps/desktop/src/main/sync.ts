import { getSession, supabase } from './auth'
import { localPomodoros } from './store'
import { createSyncService, type SyncBackend } from '../core/sync'

// Wires the sync loop (src/core/sync.ts) to supabase-js and the local store.

function supabaseBackend(): SyncBackend | null {
  const client = supabase
  if (!client) return null
  return {
    async currentUserId() {
      return (await getSession())?.user.id ?? null
    },
    async insertPomodoros(rows) {
      // ignoreDuplicates makes this INSERT ... ON CONFLICT DO NOTHING. A plain
      // upsert would UPDATE a row that already arrived (an earlier push whose
      // response was lost); Row Level Security has no update policy, so that
      // would fail and block every later push from this device.
      return client.from('pomodoros').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    },
    async fetchCounts(todayStart, weekStart) {
      return client.rpc('pomodoro_counts', {
        today_start: todayStart.toISOString(),
        week_start: weekStart.toISOString()
      })
    }
  }
}

const sync = createSyncService(supabaseBackend(), localPomodoros)

export const refreshCounts = sync.refreshCounts
export const getCachedCounts = sync.cachedCounts

/** Refreshes now and then every `intervalMs`, which also rolls "today" over at midnight. */
export function startBackgroundSync(intervalMs = 60_000): void {
  void refreshCounts()
  setInterval(() => void refreshCounts(), intervalMs)
}
