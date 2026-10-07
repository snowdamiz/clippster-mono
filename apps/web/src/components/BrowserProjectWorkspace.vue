<template>
  <dialog
    ref="dialog"
    aria-label="Project workspace"
    class="m-auto h-[94dvh] max-h-[1100px] w-[96vw] max-w-[1800px] overflow-hidden rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-surface)] p-0 text-[var(--sidebar-text)] shadow-2xl backdrop:bg-black/80"
    @cancel.prevent="close"
  >
    <div class="flex h-full flex-col">
      <ProjectWorkspaceHeader :title="project.name" badge="Web workspace" @close="close" />
      <div
        v-if="error"
        role="alert"
        class="shrink-0 border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300"
      >
        {{ error }}
      </div>
      <div v-if="activeJob" role="status" class="shrink-0 border-b border-white/10 px-5 py-3">
        <div class="mb-2 flex justify-between text-xs">
          <span>{{ activeJob.message }}</span>
          <button
            v-if="activeJob.kind !== 'detect' || activeJob.status === 'queued'"
            @click="$emit('cancel', activeJob.id)"
          >
            Cancel
          </button>
        </div>
        <progress class="h-1.5 w-full accent-sky-400" :value="activeJob.progress" max="100" />
      </div>
      <div v-if="project.status !== 'ready'" class="min-h-0 flex-1 overflow-y-auto">
        <ImportSource
          :busy="busy"
          :upload-progress="uploadProgress"
          @import="(url) => $emit('import', url)"
          @upload="(file) => $emit('upload', file)"
        />
      </div>
      <div
        v-else
        class="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden"
      >
        <section class="flex min-h-[430px] min-w-0 flex-col gap-3 p-4 lg:min-h-0">
          <div class="flex items-center justify-between text-xs text-zinc-500">
            <span>Source preview</span>
            <span>{{ draft?.aspectRatio || '16:9' }} · {{ project.width }} × {{ project.height }}</span>
          </div>
          <div
            ref="previewContainer"
            class="relative min-h-[280px] flex-1 overflow-hidden rounded-xl bg-black lg:min-h-0"
          >
            <VideoPlayer
              :video-src="sourcePath(project.id)"
              :video-loading="loading"
              :video-error="videoError"
              :is-playing="playback.playing.value"
              :aspect-ratio="aspect"
              :current-time="playback.time.value"
              :subtitle-settings="subtitleSettings"
              :transcript-words="project.words"
              @video-element-ready="playback.ready"
              @time-update="playback.update"
              @toggle-play-pause="playback.toggle"
              @video-ended="playback.pause"
              @loaded-metadata="loading = false"
              @can-play="loading = false"
              @video-error="onVideoError"
              @retry-load="retry"
            />
          </div>
          <VideoControls
            :video-src="sourcePath(project.id)"
            :video-loading="loading"
            :is-playing="playback.playing.value"
            :current-time="playback.time.value"
            :duration="project.duration"
            :volume="playback.volume.value"
            :is-muted="playback.muted.value"
            @toggle-play-pause="playback.toggle"
            @go-to-beginning="playback.seek(0)"
            @toggle-mute="playback.toggleMute"
            @update-volume="playback.setVolume"
            @toggle-fullscreen="fullscreen"
          />
          <div class="rounded-lg border border-white/10 bg-black/20 p-3">
            <input
              type="range"
              aria-label="Video playhead"
              class="w-full accent-sky-400"
              min="0"
              :max="project.duration"
              step="0.01"
              :value="playback.time.value"
              @input="playback.seek(Number(($event.target as HTMLInputElement).value))"
            />
            <div class="relative mt-2 h-5 rounded bg-white/5">
              <button
                v-for="clip in project.clips"
                :key="clip.id"
                :aria-label="`Select ${clip.name}`"
                :title="clip.name"
                class="absolute h-5 min-w-1 rounded border border-sky-400/50 bg-sky-500/30"
                :class="{ 'bg-sky-400/70': selectedId === clip.id }"
                :style="{
                  left: `${(clip.segments[0].start_time / project.duration) * 100}%`,
                  width: `${((clip.segments.at(-1)!.end_time - clip.segments[0].start_time) / project.duration) * 100}%`
                }"
                @click="select(clip)"
              />
            </div>
          </div>
          <div class="flex flex-wrap justify-between gap-2">
            <button class="button-secondary" :disabled="!draft" @click="preview">
              <Play :size="15" />
              Preview clip
            </button>
            <button class="button-secondary" :disabled="busy" @click="$emit('manual', playback.time.value)">
              <Plus :size="15" />
              Create clip at playhead
            </button>
          </div>
        </section>
        <aside class="min-h-0 overflow-y-auto border-l border-white/10 bg-black/15">
          <form class="grid gap-3 border-b border-white/10 p-4" @submit.prevent="detect">
            <h3 class="flex items-center gap-2 text-sm font-semibold">
              <Sparkles :size="16" class="text-sky-400" />
              AI clip maker
            </h3>
            <label for="clip-prompt" class="text-xs text-zinc-400">What moments are you looking for?</label>
            <textarea
              id="clip-prompt"
              v-model="prompt"
              class="field resize-y"
              rows="3"
              maxlength="4000"
              required
              :disabled="busy"
            />
            <button class="button-primary justify-center" :disabled="busy || !project.hasAudio">
              <Sparkles :size="15" />
              Find clips
            </button>
            <p class="text-[11px] leading-relaxed text-zinc-500">
              Uses your Clippster AI credits. Review the clips before building.
            </p>
          </form>
          <section class="p-4">
            <div class="mb-3 flex justify-between text-sm">
              <h3 class="font-semibold">Clips</h3>
              <span class="text-zinc-500">{{ project.clips.length }}</span>
            </div>
            <p v-if="!project.clips.length" class="py-4 text-center text-xs leading-relaxed text-zinc-500">
              Find moments with AI or create a clip at the playhead.
            </p>
            <div class="grid gap-2">
              <button
                v-for="clip in project.clips"
                :key="clip.id"
                class="rounded-lg border p-3 text-left"
                :class="
                  selectedId === clip.id
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-white/5 bg-white/[.02] hover:bg-white/5'
                "
                @click="select(clip)"
              >
                <span class="block truncate text-sm">{{ clip.name }}</span>
                <span class="mt-1 block text-xs text-zinc-500">
                  {{ clip.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0).toFixed(1) }}s ·
                  {{ clip.aspectRatio }}
                  <span v-if="clip.builtRevision === clip.revision" class="text-emerald-400">· Built</span>
                </span>
              </button>
            </div>
          </section>
          <ClipInspector
            v-model="draft"
            :busy="busy"
            :duration="project.duration"
            :time="playback.time.value"
            :dirty="dirty"
            :has-words="project.words.length > 0"
            :download-url="downloadUrl"
            @save="save"
            @revert="revert"
            @build="build"
            @remove="remove"
          />
        </aside>
      </div>
    </div>
  </dialog>
