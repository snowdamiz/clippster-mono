<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="aithumb-create-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="aithumb-create-dialog" role="dialog" aria-modal="true">
            <div class="aithumb-create-dialog__accent"></div>

            <div class="aithumb-create-dialog__header">
              <button type="button" class="aithumb-create-dialog__close" title="Close" @click="close">
                <X :size="18" />
              </button>
              <div class="aithumb-create-dialog__icon">
                <ImagePlus :size="24" />
              </div>
              <h2 class="aithumb-create-dialog__title">New Thumbnail Project</h2>
              <p class="aithumb-create-dialog__subtitle">Choose a workflow, then name your project</p>
            </div>

            <div class="aithumb-create-dialog__content">
              <div class="aithumb-create-dialog__field">
                <label class="aithumb-create-dialog__label">Workflow</label>
                <div class="aithumb-create-dialog__mode-grid">
                  <button
                    type="button"
                    class="aithumb-create-dialog__mode-card"
                    :class="{ 'aithumb-create-dialog__mode-card--selected': mode === 'editable' }"
                    @click="mode = 'editable'"
                  >
                    <div class="aithumb-create-dialog__mode-header">
                      <span class="font-semibold text-sm">Editable</span>
                      <div v-if="mode === 'editable'" class="aithumb-create-dialog__mode-check">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <p class="text-xs opacity-70 leading-relaxed">
                      Text-free plate + live text layers in Image Editor
                    </p>
                  </button>
                  <button
                    type="button"
                    class="aithumb-create-dialog__mode-card"
                    :class="{ 'aithumb-create-dialog__mode-card--selected': mode === 'quick' }"
                    @click="mode = 'quick'"
                  >
                    <div class="aithumb-create-dialog__mode-header">
                      <span class="font-semibold text-sm">Quick</span>
                      <div v-if="mode === 'quick'" class="aithumb-create-dialog__mode-check">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <p class="text-xs opacity-70 leading-relaxed">
                      Finished flat thumbnail with baked hook text
                    </p>
                  </button>
                </div>
              </div>

              <div class="aithumb-create-dialog__field">
                <label class="aithumb-create-dialog__label" for="aithumb-project-name">Project name</label>
                <input
                  id="aithumb-project-name"
                  v-model="name"
                  type="text"
                  maxlength="100"
                  placeholder="e.g., Episode 12 Thumbnail"
                  class="aithumb-create-dialog__input"
                  autofocus
                  @keyup.enter="confirm"
                />
              </div>

              <div v-if="error" class="aithumb-create-dialog__alert aithumb-create-dialog__alert--error">
                <p class="text-xs sm:text-sm">{{ error }}</p>
              </div>
            </div>

            <div class="aithumb-create-dialog__footer">
              <button
                type="button"
                class="aithumb-create-dialog__btn aithumb-create-dialog__btn--secondary"
                :disabled="isCreating"
                @click="close"
              >
                Cancel
              </button>
              <button
                type="button"
                class="aithumb-create-dialog__btn aithumb-create-dialog__btn--primary"
                :disabled="isCreating"
                @click="confirm"
              >
                <Loader2 v-if="isCreating" :size="16" class="aithumb-create-dialog__spinner" />
                <Plus v-else :size="16" />
                {{ isCreating ? 'Creating…' : 'Create' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ImagePlus, Loader2, Plus, X } from 'lucide-vue-next';
import type { ThumbnailGenerationMode } from '@/services/aiThumbnailApi';

const props = defineProps<{
  modelValue: boolean;
  isCreating?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [payload: { name: string; generation_mode: ThumbnailGenerationMode }];
}>();

const mode = ref<ThumbnailGenerationMode>('editable');
const name = ref('');
const error = ref('');

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      mode.value = 'editable';
      name.value = '';
      error.value = '';
    }
  },
);

function close() {
  if (props.isCreating) return;
  emit('update:modelValue', false);
}

function confirm() {
  const trimmed = name.value.trim();
  if (!trimmed) {
    error.value = 'Project name is required';
    return;
  }
  error.value = '';
  emit('confirm', { name: trimmed, generation_mode: mode.value });
}
</script>

<style scoped>
.aithumb-create-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.aithumb-create-dialog {
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

.aithumb-create-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

.aithumb-create-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.aithumb-create-dialog__close {
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

.aithumb-create-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.aithumb-create-dialog__icon {
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

.aithumb-create-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.aithumb-create-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.aithumb-create-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.aithumb-create-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.aithumb-create-dialog__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.aithumb-create-dialog__input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.aithumb-create-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.aithumb-create-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.aithumb-create-dialog__mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.aithumb-create-dialog__mode-card {
  display: flex;
  flex-direction: column;
  padding: 0.875rem;
  border-radius: 8px;
  border: 1px solid var(--sidebar-border);
  background-color: var(--sidebar-hover);
  cursor: pointer;
  transition: all 150ms ease;
  text-align: left;
  color: var(--sidebar-text);
}

.aithumb-create-dialog__mode-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background-color: var(--sidebar-active);
}

.aithumb-create-dialog__mode-card--selected {
  border-color: rgba(6, 182, 212, 0.4);
  background-color: rgba(6, 182, 212, 0.1);
}

.aithumb-create-dialog__mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.aithumb-create-dialog__mode-check {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--sidebar-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
}

.aithumb-create-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.aithumb-create-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.aithumb-create-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.aithumb-create-dialog__btn {
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

.aithumb-create-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.aithumb-create-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.aithumb-create-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.aithumb-create-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.aithumb-create-dialog__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.aithumb-create-dialog__spinner {
  animation: spin 0.8s linear infinite;
}

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
</style>
