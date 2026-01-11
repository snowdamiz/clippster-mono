<template>
  <PageLayout
    title="Organization Assets"
    description="Upload intros, outros, watermarks, and other assets for your team"
    :show-header="true"
    :icon="FolderOpen"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Assets' }]"
  >
    <template #actions>
      <Button v-if="isAdmin" @click="openUploadDialog">
        <Upload class="h-4 w-4 mr-1.5" />
        Upload Asset
      </Button>
    </template>

    <div class="org-assets">
      <!-- Loading State -->
      <div v-if="assetsLoading" class="org-assets__loading">
        <Loader2 class="org-assets__loading-spinner" />
      </div>

      <!-- Assets List Grouped by Type -->
      <div v-else-if="orgAssets.length > 0" class="org-assets__groups">
        <div v-for="group in groupedAssets" :key="group.type" class="org-assets__group">
          <button @click="toggleAssetGroup(group.type)" class="org-assets__group-header">
            <component
              :is="getAssetTypeIcon(group.type)"
              class="org-assets__group-icon"
              :class="getAssetTypeColor(group.type)"
            />
            <span class="org-assets__group-title">{{ getAssetTypeLabel(group.type) }}s</span>
            <span class="org-assets__group-count">{{ group.assets.length }}</span>
            <ChevronDown
              class="org-assets__group-chevron"
              :class="{ 'org-assets__group-chevron--collapsed': collapsedGroups.has(group.type) }"
            />
          </button>

          <div v-if="!collapsedGroups.has(group.type)" class="org-assets__group-content">
            <div
              v-for="asset in group.assets"
              :key="asset.id"
              class="org-assets__item"
              :class="{ 'org-assets__item--playing': isAudioPlaying(asset.id) }"
              @click="handleAssetClick(asset)"
            >
              <div class="org-assets__item-thumb">
                <img
                  v-if="asset.asset_type === 'audio'"
                  :src="AUDIO_THUMBNAIL"
                  :alt="asset.name"
                  class="org-assets__item-thumb-img"
                />
                <img
                  v-else-if="asset.thumbnail_url || (asset.url && ['image', 'watermark'].includes(asset.asset_type))"
                  :src="asset.thumbnail_url || asset.url"
                  :alt="asset.name"
                  class="org-assets__item-thumb-img"
                />
                <component v-else :is="getAssetTypeIcon(asset.asset_type)" class="org-assets__item-thumb-icon" />

                <div
                  v-if="['intro', 'outro', 'audio'].includes(asset.asset_type)"
                  class="org-assets__item-thumb-overlay"
                  :class="{ 'org-assets__item-thumb-overlay--visible': isAudioPlaying(asset.id) }"
                >
                  <Pause
                    v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)"
                    class="org-assets__item-thumb-play"
                  />
                  <Play v-else class="org-assets__item-thumb-play" />
                </div>
              </div>

              <div class="org-assets__item-info">
                <p class="org-assets__item-name" :title="asset.name">{{ asset.name }}</p>
                <p class="org-assets__item-meta">
                  <span v-if="asset.duration">
                    {{ Math.floor(asset.duration / 60) }}:{{ String(Math.floor(asset.duration % 60)).padStart(2, '0') }}
                  </span>
                  <span v-else-if="asset.width && asset.height">{{ asset.width }}×{{ asset.height }}</span>
                </p>
              </div>

              <div class="org-assets__item-actions" @click.stop>
                <button
                  v-if="['intro', 'outro', 'audio'].includes(asset.asset_type)"
                  @click="handleAssetClick(asset)"
                  class="org-assets__item-action"
                  :title="asset.asset_type === 'audio' ? (isAudioPlaying(asset.id) ? 'Pause' : 'Play') : 'Play'"
                >
                  <Pause
                    v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)"
                    class="org-assets__item-action-icon"
                  />
                  <Play v-else class="org-assets__item-action-icon" />
                </button>
                <button
                  v-if="isAdmin"
                  @click="handleDeleteAsset(asset)"
                  :disabled="deletingAssetId === asset.id"
                  class="org-assets__item-action org-assets__item-action--danger"
                  title="Delete asset"
                >
                  <Loader2
                    v-if="deletingAssetId === asset.id"
                    class="org-assets__item-action-icon org-assets__item-action-icon--spin"
                  />
                  <Trash2 v-else class="org-assets__item-action-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="org-assets__empty">
        <Package class="org-assets__empty-icon" />
        <p class="org-assets__empty-title">No assets uploaded yet.</p>
        <p v-if="isAdmin" class="org-assets__empty-text">
          Upload intros, outros, watermarks, or other assets for your team.
        </p>
      </div>
    </div>

    <!-- Upload Asset Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showUploadDialog" class="org-assets__modal-backdrop" @click.self="closeUploadDialog">
          <div class="org-assets__modal">
            <div class="org-assets__modal-accent"></div>
            <div class="org-assets__modal-content">
              <div class="org-assets__modal-header">
                <div class="org-assets__modal-icon">
                  <Upload class="org-assets__modal-icon-svg" />
                </div>
                <h2 class="org-assets__modal-title">Upload Asset</h2>
                <p class="org-assets__modal-subtitle">
                  {{ uploadDialogFile ? 'Configure your asset' : 'Select a file to upload' }}
                </p>
              </div>

              <!-- File Selection State -->
              <div v-if="!uploadDialogFile" class="org-assets__modal-body">
                <button @click="selectFileForUpload" class="org-assets__upload-dropzone">
                  <div class="org-assets__upload-dropzone-inner">
                    <FolderOpen class="org-assets__upload-dropzone-icon" />
                    <p class="org-assets__upload-dropzone-title">Click to browse files</p>
                    <p class="org-assets__upload-dropzone-hint">Video, image, or audio files</p>
                  </div>
                </button>

                <button class="org-assets__modal-btn org-assets__modal-btn--secondary" @click="closeUploadDialog">
                  Cancel
                </button>
              </div>

              <!-- File Selected State -->
              <div v-else class="org-assets__modal-body">
                <div class="org-assets__upload-file">
                  <div class="org-assets__upload-file-icon" :class="getFileTypeIconBg(uploadDialogFileType)">
                    <component
                      :is="getFileTypeIcon(uploadDialogFileType)"
                      class="org-assets__upload-file-icon-svg"
                      :class="getFileTypeIconColor(uploadDialogFileType)"
                    />
                  </div>
                  <div class="org-assets__upload-file-info">
                    <p class="org-assets__upload-file-name" :title="uploadDialogFile.name">
                      {{ uploadDialogFile.name }}
                    </p>
                    <p class="org-assets__upload-file-meta">
                      {{ formatFileSize(uploadDialogFile.size) }} • {{ uploadDialogFileType.toUpperCase() }}
                    </p>
                  </div>
                  <button @click="clearUploadFile" class="org-assets__upload-file-clear" title="Remove file">
                    <X class="org-assets__upload-file-clear-icon" />
                  </button>
                </div>

                <div class="org-assets__form-group">
                  <label class="org-assets__form-label">Asset Type</label>
                  <div class="org-assets__type-grid">
                    <button
                      v-for="option in uploadDialogAssetOptions"
                      :key="option.value"
                      @click="uploadDialogSelectedType = option.value"
                      class="org-assets__type-option"
                      :class="{ 'org-assets__type-option--selected': uploadDialogSelectedType === option.value }"
                    >
                      <component :is="option.icon" class="org-assets__type-option-icon" />
                      <span class="org-assets__type-option-label">{{ option.label }}</span>
                      <span v-if="option.recommended" class="org-assets__type-option-badge">likely</span>
                    </button>
                  </div>
                </div>

                <div class="org-assets__form-group">
                  <label class="org-assets__form-label">
                    Name
                    <span class="org-assets__form-hint">(optional)</span>
                  </label>
                  <input
                    v-model="uploadDialogAssetName"
                    type="text"
                    :placeholder="uploadDialogFile.name"
                    class="org-assets__form-input"
                  />
                </div>

                <div class="org-assets__modal-actions">
                  <button
                    class="org-assets__modal-btn org-assets__modal-btn--secondary"
                    @click="closeUploadDialog"
                    :disabled="uploadingAsset"
                  >
                    Cancel
                  </button>
                  <button
                    class="org-assets__modal-btn org-assets__modal-btn--primary"
                    @click="executeAssetUpload"
                    :disabled="uploadingAsset || !uploadDialogSelectedType"
                  >
                    <Loader2 v-if="uploadingAsset" class="org-assets__btn-spinner" />
                    <Upload v-else class="org-assets__btn-icon" />
                    {{ uploadingAsset ? 'Uploading...' : 'Upload' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Video Player Dialog -->
    <VideoPlayerDialog
      :video="null"
      :video-url="videoToPlay?.url"
      :video-title="videoToPlay?.name"
      :show-video-player="showVideoPlayer"
      @close="closeVideoPlayer"
    />

    <!-- Image Preview Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showImagePreview && imageToPreview"
          class="org-assets__image-backdrop"
          @click.self="closeImagePreview"
        >
          <div class="org-assets__image-container">
            <button @click="closeImagePreview" class="org-assets__image-close">
              <X class="org-assets__image-close-icon" />
            </button>
            <img :src="imageToPreview.url" :alt="imageToPreview.name" class="org-assets__image-preview" />
            <div class="org-assets__image-info">
              <p class="org-assets__image-name">{{ imageToPreview.name }}</p>
              <p class="org-assets__image-meta">
                <span v-if="imageToPreview.width && imageToPreview.height">
                  {{ imageToPreview.width }}×{{ imageToPreview.height }}
                </span>
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import {
    Upload,
    Loader2,
    ChevronDown,
    Play,
    Pause,
    Trash2,
    Package,
    Film,
    Image as ImageIcon,
    Music,
    FolderOpen,
    X,
  } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { Button } from '@/components/ui/button';
  import PageLayout from '@/components/PageLayout.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import {
    uploadOrganizationAsset,
    deleteOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';

  const { success: showSuccess, error: showError } = useToast();

  const { organizationId, isAdmin, orgAssets, assetsLoading, assetsLoaded, loadOrgAssets } = useOrganization();

  // Audio waveform thumbnail
  const AUDIO_THUMBNAIL =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMDY0RTNCIi8+CjxyZWN0IHg9IjMwIiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjQ1IiB5PSIzNSIgd2lkdGg9IjgiIGhlaWdodD0iNTAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjYwIiB5PSIyNSIgd2lkdGg9IjgiIGhlaWdodD0iNzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9Ijc1IiB5PSI0MCIgd2lkdGg9IjgiIGhlaWdodD0iNDAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjkwIiB5PSIzMCIgd2lkdGg9IjgiIGhlaWdodD0iNjAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjEwNSIgeT0iMjAiIHdpZHRoPSI4IiBoZWlnaHQ9IjgwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxMjAiIHk9IjM1IiB3aWR0aD0iOCIgaGVpZ2h0PSI1MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPHJlY3QgeD0iMTM1IiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjE1MCIgeT0iMzAiIHdpZHRoPSI4IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxNjUiIHk9IjQwIiB3aWR0aD0iOCIgaGVpZ2h0PSI0MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPC9zdmc+';

  // Local state
  const collapsedGroups = ref<Set<string>>(new Set());
  const deletingAssetId = ref<number | null>(null);
  const showUploadDialog = ref(false);
  const uploadDialogFile = ref<{ name: string; size: number; path: string; blob: Blob } | null>(null);
  const uploadDialogFileType = ref('');
  const uploadDialogSelectedType = ref<'intro' | 'outro' | 'watermark' | 'audio' | 'image' | ''>('');
  const uploadDialogAssetName = ref('');
  const uploadDialogAssetOptions = ref<Array<{ value: string; label: string; icon: any; recommended?: boolean }>>([]);
  const uploadingAsset = ref(false);

  // Video/Audio/Image playback state
  const showVideoPlayer = ref(false);
  const videoToPlay = ref<ServerOrganizationAsset | null>(null);
  const currentlyPlayingAudio = ref<number | null>(null);
  const audioElement = ref<HTMLAudioElement | null>(null);
  const showImagePreview = ref(false);
  const imageToPreview = ref<ServerOrganizationAsset | null>(null);

  // Computed: Group assets by type
  const groupedAssets = computed(() => {
    const typeOrder = ['intro', 'outro', 'watermark', 'audio', 'image'];
    const groups: { type: string; assets: ServerOrganizationAsset[] }[] = [];

    for (const type of typeOrder) {
      const assets = orgAssets.value.filter((a) => a.asset_type === type);
      if (assets.length > 0) {
        groups.push({ type, assets });
      }
    }

    return groups;
  });

  function toggleAssetGroup(type: string) {
    if (collapsedGroups.value.has(type)) {
      collapsedGroups.value.delete(type);
    } else {
      collapsedGroups.value.add(type);
    }
  }

  function getAssetTypeColor(type: string): string {
    switch (type) {
      case 'intro':
        return 'text-blue-400';
      case 'outro':
        return 'text-purple-400';
      case 'watermark':
        return 'text-amber-400';
      case 'audio':
        return 'text-emerald-400';
      case 'image':
        return 'text-cyan-400';
      default:
        return 'text-muted-foreground';
    }
  }

  function getAssetTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      intro: 'Intro',
      outro: 'Outro',
      watermark: 'Watermark',
      audio: 'Audio',
      image: 'Image',
    };
    return labels[type] || type;
  }

  function getAssetTypeIcon(type: string) {
    switch (type) {
      case 'intro':
      case 'outro':
        return Film;
      case 'watermark':
      case 'image':
        return ImageIcon;
      case 'audio':
        return Music;
      default:
        return Package;
    }
  }

  // Upload dialog functions
  function openUploadDialog() {
    showUploadDialog.value = true;
    uploadDialogFile.value = null;
    uploadDialogFileType.value = '';
    uploadDialogSelectedType.value = '';
    uploadDialogAssetName.value = '';
    uploadDialogAssetOptions.value = [];
  }

  function closeUploadDialog() {
    if (uploadingAsset.value) return;
    showUploadDialog.value = false;
    clearUploadFile();
  }

  function clearUploadFile() {
    uploadDialogFile.value = null;
    uploadDialogFileType.value = '';
    uploadDialogSelectedType.value = '';
    uploadDialogAssetName.value = '';
    uploadDialogAssetOptions.value = [];
  }

  function getAssetOptionsForFileType(ext: string) {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) {
      return [
        { value: 'intro', label: 'Intro', icon: Film, recommended: true },
        { value: 'outro', label: 'Outro', icon: Film },
      ];
    } else if (imageExtensions.includes(ext)) {
      return [
        { value: 'watermark', label: 'Watermark', icon: ImageIcon, recommended: true },
        { value: 'image', label: 'Sticker / Image', icon: ImageIcon },
      ];
    } else if (audioExtensions.includes(ext)) {
      return [{ value: 'audio', label: 'Audio', icon: Music, recommended: true }];
    }
    return [];
  }

  function getFileTypeIcon(ext: string) {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) return Film;
    if (imageExtensions.includes(ext)) return ImageIcon;
    if (audioExtensions.includes(ext)) return Music;
    return Package;
  }

  function getFileTypeIconBg(ext: string): string {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) return 'org-assets__upload-file-icon--video';
    if (imageExtensions.includes(ext)) return 'org-assets__upload-file-icon--image';
    if (audioExtensions.includes(ext)) return 'org-assets__upload-file-icon--audio';
    return '';
  }

  function getFileTypeIconColor(ext: string): string {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) return 'text-blue-400';
    if (imageExtensions.includes(ext)) return 'text-amber-400';
    if (audioExtensions.includes(ext)) return 'text-emerald-400';
    return 'text-zinc-400';
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function selectFileForUpload() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const filters = [
        {
          name: 'Media Files',
          extensions: [
            'mp4',
            'mov',
            'avi',
            'mkv',
            'webm',
            'png',
            'jpg',
            'jpeg',
            'gif',
            'webp',
            'mp3',
            'wav',
            'aac',
            'm4a',
            'ogg',
          ],
        },
      ];

      const selected = await open({ multiple: false, filters });
      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: selected });

      const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) throw new Error('Invalid data URL format');

      const mimeType = base64Match[1];
      const base64Data = base64Match[2];

      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });

      uploadDialogFile.value = { name: fileName, size: blob.size, path: selected, blob };
      uploadDialogFileType.value = ext;

      const options = getAssetOptionsForFileType(ext);
      uploadDialogAssetOptions.value = options;

      const recommended = options.find((o) => o.recommended);
      if (recommended) {
        uploadDialogSelectedType.value = recommended.value as any;
      } else if (options.length > 0) {
        uploadDialogSelectedType.value = options[0].value as any;
      }
    } catch (err: any) {
      showError('File selection failed', err.message || 'Failed to select file');
    }
  }

  async function executeAssetUpload() {
    if (!organizationId.value || !isAdmin.value || !uploadDialogFile.value || !uploadDialogSelectedType.value) return;

    uploadingAsset.value = true;

    try {
      const file = new File([uploadDialogFile.value.blob], uploadDialogFile.value.name, {
        type: uploadDialogFile.value.blob.type,
      });
      const assetName = uploadDialogAssetName.value.trim() || uploadDialogFile.value.name;

      const response = await uploadOrganizationAsset(organizationId.value, file, uploadDialogSelectedType.value, {
        name: assetName,
      });

      if (response.success && response.asset) {
        orgAssets.value.unshift(response.asset);
        showSuccess('Asset uploaded', `"${assetName}" has been uploaded successfully`);
        closeUploadDialog();
      } else {
        showError('Upload failed', response.error || 'Failed to upload asset');
      }
    } catch (err: any) {
      showError('Upload failed', err.message || 'Failed to upload asset');
    } finally {
      uploadingAsset.value = false;
    }
  }

  async function handleDeleteAsset(asset: ServerOrganizationAsset) {
    if (!organizationId.value || !isAdmin.value) return;

    deletingAssetId.value = asset.id;
    try {
      const response = await deleteOrganizationAsset(organizationId.value, asset.id);
      if (response.success) {
        orgAssets.value = orgAssets.value.filter((a) => a.id !== asset.id);
        showSuccess('Asset deleted', `"${asset.name}" has been deleted`);
      } else {
        showError('Delete failed', response.error || 'Failed to delete asset');
      }
    } catch (err: any) {
      showError('Delete failed', err.message || 'Failed to delete asset');
    } finally {
      deletingAssetId.value = null;
    }
  }

  // Asset playback
  function handleAssetClick(asset: ServerOrganizationAsset) {
    if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
      playVideoAsset(asset);
    } else if (asset.asset_type === 'audio') {
      toggleAudioPlayback(asset);
    } else if (asset.asset_type === 'image' || asset.asset_type === 'watermark') {
      openImagePreview(asset);
    }
  }

  function playVideoAsset(asset: ServerOrganizationAsset) {
    videoToPlay.value = asset;
    showVideoPlayer.value = true;
  }

  function closeVideoPlayer() {
    showVideoPlayer.value = false;
    videoToPlay.value = null;
  }

  function toggleAudioPlayback(asset: ServerOrganizationAsset) {
    if (currentlyPlayingAudio.value === asset.id) {
      if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
      }
      currentlyPlayingAudio.value = null;
    } else {
      if (audioElement.value) {
        audioElement.value.pause();
      }

      audioElement.value = new Audio(asset.url);
      audioElement.value.onended = () => {
        currentlyPlayingAudio.value = null;
      };
      audioElement.value.onerror = () => {
        showError('Playback Error', 'Failed to play audio file');
        currentlyPlayingAudio.value = null;
      };
      audioElement.value.play();
      currentlyPlayingAudio.value = asset.id;
    }
  }

  function isAudioPlaying(assetId: number): boolean {
    return currentlyPlayingAudio.value === assetId;
  }

  function openImagePreview(asset: ServerOrganizationAsset) {
    imageToPreview.value = asset;
    showImagePreview.value = true;
  }

  function closeImagePreview() {
    showImagePreview.value = false;
    imageToPreview.value = null;
  }

  onMounted(() => {
    if (!assetsLoaded.value) {
      loadOrgAssets();
    }
  });

  onUnmounted(() => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }
  });
