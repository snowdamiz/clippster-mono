<template>
  <dialog ref="dialog" aria-label="Manual framing" class="m-auto h-[90dvh] w-[96vw] max-w-6xl overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 p-6 text-white backdrop:bg-black/80" @cancel.prevent="$emit('close')" @pointerup="history.commit" @change="history.commit" @keydown="keyboard">
    <header class="mb-5 flex items-center justify-between"><div><h2 class="text-xl font-semibold">Manual framing</h2><p class="text-sm text-zinc-400">Select source regions and arrange them in the output frame.</p></div><button class="button-secondary" @click="$emit('close')">Close</button></header>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <select v-model="segmentId" class="field w-auto" aria-label="Framing segment"><option value="">Default layout</option><option v-for="segment in config.segmentConfigs" :key="segment.segmentId" :value="segment.segmentId">{{ segment.startTime.toFixed(1) }}–{{ segment.endTime.toFixed(1) }} seconds</option></select>
      <button class="button-secondary" :disabled="regions.length >= 6" @click="add">Add region</button>
      <button class="button-secondary" @click="newSegment">Add timed layout</button>
      <button v-if="segmentId" class="button-secondary" @click="deleteSegment">Delete timed layout</button>
      <button class="button-secondary" @click="toggle">{{ playing ? 'Pause' : 'Play' }}</button>
      <button class="button-secondary" :disabled="!history.canUndo.value" @click="history.undo">Undo</button>
      <button class="button-secondary" :disabled="!history.canRedo.value" @click="history.redo">Redo</button>
      <button class="button-secondary" :disabled="!regions.length" @click="stack">Stack regions</button>
      <label class="text-xs">Safe zones<select v-model="safeZone" class="field"><option value="">Off</option><option v-for="preset in SOCIAL_OVERLAY_PRESETS" :key="preset.platform" :value="preset.platform">{{ preset.label }}</option></select></label>
    </div>
    <fieldset class="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-white/10 p-3">
      <legend class="text-sm">Source background</legend>
      <label class="text-xs">Mode<select v-model="config.sourceFrameMode" class="field"><option value="none">None</option><option value="scale">Scale source</option><option value="use16x9">Source with full background</option></select></label>
      <label class="text-xs">Scale<input v-model.number="config.sourceTransform!.scale" class="field" type="number" min="0.1" max="4" step="0.05" /></label>
      <label class="text-xs">Horizontal offset<input v-model.number="config.sourceTransform!.x" class="field" type="range" min="-1" max="1" step="0.01" /></label>
      <label class="text-xs">Vertical offset<input v-model.number="config.sourceTransform!.y" class="field" type="range" min="-1" max="1" step="0.01" /></label>
      <label class="text-sm"><input v-model="config.blurEnabled" type="checkbox" /> Blur</label>
      <label v-if="config.blurEnabled" class="text-xs">Blur amount<input v-model.number="config.blurAmount" class="field" type="number" min="0" max="30" /></label>
    </fieldset>
    <fieldset v-if="selected" class="mb-4 flex flex-wrap items-end gap-4 rounded-lg border border-white/10 p-3">
      <legend class="text-sm">{{ selected.label || 'Selected region' }}</legend>
      <label class="text-xs">Label<input v-model="selected.label" class="field" maxlength="80" /></label>
      <label class="text-sm"><input v-model="selected.aspectRatioLocked" type="checkbox" /> Lock aspect ratio</label>
      <label class="text-sm"><input v-model="selected.cornerRadiusEnabled" type="checkbox" /> Rounded corners</label>
      <label v-if="selected.cornerRadiusEnabled" class="text-xs">Radius (px)<input v-model.number="selected.cornerRadiusPx" class="field" type="number" min="0" max="500" /></label>
      <label class="text-xs">Region media<select :value="selected.mediaAssetId || ''" class="field" @change="selectMedia(($event.target as HTMLSelectElement).value)"><option value="">Source video</option><option v-for="asset in media.assets.value" :key="asset.id" :value="asset.id">{{ asset.name }}</option></select></label>
    </fieldset>
    <div class="mb-4 flex flex-wrap items-center gap-3"><label class="button-secondary">{{ media.uploading.value ? 'Uploading…' : 'Upload image / video' }}<input type="file" class="hidden" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" :disabled="media.uploading.value" @change="media.upload(($event.target as HTMLInputElement).files?.[0])" /></label><span class="text-xs text-zinc-400">Up to 128 MB per asset. Uploaded media can be used in timed layouts.</span><p v-if="media.error.value" role="alert" class="text-sm text-red-300">{{ media.error.value }}</p></div>
    <POIBrollPanel v-model="config" :assets="media.assets.value" :words="clipWords" :duration="duration" :time="time" :uploading="media.uploading.value" :import-stock="media.importStock" />
    <div v-if="activeSegment" class="mb-4 flex gap-4">
      <label>Start<input v-model.number="activeSegment.startTime" class="field" type="number" min="0" :max="duration" step="0.1" /></label>
      <label>End<input v-model.number="activeSegment.endTime" class="field" type="number" min="0.1" :max="duration" step="0.1" /></label>
    </div>
    <div class="grid items-start gap-6 lg:grid-cols-2">
      <section><h3 class="mb-3 text-sm">Source</h3><div ref="sourceBox" class="relative w-full overflow-hidden bg-black" :style="{ aspectRatio: `${width}/${height}` }">
        <video ref="video" :src="source" class="h-full w-full" playsinline @loadeddata="seek(0)" @timeupdate="updateTime" @ended="playing = false" />
        <POIRegion v-for="region in regions.filter(r => !r.mediaAssetId)" :key="region.id" :rect="region.source" :color="region.color" :label="region.label" :is-selected="selectedId === region.id" :container-width="sourceSize.width" :container-height="sourceSize.height" :aspect-ratio-locked="region.aspectRatioLocked ?? false" @select="selectedId = region.id" @update="region.source = $event" @delete="remove(region.id)" />
      </div></section>
      <section><h3 class="mb-3 text-sm">Output · {{ ratio }}</h3><div ref="outputBox" class="relative mx-auto max-h-[55vh] overflow-hidden bg-black" :style="{ aspectRatio: ratio.replace(':', '/'), height: '50vh' }">
        <canvas ref="canvas" class="h-full w-full" />
        <div v-if="safePreset" class="pointer-events-none absolute z-10 border-2 border-dashed border-amber-400/70" :style="{ top: `${safePreset.safeZone.top * 100}%`, bottom: `${safePreset.safeZone.bottom * 100}%`, left: `${safePreset.safeZone.left * 100}%`, right: `${safePreset.safeZone.right * 100}%` }"><span class="bg-black/70 text-xs text-amber-200">{{ safePreset.label }} safe zone · preview only</span></div>
        <POIRegion v-for="region in regions" :key="region.id" :rect="region.output" :color="region.color" :label="region.label" :is-selected="selectedId === region.id" :container-width="outputSize.width" :container-height="outputSize.height" :aspect-ratio-locked="region.aspectRatioLocked ?? false" @select="selectedId = region.id" @update="region.output = $event" @delete="remove(region.id)" />
      </div></section>
    </div>
    <label class="mt-5 block text-sm">Clip time · {{ time.toFixed(1) }}s<input class="mt-2 w-full accent-cyan-400" type="range" min="0" :max="duration" step="0.05" :value="time" @input="seek(Number(($event.target as HTMLInputElement).value))" /></label>
    <p class="my-4 text-xs text-zinc-400">Timed layouts use the assembled clip's time. Regions are draggable and resizable in both panels.</p>
    <footer class="flex justify-end gap-3"><button class="button-secondary" @click="$emit('close')">Cancel</button><button class="button-primary" @click="$emit('confirm', config)">Apply layout</button></footer>
  </dialog>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { createDefaultManualFramingConfig, createDefaultManualRegion } from '@clippster/shared-types'
