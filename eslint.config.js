import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/out/', '**/dist/', '**/release/', '**/.tsbuild/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/desktop/src/main/**', 'apps/desktop/src/preload/**', 'apps/desktop/*.ts'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['apps/desktop/src/renderer/**'],
    languageOptions: { globals: globals.browser }
  }
)
