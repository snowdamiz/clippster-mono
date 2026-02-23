<template>
  <div class="assets">
    <PageLayout
      title="Assets"
      description="Manage your intros, outros, watermarks, and images"
      :show-header="true"
      :icon="Archive"
    >
      <template #actions>
        <div class="assets-actions">
          <!-- Refresh button for organization assets -->
          <button
            v-if="hasOrganizations"
            @click="triggerSync"
            :disabled="isSyncing"
            title="Refresh organization assets"
            class="assets-action-btn"
          >
            <Loader2 v-if="isSyncing" class="assets-action-btn__icon assets-action-btn__icon--spin" />
            <RefreshCw v-else class="assets-action-btn__icon" />
          </button>
          <button @click="openIntrosFolder" title="Open assets folder" class="assets-action-btn">
            <Folder class="assets-action-btn__icon" />
          </button>
          <button @click="handleUpload" :disabled="uploading" class="assets-upload-btn">
            <Upload class="assets-upload-btn__icon" />
            {{ uploading ? 'Uploading...' : 'Upload Asset' }}
          </button>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="assets__content">
        <!-- Skeleton Page Heading -->
        <div class="assets__heading">
          <div class="assets-skeleton__title"></div>
          <div class="assets-skeleton__subtitle"></div>
        </div>

        <!-- Skeleton Item Count -->
        <div class="assets-skeleton__item-count"></div>

        <!-- Skeleton Cards Grid -->
        <div class="assets__grid">
          <div v-for="i in 6" :key="`skeleton-${i}`" class="asset-card asset-card--skeleton">
            <div class="asset-card__skeleton-bg"></div>
            <div class="asset-card__bottom">
              <div class="assets-skeleton__card-title"></div>
              <div class="assets-skeleton__card-meta"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Content when not loading -->
      <div v-else class="assets__content" :class="{ 'assets__content--empty': allAssets.length === 0 && !uploading }">
        <!-- Page Heading -->
        <div v-if="allAssets.length > 0 || uploading" class="assets__heading">
          <h1 class="assets__title">Manage Your Assets</h1>
          <p class="assets__subtitle">Organize intros, outros, watermarks, audio, and images for your content</p>
        </div>

        <!-- Selection Controls Bar (visible when items selected) -->
        <div v-if="selectedAssets.size > 0" class="assets__selection-bar">
          <div class="assets__selection-info">
            <Check class="assets__selection-icon" />
            <span>{{ selectedAssets.size }} selected</span>
          </div>
          <div class="assets__selection-actions">
            <button @click="clearSelection" class="assets__selection-clear">Clear</button>
            <button @click="confirmBulkDelete" class="assets__selection-delete">
              <Trash2 class="assets__selection-delete-icon" />
              Delete Selected
            </button>
          </div>
        </div>

        <!-- Organization Assets Section -->
        <div v-if="orgAssetsForDisplay.length > 0" class="assets__section">
          <div class="assets__section-header">
            <div class="assets__section-title-wrapper">
              <Building2 class="assets__section-icon" />
              <h2 class="assets__section-title">Organization Assets</h2>
            </div>
            <div class="assets__item-count">
              {{ orgAssetsForDisplay.length }} {{ orgAssetsForDisplay.length === 1 ? 'item' : 'items' }}
            </div>
          </div>

          <TransitionGroup name="card-list" tag="div" class="assets__grid">
          <!-- Asset cards -->
          <div
            v-for="asset in orgAssetsForDisplay"
            :key="`asset-${asset.isOrgAsset ? 'org' : 'local'}-${asset.id}`"
            class="asset-card group"
            :class="{
              'asset-card--selected': isAssetSelected(String(asset.id)),
              'asset-card--watermark': asset.assetType === 'watermark',
              'asset-card--image': asset.assetType === 'image',
            }"
            @click="handleAssetClick(asset)"
          >
            <!-- Thumbnail background -->
            <div
              v-if="getThumbnailUrl(asset)"
              class="asset-card__thumbnail-bg"
              :style="{
                backgroundImage: `url(${getThumbnailUrl(asset)})`,
                backgroundSize: asset.assetType === 'watermark' || asset.assetType === 'image' ? 'contain' : 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }"
            ></div>

            <!-- Vignette overlay -->
            <div class="asset-card__vignette"></div>

            <!-- Selection checkbox -->
            <div
              v-if="!asset.isOrgAsset"
              class="asset-card__checkbox"
              :class="{ 'asset-card__checkbox--visible': isAssetSelected(String(asset.id)) }"
              @click.stop="toggleAssetSelection(String(asset.id))"
            >
              <div
                class="asset-card__checkbox-box"
                :class="{ 'asset-card__checkbox-box--checked': isAssetSelected(String(asset.id)) }"
              >
                <Check v-if="isAssetSelected(String(asset.id))" class="asset-card__checkbox-icon" />
              </div>
            </div>

            <!-- Badges -->
            <div class="asset-card__badges">
              <span
                class="asset-card__badge"
                :class="{
                  'asset-card__badge--intro': asset.assetType === 'intro',
                  'asset-card__badge--outro': asset.assetType === 'outro',
                  'asset-card__badge--watermark': asset.assetType === 'watermark',
                  'asset-card__badge--audio': asset.assetType === 'audio',
                  'asset-card__badge--image': asset.assetType === 'image',
                }"
              >
                <component
                  :is="
                    asset.assetType === 'watermark' || asset.assetType === 'image'
                      ? ImageIcon
                      : asset.assetType === 'audio'
                        ? Music
                        : Package
                  "
                  class="asset-card__badge-icon"
                />
                {{
                  asset.assetType === 'intro'
                    ? 'Intro'
                    : asset.assetType === 'outro'
                      ? 'Outro'
                      : asset.assetType === 'audio'
                        ? 'Audio'
                        : asset.assetType === 'image'
                          ? 'Image'
                          : 'Watermark'
                }}
              </span>
              <span
                v-if="asset.isOrgAsset || asset.organization_id"
                class="asset-card__badge asset-card__badge--org"
                :title="`From: ${asset.organization_name || 'Organization'}`"
              >
                <Building2 class="asset-card__badge-icon" />
                {{ asset.organization_name || 'Org' }}
              </span>
            </div>

            <!-- Downloading overlay -->
            <div v-if="isAssetDownloading(asset)" class="asset-card__downloading">
              <Loader2 class="asset-card__downloading-spinner" />
              <span class="asset-card__downloading-text">Downloading...</span>
            </div>

            <!-- Hover actions -->
            <div
              class="asset-card__actions"
              :class="{
                'asset-card__actions--visible':
                  asset.assetType === 'audio' && isAudioPlaying(asset.id, asset.isOrgAsset),
              }"
            >
              <button
                v-if="asset.assetType === 'intro' || asset.assetType === 'outro'"
                class="asset-card__action-btn"
                title="Play"
                @click.stop="playAsset(asset as any)"
              >
                <Play class="asset-card__action-icon" />
              </button>
              <button
                v-if="asset.assetType === 'audio'"
                class="asset-card__action-btn"
                :title="isAudioPlaying(asset.id, asset.isOrgAsset) ? 'Pause' : 'Play'"
                @click.stop="toggleAudioPlayback(asset as any)"
              >
                <Pause v-if="isAudioPlaying(asset.id, asset.isOrgAsset)" class="asset-card__action-icon" />
                <Play v-else class="asset-card__action-icon" />
              </button>
              <button
                v-if="asset.assetType === 'image' || asset.assetType === 'watermark'"
                class="asset-card__action-btn"
                title="View full size"
                @click.stop="openImagePreview(asset)"
              >
                <Maximize2 class="asset-card__action-icon" />
              </button>
              <button
                v-if="!asset.isOrgAsset"
                class="asset-card__action-btn asset-card__action-btn--danger"
                title="Delete"
                @click.stop="confirmDelete(asset)"
              >
                <Trash2 class="asset-card__action-icon" />
              </button>
            </div>

            <!-- Bottom Info Overlay -->
            <div class="asset-card__bottom">
              <h3 class="asset-card__name" :title="asset.name">{{ asset.name }}</h3>
              <div class="asset-card__meta">
                <span v-if="asset.assetType === 'watermark'">
                  {{
                    (asset as WatermarkImage).width && (asset as WatermarkImage).height
                      ? `${(asset as WatermarkImage).width}×${(asset as WatermarkImage).height}`
                      : 'Image'
                  }}
                </span>
                <span v-else-if="asset.assetType === 'image'">
                  {{
                    (asset as ImageAsset).width && (asset as ImageAsset).height
                      ? `${(asset as ImageAsset).width}×${(asset as ImageAsset).height}`
                      : 'Image'
                  }}
                </span>
                <span v-else-if="asset.assetType === 'audio'">
                  {{ formatDuration((asset as AudioAsset).duration || undefined) }}
                </span>
                <span v-else>{{ formatDuration((asset as IntroOutro).duration || undefined) }}</span>
                <span class="asset-card__meta-dot"></span>
                <span>
                  {{ formatRelativeTime(asset.isOrgAsset ? (asset as any).inserted_at : (asset as any).created_at) }}
                </span>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- User Assets Section -->
      <div v-if="personalAssets.length > 0 || showSkeletonCard" class="assets__section">
        <div class="assets__section-header">
          <div class="assets__section-title-wrapper">
            <Archive class="assets__section-icon" />
            <h2 class="assets__section-title">Your Assets</h2>
          </div>
          <div class="assets__item-count">
            {{ personalAssets.length }} {{ personalAssets.length === 1 ? 'item' : 'items' }}
          </div>
        </div>

        <TransitionGroup name="card-list" tag="div" class="assets__grid">
          <!-- Upload progress card -->
          <div v-if="showSkeletonCard" key="upload-skeleton" class="asset-card asset-card--uploading">
            <div class="asset-card__upload-overlay">
              <div class="asset-card__upload-icon">
                <Loader2 class="asset-card__upload-spinner" />
              </div>
              <span class="asset-card__upload-text">Uploading...</span>
              <span class="asset-card__upload-subtext">Processing asset</span>
            </div>
          </div>

          <!-- Asset cards -->
          <div
            v-for="asset in personalAssets"
            :key="`asset-${asset.isOrgAsset ? 'org' : 'local'}-${asset.id}`"
            class="asset-card group"
            :class="{
              'asset-card--selected': isAssetSelected(String(asset.id)),
              'asset-card--watermark': asset.assetType === 'watermark',
              'asset-card--image': asset.assetType === 'image',
            }"
            @click="handleAssetClick(asset)"
          >
            <!-- Thumbnail background -->
            <div
              v-if="getThumbnailUrl(asset)"
              class="asset-card__thumbnail-bg"
              :style="{
                backgroundImage: `url(${getThumbnailUrl(asset)})`,
                backgroundSize: asset.assetType === 'watermark' || asset.assetType === 'image' ? 'contain' : 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }"
            ></div>

            <!-- Vignette overlay -->
            <div class="asset-card__vignette"></div>

            <!-- Selection checkbox -->
            <div
              v-if="!asset.isOrgAsset"
              class="asset-card__checkbox"
              :class="{ 'asset-card__checkbox--visible': isAssetSelected(String(asset.id)) }"
              @click.stop="toggleAssetSelection(String(asset.id))"
            >
              <div
                class="asset-card__checkbox-box"
                :class="{ 'asset-card__checkbox-box--checked': isAssetSelected(String(asset.id)) }"
              >
                <Check v-if="isAssetSelected(String(asset.id))" class="asset-card__checkbox-icon" />
              </div>
            </div>

            <!-- Badges -->
            <div class="asset-card__badges">
              <span
                class="asset-card__badge"
                :class="{
                  'asset-card__badge--intro': asset.assetType === 'intro',
                  'asset-card__badge--outro': asset.assetType === 'outro',
                  'asset-card__badge--watermark': asset.assetType === 'watermark',
                  'asset-card__badge--audio': asset.assetType === 'audio',
                  'asset-card__badge--image': asset.assetType === 'image',
                }"
              >
                <component
                  :is="
                    asset.assetType === 'watermark' || asset.assetType === 'image'
                      ? ImageIcon
                      : asset.assetType === 'audio'
                        ? Music
                        : Package
                  "
                  class="asset-card__badge-icon"
                />
                {{
                  asset.assetType === 'intro'
                    ? 'Intro'
                    : asset.assetType === 'outro'
                      ? 'Outro'
                      : asset.assetType === 'audio'
                        ? 'Audio'
                        : asset.assetType === 'image'
                          ? 'Image'
                          : 'Watermark'
                }}
              </span>
              <span
                v-if="asset.isOrgAsset || asset.organization_id"
                class="asset-card__badge asset-card__badge--org"
                :title="`From: ${asset.organization_name || 'Organization'}`"
              >
                <Building2 class="asset-card__badge-icon" />
                {{ asset.organization_name || 'Org' }}
              </span>
            </div>

            <!-- Downloading overlay -->
            <div v-if="isAssetDownloading(asset)" class="asset-card__downloading">
              <Loader2 class="asset-card__downloading-spinner" />
              <span class="asset-card__downloading-text">Downloading...</span>
            </div>

            <!-- Hover actions -->
            <div
              class="asset-card__actions"
              :class="{
                'asset-card__actions--visible':
                  asset.assetType === 'audio' && isAudioPlaying(asset.id, asset.isOrgAsset),
              }"
            >
              <button
                v-if="asset.assetType === 'intro' || asset.assetType === 'outro'"
                class="asset-card__action-btn"
                title="Play"
                @click.stop="playAsset(asset as any)"
              >
                <Play class="asset-card__action-icon" />
              </button>
              <button
                v-if="asset.assetType === 'audio'"
                class="asset-card__action-btn"
                :title="isAudioPlaying(asset.id, asset.isOrgAsset) ? 'Pause' : 'Play'"
                @click.stop="toggleAudioPlayback(asset as any)"
              >
                <Pause v-if="isAudioPlaying(asset.id, asset.isOrgAsset)" class="asset-card__action-icon" />
                <Play v-else class="asset-card__action-icon" />
              </button>
              <button
                v-if="asset.assetType === 'image' || asset.assetType === 'watermark'"
                class="asset-card__action-btn"
                title="View full size"
                @click.stop="openImagePreview(asset)"
              >
                <Maximize2 class="asset-card__action-icon" />
              </button>
              <button
                v-if="!asset.isOrgAsset"
                class="asset-card__action-btn asset-card__action-btn--danger"
                title="Delete"
                @click.stop="confirmDelete(asset)"
              >
                <Trash2 class="asset-card__action-icon" />
              </button>
            </div>

            <!-- Bottom Info Overlay -->
            <div class="asset-card__bottom">
              <h3 class="asset-card__name" :title="asset.name">{{ asset.name }}</h3>
              <div class="asset-card__meta">
                <span v-if="asset.assetType === 'watermark'">
                  {{
                    (asset as WatermarkImage).width && (asset as WatermarkImage).height
                      ? `${(asset as WatermarkImage).width}×${(asset as WatermarkImage).height}`
                      : 'Image'
                  }}
                </span>
                <span v-else-if="asset.assetType === 'image'">
                  {{
                    (asset as ImageAsset).width && (asset as ImageAsset).height
                      ? `${(asset as ImageAsset).width}×${(asset as ImageAsset).height}`
                      : 'Image'
                  }}
                </span>
                <span v-else-if="asset.assetType === 'audio'">
                  {{ formatDuration((asset as AudioAsset).duration || undefined) }}
                </span>
                <span v-else>{{ formatDuration((asset as IntroOutro).duration || undefined) }}</span>
                <span class="asset-card__meta-dot"></span>
                <span>
                  {{ formatRelativeTime(asset.isOrgAsset ? (asset as any).inserted_at : (asset as any).created_at) }}
                </span>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Empty State -->
      <div v-if="allAssets.length === 0 && !uploading" class="assets__empty">
          <div class="assets__empty-icon-wrapper">
            <Package class="assets__empty-icon" />
          </div>
          <h3 class="assets__empty-title">No assets yet</h3>
          <p class="assets__empty-description">
            Upload your first intro, outro, watermark, audio, or image to get started
          </p>
        </div>
      </div>
      <!-- Close content when not loading -->
    </PageLayout>

    <!-- Asset Player Dialog -->
    <VideoPlayerDialog :video="assetToPlay" :show-video-player="showAssetPlayer" @close="handleAssetPlayerClose" />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Asset"
      message="Are you sure you want to delete"
      :item-name="assetToDelete?.name || (assetToDelete as any)?.file_path?.split(/[\\\\/]/).pop()"
      suffix="?"
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteDialogClose"
      @confirm="deleteAssetConfirmed"
    />

    <!-- Asset Upload Dialog -->
    <AssetUploadDialog :show="showUploadDialog" @close="showUploadDialog = false" @uploaded="handleUploadComplete" />

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />

    <!-- Image Preview Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showImagePreview && imageToPreview" class="assets-modal__overlay" @click.self="closeImagePreview">
          <Transition name="dialog" appear>
            <div class="assets-modal assets-modal--preview">
              <!-- Close Button -->
              <button @click="closeImagePreview" class="assets-modal__close">
                <X class="assets-modal__close-icon" />
              </button>

              <!-- Image Container -->
              <div class="assets-modal__image-container">
                <img :src="getImagePreviewUrl(imageToPreview)" :alt="imageToPreview.name" class="assets-modal__image" />
              </div>

              <!-- Image Info Footer -->
              <div class="assets-modal__image-footer">
                <div class="assets-modal__image-info">
                  <div
                    class="assets-modal__image-icon"
                    :class="
                      imageToPreview.assetType === 'watermark'
                        ? 'assets-modal__image-icon--watermark'
                        : 'assets-modal__image-icon--image'
                    "
                  >
                    <ImageIcon class="assets-modal__image-icon-svg" />
                  </div>
                  <div class="assets-modal__image-details">
                    <p class="assets-modal__image-name">{{ imageToPreview.name }}</p>
                    <div class="assets-modal__image-meta">
                      <span
                        class="assets-modal__image-type"
                        :class="
                          imageToPreview.assetType === 'watermark'
                            ? 'assets-modal__image-type--watermark'
                            : 'assets-modal__image-type--image'
                        "
                      >
                        {{ imageToPreview.assetType === 'watermark' ? 'Watermark' : 'Image' }}
                      </span>
                      <span v-if="getImageDimensions(imageToPreview)" class="assets-modal__image-dimensions">
                        {{ getImageDimensions(imageToPreview) }}
                      </span>
                      <span
                        v-if="imageToPreview.isOrgAsset || imageToPreview.organization_id"
                        class="assets-modal__image-org"
                      >
                        {{ (imageToPreview as any).organization_name || 'Organization' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Delete Button (only for personal assets) -->
                <button
                  v-if="!imageToPreview.isOrgAsset && !imageToPreview.organization_id"
                  @click="
                    confirmDelete(imageToPreview);
                    closeImagePreview();
                  "
                  class="assets-modal__image-delete"
                >
                  <Trash2 class="assets-modal__image-delete-icon" />
                  Delete
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Bulk Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showBulkDeleteDialog" class="assets-modal__overlay" @click.self="handleBulkDeleteDialogClose">
          <Transition name="dialog" appear>
            <div class="assets-modal">
              <div class="assets-modal__accent-bar assets-modal__accent-bar--danger"></div>
              <div class="assets-modal__content">
                <div class="assets-modal__header">
                  <div class="assets-modal__icon assets-modal__icon--danger">
                    <Trash2 />
                  </div>
                  <h2 class="assets-modal__title">Delete {{ selectedAssets.size }} Assets</h2>
                  <p class="assets-modal__subtitle">Are you sure you want to permanently delete these assets?</p>
                </div>

                <div class="assets-modal__body">
                  <div class="assets-modal__warning">
                    <p>
                      You are about to delete
                      <strong>{{ selectedAssets.size }} {{ selectedAssets.size === 1 ? 'asset' : 'assets' }}</strong>
                      . The files will be permanently removed from your computer.
                    </p>
                    <p class="assets-modal__warning-note">This action cannot be undone.</p>
                  </div>

                  <div class="assets-modal__actions">
                    <button @click="bulkDeleteConfirmed" class="assets-modal__btn assets-modal__btn--danger">
                      <Trash2 class="assets-modal__btn-icon" />
                      Delete {{ selectedAssets.size }} {{ selectedAssets.size === 1 ? 'Asset' : 'Assets' }}
                    </button>
                    <button @click="handleBulkDeleteDialogClose" class="assets-modal__btn assets-modal__btn--secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch, Teleport, Transition, TransitionGroup } from 'vue';
  import { formatDate } from '@/utils/dateTimeUtils';
  import {
    getAllIntroOutros,
    getAllAudioAssets,
    getAllImageAssets,
    type IntroOutro,
    type AudioAsset,
    type ImageAsset,
  } from '@/services/database';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import {
    Archive,
    Folder,
    Upload,
    Play,
    Trash2,
    Package,
    Image as ImageIcon,
    Check,
    Music,
    Pause,
    Building2,
    RefreshCw,
    Loader2,
    X,
    Maximize2,
  } from 'lucide-vue-next';
  import { useSyncProgress } from '@/services/orgAssetSync';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { useAudioAssetOperations } from '@/composables/useAudioAssetOperations';
  import { useImageAssetOperations } from '@/composables/useImageAssetOperations';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { getStoragePath } from '@/services/storage';
  import { invoke } from '@tauri-apps/api/core';
  import { Button } from '@/components/ui/button';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import AssetUploadDialog from '@/components/AssetUploadDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';

  // Combined asset type for display
  type DisplayAsset =
    | (IntroOutro & { assetType: 'intro' | 'outro'; isOrgAsset?: false })
    | (WatermarkImage & { assetType: 'watermark'; isOrgAsset?: false })
    | (AudioAsset & { assetType: 'audio'; isOrgAsset?: false })
    | (ImageAsset & { assetType: 'image'; isOrgAsset?: false })
    | (ServerOrganizationAsset & { assetType: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay'; isOrgAsset: true });

  const assets = ref<IntroOutro[]>([]);
  const watermarks = ref<WatermarkImage[]>([]);
  const audioAssets = ref<AudioAsset[]>([]);
  const imageAssets = ref<ImageAsset[]>([]);
  // Organization assets (from server - streamed, not synced locally)
  const serverOrgAssets = ref<ServerOrganizationAsset[]>([]);
  const loading = ref(true);
  const showDeleteDialog = ref(false);
  const assetToDelete = ref<DisplayAsset | null>(null);
  const showAssetPlayer = ref(false);
  const assetToPlay = ref<IntroOutro | null>(null);
  const showUploadDialog = ref(false);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const { error, success } = useToast();

  // Image preview state
  const showImagePreview = ref(false);
  const imageToPreview = ref<DisplayAsset | null>(null);

  // Sync state
  const { progress: syncProgress, isDownloading, downloadingAssetIds } = useSyncProgress();
  const authStore = useAuthStore();
  const isSyncing = ref(false);
  const showAuthModal = ref(false);

  // Audio player state
  const currentlyPlayingAudio = ref<string | null>(null);
  const audioElement = ref<HTMLAudioElement | null>(null);

  // Multi-select state
  const selectedAssets = ref<Set<string>>(new Set());
  const showBulkDeleteDialog = ref(false);

  let unregisterUploadCallback: (() => void) | null = null;
  let unregisterWatermarkCallback: (() => void) | null = null;
  let unregisterAudioCallback: (() => void) | null = null;
  let unregisterImageCallback: (() => void) | null = null;

  // Asset operations composable
  const { uploading, showSkeletonCard, deleteAsset, onUploadComplete } = useAssetOperations();
  const { deleteWatermark, onUploadComplete: onWatermarkUploadComplete } = useWatermarkOperations();
  const { deleteAudioAsset, onUploadComplete: onAudioUploadComplete } = useAudioAssetOperations();
  const { deleteImageAsset, onUploadComplete: onImageUploadComplete } = useImageAssetOperations();

  // Personal (local) assets
  const personalAssets = computed<DisplayAsset[]>(() => {
    const introOutros: DisplayAsset[] = assets.value
      .filter((a) => !a.organization_id)
      .map((a) => ({ ...a, assetType: a.type as 'intro' | 'outro', isOrgAsset: false as const }));
    const wms: DisplayAsset[] = watermarks.value
      .filter((w) => !w.organization_id)
      .map((w) => ({ ...w, assetType: 'watermark' as const, isOrgAsset: false as const }));
    const audios: DisplayAsset[] = audioAssets.value
      .filter((a) => !a.organization_id)
      .map((a) => ({ ...a, assetType: 'audio' as const, isOrgAsset: false as const }));
    const images: DisplayAsset[] = imageAssets.value
      .filter((i) => !i.organization_id)
      .map((i) => ({ ...i, assetType: 'image' as const, isOrgAsset: false as const }));
    return [...introOutros, ...wms, ...audios, ...images];
  });

  // Organization assets (from server, grouped by organization)
  const organizationAssets = computed(() => {
    // Group by organization
    const grouped = new Map<string, { name: string; assets: DisplayAsset[] }>();
    for (const asset of serverOrgAssets.value) {
      const orgId = String(asset.organization_id);
      const orgName = asset.organization_name || 'Organization';
      if (!grouped.has(orgId)) {
        grouped.set(orgId, { name: orgName, assets: [] });
      }
      grouped.get(orgId)!.assets.push({
        ...asset,
        assetType: asset.asset_type,
        isOrgAsset: true as const,
      });
    }
    return grouped;
  });

  // Organization assets for display (flat array)
  const orgAssetsForDisplay = computed<DisplayAsset[]>(() => {
    return serverOrgAssets.value.map((a) => ({
      ...a,
      assetType: a.asset_type,
      isOrgAsset: true as const,
    }));
  });

  // Combined assets for display (personal + org from server)
  const allAssets = computed<DisplayAsset[]>(() => {
    return [...personalAssets.value, ...orgAssetsForDisplay.value];
  });

  // Check if user has any organization memberships
  // User belongs to an organization if they own one or were created by one
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  // Pagination state
  const currentPage = ref(1);
  const assetsPerPage = 20;

  // Format relative time for asset dates
  function formatRelativeTime(timestamp?: string | Date | number): string {
    if (!timestamp) return 'Added recently';

    // Handle different timestamp formats
    let date: Date;

    try {
      if (typeof timestamp === 'string') {
        // Handle ISO format or other string formats
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Handle Unix timestamp (could be seconds or milliseconds)
        // If the number is very small, it's likely seconds, not milliseconds
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        return 'Added recently';
      }

      // Check if date is valid
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Added recently';
      }
    } catch (error) {
      return 'Added recently';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle negative differences (future dates)
    if (diffMs < 0) {
      return 'Added recently';
    }

    const secondsAgo = Math.floor(diffMs / 1000);
    const minutesAgo = Math.floor(secondsAgo / 60);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    if (secondsAgo < 60) return 'Added just now';
    if (minutesAgo < 60) return `Added ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
    if (hoursAgo < 24) return `Added ${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`;
    if (daysAgo < 7) return `Added ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;

    // For dates older than a week, show the actual date
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo < 4) {
      return `Added ${weeksAgo} week${weeksAgo !== 1 ? 's' : ''} ago`;
    }

    // For very old dates, show formatted date
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    };
    return `Added ${formatDate(date)}`;
  }

  // Format video duration
  function formatDuration(seconds?: number): string {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(allAssets.value.length / assetsPerPage));
  const paginatedAssets = computed(() => {
    const startIndex = (currentPage.value - 1) * assetsPerPage;
    const endIndex = startIndex + assetsPerPage;
    const paginated = allAssets.value.slice(startIndex, endIndex);
    return paginated;
  });

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function previousPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  // Reset to first page when assets change
  watch(allAssets, () => {
    currentPage.value = 1;
  });

  async function loadAssets() {
    loading.value = true;
    try {
      // Load personal intro/outros, watermarks, audio assets, and image assets from local database
      const [introOutros, wms, audios, imgs] = await Promise.all([
        getAllIntroOutros(),
        getAllWatermarkImages(),
        getAllAudioAssets(),
        getAllImageAssets(),
      ]);

      // Filter out organization assets from personal lists
      assets.value = introOutros.filter((a) => !a.organization_id);
      watermarks.value = wms.filter((w) => !w.organization_id);
      audioAssets.value = audios.filter((a) => !a.organization_id);
      imageAssets.value = imgs.filter((i) => !i.organization_id);

      // Load organization assets from server API (streaming, not downloaded)
      if (hasOrganizations.value) {
        await loadOrgAssetsFromServer();
      } else {
        serverOrgAssets.value = [];
      }

      // Reset pagination to first page when loading new assets
      currentPage.value = 1;

      // Load thumbnails for personal video assets
      for (const asset of assets.value) {
        await loadAssetThumbnail(asset);
      }

      // Load thumbnails for personal watermarks
      for (const wm of watermarks.value) {
        await loadWatermarkThumbnail(wm);
      }

      // Set default icon for personal audio assets
      for (const audio of audioAssets.value) {
        loadAudioThumbnail(audio);
      }

      // Load thumbnails for personal image assets
      for (const img of imageAssets.value) {
        await loadImageThumbnail(img);
      }

      // For org assets, set thumbnails from server URLs
      for (const orgAsset of serverOrgAssets.value) {
        loadOrgAssetThumbnail(orgAsset);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      loading.value = false;
    }
  }

  // Load organization assets from server API
  async function loadOrgAssetsFromServer() {
    try {
      const response = await getUserOrganizationAssets();
      if (response.success) {
        serverOrgAssets.value = response.assets;
      } else {
        console.error('Failed to load org assets:', response.error);
        serverOrgAssets.value = [];
      }
    } catch (err) {
      console.error('Failed to load org assets from server:', err);
      serverOrgAssets.value = [];
    }
  }

  // Load thumbnail for server org asset (use server URLs directly)
  function loadOrgAssetThumbnail(asset: ServerOrganizationAsset) {
    const cacheKey = `org_${asset.id}`;
    if (thumbnailCache.value.has(cacheKey)) return;

    // For video assets (intro/outro), use thumbnail_url or default
    if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
      if (asset.thumbnail_url) {
        thumbnailCache.value.set(cacheKey, asset.thumbnail_url);
      } else {
        // Use default icon
        const defaultIcon =
          asset.asset_type === 'intro'
            ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiMyMTI5Mzc2Ii8+CiAgPHBhdGggZD0iTTEwMCA0MEwxMjAgNDBMMTIwIDgwTDEwMCA4MEw4MCA4MEw4MCA0MEwxMDAgNDBaIiBmaWxsPSIjM0I4MkY2Ii8+CiAgPHRleHQgeD0iMTAwIiB5PSI5NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbnRybzwvdGV4dD4KPC9zdmc+'
            : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiM3MzE5RDYiLz4KICA8cGF0aCBkPSJNODAgNDBMMTIwIDQwTDEyMCA4MEw4MCA4MEw0MCA4MEw0MCA0MEw4MCA0MFoiIGZpbGw9IiM5MzMzRUEiLz4KICA8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk91dHJvPC90ZXh0Pgo8L3N2Zz4=';
        thumbnailCache.value.set(cacheKey, defaultIcon);
      }
    }
    // For watermarks and images, use the asset URL directly
    else if (asset.asset_type === 'watermark' || asset.asset_type === 'image') {
      thumbnailCache.value.set(cacheKey, asset.url);
    }
    // For audio, use default waveform icon
    else if (asset.asset_type === 'audio') {
      const defaultIcon =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMDY0RTNCIi8+CjxyZWN0IHg9IjMwIiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjQ1IiB5PSIzNSIgd2lkdGg9IjgiIGhlaWdodD0iNTAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjYwIiB5PSIyNSIgd2lkdGg9IjgiIGhlaWdodD0iNzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9Ijc1IiB5PSI0MCIgd2lkdGg9IjgiIGhlaWdodD0iNDAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjkwIiB5PSIzMCIgd2lkdGg9IjgiIGhlaWdodD0iNjAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjEwNSIgeT0iMjAiIHdpZHRoPSI4IiBoZWlnaHQ9IjgwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxMjAiIHk9IjM1IiB3aWR0aD0iOCIgaGVpZ2h0PSI1MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPHJlY3QgeD0iMTM1IiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjE1MCIgeT0iMzAiIHdpZHRoPSI4IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxNjUiIHk9IjQwIiB3aWR0aD0iOCIgaGVpZ2h0PSI0MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPC9zdmc+';
      thumbnailCache.value.set(cacheKey, defaultIcon);
    }
  }

  // Refresh organization assets from server
  async function triggerSync() {
    if (isSyncing.value) return;

    isSyncing.value = true;
    try {
      await loadOrgAssetsFromServer();
      // Update thumbnails for new org assets
      for (const orgAsset of serverOrgAssets.value) {
        loadOrgAssetThumbnail(orgAsset);
      }
      success('Refreshed', 'Organization assets updated');
    } catch (err) {
      console.error('Refresh failed:', err);
      error('Refresh failed', 'Failed to refresh organization assets');
    } finally {
      isSyncing.value = false;
    }
  }

  // Check if an asset is currently being downloaded (for org assets during on-demand download)
  function isAssetDownloading(asset: DisplayAsset): boolean {
    if (asset.isOrgAsset) {
      return downloadingAssetIds.value.has(asset.id as number);
    }
    // For local assets with server_id (previously synced)
    const localAsset = asset as IntroOutro | WatermarkImage | AudioAsset | ImageAsset;
    if (!localAsset.server_id) return false;
    return downloadingAssetIds.value.has(localAsset.server_id);
  }

  async function loadWatermarkThumbnail(watermark: WatermarkImage) {
    if (!thumbnailCache.value.has(watermark.id)) {
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: watermark.file_path,
        });
        thumbnailCache.value.set(watermark.id, dataUrl);
      } catch (err) {
        console.warn('Failed to load watermark thumbnail:', watermark.id, err);
        // Use a default watermark icon
        const defaultIcon =
          'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjNzg1MDAwIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjUwIiByPSIyMCIgZmlsbD0iI0Y1OUUwQiIvPgo8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldhdGVybWFyazwvdGV4dD4KPC9zdmc+';
        thumbnailCache.value.set(watermark.id, defaultIcon);
      }
    }
  }

  function loadAudioThumbnail(audio: AudioAsset) {
    if (!thumbnailCache.value.has(audio.id)) {
      // Audio assets use a default waveform-style icon
      const defaultIcon =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMDY0RTNCIi8+CjxyZWN0IHg9IjMwIiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjQ1IiB5PSIzNSIgd2lkdGg9IjgiIGhlaWdodD0iNTAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjYwIiB5PSIyNSIgd2lkdGg9IjgiIGhlaWdodD0iNzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9Ijc1IiB5PSI0MCIgd2lkdGg9IjgiIGhlaWdodD0iNDAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjkwIiB5PSIzMCIgd2lkdGg9IjgiIGhlaWdodD0iNjAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjEwNSIgeT0iMjAiIHdpZHRoPSI4IiBoZWlnaHQ9IjgwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxMjAiIHk9IjM1IiB3aWR0aD0iOCIgaGVpZ2h0PSI1MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPHJlY3QgeD0iMTM1IiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjE1MCIgeT0iMzAiIHdpZHRoPSI4IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxNjUiIHk9IjQwIiB3aWR0aD0iOCIgaGVpZ2h0PSI0MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPC9zdmc+';
      thumbnailCache.value.set(audio.id, defaultIcon);
    }
  }

  async function loadImageThumbnail(image: ImageAsset) {
    if (!thumbnailCache.value.has(image.id)) {
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: image.file_path,
        });
        thumbnailCache.value.set(image.id, dataUrl);
      } catch (err) {
        console.warn('Failed to load image thumbnail:', image.id, err);
        // Use a default image icon
        const defaultIcon =
          'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMzc0MTUxIi8+CjxyZWN0IHg9IjYwIiB5PSIzMCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjYwIiByeD0iNCIgZmlsbD0iIzRCNTU2MyIvPgo8Y2lyY2xlIGN4PSI3NSIgY3k9IjQ1IiByPSI4IiBmaWxsPSIjRkJCRjI0Ii8+Cjxwb2x5Z29uIHBvaW50cz0iNjAsOTAgOTAsNjAgMTIwLDkwIiBmaWxsPSIjMTBCOTgxIi8+Cjxwb2x5Z29uIHBvaW50cz0iMTAwLDkwIDEyMCw3MCAxNDAsOTAiIGZpbGw9IiMwNTk2NjkiLz4KPC9zdmc+';
        thumbnailCache.value.set(image.id, defaultIcon);
      }
    }
  }

  async function loadAssetThumbnail(asset: IntroOutro) {
    // Don't cache if status is processing or failed - these are dynamic states
    if (asset.thumbnail_generation_status === 'processing' || asset.thumbnail_generation_status === 'failed') {
      return;
    }

    if (!thumbnailCache.value.has(asset.id)) {
      // Check if asset has a completed thumbnail path and if the file exists
      if (asset.thumbnail_generation_status === 'completed' && asset.thumbnail_path) {
        try {
          const fileExists = await invoke<boolean>('check_file_exists', {
            path: asset.thumbnail_path,
          });

          if (fileExists) {
            try {
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: asset.thumbnail_path,
              });
              thumbnailCache.value.set(asset.id, dataUrl);
              return dataUrl;
            } catch (error) {
              console.warn('Failed to load thumbnail for asset:', asset.id, error);
            }
          } else {
            console.warn('Thumbnail file does not exist:', asset.thumbnail_path);
          }
        } catch (error) {
          console.warn('Failed to check thumbnail existence for asset:', asset.id, error);
        }
      }

      // If we get here, either no completed thumbnail, file doesn't exist, or failed to load
      // Use a default icon or pattern based on asset type
      const defaultIcon =
        asset.type === 'intro'
          ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiMyMTI5Mzc2Ii8+CiAgPHBhdGggZD0iTTEwMCA0MEwxMjAgNDBMMTIwIDgwTDEwMCA4MEw4MCA4MEw4MCA0MEwxMDAgNDBaIiBmaWxsPSIjM0I4MkY2Ii8+CiAgPHRleHQgeD0iMTAwIiB5PSI5NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbnRybzwvdGV4dD4KPC9zdmc+'
          : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiM3MzE5RDYiLz4KICA8cGF0aCBkPSJNODAgNDBMMTIwIDQwTDEyMCA4MEw4MCA4MEw0MCA4MEw0MCA0MEw4MCA0MFoiIGZpbGw9IiM5MzMzRUEiLz4KICA8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk91dHJvPC90ZXh0Pgo8L3N2Zz4=';

      thumbnailCache.value.set(asset.id, defaultIcon);
      return defaultIcon;
    }

    return thumbnailCache.value.get(asset.id);
  }

  function getAssetThumbnailUrl(asset: IntroOutro): string | null {
    const cached = thumbnailCache.value.get(asset.id);
    if (cached) return cached;

    // No more processing states - assets appear only when complete

    // Return default icon based on asset type
    const defaultIcon =
      asset.type === 'intro'
        ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiMyMTI5Mzc2Ii8+CiAgPHBhdGggZD0iTTEwMCA0MEwxMjAgNDBMMTIwIDgwTDEwMCA4MEw4MCA4MEw4MCA4MEw4MCA4MEw4IDBCWiIgZmlsbD0iIzNCODJGNiIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iOTUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0ZGRkZkZIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5JbnRybzwvdGV4dD4KPC9zdmc+'
        : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiM3MzE5RDYiLz4KICA8cGF0aCBkPSJONCA0MEwxMjAgNDBMMTIwIDgwTDgwIDgwTDgwIDgwTDgwTDgwTDgwTDgwTDgwTDQwIDgwTDQwTDcwTDcwIEw4MCA4MEw0MCA4MFoiIGZpbGw9IiM5MzMzRUEiLz4KICA8dGV4dCB4PSIxMDAiIHk9Ijk1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGxlIj5PdXRybzwvdGV4dD4KPC9zdmc+';

    thumbnailCache.value.set(asset.id, defaultIcon);
    return defaultIcon;
  }

  // Get thumbnail URL for any asset type (DisplayAsset)
  function getThumbnailUrl(asset: DisplayAsset): string | null {
    // For org assets, use org_ prefix for cache key
    const cacheKey = asset.isOrgAsset ? `org_${asset.id}` : String(asset.id);
    const cached = thumbnailCache.value.get(cacheKey);
    if (cached) return cached;

    // For org assets, try to load from server URL
    if (asset.isOrgAsset) {
      loadOrgAssetThumbnail(asset as ServerOrganizationAsset);
      return thumbnailCache.value.get(cacheKey) || null;
    }

    if (asset.assetType === 'watermark') {
      // Watermarks should have been loaded in loadWatermarkThumbnail
      return null;
    }

    if (asset.assetType === 'audio') {
      // Audio assets should have been loaded in loadAudioThumbnail
      loadAudioThumbnail(asset as AudioAsset);
      return thumbnailCache.value.get(cacheKey) || null;
    }

    if (asset.assetType === 'image') {
      // Image assets should have been loaded in loadImageThumbnail
      return thumbnailCache.value.get(cacheKey) || null;
    }

    return getAssetThumbnailUrl(asset as IntroOutro);
  }

  function handleUpload() {
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }
    showUploadDialog.value = true;
  }

  function handleUploadComplete() {
    // Reload assets list when upload completes
    loadAssets();
  }

  // Handle click on any asset type
  function handleAssetClick(asset: DisplayAsset) {
    if (asset.assetType === 'intro' || asset.assetType === 'outro') {
      playAsset(asset as any);
    } else if (asset.assetType === 'audio') {
      toggleAudioPlayback(asset as any);
    } else if (asset.assetType === 'image' || asset.assetType === 'watermark') {
      openImagePreview(asset);
    }
  }

  // Image preview functions
  function openImagePreview(asset: DisplayAsset) {
    imageToPreview.value = asset;
    showImagePreview.value = true;
  }

  function closeImagePreview() {
    showImagePreview.value = false;
    imageToPreview.value = null;
  }

  // Get URL for image preview (handles both org and local assets)
  function getImagePreviewUrl(asset: DisplayAsset): string {
    if (asset.isOrgAsset) {
      // Organization asset - use server URL directly
      return (asset as ServerOrganizationAsset).url;
    }
    // Local asset - use cached thumbnail (which is already a data URL)
    const cacheKey = String(asset.id);
    return thumbnailCache.value.get(cacheKey) || '';
  }

  // Get dimensions string for image preview
  function getImageDimensions(asset: DisplayAsset): string | null {
    if (asset.assetType === 'watermark') {
      const wm = asset as WatermarkImage;
      if (wm.width && wm.height) {
        return `${wm.width}×${wm.height}`;
      }
    } else if (asset.assetType === 'image') {
      const img = asset as ImageAsset;
      if (img.width && img.height) {
        return `${img.width}×${img.height}`;
      }
    }
    // For org assets
    if (asset.isOrgAsset) {
      const orgAsset = asset as ServerOrganizationAsset;
      if (orgAsset.width && orgAsset.height) {
        return `${orgAsset.width}×${orgAsset.height}`;
      }
    }
    return null;
  }

  async function playAsset(asset: IntroOutro | (ServerOrganizationAsset & { isOrgAsset: true })) {
    try {
      // For org assets, create a pseudo IntroOutro with the server URL as file_path
      if ('isOrgAsset' in asset && asset.isOrgAsset) {
        const orgAsset = asset as ServerOrganizationAsset;
        // VideoPlayerDialog can take a video-url prop, so we'll set up a compatible object
        assetToPlay.value = {
          id: String(orgAsset.id),
          name: orgAsset.name,
          file_path: orgAsset.url, // Server URL for streaming
          type: orgAsset.asset_type as 'intro' | 'outro',
          duration: orgAsset.duration || null,
          thumbnail_path: orgAsset.thumbnail_url || null,
          thumbnail_generation_status: 'completed',
          created_at: new Date(orgAsset.inserted_at).getTime(),
          updated_at: new Date(orgAsset.updated_at).getTime(),
        } as IntroOutro;
      } else {
        // Local asset - create a fresh copy
        assetToPlay.value = { ...asset } as any;
      }
      showAssetPlayer.value = true;
    } catch (err) {
      console.error('Failed to prepare asset:', err);
    }
  }

  function handleAssetPlayerClose() {
    showAssetPlayer.value = false;
    // Clear the asset reference to ensure proper reload when reopening
    setTimeout(() => {
      assetToPlay.value = null;
    }, 100);
  }

  function confirmDelete(asset: DisplayAsset) {
    // Don't allow deleting org assets (they're managed at org level)
    if (asset.isOrgAsset) {
      error('Cannot Delete', 'Organization assets can only be deleted from the Organization Dashboard.');
      return;
    }
    assetToDelete.value = asset;
    showDeleteDialog.value = true;
  }

  function handleDeleteDialogClose() {
    showDeleteDialog.value = false;
    assetToDelete.value = null;
  }

  async function deleteAssetConfirmed() {
    if (!assetToDelete.value) return;

    let result;
    if (assetToDelete.value.assetType === 'watermark') {
      result = await deleteWatermark(assetToDelete.value as WatermarkImage);
    } else if (assetToDelete.value.assetType === 'audio') {
      result = await deleteAudioAsset(assetToDelete.value as AudioAsset);
    } else if (assetToDelete.value.assetType === 'image') {
      result = await deleteImageAsset(assetToDelete.value as ImageAsset);
    } else {
      result = await deleteAsset(assetToDelete.value as IntroOutro);
    }

    if (result.success) {
      await loadAssets();
    }

    showDeleteDialog.value = false;
    assetToDelete.value = null;
  }

  // Audio playback functions
  async function toggleAudioPlayback(audio: AudioAsset | (ServerOrganizationAsset & { isOrgAsset: true })) {
    try {
      const audioId = 'isOrgAsset' in audio && audio.isOrgAsset ? `org_${audio.id}` : audio.id;

      if (currentlyPlayingAudio.value === audioId) {
        // Stop playing
        if (audioElement.value) {
          audioElement.value.pause();
          audioElement.value.currentTime = 0;
        }
        currentlyPlayingAudio.value = null;
      } else {
        // Stop any currently playing audio
        if (audioElement.value) {
          audioElement.value.pause();
        }

        let audioUrl: string;

        // For org assets, use server URL directly
        if ('isOrgAsset' in audio && audio.isOrgAsset) {
          audioUrl = (audio as ServerOrganizationAsset).url;
        } else {
          // For local assets, use local video server
          const port = await invoke<number>('get_video_server_port');
          const encodedPath = btoa(unescape(encodeURIComponent((audio as AudioAsset).file_path)));
          audioUrl = `http://localhost:${port}/video/${encodedPath}`;
        }

        // Create and play new audio
        audioElement.value = new Audio(audioUrl);
        audioElement.value.onended = () => {
          currentlyPlayingAudio.value = null;
        };
        audioElement.value.onerror = () => {
          error('Playback Error', 'Failed to play audio file');
          currentlyPlayingAudio.value = null;
        };
        await audioElement.value.play();
        currentlyPlayingAudio.value = String(audioId);
      }
    } catch (err) {
      console.error('Failed to play audio:', err);
      error('Playback Error', 'Failed to play audio file');
      currentlyPlayingAudio.value = null;
    }
  }

  function isAudioPlaying(audioId: string | number, isOrgAsset?: boolean): boolean {
    const checkId = isOrgAsset ? `org_${audioId}` : String(audioId);
    return currentlyPlayingAudio.value === checkId;
  }

  async function openIntrosFolder() {
    try {
      // Get the base storage directory and construct assets path
      const basePath = await getStoragePath('base');
      const assetsPath = basePath + '\\assets';

      // Use the first asset file if available, otherwise use a dummy path
      if (allAssets.value.length > 0) {
        // Reveal the first asset file, which will open the assets folder
        const firstAsset = allAssets.value[0];
        const filePath = firstAsset.isOrgAsset ? null : (firstAsset as any).file_path;
        if (filePath) {
          await revealItemInDir(filePath);
        } else {
          await revealItemInDir(assetsPath + '\\dummy.mp4');
        }
      } else {
        // If no assets, append a dummy filename to open the assets folder
        // The file doesn't need to exist, revealItemInDir will still open the parent folder
        await revealItemInDir(assetsPath + '\\dummy.mp4');
      }
    } catch (err) {
      error('Failed to open folder', 'Unable to open the assets folder');
    }
  }

  // Multi-select functions
  function toggleAssetSelection(assetId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    // Don't allow selecting org assets (they're managed at org level)
    const asset = allAssets.value.find((a) => String(a.id) === String(assetId));
    if (asset?.isOrgAsset) {
      return;
    }
    if (selectedAssets.value.has(assetId)) {
      selectedAssets.value.delete(assetId);
    } else {
      selectedAssets.value.add(assetId);
    }
    // Trigger reactivity
    selectedAssets.value = new Set(selectedAssets.value);
  }

  function isAssetSelected(assetId: string): boolean {
    return selectedAssets.value.has(assetId);
  }

  function clearSelection() {
    selectedAssets.value.clear();
    selectedAssets.value = new Set(selectedAssets.value);
  }

  function confirmBulkDelete() {
    if (selectedAssets.value.size > 0) {
      showBulkDeleteDialog.value = true;
    }
  }

  function handleBulkDeleteDialogClose() {
    showBulkDeleteDialog.value = false;
  }

  async function bulkDeleteConfirmed() {
    const assetIds = Array.from(selectedAssets.value);
    let deletedCount = 0;

    try {
      for (const assetId of assetIds) {
        // Find the asset
        const asset = allAssets.value.find((a) => String(a.id) === String(assetId));
        if (!asset) continue;

        // Skip org assets (they're managed at org level)
        if (asset.isOrgAsset) continue;

        let result;
        if (asset.assetType === 'watermark') {
          result = await deleteWatermark(asset as WatermarkImage);
        } else if (asset.assetType === 'audio') {
          result = await deleteAudioAsset(asset as AudioAsset);
        } else if (asset.assetType === 'image') {
          result = await deleteImageAsset(asset as ImageAsset);
        } else {
          result = await deleteAsset(asset as IntroOutro);
        }

        if (result.success) {
          deletedCount++;
        }
      }

      await loadAssets();
      success('Assets Deleted', `${deletedCount} asset${deletedCount !== 1 ? 's' : ''} deleted successfully.`);
      selectedAssets.value.clear();
    } catch (err) {
      console.error('Failed to delete assets:', err);
      error('Delete Failed', 'Failed to delete some assets.');
    }

    showBulkDeleteDialog.value = false;
  }

  onMounted(async () => {
    // Load assets
    await loadAssets();

    // Register for upload completion events for immediate UI updates
    unregisterUploadCallback = onUploadComplete(() => {
      // Reload assets list when upload completes
      loadAssets();
    });

    // Register for watermark upload completion events
    unregisterWatermarkCallback = onWatermarkUploadComplete(() => {
      // Reload assets list when watermark upload completes
      loadAssets();
    });

    // Register for audio upload completion events
    unregisterAudioCallback = onAudioUploadComplete(() => {
      // Reload assets list when audio upload completes
      loadAssets();
    });

    // Register for image upload completion events
    unregisterImageCallback = onImageUploadComplete(() => {
      // Reload assets list when image upload completes
      loadAssets();
    });

    // Assets will appear automatically when upload completes
  });

  onUnmounted(() => {
    // Cleanup upload callbacks
    if (unregisterUploadCallback) {
      unregisterUploadCallback();
    }
    if (unregisterWatermarkCallback) {
      unregisterWatermarkCallback();
    }
    if (unregisterAudioCallback) {
      unregisterAudioCallback();
    }
    if (unregisterImageCallback) {
      unregisterImageCallback();
    }
    // Stop any playing audio
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .assets {
    width: 100%;
    min-height: 100%;
  }

  .assets__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
  }

  .assets__content--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Page Heading ===== */
  .assets__heading {
    flex-shrink: 0;
    margin-bottom: 1rem;
  }

  .assets__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .assets__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Section Headers ===== */
  .assets__section {
    margin-bottom: 1rem;
  }

  .assets__section:first-child {
    margin-top: 1rem;
  }

  .assets__section:last-child {
    margin-bottom: 0;
  }

  .assets__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .assets__section-title-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .assets__section-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .assets__section-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  /* ===== Item Count ===== */
  .assets__item-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  /* ===== Actions Bar ===== */
  .assets-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .assets-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .assets-action-btn:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .assets-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .assets-action-btn__icon {
    width: 16px;
    height: 16px;
  }

  .assets-action-btn__icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .assets-upload-btn {
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

  .assets-upload-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .assets-upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .assets-upload-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Skeleton Loading States ===== */
  .asset-card--skeleton {
    pointer-events: none;
  }

  .assets-skeleton__title {
    height: 28px;
    width: 200px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 6px;
  }

  .assets-skeleton__subtitle {
    height: 16px;
    width: 380px;
    max-width: 100%;
    margin-top: 0.5rem;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.1s;
    border-radius: 4px;
  }

  .assets-skeleton__item-count {
    height: 16px;
    width: 80px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .assets-skeleton__card-title {
    height: 16px;
    width: 65%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 25%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .assets-skeleton__card-meta {
    height: 12px;
    width: 40%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.03) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 3px;
  }

  /* Stagger animation delays for skeleton cards */
  .asset-card--skeleton:nth-child(1) .asset-card__skeleton-bg {
    animation-delay: 0s;
  }
  .asset-card--skeleton:nth-child(2) .asset-card__skeleton-bg {
    animation-delay: 0.1s;
  }
  .asset-card--skeleton:nth-child(3) .asset-card__skeleton-bg {
    animation-delay: 0.2s;
  }
  .asset-card--skeleton:nth-child(4) .asset-card__skeleton-bg {
    animation-delay: 0.3s;
  }
  .asset-card--skeleton:nth-child(5) .asset-card__skeleton-bg {
    animation-delay: 0.4s;
  }
  .asset-card--skeleton:nth-child(6) .asset-card__skeleton-bg {
    animation-delay: 0.5s;
  }

  /* ===== Selection Bar ===== */
  .assets__selection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .assets__selection-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .assets__selection-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-accent);
  }

  .assets__selection-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .assets__selection-clear {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .assets__selection-clear:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .assets__selection-delete {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    background-color: #ef4444;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .assets__selection-delete:hover {
    background-color: #dc2626;
  }

  .assets__selection-delete-icon {
    width: 13px;
    height: 13px;
  }

  /* ===== Assets Grid ===== */
  .assets__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .assets__grid {
      grid-template-columns: repeat(1, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .assets__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .assets__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .assets__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .assets__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Asset Card ===== */
  .asset-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .asset-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .asset-card--selected {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .asset-card--selected:hover {
    border-color: var(--sidebar-accent);
  }

  /* Watermark/Image cards need contained background */
  .asset-card--watermark,
  .asset-card--image {
    background-color: #1a1a1a;
  }

  /* Card Thumbnail Background */
  .asset-card__thumbnail-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  /* Vignette Overlay */
  .asset-card__vignette {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.3) 40%, rgba(0, 0, 0, 0.1) 100%);
    pointer-events: none;
  }

  /* Upload overlay */
  .asset-card--uploading {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
  }

  .asset-card__upload-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    text-align: center;
    z-index: 10;
  }

  .asset-card__upload-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 12px;
    color: var(--sidebar-accent);
  }

  .asset-card__upload-spinner {
    width: 22px;
    height: 22px;
    animation: spin 0.8s linear infinite;
  }

  .asset-card__upload-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .asset-card__upload-subtext {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* Skeleton card background */
  .asset-card__skeleton-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Selection Checkbox */
  .asset-card__checkbox {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 20;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .asset-card:hover .asset-card__checkbox,
  .asset-card__checkbox--visible {
    opacity: 1;
  }

  .asset-card__checkbox-box {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1.5px solid rgba(255, 255, 255, 0.45);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .asset-card__checkbox-box:hover {
    background-color: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.6);
  }

  .asset-card__checkbox-box--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .asset-card__checkbox-box--checked:hover {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .asset-card__checkbox-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-bg);
  }

  /* Badges */
  .asset-card__badges {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    z-index: 5;
  }

  .asset-card__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3125rem 0.5rem;
    background-color: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.75);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .asset-card__badge--intro {
    background-color: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .asset-card__badge--outro {
    background-color: rgba(139, 92, 246, 0.2);
    color: #c4b5fd;
  }

  .asset-card__badge--watermark {
    background-color: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .asset-card__badge--audio {
    background-color: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }

  .asset-card__badge--image {
    background-color: rgba(6, 182, 212, 0.2);
    color: #67e8f9;
  }

  .asset-card__badge--org {
    background-color: rgba(99, 102, 241, 0.3);
    color: #c4b5fd;
  }

  .asset-card__badge-icon {
    width: 10px;
    height: 10px;
  }

  /* Downloading overlay */
  .asset-card__downloading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 25;
  }

  .asset-card__downloading-spinner {
    width: 32px;
    height: 32px;
    color: white;
    animation: spin 0.8s linear infinite;
  }

  .asset-card__downloading-text {
    font-size: 0.8125rem;
    color: white;
    font-weight: 500;
  }

  /* Hover Actions */
  .asset-card__actions {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 200ms ease;
    z-index: 10;
  }

  .asset-card:hover .asset-card__actions,
  .asset-card__actions--visible {
    opacity: 1;
  }

  .asset-card__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }

  .asset-card__action-btn:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .asset-card__action-btn--danger:hover {
    background-color: #fef2f2;
    color: #ef4444;
  }

  .asset-card__action-icon {
    width: 18px;
    height: 18px;
  }

  /* Bottom Info Overlay */
  .asset-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .asset-card__name {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    line-height: 1.3;
  }

  .asset-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
  }

  .asset-card__meta-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
  }

  /* ===== Empty State ===== */
  .assets__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .assets__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .assets__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .assets__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .assets__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Modal ===== */
  .assets-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .assets-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .assets-modal--preview {
    width: fit-content;
    max-width: 90vw;
    max-height: 90vh;
    background-color: transparent;
    border: none;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    position: relative;
    margin: 0;
  }

  .assets-modal__accent-bar {
    height: 3px;
    background-color: var(--sidebar-accent);
  }

  .assets-modal__accent-bar--danger {
    background-color: #ef4444;
  }

  .assets-modal__close {
    position: absolute;
    top: -48px;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .assets-modal__close:hover {
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
  }

  .assets-modal__close-icon {
    width: 20px;
    height: 20px;
  }

  .assets-modal__content {
    padding: 1.75rem;
  }

  .assets-modal__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .assets-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.5rem;
  }

  .assets-modal__icon svg {
    width: 26px;
    height: 26px;
  }

  .assets-modal__icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .assets-modal__title {
    font-size: 1.1875rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .assets-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .assets-modal__body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .assets-modal__warning {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
  }

  .assets-modal__warning p {
    margin: 0;
  }

  .assets-modal__warning strong {
    color: var(--sidebar-text);
  }

  .assets-modal__warning-note {
    margin-top: 0.5rem !important;
    color: #f87171;
    font-weight: 500;
  }

  .assets-modal__actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .assets-modal__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .assets-modal__btn svg {
    width: 16px;
    height: 16px;
  }

  .assets-modal__btn--danger {
    background-color: #ef4444;
    color: white;
  }

  .assets-modal__btn--danger:hover {
    background-color: #dc2626;
  }

  .assets-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .assets-modal__btn--secondary:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .assets-modal__btn-icon {
    width: 16px;
    height: 16px;
  }

  /* Image Preview Modal Specific */
  .assets-modal__image-container {
    background-color: rgba(0, 0, 0, 0.5);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .assets-modal__image {
    display: block;
    max-width: 85vw;
    max-height: 70vh;
    object-fit: contain;
  }

  .assets-modal__image-footer {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .assets-modal__image-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .assets-modal__image-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .assets-modal__image-icon--watermark {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .assets-modal__image-icon--image {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .assets-modal__image-icon-svg {
    width: 20px;
    height: 20px;
  }

  .assets-modal__image-details {
    min-width: 0;
  }

  .assets-modal__image-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .assets-modal__image-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .assets-modal__image-type {
    display: inline-block;
    padding: 0.1875rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 4px;
  }

  .assets-modal__image-type--watermark {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .assets-modal__image-type--image {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .assets-modal__image-dimensions {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .assets-modal__image-org {
    display: inline-block;
    padding: 0.1875rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border-radius: 4px;
  }

  .assets-modal__image-delete {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #f87171;
    background: transparent;
    border: 1px solid rgba(248, 113, 113, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .assets-modal__image-delete:hover {
    background-color: rgba(248, 113, 113, 0.1);
    border-color: rgba(248, 113, 113, 0.5);
  }

  .assets-modal__image-delete-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Modal Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.15s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Card List Transitions ===== */
  .card-list-enter-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .card-list-leave-active {
    transition: all 0.2s ease-out;
    position: absolute;
  }

  .card-list-enter-from {
    opacity: 0;
    transform: scale(0.92) translateY(12px);
  }

  .card-list-leave-to {
    opacity: 0;
    transform: scale(0.96);
  }

  .card-list-move {
    transition: transform 0.3s ease;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
