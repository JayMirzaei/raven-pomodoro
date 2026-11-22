import { BrowserWindow, screen } from 'electron'
import { store } from './store'
import { clampToArea, defaultPosition } from '../core/geometry'
import { loadRendererPage, secureWebPreferences } from './rendererPage'

const WIDGET_SIZE = 192
const MARGIN = 24

/** The always-on-top, frameless, transparent widget, at its saved position. */
export function createWidgetWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()
  const position = clampToArea(
    store.get('windowPosition') ?? defaultPosition(workArea, WIDGET_SIZE, MARGIN),
    workArea,
    WIDGET_SIZE
  )

  const win = new BrowserWindow({
    width: WIDGET_SIZE,
    height: WIDGET_SIZE,
    x: position.x,
    y: position.y,
    minWidth: WIDGET_SIZE,
    minHeight: WIDGET_SIZE,
    maxWidth: WIDGET_SIZE,
    maxHeight: WIDGET_SIZE,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false, // moved by hand instead, see ipc.ts
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: secureWebPreferences
  })

  // 'screen-saver' keeps it above full-screen apps and most panels.
  win.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  loadRendererPage(win, 'widget')
  win.once('ready-to-show', () => win.showInactive()) // never steal focus

  return win
}

export function persistWindowPosition(win: BrowserWindow): void {
  const [x, y] = win.getPosition()
  store.set('windowPosition', { x, y })
}
