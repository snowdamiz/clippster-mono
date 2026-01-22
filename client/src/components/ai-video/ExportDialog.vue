<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    @click.self="$emit('close')"
  >
    <div class="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-800 shadow-2xl">
      <div class="p-6 border-b border-zinc-800">
        <h2 class="text-lg font-semibold">Export Video</h2>
      </div>

      <div v-if="!isExporting" class="p-6 space-y-4">
        <div>
          <label class="block text-sm text-zinc-400 mb-2">Output Location</label>
          <div class="flex gap-2">
            <input
              v-model="outputPath"
              type="text"
              placeholder="Choose output location..."
              class="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              readonly
            />
            <button
              @click="selectOutputPath"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm text-zinc-400 mb-2">Quality</label>
          <select
            v-model="quality"
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="draft">Draft (Fast)</option>
            <option value="standard">Standard</option>
            <option value="high">High (Slow)</option>
          </select>
        </div>

        <div>
          <label class="block text-sm text-zinc-400 mb-2">Codec</label>
          <select
            v-model="codec"
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="h264">H.264 (Compatible)</option>
            <option value="h265">H.265 (Smaller)</option>
          </select>
        </div>
      </div>

      <div v-else class="p-6">
        <div class="text-center mb-4">
          <Loader2 class="w-12 h-12 mx-auto animate-spin text-blue-500 mb-3" />
          <p class="text-sm font-medium">{{ statusText }}</p>
          <p class="text-xs text-zinc-500 mt-1">{{ progressPercentage }}%</p>
        </div>

        <div class="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${progressPercentage}%` }"
          />
        </div>
      </div>

      <div class="p-6 border-t border-zinc-800 flex justify-end gap-3">
        <button
          v-if="!isExporting"
          @click="$emit('close')"
          class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          v-if="isExporting"
          @click="$emit('cancel')"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
        >
          Cancel Export
        </button>
        <button
          v-if="!isExporting"
          @click="handleExport"
          :disabled="!outputPath"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-sm font-medium transition-colors"
        >
          Start Export
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';

defineProps<{
  isOpen: boolean;
  isExporting: boolean;
  progressPercentage: number;
  statusText: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'export', settings: { outputPath: string; quality: string; codec: string }): void;
  (e: 'cancel'): void;
}>();

const outputPath = ref('');
const quality = ref('standard');
const codec = ref('h264');

async function selectOutputPath() {
  const result = await open({
    directory: false,
    multiple: false,
    filters: [{
      name: 'Video',
      extensions: ['mp4']
    }],
    defaultPath: 'video.mp4',
  });

  if (result) {
    outputPath.value = result as string;
  }
}

function handleExport() {
  if (outputPath.value) {
    emit('export', {
      outputPath: outputPath.value,
      quality: quality.value,
      codec: codec.value,
    });
  }
}
</script>
