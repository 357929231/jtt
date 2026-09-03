import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, `./src`),
    },
  },
  test: {
    environment: `jsdom`,
    exclude: [
      ...configDefaults.exclude,
      `**/.worktrees/**`,
    ],
    globals: true,
    setupFiles: [`./vitest.setup.ts`],
  },
})
