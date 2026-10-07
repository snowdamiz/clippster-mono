import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const require = createRequire(import.meta.url)
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve('../../client/src'),
      '@clippster/cloud-sync-schema': resolve('../../packages/cloud-sync-schema/src/index.ts'),
      '@clippster/shared-types': resolve('../../packages/shared-types/src/index.ts'),
      '@clippster/api-client': resolve('../../packages/api-client/src/index.ts'),
      '@clippster/clip-export': resolve('../../packages/clip-export/src/index.ts'),
      vue: require.resolve('vue/dist/vue.runtime.esm-bundler.js'),
      'lucide-vue-next': require.resolve('lucide-vue-next/dist/esm/lucide-vue-next.js'),
      'hls.js': require.resolve('hls.js/dist/hls.mjs')
    },
    dedupe: ['vue']
  },
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: 5175,
    strictPort: true,
    fs: { allow: [resolve('../..')] },
    watch: { usePolling: process.env.WEB_WATCH_POLL === 'true' },
    proxy: { '/api': 'http://127.0.0.1:8090' }
  },
  build: { outDir: 'dist/public', rollupOptions: { output: { manualChunks: { hls: ['hls.js'] } } } }
})
