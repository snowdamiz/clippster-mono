<template>
  <Modal
    :open="isOpen"
    title="Export AI video"
    description="Configure export settings and render your video composition."
    :icon="Download"
    size="md"
    :dismissible="!isExporting"
    :hide-close="isExporting"
    @close="cancel"
  >
    <!-- Keyed by step (settings → progress → complete) so each step eases in -->
    <div :key="isExporting ? 'progress' : exportComplete ? 'complete' : 'settings'" class="animate-enter">
      <!-- Settings -->
      <div v-if="!isExporting && !exportComplete" class="flex flex-col gap-4">
        <Field label="Output location">
          <div class="flex gap-2">
            <Input :model-value="outputPath" placeholder="Choose output location…" readonly class="min-w-0 flex-1" />
            <Button variant="secondary" @click="selectOutputPath">Browse</Button>
          </div>
        </Field>

        <Field label="Codec">
          <CustomDropdown v-model="codec" :options="codecOptions" />
        </Field>

        <Field>
          <template #label>
            Quality <span class="tabular text-fg">· CRF {{ crf }}</span>
          </template>
          <template #label-end><span class="text-2xs text-fg-subtle">Lower = better quality</span></template>
          <input v-model.number="crf" type="range" min="18" max="28" step="1" class="w-full" aria-label="Quality (CRF)" />
          <div class="flex justify-between text-2xs text-fg-subtle">
            <span>High (18)</span>
            <span>Medium (23)</span>
            <span>Low (28)</span>
          </div>
        </Field>

        <StatGrid size="sm" :items="summaryStats" class="border-t border-line-subtle pt-3" />
      </div>

      <!-- Progress -->
      <div v-if="isExporting" class="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <IconTile :icon="Loader2" tone="brand" size="md" class="[&_svg]:animate-spin" />
        <h3 class="text-sm font-semibold text-fg">{{ progressStatus }}</h3>
        <div class="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-active">
          <div class="h-full rounded-full bg-brand transition-[width] duration-300" :style="{ width: `${progressPercent}%` }" />
        </div>
        <p class="tabular text-xs text-fg-muted">{{ progressPercent }}% complete</p>
      </div>

      <!-- Complete -->
      <div v-if="exportComplete" class="flex flex-col items-center gap-3 py-6 text-center">
        <IconTile :icon="CheckCircle2" tone="success" size="md" />
        <h3 class="text-sm font-semibold text-fg">Export complete</h3>
        <p class="max-w-full break-all font-mono text-2xs text-fg-subtle">{{ outputPath }}</p>
        <Button variant="secondary" size="sm" @click="openOutputFolder"><FolderOpen /> Open folder</Button>
      </div>
    </div>

    <Alert v-if="exportError" variant="destructive" class="mt-4">
      <AlertCircle />
      <AlertDescription>{{ exportError }}</AlertDescription>
    </Alert>

    <template #footer>
      <template v-if="!isExporting && !exportComplete">
        <Button variant="ghost" @click="cancel">Cancel</Button>
        <Button variant="primary" :disabled="!outputPath" @click="startExport"><Download /> Export video</Button>
      </template>
      <Button v-if="isExporting" variant="destructive-soft" @click="cancelExport">Cancel export</Button>
      <Button v-if="exportComplete" variant="primary" @click="close">Done</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Loader2, CheckCircle2, AlertCircle, Download, FolderOpen } from 'lucide-vue-next';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { IconTile } from '@/components/ui/icon-tile';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { StatGrid, type StatItem } from '@/components/ui/stat-card';
import { useRemotionExport } from '@/composables/useRemotionExport';
import type { AIVideoComposition } from '@/types/ai-video';

const props = defineProps<{
  modelValue: boolean;
  composition: AIVideoComposition | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'exported', data: { outputPath: string; composition: AIVideoComposition }): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const { isExporting, progress, startExport: startRemotionExport, cancelExport: cancelRemotionExport, reset } = useRemotionExport();

const outputPath = ref('');
const codec = ref<'h264' | 'h265'>('h264');
const crf = ref(23);

const codecOptions = [
  { value: 'h264', label: 'H.264 (MP4) — best compatibility' },
  { value: 'h265', label: 'H.265 (HEVC) — better compression' },
];

/** Composition figures shown under the settings (frameless stat strip). */
const summaryStats = computed<StatItem[]>(() => [
  { label: 'Duration', value: `${props.composition?.duration ?? 0}s` },
  { label: 'Resolution', value: `${props.composition?.width ?? 0}×${props.composition?.height ?? 0}` },
  { label: 'FPS', value: props.composition?.fps ?? 0 },
  { label: 'Tracks', value: props.composition?.tracks.length ?? 0 },
]);

const exportComplete = computed(() => progress.value?.status === 'complete');
const exportError = computed(() => progress.value?.status === 'error' ? progress.value.error : null);

const progressPercent = computed(() => {
  if (!progress.value) return 0;
  return Math.round(progress.value.progress * 100);
});

const progressStatus = computed(() => {
  if (!progress.value) return 'Preparing…';
  if (progress.value.status === 'preparing') return 'Preparing export…';
  if (progress.value.status === 'rendering') return 'Rendering video…';
  return 'Processing…';
});

watch(() => props.modelValue, (open) => {
  if (open) {
    reset();
    if (!outputPath.value && props.composition) {
      outputPath.value = '';
    }
  }
});

async function selectOutputPath() {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({
      defaultPath: props.composition?.name || 'ai-video',
      filters: [
        {
          name: 'Video',
          extensions: ['mp4']
        }
      ]
    });
    
    if (path) {
      outputPath.value = path;
    }
  } catch (error) {
    console.error('Failed to select output path:', error);
  }
}

async function startExport() {
  if (!props.composition || !outputPath.value) return;

  try {
    await startRemotionExport(props.composition, {
      outputPath: outputPath.value,
      codec: codec.value,
      crf: crf.value,
    });
  } catch (error) {
    console.error('Export failed:', error);
  }
}

async function cancelExport() {
  await cancelRemotionExport();
}

async function openOutputFolder() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const path = outputPath.value;
    const dir = path.substring(0, path.lastIndexOf('\\') || path.lastIndexOf('/'));
    
    // Use Tauri's shell command through invoke
    await invoke('plugin:shell|execute', {
      program: process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open',
      args: [dir]
    });
  } catch (error) {
    console.error('Failed to open folder:', error);
  }
}

function cancel() {
  isOpen.value = false;
}

function close() {
  // Emit exported event if export was successful
  if (exportComplete.value && outputPath.value && props.composition) {
    emit('exported', { outputPath: outputPath.value, composition: props.composition });
  }
  reset();
  isOpen.value = false;
}
</script>
