import type { RavenApi } from '../shared/ipc'

// Declared once for both pages; the object itself comes from src/preload.
declare global {
  interface Window {
    raven: RavenApi
  }
}

export {}
