import { TEMPLATE_ANALYZER_VERSION, type BeatMap, type RationalTime } from './types'

export interface EnergyFrame {
  timeMs: number
  rms: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function toTime(milliseconds: number): RationalTime {
  return { value: Math.max(0, Math.round(milliseconds)), timescale: 1000 }
}

/**
 * Deterministic onset estimator for locally-decoded mono PCM energy frames.
 * Decoding stays platform-owned; this shared step is cacheable by fingerprint/version.
 */
export function analyzeBeatEnergy(input: {
  sourceFingerprint: string
  frames: EnergyFrame[]
  sampleRate: number
}): BeatMap {
  const frames = input.frames
    .filter(
      (frame) =>
        Number.isFinite(frame.timeMs) &&
        frame.timeMs >= 0 &&
        Number.isFinite(frame.rms) &&
        frame.rms >= 0
    )
    .sort((left, right) => left.timeMs - right.timeMs)
  if (frames.length < 4) {
    return {
      sourceFingerprint: input.sourceFingerprint,
      analyzerVersion: TEMPLATE_ANALYZER_VERSION,
      sampleRate: input.sampleRate,
      bpm: null,
      confidence: 0,
      beats: [],
      downbeats: [],
      manuallyCorrected: false
    }
  }
  const flux = frames.map((frame, index) =>
    Math.max(0, frame.rms - (frames[index - 1]?.rms ?? frame.rms))
  )
  const threshold = median(flux) * 2.5
  const onsets = frames
    .filter(
      (_, index) =>
        index > 0 &&
        flux[index] > threshold &&
        flux[index] >= (flux[index - 1] ?? 0) &&
        flux[index] >= (flux[index + 1] ?? 0)
    )
    .map((frame) => frame.timeMs)
  const intervals = onsets
    .slice(1)
    .map((time, index) => time - onsets[index])
    .filter((interval) => interval >= 250 && interval <= 1500)
  const medianInterval = median(intervals)
  const bpm = medianInterval > 0 ? Math.round((60_000 / medianInterval) * 10) / 10 : null
  const consistency =
    medianInterval > 0 && intervals.length > 0
      ? intervals.filter((interval) => Math.abs(interval - medianInterval) <= medianInterval * 0.2)
          .length / intervals.length
      : 0
  const confidence = Math.min(1, consistency * Math.min(1, onsets.length / 8))
  const beats = onsets.map(toTime)
  return {
    sourceFingerprint: input.sourceFingerprint,
    analyzerVersion: TEMPLATE_ANALYZER_VERSION,
    sampleRate: input.sampleRate,
    bpm,
    confidence,
    beats,
    downbeats: beats.filter((_, index) => index % 4 === 0),
    manuallyCorrected: false
  }
}
