import { computed, onUnmounted, ref } from 'vue';
import type { AutoFramingInfo } from '../../../packages/shared-types/src/framingTracking';
import type { ManualFramingConfig } from '@/types';
import { autoFramingSourceKey, planAutoFraming } from '@/services/auto-framing/planner';

export function isDesktopAutoFramingAvailable() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useAutoFraming(
  source: () => {
    path: string;
    url: string;
    start: number;
    end: number;
    ratio: string;
    cuts?: number[];
  },
  apply: (config: ManualFramingConfig) => void
) {
  const busy = ref(false),
    progress = ref(0),
    error = ref('');
  const info = ref<AutoFramingInfo>();
  let controller: AbortController | undefined;
  const sourceKey = computed(() => {
    const s = source();
    return autoFramingSourceKey(s.path, s.start, s.end);
  });
  function cancel() {
    controller?.abort();
    controller = undefined;
    busy.value = false;
  }
  async function run() {
    cancel();
    error.value = '';
    info.value = undefined;
    progress.value = 0;
    if (!isDesktopAutoFramingAvailable()) {
      error.value = 'Auto framing is coming soon to web and mobile.';
      return;
    }
    const s = source();
    if (!s.path || !s.url || /^https?:/i.test(s.path)) {
      error.value = 'Download the source video before using Auto framing.';
      return;
    }
    const job = new AbortController();
    controller = job;
    busy.value = true;
    try {
      const { analyzeLocalFaces } = await import('@/services/autoFramingRuntime');
      job.signal.throwIfAborted();
      const analysis = await analyzeLocalFaces(
        s.url,
        s.start,
        s.end,
        job.signal,
        (value) => {
          if (controller === job) progress.value = value;
        },
        s.cuts
      );
      job.signal.throwIfAborted();
      const config = planAutoFraming(
        analysis.samples,
        analysis.width,
        analysis.height,
        s.ratio,
        autoFramingSourceKey(s.path, s.start, s.end)
      );
      info.value = config.autoFraming;
      apply(config);
    } catch (cause) {
      if (!job.signal.aborted)
        error.value =
          cause instanceof Error ? cause.message : 'Auto framing failed. Try again or use Manual.';
    } finally {
      if (controller === job) {
        busy.value = false;
        controller = undefined;
      }
    }
  }
  onUnmounted(cancel);
  return { busy, progress, error, info, sourceKey, run, cancel };
}
