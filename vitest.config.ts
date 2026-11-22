import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/desktop/test/**/*.test.ts', 'supabase/test/**/*.test.ts'],
    environment: 'node'
  }
})
