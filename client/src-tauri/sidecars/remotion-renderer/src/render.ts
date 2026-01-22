import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface RenderOptions {
  composition: any;
  outputPath: string;
  options?: {
    codec?: 'h264' | 'h265';
    crf?: number;
  };
  onProgress?: (progress: { 
    progress: number; 
    renderedFrames: number; 
    totalFrames: number;
  }) => void;
  signal?: AbortSignal;
}

let bundleLocation: string | null = null;

async function ensureBundled(): Promise<string> {
  if (bundleLocation) return bundleLocation;
  
  const entryPoint = path.join(__dirname, '../remotion/index.tsx');
  bundleLocation = await bundle({
    entryPoint,
    onProgress: (progress) => {
      console.error(`Bundling: ${Math.round(progress * 100)}%`);
    },
  });
  
  return bundleLocation;
}

export async function renderVideo(options: RenderOptions): Promise<void> {
  const bundled = await ensureBundled();
  
  const comp = await selectComposition({
    serveUrl: bundled,
    id: 'AIVideo',
    inputProps: { 
      composition: options.composition,
      videoServerPort: 0,
    },
  });
  
  await renderMedia({
    composition: comp,
    serveUrl: bundled,
    codec: options.options?.codec || 'h264',
    outputLocation: options.outputPath,
    inputProps: { 
      composition: options.composition,
      videoServerPort: 0,
    },
    crf: options.options?.crf,
    onProgress: ({ progress, renderedFrames, encodedFrames }) => {
      options.onProgress?.({ 
        progress, 
        renderedFrames, 
        totalFrames: comp.durationInFrames,
      });
    },
    cancelSignal: options.signal,
  });
}
