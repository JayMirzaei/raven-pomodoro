import { createClient, isAuthRetryableFetchError, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { safeStorage } from 'electron'
import Store from 'electron-store'
import WebSocket from 'ws'
import { resolveSyncConfig } from '../core/config'

// The Supabase client and sign-in. Both exist only in a sync build; an
// offline build (no SUPABASE_URL / SUPABASE_ANON_KEY at build time) has no
// client, no sign-in window and no network traffic.

const syncConfig = resolveSyncConfig(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

/** True when this build was made with Supabase settings. */
export const syncEnabled = syncConfig !== null

interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Session tokens, encrypted with Electron's safeStorage (Keychain, DPAPI or
 * libsecret) when the OS offers it. Without a secret store (for example a
 * Linux desktop with no keyring) they are kept unencrypted, still local only.
 */
function createSessionStorage(): KeyValueStorage {
  const sessionStore = new Store<Record<string, string>>({ name: 'raven-session' })
  return {
    getItem(key) {
      const raw = sessionStore.get(key)
      if (!raw) return null
      if (!safeStorage.isEncryptionAvailable()) return raw
      try {
        return safeStorage.decryptString(Buffer.from(raw, 'base64'))
      } catch {
        return null // unreadable (e.g. keyring changed): treat as signed out
      }
    },
    setItem(key, value) {
      const stored = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value).toString('base64') : value
      sessionStore.set(key, stored)
    },
    removeItem(key) {
      sessionStore.delete(key)
    }
  }
}

/** The Supabase client, or null in an offline build. */
export const supabase: SupabaseClient | null = syncConfig
  ? createClient(syncConfig.url, syncConfig.anonKey, {
      auth: {
        storage: createSessionStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      // Realtime is not used, but supabase-js still builds a realtime client,
      // which throws without a WebSocket implementation; the Node bundled with
      // Electron may not have a global one, so `ws` is supplied.
      realtime: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: WebSocket as any
      }
    })
  : null

/** The saved session, or null when signed out or in an offline build. */
export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Signs in, or creates the account if the email is new. Password sign-in
 * sends no email, so the project needs "Confirm email" off for a new
 * account to be usable straight away (see the README).
 */
export async function signInOrSignUp(email: string, password: string): Promise<Session> {
  if (!supabase) throw new Error('Sync is not set up in this build.')

  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (!signIn.error) return signIn.data.session
  // A network failure is not a wrong password: do not try to sign up.
  if (isAuthRetryableFetchError(signIn.error)) {
    throw new Error('Could not reach the sync server. Check your connection and try again.')
  }

  const signUp = await supabase.auth.signUp({ email, password })
  if (signUp.error) throw signUp.error

  // Supabase answers a sign-up for an existing email with an empty identity
  // list instead of an error, so a wrong password looks like this.
  const alreadyRegistered = signUp.data.user?.identities?.length === 0
  if (alreadyRegistered || !signUp.data.session) {
    throw new Error('Incorrect password, or that email is already registered with a different password.')
  }
  return signUp.data.session
}
