# Contributing

Issues and pull requests are welcome. Please keep changes small and tested.

## Set up

```sh
npm ci
npm run check    # lint, type-check and tests; CI runs the same plus the desktop build
```

`npm run dev` runs the app offline; no account or keys are needed. To work on sync, use your own
Supabase project (see the [README](README.md#enable-sync-with-your-own-supabase-project)), and
never commit a `.env` file or a key. The service-role key must never appear in the app.

## Guidelines

- Keep logic in `apps/desktop/src/core` (no Electron imports, dependencies passed in) and test it
  there. Code in `src/main` that touches Electron, the store or the network stays thin.
- Both build modes must keep working: an offline build (no Supabase settings) and a sync build.
- A new IPC channel goes into `src/shared/ipc.ts` first, then the preload bridge and a handler in
  `src/main/ipc.ts`.
- A schema change is a new file in `supabase/migrations/`, never an edit to an applied one. Every
  table gets Row Level Security, and `supabase/test/rls.test.ts` gets a case for each new rule.
- The renderers only talk to the main process through `window.raven` (`src/preload/index.ts`). Add
  to that API rather than giving a renderer Node or network access.
- Redraw the sprites with `scripts/gen_sprites.py` rather than editing the PNGs, and regenerate
  `docs/widget.png` with `scripts/screenshots.py` when the widget's look changes.
