<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="detect-clips-dialog__overlay" @click.self="handleCancel">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="detect-clips-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="detect-clips-dialog__accent" style="background: #ef4444;"></div>

            <!-- Header -->
            <div class="detect-clips-dialog__header">
              <button class="detect-clips-dialog__close" @click="handleCancel" :disabled="isDeleting" title="Close">
                <X :size="18" />
              </button>
              <div class="detect-clips-dialog__icon" style="background: rgba(239, 68, 68, 0.1);">
                <Trash2 :size="24" style="color: #ef4444;" />
              </div>
              <h2 class="detect-clips-dialog__title">Clear Local Storage</h2>
              <p class="detect-clips-dialog__subtitle">Permanently delete local media files</p>
            </div>

            <!-- Content -->
            <div class="detect-clips-dialog__content">
              <!-- Storage Size Info -->
              <div v-if="storageInfo && !isDeleting" class="detect-clips-dialog__field detect-clips-dialog__info-box">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-semibold">Space to be freed:</span>
                  <span class="font-bold text-lg" style="color: #ef4444;">{{ storageInfo.total_formatted }}</span>
                </div>
                <div v-if="storageInfo.breakdown.length > 0" class="mt-3 space-y-1.5">
                  <div
                    v-for="item in storageInfo.breakdown"
                    :key="item.name"
                    class="flex items-center justify-between text-xs opacity-70"
                  >
                    <span>{{ item.name }}:</span>
                    <span>{{ item.formatted }}</span>
                  </div>
                </div>
              </div>

              <!-- Warning Box -->
              <div v-if="!isDeleting" class="detect-clips-dialog__field" style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px;">
                <div class="flex items-start gap-2">
                  <AlertTriangle :size="18" style="color: #ef4444; flex-shrink: 0; margin-top: 2px;" />
                  <div class="text-xs space-y-2">
                    <p class="font-semibold" style="color: #ef4444;">This action cannot be undone!</p>
                    <p class="opacity-90">The following will be permanently deleted from your computer:</p>
                    <ul class="list-disc list-inside space-y-1 opacity-80 ml-2">
                      <li>All raw videos (VOD recordings, livestream recordings)</li>
                      <li>All video projects and timeline data</li>
                      <li>All temporary DVR files</li>
                      <li>All auto-detect temporary files</li>
                      <li>All proxy files</li>
                      <li>All downloaded library audio</li>
                    </ul>
                    <p class="font-semibold mt-3" style="color: #10b981;">What will be preserved:</p>
                    <ul class="list-disc list-inside space-y-1 opacity-80 ml-2">
                      <li>Built clips (final exported videos)</li>
                      <li>Clip thumbnails</li>
                      <li>Clip transcripts and metadata</li>
                      <li>Your profile and account settings</li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Progress View -->
              <div v-if="isDeleting" class="detect-clips-dialog__field space-y-4">
                <div class="text-center">
                  <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style="background: rgba(239, 68, 68, 0.1);">
                    <Loader2 :size="32" class="animate-spin" style="color: #ef4444;" />
                  </div>
                  <p class="text-sm font-medium mb-1">{{ deletionProgress.operation }}</p>
                  <p class="text-xs opacity-70">{{ deletionProgress.percentage }}% complete</p>
                </div>
                
                <!-- Progress Bar -->
                <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    class="h-full transition-all duration-300 rounded-full"
                    style="background: #ef4444;"
                    :style="{ width: deletionProgress.percentage + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Confirmation Input -->
              <div v-if="!isDeleting" class="detect-clips-dialog__field">
                <label class="detect-clips-dialog__label">
                  Type <span class="font-bold" style="color: #ef4444;">confirm</span> to proceed
                </label>
                <input
                  v-model="confirmText"
                  type="text"
                  class="detect-clips-dialog__input"
                  placeholder="Type 'confirm' here..."
                  :disabled="isDeleting"
                  @keyup.enter="handleDelete"
                />
              </div>
            </div>

            <!-- Footer -->
            <div class="detect-clips-dialog__footer">
              <button
                v-if="!isDeleting"
                @click="handleCancel"
                class="detect-clips-dialog__button detect-clips-dialog__button--secondary"
                :disabled="isDeleting"
              >
                Cancel
              </button>
              <button
                v-if="!isDeleting"
                @click="handleDelete"
                class="detect-clips-dialog__button detect-clips-dialog__button--primary"
                :disabled="!isConfirmValid || isDeleting"
                style="background: #ef4444;"
              >
                <Trash2 :size="16" />
                Delete Everything
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
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-vue-next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface StorageSizeInfo {
  total_bytes: number;
  total_formatted: string;
  breakdown: Array<{
    name: string;
    bytes: number;
    formatted: string;
  }>;
}

