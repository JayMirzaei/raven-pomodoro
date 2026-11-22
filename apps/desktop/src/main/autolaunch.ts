import { app } from 'electron'
import AutoLaunch from 'auto-launch'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { basename, join } from 'path'
import { store } from './store'

const AUTOSTART_DIR = join(homedir(), '.config', 'autostart')
const LINUX_DESKTOP_FILE = join(AUTOSTART_DIR, 'raven.desktop')

function linuxDesktopEntry(exePath: string): string {
  // --no-sandbox must be real argv, not something we can add later via
  // app.commandLine.appendSwitch() in our own JS: Chromium's zygote/sandbox
  // decision on Linux happens before our code runs at all, so appending the
  // switch from inside the app does nothing (verified -- it still crashed).
  // AppImages also have no install step to fix chrome-sandbox's
  // ownership/setuid bit, and each launch re-mounts it at a fresh temp path
  // anyway, so there's nothing stable to chmod once. Hence --no-sandbox
  // baked into the autostart entry's Exec line itself.
  return `[Desktop Entry]
Type=Application
Version=1.0
Name=Raven
Comment=Raven pomodoro widget
Exec="${exePath}" --no-sandbox
StartupNotify=false
Terminal=false
X-GNOME-Autostart-enabled=true
`
}

function setupLinuxAutoLaunch(exePath: string, shouldBeEnabled: boolean): void {
  // Clean up the file `auto-launch` itself would have created (named after
  // the binary, e.g. "Raven-0.0.1.AppImage.desktop") from before this fix --
  // it has no --no-sandbox and would fight with our own entry, and its
  // version-suffixed name means every rebuild leaves a new stale copy.
  const staleFile = join(AUTOSTART_DIR, `${basename(exePath)}.desktop`)
  if (existsSync(staleFile)) unlinkSync(staleFile)

  if (!shouldBeEnabled) {
    if (existsSync(LINUX_DESKTOP_FILE)) unlinkSync(LINUX_DESKTOP_FILE)
    return
  }

  mkdirSync(AUTOSTART_DIR, { recursive: true })
  writeFileSync(LINUX_DESKTOP_FILE, linuxDesktopEntry(exePath))
}

export async function setupAutoLaunch(): Promise<void> {
  // Only meaningful against a real installed build -- in a dev checkout
  // app.getPath('exe') points at the generic Electron binary, not Raven.
  if (!app.isPackaged) return

  // On Linux, running as an AppImage, app.getPath('exe') resolves to a
  // temporary extraction/mount path that won't exist on the next run --
  // the AppImage runtime sets APPIMAGE to the real, stable .AppImage file
  // path, which is what autostart needs to point at instead.
  const exePath = process.env.APPIMAGE ?? app.getPath('exe')
  const shouldBeEnabled = store.get('autoLaunchEnabled')

  if (process.platform === 'linux') {
    setupLinuxAutoLaunch(exePath, shouldBeEnabled)
    return
  }

  const launcher = new AutoLaunch({ name: 'Raven', path: exePath })
  const isEnabled = await launcher.isEnabled()

  if (shouldBeEnabled && !isEnabled) await launcher.enable()
  if (!shouldBeEnabled && isEnabled) await launcher.disable()
}
