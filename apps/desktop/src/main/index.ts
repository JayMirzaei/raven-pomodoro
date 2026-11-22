import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWidgetWindow } from './window'
import { createLoginWindow } from './loginWindow'
import { createTray } from './tray'
import { registerWidgetIpcHandlers, registerAuthIpcHandlers } from './ipc'
import { setupAutoLaunch } from './autolaunch'
import { getSession, syncEnabled } from './auth'
import { startBackgroundSync } from './sync'
import { startScreen } from '../core/config'
import './timer' // starts the pomodoro clock as soon as the app boots

// Kept unchanged from earlier releases so installed copies keep their
// Windows taskbar grouping and data folder.
const APP_USER_MODEL_ID = 'com.raven.app'

/** Opens the widget and starts everything that runs for the app's lifetime. */
async function launchWidget(): Promise<void> {
  const widgetWindow = createWidgetWindow()
  registerWidgetIpcHandlers(widgetWindow)
  createTray()
  await setupAutoLaunch()
  startBackgroundSync()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWidgetWindow()
  })
}

/**
 * Shows the sign-in window. Signing in swaps it for the widget; closing it
 * without signing in quits, since there is no tray icon yet to quit from.
 */
function showSignIn(): void {
  const loginWindow = createLoginWindow()
  let signedIn = false
  loginWindow.on('closed', () => {
    if (!signedIn) app.quit()
  })
  registerAuthIpcHandlers(async () => {
    signedIn = true
    loginWindow.close()
    await launchWidget()
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_USER_MODEL_ID)
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const hasSession = (await getSession()) !== null
  if (startScreen(syncEnabled, hasSession) === 'sign-in') {
    showSignIn()
  } else {
    await launchWidget()
  }
})

// The app lives in the tray, so closing its last window must not quit it.
// (The Linux --no-sandbox flag cannot be set here: Chromium decides on its
// sandbox before this code runs. autolaunch.ts puts it in the autostart
// entry instead.)
app.on('window-all-closed', () => {})
