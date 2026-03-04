<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="org-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div class="org-dialog org-dialog--cyan org-dialog--lg">
            <!-- Accent Bar -->
            <div class="org-dialog__accent" :class="mode === 'intro' ? 'org-dialog__accent--blue' : 'org-dialog__accent--violet'" />

            <!-- Header -->
            <div class="org-dialog__header">
              <button class="org-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="org-dialog__icon" :class="mode === 'intro' ? 'org-dialog__icon--blue' : 'org-dialog__icon--violet'">
                <Play v-if="mode === 'intro'" :size="24" />
                <SkipForward v-else :size="24" />
              </div>
              <h2 class="org-dialog__title">
                {{ mode === 'intro' ? 'Intro' : 'Outro' }} Videos per Aspect Ratio
              </h2>
              <p class="org-dialog__subtitle">
                Upload a different {{ mode }} video for each aspect ratio
              </p>
            </div>

            <!-- Content -->
            <div class="org-dialog__content">
              <!-- Aspect Ratio Tabs -->
              <div class="aspect-ratio-tabs">
                <button
                  v-for="ratio in aspectRatios"
                  :key="ratio.id"
                  @click="activeRatio = ratio.id"
                  class="aspect-ratio-tab"
                  :class="{
                    'aspect-ratio-tab--active': activeRatio === ratio.id,
                    'aspect-ratio-tab--configured': isRatioConfigured(ratio.id)
                  }"
                >
                  <div class="aspect-ratio-tab-preview" :style="ratioPreviewStyle(ratio.id)"></div>
                  <span class="aspect-ratio-tab-label">{{ ratio.label }}</span>
                  <div v-if="isRatioConfigured(ratio.id)" class="aspect-ratio-tab-indicator">
                    <Check :size="12" />
                  </div>
                </button>
              </div>

              <!-- Current Ratio Configuration -->
              <div class="ratio-config">
                <div class="ratio-config-header">
                  <h3 class="ratio-config-title">{{ getRatioLabel(activeRatio) }}</h3>
                </div>

                <!-- Upload area -->
                <div class="ratio-config-content">
                  <!-- Has uploaded file -->
                  <div v-if="ratioAssets[activeRatio]" class="uploaded-file-card">
                    <div class="uploaded-file-card__icon" :class="mode === 'intro' ? 'uploaded-file-card__icon--blue' : 'uploaded-file-card__icon--violet'">
                      <Film :size="18" />
                    </div>
                    <div class="uploaded-file-card__info">
                      <p class="uploaded-file-card__name">{{ ratioAssets[activeRatio]!.name }}</p>
                      <p class="uploaded-file-card__meta">
                        {{ ratioAssets[activeRatio]!.duration ? formatDuration(ratioAssets[activeRatio]!.duration!) : 'Video file' }}
                      </p>
                    </div>
                    <button @click="removeAsset(activeRatio)" class="uploaded-file-card__remove" title="Remove">
                      <Trash2 :size="16" />
                    </button>
                  </div>

                  <!-- Upload button -->
                  <button
                    v-else
                    @click="uploadForRatio(activeRatio)"
                    :disabled="uploadingRatio === activeRatio"
                    class="upload-dropzone"
                    :class="mode === 'intro' ? 'upload-dropzone--blue' : 'upload-dropzone--violet'"
                  >
                    <Loader2 v-if="uploadingRatio === activeRatio" :size="24" class="upload-dropzone__spinner" />
                    <Upload v-else :size="24" class="upload-dropzone__icon" />
                    <p class="upload-dropzone__title">
                      {{ uploadingRatio === activeRatio ? 'Uploading...' : `Upload ${mode} video` }}
                    </p>
                    <p class="upload-dropzone__hint">MP4, MOV, AVI, MKV, WEBM</p>
                  </button>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="org-dialog__footer">
              <button @click="close" class="org-dialog__btn org-dialog__btn--secondary">
                Cancel
              </button>
              <button @click="save" class="org-dialog__btn org-dialog__btn--primary" :class="mode === 'intro' ? 'org-dialog__btn--primary-blue' : 'org-dialog__btn--primary-violet'">
                Save Settings
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
  import { X, Play, SkipForward, Check, Upload, Film, Loader2, Trash2 } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { createIntroOutro, generateId } from '@/services/database';
  import { useToast } from '@/composables/useToast';
  import type { AspectRatioId, RatioAssetMap } from '@/services/database/types';

  interface RatioAssetInfo {
    assetId: string;
    name: string;
    duration?: number;
  }

  interface AspectRatio {
    id: AspectRatioId;
    label: string;
  }

  const aspectRatios: AspectRatio[] = [
    { id: '16:9', label: '16:9 (Landscape)' },
    { id: '9:16', label: '9:16 (Portrait)' },
    { id: '1:1', label: '1:1 (Square)' },
    { id: '4:5', label: '4:5 (Portrait)' },
  ];

  const props = defineProps<{
    show: boolean;
    mode: 'intro' | 'outro';
    initialSettings?: RatioAssetMap | null;
  }>();

  const emit = defineEmits<{
    'update:show': [value: boolean];
    save: [settings: RatioAssetMap];
    close: [];
  }>();

  const { success, error: showError } = useToast();

  // State
  const activeRatio = ref<AspectRatioId>('16:9');
  const uploadingRatio = ref<AspectRatioId | null>(null);
  const ratioAssets = ref<Record<AspectRatioId, RatioAssetInfo | null>>({
    '16:9': null,
    '9:16': null,
    '1:1': null,
    '4:5': null,
  });

  // Fixed pixel dimensions for each ratio preview icon
  const ratioPreviewStyle = (ratioId: AspectRatioId): Record<string, string> => {
    switch (ratioId) {
      case '16:9': return { width: '32px', height: '18px' };
      case '9:16': return { width: '18px', height: '32px' };
      case '1:1':  return { width: '28px', height: '28px' };
      case '4:5':  return { width: '24px', height: '30px' };
      default:     return { width: '32px', height: '20px' };
    }
  };

  const isRatioConfigured = (ratio: AspectRatioId): boolean => {
    return ratioAssets.value[ratio] !== null;
  };

  const getRatioLabel = (ratio: AspectRatioId): string => {
    return aspectRatios.find(r => r.id === ratio)?.label || ratio;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const close = () => {
    emit('close');
    emit('update:show', false);
  };

  const removeAsset = (ratio: AspectRatioId) => {
    ratioAssets.value[ratio] = null;
  };

  const uploadForRatio = async (ratio: AspectRatioId) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'] },
        ],
      });

      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      uploadingRatio.value = ratio;

      const uploadId = generateId();
      const uploadMetadata = { type: props.mode, originalFilename: fileName };
      const encodedMetadata = btoa(JSON.stringify(uploadMetadata));
      const fullUploadId = `${uploadId}:${encodedMetadata}`;

      // Listen for upload completion
      const unlisten = await listen('asset-upload-complete', async (event) => {
        const result = event.payload as {
          upload_id: string;
          success: boolean;
          file_path?: string;
          thumbnail_path?: string;
          duration?: number;
          error?: string;
        };

        const actualUploadId = result.upload_id.split(':')[0];
        if (actualUploadId !== uploadId) return;

        unlisten();

        if (result.success && result.file_path) {
          try {
            const assetId = await createIntroOutro(
              props.mode,
              fileName,
              result.file_path,
              result.duration,
              result.thumbnail_path || null,
              'completed'
            );

            ratioAssets.value[ratio] = {
              assetId,
              name: fileName,
              duration: result.duration,
            };

            const typeLabel = props.mode === 'intro' ? 'Intro' : 'Outro';
            success(`${typeLabel} uploaded`, `"${fileName}" for ${ratio}`);
          } catch (dbError) {
            console.error('Failed to create database record:', dbError);
            showError('Upload failed', `Failed to save asset: ${dbError}`);
          }
        } else {
          showError('Upload failed', result.error || 'Unknown upload error');
        }

        uploadingRatio.value = null;
      });

      // Start async upload
      await invoke('upload_asset_async', {
        uploadId: fullUploadId,
        assetType: props.mode,
        sourcePath: selected,
        originalFilename: fileName,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      showError('Upload failed', err.message || 'Failed to upload');
      uploadingRatio.value = null;
    }
  };

  const save = () => {
    const settings: RatioAssetMap = {
      '16:9': ratioAssets.value['16:9'] ? { assetId: ratioAssets.value['16:9']!.assetId } : null,
      '9:16': ratioAssets.value['9:16'] ? { assetId: ratioAssets.value['9:16']!.assetId } : null,
      '1:1': ratioAssets.value['1:1'] ? { assetId: ratioAssets.value['1:1']!.assetId } : null,
      '4:5': ratioAssets.value['4:5'] ? { assetId: ratioAssets.value['4:5']!.assetId } : null,
    };

    emit('save', settings);
    close();
  };

  const initializeFromProps = async () => {
    // Reset all
    ratioAssets.value = { '16:9': null, '9:16': null, '1:1': null, '4:5': null };

    if (!props.initialSettings) return;

    // Load asset names for any pre-configured ratios
    const { getAllIntroOutros } = await import('@/services/database');
    const allAssets = await getAllIntroOutros(props.mode);

    for (const ratio of aspectRatios) {
      const config = props.initialSettings[ratio.id];
      if (config && config.assetId) {
        const asset = allAssets.find(a => a.id === config.assetId);
        ratioAssets.value[ratio.id] = {
          assetId: config.assetId,
          name: asset?.name || 'Unknown',
          duration: asset?.duration ?? undefined,
        };
      }
    }
  };

  // Watch for show prop
  watch(() => props.show, (show) => {
    if (show) {
      activeRatio.value = '16:9';
      uploadingRatio.value = null;
      initializeFromProps();
    }
  });
