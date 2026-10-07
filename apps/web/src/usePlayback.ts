import { ref, onUnmounted } from 'vue'
import type { ClipSegment } from '@clippster/shared-types'
export function usePlayback() {
  const element = ref<HTMLVideoElement>()
  const time = ref(0)
  const playing = ref(false)
  const volume = ref(1)
  const muted = ref(false)
  let segments: ClipSegment[] = []
  let segmentIndex = 0
  let playGeneration = 0
  function ready(video: HTMLVideoElement) {
    element.value = video
    video.volume = volume.value
    video.muted = muted.value
  }
  async function play() {
    const video = element.value
    if (!video) return
    const generation = ++playGeneration
    try {
      await video.play()
      if (generation === playGeneration) playing.value = true
    } catch {
      if (generation === playGeneration) playing.value = false
    }
  }
  function pause() {
    playGeneration++
    element.value?.pause()
    playing.value = false
  }
  function seek(value: number) {
    const index = segments.findIndex((segment) => value < segment.end_time)
    segmentIndex = index < 0 ? Math.max(0, segments.length - 1) : index
    if (element.value) {
      element.value.currentTime = value
      time.value = value
    }
  }
  function update() {
    if (!element.value) return
    time.value = element.value.currentTime
    if (playing.value && segments.length && time.value >= segments[segmentIndex].end_time - 0.02) {
      if (segmentIndex + 1 < segments.length) {
        segmentIndex++
        seek(segments[segmentIndex].start_time)
      } else pause()
    }
  }
  function preview(items: ClipSegment[]) {
    segments = items
    segmentIndex = 0
    seek(items[0]?.start_time || 0)
    void play()
  }
  function toggle() {
    if (playing.value) pause()
    else {
      if (segments.length && time.value >= segments[segments.length - 1].end_time - 0.05) {
        segmentIndex = 0
        seek(segments[0].start_time)
      }
      void play()
    }
  }
  function setVolume(value: number) {
    volume.value = value
    if (element.value) element.value.volume = value
  }
  function toggleMute() {
    muted.value = !muted.value
    if (element.value) element.value.muted = muted.value
  }
  function select(items: ClipSegment[]) {
    pause()
    segments = items
    segmentIndex = 0
    seek(items[0]?.start_time || 0)
  }
  onUnmounted(pause)
  return {
    element,
    time,
    playing,
    volume,
    muted,
    ready,
    update,
    seek,
    select,
    preview,
    pause,
    toggle,
    setVolume,
    toggleMute
  }
}
