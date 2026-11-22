// Decides whether this build syncs. Sync is optional: a build made without
// Supabase settings is a complete offline app that keeps its counts on the
// machine. The values are compiled in by electron.vite.config.ts, which uses
// the same check so a half-configured build fails at build time, not later.

export interface SyncConfig {
  url: string
  anonKey: string
}

/**
 * Returns the sync settings, or null when both are empty (offline build).
 * Throws when only one is set or the URL is not an http(s) URL, because that
 * is a mistake, not a choice.
 */
export function resolveSyncConfig(url: string | undefined, anonKey: string | undefined): SyncConfig | null {
  const cleanUrl = (url ?? '').trim()
  const cleanKey = (anonKey ?? '').trim()
  if (!cleanUrl && !cleanKey) return null
  if (!cleanUrl || !cleanKey) {
    throw new Error('Set both SUPABASE_URL and SUPABASE_ANON_KEY to enable sync, or neither for an offline build.')
  }
  if (cleanUrl.includes('your-project-ref')) {
    throw new Error('SUPABASE_URL is still the example value; put your own project URL in apps/desktop/.env.')
  }
  if (!/^https?:\/\/[^/\s]+/.test(cleanUrl)) {
    throw new Error('SUPABASE_URL must be an http(s) URL, such as https://<project-ref>.supabase.co.')
  }
  return { url: cleanUrl, anonKey: cleanKey }
}

/** Which window the app opens with. */
export type StartScreen = 'widget' | 'sign-in'

/** An offline build, or a signed-in sync build, goes straight to the widget. */
export function startScreen(syncEnabled: boolean, hasSession: boolean): StartScreen {
  return syncEnabled && !hasSession ? 'sign-in' : 'widget'
}
