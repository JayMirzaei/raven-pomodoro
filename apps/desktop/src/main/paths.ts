import { app } from 'electron'
import { join } from 'path'

// In dev, assets live under src/assets relative to the compiled main
// process (out/main/index.js). In a packaged app they're copied to
// resources/assets instead (see electron-builder.yml's extraResources),
// deliberately unpacked outside the asar archive so OS-level APIs like the
// Linux tray icon can read them as real files on disk.
export function assetPath(...segments: string[]): string {
  const base = app.isPackaged ? join(process.resourcesPath, 'assets') : join(__dirname, '../../src/assets')
  return join(base, ...segments)
}
