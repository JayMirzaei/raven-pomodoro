import { describe, expect, it, vi } from 'vitest'
import { createSyncService, type LocalPomodoros, type SyncBackend } from '../src/core/sync'
import type { PomodoroRecord, PomodoroRow } from '../src/core/syncRows'

const LOCAL_COUNTS = { today: 1, week: 2, allTime: 3 }

function makeLocal(records: PomodoroRecord[]): LocalPomodoros & { records: PomodoroRecord[] } {
  return {
    records,
    unsynced: () => records.filter((r) => !r.synced),
    markSynced: (ids) => {
      for (const r of records) if (ids.includes(r.id)) r.synced = true
    },
    localCounts: () => LOCAL_COUNTS,
    deviceId: () => 'device-1'
  }
}

const record = (id: string, synced = false): PomodoroRecord => ({
  id,
  startedAt: '2026-03-18T09:00:00.000Z',
  completedAt: '2026-03-18T09:25:00.000Z',
  synced
})

function makeBackend(overrides: Partial<SyncBackend> = {}): SyncBackend & { inserted: PomodoroRow[][] } {
  const inserted: PomodoroRow[][] = []
  return {
    inserted,
    currentUserId: async () => 'user-1',
    insertPomodoros: async (rows) => {
      inserted.push(rows)
      return { error: null }
    },
    fetchCounts: async () => ({ data: [{ today_count: '4', week_count: 5, all_time_count: 6 }], error: null }),
    ...overrides
  }
}

const quiet = { log: () => {} }

describe('sync service, offline build (no backend)', () => {
  it('reports local counts and leaves records unsynced for a later sync build', async () => {
    const local = makeLocal([record('a')])
    const sync = createSyncService(null, local, quiet)
    expect(sync.cachedCounts()).toEqual(LOCAL_COUNTS)
    expect(await sync.refreshCounts()).toEqual(LOCAL_COUNTS)
    expect(local.records[0].synced).toBe(false)
  })
})

describe('sync service, sync build', () => {
  it('pushes only unsynced records as rows for the user and device, then uses the server counts', async () => {
    const local = makeLocal([record('a'), record('b', true)])
    const backend = makeBackend()
    const sync = createSyncService(backend, local, quiet)

    expect(await sync.refreshCounts()).toEqual({ today: 4, week: 5, allTime: 6 })
    expect(backend.inserted).toEqual([
      [
        {
          id: 'a',
          user_id: 'user-1',
          started_at: '2026-03-18T09:00:00.000Z',
          completed_at: '2026-03-18T09:25:00.000Z',
          device_id: 'device-1'
        }
      ]
    ])
    expect(local.records.every((r) => r.synced)).toBe(true)
    expect(sync.cachedCounts()).toEqual({ today: 4, week: 5, allTime: 6 })
  })

  it('does not call insert when nothing is pending', async () => {
    const backend = makeBackend()
    await createSyncService(backend, makeLocal([record('a', true)]), quiet).refreshCounts()
    expect(backend.inserted).toHaveLength(0)
  })

  it('keeps records unsynced when the push fails, and retries them next time', async () => {
    const local = makeLocal([record('a')])
    let fail = true
    const backend = makeBackend({
      insertPomodoros: async () => ({ error: fail ? new Error('offline') : null })
    })
    const sync = createSyncService(backend, local, quiet)
    await sync.refreshCounts()
    expect(local.records[0].synced).toBe(false)
    fail = false
    await sync.refreshCounts()
    expect(local.records[0].synced).toBe(true)
  })

  it('falls back to local counts when signed out, when counts fail, or when the backend throws', async () => {
    const signedOut = makeBackend({ currentUserId: async () => null })
    expect(await createSyncService(signedOut, makeLocal([record('a')]), quiet).refreshCounts()).toEqual(LOCAL_COUNTS)
    expect(signedOut.inserted).toHaveLength(0)

    const countsFail = makeBackend({ fetchCounts: async () => ({ data: null, error: new Error('500') }) })
    expect(await createSyncService(countsFail, makeLocal([]), quiet).refreshCounts()).toEqual(LOCAL_COUNTS)

    const throws = makeBackend({
      currentUserId: async () => {
        throw new Error('network')
      }
    })
    const log = vi.fn()
    expect(await createSyncService(throws, makeLocal([]), { log }).refreshCounts()).toEqual(LOCAL_COUNTS)
    expect(log).toHaveBeenCalledOnce()
  })

  it('asks for counts from local midnight and the start of the local week', async () => {
    const fetchCounts = vi.fn(async () => ({ data: [], error: null }))
    const now = () => new Date(2026, 2, 18, 15, 30) // Wednesday, local time
    await createSyncService(makeBackend({ fetchCounts }), makeLocal([]), { ...quiet, now }).refreshCounts()
    expect(fetchCounts).toHaveBeenCalledWith(new Date(2026, 2, 18), new Date(2026, 2, 15))
  })
})
