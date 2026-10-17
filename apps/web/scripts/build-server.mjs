import { build } from 'esbuild'
await build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  tsconfig: 'tsconfig.server.json',
  platform: 'node',
  format: 'esm',
  target: 'node24',
  packages: 'external',
  alias: {
    '@clippster/cloud-sync-schema': '../../packages/cloud-sync-schema/src/index.ts',
    '@clippster/shared-types': '../../packages/shared-types/src/index.ts',
    '@clippster/clip-export': '../../packages/clip-export/src/index.ts',
    '@clippster/api-client': '../../packages/api-client/src/index.ts'
  }
})