interface DeletionProgress {
  operation: string;
  percentage: number;
}

interface DeletionResult {
  success: boolean;
  bytes_freed: number;
  formatted_size: string;
  errors: string[];
}

const props = defineProps<{
  modelValue: boolean;
  storageInfo: StorageSizeInfo | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'deleted': [result: DeletionResult];
}>();

const confirmText = ref('');
const isDeleting = ref(false);
const deletionProgress = ref<DeletionProgress>({
  operation: 'Preparing...',
  percentage: 0,
});

const isConfirmValid = computed(() => {
  return confirmText.value.toLowerCase() === 'confirm';
});

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    confirmText.value = '';
    isDeleting.value = false;
    deletionProgress.value = {
      operation: 'Preparing...',
      percentage: 0,
    };
  }
});

const handleCancel = () => {
  if (!isDeleting.value) {
    emit('update:modelValue', false);
  }
};

const handleDelete = async () => {
  if (!isConfirmValid.value || isDeleting.value) {
    return;
  }

  isDeleting.value = true;
  deletionProgress.value = {
    operation: 'Starting deletion...',
    percentage: 0,
  };

  const unlisten = await listen<DeletionProgress>('deletion-progress', (event) => {
    deletionProgress.value = event.payload;
  });

  try {
    const result = await invoke<DeletionResult>('delete_local_storage');
    
    unlisten();
    emit('deleted', result);
    emit('update:modelValue', false);
  } catch (error) {
    console.error('Failed to delete local storage:', error);
    unlisten();
    
    const errorResult: DeletionResult = {
      success: false,
      bytes_freed: 0,
      formatted_size: '0 bytes',
      errors: [String(error)],
    };
    
    emit('deleted', errorResult);
    emit('update:modelValue', false);
  } finally {
    isDeleting.value = false;
  }
};
</script>

<style scoped>
/* ===== Overlay ===== */
.detect-clips-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

/* ===== Dialog Container ===== */
.detect-clips-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== Accent Bar ===== */
.detect-clips-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Header ===== */
.detect-clips-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.detect-clips-dialog__close {
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

.detect-clips-dialog__close:hover:not(:disabled) {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.detect-clips-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.detect-clips-dialog__icon {
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

.detect-clips-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.detect-clips-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.detect-clips-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.detect-clips-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.detect-clips-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.detect-clips-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* ===== Form Field ===== */
.detect-clips-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.detect-clips-dialog__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.detect-clips-dialog__input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.detect-clips-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.detect-clips-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

/* ===== Info Box ===== */
.detect-clips-dialog__info-box {
  padding: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  gap: 0.5rem;
}

/* ===== Footer ===== */
.detect-clips-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

/* ===== Buttons ===== */
.detect-clips-dialog__button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.detect-clips-dialog__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.detect-clips-dialog__button--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.detect-clips-dialog__button--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.detect-clips-dialog__button--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.detect-clips-dialog__button--primary:hover:not(:disabled) {
  opacity: 0.9;
}

/* ===== Progress Bar ===== */
.detect-clips-dialog__progress {
  width: 100%;
  height: 8px;
  background-color: var(--sidebar-hover);
  border-radius: 4px;
  overflow: hidden;
}

.detect-clips-dialog__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ef4444, #dc2626);
  transition: width 300ms ease;
}

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
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 150ms ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 0.8s linear infinite;
}
</style>
