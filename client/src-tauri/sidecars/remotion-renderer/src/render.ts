import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { RenderOptions } from './types';

// MIME types for media files
const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

function startFileServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // URL format: /video/<base64-encoded-path>
      const urlParts = req.url?.split('/') || [];
      if (urlParts.length < 3 || urlParts[1] !== 'video') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      let filePath: string;
      try {
        filePath = Buffer.from(urlParts[2], 'base64').toString('utf-8');
      } catch {
        res.writeHead(400);
        res.end('Invalid path encoding');
        return;
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);

      // Support range requests for video seeking
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });

    // Listen on random available port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve({ server, port: addr.port });
      } else {
        reject(new Error('Failed to get server address'));
      }
    });

    server.on('error', reject);
  });
}

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

  // Start local file server for serving media files to Remotion
  const { server: fileServer, port: fileServerPort } = await startFileServer();

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
        videoServerPort: fileServerPort,
      },
    });

    onProgress(0.3);

    // Create cancel signal wrapper for Remotion
    let cancelCallback: (() => void) | null = null;
    const cancelSignal = (callback: () => void) => {
      cancelCallback = callback;
    };
    
    // Listen for abort signal
    signal.addEventListener('abort', () => {
      if (cancelCallback) {
        cancelCallback();
      }
    });

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
      cancelSignal,
    });

    onProgress(1.0);
  } finally {
    // Clean up temp composition file
    if (fs.existsSync(tempCompositionPath)) {
      fs.unlinkSync(tempCompositionPath);
    }
    // Shut down file server
    fileServer.close();
  }
}

export function cancelRender(renderId: string): void {
  // Cancellation is handled by AbortController in index.ts
  // This function is here for completeness
}
