const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['dist/index.js'],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: 'dist/bundle.js',
      external: [
        // Mark native modules as external
        'fsevents',
      ],
      minify: false,
      sourcemap: false,
    });
    console.log('Build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
