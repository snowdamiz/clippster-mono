import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'
const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const require = createRequire(import.meta.url)
const clientTsconfig = resolve('../../client/tsconfig.json').replace(/\\/g, '/')
// Shared SFC macros must use the web app's dependency paths, including in a
// standalone CI/Docker install with no client or root node_modules directory.
const vueTypeFs = {
  ...ts.sys,
  fileExists: (file: string) => file.replace(/\\/g, '/') === clientTsconfig || ts.sys.fileExists(file),
  readFile: (file: string) => file.replace(/\\/g, '/') === clientTsconfig
    ? JSON.stringify({ extends: resolve('./tsconfig.json') })
    : ts.sys.readFile(file)
}
export default defineConfig({
  base: '/workspace/',
  publicDir: '../../client/public',
  plugins: [vue({ script: { fs: vueTypeFs } })],
  resolve: {
    alias: {
      '@/composables/useUnsavedChanges': resolve('./src/useUnsavedChanges.ts'),
      '@/services/api': resolve('./src/nativeAccountApi.ts'),
      '@/services/profileMediaRuntime': resolve('./src/profileMediaRuntime.ts'),
      '@/services/settingsRuntime': resolve('./src/settingsRuntime.ts'),
      '@/db/thumbnail-cache': resolve('./src/profileThumbnailCache.ts'),
      '@/services/socialOAuthRuntime': resolve('./src/socialOAuthRuntime.ts'),
      'vue-router': resolve('./src/accountRouter.ts'),
      '@/stores/permissions': resolve('./src/workspacePermissions.ts'),
      '@/services/aiBrollRuntime': resolve('./src/aiBrollRuntime.ts'),
      '@/services/poiRuntime': resolve('./src/poiRuntime.ts'),
      '@/services/workspaceRuntime': resolve('./src/workspaceRuntime.ts'),
      '@/stores/auth': resolve('./src/workspaceAccount.ts'),
      '@/composables/useCreditBalance': resolve('./src/workspaceCredits.ts'),
      '@/services/waveformService': resolve('./src/workspaceWaveform.ts'),
      '@/services/creatorProfileRuntime': resolve('./src/creatorProfileRuntime.ts'),
      '@/services/creatorDownloadRuntime': resolve('./src/creatorDownloadRuntime.ts'),
      '@/composables/useToast': resolve('./src/toasts.ts'),
      '@/stores/userPreferences': resolve('./src/workspacePreferences.ts'),
      'radix-vue': require.resolve('reka-ui').replace(/\.cjs$/, '.js'),
      '@': resolve('../../client/src'),
      '@clippster/cloud-sync-schema': resolve('../../packages/cloud-sync-schema/src/index.ts'),
      '@clippster/shared-types': resolve('../../packages/shared-types/src/index.ts'),
      '@clippster/api-client': resolve('../../packages/api-client/src/index.ts'),
      '@clippster/clip-export': resolve('../../packages/clip-export/src/index.ts'),
      vue: require.resolve('vue/dist/vue.runtime.esm-bundler.js'),
      'lucide-vue-next': require.resolve('lucide-vue-next/dist/esm/lucide-vue-next.js'),
      'hls.js': require.resolve('hls.js/dist/hls.mjs'),
      'reka-ui': require.resolve('reka-ui').replace(/\.cjs$/, '.js'),
      'class-variance-authority': require.resolve('class-variance-authority').replace(/index\.js$/, 'index.mjs'),
      clsx: require.resolve('clsx').replace(/clsx\.js$/, 'clsx.mjs'),
      'tailwind-merge': require.resolve('tailwind-merge').replace(/bundle-cjs\.js$/, 'bundle-mjs.mjs'),
      // Shared desktop CSS must also resolve with only the web dependencies installed.
      tailwindcss: require.resolve('tailwindcss/index.css')
    },
    // Resolve shared-source dependencies from this app's standalone install.
    dedupe: Object.keys(require('./package.json').dependencies)
  },
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: 5175,
    strictPort: true,
    fs: { allow: [resolve('../..')] },
    watch: { usePolling: process.env.WEB_WATCH_POLL === 'true' },
    proxy: {
      '^/api/(?:user|clippers|account|organizations|campaigns|hiring-posts|affiliate|settings|social)(?:/|$)': {
        target: (process.env.CLIPPSTER_API_URL || 'http://127.0.0.1:4000/api').replace(/\/api\/?$/, ''), changeOrigin: true
      },
      '/api': 'http://127.0.0.1:8090'
    }
  },
  build: { outDir: 'dist/public', rollupOptions: { output: { manualChunks: { hls: ['hls.js'] } } } }
})
