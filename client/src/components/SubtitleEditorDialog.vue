<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="subtitle-editor-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="subtitle-editor-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="subtitle-editor-dialog__accent"></div>

            <!-- Header -->
            <div class="subtitle-editor-dialog__header">
              <button class="subtitle-editor-dialog__close" @click="close" :disabled="isSaving" title="Close">
                <X :size="18" />
              </button>
              <div class="subtitle-editor-dialog__icon">
                <Captions :size="24" />
              </div>
              <h2 class="subtitle-editor-dialog__title">Edit Subtitles</h2>
              <p class="subtitle-editor-dialog__subtitle">Configure subtitles for your clips</p>
            </div>

            <!-- Content -->
            <div class="subtitle-editor-dialog__content">
              <!-- Subtitle Preset Selection -->
              <div class="subtitle-editor-dialog__field">
                <label class="subtitle-editor-dialog__label">Select Subtitle Style</label>
                <div class="grid grid-cols-3 gap-2">
                  <!-- Mr Beast Preset -->
                  <button
                    @click="selectedPreset = 'mr-beast'"
                    class="subtitle-editor-dialog__preset-card"
                    :class="{ 'subtitle-editor-dialog__preset-card--selected': selectedPreset === 'mr-beast' }"
                  >
                    <div class="subtitle-editor-dialog__preset-header">
                      <span class="font-semibold text-xs">MrBeast</span>
                      <div
                        v-if="selectedPreset === 'mr-beast'"
                        class="subtitle-editor-dialog__preset-check"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div class="subtitle-editor-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                      <span style="color: #FACC15; font-family: 'Bebas Neue', sans-serif; font-size: 18px; font-weight: normal; letter-spacing: 1.5px; text-shadow: -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 8px rgba(239, 68, 68, 0.5);">SAMPLE TEXT</span>
                    </div>
                    <p class="text-[10px] text-muted-foreground mt-1">Bold yellow, YouTube style</p>
                  </button>

                  <!-- TikTok Bold Preset -->
                  <button
                    @click="selectedPreset = 'tiktok-bold'"
                    class="subtitle-editor-dialog__preset-card"
                    :class="{ 'subtitle-editor-dialog__preset-card--selected': selectedPreset === 'tiktok-bold' }"
                  >
                    <div class="subtitle-editor-dialog__preset-header">
                      <span class="font-semibold text-xs">TikTok Bold</span>
                      <div
                        v-if="selectedPreset === 'tiktok-bold'"
                        class="subtitle-editor-dialog__preset-check"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div class="subtitle-editor-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                      <span style="color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 900; background: rgba(0,0,0,0.8); padding: 4px 8px; border-radius: 4px;">SAMPLE TEXT</span>
                    </div>
                    <p class="text-[10px] text-muted-foreground mt-1">White text, thick outline</p>
                  </button>

                  <!-- Clean Subtitle Preset -->
                  <button
                    @click="selectedPreset = 'subtitle-tutorial'"
                    class="subtitle-editor-dialog__preset-card"
                    :class="{ 'subtitle-editor-dialog__preset-card--selected': selectedPreset === 'subtitle-tutorial' }"
                  >
                    <div class="subtitle-editor-dialog__preset-header">
                      <span class="font-semibold text-xs">Clean Subtitle</span>
                      <div
                        v-if="selectedPreset === 'subtitle-tutorial'"
                        class="subtitle-editor-dialog__preset-check"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div class="subtitle-editor-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                      <span style="color: #FFFFFF; font-family: 'Roboto', sans-serif; font-size: 14px; font-weight: normal; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px;">Sample Text</span>
                    </div>
                    <p class="text-[10px] text-muted-foreground mt-1">Professional, readable</p>
                  </button>

                  <!-- Neon Glow Preset -->
                  <button
                    @click="selectedPreset = 'neon-glow'"
                    class="subtitle-editor-dialog__preset-card"
                    :class="{ 'subtitle-editor-dialog__preset-card--selected': selectedPreset === 'neon-glow' }"
                  >
                    <div class="subtitle-editor-dialog__preset-header">
                      <span class="font-semibold text-xs">Neon Glow</span>
                      <div
                        v-if="selectedPreset === 'neon-glow'"
                        class="subtitle-editor-dialog__preset-check"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div class="subtitle-editor-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                      <span style="color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: bold; text-shadow: 0 0 10px #22D3EE, 0 0 20px #22D3EE, 0 0 30px #22D3EE;">SAMPLE TEXT</span>
                    </div>
                    <p class="text-[10px] text-muted-foreground mt-1">Cyan glow, modern</p>
                  </button>

                  <!-- Karaoke Preset -->
                  <button
                    @click="selectedPreset = 'karaoke'"
                    class="subtitle-editor-dialog__preset-card"
                    :class="{ 'subtitle-editor-dialog__preset-card--selected': selectedPreset === 'karaoke' }"
                  >
                    <div class="subtitle-editor-dialog__preset-header">
                      <span class="font-semibold text-xs">Karaoke</span>
                      <div
                        v-if="selectedPreset === 'karaoke'"
                        class="subtitle-editor-dialog__preset-check"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div class="subtitle-editor-dialog__preset-sample" style="background: linear-gradient(135deg, #1a1a1c 0%, #2a2a2c 100%);">
                      <span style="color: #FFFFFF; font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: bold;">
                        <span style="color: #0ea5e9;">WORD</span> BY <span style="color: #0ea5e9;">WORD</span>
                      </span>
                    </div>
                    <p class="text-[10px] text-muted-foreground mt-1">Word-by-word highlight</p>
                  </button>
                </div>
              </div>

              <!-- Info Message -->
              <div class="subtitle-editor-dialog__alert subtitle-editor-dialog__alert--info">
                <Info :size="16" />
                <div class="flex-1">
                  <p class="font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">{{ applyScopeTitle }}</p>
                  <p class="text-[10px] sm:text-xs opacity-80">
                    {{ applyScopeDescription }}
                  </p>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="subtitle-editor-dialog__alert subtitle-editor-dialog__alert--error">
                <AlertCircle :size="16" />
                <p class="subtitle-editor-dialog__alert-text">{{ error }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="subtitle-editor-dialog__footer">
              <button
                @click="close"
                :disabled="isSaving"
                class="subtitle-editor-dialog__btn subtitle-editor-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="save"
                :disabled="!selectedPreset || isSaving || clips.length === 0"
                class="subtitle-editor-dialog__btn subtitle-editor-dialog__btn--primary"
              >
                <Loader2 v-if="isSaving" :size="16" class="subtitle-editor-dialog__spinner" />
                {{ isSaving ? 'Saving...' : 'Save' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { Captions, Info, Loader2, X, AlertCircle } from 'lucide-vue-next';
  import type { Clip, SubtitleSettings } from '@/types';

  interface Props {
    modelValue: boolean;
    clips: Clip[];
    projectId?: string | null;
    /** From VOD preset (creator layout) or local creator profile clip_build_defaults */
    defaultSubtitleSettings?: SubtitleSettings | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    clips: () => [],
    projectId: null,
    defaultSubtitleSettings: null,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    save: [clipIds: string[], presetId: string, applyToAll: boolean];
  }>();

  const selectedPreset = ref<string>('');
  const isSaving = ref(false);
  const error = ref<string>('');

  const applyScopeTitle = computed(() =>
    props.clips.length === 1 ? 'Applies to This Clip' : 'Applies to All Clips'
  );
  const applyScopeDescription = computed(() =>
    props.clips.length === 1
      ? 'This style will enable subtitles for the clip open in the framing editor. You can adjust style and position there after saving.'
      : 'This style will enable subtitles for every detected or manually added clip. Remove subtitles from a single clip from its subtitle properties panel.'
  );

  function close() {
    if (!isSaving.value) {
      emit('update:modelValue', false);
    }
  }

  async function save() {
    if (!selectedPreset.value) {
      error.value = 'Please select a subtitle style';
      return;
    }

    if (props.clips.length === 0) {
      error.value = 'No clips available for subtitles';
      return;
    }

    isSaving.value = true;
    error.value = '';

    try {
      emit('save', props.clips.map(c => c.id), selectedPreset.value, true);
      emit('update:modelValue', false);
    } catch (err) {
      console.error('Failed to save subtitle settings:', err);
      error.value = err instanceof Error ? err.message : 'Failed to save subtitle settings';
    } finally {
      isSaving.value = false;
    }
  }

  // Reset state when dialog opens; pre-select style from creator / VOD defaults when present
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        error.value = '';
        isSaving.value = false;

        const d = props.defaultSubtitleSettings;
        if (d?.selectedPresetId && String(d.selectedPresetId).trim()) {
          selectedPreset.value = String(d.selectedPresetId).trim();
        } else if (d) {
          selectedPreset.value = 'tiktok-bold';
        } else {
          selectedPreset.value = '';
        }
      }
    }
  );
