import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as path from 'path';
import * as fs from 'fs';
import { RenderOptions } from './types';

export async function renderVideo(options: RenderOptions): Promise<void> {
  const { renderId, composition, outputPath, codec, crf, signal, onProgress } = options;

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write composition data to temp file for Remotion to read
  const tempCompositionPath = path.join(outputDir, `${renderId}-composition.json`);
  fs.writeFileSync(tempCompositionPath, JSON.stringify(composition));

  try {
    // Get the path to the Remotion entry point
    // This should point to the client's src/remotion/index.tsx
    const remotionRoot = path.resolve(__dirname, '../../../../src/remotion');
    const entryPoint = path.join(remotionRoot, 'index.tsx');

    if (!fs.existsSync(entryPoint)) {
      throw new Error(`Remotion entry point not found: ${entryPoint}`);
    }

    // Bundle the Remotion project
    onProgress(0.1);
    const bundled = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    onProgress(0.2);

    // Select the composition
    const comp = await selectComposition({
      serveUrl: bundled,
      id: 'AIVideo',
      inputProps: {
        composition,
        videoServerPort: 0, // Not needed for rendering
      },
    });

    onProgress(0.3);

    // Render the video
    await renderMedia({
      composition: comp,
      serveUrl: bundled,
      codec,
      outputLocation: outputPath,
      crf,
      onProgress: ({ progress }) => {
        // Map 0.3-1.0 to the remaining progress
        onProgress(0.3 + progress * 0.7);
      },
      cancelSignal: signal,
    });

    onProgress(1.0);
  } finally {
    // Clean up temp composition file
    if (fs.existsSync(tempCompositionPath)) {
      fs.unlinkSync(tempCompositionPath);
    }
  }
}

export function cancelRender(renderId: string): void {
  // Cancellation is handled by AbortController in index.ts
  // This function is here for completeness
}
