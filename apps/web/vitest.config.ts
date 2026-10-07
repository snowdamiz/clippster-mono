import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config'
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: [
        'tests/**/*.test.ts',
        '../../packages/clip-export/src/buildClipExport{,.ffmpeg}.test.ts'
      ],
      testTimeout: 90_000,
      hookTimeout: 90_000,
      maxWorkers: 1,
      fileParallelism: false
    }
  })
)
