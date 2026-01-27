<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="export-dialog">
      <DialogHeader>
        <DialogTitle>Export AI Video</DialogTitle>
        <DialogDescription>
          Configure export settings and render your video composition.
        </DialogDescription>
      </DialogHeader>

      <div class="export-dialog__content">
        <!-- Export Settings -->
        <div v-if="!isExporting && !exportComplete" class="export-dialog__settings">
          <!-- Output Path -->
          <div class="export-dialog__field">
            <label class="export-dialog__label">Output Location</label>
            <div class="export-dialog__path-input">
              <input
                v-model="outputPath"
                type="text"
                placeholder="Choose output location..."
                class="export-dialog__input"
                readonly
              />
              <Button @click="selectOutputPath" variant="outline" size="sm">
                Browse
              </Button>
            </div>
          </div>

          <!-- Codec -->
          <div class="export-dialog__field">
            <label class="export-dialog__label">Codec</label>
            <select v-model="codec" class="export-dialog__select">
              <option value="h264">H.264 (MP4) - Best Compatibility</option>
              <option value="h265">H.265 (HEVC) - Better Compression</option>
            </select>
          </div>

          <!-- Quality (CRF) -->
          <div class="export-dialog__field">
            <label class="export-dialog__label">
              Quality (CRF: {{ crf }})
              <span class="export-dialog__hint">Lower = Better Quality</span>
            </label>
            <input
              v-model.number="crf"
              type="range"
              min="18"
              max="28"
              step="1"
              class="export-dialog__slider"
            />
            <div class="export-dialog__quality-labels">
              <span>High (18)</span>
              <span>Medium (23)</span>
              <span>Low (28)</span>
            </div>
          </div>

          <!-- Composition Info -->
          <div class="export-dialog__info">
            <div class="export-dialog__info-item">
              <span class="export-dialog__info-label">Duration:</span>
              <span>{{ composition?.duration }}s</span>
            </div>
            <div class="export-dialog__info-item">
              <span class="export-dialog__info-label">Resolution:</span>
              <span>{{ composition?.width }}×{{ composition?.height }}</span>
            </div>
            <div class="export-dialog__info-item">
              <span class="export-dialog__info-label">FPS:</span>
              <span>{{ composition?.fps }}</span>
            </div>
            <div class="export-dialog__info-item">
              <span class="export-dialog__info-label">Tracks:</span>
              <span>{{ composition?.tracks.length }}</span>
            </div>
          </div>
        </div>

        <!-- Export Progress -->
        <div v-if="isExporting" class="export-dialog__progress">
          <div class="export-dialog__progress-icon">
            <Loader2 class="export-dialog__spinner" />
          </div>
          <h3 class="export-dialog__progress-title">
            {{ progressStatus }}
          </h3>
          <div class="export-dialog__progress-bar">
            <div
              class="export-dialog__progress-fill"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <p class="export-dialog__progress-text">
            {{ progressPercent }}% complete
          </p>
        </div>

        <!-- Export Complete -->
        <div v-if="exportComplete" class="export-dialog__complete">
          <div class="export-dialog__complete-icon">
            <CheckCircle2 class="export-dialog__check-icon" />
          </div>
          <h3 class="export-dialog__complete-title">Export Complete!</h3>
          <p class="export-dialog__complete-path">{{ outputPath }}</p>
          <Button @click="openOutputFolder" variant="outline" class="export-dialog__open-btn">
            <FolderOpen class="export-dialog__btn-icon" />
            Open Folder
          </Button>
        </div>

        <!-- Export Error -->
        <div v-if="exportError" class="export-dialog__error">
          <div class="export-dialog__error-icon">
            <AlertCircle class="export-dialog__alert-icon" />
          </div>
          <h3 class="export-dialog__error-title">Export Failed</h3>
          <p class="export-dialog__error-message">{{ exportError }}</p>
        </div>
      </div>

      <DialogFooter>
        <Button
          v-if="!isExporting && !exportComplete"
          variant="outline"
          @click="cancel"
        >
          Cancel
        </Button>
        <Button
          v-if="isExporting"
          variant="destructive"
          @click="cancelExport"
        >
          Cancel Export
        </Button>
        <Button
          v-if="exportComplete"
          @click="close"
        >
          Done
        </Button>
        <Button
          v-if="!isExporting && !exportComplete"
          @click="startExport"
          :disabled="!outputPath"
        >
          <Download class="export-dialog__btn-icon" />
          Export Video
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Loader2, CheckCircle2, AlertCircle, Download, FolderOpen } from 'lucide-vue-next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRemotionExport } from '@/composables/useRemotionExport';
import type { AIVideoComposition } from '@/types/ai-video';

