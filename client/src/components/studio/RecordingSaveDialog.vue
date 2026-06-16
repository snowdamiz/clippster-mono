<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="bug-dialog__overlay" @click.self="emit('close')">
        <Transition name="dialog" appear>
          <div v-if="show" class="bug-dialog" role="dialog" aria-modal="true">
            <div class="bug-dialog__accent"></div>

            <div class="bug-dialog__header">
              <button class="bug-dialog__close" @click="emit('close')" :disabled="saving" title="Close">
                <X :size="18" />
              </button>
              <div class="bug-dialog__icon">
                <Disc :size="24" />
              </div>
              <h2 class="bug-dialog__title">Save Recording</h2>
              <p class="bug-dialog__subtitle">Name your recording and choose what to do next</p>
            </div>

            <div class="bug-dialog__content">
              <div class="bug-dialog__field">
                <label for="recording-title" class="bug-dialog__label">Title *</label>
                <input
                  id="recording-title"
                  v-model="title"
                  type="text"
                  required
                  placeholder="My recording"
                  class="bug-dialog__input"
                />
              </div>

              <div class="bug-dialog__field detect-clips-dialog__info-box" style="padding: 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--sidebar-border)">
                <div class="flex items-center justify-between text-xs sm:text-sm mb-1">
                  <span>Duration</span>
                  <span class="font-medium">{{ formatDuration(duration) }}</span>
                </div>
                <div class="flex items-center justify-between text-xs sm:text-sm mb-1">
                  <span>Resolution</span>
                  <span class="font-medium">{{ width }}×{{ height }}</span>
                </div>
                <div class="flex items-center justify-between text-xs sm:text-sm">
                  <span>Aspect ratio</span>
                  <span class="font-medium">{{ aspectRatio }}</span>
                </div>
              </div>

              <div v-if="error" class="bug-dialog__alert bug-dialog__alert--error">
                <AlertCircle :size="16" />
                <p class="bug-dialog__alert-text">{{ error }}</p>
              </div>
            </div>

            <div class="bug-dialog__footer" style="flex-wrap: wrap; gap: 0.5rem">
              <button
                class="bug-dialog__btn bug-dialog__btn--secondary"
                :disabled="saving"
                @click="emit('close')"
              >
                Cancel
              </button>
              <button
                class="bug-dialog__btn bug-dialog__btn--secondary"
                :disabled="saving || !title.trim()"
                @click="emit('save', 'projects')"
              >
                Clip in Projects
              </button>
              <button
                class="bug-dialog__btn bug-dialog__btn--secondary"
                :disabled="saving || !title.trim()"
                @click="emit('save', 'editor')"
              >
                Open in Editor
              </button>
              <button
                class="bug-dialog__btn bug-dialog__btn--primary"
                :disabled="saving || !title.trim()"
                @click="emit('save', 'publish')"
              >
                <Loader2 v-if="saving" :size="16" class="bug-dialog__spinner" />
                {{ saving ? 'Saving...' : 'Save' }}
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
  import { X, Disc, Loader2, AlertCircle } from 'lucide-vue-next';

  const props = defineProps<{
    show: boolean;
    duration: number;
    width: number;
    height: number;
    aspectRatio: string;
    saving: boolean;
    error: string | null;
    defaultTitle?: string;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', action: 'projects' | 'editor' | 'publish'): void;
    (e: 'update:title', value: string): void;
  }>();

  const title = ref(props.defaultTitle || '');

  watch(
    () => props.show,
    (open) => {
      if (open) {
        title.value = props.defaultTitle || `Recording ${new Date().toLocaleString()}`;
      }
    }
  );

  watch(title, (v) => emit('update:title', v));

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<style>
  .bug-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .bug-dialog {
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

  .bug-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .bug-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .bug-dialog__close {
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
  }

  .bug-dialog__icon {
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

  .bug-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .bug-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .bug-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .bug-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .bug-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .bug-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
  }

  .bug-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .bug-dialog__btn {
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
  }

  .bug-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .bug-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .bug-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .bug-dialog__alert-text {
    font-size: 0.8125rem;
    margin: 0;
  }

  .bug-dialog__spinner {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
