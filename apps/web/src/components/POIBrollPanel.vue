<template>
  <details class="mb-4 rounded-lg border border-line p-3">
    <summary class="cursor-pointer text-sm font-semibold">B-roll · {{ config.brollConfigs?.length || 0 }} insertions</summary>
    <div class="mt-3 flex flex-wrap items-end gap-3">
      <label class="text-xs">Uploaded media<select v-model="assetId" class="field"><option value="">Choose media</option><option v-for="asset in assets" :key="asset.id" :value="asset.id">{{ asset.name }}</option></select></label>
      <button class="button-secondary" :disabled="!assetId || (config.brollConfigs?.length || 0) >= 30" @click="add">Add at playhead</button>
      <label class="text-xs">Density<select v-model="density" class="field"><option>low</option><option>medium</option><option>high</option></select></label>
      <label class="text-xs">Style<select v-model="style" class="field"><option>literal</option><option>metaphorical</option><option>mixed</option></select></label>
      <button class="button-secondary" :disabled="busy || !words.length" @click="suggest">{{ busy ? 'Loading…' : 'AI B-roll suggestions' }}</button>
    </div>
    <div v-for="part in config.brollConfigs" :key="part.brollId" class="mt-3 flex flex-wrap items-end gap-3">
      <span class="text-xs">{{ part.region.label }}</span><label class="text-xs">From<input v-model.number="part.startTime" type="number" min="0" :max="duration" step="0.1" class="field w-24" /></label><label class="text-xs">Until<input v-model.number="part.endTime" type="number" min="0.1" :max="duration" step="0.1" class="field w-24" /></label><label class="text-xs">Media offset<input v-model.number="part.region.mediaSourceOffset" type="number" min="0" max="600" step="0.1" class="field w-24" /></label><button class="button-secondary" @click="config.brollConfigs = config.brollConfigs?.filter(item => item !== part)">Remove</button>
    </div>
    <div v-for="item in suggestions" :key="item.id" class="mt-3 flex items-center gap-3 text-xs"><span>{{ item.startTime.toFixed(1) }}–{{ item.endTime.toFixed(1) }}s · {{ item.reason }}</span><button class="button-secondary" @click="query = item.visualQuery; placement = item; search()">Find {{ item.visualQuery }}</button></div>
    <div class="mt-4 flex gap-3"><input v-model="query" class="field" placeholder="Search stock media" aria-label="Search stock media" @keydown.enter.prevent="search" /><select v-model="mediaType" class="field w-auto" aria-label="Stock media type"><option>video</option><option>image</option><option>all</option></select><button class="button-secondary" :disabled="busy || !query.trim()" @click="search">Search</button></div>
    <p v-if="error" role="alert" class="mt-2 text-sm text-danger">{{ error }}</p>
    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4"><button v-for="candidate in candidates" :key="candidate.id" class="rounded-lg border border-line p-2 text-left text-xs" :disabled="busy || uploading" @click="apply(candidate)"><img :src="candidate.previewUrl" class="mb-2 h-24 w-full object-cover" referrerpolicy="no-referrer" />{{ candidate.attribution }} · {{ candidate.license }}<span class="mt-1 block text-brand">Import and add B-roll</span></button></div>
  </details>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { createDefaultManualRegion, type ManualFramingConfig, type WordInfo } from '@clippster/shared-types'
import type { AiBrollCandidate, AiBrollSuggestion } from '@/types/ai-broll'
import type { POIMediaAsset } from '../composables/usePOIMedia'
import { workspaceClient, errorMessage } from '../api'
const config = defineModel<ManualFramingConfig>({ required: true })
const props = defineProps<{ assets: POIMediaAsset[]; words: WordInfo[]; duration: number; time: number; uploading: boolean; importStock: (url: string, type: 'image' | 'video', name: string) => Promise<POIMediaAsset | undefined> }>()
const assetId = ref(''), query = ref(''), mediaType = ref('video'), density = ref('low'), style = ref('mixed'), busy = ref(false), error = ref('')
const suggestions = ref<AiBrollSuggestion[]>([]), candidates = ref<AiBrollCandidate[]>([]), placement = ref<AiBrollSuggestion | null>(null)
function add() {
  const asset = props.assets.find(item => item.id === assetId.value); if (!asset || props.time >= props.duration || (config.value.brollConfigs?.length || 0) >= 30) return
  const startTime = placement.value?.startTime ?? props.time, endTime = Math.min(props.duration, placement.value?.endTime ?? startTime + 4)
  const region = { ...createDefaultManualRegion(0), id: crypto.randomUUID(), label: `B-roll: ${asset.name}`.slice(0, 80), source: { x: 0, y: 0, width: 1, height: 1 }, output: { x: 0, y: 0, width: 1, height: 1 }, mediaAssetId: asset.id, mediaType: asset.type, mediaSourceOffset: 0 }
  ;(config.value.brollConfigs ||= []).push({ brollId: crypto.randomUUID(), startTime, endTime, region, suggestionId: placement.value?.id }); placement.value = null
}
async function suggest() { busy.value = true; error.value = ''; try { const result = await workspaceClient.post<{ suggestions: AiBrollSuggestion[] }>('/web/account/ai/broll/suggest', { clipId: 'browser', duration: props.duration, aspectRatio: config.value.targetAspectRatio, transcriptWords: props.words, density: density.value, style: style.value, sourceTypes: ['stock', 'library'] }); suggestions.value = result.suggestions } catch (cause) { error.value = errorMessage(cause) } finally { busy.value = false } }
async function search() { busy.value = true; error.value = ''; try { const result = await workspaceClient.get<{ candidates: AiBrollCandidate[] }>(`/web/account/ai/broll/search?${new URLSearchParams({ query: query.value, mediaType: mediaType.value, perPage: '8', orientation: config.value.targetAspectRatio === '9:16' ? 'portrait' : 'landscape' })}`); candidates.value = result.candidates } catch (cause) { error.value = errorMessage(cause) } finally { busy.value = false } }
async function apply(candidate: AiBrollCandidate) { const asset = await props.importStock(candidate.downloadUrl, candidate.mediaType, candidate.attribution); if (asset) { assetId.value = asset.id; add() } }
</script>
