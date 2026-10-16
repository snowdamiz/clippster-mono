import { ref, computed } from 'vue'
import type { WebClip, WebProject } from '@clippster/shared-types'
import type { usePlayback } from './usePlayback'
import { sourcePath, webApiPath } from './api'
export function useWorkspaceVideo(project: () => WebProject, playback: ReturnType<typeof usePlayback>, setRatio: (ratio: string) => void) {
  const builtClip = ref<WebClip | null>(null), duration = ref(project().duration)
  let autoplay = false
  let pendingSourceTime: number | null = null
  const source = computed(() => { const clip = builtClip.value, build = clip?.builds?.at(-1); return clip ? `${webApiPath}/projects/${project().id}/clips/${clip.id}/playback${build ? `?buildId=${build.id}` : ''}` : sourcePath(project().id) })
  function restore(time = 0, play = false) { if (!builtClip.value) { if (pendingSourceTime !== null) pendingSourceTime = time; return }; playback.pause(); pendingSourceTime = time; builtClip.value = null; autoplay = play; duration.value = project().duration; setRatio(project().vodPresetConfig?.targetAspectRatio || '16:9') }
  function preview(clip: WebClip) {
    if (clip.builtRevision !== clip.revision) { restore(); playback.preview(clip.segments); return }
    if (builtClip.value?.id === clip.id && builtClip.value.builds?.at(-1)?.id === clip.builds?.at(-1)?.id) { playback.playSource(0); return }
    playback.select([]); playback.seek(0); builtClip.value = clip; autoplay = true
    setRatio(clip.builds?.at(-1)?.aspectRatio || clip.aspectRatio)
  }
  function loaded() { duration.value = playback.element.value?.duration || project().duration; if (pendingSourceTime !== null) { playback.seek(pendingSourceTime); pendingSourceTime = null }; playback.element.value && (playback.element.value.currentTime = playback.time.value); if (autoplay) { autoplay = false; void playback.play() } }
  const sourceTime = computed(() => {
    if (!builtClip.value) return playback.time.value
    let left = playback.time.value
    for (const part of builtClip.value.segments) { const duration = part.end_time - part.start_time; if (left <= duration) return part.start_time + left; left -= duration }
    return builtClip.value.segments.at(-1)?.end_time || 0
  })
  return { builtClip, source, duration, restore, preview, loaded, sourceTime }
}
