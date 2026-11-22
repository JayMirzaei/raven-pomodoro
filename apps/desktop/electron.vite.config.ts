import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'

import { resolveSyncConfig } from './src/core/config'

// Reads apps/desktop/.env (see .env.example) and the process environment.
const env = loadEnv('', process.cwd(), '')

// Sync is optional. With neither SUPABASE_URL nor SUPABASE_ANON_KEY set this
// is an offline build: no sign-in, counts stay on the machine. With both set,
// they are compiled in, so a packaged build needs no .env file. Setting only
// one, or a malformed URL, fails the build here rather than at run time.
// The anon key is public by design (every client contains it); Row Level
// Security in the database is what protects each user's rows.
const sync = resolveSyncConfig(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
console.log(sync ? 'Raven: sync build (Supabase settings found)' : 'Raven: offline build (no Supabase settings)')

const define = {
  'process.env.SUPABASE_URL': JSON.stringify(sync?.url ?? ''),
  'process.env.SUPABASE_ANON_KEY': JSON.stringify(sync?.anonKey ?? '')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          widget: resolve(__dirname, 'src/renderer/widget/index.html'),
          login: resolve(__dirname, 'src/renderer/login/index.html')
        }
      }
    }
  }
})
