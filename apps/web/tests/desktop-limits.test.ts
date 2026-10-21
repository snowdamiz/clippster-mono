import { it, expect } from 'vitest'
import { clipInput } from '../server/validation'
import { buildClipExportPlan } from '../../../packages/clip-export/src/buildClipExport'

const input = (segments: Array<{ start_time: number; end_time: number }>) => ({ name: 'Manual clip', aspectRatio: '16:9', captions: false, segments })

it('preserves appended segment order and repeated ranges through export', () => {
  const clip = clipInput(input([{ start_time: 30, end_time: 40 }, { start_time: 2, end_time: 4 }, { start_time: 30, end_time: 40 }]), 50)
  expect(clip.segments.map(part => part.start_time)).toEqual([30, 2, 30])
  const plan = buildClipExportPlan({ videoPath: 'source.mp4', outputPath: 'clip.mp4', segments: clip.segments, targetRatio: '16:9' })
  expect(plan.ffmpegArgs.filter((_, index, args) => args[index - 1] === '-ss')).toEqual(['30', '2', '30'])
  expect(plan.totalDuration).toBe(22)
})

it('accepts a full 31 minute clip and transcript while retaining source bounds', () => {
  const words = Array.from({ length: 12000 }, (_, index) => ({ word: 'caption', start: index / 10, end: index / 10 + .05 }))
  expect(JSON.stringify(words).length).toBeGreaterThan(256 * 1024)
  expect(clipInput({ ...input([{ start_time: 0, end_time: 1905 }]), subtitleWords: words }, 1905).subtitleWords).toHaveLength(12000)
  expect(() => clipInput(input([{ start_time: 0, end_time: 1906 }]), 1905)).toThrow()
  expect(() => clipInput(input([{ start_time: NaN, end_time: 20 }]), 1905)).toThrow()
})
