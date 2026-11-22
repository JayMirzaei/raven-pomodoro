import { ipcMain, screen, type BrowserWindow } from 'electron'
import { timer } from './timer'
import { persistWindowPosition } from './window'
import { signInOrSignUp } from './auth'
import { dragTarget, type Point } from '../core/geometry'
import { IpcChannel, type SignInRequest } from '../shared/ipc'

/** Handles the sign-in window's request; `onSignedIn` swaps it for the widget. */
export function registerAuthIpcHandlers(onSignedIn: () => Promise<void>): void {
  ipcMain.handle(IpcChannel.SignIn, async (_event, { email, password }: SignInRequest) => {
    await signInOrSignUp(email, password)
    await onSignedIn()
  })
}

/** Timer actions, state pushes and dragging for the widget window. */
export function registerWidgetIpcHandlers(widgetWindow: BrowserWindow): void {
  ipcMain.handle(IpcChannel.GetState, () => timer.getState())
  ipcMain.handle(IpcChannel.TogglePause, () => timer.togglePause())
  ipcMain.handle(IpcChannel.SkipPhase, () => timer.skipPhase())

  timer.on('state', (state) => {
    if (!widgetWindow.isDestroyed()) widgetWindow.webContents.send(IpcChannel.State, state)
  })

  registerDragHandlers(widgetWindow)
}

// The widget is moved by hand rather than with a CSS drag region
// (-webkit-app-region: drag), because a drag region swallows the clicks that
// start and pause the timer on a window this small. The renderer only says
// when a drag starts, moves and ends; the cursor is read here.
function registerDragHandlers(widgetWindow: BrowserWindow): void {
  let start: { window: Point; cursor: Point } | null = null

  ipcMain.on(IpcChannel.DragStart, () => {
    const [x, y] = widgetWindow.getPosition()
    start = { window: { x, y }, cursor: screen.getCursorScreenPoint() }
  })

  ipcMain.on(IpcChannel.DragMove, () => {
    if (!start) return
    const target = dragTarget(start.window, start.cursor, screen.getCursorScreenPoint())
    widgetWindow.setPosition(target.x, target.y, false)
  })

  ipcMain.on(IpcChannel.DragEnd, () => {
    start = null
    persistWindowPosition(widgetWindow)
  })
}
