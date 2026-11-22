import { formatRemaining, remainingFraction } from '../../shared/phases'
import type { TimerState } from '../../shared/types'

// The widget page: draws the timer state pushed by the main process, and
// turns a short press into start/pause and a longer one into a drag.

const ravenEl = document.getElementById('raven') as HTMLDivElement
const timeEl = document.getElementById('time') as HTMLDivElement
const statsEl = document.getElementById('stats') as HTMLDivElement
const ringProgress = document.getElementById('ring-progress') as unknown as SVGCircleElement

const RING_CIRCUMFERENCE = 364.42 // 2 * pi * r, with r = 58 as in index.html
const DRAG_THRESHOLD_PX = 4

function render(state: TimerState): void {
  timeEl.textContent = formatRemaining(state.remainingSeconds)
  statsEl.textContent = `${state.counts.today} today`
  ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - remainingFraction(state)))

  const phaseClass = state.paused ? 'phase-paused' : state.phase === 'work' ? 'phase-work' : 'phase-break'
  ravenEl.className = `raven ${phaseClass}`
}

void window.raven.getState().then(render)
window.raven.onState(render)

// A press that moves at most DRAG_THRESHOLD_PX is a click (start or pause);
// more is a drag, and the main process moves the window (see main/ipc.ts).
let pointerDown = false
let startX = 0
let startY = 0
let moved = 0

ravenEl.addEventListener('mousedown', (e) => {
  pointerDown = true
  moved = 0
  startX = e.screenX
  startY = e.screenY
  window.raven.dragStart()
})

window.addEventListener('mousemove', (e) => {
  if (!pointerDown) return
  moved = Math.max(moved, Math.abs(e.screenX - startX), Math.abs(e.screenY - startY))
  if (moved > DRAG_THRESHOLD_PX) window.raven.dragMove()
})

window.addEventListener('mouseup', () => {
  if (!pointerDown) return
  pointerDown = false
  window.raven.dragEnd()
  if (moved <= DRAG_THRESHOLD_PX) void window.raven.togglePause()
})