import type { ManualFramingConfig, ClipSegment, WordInfo } from '@clippster/shared-types'
import POIBrollPanel from './POIBrollPanel.vue'
import POIRegion from '@/components/poi/POIRegion.vue'
import { usePOIHistory } from '../composables/usePOIHistory'
import { usePOIMedia } from '../composables/usePOIMedia'
import { drawPOIPreview } from '../composables/drawPOIPreview'
import { SOCIAL_OVERLAY_PRESETS } from '@/editor/constants/social-overlay-constants'
const props = defineProps<{ projectId: string; source: string; width: number; height: number; ratio: string; initialConfig?: ManualFramingConfig | null; segments: ClipSegment[]; words: WordInfo[] }>()
defineEmits<{ close: []; confirm: [config: ManualFramingConfig] }>()
const dialog = ref<HTMLDialogElement>(), video = ref<HTMLVideoElement>(), canvas = ref<HTMLCanvasElement>(), sourceBox = ref<HTMLElement>(), outputBox = ref<HTMLElement>()
const sourceSize = ref({ width: 1, height: 1 }), outputSize = ref({ width: 1, height: 1 })
const config = ref<ManualFramingConfig>(JSON.parse(JSON.stringify(props.initialConfig || createDefaultManualFramingConfig(props.ratio))))
config.value.targetAspectRatio = props.ratio; config.value.sourceAspectRatio = `${props.width}:${props.height}`
config.value.sourceTransform ||= { scale: 1, x: 0, y: 0 }
config.value.sourceFrameMode ||= 'none'
const history = usePOIHistory(config), media = usePOIMedia(props.projectId), safeZone = ref('')
const safePreset = computed(() => SOCIAL_OVERLAY_PRESETS.find(preset => preset.platform === safeZone.value))
const segmentId = ref(''), selectedId = ref(''), playing = ref(false), time = ref(0)
const duration = computed(() => props.segments.reduce((sum, segment) => sum + segment.end_time - segment.start_time, 0))
const clipWords = computed(() => { let offset = 0; return props.segments.flatMap(segment => { const words = props.words.filter(word => word.end > segment.start_time && word.start < segment.end_time).map(word => ({ ...word, start: offset + Math.max(0, word.start - segment.start_time), end: offset + Math.min(segment.end_time - segment.start_time, word.end - segment.start_time) })); offset += segment.end_time - segment.start_time; return words }) })
const activeSegment = computed(() => config.value.segmentConfigs?.find(segment => segment.segmentId === segmentId.value))
const regions = computed(() => activeSegment.value?.regions || config.value.regions)
const selected = computed(() => regions.value.find(region => region.id === selectedId.value))
function keyboard(event: KeyboardEvent) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? history.redo() : history.undo() } }
function stack() { regions.value.forEach((region, index) => { region.output = { x: 0, y: index / regions.value.length, width: 1, height: 1 / regions.value.length } }); history.commit() }
function selectMedia(id: string) { if (!selected.value) return; const asset = media.assets.value.find(asset => asset.id === id); selected.value.mediaAssetId = asset?.id; selected.value.mediaType = asset?.type || 'video-crop'; selected.value.source = { x: 0, y: 0, width: 1, height: 1 }; history.commit() }
function add() { const region = createDefaultManualRegion(regions.value.length); region.id = crypto.randomUUID(); regions.value.push(region); selectedId.value = region.id }
function remove(id: string) { const list = regions.value; list.splice(list.findIndex(region => region.id === id), 1) }
function newSegment() { const segment = { segmentId: crypto.randomUUID(), startTime: time.value, endTime: Math.min(duration.value, time.value + 5), regions: JSON.parse(JSON.stringify(regions.value)) }; (config.value.segmentConfigs ||= []).push(segment); segmentId.value = segment.segmentId }
function deleteSegment() { config.value.segmentConfigs = config.value.segmentConfigs?.filter(segment => segment.segmentId !== segmentId.value); segmentId.value = '' }
function seek(value: number) {
  time.value = value; let offset = value
  for (const segment of props.segments) { const length = segment.end_time - segment.start_time; if (offset <= length) { if (video.value) video.value.currentTime = segment.start_time + offset; return }; offset -= length }
}
function updateTime() {
  const element = video.value; if (!element) return
  let offset = 0
  for (let i = 0; i < props.segments.length; i++) { const segment = props.segments[i]; const length = segment.end_time - segment.start_time
    if (element.currentTime >= segment.start_time && element.currentTime <= segment.end_time + 0.15) {
      time.value = offset + Math.min(length, element.currentTime - segment.start_time)
      if (playing.value && element.currentTime >= segment.end_time) { if (props.segments[i + 1]) element.currentTime = props.segments[i + 1].start_time; else { element.pause(); playing.value = false } }; return
    }; offset += length
  }
}
async function toggle() { if (!video.value) return; if (playing.value) video.value.pause(); else { if (time.value >= duration.value) seek(0); await video.value.play() }; playing.value = !playing.value }
let frame = 0; let observer: ResizeObserver | undefined
function draw() {
  const context = canvas.value?.getContext('2d'), element = video.value
  if (context && element && element.readyState >= 2) {
    drawPOIPreview(context, element, config.value, regions.value, media.elements, time.value)
  }; frame = requestAnimationFrame(draw)
}
onMounted(() => { dialog.value?.showModal(); void media.load(); observer = new ResizeObserver(() => { if (sourceBox.value) sourceSize.value = { width: sourceBox.value.clientWidth, height: sourceBox.value.clientHeight }; if (outputBox.value && canvas.value) { outputSize.value = { width: outputBox.value.clientWidth, height: outputBox.value.clientHeight }; canvas.value.width = outputSize.value.width; canvas.value.height = outputSize.value.height } }); if (sourceBox.value) observer.observe(sourceBox.value); if (outputBox.value) observer.observe(outputBox.value); draw() })
onUnmounted(() => { cancelAnimationFrame(frame); observer?.disconnect(); video.value?.pause() })
</script>
