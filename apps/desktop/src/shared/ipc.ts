import type { TimerState } from './types'

/**
 * The IPC contract between the main process and the renderers, in one place.
 * The preload script and the main-process handlers both import these names
 * and payload types, so a renamed channel or a changed payload fails the
 * type-check instead of failing silently at runtime.
 */
export const IpcChannel = {
  /** invoke -> TimerState */
  GetState: 'timer:get-state',
  /** invoke -> TimerState */
  TogglePause: 'timer:toggle-pause',
  /** invoke -> TimerState */
  SkipPhase: 'timer:skip-phase',
  /** main -> renderer push, payload TimerState */
  State: 'timer:state',
  /** send, no payload: the pointer went down on the widget */
  DragStart: 'drag:start',
  /** send, no payload: the pointer moved past the drag threshold */
  DragMove: 'drag:move',
  /** send, no payload: the pointer was released */
  DragEnd: 'drag:end',
  /** invoke with SignInRequest -> void; rejects with a readable message */
  SignIn: 'auth:sign-in'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

export interface SignInRequest {
  email: string
  password: string
}

/**
 * What the preload script exposes to the renderers as `window.raven`. This is
 * the renderers' only way to reach the main process.
 */
export interface RavenApi {
  getState(): Promise<TimerState>
  togglePause(): Promise<TimerState>
  skipPhase(): Promise<TimerState>
  /** Subscribes to state pushes; returns a function that unsubscribes. */
  onState(callback: (state: TimerState) => void): () => void
  dragStart(): void
  dragMove(): void
  dragEnd(): void
  signIn(email: string, password: string): Promise<void>
}

/**
 * The message of an error thrown by a main-process handler, without the
 * "Error invoking remote method '...': Error: " prefix Electron adds when it
 * passes the error to the renderer.
 */
export function readableIpcError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const stripped = message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '').trim()
  return stripped || fallback
}
