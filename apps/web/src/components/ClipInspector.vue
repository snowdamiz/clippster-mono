<template>
  <section v-if="draft" class="grid gap-4 border-t border-white/10 p-4">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">Clip settings</h3>
      <span v-if="dirty" class="text-xs text-amber-300">Unsaved changes</span>
    </div>
    <label class="grid gap-1.5 text-xs text-zinc-400">
      Name
      <input v-model="draft.name" class="field" maxlength="120" :disabled="busy" />
    </label>
    <div v-for="(segment, index) in draft.segments" :key="index" class="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <label class="grid gap-1.5 text-xs text-zinc-400">
        Start (seconds)
        <input
          v-model.number="segment.start_time"
          class="field"
          type="number"
          min="0"
          :max="duration"
          step="0.1"
          :disabled="busy"
        />
      </label>
      <label class="grid gap-1.5 text-xs text-zinc-400">
        End (seconds)
        <input
          v-model.number="segment.end_time"
          class="field"
          type="number"
          min="0.1"
          :max="duration"
          step="0.1"
          :disabled="busy"
        />
      </label>
      <button
        class="button-secondary mb-0.5"
        aria-label="Remove segment"
        :disabled="busy || draft.segments.length === 1"
        @click="draft.segments.splice(index, 1)"
      >
        <X :size="14" />
      </button>
    </div>
    <div class="flex gap-2">
      <button class="button-secondary flex-1 text-xs" :disabled="busy" @click="setStart">Set start at playhead</button>
      <button class="button-secondary flex-1 text-xs" :disabled="busy" @click="setEnd">Set end at playhead</button>
    </div>
    <button class="button-secondary text-xs" :disabled="busy || draft.segments.length >= 20" @click="addSegment">
      <Plus :size="14" />
      Add segment at playhead
    </button>
    <label class="grid gap-1.5 text-xs text-zinc-400">
      Aspect ratio
      <select v-model="draft.aspectRatio" class="field" :disabled="busy">
        <option value="9:16">9:16 · Vertical</option>
        <option value="16:9">16:9 · Landscape</option>
      </select>
    </label>
    <label class="flex items-center gap-2 text-sm">
      <input v-model="draft.captions" type="checkbox" :disabled="busy || !hasWords" />
      Burn in captions
    </label>
    <p v-if="!hasWords" class="text-xs text-zinc-500">Run AI detection to generate captions.</p>
    <div class="grid grid-cols-2 gap-2">
      <button class="button-secondary" :disabled="busy || !dirty" @click="$emit('save')">
        <Save :size="15" />
        Save
      </button>
      <button class="button-secondary" :disabled="busy || !dirty" @click="$emit('revert')">
        <Undo2 :size="15" />
        Revert
      </button>
    </div>
    <button class="button-primary justify-center" :disabled="busy" @click="$emit('build')">
      <Clapperboard :size="16" />
      {{ dirty ? 'Save & build clip' : 'Build clip' }}
    </button>
    <a v-if="downloadUrl && !dirty" :href="downloadUrl" class="button-secondary" download>
      <Download :size="16" />
      Download MP4
    </a>
    <button class="text-xs text-red-300" :disabled="busy" @click="$emit('remove')">Delete clip</button>
  </section>
</template>
<script setup lang="ts">
  import { X, Plus, Save, Undo2, Clapperboard, Download } from 'lucide-vue-next'
  import type { WebClip } from '@clippster/shared-types'
  const draft = defineModel<WebClip | null>({ required: true })
  const props = defineProps<{
    busy: boolean
    duration: number
    time: number
    dirty: boolean
    hasWords: boolean
    downloadUrl?: string
  }>()
  defineEmits<{ save: []; revert: []; build: []; remove: [] }>()
  function setStart() {
    if (draft.value) draft.value.segments[0].start_time = Math.round(props.time * 10) / 10
  }
  function setEnd() {
    if (draft.value) draft.value.segments[draft.value.segments.length - 1].end_time = Math.round(props.time * 10) / 10
  }
  function addSegment() {
    if (draft.value) {
      const start = Math.min(props.time, props.duration - 0.1)
      const end = Math.min(start + 10, props.duration)
      draft.value.segments.push({ start_time: start, end_time: end, duration: end - start, transcript: null })
    }
  }
</script>
