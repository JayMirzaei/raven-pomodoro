import Store from 'electron-store'
import { countCompletions } from '../core/counts'
import type { LocalPomodoros } from '../core/sync'
import type { PomodoroRecord } from '../core/syncRows'
import type { Counts } from '../shared/types'

// The app's local JSON store (in the OS's per-user app data folder). Every
// finished pomodoro lands here first, so the app works offline and a sync
// build can upload later. The file name is kept stable so existing installs
// keep their data across updates.

interface RavenStoreSchema {
  windowPosition: { x: number; y: number } | null
  pomodoros: PomodoroRecord[]
  autoLaunchEnabled: boolean
  deviceId: string
}

export const store = new Store<RavenStoreSchema>({
  name: 'raven-data',
  defaults: {
    windowPosition: null,
    pomodoros: [],
    autoLaunchEnabled: true,
    deviceId: ''
  }
})

/** A random id for this install, sent with each synced row; it says nothing about the machine. */
export function getOrCreateDeviceId(): string {
  const existing = store.get('deviceId')
  if (existing) return existing
  const id = crypto.randomUUID()
  store.set('deviceId', id)
  return id
}

export function addCompletedPomodoro(startedAt: Date): PomodoroRecord {
  const record: PomodoroRecord = {
    id: crypto.randomUUID(),
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    synced: false
  }
  const pomodoros = store.get('pomodoros')
  pomodoros.push(record)
  store.set('pomodoros', pomodoros)
  return record
}

export function getUnsyncedPomodoros(): PomodoroRecord[] {
  return store.get('pomodoros').filter((p) => !p.synced)
}

export function markPomodorosSynced(ids: string[]): void {
  const idSet = new Set(ids)
  const updated = store.get('pomodoros').map((p) => (idSet.has(p.id) ? { ...p, synced: true } : p))
  store.set('pomodoros', updated)
}

export function getLocalCounts(): Counts {
  return countCompletions(
    store.get('pomodoros').map((p) => p.completedAt),
    new Date()
  )
}

/** The store as the sync service sees it. */
export const localPomodoros: LocalPomodoros = {
  unsynced: getUnsyncedPomodoros,
  markSynced: markPomodorosSynced,
  localCounts: getLocalCounts,
  deviceId: getOrCreateDeviceId
}
