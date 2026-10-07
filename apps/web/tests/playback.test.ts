import { describe, expect, it, vi } from 'vitest'
import type { ClipSegment } from '@clippster/shared-types'
vi.mock('vue', async (original) => ({
  ...(await original<typeof import('vue')>()),
  onUnmounted: vi.fn()
}))
import { usePlayback } from '../src/usePlayback'

const segments: ClipSegment[] = [
  { start_time: 0.4, end_time: 1.4, duration: 1, transcript: null },
  { start_time: 3.4, end_time: 4.4, duration: 1, transcript: null }
]
function setup() {
  const playback = usePlayback()
  const video = {
    currentTime: 0,
    volume: 1,
    muted: false,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn()
  }
  playback.ready(video as unknown as HTMLVideoElement)
  return { playback, video }
}
describe('workspace playback', () => {
  it('skips excluded footage and stops at the end of the selected clip', async () => {
    const { playback, video } = setup()
    playback.preview(segments)
    await Promise.resolve()
    expect(video.currentTime).toBe(0.4)
    video.currentTime = 1.4
    playback.update()
    expect(video.currentTime).toBe(3.4)
    video.currentTime = 4.4
    playback.update()
    expect(video.pause).toHaveBeenCalled()
    expect(playback.playing.value).toBe(false)
  })
  it('resynchronizes segment boundaries after seeking backward during preview', async () => {
    const { playback, video } = setup()
    playback.preview(segments)
    await Promise.resolve()
    video.currentTime = 1.4
    playback.update()
    playback.seek(0.8)
    video.currentTime = 1.4
    playback.update()
    expect(video.currentTime).toBe(3.4)
  })
  it('does not claim playback before the player is ready', async () => {
    const playback = usePlayback()
    playback.toggle()
    await Promise.resolve()
    expect(playback.playing.value).toBe(false)
  })
  it('keeps a paused player paused when an earlier play request resolves', async () => {
    const { playback, video } = setup()
    let finish!: () => void
    video.play.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    playback.preview(segments)
    playback.pause()
    finish()
    await Promise.resolve()
    expect(playback.playing.value).toBe(false)
  })
})