</script>

<style scoped>
  /* ===== Aspect Ratio Tabs ===== */
  .aspect-ratio-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
    padding-bottom: 1rem;
  }

  .aspect-ratio-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: var(--sidebar-surface);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .aspect-ratio-tab:hover {
    border-color: var(--sidebar-accent);
    background: var(--sidebar-hover);
  }

  .aspect-ratio-tab--active {
    border-color: var(--sidebar-accent);
    background: rgba(6, 182, 212, 0.1);
  }

  .aspect-ratio-tab--configured {
    border-color: #22c55e;
  }

  .aspect-ratio-tab-preview {
    background: var(--sidebar-border);
    border-radius: 3px;
    transition: all 0.2s ease;
  }

  .aspect-ratio-tab:hover .aspect-ratio-tab-preview {
    background: var(--sidebar-accent);
  }

  .aspect-ratio-tab--active .aspect-ratio-tab-preview {
    background: var(--sidebar-accent);
  }

  .aspect-ratio-tab--configured .aspect-ratio-tab-preview {
    background: #22c55e;
  }

  .aspect-ratio-tab-label {
    font-size: 0.75rem;
    color: var(--sidebar-foreground);
    font-weight: 500;
  }

  .aspect-ratio-tab-indicator {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 16px;
    height: 16px;
    background: #22c55e;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ===== Ratio Configuration ===== */
  .ratio-config {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .ratio-config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .ratio-config-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-foreground);
    margin: 0;
  }

  .ratio-config-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ===== Upload Dropzone ===== */
  .upload-dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem 1.5rem;
    border: 2px dashed var(--sidebar-border);
    border-radius: 10px;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--sidebar-foreground);
  }

  .upload-dropzone:hover:not(:disabled) {
    border-color: var(--sidebar-accent);
    background: rgba(6, 182, 212, 0.05);
  }

  .upload-dropzone--blue:hover:not(:disabled) {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
  }

  .upload-dropzone--violet:hover:not(:disabled) {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.05);
  }

  .upload-dropzone:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .upload-dropzone__icon {
    color: var(--sidebar-text-muted);
  }

  .upload-dropzone__spinner {
    color: var(--sidebar-accent);
    animation: spin 1s linear infinite;
  }

  .upload-dropzone__title {
    font-size: 0.875rem;
    font-weight: 500;
    margin: 0;
  }

  .upload-dropzone__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
  }

  /* ===== Uploaded File Card ===== */
  .uploaded-file-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .uploaded-file-card__icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  .uploaded-file-card__icon--blue {
    background: #3b82f6;
  }

  .uploaded-file-card__icon--violet {
    background: #a855f7;
  }

  .uploaded-file-card__info {
    flex: 1;
    min-width: 0;
  }

  .uploaded-file-card__name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-foreground);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .uploaded-file-card__meta {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .uploaded-file-card__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .uploaded-file-card__remove:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  /* ===== Modal Styles ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .org-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .org-dialog__accent--blue {
    background: linear-gradient(90deg, #3b82f6, rgba(59, 130, 246, 0.5));
  }

  .org-dialog__accent--violet {
    background: linear-gradient(90deg, #a855f7, rgba(168, 85, 247, 0.5));
  }

  .org-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--sidebar-foreground);
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .org-dialog__close:hover {
    background: var(--sidebar-hover);
  }

  .org-dialog__icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    margin-bottom: 1rem;
  }

  .org-dialog__icon--blue {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .org-dialog__icon--violet {
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-foreground);
    margin: 0 0 0.5rem 0;
  }

  .org-dialog__subtitle {
    color: var(--sidebar-text-muted);
    margin: 0;
    font-size: 0.875rem;
  }

  .org-dialog__content {
    flex: 1;
    padding: 0 1.5rem 1.5rem;
    overflow-y: auto;
  }

  .org-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .org-dialog__btn--secondary {
    background: var(--sidebar-surface);
    color: var(--sidebar-foreground);
    border-color: var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover {
    background: var(--sidebar-hover);
  }

  .org-dialog__btn--primary {
    color: white;
  }

  .org-dialog__btn--primary-blue {
    background: #3b82f6;
  }

  .org-dialog__btn--primary-blue:hover {
    background: #2563eb;
  }

  .org-dialog__btn--primary-violet {
    background: #a855f7;
  }

  .org-dialog__btn--primary-violet:hover {
    background: #9333ea;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.3s ease;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
