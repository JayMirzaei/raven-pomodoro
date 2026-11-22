import { describe, expect, it } from 'vitest'
import { resolveSyncConfig, startScreen } from '../src/core/config'

describe('resolveSyncConfig', () => {
  it('is null (offline build) when neither value is set', () => {
    expect(resolveSyncConfig(undefined, undefined)).toBeNull()
    expect(resolveSyncConfig('', '  ')).toBeNull()
  })

  it('returns both values, trimmed, when both are set', () => {
    expect(resolveSyncConfig(' https://abc.supabase.co ', ' key ')).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'key'
    })
  })

  it('refuses a half-configured build', () => {
    expect(() => resolveSyncConfig('https://abc.supabase.co', '')).toThrow(/both/)
    expect(() => resolveSyncConfig('', 'key')).toThrow(/both/)
  })

  it('refuses a URL that is not http(s)', () => {
    expect(() => resolveSyncConfig('abc.supabase.co', 'key')).toThrow(/http/)
  })

  it('refuses the example URL left in place', () => {
    expect(() => resolveSyncConfig('https://your-project-ref.supabase.co', 'key')).toThrow(/example/)
  })
})

describe('startScreen', () => {
  it('opens the widget in an offline build, with or without a stale session', () => {
    expect(startScreen(false, false)).toBe('widget')
    expect(startScreen(false, true)).toBe('widget')
  })

  it('asks a sync build to sign in only when there is no session', () => {
    expect(startScreen(true, false)).toBe('sign-in')
    expect(startScreen(true, true)).toBe('widget')
  })
})
