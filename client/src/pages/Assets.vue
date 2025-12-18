<template>
  <div class="assets-page">
    <PageLayout
      title="Assets"
      description="Manage your intros, outros, watermarks, and images"
      :show-header="true"
      :icon="Archive"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <!-- Refresh button for organization assets -->
          <Button
            v-if="hasOrganizations"
            @click="triggerSync"
            :disabled="isSyncing"
            title="Refresh organization assets"
            class="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isSyncing" class="h-5 w-5 animate-spin" />
            <RefreshCw v-else class="h-5 w-5" />
          </Button>
          <Button @click="openIntrosFolder" title="Open assets folder" class="flex items-center gap-2">
            <Folder class="h-5 w-5" />
          </Button>
          <Button
            @click="handleUpload"
            :disabled="uploading"
            class="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload class="h-5 w-5" />
            {{ uploading ? 'Uploading...' : 'Upload Asset' }}
          </Button>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <SkeletonGrid />
      </div>

      <!-- Content when not loading -->
      <div v-else>
        <!-- Header with stats or selection controls -->
        <div v-if="allAssets.length > 0 || showSkeletonCard" class="flex items-center justify-between mb-4">
          <!-- Selection Controls (visible when items selected) -->
          <div v-if="selectedAssets.size > 0" class="flex items-center gap-3">
            <button
              @click="confirmBulkDelete"
              class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-2 font-medium text-sm transition-all"
            >
              <Trash2 class="h-4 w-4" />
              Delete ({{ selectedAssets.size }})
            </button>
            <span class="text-sm text-muted-foreground">{{ selectedAssets.size }} selected</span>
            <button @click="clearSelection" class="text-xs text-muted-foreground hover:text-foreground font-medium">
              Clear
            </button>
          </div>

          <!-- Stats (hidden when items selected) -->
          <p v-else class="text-sm text-muted-foreground">
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
            :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-background': isAssetSelected(asset.id) }"
            @click="handleAssetClick(asset)"
          >
            <!-- Selection Checkbox (visible on hover or when selected) - NOT for org assets -->
            <div
              v-if="!asset.isOrgAsset"
              class="absolute top-4 right-4 z-30 transition-opacity"
              :class="isAssetSelected(asset.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
              @click.stop="toggleAssetSelection(asset.id)"
            >
              <div
                :class="[
                  'w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/45',
                  isAssetSelected(asset.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-black/60 text-white hover:bg-black/80',
                ]"
              >
                <Check v-if="isAssetSelected(asset.id)" class="w-4 h-4" />
              </div>
            </div>

            <!-- Thumbnail background with vignette -->
            <div
              v-if="getThumbnailUrl(asset)"
              class="absolute inset-0 z-0"
              :style="{
                backgroundImage: `url(${getThumbnailUrl(asset)})`,
                backgroundSize: asset.assetType === 'watermark' || asset.assetType === 'image' ? 'contain' : 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor:
                  asset.assetType === 'watermark' || asset.assetType === 'image' ? '#1a1a1a' : 'transparent',
              }"
            >
              <!-- Dark vignette overlay handled by bottom gradient now, but keep subtle global one -->
              <div class="absolute inset-0 bg-black/10"></div>
            </div>

            <!-- Top left badges -->
            <div class="absolute top-4 left-4 z-5 flex flex-row flex-wrap gap-1.5">
              <!-- Type badge -->
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md flex items-center gap-1',
                  getThumbnailUrl(asset)
                    ? 'text-white/70 bg-white/10 backdrop-blur-sm'
                    : asset.assetType === 'intro'
                      ? 'text-white/70 bg-blue-500/20 backdrop-blur-sm'
                      : asset.assetType === 'outro'
                        ? 'text-white/70 bg-purple-500/20 backdrop-blur-sm'
                        : asset.assetType === 'audio'
                          ? 'text-white/70 bg-emerald-500/20 backdrop-blur-sm'
                          : asset.assetType === 'image'
                            ? 'text-white/70 bg-cyan-500/20 backdrop-blur-sm'
                            : 'text-white/70 bg-amber-500/20 backdrop-blur-sm',
                ]"
              >
                <component
                  :is="
                    asset.assetType === 'watermark' || asset.assetType === 'image'
                      ? ImageIcon
                      : asset.assetType === 'audio'
                        ? Music
                        : Package
                  "
                  class="h-3 w-3"
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
              <!-- Organization badge -->
              <span
                v-if="asset.isOrgAsset || asset.organization_id"
                class="text-xs px-2 py-1 rounded-md flex items-center gap-1 text-white/80 bg-indigo-500/30 backdrop-blur-sm"
                :title="`From: ${asset.organization_name || 'Organization'}`"
              >
                <Building2 class="h-3 w-3" />
                {{ asset.organization_name || 'Org' }}
              </span>
            </div>

            <!-- Downloading overlay -->
            <div
              v-if="isAssetDownloading(asset)"
              class="absolute inset-0 z-20 bg-black/60 flex items-center justify-center"
            >
              <div class="text-center text-white">
                <Loader2 class="h-8 w-8 animate-spin mx-auto mb-2" />
                <span class="text-sm">Downloading...</span>
              </div>
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
                <!-- Duration for video/audio assets, dimensions for watermarks/images -->
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

                <span class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

                <!-- Created At -->
                <span class="truncate">{{ formatRelativeTime(asset.created_at) }}</span>
              </div>
            </div>

            <!-- Hover Overlay Buttons -->
            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-3"
              :class="{ 'opacity-100': asset.assetType === 'audio' && isAudioPlaying(asset.id, asset.isOrgAsset) }"
            >
              <!-- Play button for video assets -->
              <button
                v-if="asset.assetType === 'intro' || asset.assetType === 'outro'"
                class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Play"
                @click.stop="playAsset(asset as any)"
              >
                <Play class="h-5 w-5" />
              </button>
              <!-- Play/Pause button for audio assets -->
              <button
                v-if="asset.assetType === 'audio'"
                class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                :title="isAudioPlaying(asset.id, asset.isOrgAsset) ? 'Pause' : 'Play'"
                @click.stop="toggleAudioPlayback(asset as any)"
              >
                <Pause v-if="isAudioPlaying(asset.id, asset.isOrgAsset)" class="h-5 w-5" />
                <Play v-else class="h-5 w-5" />
              </button>
              <!-- Expand button for image/watermark assets -->
              <button
                v-if="asset.assetType === 'image' || asset.assetType === 'watermark'"
                class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="View full size"
                @click.stop="openImagePreview(asset)"
              >
                <Maximize2 class="h-5 w-5" />
              </button>
              <!-- Delete button - NOT for org assets (they're managed at org level) -->
              <button
                v-if="!asset.isOrgAsset"
                class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Delete"
                @click.stop="confirmDelete(asset)"
              >
                <Trash2 class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <EmptyState
          v-if="allAssets.length === 0 && !uploading"
          title="No assets yet"
          description="Upload your first intro, outro, watermark, audio, or image to get started"
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

    <!-- Image Preview Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showImagePreview && imageToPreview"
          class="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeImagePreview"
        >
          <Transition name="dialog" appear>
            <div class="relative max-w-[90vw] max-h-[90vh] flex flex-col">
              <!-- Close Button -->
              <button
                @click="closeImagePreview"
                class="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
              >
                <X class="h-6 w-6" />
              </button>

              <!-- Image Container -->
              <div class="relative bg-zinc-900/50 rounded-xl overflow-hidden border border-white/10">
                <img
                  :src="getImagePreviewUrl(imageToPreview)"
                  :alt="imageToPreview.name"
                  class="max-w-[85vw] max-h-[80vh] object-contain"
                />
              </div>

              <!-- Image Info -->
              <div class="mt-4 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2 rounded-lg"
                    :class="imageToPreview.assetType === 'watermark' ? 'bg-amber-500/20' : 'bg-cyan-500/20'"
                  >
                    <ImageIcon
                      class="h-5 w-5"
                      :class="imageToPreview.assetType === 'watermark' ? 'text-amber-400' : 'text-cyan-400'"
                    />
                  </div>
                  <div>
                    <p class="text-white font-medium">{{ imageToPreview.name }}</p>
                    <p class="text-zinc-400 text-sm">
                      <span
                        class="px-1.5 py-0.5 rounded text-xs mr-2"
                        :class="
                          imageToPreview.assetType === 'watermark'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        "
                      >
                        {{ imageToPreview.assetType === 'watermark' ? 'Watermark' : 'Image' }}
                      </span>
                      <span v-if="getImageDimensions(imageToPreview)">
                        {{ getImageDimensions(imageToPreview) }}
                      </span>
                      <!-- Organization badge -->
                      <span
                        v-if="imageToPreview.isOrgAsset || imageToPreview.organization_id"
                        class="ml-2 px-1.5 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-400"
                      >
                        {{ (imageToPreview as any).organization_name || 'Organization' }}
                      </span>
                    </p>
                  </div>
                </div>

                <!-- Delete Button (only for personal assets) -->
                <button
                  v-if="!imageToPreview.isOrgAsset && !imageToPreview.organization_id"
                  @click="
                    confirmDelete(imageToPreview);
                    closeImagePreview();
                  "
                  class="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 class="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Bulk Delete Confirmation Modal -->
    <div
      v-if="showBulkDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="handleBulkDeleteDialogClose"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete {{ selectedAssets.size }} Assets</h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete
            <span class="font-semibold text-foreground">{{ selectedAssets.size }} assets</span>
            ? The files will be permanently removed.
            <span class="block mt-1">This action cannot be undone.</span>
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="bulkDeleteConfirmed"
          >
            Delete {{ selectedAssets.size }} Assets
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            @click="handleBulkDeleteDialogClose"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch, Teleport, Transition } from 'vue';
  import {
    getAllIntroOutros,
    getAllWatermarkImages,
    getAllAudioAssets,
    getAllImageAssets,
    type IntroOutro,
    type WatermarkImage,
    type AudioAsset,
    type ImageAsset,
  } from '@/services/database';
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

  // Combined asset type for display
  type DisplayAsset =
    | (IntroOutro & { assetType: 'intro' | 'outro'; isOrgAsset?: false })
    | (WatermarkImage & { assetType: 'watermark'; isOrgAsset?: false })
    | (AudioAsset & { assetType: 'audio'; isOrgAsset?: false })
    | (ImageAsset & { assetType: 'image'; isOrgAsset?: false })
    | (ServerOrganizationAsset & { assetType: 'intro' | 'outro' | 'watermark' | 'audio' | 'image'; isOrgAsset: true });

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

  // Combined assets for display (personal + org from server)
  const allAssets = computed<DisplayAsset[]>(() => {
    const orgAssetsDisplay: DisplayAsset[] = serverOrgAssets.value.map((a) => ({
      ...a,
      assetType: a.asset_type,
      isOrgAsset: true as const,
    }));
    return [...personalAssets.value, ...orgAssetsDisplay];
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
          created_at: orgAsset.inserted_at,
          updated_at: orgAsset.updated_at,
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
        currentlyPlayingAudio.value = audioId;
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
  /* Root wrapper to ensure single root element for Transition */
  .assets-page {
    position: relative;
    width: 100%;
    min-height: 100%;
  }

  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
