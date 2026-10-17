import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@clippster/app-tour': path.resolve(__dirname, '../packages/app-tour/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': { target: (loadEnv(mode, process.cwd(), '').VITE_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, ''), changeOrigin: true },
      '/workspace/api': {
        target: 'http://127.0.0.1:8090',
        rewrite: (url) => url.replace(/^\/workspace/, ''),
      },
      '/workspace': { target: 'http://127.0.0.1:5175', ws: true },
    },
  },
}))
