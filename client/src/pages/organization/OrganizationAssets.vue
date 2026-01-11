<template>
  <PageLayout
    title="Organization Assets"
    description="Upload intros, outros, watermarks, and other assets for your team"
    :show-header="true"
    :icon="FolderOpen"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Assets' }]"
  >
    <template #actions>
      <button v-if="isAdmin" class="org-assets__action-btn" @click="openUploadDialog">
        <Upload class="org-assets__action-icon" />
        Upload Asset
      </button>
    </template>

    <div class="org-assets">
      <!-- Page Heading -->
      <div class="org-assets__heading">
        <h1 class="org-assets__title">Asset Library</h1>
        <p class="org-assets__subtitle">
          Manage intros, outros, watermarks, audio files, and images for your organization
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="assetsLoading" class="org-assets__loading">
        <div class="org-assets__loading-spinner"></div>
        <span>Loading assets...</span>
      </div>

      <!-- Assets Sections -->
      <template v-else-if="orgAssets.length > 0">
        <section v-for="group in groupedAssets" :key="group.type" class="org-assets__section">
          <div class="org-assets__section-header">
            <button @click="toggleAssetGroup(group.type)" class="org-assets__section-header-btn">
              <div class="org-assets__section-header-icon" :class="getAssetTypeIconClass(group.type)">
                <component :is="getAssetTypeIcon(group.type)" />
              </div>
              <div class="org-assets__section-header-text">
                <h2 class="org-assets__section-title">{{ getAssetTypeLabel(group.type) }}s</h2>
                <p class="org-assets__section-subtitle">{{ getAssetTypeDescription(group.type) }}</p>
              </div>
              <span class="org-assets__section-badge" :class="getAssetTypeBadgeClass(group.type)">
                {{ group.assets.length }}
              </span>
              <ChevronDown
                class="org-assets__section-chevron"
                :class="{ 'org-assets__section-chevron--collapsed': collapsedGroups.has(group.type) }"
              />
            </button>
          </div>

          <div v-if="!collapsedGroups.has(group.type)" class="org-assets__grid">
            <div
              v-for="asset in group.assets"
              :key="asset.id"
              class="org-assets__card"
              :class="{
                'org-assets__card--playing': isAudioPlaying(asset.id),
                [`org-assets__card--${asset.asset_type}`]: true,
              }"
            >
              <div class="org-assets__card-indicator" :class="`org-assets__card-indicator--${asset.asset_type}`"></div>

              <div class="org-assets__card-content">
                <div class="org-assets__card-row">
                  <!-- Thumbnail -->
                  <div
                    class="org-assets__thumbnail"
                    :class="{ 'org-assets__thumbnail--clickable': isPlayableAsset(asset) }"
                    @click="handleAssetClick(asset)"
                  >
                    <img
                      v-if="asset.asset_type === 'audio'"
                      :src="AUDIO_THUMBNAIL"
                      :alt="asset.name"
                      class="org-assets__thumbnail-img"
                    />
                    <img
                      v-else-if="
                        asset.thumbnail_url || (asset.url && ['image', 'watermark'].includes(asset.asset_type))
                      "
                      :src="asset.thumbnail_url || asset.url"
                      :alt="asset.name"
                      class="org-assets__thumbnail-img"
                    />
                    <div v-else class="org-assets__thumbnail-fallback">
                      <component :is="getAssetTypeIcon(asset.asset_type)" class="org-assets__thumbnail-icon" />
                    </div>

                    <div
                      v-if="isPlayableAsset(asset)"
                      class="org-assets__thumbnail-overlay"
                      :class="{ 'org-assets__thumbnail-overlay--visible': isAudioPlaying(asset.id) }"
                    >
                      <Pause
                        v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)"
                        class="org-assets__thumbnail-play"
                      />
                      <Play v-else class="org-assets__thumbnail-play" />
                    </div>
                  </div>

                  <!-- Info -->
                  <div class="org-assets__info">
                    <div class="org-assets__name" :title="asset.name">{{ asset.name }}</div>
                    <div class="org-assets__meta">
                      <span v-if="asset.duration" class="org-assets__meta-item">
                        <Clock class="org-assets__meta-icon" />
                        {{ formatDuration(asset.duration) }}
                      </span>
                      <span v-if="asset.width && asset.height" class="org-assets__meta-item">
                        <Maximize2 class="org-assets__meta-icon" />
                        {{ asset.width }}×{{ asset.height }}
                      </span>
                    </div>
                  </div>

                  <!-- Type Badge -->
                  <span class="org-assets__type-badge" :class="`org-assets__type-badge--${asset.asset_type}`">
                    <component :is="getAssetTypeIcon(asset.asset_type)" class="org-assets__type-badge-icon" />
                    {{ asset.asset_type }}
                  </span>

                  <!-- Actions Menu -->
                  <div class="org-assets__actions">
                    <button
                      v-if="isPlayableAsset(asset)"
                      @click="handleAssetClick(asset)"
                      class="org-assets__action-item"
                      :title="asset.asset_type === 'audio' ? (isAudioPlaying(asset.id) ? 'Pause' : 'Play') : 'Preview'"
                    >
                      <Pause
                        v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)"
                        class="org-assets__action-item-icon"
                      />
                      <Play v-else class="org-assets__action-item-icon" />
                    </button>
                    <button
                      v-if="isAdmin"
                      :ref="(el) => setAssetMenuButtonRef(el, asset.id)"
                      class="org-assets__menu-btn"
                      :class="{ 'org-assets__menu-btn--active': openAssetMenuId === asset.id }"
                      title="Asset actions"
                      @click.stop="toggleAssetMenu(asset.id)"
                    >
                      <MoreVertical class="org-assets__menu-icon" />
                    </button>

                    <Teleport to="body">
                      <div
                        v-if="openAssetMenuId === asset.id"
                        class="org-assets__dropdown"
                        :style="getAssetMenuPosition(asset.id)"
                        @click.stop
                      >
                        <button
                          v-if="isPlayableAsset(asset)"
                          class="org-assets__dropdown-item"
                          @click.stop="
                            handleAssetClick(asset);
                            closeAssetMenu();
                          "
                        >
                          <Play class="org-assets__dropdown-icon" />
                          <span>{{ asset.asset_type === 'audio' ? 'Play Audio' : 'Preview' }}</span>
                        </button>
                        <div v-if="isPlayableAsset(asset)" class="org-assets__dropdown-divider"></div>
                        <button
                          class="org-assets__dropdown-item org-assets__dropdown-item--danger"
                          @click.stop="
                            confirmDeleteAsset(asset);
                            closeAssetMenu();
                          "
                        >
                          <Trash2 class="org-assets__dropdown-icon" />
                          <span>Delete Asset</span>
                        </button>
                      </div>
                    </Teleport>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- Empty State -->
      <div v-else class="org-assets__empty">
        <div class="org-assets__empty-icon-wrapper">
          <Package class="org-assets__empty-icon" />
        </div>
        <h3 class="org-assets__empty-title">No assets uploaded yet</h3>
        <p class="org-assets__empty-text">
          Upload intros, outros, watermarks, or audio files to build your asset library.
        </p>
        <button v-if="isAdmin" @click="openUploadDialog" class="org-assets__empty-btn">
          <Upload class="org-assets__empty-btn-icon" />
          Upload First Asset
        </button>
      </div>
    </div>

    <!-- Upload Asset Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showUploadDialog" class="org-dialog__overlay" @click.self="closeUploadDialog">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--cyan">
              <div class="org-dialog__accent org-dialog__accent--cyan"></div>
              <div class="org-dialog__header">
                <button class="org-dialog__close" @click="closeUploadDialog" title="Close" :disabled="uploadingAsset">
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--cyan">
                  <Upload :size="24" />
                </div>
                <h2 class="org-dialog__title">Upload Asset</h2>
                <p class="org-dialog__subtitle">
                  {{ uploadDialogFile ? 'Configure your asset' : 'Select a file to upload' }}
                </p>
              </div>

              <div class="org-dialog__content">
                <!-- File Selection State -->
                <div v-if="!uploadDialogFile" class="org-dialog__dropzone-wrapper">
                  <button @click="selectFileForUpload" class="org-dialog__dropzone">
                    <div class="org-dialog__dropzone-inner">
                      <FolderOpen class="org-dialog__dropzone-icon" />
                      <p class="org-dialog__dropzone-title">Click to browse files</p>
                      <p class="org-dialog__dropzone-hint">Video, image, or audio files</p>
                    </div>
                  </button>
                </div>

                <!-- File Selected State -->
                <template v-else>
                  <div class="org-dialog__file-card">
                    <div class="org-dialog__file-icon" :class="getFileTypeIconBg(uploadDialogFileType)">
                      <component :is="getFileTypeIcon(uploadDialogFileType)" class="org-dialog__file-icon-svg" />
                    </div>
                    <div class="org-dialog__file-info">
                      <p class="org-dialog__file-name" :title="uploadDialogFile.name">
                        {{ uploadDialogFile.name }}
                      </p>
                      <p class="org-dialog__file-meta">
                        {{ formatFileSize(uploadDialogFile.size) }} • {{ uploadDialogFileType.toUpperCase() }}
                      </p>
                    </div>
                    <button @click="clearUploadFile" class="org-dialog__file-clear" title="Remove file">
                      <X class="org-dialog__file-clear-icon" />
                    </button>
                  </div>

                  <div class="org-dialog__field">
                    <label class="org-dialog__label">Asset Type</label>
                    <div class="org-dialog__type-grid">
                      <button
                        v-for="option in uploadDialogAssetOptions"
                        :key="option.value"
                        @click="uploadDialogSelectedType = option.value"
                        class="org-dialog__type-option"
                        :class="{ 'org-dialog__type-option--selected': uploadDialogSelectedType === option.value }"
                      >
                        <component :is="option.icon" class="org-dialog__type-option-icon" />
                        <span class="org-dialog__type-option-label">{{ option.label }}</span>
                        <span v-if="option.recommended" class="org-dialog__type-option-badge">likely</span>
                      </button>
                    </div>
                  </div>

                  <div class="org-dialog__field">
                    <label class="org-dialog__label">
                      Name
                      <span class="org-dialog__label-hint">(optional)</span>
                    </label>
                    <input
                      v-model="uploadDialogAssetName"
                      type="text"
                      :placeholder="uploadDialogFile.name"
                      class="org-dialog__input"
                    />
                  </div>
                </template>
              </div>

              <div class="org-dialog__footer">
                <button
                  class="org-dialog__btn org-dialog__btn--secondary"
                  @click="closeUploadDialog"
                  :disabled="uploadingAsset"
                >
                  Cancel
                </button>
                <button
                  v-if="uploadDialogFile"
                  class="org-dialog__btn org-dialog__btn--primary"
                  @click="executeAssetUpload"
                  :disabled="uploadingAsset || !uploadDialogSelectedType"
                >
                  <Loader2 v-if="uploadingAsset" class="org-dialog__btn-spinner" />
                  {{ uploadingAsset ? 'Uploading...' : 'Upload Asset' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Asset Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteDialog" class="org-dialog__overlay" @click.self="closeDeleteDialog">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--red">
              <div class="org-dialog__accent org-dialog__accent--red"></div>
              <div class="org-dialog__header">
                <button class="org-dialog__close" @click="closeDeleteDialog" title="Close" :disabled="deleteProcessing">
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--red">
                  <Trash2 :size="24" />
                </div>
                <h2 class="org-dialog__title">Delete Asset</h2>
                <p class="org-dialog__subtitle">This action cannot be undone</p>
              </div>

              <div class="org-dialog__content">
                <div class="org-dialog__asset-card">
                  <div class="org-dialog__asset-thumb">
                    <img
                      v-if="deleteDialogAsset?.asset_type === 'audio'"
                      :src="AUDIO_THUMBNAIL"
                      :alt="deleteDialogAsset?.name"
                      class="org-dialog__asset-thumb-img"
                    />
                    <img
                      v-else-if="
                        deleteDialogAsset?.thumbnail_url ||
                        (deleteDialogAsset?.url && ['image', 'watermark'].includes(deleteDialogAsset?.asset_type))
                      "
                      :src="deleteDialogAsset?.thumbnail_url || deleteDialogAsset?.url"
                      :alt="deleteDialogAsset?.name"
                      class="org-dialog__asset-thumb-img"
                    />
                    <component
                      v-else
                      :is="getAssetTypeIcon(deleteDialogAsset?.asset_type || '')"
                      class="org-dialog__asset-thumb-icon"
                    />
                  </div>
                  <div class="org-dialog__asset-info">
                    <div class="org-dialog__asset-name">{{ deleteDialogAsset?.name }}</div>
                    <div class="org-dialog__asset-type">{{ deleteDialogAsset?.asset_type }}</div>
                  </div>
                </div>

                <div class="org-dialog__warning">
                  <p class="org-dialog__warning-text">
                    Are you sure you want to delete
                    <strong>"{{ deleteDialogAsset?.name }}"</strong>
                    ? This will permanently remove the asset from your organization.
                  </p>
                </div>
              </div>

              <div class="org-dialog__footer">
                <button
                  class="org-dialog__btn org-dialog__btn--secondary"
                  @click="closeDeleteDialog"
                  :disabled="deleteProcessing"
                >
                  Cancel
                </button>
                <button
                  class="org-dialog__btn org-dialog__btn--danger"
                  @click="executeDeleteAsset"
                  :disabled="deleteProcessing"
                >
                  <Loader2 v-if="deleteProcessing" class="org-dialog__btn-spinner" />
                  {{ deleteProcessing ? 'Deleting...' : 'Delete Asset' }}
                </button>
              </div>
            </div>
          </Transition>
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
    MoreVertical,
    Clock,
    Maximize2,
  } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
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
  const showUploadDialog = ref(false);
  const uploadDialogFile = ref<{ name: string; size: number; path: string; blob: Blob } | null>(null);
  const uploadDialogFileType = ref('');
  const uploadDialogSelectedType = ref<'intro' | 'outro' | 'watermark' | 'audio' | 'image' | ''>('');
  const uploadDialogAssetName = ref('');
  const uploadDialogAssetOptions = ref<
    Array<{
      value: 'intro' | 'outro' | 'watermark' | 'audio' | 'image';
      label: string;
      icon: any;
      recommended?: boolean;
    }>
  >([]);
  const uploadingAsset = ref(false);

  // Delete dialog state
  const showDeleteDialog = ref(false);
  const deleteDialogAsset = ref<ServerOrganizationAsset | null>(null);
  const deleteProcessing = ref(false);

  // Asset menu state
  const openAssetMenuId = ref<number | null>(null);
  const assetMenuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

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

  function getAssetTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      intro: 'Video introductions for your content',
      outro: 'Video endings and outros',
      watermark: 'Brand watermarks and overlays',
      audio: 'Sound effects and music',
      image: 'Stickers and image assets',
    };
    return descriptions[type] || '';
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

  function getAssetTypeIconClass(type: string): string {
    switch (type) {
      case 'intro':
        return 'org-assets__section-header-icon--intro';
      case 'outro':
        return 'org-assets__section-header-icon--outro';
      case 'watermark':
        return 'org-assets__section-header-icon--watermark';
      case 'audio':
        return 'org-assets__section-header-icon--audio';
      case 'image':
        return 'org-assets__section-header-icon--image';
      default:
        return '';
    }
  }

  function getAssetTypeBadgeClass(type: string): string {
    switch (type) {
      case 'intro':
        return 'org-assets__section-badge--intro';
      case 'outro':
        return 'org-assets__section-badge--outro';
      case 'watermark':
        return 'org-assets__section-badge--watermark';
      case 'audio':
        return 'org-assets__section-badge--audio';
      case 'image':
        return 'org-assets__section-badge--image';
      default:
        return '';
    }
  }

  function isPlayableAsset(asset: ServerOrganizationAsset): boolean {
    return ['intro', 'outro', 'audio', 'image', 'watermark'].includes(asset.asset_type);
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // Asset menu functions
  function setAssetMenuButtonRef(el: any, assetId: number) {
    if (el) {
      assetMenuButtonRefs.value.set(assetId, el);
    } else {
      assetMenuButtonRefs.value.delete(assetId);
    }
  }

  function toggleAssetMenu(assetId: number) {
    openAssetMenuId.value = openAssetMenuId.value === assetId ? null : assetId;
  }

  function closeAssetMenu() {
    openAssetMenuId.value = null;
  }

  function getAssetMenuPosition(assetId: number): Record<string, string> {
    const button = assetMenuButtonRefs.value.get(assetId);
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 120;
    const padding = 8;

    let top = rect.bottom + padding;
    let left = rect.right - menuWidth;

    if (top + menuMaxHeight > window.innerHeight - padding) {
      top = rect.top - menuMaxHeight - padding;
    }
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    return { top: `${top}px`, left: `${left}px` };
  }

  function handleAssetMenuClickOutside(event: MouseEvent) {
    if (openAssetMenuId.value !== null) {
      const button = assetMenuButtonRefs.value.get(openAssetMenuId.value);
      if (button && button.contains(event.target as Node)) return;
      openAssetMenuId.value = null;
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

  type AssetTypeOption = {
    value: 'intro' | 'outro' | 'watermark' | 'audio' | 'image';
    label: string;
    icon: any;
    recommended?: boolean;
  };

  function getAssetOptionsForFileType(ext: string): AssetTypeOption[] {
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

    if (videoExtensions.includes(ext)) return 'org-dialog__file-icon--video';
    if (imageExtensions.includes(ext)) return 'org-dialog__file-icon--image';
    if (audioExtensions.includes(ext)) return 'org-dialog__file-icon--audio';
    return '';
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

  // Delete dialog functions
  function confirmDeleteAsset(asset: ServerOrganizationAsset) {
    deleteDialogAsset.value = asset;
    showDeleteDialog.value = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog.value = false;
    deleteDialogAsset.value = null;
    deleteProcessing.value = false;
  }

  async function executeDeleteAsset() {
    if (!organizationId.value || !isAdmin.value || !deleteDialogAsset.value) return;

    deleteProcessing.value = true;
    const asset = deleteDialogAsset.value;

    try {
      const response = await deleteOrganizationAsset(organizationId.value, asset.id);
      if (response.success) {
        orgAssets.value = orgAssets.value.filter((a) => a.id !== asset.id);
        showSuccess('Asset deleted', `"${asset.name}" has been deleted`);
        closeDeleteDialog();
      } else {
        showError('Delete failed', response.error || 'Failed to delete asset');
        deleteProcessing.value = false;
      }
    } catch (err: any) {
      showError('Delete failed', err.message || 'Failed to delete asset');
      deleteProcessing.value = false;
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
    document.addEventListener('click', handleAssetMenuClickOutside);
  });

  onUnmounted(() => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }
    document.removeEventListener('click', handleAssetMenuClickOutside);
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .org-assets {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ===== Action Button ===== */
  .org-assets__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-assets__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-assets__action-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Page Heading ===== */
  .org-assets__heading {
    margin-bottom: 0.5rem;
  }

  .org-assets__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .org-assets__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Loading State ===== */
  .org-assets__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .org-assets__loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--sidebar-border);
    border-top-color: var(--sidebar-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Section ===== */
  .org-assets__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-assets__section-header {
    display: flex;
  }

  .org-assets__section-header-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .org-assets__section-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .org-assets__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-assets__section-header-icon--intro {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .org-assets__section-header-icon--outro {
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
  }

  .org-assets__section-header-icon--watermark {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .org-assets__section-header-icon--audio {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-assets__section-header-icon--image {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .org-assets__section-header-text {
    flex: 1;
  }

  .org-assets__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-assets__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-assets__section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
  }

  .org-assets__section-badge--intro {
    color: #3b82f6;
    background-color: rgba(59, 130, 246, 0.15);
  }

  .org-assets__section-badge--outro {
    color: #a855f7;
    background-color: rgba(168, 85, 247, 0.15);
  }

  .org-assets__section-badge--watermark {
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.15);
  }

  .org-assets__section-badge--audio {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.15);
  }

  .org-assets__section-badge--image {
    color: #06b6d4;
    background-color: rgba(6, 182, 212, 0.15);
  }

  .org-assets__section-chevron {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
    transition: transform 200ms ease;
  }

  .org-assets__section-chevron--collapsed {
    transform: rotate(-90deg);
  }

  /* ===== Grid ===== */
  .org-assets__grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Asset Card ===== */
  .org-assets__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-assets__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .org-assets__card--playing {
    border-color: rgba(16, 185, 129, 0.3);
    background-color: rgba(16, 185, 129, 0.03);
  }

  .org-assets__card-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-assets__card-indicator--intro {
    background: linear-gradient(to bottom, #3b82f6 0%, #2563eb 100%);
  }

  .org-assets__card-indicator--outro {
    background: linear-gradient(to bottom, #a855f7 0%, #9333ea 100%);
  }

  .org-assets__card-indicator--watermark {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .org-assets__card-indicator--audio {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .org-assets__card-indicator--image {
    background: linear-gradient(to bottom, #06b6d4 0%, #0891b2 100%);
  }

  .org-assets__card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0.875rem 1rem;
  }

  .org-assets__card-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* ===== Thumbnail ===== */
  .org-assets__thumbnail {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    flex-shrink: 0;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 2px solid var(--sidebar-border);
    position: relative;
  }

  .org-assets__thumbnail--clickable {
    cursor: pointer;
  }

  .org-assets__thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-assets__thumbnail-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
  }

  .org-assets__thumbnail-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-assets__thumbnail-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .org-assets__thumbnail--clickable:hover .org-assets__thumbnail-overlay,
  .org-assets__thumbnail-overlay--visible {
    opacity: 1;
  }

  .org-assets__thumbnail-play {
    width: 18px;
    height: 18px;
    color: white;
  }

  /* ===== Info ===== */
  .org-assets__info {
    flex: 1;
    min-width: 0;
  }

  .org-assets__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .org-assets__meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .org-assets__meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-assets__meta-icon {
    width: 12px;
    height: 12px;
  }

  /* ===== Type Badge ===== */
  .org-assets__type-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.625rem;
    border-radius: 6px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-assets__type-badge-icon {
    width: 11px;
    height: 11px;
  }

  .org-assets__type-badge--intro {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .org-assets__type-badge--outro {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .org-assets__type-badge--watermark {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-assets__type-badge--audio {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .org-assets__type-badge--image {
    background-color: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
  }

  @media (max-width: 640px) {
    .org-assets__type-badge {
      display: none;
    }
  }

  /* ===== Actions ===== */
  .org-assets__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .org-assets__action-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__action-item:hover {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .org-assets__action-item-icon {
    width: 14px;
    height: 14px;
  }

  .org-assets__menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__menu-btn:hover,
  .org-assets__menu-btn--active {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .org-assets__menu-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Dropdown Menu ===== */
  .org-assets__dropdown {
    position: fixed;
    z-index: 9999;
    width: 180px;
    background-color: var(--sidebar-surface);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    padding: 0.5rem;
  }

  .org-assets__dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-assets__dropdown-item:hover {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .org-assets__dropdown-item--danger {
    color: #f87171;
  }

  .org-assets__dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .org-assets__dropdown-icon {
    width: 16px;
    height: 16px;
  }

  .org-assets__dropdown-divider {
    margin: 0.5rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Empty State ===== */
  .org-assets__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .org-assets__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
    border-radius: 20px;
    margin-bottom: 1.5rem;
  }

  .org-assets__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .org-assets__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-assets__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 320px;
  }

  .org-assets__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-assets__empty-btn:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .org-assets__empty-btn-icon {
    width: 18px;
    height: 18px;
  }

  /* ===== Dialog Overlay ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Dialog Accent Bar ===== */
  .org-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .org-dialog__accent--cyan {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .org-dialog__accent--red {
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  /* ===== Dialog Header ===== */
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
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .org-dialog__icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-dialog__icon--red {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Dialog Content ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
  }

  .org-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Dialog Footer ===== */
  .org-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  /* ===== Dialog Buttons ===== */
  .org-dialog__btn {
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

  .org-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .org-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .org-dialog__btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Dialog Dropzone ===== */
  .org-dialog__dropzone-wrapper {
    margin-bottom: 1rem;
  }

  .org-dialog__dropzone {
    width: 100%;
    padding: 2rem;
    border: 2px dashed var(--sidebar-border);
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__dropzone:hover {
    border-color: rgba(6, 182, 212, 0.5);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .org-dialog__dropzone-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .org-dialog__dropzone-icon {
    width: 28px;
    height: 28px;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__dropzone:hover .org-dialog__dropzone-icon {
    color: var(--sidebar-accent);
  }

  .org-dialog__dropzone-title {
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
  }

  .org-dialog__dropzone-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Dialog File Card ===== */
  .org-dialog__file-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 10px;
    border: 1px solid var(--sidebar-border);
    margin-bottom: 1rem;
  }

  .org-dialog__file-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background-color: var(--sidebar-surface);
  }

  .org-dialog__file-icon--video {
    background-color: rgba(59, 130, 246, 0.15);
  }

  .org-dialog__file-icon--image {
    background-color: rgba(245, 158, 11, 0.15);
  }

  .org-dialog__file-icon--audio {
    background-color: rgba(16, 185, 129, 0.15);
  }

  .org-dialog__file-icon-svg {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__file-icon--video .org-dialog__file-icon-svg {
    color: #60a5fa;
  }

  .org-dialog__file-icon--image .org-dialog__file-icon-svg {
    color: #fbbf24;
  }

  .org-dialog__file-icon--audio .org-dialog__file-icon-svg {
    color: #34d399;
  }

  .org-dialog__file-info {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__file-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .org-dialog__file-clear {
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

  .org-dialog__file-clear:hover {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
  }

  .org-dialog__file-clear-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Dialog Form Field ===== */
  .org-dialog__field {
    margin-bottom: 1rem;
  }

  .org-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.5rem;
  }

  .org-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .org-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  /* ===== Dialog Type Grid ===== */
  .org-dialog__type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .org-dialog__type-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-dialog__type-option:hover {
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--sidebar-text);
  }

  .org-dialog__type-option--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.4);
    color: var(--sidebar-accent);
  }

  .org-dialog__type-option-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .org-dialog__type-option-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .org-dialog__type-option-badge {
    margin-left: auto;
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  /* ===== Dialog Asset Card (Delete) ===== */
  .org-dialog__asset-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .org-dialog__asset-thumb {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background-color: var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .org-dialog__asset-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-dialog__asset-thumb-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__asset-info {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__asset-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__asset-type {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    text-transform: capitalize;
    margin-top: 0.125rem;
  }

  /* ===== Dialog Warning ===== */
  .org-dialog__warning {
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 8px;
  }

  .org-dialog__warning-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .org-dialog__warning-text strong {
    color: var(--sidebar-text);
  }

  /* ===== Image Preview ===== */
  .org-assets__image-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
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
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
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
</style>