</script>

<style scoped>
  /* Reuse styles from ClipDetectionConfirmDialog */
  .subtitle-editor-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    /* Above ManualPOIEditor (10050) so Edit Subtitles stays visible after POI transcription */
    z-index: 10100;
  }

  .subtitle-editor-dialog {
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

  .subtitle-editor-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .subtitle-editor-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .subtitle-editor-dialog__close {
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

  .subtitle-editor-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .subtitle-editor-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .subtitle-editor-dialog__icon {
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

  .subtitle-editor-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .subtitle-editor-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .subtitle-editor-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .subtitle-editor-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .subtitle-editor-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .subtitle-editor-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .subtitle-editor-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .subtitle-editor-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .subtitle-editor-dialog__toggle-box {
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
  }

  .subtitle-editor-dialog__toggle {
    position: relative;
    display: inline-flex;
    height: 24px;
    width: 44px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 9999px;
    border: 2px solid transparent;
    background-color: var(--sidebar-hover);
    transition: background-color 200ms ease-in-out;
  }

  .subtitle-editor-dialog__toggle:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--sidebar-accent);
  }

  .subtitle-editor-dialog__toggle--active {
    background-color: var(--sidebar-accent);
  }

  .subtitle-editor-dialog__toggle-thumb {
    pointer-events: none;
    display: inline-block;
    height: 20px;
    width: 20px;
    transform: translateX(0);
    border-radius: 9999px;
    background-color: white;
    transition: transform 200ms ease-in-out;
  }

  .subtitle-editor-dialog__toggle-thumb--active {
    transform: translateX(20px);
  }

  .subtitle-editor-dialog__preset-card {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .subtitle-editor-dialog__preset-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background-color: var(--sidebar-active);
  }

  .subtitle-editor-dialog__preset-card--selected {
    border-color: rgba(34, 211, 238, 0.4);
    background-color: rgba(34, 211, 238, 0.1);
  }

  .subtitle-editor-dialog__preset-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    color: var(--sidebar-text);
  }

  .subtitle-editor-dialog__preset-check {
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

  .subtitle-editor-dialog__preset-sample {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0.5rem;
    border-radius: 6px;
    min-height: 60px;
    overflow: hidden;
  }

  .subtitle-editor-dialog__clips-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .subtitle-editor-dialog__clips-list::-webkit-scrollbar {
    width: 6px;
  }

  .subtitle-editor-dialog__clips-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .subtitle-editor-dialog__clips-list::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .subtitle-editor-dialog__clip-item {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 150ms ease;
    font-size: 0.875rem;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .subtitle-editor-dialog__clip-item:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .subtitle-editor-dialog__clip-item--selected {
    background-color: rgba(34, 211, 238, 0.15);
    border-color: rgba(34, 211, 238, 0.3);
  }

  .subtitle-editor-dialog__checkmark {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--sidebar-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  .subtitle-editor-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .subtitle-editor-dialog__alert--info {
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .subtitle-editor-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .subtitle-editor-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  .subtitle-editor-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .subtitle-editor-dialog__btn {
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

  .subtitle-editor-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .subtitle-editor-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .subtitle-editor-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .subtitle-editor-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .subtitle-editor-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .subtitle-editor-dialog__spinner {
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