</template>
<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { Play, Plus, Sparkles } from 'lucide-vue-next'
  import { createDefaultSubtitleSettings } from '@clippster/shared-types'
  import type { WebProject, WebClip, WebJob } from '@clippster/shared-types'
  import ProjectWorkspaceHeader from '@/components/ProjectWorkspaceHeader.vue'
  import VideoPlayer from '@/components/VideoPlayer.vue'
  import VideoControls from '@/components/VideoControls.vue'
  import ImportSource from './ImportSource.vue'
  import ClipInspector from './ClipInspector.vue'
  import { usePlayback } from '../usePlayback'
  import { sourcePath, downloadPath } from '../api'
  const props = defineProps<{
    project: WebProject
    busy: boolean
    error: string
    activeJob?: WebJob
    uploadProgress: number | null
  }>()
  const emit = defineEmits<{
    close: []
    import: [url: string]
    upload: [file: File]
    detect: [prompt: string]
    manual: [time: number]
    save: [clip: WebClip, build: boolean]
    build: [id: string]
    remove: [id: string]
    cancel: [id: string]
  }>()
  const dialog = ref<HTMLDialogElement>()
  const previewContainer = ref<HTMLElement>()
  const playback = usePlayback()
  const loading = ref(false)
  const videoError = ref<string | null>(null)
  const prompt = ref(
    'Find engaging, self-contained highlights between 15 and 60 seconds. Keep the original context and include a strong opening.'
  )
  const selectedId = ref<string | null>(null)
  const draft = ref<WebClip | null>(null)
  const original = ref('')
  const pendingSave = ref<{ id: string; revision: number } | null>(null)
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== original.value)
  const aspect = computed(() => {
    const [width, height] = (draft.value?.aspectRatio || '16:9').split(':').map(Number)
    return { width, height }
  })
  const subtitleSettings = computed(() => ({
    ...createDefaultSubtitleSettings(),
    enabled: !!draft.value?.captions,
    animationStyle: 'single-word' as const,
    fontFamily: 'DejaVu Sans, sans-serif'
  }))
  const downloadUrl = computed(() =>
    draft.value?.builtRevision === draft.value?.revision && draft.value
      ? downloadPath(props.project.id, draft.value.id)
      : undefined
  )
  function abandon() {
    return !dirty.value || window.confirm('Discard your unsaved clip changes?')
  }
  function select(clip: WebClip) {
    if (!abandon()) return
    selectedId.value = clip.id
    draft.value = JSON.parse(JSON.stringify(clip))
    original.value = JSON.stringify(draft.value)
    playback.select(clip.segments)
  }
  function revert() {
    const clip = props.project.clips.find((clip) => clip.id === selectedId.value)
    if (clip) {
      draft.value = JSON.parse(JSON.stringify(clip))
      original.value = JSON.stringify(draft.value)
    }
  }
  watch(
    () => props.project.clips,
    (clips, previous) => {
      if (previous && clips.length > previous.length && !dirty.value) {
        select(clips.at(-1)!)
        return
      }
      const clip = clips.find((item) => item.id === selectedId.value)
      if (!clip) {
        if (clips.length) select(clips.at(-1)!)
        else {
          draft.value = null
          selectedId.value = null
        }
      } else if (!dirty.value || (pendingSave.value?.id === clip.id && pendingSave.value.revision === clip.revision)) {
        draft.value = JSON.parse(JSON.stringify(clip))
        original.value = JSON.stringify(draft.value)
        pendingSave.value = null
      }
    },
    { immediate: true }
  )
  watch(
    () => props.error,
    (error) => {
      if (error) pendingSave.value = null
    }
  )
  function save(build = false) {
    if (draft.value) {
      pendingSave.value = { id: draft.value.id, revision: draft.value.revision + 1 }
      emit('save', JSON.parse(JSON.stringify(draft.value)), build)
    }
  }
  function build() {
    if (!draft.value) return
    if (dirty.value) save(true)
    else emit('build', draft.value.id)
  }
  function remove() {
    if (draft.value && window.confirm(`Delete “${draft.value.name}”?`)) emit('remove', draft.value.id)
  }
  function preview() {
    if (draft.value) playback.preview(draft.value.segments)
  }
  function detect() {
    if (abandon()) {
      revert()
      emit('detect', prompt.value)
    }
  }
  function close() {
    if (props.uploadProgress !== null) return
    if (abandon()) {
      playback.pause()
      dialog.value?.close()
      emit('close')
    }
  }
  function fullscreen() {
    void previewContainer.value?.requestFullscreen().catch(() => {})
  }
  function onVideoError() {
    loading.value = false
    videoError.value = 'Unable to play the source. Try reloading it.'
  }
  function retry() {
    videoError.value = null
    playback.element.value?.load()
  }
  function keydown(event: KeyboardEvent) {
    if ((event.target as HTMLElement)?.matches('input, textarea, select, button')) return
    if (event.code === 'Space') {
      event.preventDefault()
      playback.toggle()
    }
  }
  function unload(event: BeforeUnloadEvent) {
    if (dirty.value || props.uploadProgress !== null) {
      event.preventDefault()
    }
  }
  onMounted(() => {
    dialog.value?.showModal()
    window.addEventListener('keydown', keydown)
    window.addEventListener('beforeunload', unload)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('beforeunload', unload)
  })
</script>