</script>

<style scoped>
  .org-assets {
    width: 100%;
    padding: 1.5rem;
  }

  .org-assets__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rem;
  }

  .org-assets__loading-spinner {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
    animation: spin 0.8s linear infinite;
  }

  .org-assets__groups {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-assets__group {
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .org-assets__group-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: none;
    cursor: pointer;
    transition: background-color 150ms ease;
    text-align: left;
  }

  .org-assets__group-header:hover {
    background-color: rgba(0, 0, 0, 0.3);
  }

  .org-assets__group-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .org-assets__group-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-assets__group-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background-color: var(--sidebar-hover);
    border-radius: 4px;
    color: var(--sidebar-text-muted);
  }

  .org-assets__group-chevron {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    margin-left: auto;
    transition: transform 200ms ease;
  }

  .org-assets__group-chevron--collapsed {
    transform: rotate(-90deg);
  }

  .org-assets__group-content {
    display: flex;
    flex-direction: column;
  }

  .org-assets__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--sidebar-border);
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .org-assets__item:hover {
    background-color: rgba(0, 0, 0, 0.15);
  }

  .org-assets__item--playing {
    background-color: rgba(139, 92, 246, 0.1);
  }

  .org-assets__item-thumb {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    background-color: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
  }

  .org-assets__item-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-assets__item-thumb-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .org-assets__item-thumb-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .org-assets__item:hover .org-assets__item-thumb-overlay,
  .org-assets__item-thumb-overlay--visible {
    opacity: 1;
  }

  .org-assets__item-thumb-play {
    width: 16px;
    height: 16px;
    color: white;
  }

  .org-assets__item-info {
    flex: 1;
    min-width: 0;
  }

  .org-assets__item-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-assets__item-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .org-assets__item-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .org-assets__item:hover .org-assets__item-actions {
    opacity: 1;
  }

  .org-assets__item-action {
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
  }

  .org-assets__item-action:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-assets__item-action--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .org-assets__item-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-assets__item-action-icon {
    width: 16px;
    height: 16px;
  }

  .org-assets__item-action-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .org-assets__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
  }

  .org-assets__empty-icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    margin-bottom: 0.75rem;
  }

  .org-assets__empty-title {
    color: var(--sidebar-text-muted);
    margin: 0 0 0.25rem;
  }

  .org-assets__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: 0;
  }

  /* Upload Modal */
  .org-assets__modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .org-assets__modal {
    background: linear-gradient(to bottom, #18181b, #09090b);
    border-radius: 16px;
    max-width: 400px;
    width: calc(100% - 2rem);
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .org-assets__modal-accent {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, #06b6d4 0%, #10b981 100%);
  }

  .org-assets__modal-content {
    padding: 1.5rem;
  }

  .org-assets__modal-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .org-assets__modal-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    border: 1px solid rgba(6, 182, 212, 0.3);
    margin-bottom: 1rem;
  }

  .org-assets__modal-icon-svg {
    width: 24px;
    height: 24px;
    color: #22d3ee;
  }

  .org-assets__modal-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .org-assets__modal-subtitle {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0.25rem 0 0;
  }

  .org-assets__modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-assets__modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .org-assets__modal-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .org-assets__modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-assets__modal-btn--secondary {
    background-color: #27272a;
    color: #d4d4d8;
    border: 1px solid #3f3f46;
  }

  .org-assets__modal-btn--secondary:hover:not(:disabled) {
    background-color: #3f3f46;
    color: white;
  }

  .org-assets__modal-btn--primary {
    background: linear-gradient(135deg, #06b6d4 0%, #10b981 100%);
    color: white;
  }

  .org-assets__modal-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-assets__btn-spinner,
  .org-assets__btn-icon {
    width: 16px;
    height: 16px;
  }

  .org-assets__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  .org-assets__upload-dropzone {
    width: 100%;
    padding: 2rem;
    border: 2px dashed #3f3f46;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__upload-dropzone:hover {
    border-color: rgba(6, 182, 212, 0.5);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .org-assets__upload-dropzone-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .org-assets__upload-dropzone-icon {
    width: 28px;
    height: 28px;
    color: #71717a;
  }

  .org-assets__upload-dropzone:hover .org-assets__upload-dropzone-icon {
    color: #22d3ee;
  }

  .org-assets__upload-dropzone-title {
    font-weight: 500;
    color: #d4d4d8;
    margin: 0;
  }

  .org-assets__upload-dropzone-hint {
    font-size: 0.75rem;
    color: #71717a;
    margin: 0;
  }

  .org-assets__upload-file {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: rgba(24, 24, 27, 0.8);
    border-radius: 12px;
    border: 1px solid #3f3f46;
  }

  .org-assets__upload-file-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-assets__upload-file-icon--video {
    background-color: rgba(59, 130, 246, 0.1);
  }

  .org-assets__upload-file-icon--image {
    background-color: rgba(245, 158, 11, 0.1);
  }

  .org-assets__upload-file-icon--audio {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .org-assets__upload-file-icon-svg {
    width: 20px;
    height: 20px;
  }

  .org-assets__upload-file-info {
    flex: 1;
    min-width: 0;
  }

  .org-assets__upload-file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-assets__upload-file-meta {
    font-size: 0.75rem;
    color: #71717a;
    margin: 0;
  }

  .org-assets__upload-file-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #71717a;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__upload-file-clear:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #d4d4d8;
  }

  .org-assets__upload-file-clear-icon {
    width: 16px;
    height: 16px;
  }

  .org-assets__form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-assets__form-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #d4d4d8;
  }

  .org-assets__form-hint {
    color: #71717a;
    font-weight: 400;
  }

  .org-assets__form-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    background-color: rgba(24, 24, 27, 0.8);
    border: 1px solid #3f3f46;
    border-radius: 8px;
    color: white;
    transition: all 150ms ease;
  }

  .org-assets__form-input::placeholder {
    color: #52525b;
  }

  .org-assets__form-input:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
  }

  .org-assets__type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .org-assets__type-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 12px;
    border: 1px solid #3f3f46;
    background-color: rgba(24, 24, 27, 0.5);
    color: #a1a1aa;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-assets__type-option:hover {
    border-color: #52525b;
    color: #d4d4d8;
  }

  .org-assets__type-option--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.4);
    color: #22d3ee;
  }

  .org-assets__type-option-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .org-assets__type-option-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .org-assets__type-option-badge {
    margin-left: auto;
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background-color: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
  }

  /* Image Preview */
  .org-assets__image-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .org-assets__image-container {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .org-assets__image-close {
    position: absolute;
    top: -40px;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__image-close:hover {
    color: white;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .org-assets__image-close-icon {
    width: 24px;
    height: 24px;
  }

  .org-assets__image-preview {
    max-width: 85vw;
    max-height: 80vh;
    object-fit: contain;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .org-assets__image-info {
    margin-top: 1rem;
    text-align: center;
  }

  .org-assets__image-name {
    font-weight: 500;
    color: white;
    margin: 0;
  }

  .org-assets__image-meta {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0.25rem 0 0;
  }

  /* Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
