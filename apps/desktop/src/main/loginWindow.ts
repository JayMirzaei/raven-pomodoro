import { BrowserWindow } from 'electron'
import { loadRendererPage, secureWebPreferences } from './rendererPage'

/** The email and password window, shown only in a sync build with no saved session. */
export function createLoginWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Sign in to Raven',
    webPreferences: secureWebPreferences
  })
  loadRendererPage(win, 'login')
  return win
}
