import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config'
export default mergeConfig(
  base,
  defineConfig({
    base: '/',
    test: {
      include: [
        'tests/**/*.test.ts',
        '../../client/src/services/personalBrandingSync.test.ts',
        '../../packages/clip-export/src/buildClipExport{,.ffmpeg}.test.ts'
      ],
      testTimeout: 90_000,
      hookTimeout: 90_000,
      maxWorkers: 1,
      fileParallelism: false
    }
  })
)
