import path from 'node:path'
import process from 'node:process'

import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, type PluginOption } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

function resolveBase() {
  const explicitBase = process.env.PUBLIC_BASE_PATH?.trim()
  if (explicitBase) {
    return explicitBase.endsWith(`/`) ? explicitBase : `${explicitBase}/`
  }

  if (process.env.VERCEL || process.env.CF_PAGES || process.env.SERVER_ENV === `NETLIFY`) {
    return `/`
  }

  if (process.env.GITHUB_ACTIONS === `true`) {
    const repoName = process.env.GITHUB_REPOSITORY?.split(`/`)[1]
    return repoName ? `/${repoName}/` : `/`
  }

  return `/`
}

function createStorageShim() {
  const entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear() {
      entries.clear()
    },
    getItem(key: string) {
      return entries.get(key) ?? null
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null
    },
    removeItem(key: string) {
      entries.delete(key)
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value))
    },
  }
}

function ensureNodeStorage() {
  for (const storageKey of [`localStorage`, `sessionStorage`] as const) {
    const storage = globalThis[storageKey as keyof typeof globalThis]

    if (
      storage
      && typeof storage === `object`
      && `getItem` in storage
      && `setItem` in storage
    ) {
      continue
    }

    Object.defineProperty(globalThis, storageKey, {
      configurable: true,
      value: createStorageShim(),
    })
  }
}

// https://vitejs.dev/config/
export default defineConfig(async ({ command }) => {
  const plugins: PluginOption[] = [
    vue(),
    UnoCSS(),
    nodePolyfills({
      include: [`path`, `util`, `timers`, `stream`, `fs`],
      overrides: {
        // Since `fs` is not supported in browsers, we can use the `memfs` package to polyfill it.
        // fs: 'memfs',
      },
    }),
    AutoImport({
      imports: [
        `vue`,
        `pinia`,
        `@vueuse/core`,
      ],
      dirs: [
        `./src/stores`,
        `./src/utils/toast`,
      ],
    }),
    Components({
      resolvers: [],
    }),
  ]

  if (command === `serve`) {
    ensureNodeStorage()
    const { default: vueDevTools } = await import(`vite-plugin-vue-devtools`)
    plugins.splice(2, 0, vueDevTools())
  }

  if (process.env.ANALYZE === `true`) {
    plugins.push(visualizer({
      emitFile: true,
      filename: `stats.html`,
    }))
  }

  return {
    base: resolveBase(),
    define: {
      process,
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, `./src`),
      },
    },
    css: {
      devSourcemap: true,
    },
    build: {
      rollupOptions: {
        output: {
          chunkFileNames: `static/js/md-[name]-[hash].js`,
          entryFileNames: `static/js/md-[name]-[hash].js`,
          assetFileNames: `static/[ext]/md-[name]-[hash].[ext]`,
        },
      },
    },
  }
})
