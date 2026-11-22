import { PomodoroTimer } from '../core/pomodoro'
import { addCompletedPomodoro } from './store'
import { getCachedCounts, refreshCounts } from './sync'

/** The app's single timer: completed pomodoros go to the local store, then sync. */
export const timer = new PomodoroTimer({
  onWorkCompleted(startedAt) {
    addCompletedPomodoro(startedAt)
    return refreshCounts()
  },
  getCounts: getCachedCounts
})

timer.start()
