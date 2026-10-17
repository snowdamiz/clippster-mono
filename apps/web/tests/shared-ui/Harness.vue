<template>
  <main style="max-width: 900px; margin: 20px auto; background: var(--sidebar-surface); color: var(--sidebar-text)">
    <ProjectWorkspaceHeader title="Shared workspace test" badge="9:16 Pre-Edit" @close="closed = true" />
    <output aria-label="Closed">{{ closed }}</output>
    <div style="height: 480px; position: relative">
      <VideoPlayer
        video-src="/fixture.mp4"
        :video-loading="false"
        :video-error="null"
        :is-playing="playing"
        :aspect-ratio="{ width: 16, height: 9 }"
        :resolve-media-src="resolveMedia"
        :framing-regions="framing ? regions : []"
        :subtitle-settings="subtitles"
        :transcript-words="words"
        :transcript-segments="segments"
        :current-time="time"
        @video-element-ready="ready"
        @time-update="time = video?.currentTime || 0"
        @toggle-play-pause="toggle"
        @video-ended="playing = false"
      />
    </div>
    <VideoControls
      video-src="/fixture.mp4"
      :video-loading="false"
      :is-playing="playing"
      :current-time="time"
      :duration="4"
      :volume="volume"
      :is-muted="muted"
      @toggle-play-pause="toggle"
      @go-to-beginning="rewind"
      @toggle-mute="mute"
      @update-volume="setVolume"
      @toggle-fullscreen="fullscreen++"
    />
    <button @click="framing = !framing">Toggle image framing</button>
    <button @click="seekGap">Seek transcript gap</button>
    <output aria-label="Resolved assets">{{ resolved.join(',') }}</output>
    <output aria-label="Fullscreen requests">{{ fullscreen }}</output>
  </main>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import VideoPlayer from '@/components/VideoPlayer.vue'
  import VideoControls from '@/components/VideoControls.vue'
  import ProjectWorkspaceHeader from '@/components/ProjectWorkspaceHeader.vue'
  import { createDefaultManualRegion, createDefaultSubtitleSettings } from '@clippster/shared-types'
  const video = ref<HTMLVideoElement>()
  const playing = ref(false),
    time = ref(0),
    muted = ref(false),
    volume = ref(1)
  const closed = ref(false),
    framing = ref(false),
    fullscreen = ref(0)
  const resolved = ref<string[]>([])
  const subtitles = { ...createDefaultSubtitleSettings(), enabled: true, animationStyle: 'single-word' as const }
  const words = [{ word: 'Caption', start: 0, end: 4 }]
  const segments =
    new URLSearchParams(location.search).get('theme') === 'desktop'
      ? [{ id: 0, start: 0, end: 1, text: 'Caption' }]
      : []
  const regions = [
    {
      ...createDefaultManualRegion(0),
      mediaType: 'image' as const,
      mediaAssetId: '/desktop/local-image.svg',
      output: { x: 0, y: 0, width: 1, height: 1 }
    }
  ]
  function resolveMedia(path: string) {
    if (!resolved.value.includes(path)) resolved.value.push(path)
    return '/fixture.svg'
  }
  function ready(element: HTMLVideoElement) {
    video.value = element
  }
  async function toggle() {
    if (!video.value) return
    if (playing.value) video.value.pause()
    else await video.value.play()
    playing.value = !playing.value
  }
  function rewind() {
    if (video.value) video.value.currentTime = 0
  }
  function seekGap() {
    if (video.value) video.value.currentTime = 2
  }
  function mute() {
    muted.value = !muted.value
    if (video.value) video.value.muted = muted.value
  }
  function setVolume(value: number) {
    volume.value = value
    if (video.value) video.value.volume = value
  }
</script>
