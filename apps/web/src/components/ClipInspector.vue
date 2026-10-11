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
    <button class="button-secondary" :disabled="busy" @click="$emit('framing')">Manual framing / POI</button>
    <label class="flex items-center gap-2 text-sm">
      <input v-model="draft.captions" type="checkbox" :disabled="busy || !hasWords" />
      Burn in captions
    </label>
    <fieldset v-if="draft.captions" class="grid gap-3" :disabled="busy">
      <legend class="mb-2 text-sm">Subtitle styling</legend>
      <SubtitlePropertiesPanel :settings="settings" :segments="[]" variant="embedded" @update-settings="updateSubtitles" @delete="draft.captions = false" />
    </fieldset>
    <p v-if="!hasWords" class="text-xs text-zinc-500">Run AI detection to generate captions.</p>
    <fieldset v-if="brandingAssets.length || creatorProfiles.length" class="grid gap-3" :disabled="busy">
      <legend class="mb-2">Creator branding</legend>
      <label class="text-xs">Creator preset<select :value="draft.branding?.creatorId || ''" class="field" @change="setBranding('creatorId', ($event.target as HTMLSelectElement).value)"><option value="">None</option><option v-for="profile in creatorProfiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option></select></label>
      <label v-for="kind in ['intro', 'outro', 'watermark'] as const" :key="kind" class="text-xs capitalize">{{ kind }}<select :value="draft.branding?.[`${kind}Id`] || ''" class="field" @change="setBranding(`${kind}Id`, ($event.target as HTMLSelectElement).value)"><option value="">Creator default / none</option><option v-for="asset in brandingAssets.filter(asset => asset.asset_type === kind)" :key="asset.id" :value="asset.id">{{ asset.name }}</option></select></label>
      <template v-if="draft.branding">
        <label class="text-xs">Watermark size<input v-model.number="draft.branding.watermarkWidth" type="range" min="0.02" max="0.8" step="0.01" class="w-full" /></label>
        <label class="text-xs">Watermark horizontal position<input v-model.number="draft.branding.watermarkX" type="range" min="0" max="1" step="0.01" class="w-full" /></label>
        <label class="text-xs">Watermark vertical position<input v-model.number="draft.branding.watermarkY" type="range" min="0" max="1" step="0.01" class="w-full" /></label>
      </template>
      <p class="text-xs text-zinc-400">Branding is applied when building. Review the built MP4 before publishing. Free plan branding is applied automatically.</p>
    </fieldset>
    <button v-if="!draft.textBox" class="button-secondary" :disabled="busy" @click="addText">Add text overlay</button>
    <fieldset v-else class="grid gap-3" :disabled="busy">
      <legend>Text overlay</legend>
      <ClipTextBoxPropertiesPanel :state="draft.textBox" :clip-duration="clipDuration" variant="embedded" @update-state="updateText" @delete="draft.textBox = null" />
      <template v-if="draft.textBox"><label class="text-xs">Horizontal position<input v-model.number="draft.textBox.positionX" class="w-full" type="range" min="0" max="100" /></label><label class="text-xs">Vertical position<input v-model.number="draft.textBox.positionY" class="w-full" type="range" min="0" max="100" /></label><label class="text-xs">Text box width<input v-model.number="draft.textBox.widthPct" class="w-full" type="range" min="10" max="100" /></label></template>
    </fieldset>
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
  import { createDefaultSubtitleSettings, createDefaultClipTextBoxState } from '@clippster/shared-types'
  import { computed, ref, onMounted } from 'vue'
  import { workspaceClient } from '../api'
  import SubtitlePropertiesPanel from '@/components/SubtitlePropertiesPanel.vue'
  import type { SubtitleSettings } from '@clippster/shared-types'
  import type { ClipTextBoxState } from '@clippster/shared-types'
  import ClipTextBoxPropertiesPanel from '@/components/ClipTextBoxPropertiesPanel.vue'
  const draft = defineModel<WebClip | null>({ required: true })
  const props = defineProps<{
    busy: boolean
    duration: number
    time: number
    dirty: boolean
    hasWords: boolean
    downloadUrl?: string
  }>()
  defineEmits<{ save: []; revert: []; build: []; remove: []; framing: [] }>()
  const settings = computed(() => new Proxy(
    { ...createDefaultSubtitleSettings(), fontFamily: 'DejaVu Sans', animationStyle: 'single-word' as const, ...draft.value?.subtitleSettings },
    { set(target, key, value) {
      if (draft.value) draft.value.subtitleSettings = { ...target, [key]: value }
      return true
    } }
  ))
  function updateSubtitles(patch: Partial<SubtitleSettings>) { if (draft.value) draft.value.subtitleSettings = { ...settings.value, ...patch } }
  function updateText(patch: Partial<ClipTextBoxState>) { if (draft.value?.textBox) draft.value.textBox = { ...draft.value.textBox, ...patch } }
  const clipDuration = computed(() => draft.value?.segments.reduce((sum, segment) => sum + segment.end_time - segment.start_time, 0) || 0)
  function addText() { if (!draft.value) return; const box = createDefaultClipTextBoxState(clipDuration.value); box.style.fontFamily = 'DejaVu Sans'; box.style.backgroundEnabled = false; box.style.color = '#FFFFFF'; box.style.textTransform = 'none'; draft.value.textBox = box }
  const brandingAssets = ref<Array<{ id: number; name: string; asset_type: string }>>([])
  const creatorProfiles = ref<Array<{ id: number; name: string }>>([])
  function setBranding(key: 'creatorId' | 'introId' | 'outroId' | 'watermarkId', value: string) {
    if (!draft.value) return
    draft.value.branding ||= { watermarkX: 0.95, watermarkY: 0.05, watermarkWidth: 0.15 }
    draft.value.branding[key] = value ? Number(value) : undefined
  }
  onMounted(async () => { try { const data = await workspaceClient.get<{ assets: typeof brandingAssets.value; profiles: typeof creatorProfiles.value }>('/web/account/user/branding'); brandingAssets.value = data.assets; creatorProfiles.value = data.profiles } catch { /* Personal branding is optional; account errors are shown by its management page. */ } })
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
