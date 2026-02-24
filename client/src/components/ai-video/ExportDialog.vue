<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="export-dialog__overlay" @click.self="cancel">
        <Transition name="dialog" appear>
          <div v-if="isOpen" class="export-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="export-dialog__accent"></div>

            <!-- Header -->
            <div class="export-dialog__header">
              <button class="export-dialog__close" @click="cancel" :disabled="isExporting" title="Close">
                <X :size="18" />
              </button>
              <div class="export-dialog__icon">
                <Download :size="24" />
              </div>
              <h2 class="export-dialog__title">Export AI Video</h2>
              <p class="export-dialog__subtitle">Configure export settings and render your video composition</p>
            </div>

            <!-- Content -->
            <div class="export-dialog__content">
              <!-- Export Settings -->
              <div v-if="!isExporting && !exportComplete" class="export-dialog__form">
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
                    <button @click="selectOutputPath" class="export-dialog__browse-btn">
                      Browse
                    </button>
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
                    <span class="export-dialog__label-hint">Lower = Better Quality</span>
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
                <button @click="openOutputFolder" class="export-dialog__open-btn">
                  <FolderOpen :size="16" />
                  Open Folder
                </button>
              </div>

              <!-- Export Error -->
              <div v-if="exportError" class="export-dialog__alert export-dialog__alert--error">
                <AlertCircle :size="16" />
                <p class="export-dialog__alert-text">{{ exportError }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="export-dialog__footer">
              <button
                v-if="!isExporting && !exportComplete"
                @click="cancel"
                :disabled="isExporting"
                class="export-dialog__btn export-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                v-if="isExporting"
                @click="cancelExport"
                class="export-dialog__btn export-dialog__btn--destructive"
              >
                Cancel Export
              </button>
              <button
                v-if="exportComplete"
                @click="close"
                class="export-dialog__btn export-dialog__btn--primary"
              >
                Done
              </button>
              <button
                v-if="!isExporting && !exportComplete"
                @click="startExport"
                :disabled="!outputPath"
                class="export-dialog__btn export-dialog__btn--primary"
              >
                <Loader2 v-if="isExporting" :size="16" class="export-dialog__btn-spinner" />
                <Download v-else :size="16" />
                {{ isExporting ? 'Exporting...' : 'Export Video' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { X, Loader2, CheckCircle2, AlertCircle, Download, FolderOpen } from 'lucide-vue-next';
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
  // Emit exported event if export was successful
  if (exportComplete.value && outputPath.value && props.composition) {
    emit('exported', { outputPath: outputPath.value, composition: props.composition });
  }
  reset();
  isOpen.value = false;
}
</script>

<style scoped>
/* ===== Transitions ===== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-leave-active {
  transition: all 200ms ease;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* ===== Overlay ===== */
.export-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

/* ===== Dialog Container ===== */
.export-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

/* ===== Accent Bar ===== */
.export-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Header ===== */
.export-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.export-dialog__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.export-dialog__close:hover:not(:disabled) {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.export-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.export-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.export-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.export-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.export-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.export-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.export-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* ===== Form ===== */
.export-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.export-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.export-dialog__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.export-dialog__label-hint {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--sidebar-text-muted);
}

.export-dialog__path-input {
  display: flex;
  gap: 0.5rem;
}

.export-dialog__input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  background: var(--sidebar-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  font-size: 0.8125rem;
  transition: all 150ms ease;
}

.export-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

.export-dialog__browse-btn {
  padding: 0.625rem 1rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.export-dialog__browse-btn:hover {
  background: var(--sidebar-active);
  border-color: var(--sidebar-accent);
}

.export-dialog__select {
  padding: 0.625rem 0.875rem;
  background: var(--sidebar-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 150ms ease;
}

.export-dialog__select:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.1);
}

.export-dialog__slider {
  width: 100%;
  height: 6px;
  background: var(--sidebar-hover);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.export-dialog__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--sidebar-accent);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 150ms ease;
}

.export-dialog__slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.export-dialog__slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--sidebar-accent);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 150ms ease;
}

.export-dialog__slider::-moz-range-thumb:hover {
  transform: scale(1.1);
}

.export-dialog__quality-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
}

.export-dialog__info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 1rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.export-dialog__info-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.export-dialog__info-label {
  font-weight: 600;
  color: var(--sidebar-text-muted);
}

/* ===== Progress ===== */
.export-dialog__progress,
.export-dialog__complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
  text-align: center;
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

.export-dialog__progress-title,
.export-dialog__complete-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.export-dialog__progress-bar {
  width: 100%;
  height: 8px;
  background: var(--sidebar-hover);
  border-radius: 4px;
  overflow: hidden;
}

.export-dialog__progress-fill {
  height: 100%;
  background: var(--sidebar-accent);
  transition: width 0.3s ease;
}

.export-dialog__progress-text,
.export-dialog__complete-path {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  word-break: break-all;
}

.export-dialog__open-btn {
  margin-top: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.export-dialog__open-btn:hover {
  background: var(--sidebar-active);
  border-color: var(--sidebar-accent);
}

/* ===== Alert ===== */
.export-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.export-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.export-dialog__alert-text {
  flex: 1;
  font-size: 0.8125rem;
  line-height: 1.5;
  margin: 0;
}

/* ===== Footer ===== */
.export-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
  background-color: var(--sidebar-bg);
}

.export-dialog__btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.export-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-dialog__btn--secondary {
  background: transparent;
  border-color: var(--sidebar-border);
  color: var(--sidebar-text);
}

.export-dialog__btn--secondary:hover:not(:disabled) {
  background: var(--sidebar-hover);
}

.export-dialog__btn--primary {
  background: var(--sidebar-accent);
  color: white;
  border-color: var(--sidebar-accent);
}

.export-dialog__btn--primary:hover:not(:disabled) {
  background: rgba(6, 182, 212, 0.9);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.export-dialog__btn--destructive {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.export-dialog__btn--destructive:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.export-dialog__btn-spinner {
  animation: spin 1s linear infinite;
}
</style>
