<template>
  <div class="space-y-4">
    <!-- Enable/Disable Toggle -->
    <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg" :class="settings.enabled ? 'bg-violet-500/20' : 'bg-white/10'">
          <Zap :size="16" :class="settings.enabled ? 'text-violet-400' : 'text-white/40'" />
        </div>
        <div>
          <p class="text-sm font-medium text-white">Proxy Workflow</p>
          <p class="text-[10px] text-white/50">Use lower-resolution files for smoother editing</p>
        </div>
      </div>
      <button
        @click="toggleProxy"
        class="relative w-11 h-6 rounded-full transition-colors"
        :class="settings.enabled ? 'bg-violet-500' : 'bg-white/20'"
      >
        <div
          class="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
          :class="settings.enabled ? 'left-6' : 'left-1'"
        />
      </button>
    </div>

    <!-- Settings (only shown when enabled) -->
    <div v-if="settings.enabled" class="space-y-3">
      <!-- Resolution -->
      <div>
        <label class="block text-xs text-white/60 mb-2">Proxy Resolution</label>
        <div class="grid grid-cols-4 gap-1">
          <button
            v-for="res in resolutions"
            :key="res.value"
            @click="updateSettings({ resolution: res.value })"
            class="px-2 py-1.5 text-[10px] rounded border transition-colors"
            :class="settings.resolution === res.value 
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'"
          >
            {{ res.label }}
          </button>
        </div>
      </div>

      <!-- Quality -->
      <div>
        <label class="block text-xs text-white/60 mb-2">Quality</label>
        <div class="grid grid-cols-3 gap-1">
          <button
            v-for="q in qualities"
            :key="q.value"
            @click="updateSettings({ quality: q.value })"
            class="px-2 py-1.5 text-[10px] rounded border transition-colors"
            :class="settings.quality === q.value 
              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'"
          >
            {{ q.label }}
          </button>
        </div>
      </div>

      <!-- Proxy Status -->
      <div class="pt-3 border-t border-white/10">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-white/60">Proxy Files</span>
          <span class="text-[10px] text-white/40">
            {{ readyCount }}/{{ totalCount }} ready
          </span>
        </div>

        <!-- Progress Bar -->
        <div class="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            class="h-full bg-violet-500 transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            v-if="!isGenerating"
            @click="$emit('generateAll')"
            :disabled="pendingCount === 0"
            class="flex-1 px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded text-xs text-violet-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Wand2 :size="12" />
            Generate Proxies ({{ pendingCount }})
          </button>
          <button
            v-else
            @click="$emit('cancelGeneration')"
            class="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-xs text-red-300 transition-colors flex items-center justify-center gap-2"
          >
            <X :size="12" />
            Cancel
          </button>
          <button
            @click="$emit('clearProxies')"
            :disabled="totalCount === 0"
            class="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear all proxies"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </div>

      <!-- Currently Generating -->
      <div v-if="generatingFiles.length > 0" class="space-y-2">
        <div
          v-for="file in generatingFiles"
          :key="file.sourceId"
          class="p-2 bg-white/5 rounded border border-white/10"
        >
          <div class="flex items-center gap-2 mb-1">
            <Loader2 :size="12" class="text-violet-400 animate-spin" />
            <span class="text-[10px] text-white/70 truncate flex-1">{{ getFileName(file.sourcePath) }}</span>
            <span class="text-[10px] text-white/40">{{ file.progress }}%</span>
          </div>
          <div class="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              class="h-full bg-violet-500 transition-all"
              :style="{ width: `${file.progress}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Info -->
      <div class="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-300/80">
        <p class="flex items-start gap-1.5">
          <Info :size="12" class="flex-shrink-0 mt-0.5" />
          <span>Proxies are used during editing for smoother playback. Full resolution files are used for export.</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Zap, Wand2, X, Trash2, Loader2, Info } from 'lucide-vue-next';
import type { ProxySettings, ProxyFile } from '@/composables/useProxyWorkflow';

const props = defineProps<{
  settings: ProxySettings;
  proxyFiles: ProxyFile[];
  isGenerating: boolean;
}>();

const emit = defineEmits<{
  (e: 'updateSettings', settings: Partial<ProxySettings>): void;
  (e: 'generateAll'): void;
  (e: 'cancelGeneration'): void;
  (e: 'clearProxies'): void;
}>();

const resolutions = [
  { value: '360p' as const, label: '360p' },
  { value: '480p' as const, label: '480p' },
  { value: '720p' as const, label: '720p' },
  { value: '1080p' as const, label: '1080p' },
];

const qualities = [
  { value: 'low' as const, label: 'Low' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'high' as const, label: 'High' },
];

const totalCount = computed(() => props.proxyFiles.length);
const readyCount = computed(() => props.proxyFiles.filter(p => p.status === 'ready').length);
const pendingCount = computed(() => props.proxyFiles.filter(p => p.status === 'pending').length);
const generatingFiles = computed(() => props.proxyFiles.filter(p => p.status === 'generating'));

const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((readyCount.value / totalCount.value) * 100);
});

function toggleProxy() {
  emit('updateSettings', { enabled: !props.settings.enabled });
}

function updateSettings(updates: Partial<ProxySettings>) {
  emit('updateSettings', updates);
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}
</script>
