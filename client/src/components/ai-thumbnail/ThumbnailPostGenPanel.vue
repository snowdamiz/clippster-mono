<template>
  <div class="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
    <div class="mb-3 flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Post-gen tools</p>
      <span class="text-[10px] text-zinc-600">Uses working thumbnail</span>
    </div>

    <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <button
        v-for="tool in tools"
        :key="tool.id"
        type="button"
        class="rounded-lg border border-white/10 px-2 py-2 text-left text-[11px] font-medium text-zinc-200 hover:border-sky-500/40 hover:bg-sky-500/10 disabled:opacity-50"
        :disabled="busy || !imageUrl"
        @click="openTool(tool.id)"
      >
        <span class="block">{{ tool.label }}</span>
        <span class="mt-0.5 block text-[10px] font-normal text-zinc-500">{{ tool.hint }}</span>
      </button>
    </div>

    <div v-if="activeTool" class="space-y-2 rounded-lg border border-white/10 bg-zinc-900/50 p-3">
      <p class="text-xs font-semibold text-zinc-200">{{ activeToolMeta?.label }}</p>

      <textarea
        v-if="needsPrompt"
        v-model="prompt"
        rows="2"
        class="field w-full"
        :placeholder="promptPlaceholder"
      />

      <input
        v-if="activeTool === 'face-swap'"
        v-model="faceUrl"
        type="url"
        class="field w-full"
        placeholder="Face image URL"
      />

      <input
        v-if="activeTool === 'combine'"
        v-model="secondUrl"
        type="url"
        class="field w-full"
        placeholder="Second image URL"
      />

      <div v-if="activeTool === 'variations'" class="flex gap-2">
        <select v-model.number="variationCount" class="field flex-1">
          <option :value="2">2</option>
          <option :value="4">4</option>
          <option :value="6">6</option>
          <option :value="10">10</option>
        </select>
      </div>

      <div v-if="activeTool === 'color-enhance'" class="flex gap-2">
        <select v-model="preset" class="field flex-1">
          <option v-for="p in presets" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="intensity" class="field w-28">
          <option value="light">light</option>
          <option value="medium">medium</option>
          <option value="strong">strong</option>
        </select>
      </div>

      <div v-if="activeTool === 'upscale'" class="flex gap-2">
        <select v-model="scale" class="field flex-1">
          <option value="2x">2x</option>
          <option value="4x">4x</option>
        </select>
      </div>

      <div v-if="critiqueResult" class="max-h-40 overflow-y-auto rounded bg-black/30 p-2 text-[11px] text-zinc-300">
        <p class="font-semibold text-sky-300">Score {{ critiqueResult.overallScore }}</p>
        <p class="mt-1">{{ critiqueResult.summary }}</p>
      </div>

      <div v-if="overlayResult" class="rounded bg-black/30 p-2 text-[11px] text-zinc-300">
        {{ overlayResult }}
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" class="text-xs text-zinc-500 hover:text-zinc-300" @click="activeTool = null">
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          :disabled="busy || !canRun"
          @click="run"
        >
          {{ busy ? 'Working…' : 'Run' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { thumbnailPostGen } from '@/services/aiThumbnailApi';

const props = defineProps<{
  sessionId: number;
  imageUrl: string | null;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (e: 'done', payload: Record<string, unknown>): void;
  (e: 'error', message: string): void;
  (e: 'busy', value: boolean): void;
}>();

const tools = [
  { id: 'critique', label: 'Critique', hint: '4 credits' },
  { id: 'variations', label: 'Variations', hint: '2 each' },
  { id: 'optimize', label: 'Optimize', hint: '8 credits' },
  { id: 'text-overlay', label: 'Text overlay', hint: 'Free' },
  { id: 'edit', label: 'AI edit', hint: '4 credits' },
  { id: 'face-swap', label: 'Face swap', hint: '4 credits' },
  { id: 'bg-remove', label: 'BG remove', hint: 'Free' },
  { id: 'bg-replace', label: 'BG replace', hint: '4 credits' },
  { id: 'color', label: 'Color enhance', hint: 'Free' },
  { id: 'upscale', label: 'Upscale', hint: 'Free' },
  { id: 'filter', label: 'Filter', hint: 'Free' },
  { id: 'combine', label: 'Combine', hint: '4 credits' },
] as const;

type ToolId = (typeof tools)[number]['id'];

const activeTool = ref<ToolId | null>(null);
const prompt = ref('');
const faceUrl = ref('');
const secondUrl = ref('');
const variationCount = ref(4);
const preset = ref('cinematic');
const intensity = ref('medium');
const scale = ref('2x');
const critiqueResult = ref<Record<string, unknown> | null>(null);
const overlayResult = ref<string | null>(null);
const localBusy = ref(false);

const presets = ['vibrant', 'dramatic', 'warm', 'cool', 'high-contrast', 'cinematic'];

const busy = computed(() => props.busy || localBusy.value);
const activeToolMeta = computed(() => tools.find((t) => t.id === activeTool.value));
const needsPrompt = computed(() =>
  ['optimize', 'edit', 'bg-replace', 'filter', 'combine'].includes(activeTool.value || ''),
);
const promptPlaceholder = computed(() => {
  switch (activeTool.value) {
    case 'optimize':
      return 'Rough idea for a viral thumbnail…';
    case 'bg-replace':
      return 'Background scene prompt…';
    case 'filter':
      return 'Filter / style prompt…';
    case 'combine':
      return 'How to combine the images…';
    default:
      return 'Describe the edit…';
  }
});

const canRun = computed(() => {
  if (!props.imageUrl && activeTool.value !== 'optimize') return false;
  if (activeTool.value === 'face-swap') return !!faceUrl.value.trim();
  if (activeTool.value === 'combine') return !!secondUrl.value.trim() && !!prompt.value.trim();
  if (needsPrompt.value) return !!prompt.value.trim();
  return true;
});

function openTool(id: ToolId) {
  activeTool.value = id;
  critiqueResult.value = null;
  overlayResult.value = null;
  prompt.value = '';
}

async function run() {
  if (!props.sessionId || !activeTool.value) return;
  localBusy.value = true;
  emit('busy', true);
  critiqueResult.value = null;
  overlayResult.value = null;
  try {
    const imageUrl = props.imageUrl || undefined;
    let result: Record<string, unknown>;
    switch (activeTool.value) {
      case 'critique':
        result = await thumbnailPostGen.critique(props.sessionId, { imageUrl, niche: 'general' });
        critiqueResult.value = result as any;
        break;
      case 'variations':
        result = await thumbnailPostGen.variations(props.sessionId, {
          imageUrl,
          count: variationCount.value,
        });
        break;
      case 'optimize':
        result = await thumbnailPostGen.optimize(props.sessionId, prompt.value.trim());
        break;
      case 'text-overlay':
        result = await thumbnailPostGen.textOverlay(props.sessionId, { imageUrl });
        overlayResult.value = String((result as any).textOverlayPrompt || '');
        break;
      case 'edit':
        result = await thumbnailPostGen.edit(props.sessionId, prompt.value.trim(), { imageUrl });
        break;
      case 'face-swap':
        result = await thumbnailPostGen.faceSwap(props.sessionId, faceUrl.value.trim(), { imageUrl });
        break;
      case 'bg-remove':
        result = await thumbnailPostGen.backgroundRemove(props.sessionId, { imageUrl });
        break;
      case 'bg-replace':
        result = await thumbnailPostGen.backgroundReplace(props.sessionId, prompt.value.trim(), {
          imageUrl,
        });
        break;
      case 'color':
        result = await thumbnailPostGen.colorEnhance(props.sessionId, preset.value, {
          imageUrl,
          intensity: intensity.value,
        });
        break;
      case 'upscale':
        result = await thumbnailPostGen.upscale(props.sessionId, scale.value, { imageUrl });
        break;
      case 'filter':
        result = await thumbnailPostGen.filter(props.sessionId, prompt.value.trim(), { imageUrl });
        break;
      case 'combine':
        result = await thumbnailPostGen.combine(
          props.sessionId,
          imageUrl!,
          secondUrl.value.trim(),
          prompt.value.trim(),
        );
        break;
      default:
        throw new Error('Unknown tool');
    }
    emit('done', result);
    if (!['critique', 'text-overlay'].includes(activeTool.value)) {
      activeTool.value = null;
    }
  } catch (e: any) {
    emit('error', e.response?.data?.error || e.message || 'Post-gen failed');
  } finally {
    localBusy.value = false;
    emit('busy', false);
  }
}
</script>

<style scoped>
@reference "../../style.css";
.field {
  @apply rounded-md border border-white/10 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500;
}
</style>
