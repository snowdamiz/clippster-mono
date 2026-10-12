<template>
  <PageLayout
    title="Assets"
    description="Upload intros, outros, watermarks, and other assets for your team"
    :icon="FolderOpen"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Assets' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button v-if="isAdmin" variant="primary" size="sm" @click="openUploadDialog">
        <Upload />
        Upload asset
      </Button>
    </template>
    <template v-if="orgAssets.length > 0" #toolbar>
      <div class="min-w-0 overflow-x-auto">
        <SegmentedControl v-model="typeFilter" :options="filterOptions" />
      </div>
    </template>

    <div class="flex flex-col px-5 py-4">
      <!-- Loading (first load only) -->
      <div
        v-if="assetsLoading && orgAssets.length === 0"
        class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
        aria-busy="true"
      >
        <div v-for="i in 6" :key="i" class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <div class="skeleton aspect-video rounded-none" />
          <div class="flex flex-col gap-1.5 p-3">
            <div class="skeleton h-3.5 w-2/3" />
            <div class="skeleton h-3 w-1/3" />
          </div>
        </div>
      </div>

      <!-- Asset groups: keyed by the type filter so each switch eases in -->
      <div v-else-if="orgAssets.length > 0" :key="typeFilter" class="flex animate-enter flex-col gap-6">
        <section v-for="group in visibleGroups" :key="group.type" class="flex flex-col gap-2.5">
          <SectionHeader
            :title="getAssetTypePlural(group.type)"
            :count="group.assets.length"
            :icon="getAssetTypeIcon(group.type)"
            :description="getAssetTypeDescription(group.type)"
          />
          <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            <article
              v-for="asset in group.assets"
              :key="asset.id"
              class="group/asset flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors"
              :class="isAudioPlaying(asset.id) ? 'border-brand-line' : 'border-line-subtle hover:border-line'"
            >
              <!-- Preview -->
              <button
                type="button"
                class="relative block aspect-video w-full overflow-hidden focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--brand)]"
                :class="['image', 'watermark'].includes(asset.asset_type) ? 'transparency-checkerboard' : 'bg-surface-sunken'"
                :aria-label="asset.asset_type === 'audio' ? (isAudioPlaying(asset.id) ? 'Pause' : 'Play') : 'Preview'"
                @click="handleAssetClick(asset)"
              >
                <img
                  v-if="asset.asset_type !== 'audio' && (asset.thumbnail_url || (asset.url && ['image', 'watermark'].includes(asset.asset_type)))"
                  :src="asset.thumbnail_url || asset.url"
                  :alt="asset.name"
                  class="size-full"
                  :class="['image', 'watermark'].includes(asset.asset_type) ? 'object-contain p-3' : 'object-cover'"
                />
                <span v-else class="grid size-full place-items-center text-fg-subtle">
                  <component :is="getAssetTypeIcon(asset.asset_type)" class="size-7" />
                </span>

                <span
                  class="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover/asset:opacity-100"
                  :class="{ 'opacity-100': isAudioPlaying(asset.id) }"
                >
                  <span class="grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                    <Pause v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)" class="size-4" />
                    <Maximize2 v-else-if="['image', 'watermark'].includes(asset.asset_type)" class="size-4" />
                    <Play v-else class="size-4 translate-x-px" />
                  </span>
                </span>

                <span
                  v-if="asset.duration"
                  class="tabular absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-px text-2xs font-medium text-white"
                >
                  {{ formatDuration(asset.duration) }}
                </span>
              </button>

              <!-- Info -->
              <div class="flex items-start gap-2 p-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-fg" :title="asset.name">{{ asset.name }}</p>
                  <p class="flex min-w-0 items-center gap-1.5 truncate text-xs text-fg-subtle">
                    <span v-if="asset.width && asset.height" class="tabular">{{ asset.width }}×{{ asset.height }}</span>
                    <span v-if="asset.width && asset.height && asset.file_size" aria-hidden="true">·</span>
                    <span v-if="asset.file_size" class="tabular">{{ formatFileSize(asset.file_size) }}</span>
                    <span v-if="!(asset.width && asset.height) && !asset.file_size" class="capitalize">
                      {{ getAssetTypeLabel(asset.asset_type) }}
                    </span>
                  </p>
                  <button
                    v-if="getAttachedCampaign(asset)"
                    type="button"
                    class="mt-1.5"
                    :title="`Used in campaign: ${getAttachedCampaign(asset)?.title}`"
                    @click.stop="viewAttachedCampaign(asset)"
                  >
                    <Badge variant="brand"><Megaphone />Campaign</Badge>
                  </button>
                </div>

                <DropdownMenu v-if="isAdmin">
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon-xs" class="-mr-1" title="Asset actions" aria-label="Asset actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-52">
                    <DropdownMenuItem v-if="isPlayableAsset(asset)" @select="handleAssetClick(asset)">
                      <Play />
                      {{ asset.asset_type === 'audio' ? 'Play audio' : 'Preview' }}
                    </DropdownMenuItem>
                    <DropdownMenuItem v-if="getAttachedCampaign(asset)" @select="viewAttachedCampaign(asset)">
                      <Megaphone />
                      View attached campaign
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      :disabled="isAttachedToActiveCampaign(asset)"
                      class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                      @select="confirmDeleteAsset(asset)"
                    >
                      <Trash2 />
                      {{ isAttachedToActiveCampaign(asset) ? 'In use by campaign' : 'Delete asset' }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- Empty -->
      <EmptyState
        v-else
        :icon="Package"
        title="No assets yet"
        description="Upload intros, outros, watermarks or audio files to build your team's asset library."
      >
        <Button v-if="isAdmin" variant="secondary" size="sm" @click="openUploadDialog">
          <Upload />
          Upload first asset
        </Button>
      </EmptyState>
    </div>

    <!-- Upload Asset Dialog -->
    <Modal
      :open="showUploadDialog"
      title="Upload asset"
      :description="uploadDialogFile ? 'Choose how this file is used.' : 'Select a video, image or audio file.'"
      :icon="Upload"
      :dismissible="!uploadingAsset"
      @close="closeUploadDialog"
    >
      <!-- Pick a file -->
      <Dropzone
        v-if="!uploadDialogFile"
        :icon="FolderOpen"
        title="Click to browse files"
        hint="MP4, MOV, PNG, JPG, GIF, WebP, MP3, WAV…"
        @select="selectFileForUpload"
      />

      <!-- File selected -->
      <div v-else class="flex flex-col gap-4">
        <FileRow
          :name="uploadDialogFile.name"
          :meta="`${formatFileSize(uploadDialogFile.size)} · ${uploadDialogFileType.toUpperCase()}`"
          :icon="getFileTypeIcon(uploadDialogFileType)"
          @remove="clearUploadFile"
        />

        <Field label="Asset type">
          <div class="grid grid-cols-2 gap-2" role="radiogroup">
            <button
              v-for="option in uploadDialogAssetOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="uploadDialogSelectedType === option.value"
              class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              :class="
                uploadDialogSelectedType === option.value
                  ? 'border-brand-line bg-brand-soft text-fg'
                  : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg'
              "
              @click="uploadDialogSelectedType = option.value"
            >
              <component
                :is="option.icon"
                class="size-4 shrink-0"
                :class="uploadDialogSelectedType === option.value ? 'text-brand' : 'text-fg-subtle'"
              />
              <span class="flex-1 truncate font-medium">{{ option.label }}</span>
              <Badge v-if="option.recommended">Suggested</Badge>
            </button>
          </div>
        </Field>

        <Field label="Name" hint="Optional — defaults to the file name." for="org-asset-name">
          <Input id="org-asset-name" v-model="uploadDialogAssetName" type="text" :placeholder="uploadDialogFile.name" />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="uploadingAsset" @click="closeUploadDialog">Cancel</Button>
        <Button
          v-if="uploadDialogFile"
          variant="primary"
          :loading="uploadingAsset"
          :disabled="uploadingAsset || !uploadDialogSelectedType"
          @click="executeAssetUpload"
        >
          {{ uploadingAsset ? 'Uploading…' : 'Upload asset' }}
        </Button>
      </template>
    </Modal>

    <!-- Delete Asset Dialog -->
    <Modal
      :open="showDeleteDialog"
      title="Delete asset"
      description="This action cannot be undone."
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!deleteProcessing"
      @close="closeDeleteDialog"
    >
      <div class="flex items-center gap-3">
        <span class="grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken text-fg-subtle">
          <img
            v-if="
              deleteDialogAsset?.asset_type !== 'audio' &&
              (deleteDialogAsset?.thumbnail_url ||
                (deleteDialogAsset?.url && ['image', 'watermark'].includes(deleteDialogAsset?.asset_type)))
            "
            :src="deleteDialogAsset?.thumbnail_url || deleteDialogAsset?.url"
            :alt="deleteDialogAsset?.name"
            class="size-full object-cover"
          />
          <component :is="getAssetTypeIcon(deleteDialogAsset?.asset_type || '')" v-else class="size-4" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-fg">{{ deleteDialogAsset?.name }}</p>
          <p class="text-xs capitalize text-fg-subtle">{{ getAssetTypeLabel(deleteDialogAsset?.asset_type || '') }}</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-fg-muted">
        Are you sure you want to delete <span class="font-medium text-fg">"{{ deleteDialogAsset?.name }}"</span>? It will
        be permanently removed from your organization.
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="deleteProcessing" @click="closeDeleteDialog">Cancel</Button>
        <Button variant="destructive" :loading="deleteProcessing" @click="executeDeleteAsset">
          {{ deleteProcessing ? 'Deleting…' : 'Delete asset' }}
        </Button>
      </template>
    </Modal>

    <!-- Video Player Dialog -->
    <VideoPlayerDialog
      :video="null"
      :video-url="videoToPlay?.url"
      :video-title="videoToPlay?.name"
      :show-video-player="showVideoPlayer"
      @close="closeVideoPlayer"
    />

    <!-- Image Preview -->
    <Modal
      :open="showImagePreview && !!imageToPreview"
      :title="imageToPreview?.name"
      :description="imageToPreview?.width && imageToPreview?.height ? `${imageToPreview.width}×${imageToPreview.height}` : undefined"
      size="xl"
      @close="closeImagePreview"
    >
      <div class="transparency-checkerboard grid place-items-center overflow-hidden rounded-lg">
        <img
          v-if="imageToPreview"
          :src="imageToPreview.url"
          :alt="imageToPreview.name"
          class="max-h-[65vh] w-auto max-w-full object-contain"
        />
      </div>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Upload,
    Play,
    Pause,
    Trash2,
    Package,
    Film,
    Image as ImageIcon,
    Music,
    FolderOpen,
    MoreHorizontal,
    Maximize2,
    Megaphone,
    LayoutGrid,
  } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Dropzone, FileRow } from '@/components/ui/dropzone';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import {
    uploadOrganizationAsset,
    deleteOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import { listOrganizationCampaigns, type Campaign } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';

  const { success: showSuccess, error: showError } = useToast();
  const router = useRouter();

  const { organizationId, isAdmin, orgAssets, assetsLoading, assetsLoaded, loadOrgAssets } = useOrganization();

  // Campaigns state
  const campaigns = ref<Campaign[]>([]);
  const campaignsLoaded = ref(false);

  // Local state
  // Type filter shown in the toolbar ('all' or an asset type)
  const typeFilter = ref<string>('all');
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

  const visibleGroups = computed(() =>
    typeFilter.value === 'all' ? groupedAssets.value : groupedAssets.value.filter((g) => g.type === typeFilter.value)
  );

  const filterOptions = computed<SegmentedOption<string>[]>(() => [
    { value: 'all', label: 'All', icon: markRaw(LayoutGrid), count: orgAssets.value.length },
    ...groupedAssets.value.map((g) => ({ value: g.type, label: getAssetTypePlural(g.type), count: g.assets.length })),
  ]);

  function getAssetTypePlural(type: string): string {
    return type === 'audio' ? 'Audio' : `${getAssetTypeLabel(type)}s`;
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

  function isPlayableAsset(asset: ServerOrganizationAsset): boolean {
    return ['intro', 'outro', 'audio', 'image', 'watermark'].includes(asset.asset_type);
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
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
        showError('Playback error', 'Failed to play audio file');
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

  // Load campaigns to check for asset usage
  async function loadCampaigns() {
    if (!organizationId.value || campaignsLoaded.value) return;

    try {
      const response = await listOrganizationCampaigns(Number(organizationId.value));
      if (response.success) {
        campaigns.value = response.campaigns;
        campaignsLoaded.value = true;
      }
    } catch (err) {
      console.error('[OrganizationAssets] Failed to load campaigns:', err);
    }
  }

  // Helper to strip query params from URLs for comparison
  function getBaseUrl(url: string | null | undefined): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    } catch {
      return url.split('?')[0];
    }
  }

  // Check if an asset is attached to an active campaign
  function getAttachedCampaign(asset: ServerOrganizationAsset): Campaign | null {
    if (asset.asset_type !== 'image') return null;
    const assetBaseUrl = getBaseUrl(asset.url);
    return (
      campaigns.value.find(
        (c) => c.status === 'active' && getBaseUrl(c.cover_image_url) === assetBaseUrl
      ) || null
    );
  }

  function isAttachedToActiveCampaign(asset: ServerOrganizationAsset): boolean {
    return getAttachedCampaign(asset) !== null;
  }

  // Navigate to the campaign page for the attached campaign
  function viewAttachedCampaign(asset: ServerOrganizationAsset) {
    const campaign = getAttachedCampaign(asset);
    if (campaign && organizationId.value) {
      router.push(`/organizations/${organizationId.value}/campaigns`);
    }
  }

  onMounted(() => {
    if (!assetsLoaded.value) {
      loadOrgAssets();
    }
    loadCampaigns();
  });

  onUnmounted(() => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }
  });
</script>