const props = defineProps<{
  modelValue: boolean;
  composition: AIVideoComposition | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const { isExporting, progress, startExport: startRemotionExport, cancelExport: cancelRemotionExport, reset } = useRemotionExport();

const outputPath = ref('');
const codec = ref<'h264' | 'h265'>('h264');
const crf = ref(23);

const exportComplete = computed(() => progress.value?.status === 'complete');
const exportError = computed(() => progress.value?.status === 'error' ? progress.value.error : null);

const progressPercent = computed(() => {
  if (!progress.value) return 0;
  return Math.round(progress.value.progress * 100);
});

const progressStatus = computed(() => {
  if (!progress.value) return 'Preparing...';
  if (progress.value.status === 'preparing') return 'Preparing export...';
  if (progress.value.status === 'rendering') return 'Rendering video...';
  return 'Processing...';
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
  reset();
  isOpen.value = false;
}
</script>

<style scoped>
.export-dialog__content {
  padding: 1rem 0;
}

.export-dialog__settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.export-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.export-dialog__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.export-dialog__hint {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--muted-foreground);
}

.export-dialog__path-input {
  display: flex;
  gap: 0.5rem;
}

.export-dialog__input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.875rem;
}

.export-dialog__select {
  padding: 0.5rem 0.75rem;
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.875rem;
}

.export-dialog__slider {
  width: 100%;
  height: 6px;
  background: var(--muted);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.export-dialog__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--sidebar-accent);
  border-radius: 50%;
  cursor: pointer;
}

.export-dialog__slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--sidebar-accent);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.export-dialog__quality-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.export-dialog__info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 1rem;
  background: var(--muted);
  border-radius: 8px;
}

.export-dialog__info-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.export-dialog__info-label {
  font-weight: 500;
  color: var(--muted-foreground);
}

.export-dialog__progress,
.export-dialog__complete,
.export-dialog__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
  text-align: center;
}

.export-dialog__progress-icon,
.export-dialog__complete-icon,
.export-dialog__error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-dialog__spinner {
  width: 48px;
  height: 48px;
  color: var(--sidebar-accent);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.export-dialog__check-icon {
  width: 48px;
  height: 48px;
  color: var(--sidebar-accent);
}

.export-dialog__alert-icon {
  width: 48px;
  height: 48px;
  color: var(--destructive);
}

.export-dialog__progress-title,
.export-dialog__complete-title,
.export-dialog__error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
}

.export-dialog__progress-bar {
  width: 100%;
  height: 8px;
  background: var(--muted);
  border-radius: 4px;
  overflow: hidden;
}

.export-dialog__progress-fill {
  height: 100%;
  background: var(--sidebar-accent);
  transition: width 0.3s ease;
}

.export-dialog__progress-text {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.export-dialog__complete-path {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  word-break: break-all;
  margin: 0;
}

.export-dialog__error-message {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.export-dialog__open-btn {
  margin-top: 0.5rem;
}

.export-dialog__btn-icon {
  width: 16px;
  height: 16px;
  margin-right: 0.5rem;
}
</style>
