<template>
  <div class="assets h-full">
    <PageLayout
      title="Assets"
      description="Manage your intros, outros, watermarks, and images"
      :show-header="true"
      :icon="Archive"
    >
      <template #actions>
        <Button
          v-if="hasOrganizations"
          variant="ghost"
          size="icon"
          :disabled="isSyncing"
          title="Refresh organization assets"
          aria-label="Refresh organization assets"
          @click="triggerSync"
        >
          <Loader2 v-if="isSyncing" class="animate-spin" />
          <RefreshCw v-else />
        </Button>
        <Button variant="ghost" size="icon" title="Open assets folder" aria-label="Open assets folder" @click="openIntrosFolder">
          <Folder />
        </Button>
        <Button variant="primary" :disabled="uploading" @click="handleUpload">
          <Upload />
          {{ uploading ? 'Uploading…' : 'Upload asset' }}
        </Button>
      </template>

      <template v-if="selectedAssets.size > 0" #toolbar>
        <SelectionBar :count="selectedAssets.size" @clear="clearSelection">
          <Button variant="destructive-soft" size="sm" @click="confirmBulkDelete"><Trash2 /> Delete</Button>
        </SelectionBar>
      </template>

      <!-- Loading (first load only; syncs and reloads keep the current grid) -->
      <div v-if="loading && !allAssets.length" class="skeleton-group px-5 py-4" aria-busy="true">
        <div class="skeleton mb-3 h-4 w-28" />
        <div class="card-grid">
          <div v-for="i in 6" :key="`skeleton-${i}`" class="flex flex-col gap-2">
            <div class="skeleton aspect-video rounded-xl" />
            <div class="skeleton h-3.5 w-2/3" />
            <div class="skeleton h-3 w-1/3" />
          </div>
        </div>
      </div>

      <!-- Empty -->
      <EmptyState
        v-else-if="allAssets.length === 0 && !uploading"
        :icon="Package"
        title="No assets yet"
        description="Upload your first intro, outro, watermark, audio, or image to get started"
      >
        <Button variant="secondary" @click="handleUpload"><Upload /> Upload asset</Button>
      </EmptyState>

      <!-- Content -->
      <div v-else class="flex animate-enter flex-col gap-6 px-5 py-4">
        <template v-for="section in assetSections" :key="section.key">
          <section v-if="section.items.length > 0 || (section.key === 'personal' && showSkeletonCard)">
            <SectionHeader :title="section.title" :icon="section.icon" :count="section.items.length" class="mb-3" />

            <div class="card-grid">
              <!-- Upload in progress -->
              <div v-if="section.key === 'personal' && showSkeletonCard" class="flex animate-fade-in flex-col gap-2">
                <div class="grid aspect-video place-items-center rounded-xl border border-dashed border-line bg-surface-sunken">
                  <div class="flex flex-col items-center gap-2">
                    <Loader2 class="size-5 animate-spin text-brand" />
                    <span class="text-xs text-fg-muted">Uploading…</span>
                  </div>
                </div>
                <div class="skeleton h-3.5 w-2/3" />
                <div class="skeleton h-3 w-1/3" />
              </div>

              <!-- Tiles fade in on first render and when added (keyed, so existing tiles stay put) -->
              <MediaTile
                v-for="asset in section.items"
                :key="`asset-${asset.isOrgAsset ? 'org' : 'local'}-${asset.id}`"
                class="animate-fade-in"
                :title="asset.name"
                :thumbnail="tileThumbnail(asset)"
                :fit="isImageLike(asset) ? 'contain' : 'cover'"
                :icon="assetTypeMeta(asset.assetType).icon"
                :meta="assetMeta(asset)"
                :selectable="!asset.isOrgAsset"
                :selected="isAssetSelected(String(asset.id))"
                :actions-visible="asset.assetType === 'audio' && isAudioPlaying(asset.id, asset.isOrgAsset)"
                @open="handleAssetClick(asset)"
                @toggle-select="toggleAssetSelection(String(asset.id))"
              >
                <template #badges>
                  <Badge variant="neutral" class="bg-surface-raised">
                    <component :is="assetTypeMeta(asset.assetType).icon" />
                    {{ assetTypeMeta(asset.assetType).label }}
                  </Badge>
                  <Badge
                    v-if="asset.isOrgAsset || asset.organization_id"
                    variant="neutral"
                    class="min-w-0 bg-surface-raised"
                    :title="`From: ${asset.organization_name || 'Organization'}`"
                  >
                    <Building2 />
                    <span class="truncate">{{ asset.organization_name || 'Org' }}</span>
                  </Badge>
                </template>

                <template #overlay>
                  <div
                    v-if="isAssetDownloading(asset)"
                    class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[var(--overlay)]"
                  >
                    <Loader2 class="size-5 animate-spin text-brand" />
                    <span class="text-xs text-fg">Downloading…</span>
                  </div>
                </template>

                <template #actions>
                  <Button
                    v-if="asset.assetType === 'intro' || asset.assetType === 'outro'"
                    variant="secondary"
                    size="icon-xs"
                    title="Play"
                    aria-label="Play"
                    @click.stop="playAsset(asset as any)"
                  >
                    <Play />
                  </Button>
                  <Button
                    v-if="asset.assetType === 'audio'"
                    variant="secondary"
                    size="icon-xs"
                    :title="isAudioPlaying(asset.id, asset.isOrgAsset) ? 'Pause' : 'Play'"
                    :aria-label="isAudioPlaying(asset.id, asset.isOrgAsset) ? 'Pause' : 'Play'"
                    @click.stop="toggleAudioPlayback(asset as any)"
                  >
                    <Pause v-if="isAudioPlaying(asset.id, asset.isOrgAsset)" />
                    <Play v-else />
                  </Button>
                  <Button
                    v-if="isImageLike(asset)"
                    variant="secondary"
                    size="icon-xs"
                    title="View full size"
                    aria-label="View full size"
                    @click.stop="openImagePreview(asset)"
                  >
                    <Maximize2 />
                  </Button>
                  <Button
                    v-if="!asset.isOrgAsset"
                    variant="secondary"
                    size="icon-xs"
                    class="hover:text-danger"
                    title="Delete"
                    aria-label="Delete"
                    @click.stop="confirmDelete(asset)"
                  >
                    <Trash2 />
                  </Button>
                </template>
              </MediaTile>
            </div>
          </section>
        </template>
      </div>
    </PageLayout>

    <!-- Asset Player Dialog -->
    <VideoPlayerDialog :video="assetToPlay" :show-video-player="showAssetPlayer" @close="handleAssetPlayerClose" />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete asset"
      message="Are you sure you want to delete"
      :item-name="assetToDelete?.name || (assetToDelete as any)?.file_path?.split(/[\\\\/]/).pop()"
      suffix="?"
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteDialogClose"
      @confirm="deleteAssetConfirmed"
    />

    <!-- Bulk Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showBulkDeleteDialog"
      :title="`Delete ${bulkDeleteLabel}`"
      :message="`You are about to delete ${bulkDeleteLabel}. The files will be permanently removed from your computer.`"
      suffix=""
      :confirm-text="`Delete ${bulkDeleteLabel}`"
      variant="destructive"
      @close="handleBulkDeleteDialogClose"
      @confirm="bulkDeleteConfirmed"
    />

    <!-- Asset Upload Dialog -->
    <AssetUploadDialog :show="showUploadDialog" @close="showUploadDialog = false" @uploaded="handleUploadComplete" />

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />

    <!-- Image Preview Dialog -->
    <Modal
      :open="showImagePreview && !!imageToPreview"
      :title="imageToPreview?.name"
      :icon="imageToPreview ? assetTypeMeta(imageToPreview.assetType).icon : undefined"
      size="xl"
      @close="closeImagePreview"
    >
      <div v-if="imageToPreview" class="flex flex-col gap-3">
        <div class="flex items-center gap-1.5">
          <Badge variant="neutral">{{ imageToPreview.assetType === 'watermark' ? 'Watermark' : 'Image' }}</Badge>
          <Badge v-if="getImageDimensions(imageToPreview)" variant="outline" class="tabular">
            {{ getImageDimensions(imageToPreview) }}
          </Badge>
          <Badge v-if="imageToPreview.isOrgAsset || imageToPreview.organization_id" variant="neutral">
            <Building2 />
            {{ (imageToPreview as any).organization_name || 'Organization' }}
          </Badge>
        </div>
        <div class="grid min-h-[240px] place-items-center rounded-lg border border-line-subtle bg-surface-sunken p-4">
          <img
            :src="getImagePreviewUrl(imageToPreview)"
            :alt="imageToPreview.name"
            class="max-h-[calc(100vh-18rem)] max-w-full rounded object-contain"
          />
        </div>
      </div>

      <template #footer>
        <!-- Close comes first in DOM so it receives initial focus; `order` keeps Delete on the left. -->
        <Button variant="secondary" class="order-2" @click="closeImagePreview">Close</Button>
        <Button
          v-if="imageToPreview && !imageToPreview.isOrgAsset && !imageToPreview.organization_id"
          variant="destructive-soft"
          class="order-1 mr-auto"
          @click="
            confirmDelete(imageToPreview);
            closeImagePreview();
          "
        >
          <Trash2 />
          Delete
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
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
  import type { Component } from 'vue';
  import {
    Archive,
    Folder,
    Upload,
    Play,
    Trash2,
    Package,
    Image as ImageIcon,
    Music,
    Pause,
    Building2,
    RefreshCw,
    Loader2,
    Maximize2,
    Clapperboard,
    Stamp,
    Layers,
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
  import { utf8ToBase64Url } from '@/utils/encoding';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Modal } from '@/components/ui/modal';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SectionHeader } from '@/components/ui/section-header';
  import PageLayout from '@/components/PageLayout.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import AssetUploadDialog from '@/components/AssetUploadDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { MediaTile } from '@/components/ui/media-tile';
  import { SelectionBar } from '@/components/ui/selection-bar';

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

  // ===== Display helpers (presentation only) =====
  const ASSET_TYPE_META: Record<string, { label: string; icon: Component }> = {
    intro: { label: 'Intro', icon: Clapperboard },
    outro: { label: 'Outro', icon: Clapperboard },
    watermark: { label: 'Watermark', icon: Stamp },
    audio: { label: 'Audio', icon: Music },
    image: { label: 'Image', icon: ImageIcon },
    overlay: { label: 'Overlay', icon: Layers },
  };

  function assetTypeMeta(type: string) {
    return ASSET_TYPE_META[type] ?? { label: 'Asset', icon: Package };
  }

  function isImageLike(asset: DisplayAsset): boolean {
    return asset.assetType === 'watermark' || asset.assetType === 'image';
  }

  // The built-in fallback artwork above is a data-URI SVG (200×120); show a neutral icon instead.
  const PLACEHOLDER_THUMB_PREFIX =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIw';

  function tileThumbnail(asset: DisplayAsset): string | null {
    const url = getThumbnailUrl(asset);
    return url && !url.startsWith(PLACEHOLDER_THUMB_PREFIX) ? url : null;
  }

  function assetMeta(asset: DisplayAsset): string[] {
    let primary: string;
    if (asset.assetType === 'watermark') {
      const wm = asset as WatermarkImage;
      primary = wm.width && wm.height ? `${wm.width}×${wm.height}` : 'Image';
    } else if (asset.assetType === 'image') {
      const img = asset as ImageAsset;
      primary = img.width && img.height ? `${img.width}×${img.height}` : 'Image';
    } else if (asset.assetType === 'audio') {
      primary = formatDuration((asset as AudioAsset).duration || undefined);
    } else {
      primary = formatDuration((asset as IntroOutro).duration || undefined);
    }
    return [primary, formatRelativeTime(asset.isOrgAsset ? (asset as any).inserted_at : (asset as any).created_at)];
  }

  const assetSections = computed(() => [
    { key: 'org', title: 'Organization assets', icon: Building2, items: orgAssetsForDisplay.value },
    { key: 'personal', title: 'Your assets', icon: Archive, items: personalAssets.value },
  ]);

  const bulkDeleteLabel = computed(() => `${selectedAssets.value.size} ${selectedAssets.value.size === 1 ? 'asset' : 'assets'}`);

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
          const encodedPath = utf8ToBase64Url((audio as AudioAsset).file_path);
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
