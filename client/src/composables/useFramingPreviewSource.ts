import { onUnmounted, ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getClipSegmentsByVersionId } from '@/services/database/clip-segments';
import type { ClipWithVersion } from '@/services/database';
import { mapFramingTranscript } from '@/services/auto-framing/timing';

export interface FramingPreviewSource {
  path: string;
  start: number;
  end: number;
  identity: { path: string; ranges: { start: number; end: number }[] };
}

/** Reuse the existing cut-preview renderer so analysis sees exactly the exported sequence. */
export function useFramingPreviewSource() {
  const preview = ref<FramingPreviewSource>();
  const busy = ref(false),
    error = ref('');
  let generation = 0;
  const ownedFiles = new Set<string>();
  async function clear() {
    generation++;
    preview.value = undefined;
    busy.value = false;
    error.value = '';
    const paths = [...ownedFiles];
    ownedFiles.clear();
    await Promise.all(
      paths.map((path) => invoke('delete_segment_preview', { previewPath: path }).catch(() => {}))
    );
  }
  async function prepare(
    clip: ClipWithVersion,
    path: string,
    start: number,
    end: number,
    ignoreSavedSegments = false
  ) {
    const job = ++generation;
    busy.value = true;
    error.value = '';
    try {
      const saved =
        !ignoreSavedSegments && clip.current_version_id
          ? await getClipSegmentsByVersionId(clip.current_version_id)
          : [];
      const stale = start === 0 && saved.some((s) => s.end_time > end + 0.5);
      const ranges =
        saved.length && !stale
          ? saved.map((s) => ({ start: s.start_time, end: s.end_time }))
          : [{ start, end }];
      if (
        !path ||
        ranges.some(
          (r) =>
            !Number.isFinite(r.start) || !Number.isFinite(r.end) || r.start < 0 || r.end <= r.start
        )
      )
        throw new Error('The clip has no valid video range to preview.');
      const identity = { path, ranges };
      if (JSON.stringify(preview.value?.identity) === JSON.stringify(identity)) return true;
      let result: FramingPreviewSource = {
        path,
        start: ranges[0].start,
        end: ranges[0].end,
        identity,
      };
      if (ranges.length > 1) {
        const file = await invoke<string>('generate_segment_preview', {
          videoPath: path,
          segments: ranges.map((r) => ({ start_time: r.start, end_time: r.end })),
          outputFilename: `auto_framing_${crypto.randomUUID()}`,
        });
        if (job !== generation) {
          await invoke('delete_segment_preview', { previewPath: file });
          return false;
        }
        ownedFiles.add(file);
        result = {
          path: file,
          start: 0,
          end: ranges.reduce((sum, r) => sum + r.end - r.start, 0),
          identity,
        };
      }
      if (job !== generation) return false;
      preview.value = result;
      return true;
    } catch (cause) {
      if (job === generation) error.value = cause instanceof Error ? cause.message : String(cause);
      return false;
    } finally {
      if (job === generation) busy.value = false;
    }
  }
  onUnmounted(() => {
    void clear();
  });
  function mapTranscript<T extends { start: number; end: number }>(
    items: T[],
    sourceOffset: number
  ) {
    return preview.value
      ? mapFramingTranscript(items, preview.value.identity.ranges, sourceOffset)
      : items;
  }
  return { preview, busy, error, prepare, clear, mapTranscript };
}
