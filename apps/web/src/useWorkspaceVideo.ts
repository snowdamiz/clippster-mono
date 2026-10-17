import { computed } from 'vue'
import type { WebClip, WebProject } from '@clippster/shared-types'
import type { usePlayback } from './usePlayback'
import { sourcePath } from './api'

/** The workspace edits source footage; exports are viewed from build history. */
export function useWorkspaceVideo(project: () => WebProject, playback: ReturnType<typeof usePlayback>) {
  const source = computed(() => sourcePath(project().id))
  const duration = computed(() => project().duration)
  const sourceTime = computed(() => playback.time.value)
  function restore(time = 0, play = false) {
    if (play) playback.playSource(time)
    else playback.seek(time)
  }
  function preview(clip: WebClip) { playback.preview(clip.segments) }
  function loaded() { playback.seek(playback.time.value) }
  return { source, duration, restore, preview, loaded, sourceTime }
}
