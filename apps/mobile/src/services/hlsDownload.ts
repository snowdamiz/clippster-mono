import { Directory, File, FileMode, Paths } from 'expo-file-system';
import {
  isMasterPlaylist,
  parseMasterVariants,
  parseMediaPlaylist,
  pickMobileVariant,
  sliceSegmentsByTime,
  type HlsSegment,
} from '@/lib/hlsPlaylist';
import { getHlsRequestHeaders } from '@/lib/streamDownload';
import type { SegmentRange } from '@/services/ffmpeg';

const SEGMENT_CONCURRENCY = 12;

async function fetchPlaylistText(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HLS playlist request failed (${response.status})`);
  }
  return response.text();
}

async function resolveMediaPlaylist(
  inputUrl: string,
  headers: Record<string, string>,
): Promise<{ playlistUrl: string; text: string }> {
  const text = await fetchPlaylistText(inputUrl, headers);
  if (!isMasterPlaylist(text)) {
    return { playlistUrl: inputUrl, text };
  }

  const variant = pickMobileVariant(parseMasterVariants(text, inputUrl));
  if (!variant) {
    throw new Error('HLS master playlist has no video variants');
  }

  return {
    playlistUrl: variant.url,
    text: await fetchPlaylistText(variant.url, headers),
  };
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed: Error | null = null;

  async function run() {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        await worker(items[index], index);
      } catch (error) {
        failed = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  if (failed) throw failed;
}

async function concatSegmentFiles(files: File[], outputPath: string): Promise<void> {
  const output = new File(outputPath);
  if (output.exists) {
    output.delete();
  }
  output.create();

  const handle = output.open(FileMode.Append);
  try {
    for (const file of files) {
      const bytes = await file.bytes();
      if (bytes.byteLength === 0) {
        throw new Error('Downloaded an empty HLS segment');
      }
      handle.writeBytes(bytes);
    }
  } finally {
    handle.close();
  }
}

export async function downloadHlsToTs(
  inputUrl: string,
  outputPath: string,
  options?: {
    pageUrl?: string;
    segment?: SegmentRange;
    onProgress?: (ratio: number) => void;
  },
): Promise<void> {
  const headers = getHlsRequestHeaders(inputUrl, options?.pageUrl);
  const { playlistUrl, text } = await resolveMediaPlaylist(inputUrl, headers);
  const parsed = parseMediaPlaylist(text, playlistUrl);
  const segments = sliceSegmentsByTime(parsed.segments, options?.segment);

  if (segments.length === 0) {
    throw new Error('No HLS segments found for this time range');
  }

  const tempDir = new Directory(Paths.cache, `hls_${Date.now()}`);
  tempDir.create({ intermediates: true, idempotent: true });

  try {
    const files = segments.map(
      (_, index) => new File(tempDir, `seg_${String(index).padStart(5, '0')}.ts`),
    );
    let completed = 0;

    await mapPool(segments, SEGMENT_CONCURRENCY, async (segment: HlsSegment, index: number) => {
      await File.downloadFileAsync(segment.url, files[index], {
        headers,
        idempotent: true,
      });
      completed += 1;
      options?.onProgress?.(completed / (segments.length + 1));
    });

    await concatSegmentFiles(files, outputPath);
    options?.onProgress?.(1);
  } finally {
    if (tempDir.exists) {
      tempDir.delete();
    }
  }

  const output = new File(outputPath);
  if (!output.exists || output.size === 0) {
    throw new Error('HLS download produced an empty file');
  }
}
