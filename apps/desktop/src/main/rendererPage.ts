import { is } from '@electron-toolkit/utils'
import type { BrowserWindow, WebPreferences } from 'electron'
import { join } from 'path'

/** Settings shared by every window: the preload bridge, no Node in the page. */
export const secureWebPreferences: WebPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false
}

/** Loads a renderer page from the dev server in development, from disk in a build. */
export function loadRendererPage(win: BrowserWindow, page: 'widget' | 'login'): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devServer) {
    void win.loadURL(`${devServer}/${page}/index.html`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}/index.html`))
  }
}
