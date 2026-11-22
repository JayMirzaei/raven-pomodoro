import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, type RavenApi, type SignInRequest } from '../shared/ipc'
import type { TimerState } from '../shared/types'

// The renderers run with context isolation and without Node; this object is
// all they can reach. Each method maps to exactly one channel in shared/ipc.ts.
const api: RavenApi = {
  getState: () => ipcRenderer.invoke(IpcChannel.GetState),
  togglePause: () => ipcRenderer.invoke(IpcChannel.TogglePause),
  skipPhase: () => ipcRenderer.invoke(IpcChannel.SkipPhase),
  onState: (callback) => {
    const listener = (_event: IpcRendererEvent, state: TimerState): void => callback(state)
    ipcRenderer.on(IpcChannel.State, listener)
    return () => ipcRenderer.removeListener(IpcChannel.State, listener)
  },
  dragStart: () => ipcRenderer.send(IpcChannel.DragStart),
  dragMove: () => ipcRenderer.send(IpcChannel.DragMove),
  dragEnd: () => ipcRenderer.send(IpcChannel.DragEnd),
  signIn: (email, password) => {
    const request: SignInRequest = { email, password }
    return ipcRenderer.invoke(IpcChannel.SignIn, request)
  }
}

contextBridge.exposeInMainWorld('raven', api)
