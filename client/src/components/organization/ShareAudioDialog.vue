<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { createSharedAudio, type SharedAudio } from '@/services/sharedAudioApi';
  import { Upload, Loader2, Music, AlertCircle, Share2, X, Users } from 'lucide-vue-next';

  const props = defineProps<{
    organizationId: number | string;
    members: Array<{ user_id: number; user: { id: number; name: string | null; email: string } }>;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'created', audio: SharedAudio): void;
  }>();

  const open = defineModel<boolean>('open', { default: false });

  const name = ref('');
  const description = ref('');
  const file = ref<File | null>(null);
  const duration = ref<number | null>(null);
  const shareWithAll = ref(true);
  const selectedRecipients = ref<number[]>([]);
  const uploading = ref(false);
  const error = ref<string | null>(null);
  const fileInputRef = ref<HTMLInputElement | null>(null);

  const canSubmit = computed(() => file.value && name.value.trim() && !uploading.value);

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const selectedFile = input.files[0];
    const isAudio =
      selectedFile.type.startsWith('audio/') ||
      /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(selectedFile.name);

    if (!isAudio) {
      error.value = 'Please select an audio file (MP3, WAV, M4A, OGG, AAC)';
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      error.value = 'File size must be less than 50MB';
      return;
    }

    file.value = selectedFile;
    error.value = null;

    if (!name.value) {
      name.value = selectedFile.name.replace(/\.[^/.]+$/, '');
    }

    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      duration.value = audio.duration;
      URL.revokeObjectURL(audio.src);

      if (audio.duration > 600) {
        error.value = 'Audio duration must be 10 minutes or less';
        file.value = null;
      }
    };
    audio.src = URL.createObjectURL(selectedFile);
  }

  async function handleSubmit() {
    if (!file.value || !name.value.trim()) return;

    uploading.value = true;
    error.value = null;

    try {
      const response = await createSharedAudio(props.organizationId, file.value, {
        name: name.value.trim(),
        description: description.value.trim() || undefined,
        duration: duration.value || undefined,
        shareWithAll: shareWithAll.value,
        recipientUserIds: shareWithAll.value ? undefined : selectedRecipients.value,
      });

      if (response.success && response.audio) {
        emit('created', response.audio);
        resetForm();
        open.value = false;
      } else {
        error.value = response.error || 'Failed to share audio';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to share audio';
    } finally {
      uploading.value = false;
    }
  }

  function resetForm() {
    name.value = '';
    description.value = '';
    file.value = null;
    duration.value = null;
    shareWithAll.value = true;
    selectedRecipients.value = [];
    error.value = null;
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function close() {
    open.value = false;
  }

  watch(open, (isOpen) => {
    if (!isOpen) resetForm();
  });
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="share-dialog__overlay" @click.self="close" @keydown.esc="close">
        <Transition name="dialog" appear>
          <div v-if="open" class="share-dialog" role="dialog" aria-modal="true">
            <div class="share-dialog__accent share-dialog__accent--audio"></div>

            <div class="share-dialog__header">
              <button class="share-dialog__close" @click="close" title="Close" :disabled="uploading">
                <X :size="18" />
              </button>
              <div class="share-dialog__icon share-dialog__icon--audio">
                <Music :size="24" />
              </div>
              <h2 class="share-dialog__title">Share Audio</h2>
              <p class="share-dialog__subtitle">Upload music or sound effects for your team to use in clips</p>
            </div>

            <div class="share-dialog__content">
              <form @submit.prevent="handleSubmit" class="share-dialog__form">
                <p class="share-dialog__description">
                  Members can download shared audio into their local library for use across all projects.
                  Audio expires after 30 days.
                </p>

                <div class="share-dialog__field">
                  <label class="share-dialog__label">Audio File *</label>
                  <div
                    class="share-dialog__upload-zone"
                    :class="{ 'share-dialog__upload-zone--has-file': file }"
                    @click="fileInputRef?.click()"
                  >
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                      class="share-dialog__file-input"
                      @change="handleFileSelect"
                    />
                    <div v-if="file" class="share-dialog__file-preview">
                      <Music class="share-dialog__file-icon" />
                      <div class="share-dialog__file-info">
                        <span class="share-dialog__file-name">{{ file.name }}</span>
                        <span class="share-dialog__file-meta">
                          {{ (file.size / (1024 * 1024)).toFixed(1) }} MB
                          <template v-if="duration"> • {{ formatDuration(duration) }}</template>
                        </span>
                      </div>
                    </div>
                    <div v-else class="share-dialog__upload-placeholder">
                      <Upload class="share-dialog__upload-icon" />
                      <span class="share-dialog__upload-text">Click to upload audio</span>
                      <span class="share-dialog__upload-hint">MP3, WAV, M4A, OGG, AAC (max 50MB, 10 minutes)</span>
                    </div>
                  </div>
                </div>

                <div class="share-dialog__field">
                  <label class="share-dialog__label">Name *</label>
                  <input
                    v-model="name"
                    type="text"
                    class="share-dialog__input"
                    placeholder="e.g. Campaign background track"
                    :disabled="uploading"
                  />
                </div>

                <div class="share-dialog__field">
                  <label class="share-dialog__label">Description</label>
                  <textarea
                    v-model="description"
                    class="share-dialog__textarea"
                    placeholder="Optional notes about when or how to use this audio"
                    :disabled="uploading"
                    rows="2"
                  ></textarea>
                </div>

                <div class="share-dialog__section">
                  <div class="share-dialog__section-header">
                    <Users :size="16" class="share-dialog__section-icon" />
                    <span class="share-dialog__section-title">Recipients</span>
                  </div>

                  <div class="share-dialog__toggle-row">
                    <span class="share-dialog__toggle-label">Share with all members</span>
                    <button
                      type="button"
                      class="share-dialog__toggle"
                      :class="{ 'share-dialog__toggle--active': shareWithAll }"
                      @click="shareWithAll = !shareWithAll"
                      :disabled="uploading"
                    >
                      <span class="share-dialog__toggle-knob"></span>
                    </button>
                  </div>

                  <div v-if="!shareWithAll" class="share-dialog__recipients-list">
                    <label v-for="member in members" :key="member.user_id" class="share-dialog__recipient">
                      <input
                        type="checkbox"
                        :value="member.user_id"
                        v-model="selectedRecipients"
                        :disabled="uploading"
                        class="share-dialog__checkbox"
                      />
                      <span class="share-dialog__recipient-name">{{ member.user.name || member.user.email }}</span>
                    </label>
                    <p class="share-dialog__recipients-count">
                      {{ selectedRecipients.length }} member(s) selected
                    </p>
                  </div>
                </div>

                <div v-if="error" class="share-dialog__error">
                  <AlertCircle :size="16" />
                  <span>{{ error }}</span>
                </div>
              </form>
            </div>

            <div class="share-dialog__footer">
              <button
                type="button"
                class="share-dialog__btn share-dialog__btn--secondary"
                @click="close"
                :disabled="uploading"
              >
                Cancel
              </button>
              <button
                type="button"
                class="share-dialog__btn share-dialog__btn--primary"
                @click="handleSubmit"
                :disabled="!canSubmit"
              >
                <Loader2 v-if="uploading" class="share-dialog__btn-spinner" />
                <Share2 v-else :size="16" />
                {{ uploading ? 'Uploading...' : 'Share Audio' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
  .share-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .share-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .share-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .share-dialog__accent--audio {
    background: linear-gradient(90deg, #a855f7, rgba(168, 85, 247, 0.5));
  }

  .share-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .share-dialog__close {
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

  .share-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .share-dialog__icon--audio {
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .share-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .share-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .share-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .share-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .share-dialog__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .share-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .share-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .share-dialog__input,
  .share-dialog__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
  }

  .share-dialog__textarea {
    resize: vertical;
    min-height: 60px;
  }

  .share-dialog__upload-zone {
    border: 2px dashed var(--sidebar-border);
    border-radius: 10px;
    padding: 1.5rem;
    cursor: pointer;
    text-align: center;
  }

  .share-dialog__upload-zone--has-file {
    border-style: solid;
    border-color: #a855f7;
    background-color: rgba(168, 85, 247, 0.05);
  }

  .share-dialog__file-input {
    display: none;
  }

  .share-dialog__file-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .share-dialog__file-icon {
    width: 32px;
    height: 32px;
    color: #a855f7;
  }

  .share-dialog__file-name {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .share-dialog__file-meta {
    display: block;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .share-dialog__upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .share-dialog__upload-icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
  }

  .share-dialog__upload-text,
  .share-dialog__upload-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .share-dialog__section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .share-dialog__section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .share-dialog__section-icon {
    color: #a855f7;
  }

  .share-dialog__section-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .share-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .share-dialog__toggle-label {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  .share-dialog__toggle {
    position: relative;
    width: 40px;
    height: 22px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 11px;
    cursor: pointer;
  }

  .share-dialog__toggle--active {
    background-color: #a855f7;
    border-color: #a855f7;
  }

  .share-dialog__toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background-color: white;
    border-radius: 50%;
    transition: transform 150ms ease;
  }

  .share-dialog__toggle--active .share-dialog__toggle-knob {
    transform: translateX(18px);
  }

  .share-dialog__recipients-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 150px;
    overflow-y: auto;
    padding: 0.5rem;
    background-color: var(--sidebar-surface);
    border-radius: 8px;
  }

  .share-dialog__recipient {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem;
    cursor: pointer;
  }

  .share-dialog__recipient-name {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  .share-dialog__recipients-count {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.5rem 0 0;
  }

  .share-dialog__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #f87171;
  }

  .share-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .share-dialog__btn {
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

  .share-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .share-dialog__btn--primary {
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
    color: white;
  }

  .share-dialog__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
