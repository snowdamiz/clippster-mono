import { afterEach, describe, expect, it, vi } from 'vitest';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke, convertFileSrc: (path: string) => path }));
import { waveformService, useWaveform } from './waveformService';

afterEach(() => { vi.restoreAllMocks(); invoke.mockReset(); });
describe('persistent waveform client', () => {
  it('deduplicates native requests and reuses raw peaks for gain changes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    invoke.mockImplementation(async (command: string) => command === 'probe_video_duration' ? 7910 : [{ min: -.2, max: .4 }]);
    await waveformService.loadAudio('C:/waveform-cache-test.mp4');
    const options = { startTime: 0, endTime: 7910, pixelWidth: 100 };
    const [base, amplified] = await Promise.all([
      waveformService.getPeaksForRange('C:/waveform-cache-test.mp4', options),
      waveformService.getPeaksForRange('C:/waveform-cache-test.mp4', { ...options, gainMultiplier: 2 }),
    ]);
    expect(base).toEqual([{ min: -.2, max: .4 }]);
    expect(amplified).toEqual([{ min: -.4, max: .8 }]);
    expect(waveformService.getCachedPeaks('C:/waveform-cache-test.mp4', { ...options, gainMultiplier: 0 })).toEqual([{ min: -0, max: 0 }]);
    expect(invoke.mock.calls.filter(([command]) => command === 'extract_audio_peaks_for_range')).toHaveLength(1);
  });
  it('ignores a stale source load after switching videos', async () => {
    let finish!: (value: { channelData: Float32Array; sampleRate: number; duration: number }) => void;
    vi.spyOn(waveformService, 'loadAudio').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ channelData: new Float32Array(), sampleRate: 0, duration: 20 });
    const waveform = useWaveform();
    const oldLoad = waveform.load('old.mp4');
    await waveform.load('new.mp4');
    finish({ channelData: new Float32Array(), sampleRate: 0, duration: 7910 });
    await oldLoad;
    expect(waveform.duration.value).toBe(20);
    expect(waveform.filePath.value).toBe('new.mp4');
  });
});
