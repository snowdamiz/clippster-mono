import { expect, it, vi } from 'vitest'
import { ref } from 'vue'
vi.mock('../src/api', () => ({ sourcePath: (id: string) => `/api/web/projects/${id}/source` }))
import { useWorkspaceVideo } from '../src/useWorkspaceVideo'
import type { usePlayback } from '../src/usePlayback'
import type { WebClip, WebProject } from '@clippster/shared-types'

it('keeps built clips on the entire source timeline for preview and trimming', () => {
  const playback = { time: ref(6343.22), preview: vi.fn(), seek: vi.fn(), playSource: vi.fn() }
  const project = { id: 'source-project', duration: 7910.25 } as WebProject
  const clip = { id: 'clip', revision: 2, builtRevision: 2, segments: [{ start_time: 6340, end_time: 6359 }], builds: [{ id: 'build' }] } as WebClip
  const video = useWorkspaceVideo(() => project, playback as unknown as ReturnType<typeof usePlayback>)
  const original = video.source.value
  video.preview(clip)
  expect(video.source.value).toBe(original)
  expect(video.source.value).toContain('/source')
  expect(video.duration.value).toBe(7910.25)
  expect(video.sourceTime.value).toBe(6343.22)
  expect(playback.preview).toHaveBeenCalledWith(clip.segments)
  video.restore(6338, true)
  expect(playback.playSource).toHaveBeenCalledWith(6338)
})
