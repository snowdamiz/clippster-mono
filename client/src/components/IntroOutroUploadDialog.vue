<template>
  <Teleport to="body">
    <Transition name="asset-modal">
      <div v-if="show" class="asset-modal__overlay" @click.self="handleClose">
        <Transition name="asset-dialog" appear>
          <div class="asset-modal">
            <!-- Accent Bar -->
            <div class="asset-modal__accent" />

            <!-- Header -->
            <div class="asset-modal__header">
              <button class="asset-modal__close" @click="handleClose" title="Close" :disabled="isUploading">
                <X :size="18" />
              </button>
              <div class="asset-modal__icon">
                <Upload :size="24" />
              </div>
              <h2 class="asset-modal__title">Upload Intro/Outro</h2>
              <p class="asset-modal__subtitle">
                {{ selectedFile ? 'Configure your intro or outro' : 'Select a video file to upload' }}
              </p>
            </div>

            <!-- Content -->
            <div class="asset-content">
              <!-- File Selection State -->
              <div v-if="!selectedFile" class="asset-dropzone-wrapper">
                <button @click="selectFile" class="asset-dropzone">
                  <div class="asset-dropzone__inner">
                    <FolderOpen class="asset-dropzone__icon" />
                    <p class="asset-dropzone__title">Click to browse video files</p>
                    <p class="asset-dropzone__hint">MP4, MOV, AVI, MKV, WEBM, and more</p>
                  </div>
                </button>
              </div>

              <!-- File Selected State -->
              <template v-else>
                <!-- File Card -->
                <div class="asset-file-card">
                  <div class="asset-file-card__icon asset-file-card__icon--video">
                    <Film class="asset-file-card__icon-svg" />
                  </div>
                  <div class="asset-file-card__info">
                    <p class="asset-file-card__name" :title="selectedFile.name">
                      {{ selectedFile.name }}
                    </p>
                    <p class="asset-file-card__meta">{{ fileExtension.toUpperCase() }} file</p>
                  </div>
                  <button @click="clearSelectedFile" class="asset-file-card__clear" title="Remove file">
                    <X class="asset-file-card__clear-icon" />
                  </button>
                </div>

                <!-- Asset Type Selection -->
                <div class="asset-field">
                  <label class="asset-field__label">Type</label>
                  <div class="asset-type-grid">
                    <button
                      @click="selectedType = 'intro'"
                      class="asset-type-option"
                      :class="{
                        'asset-type-option--selected': selectedType === 'intro',
                        'asset-type-option--cyan': true,
                      }"
                    >
                      <Play class="asset-type-option__icon" />
                      <span class="asset-type-option__label">Intro</span>
                    </button>
                    <button
                      @click="selectedType = 'outro'"
                      class="asset-type-option"
                      :class="{
                        'asset-type-option--selected': selectedType === 'outro',
                        'asset-type-option--violet': true,
                      }"
                    >
                      <Square class="asset-type-option__icon" />
                      <span class="asset-type-option__label">Outro</span>
                    </button>
                  </div>
                </div>

                <!-- Name Field -->
                <div class="asset-field">
                  <label class="asset-field__label">
                    Name
                    <span class="asset-field__hint">(optional)</span>
                  </label>
                  <input v-model="customName" type="text" :placeholder="selectedFile.name" class="asset-field__input" />
                </div>
              </template>
            </div>

            <!-- Footer -->
            <div class="asset-modal__footer">
              <button @click="handleClose" :disabled="isUploading" class="asset-btn asset-btn--secondary">
                Cancel
              </button>
              <button
                v-if="selectedFile"
                @click="handleUpload"
                :disabled="!selectedType || isUploading"
                class="asset-btn asset-btn--primary"
                :class="{
                  'asset-btn--primary-cyan': selectedType === 'intro',
                  'asset-btn--primary-violet': selectedType === 'outro',
                }"
              >
                <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
                <Upload v-else :size="16" />
                {{ isUploading ? 'Uploading...' : 'Upload' }}
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
  import { Upload, Play, Square, Loader2, X, FolderOpen, Film } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { createIntroOutro } from '@/services/database';
  import { generateId } from '@/services/database';
  import { useToast } from '@/composables/useToast';

  const emit = defineEmits<{
    close: [];
    uploaded: [];
  }>();

  const props = defineProps<{
    show: boolean;
  }>();

  const { success, error } = useToast();

  // State
  const selectedFile = ref<{ name: string; path: string } | null>(null);
  const fileExtension = ref('');
  const selectedType = ref<'intro' | 'outro'>('intro');
  const customName = ref('');
  const isUploading = ref(false);

  // Reset state when dialog is closed
  watch(
    () => props.show,
    (newValue) => {
      if (!newValue) {
        // Reset state when dialog closes
        setTimeout(() => {
          selectedFile.value = null;
          fileExtension.value = '';
          selectedType.value = 'intro';
          customName.value = '';
        }, 200); // Wait for animation to complete
      }
    }
  );

  async function selectFile() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const filters = [
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
        },
      ];

      const selected = await open({ multiple: false, filters });
      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      selectedFile.value = { name: fileName, path: selected };
      fileExtension.value = ext;
    } catch (err: any) {
      console.error('File selection failed:', err);
      error('File selection failed', err.message || 'Failed to select file');
    }
  }

  function clearSelectedFile() {
    selectedFile.value = null;
    fileExtension.value = '';
    selectedType.value = 'intro';
    customName.value = '';
  }

  function handleClose() {
    if (isUploading.value) return;
    emit('close');
  }

  async function handleUpload() {
    if (!selectedFile.value || !selectedType.value) return;

    isUploading.value = true;
    const sourcePath = selectedFile.value.path;
    const assetName = customName.value.trim() || selectedFile.value.name;

    try {
      await uploadVideoAsset(sourcePath, assetName, selectedType.value);
      emit('close');
      emit('uploaded');
    } catch (err: any) {
      console.error('Upload failed:', err);
      error('Upload failed', err.message || 'Failed to upload asset');
    } finally {
      isUploading.value = false;
    }
  }

  async function uploadVideoAsset(sourcePath: string, assetName: string, type: 'intro' | 'outro') {
    // Generate unique upload ID and embed metadata
    const uploadId = generateId();
    const uploadMetadata = { type, originalFilename: assetName };
    const encodedMetadata = btoa(JSON.stringify(uploadMetadata));
    const fullUploadId = `${uploadId}:${encodedMetadata}`;

    // Set up listener for upload completion
    const unlisten = await listen('asset-upload-complete', async (event) => {
      const result = event.payload as {
        upload_id: string;
        success: boolean;
        file_path?: string;
        thumbnail_path?: string;
        duration?: number;
        error?: string;
      };

      // Check if this is our upload
      const actualUploadId = result.upload_id.split(':')[0];
      if (actualUploadId !== uploadId) return;

      unlisten();

      if (result.success && result.file_path) {
        try {
          await createIntroOutro(
            type,
            assetName,
            result.file_path,
            result.duration,
            result.thumbnail_path || null,
            'completed'
          );

          const typeLabel = type === 'intro' ? 'Intro' : 'Outro';
          success(`${typeLabel} uploaded`, `"${assetName}" has been uploaded successfully`);
        } catch (dbError) {
          console.error('Failed to create database record:', dbError);
          error('Upload failed', `Failed to save asset: ${dbError}`);
        }
      } else {
        error('Upload failed', result.error || 'Unknown upload error');
      }
    });

    // Start async upload
    await invoke('upload_asset_async', {
      uploadId: fullUploadId,
      assetType: type,
      sourcePath,
      originalFilename: assetName,
    });

    // Show success message for starting upload
    const typeLabel = type === 'intro' ? 'Intro' : 'Outro';
    success(`${typeLabel} upload started`, `"${assetName}" is being processed...`);
  }
