import { Tray, Menu, app, type MenuItemConstructorOptions } from 'electron'
import { timer } from './timer'
import { syncEnabled } from './auth'
import { assetPath } from './paths'
import { pauseActionLabel, formatRemaining, phaseSeconds } from '../shared/phases'
import type { TimerState } from '../shared/types'

let tray: Tray | null = null

/** The tray icon and its menu, rebuilt on every timer state change. */
export function createTray(): Tray {
  tray = new Tray(assetPath('icons/tray-icon.png'))
  tray.setToolTip('Raven')
  rebuildMenu()
  timer.on('state', rebuildMenu)
  return tray
}

/** The tray menu for a given timer state. */
function menuTemplate(state: TimerState): MenuItemConstructorOptions[] {
  const { counts } = state
  return [
    { label: 'Pomodoros', enabled: false },
    { label: `Today: ${counts.today}`, enabled: false },
    { label: `This week: ${counts.week}`, enabled: false },
    { label: `All-time: ${counts.allTime}`, enabled: false },
    ...(syncEnabled ? [] : [{ label: 'Offline: counts stay on this computer', enabled: false }]),
    { type: 'separator' },
    { label: pauseActionLabel(state), click: () => timer.togglePause() },
    { label: 'Skip phase', click: () => timer.skipPhase() },
    { label: `Reset ${formatRemaining(phaseSeconds(state.phase))} timer`, click: () => timer.resetPhase() },
    { type: 'separator' },
    { label: 'Quit Raven', click: () => app.quit() }
  ]
}

function rebuildMenu(): void {
  tray?.setContextMenu(Menu.buildFromTemplate(menuTemplate(timer.getState())))
}
