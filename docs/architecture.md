# Architecture

Raven Pomodoro is an Electron desktop widget. On its own it is a complete offline app. Optionally,
when built with Supabase settings, it syncs with a Supabase project (Postgres with Row Level
Security, and Supabase Auth).

```
 desktop (per machine)                                   Supabase (sync builds only)
 +-----------------------------------------------+      +----------------------+
 | renderer: widget, login (login: sync only)    |      | auth (email+password)|
 |   window.raven  <- preload bridge             |      | public.pomodoros     |
 |        | typed IPC (shared/ipc.ts)            |      |   RLS: own rows only |
 | main:  timer -> store -> sync ----------------+----->| pomodoro_counts()    |
 |        tray, windows, autostart, auth         |      +----------------------+
 | core:  pure logic the main process wires up   |
 +-----------------------------------------------+
```

## Folder layout and boundaries (`apps/desktop/src`)

Built with electron-vite (one bundle each for main, preload and renderer) and packaged with
electron-builder. The folders are layers, and imports only point downwards:

| Folder | May import | Holds |
|---|---|---|
| `renderer/` | `shared/` | The two pages. No Node, no network; they talk to the main process only through `window.raven`. |
| `preload/` | `shared/` | The `window.raven` bridge: one method per IPC channel. |
| `main/` | `core/`, `shared/`, Electron, libraries | The Electron shell: wires `core` to Electron, electron-store and supabase-js. Kept thin. |
| `core/` | `shared/` | Pure logic with no Electron imports. Dependencies (store, backend, clock) are passed in, so it is unit-tested directly. |
| `shared/` | nothing | Types, the IPC contract and small helpers used on both sides of the bridge. |

### Core (`src/core`)

| Module | Job |
|---|---|
| `pomodoro.ts` | The timer state machine: work (25 min) and break (5 min) phases, pause, skip, reset. Emits `state` on every change. A work phase counts only if it runs its full length. |
| `counts.ts` | Start of the local day and week (weeks start on Sunday), and today/week/all-time counts from a list of timestamps. |
| `sync.ts` | The sync loop behind a `SyncBackend` and a `LocalPomodoros` interface: push unsynced records, fetch server counts, fall back to local counts. With no backend (offline build) it only recounts the local store. Never throws. |
| `syncRows.ts` | The local record type, the database row types, and the mapping between them. |
| `config.ts` | Decides offline or sync from the two build-time values (and rejects half-set or malformed ones), and which window to open first. |
| `geometry.ts` | Default widget position, clamping a saved position to the screen, and drag maths. |

### Shared (`src/shared`)

| Module | Job |
|---|---|
| `types.ts` | `Phase`, `Counts`, `TimerState`. |
| `ipc.ts` | The IPC contract: channel names (`IpcChannel`), payload types, the `RavenApi` that `window.raven` implements, and `readableIpcError` for showing a handler's error in a page. |
| `phases.ts` | Phase lengths and display helpers (`m:ss`, ring fraction, the Start/Resume/Pause label). |

### Main process (`src/main`)

| Module | Job |
|---|---|
| `index.ts` | Boot: offline build, or sync build with a saved session, opens the widget, tray, autostart and sync; a sync build without a session opens the sign-in window (closing it quits). |
| `timer.ts` | Creates the app's single `PomodoroTimer`, wired to the store and sync, and starts its clock. |
| `store.ts` | Local JSON store (electron-store): window position, autostart flag, a random install id, and every finished pomodoro with a `synced` flag. |
| `auth.ts` | `syncEnabled`, the Supabase client (null in an offline build), the saved session and sign-in. Session tokens are kept in a separate store, encrypted with `safeStorage` when available. |
| `sync.ts` | Implements `SyncBackend` with supabase-js and starts the one-minute sync timer. |
| `ipc.ts` | IPC handlers for the timer, sign-in and window dragging, using the channel names from `shared/ipc.ts`. |
| `window.ts`, `loginWindow.ts`, `rendererPage.ts` | The 192 px frameless, transparent, always-on-top widget window, the sign-in window, and the web preferences and page loading they share. |
| `tray.ts` | Tray icon and menu: counts, an "Offline" line in an offline build, start/pause/resume, skip, reset, quit. |
| `autolaunch.ts` | Start at login: `auto-launch` on macOS and Windows; on Linux its own `.desktop` file pointing at the stable AppImage path with `--no-sandbox`. |
| `paths.ts` | Finds runtime assets (tray icon) in development and in a packaged build. |

