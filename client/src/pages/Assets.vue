<template>
  <div class="assets-page">
    <PageLayout
      title="Assets"
      description="Manage your intros, outros, and watermarks"
      :show-header="true"
      :icon="Archive"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <button
            @click="openIntrosFolder"
            title="Open assets folder"
            class="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-all"
          >
            <Folder class="h-5 w-5" />
          </button>
          <button
            @click="handleUpload"
            :disabled="uploading"
            class="px-5 py-2.5 bg-muted hover:bg-muted/80 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload class="h-5 w-5" />
            {{ uploading ? 'Uploading...' : 'Upload Asset' }}
          </button>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <SkeletonGrid />
      </div>

      <!-- Content when not loading -->
      <div v-else>
        <!-- Header with stats -->
        <div v-if="allAssets.length > 0 || showSkeletonCard" class="flex items-center justify-between mb-4">
          <p class="text-sm text-muted-foreground">
            <span v-if="showSkeletonCard">
              Uploading...
              <span v-if="allAssets.length > 0">
                • {{ allAssets.length }} asset{{ allAssets.length !== 1 ? 's' : '' }}
              </span>
            </span>
            <span v-else-if="allAssets.length > 0">
              {{ allAssets.length }} asset{{ allAssets.length !== 1 ? 's' : '' }}
            </span>
          </p>
        </div>

        <!-- Assets Grid -->
        <div
          v-if="allAssets.length > 0 || showSkeletonCard"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <!-- Upload progress card -->
          <div
            v-if="showSkeletonCard"
            class="relative bg-card border border-border rounded-md overflow-hidden hover:border-foreground/20 group aspect-video"
          >
            <!-- Upload overlay -->
            <div class="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
              <div class="text-center text-white p-4">
                <!-- Upload icon -->
                <div
                  class="inline-flex items-center justify-center w-12 h-12 mb-3 bg-white/10 rounded-full backdrop-blur-sm"
                >
                  <Upload class="h-6 w-6" />
                </div>

                <!-- Title -->
                <h3 class="font-semibold text-base mb-2 line-clamp-2 px-2">Uploading Asset</h3>

                <!-- Status -->
                <div class="text-sm mb-1">Processing...</div>
                <div class="text-xs text-white/70">Generating thumbnail and saving asset</div>
              </div>
            </div>
          </div>

          <!-- Existing asset cards -->
          <div
            v-for="asset in paginatedAssets"
            :key="asset.id"
            class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
            @click="asset.assetType !== 'watermark' ? playAsset(asset as IntroOutro) : null"
          >
            <!-- Thumbnail background with vignette -->
            <div
              v-if="getThumbnailUrl(asset)"
              class="absolute inset-0 z-0"
              :style="{
                backgroundImage: `url(${getThumbnailUrl(asset)})`,
                backgroundSize: asset.assetType === 'watermark' ? 'contain' : 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: asset.assetType === 'watermark' ? '#1a1a1a' : 'transparent',
              }"
            >
              <!-- Dark vignette overlay handled by bottom gradient now, but keep subtle global one -->
              <div class="absolute inset-0 bg-black/10"></div>
            </div>

            <!-- Top left type badge -->
            <div class="absolute top-4 left-4 z-5">
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md flex items-center gap-1',
                  getThumbnailUrl(asset)
                    ? 'text-white/70 bg-white/10 backdrop-blur-sm'
                    : asset.assetType === 'intro'
                      ? 'text-white/70 bg-blue-500/20 backdrop-blur-sm'
                      : asset.assetType === 'outro'
                        ? 'text-white/70 bg-purple-500/20 backdrop-blur-sm'
                        : 'text-white/70 bg-amber-500/20 backdrop-blur-sm',
                ]"
              >
                <component :is="asset.assetType === 'watermark' ? ImageIcon : Package" class="h-3 w-3" />
                {{ asset.assetType === 'intro' ? 'Intro' : asset.assetType === 'outro' ? 'Outro' : 'Watermark' }}
              </span>
            </div>

            <!-- Bottom Overlay with Info -->
            <div
              class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
            >
              <!-- Title -->
              <h3
                class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors"
                :title="asset.name"
              >
                {{ asset.name }}
              </h3>

              <!-- Metadata Row -->
              <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
                <!-- Duration for video assets, dimensions for watermarks -->
                <span v-if="asset.assetType === 'watermark'">
                  {{
                    (asset as WatermarkImage).width && (asset as WatermarkImage).height
                      ? `${(asset as WatermarkImage).width}×${(asset as WatermarkImage).height}`
                      : 'Image'
                  }}
                </span>
                <span v-else>{{ formatDuration((asset as IntroOutro).duration || undefined) }}</span>

                <span class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

                <!-- Created At -->
                <span class="truncate">{{ formatRelativeTime(asset.created_at) }}</span>
              </div>
            </div>

            <!-- Hover Overlay Buttons -->
            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
            >
              <!-- Play button only for video assets -->
              <button
                v-if="asset.assetType !== 'watermark'"
                class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Play"
                @click.stop="playAsset(asset as IntroOutro)"
              >
                <Play class="h-6 w-6" />
              </button>
              <button
                class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Delete"
                @click.stop="confirmDelete(asset)"
              >
                <Trash2 class="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <EmptyState
          v-if="allAssets.length === 0 && !uploading"
          title="No assets yet"
          description="Upload your first intro, outro, or watermark to get started"
        >
          <template #icon>
            <Package class="h-16 w-16 text-muted-foreground" />
          </template>
        </EmptyState>
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
      @close="handleDeleteDialogClose"
      @confirm="deleteAssetConfirmed"
    />

    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="!loading && allAssets.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="allAssets.length"
      item-label="asset"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />

    <!-- Asset Upload Dialog -->
    <AssetUploadDialog :show="showUploadDialog" @close="showUploadDialog = false" @uploaded="handleUploadComplete" />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
  import { getAllIntroOutros, getAllWatermarkImages, type IntroOutro, type WatermarkImage } from '@/services/database';
  import { Archive, Folder, Upload, Play, Trash2, Package, Image as ImageIcon } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { getStoragePath } from '@/services/storage';
  import { invoke } from '@tauri-apps/api/core';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import AssetUploadDialog from '@/components/AssetUploadDialog.vue';

  // Combined asset type for display
  type DisplayAsset = (IntroOutro & { assetType: 'intro' | 'outro' }) | (WatermarkImage & { assetType: 'watermark' });

  const assets = ref<IntroOutro[]>([]);
  const watermarks = ref<WatermarkImage[]>([]);
  const loading = ref(true);
  const showDeleteDialog = ref(false);
  const assetToDelete = ref<DisplayAsset | null>(null);
  const showAssetPlayer = ref(false);
  const assetToPlay = ref<IntroOutro | null>(null);
  const showUploadDialog = ref(false);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const { error } = useToast();

  let unregisterUploadCallback: (() => void) | null = null;
  let unregisterWatermarkCallback: (() => void) | null = null;

  // Asset operations composable
  const { uploading, showSkeletonCard, deleteAsset, onUploadComplete } = useAssetOperations();
  const { deleteWatermark, onUploadComplete: onWatermarkUploadComplete } = useWatermarkOperations();

  // Combined assets for display
  const allAssets = computed<DisplayAsset[]>(() => {
    const introOutros: DisplayAsset[] = assets.value.map((a) => ({ ...a, assetType: a.type as 'intro' | 'outro' }));
    const wms: DisplayAsset[] = watermarks.value.map((w) => ({ ...w, assetType: 'watermark' as const }));
    return [...introOutros, ...wms];
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
    return `Added ${date.toLocaleDateString('en-US', options)}`;
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
      // Load both intro/outros and watermarks
      const [introOutros, wms] = await Promise.all([getAllIntroOutros(), getAllWatermarkImages()]);

      assets.value = introOutros;
      watermarks.value = wms;

      // Reset pagination to first page when loading new assets
      currentPage.value = 1;

      // Load thumbnails for existing video assets
      for (const asset of assets.value) {
        await loadAssetThumbnail(asset);
      }

      // Load thumbnails for watermarks (they are images, so use them directly)
      for (const wm of watermarks.value) {
        await loadWatermarkThumbnail(wm);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      loading.value = false;
    }
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
    const cached = thumbnailCache.value.get(asset.id);
    if (cached) return cached;

    if (asset.assetType === 'watermark') {
      // Watermarks should have been loaded in loadWatermarkThumbnail
      return null;
    }

    return getAssetThumbnailUrl(asset as IntroOutro);
  }

  function handleUpload() {
    showUploadDialog.value = true;
  }

  function handleUploadComplete() {
    // Reload assets list when upload completes
    loadAssets();
  }

  async function playAsset(asset: IntroOutro) {
    try {
      // Create a fresh copy of the asset object to ensure reactivity
      // This helps when reopening the same asset
      assetToPlay.value = { ...asset } as any;
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
    } else {
      result = await deleteAsset(assetToDelete.value as IntroOutro);
    }

    if (result.success) {
      await loadAssets();
    }

    showDeleteDialog.value = false;
    assetToDelete.value = null;
  }

  async function openIntrosFolder() {
    try {
      // Get the base storage directory and construct assets path
      const basePath = await getStoragePath('base');
      const assetsPath = basePath + '\\assets';

      // Use the first asset file if available, otherwise use a dummy path
      if (allAssets.value.length > 0) {
        // Reveal the first asset file, which will open the assets folder
        await revealItemInDir(allAssets.value[0].file_path);
      } else {
        // If no assets, append a dummy filename to open the assets folder
        // The file doesn't need to exist, revealItemInDir will still open the parent folder
        await revealItemInDir(assetsPath + '\\dummy.mp4');
      }
    } catch (err) {
      error('Failed to open folder', 'Unable to open the assets folder');
    }
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
  });
</script>

<style scoped>
  /* Root wrapper to ensure single root element for Transition */
  .assets-page {
    position: relative;
    width: 100%;
    min-height: 100%;
  }
</style>
