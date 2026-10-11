import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
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
      '/workspace/api': {
        target: 'http://127.0.0.1:8090',
        rewrite: (url) => url.replace(/^\/workspace/, ''),
      },
      '/workspace': { target: 'http://127.0.0.1:5175', ws: true },
    },
  },
})