`electron.vite.config.ts` compiles the Supabase URL and anon key in at build time when both are
set, and empty strings otherwise (offline build). It uses `core/config.ts`, so a half-set or
malformed pair fails the build.

### Preload (`src/preload`)

Exposes `window.raven` (`RavenApi`) through `contextBridge`. Renderers run with `contextIsolation`
on and `nodeIntegration` off and have no other access to the main process.

### Renderers (`src/renderer`)

- `widget/`: an SVG progress ring, the sprite (two-frame CSS animation per phase: working, break,
  paused), today's count, and the time left on hover. A press that moves less than 4 px is a click
  (start or pause); more is a drag, and the main process moves the window, because CSS drag regions
  swallow clicks on a window this small.
- `login/`: email and password form (sync builds only).
- `env.d.ts`: declares `window.raven` once for both pages.

## Sync and offline behaviour

In an offline build only step 1 happens, and counts always come from the local store.

1. When a work phase runs its full 25 minutes, the pomodoro is written to the local store with a
   random UUID and `synced: false`.
2. A sync pass sends every unsynced row with `INSERT ... ON CONFLICT (id) DO NOTHING`, then marks
   them synced. If the push fails, the rows stay unsynced and the next pass retries. A row that
   already reached the server is skipped, so a lost response cannot block later pushes.
3. The pass then calls `pomodoro_counts(today_start, week_start)` with the device's local midnight
   and start of week. If that fails (offline, signed out), the widget uses counts from the local
   store.

## Database (`supabase/migrations`)

- `pomodoros`: `id` (client UUID), `user_id`, `started_at`, `completed_at`, `duration_seconds`,
  `device_id`, `created_at`, indexed on `(user_id, completed_at desc)`.
- `profiles`: one row per user with an optional display name. Not used by the app yet.
- Row Level Security is on for both. `pomodoros` has a select policy and an insert policy, both
  `auth.uid() = user_id`, and nothing for update or delete, so history is append-only. `profiles`
  allows its owner everything on their own row.
- `pomodoro_counts(today_start, week_start)` returns three counts for `auth.uid()`. It is
  `security invoker`, so the policies apply inside it too, and its `search_path` is pinned.

`supabase/test/rls.test.ts` applies the migrations to PGlite and checks these rules from the
`authenticated` and `anon` roles.

## Tests

- `apps/desktop/test/`: the core and shared modules: timer (phases, pause, skip, reset, start
  times), counts and week boundaries (time-zone independent), the sync loop in both modes (offline:
  local counts, nothing pushed; sync: rows mapped, duplicates and failures retried, fallbacks),
  build config and start screen, window geometry, and display helpers.
- `supabase/test/rls.test.ts`: the database rules, against the real migrations in PGlite.

## Builds and CI

- `ci.yml`: on every push and pull request, `npm ci`, lint, type-check, tests, and the desktop
  bundles twice: offline, and with placeholder Supabase values.
- `build.yml` (Release): on a pushed `v*` tag (or by hand), builds the installers on Windows (NSIS
  `.exe`), macOS (universal `.dmg`) and Linux (AppImage) runners and, for a tag, publishes them as
  a GitHub Release with `GITHUB_TOKEN`. No secrets: the builds are offline unless the repository
  variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set. The builds are not code-signed.
