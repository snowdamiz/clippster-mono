<template>
  <div class="flex flex-col h-full p-4">
    <h3 class="text-sm font-semibold mb-3">AI Generation</h3>

    <div class="space-y-4 flex-1">
      <div>
        <label class="block text-xs text-zinc-400 mb-2">Prompt</label>
        <textarea
          v-model="localPrompt"
          placeholder="Describe the video you want to create..."
          class="w-full h-32 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm resize-none focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label class="block text-xs text-zinc-400 mb-2">Aspect Ratio</label>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="ratio in aspectRatios"
            :key="ratio.value"
            @click="localAspectRatio = ratio.value"
            :class="[
              'px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              localAspectRatio === ratio.value
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700'
            ]"
          >
            {{ ratio.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs text-zinc-400 mb-2">Duration (seconds)</label>
        <input
          v-model.number="localDuration"
          type="number"
          min="1"
          max="300"
          class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label class="block text-xs text-zinc-400 mb-2">Style</label>
        <select
          v-model="localStyle"
          class="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Default</option>
          <option value="cinematic">Cinematic</option>
          <option value="energetic">Energetic</option>
          <option value="minimal">Minimal</option>
          <option value="dynamic">Dynamic</option>
        </select>
      </div>
    </div>

    <button
      @click="handleGenerate"
      :disabled="!canGenerate || isGenerating"
      class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg font-medium transition-colors"
    >
      <Wand2 v-if="!isGenerating" class="w-4 h-4 inline mr-2" />
      <Loader2 v-else class="w-4 h-4 inline mr-2 animate-spin" />
      {{ isGenerating ? 'Generating...' : 'Generate Video' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Wand2, Loader2 } from 'lucide-vue-next';

const props = defineProps<{
  prompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  duration: number;
  style: string;
  hasMedia: boolean;
  isGenerating: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:prompt', value: string): void;
  (e: 'update:aspectRatio', value: '16:9' | '9:16' | '1:1' | '4:5'): void;
  (e: 'update:duration', value: number): void;
  (e: 'update:style', value: string): void;
  (e: 'generate'): void;
}>();

const localPrompt = computed({
  get: () => props.prompt,
  set: (value) => emit('update:prompt', value),
});

const localAspectRatio = computed({
  get: () => props.aspectRatio,
  set: (value) => emit('update:aspectRatio', value),
});

const localDuration = computed({
  get: () => props.duration,
  set: (value) => emit('update:duration', value),
});

const localStyle = computed({
  get: () => props.style,
  set: (value) => emit('update:style', value),
});

const aspectRatios = [
  { label: '16:9', value: '16:9' as const },
  { label: '9:16', value: '9:16' as const },
  { label: '1:1', value: '1:1' as const },
  { label: '4:5', value: '4:5' as const },
];

const canGenerate = computed(() => {
  return props.hasMedia && props.prompt.trim().length > 0;
});

function handleGenerate() {
  if (canGenerate.value) {
    emit('generate');
  }
}
</script>