</script>

<style scoped>
  /* ===== Modal Overlay ===== */
  .asset-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Modal Container ===== */
  .asset-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 24px 80px rgba(0, 0, 0, 0.5);
  }

  /* ===== Accent Bar ===== */
  .asset-modal__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, #06b6d4, #8b5cf6);
  }

  /* ===== Header ===== */
  .asset-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.75rem 1.5rem 1.25rem;
    text-align: center;
  }

  .asset-modal__close {
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
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .asset-modal__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .asset-modal__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .asset-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2));
    color: #06b6d4;
    border: 1px solid rgba(6, 182, 212, 0.2);
  }

  .asset-modal__title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.025em;
  }

  .asset-modal__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0.375rem 0 0;
  }

  /* ===== Content Area ===== */
  .asset-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.25rem 1.25rem;
  }

  .asset-content::-webkit-scrollbar {
    width: 6px;
  }

  .asset-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .asset-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  /* ===== Dropzone ===== */
  .asset-dropzone-wrapper {
    margin-bottom: 1rem;
  }

  .asset-dropzone {
    width: 100%;
    padding: 2.5rem 2rem;
    border: 2px dashed var(--sidebar-border);
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .asset-dropzone:hover {
    border-color: rgba(6, 182, 212, 0.5);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .asset-dropzone__inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .asset-dropzone__icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
    transition: color 150ms ease;
  }

  .asset-dropzone:hover .asset-dropzone__icon {
    color: var(--sidebar-accent);
  }

  .asset-dropzone__title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
  }

  .asset-dropzone__hint {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== File Card ===== */
  .asset-file-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 10px;
    border: 1px solid var(--sidebar-border);
    margin-bottom: 1.25rem;
  }

  .asset-file-card__icon {
    width: 42px;
    height: 42px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background-color: var(--sidebar-surface);
  }

  .asset-file-card__icon--video {
    background-color: rgba(6, 182, 212, 0.15);
  }

  .asset-file-card__icon-svg {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
  }

  .asset-file-card__icon--video .asset-file-card__icon-svg {
    color: #22d3ee;
  }

  .asset-file-card__info {
    flex: 1;
    min-width: 0;
  }

  .asset-file-card__name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .asset-file-card__meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .asset-file-card__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .asset-file-card__clear:hover {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
  }

  .asset-file-card__clear-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Form Field ===== */
  .asset-field {
    margin-bottom: 1rem;
  }

  .asset-field__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.5rem;
  }

  .asset-field__hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .asset-field__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .asset-field__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .asset-field__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  /* ===== Asset Type Grid ===== */
  .asset-type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .asset-type-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 10px;
    border: 1.5px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .asset-type-option:hover {
    border-color: rgba(255, 255, 255, 0.12);
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .asset-type-option--selected {
    color: var(--sidebar-text);
  }

  .asset-type-option--selected.asset-type-option--cyan {
    background-color: rgba(6, 182, 212, 0.12);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .asset-type-option--selected.asset-type-option--violet {
    background-color: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .asset-type-option__icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    transition: color 150ms ease;
  }

  .asset-type-option--selected.asset-type-option--cyan .asset-type-option__icon {
    color: #22d3ee;
  }

  .asset-type-option--selected.asset-type-option--violet .asset-type-option__icon {
    color: #a78bfa;
  }

  .asset-type-option__label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .asset-type-option--selected.asset-type-option--cyan .asset-type-option__label {
    color: #22d3ee;
  }

  .asset-type-option--selected.asset-type-option--violet .asset-type-option__label {
    color: #a78bfa;
  }

  /* ===== Footer ===== */
  .asset-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
  }

  /* ===== Buttons ===== */
  .asset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .asset-btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .asset-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .asset-btn--primary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    min-width: 140px;
  }

  .asset-btn--primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .asset-btn--primary-cyan {
    background: linear-gradient(135deg, #06b6d4, #0891b2);
    color: white;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
  }

  .asset-btn--primary-cyan:hover:not(:disabled) {
    background: linear-gradient(135deg, #22d3ee, #06b6d4);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn--primary-violet {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);
  }

  .asset-btn--primary-violet:hover:not(:disabled) {
    background: linear-gradient(135deg, #a78bfa, #8b5cf6);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.35);
    transform: translateY(-1px);
  }

  .asset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Modal Animations ===== */
  .asset-modal-enter-active,
  .asset-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .asset-modal-enter-from,
  .asset-modal-leave-to {
    opacity: 0;
  }

  .asset-dialog-enter-active {
    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .asset-dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .asset-dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .asset-dialog-leave-to {
    opacity: 0;
    transform: scale(0.97);
  }

  /* ===== Utility Classes ===== */
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
