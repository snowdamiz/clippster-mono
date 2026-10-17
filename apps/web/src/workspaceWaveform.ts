import { ref } from 'vue'
export interface WaveformPeak { min: number; max: number }
export interface WaveformRenderOptions { startTime: number; endTime: number; pixelWidth: number; gainMultiplier?: number }
const requests = new Map<string, Promise<{ duration: number; peaks: WaveformPeak[] }>>()
async function fetchWaveform(path: string, options?: WaveformRenderOptions) {
  const url = new URL(path.replace(/\/source$/, '/waveform'), location.origin)
  if (options) { url.searchParams.set('start', String(options.startTime)); url.searchParams.set('end', String(options.endTime)); url.searchParams.set('width', String(Math.min(10000, Math.max(1, Math.round(options.pixelWidth))))); url.searchParams.set('gain', String(options.gainMultiplier ?? 1)) }
  let request = requests.get(url.href)
  if (!request) {
    request = fetch(url, { credentials: 'same-origin' }).then(async response => { if (!response.ok) throw new Error('Could not load the audio waveform.'); return response.json() })
    requests.set(url.href, request!); if (requests.size > 32) requests.delete(requests.keys().next().value!)
    request!.catch(() => requests.delete(url.href))
  }
  return request!
}
export const waveformService = { getPeaksForRange: async (path: string, options: WaveformRenderOptions) => (await fetchWaveform(path, options)).peaks }
export function useWaveform() {
  const isLoading = ref(false), isLoaded = ref(false), error = ref<string | null>(null), duration = ref(0)
  let generation = 0
  async function load(path: string) { const run = ++generation; isLoading.value = true; error.value = null; try { const data = await fetchWaveform(path); if (run === generation) { duration.value = data.duration; isLoaded.value = true } } catch (cause) { if (run === generation) { error.value = String(cause); isLoaded.value = false } } finally { if (run === generation) isLoading.value = false } }
  function reset() { generation++; isLoaded.value = false; isLoading.value = false; duration.value = 0 }
  return { isLoading, isLoaded, error, duration, load, reset }
}
