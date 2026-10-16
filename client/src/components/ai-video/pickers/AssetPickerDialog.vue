<template>
  <Modal
    :open="isOpen"
    title="Select assets"
    description="Choose assets from your library to use in your AI video."
    :icon="FolderOpen"
    size="xl"
    flush
    body-class="flex min-h-0 flex-col"
    @close="cancel"
  >
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line-subtle px-5 pb-3 pt-2">
      <SegmentedControl v-model="activeTab" :options="tabOptions" />
      <SearchField v-model="searchQuery" placeholder="Search assets…" class="ml-auto w-full max-w-60 min-w-[140px] flex-1" />
    </div>

    <div class="min-h-[320px] flex-1 overflow-y-auto px-5 py-4">
      <!-- Keyed by tab so each switch eases in -->
      <div :key="activeTab" class="animate-enter">
        <!-- Skeleton only on the first load; reopening keeps the last list while it refreshes -->
        <div v-if="loading && !allAssets.length" class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          <div v-for="i in 8" :key="i" class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <div class="skeleton aspect-video rounded-none" />
            <div class="flex flex-col gap-1.5 px-3 py-2.5">
              <div class="skeleton h-3.5 w-2/3 rounded" />
              <div class="skeleton h-3 w-1/3 rounded" />
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="filteredAssets.length === 0"
          size="sm"
          :icon="getEmptyIcon()"
          :title="`No ${activeTab} found`"
          :description="searchQuery ? 'Try adjusting your search.' : `Upload some ${activeTab} to your library first.`"
        />

        <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          <MediaTile
            v-for="asset in filteredAssets"
            :key="asset.id"
            :title="asset.name"
            :thumbnail="asset.thumbnailUrl"
            :fit="asset.type === 'watermark' ? 'contain' : 'cover'"
            :icon="getAssetIcon(asset.type)"
            selectable
            :selected="isSelected(asset.id)"
            @open="toggleSelection(asset)"
            @toggle-select="toggleSelection(asset)"
          >
            <template v-if="asset.type === 'audio'" #overlay>
              <div class="absolute inset-0 grid place-items-center">
                <Button
                  variant="secondary"
                  size="icon"
                  class="rounded-full"
                  :title="isPlaying(asset.id) ? 'Pause preview' : 'Play preview'"
                  :aria-label="isPlaying(asset.id) ? 'Pause preview' : 'Play preview'"
                  @click.stop="toggleAudioPreview(asset)"
                >
                  <Pause v-if="isPlaying(asset.id)" />
                  <Play v-else />
                </Button>
              </div>
            </template>
            <template v-if="asset.duration" #badges>
              <MediaChip><span class="tabular">{{ formatDuration(asset.duration) }}</span></MediaChip>
            </template>
            <template v-if="asset.isOrgAsset || asset.dimensions" #meta>
              <span v-if="asset.isOrgAsset" class="flex items-center gap-1"><Building2 class="size-3" /> Org</span>
              <span v-if="asset.isOrgAsset && asset.dimensions" aria-hidden="true" class="text-fg-disabled">·</span>
              <span v-if="asset.dimensions" class="tabular">{{ asset.dimensions.width }}×{{ asset.dimensions.height }}</span>
            </template>
          </MediaTile>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="mr-auto text-xs text-fg-muted">
        <span class="tabular">{{ selectedAssets.length }}</span> selected
      </span>
      <Button variant="ghost" @click="cancel">Cancel</Button>
      <Button variant="primary" :disabled="selectedAssets.length === 0" @click="confirm">
        Add {{ selectedAssets.length }} asset{{ selectedAssets.length !== 1 ? 's' : '' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Video,
  Music,
  Image as ImageIcon,
  Droplet,
  FolderOpen,
  Play,
  Pause,
  Building2,
} from 'lucide-vue-next';
import { MediaChip, MediaTile } from '@/components/ui/media-tile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { getAllIntroOutros } from '@/services/database/intro-outros';
import { getAllAudioAssets } from '@/services/database/audio-assets';
import { getAllImageAssets } from '@/services/database/image-assets';
import { getAllWatermarkImages } from '@/services/database/watermarks';
import type { IntroOutro, WatermarkImage } from '@/services/database/types';
import type { AIVideoMediaItem } from '@/types/ai-video';

interface UnifiedAsset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'watermark';
  path: string;
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: { width: number; height: number };
  isOrgAsset: boolean;
  originalData: any;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'select', assets: AIVideoMediaItem[]): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const tabs = [
  { id: 'video', label: 'Video', icon: Video },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'watermark', label: 'Watermarks', icon: Droplet },
];

// Tabs for the SegmentedControl (with live counts)
const tabOptions = computed(() =>
  tabs.map((tab) => ({
    value: tab.id as 'video' | 'audio' | 'image' | 'watermark',
    label: tab.label,
    icon: tab.icon,
    count: getTabCount(tab.id) || undefined,
  }))
);

const loading = ref(false);
const activeTab = ref<'video' | 'audio' | 'image' | 'watermark'>('video');
const searchQuery = ref('');
const allAssets = ref<UnifiedAsset[]>([]);
const selectedAssets = ref<UnifiedAsset[]>([]);
const playingAudioId = ref<string | null>(null);
const audioElement = ref<HTMLAudioElement | null>(null);

const filteredAssets = computed(() => {
  return allAssets.value.filter(asset => {
    // Tab filter
    if (asset.type !== activeTab.value) return false;

    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const name = asset.name.toLowerCase();
      if (!name.includes(query)) return false;
    }

    return true;
  });
});

watch(() => props.modelValue, async (open) => {
  if (open) {
    await loadAssets();
  } else {
    stopAudio();
  }
});

async function loadAssets() {
  loading.value = true;
  try {
    const [introsOutros, audio, images, watermarks] = await Promise.all([
      getAllIntroOutros(),
      getAllAudioAssets(),
      getAllImageAssets(),
      getAllWatermarkImages(),
    ]);

    const unified: UnifiedAsset[] = [];

    // Intros/Outros (video)
    introsOutros.forEach((asset: IntroOutro) => {
      unified.push({
        id: asset.id,
        name: asset.name,
        type: 'video',
        path: asset.file_path,
        thumbnailUrl: asset.thumbnail_path ? `asset://localhost/${asset.thumbnail_path}` : undefined,
        duration: asset.duration || undefined,
        isOrgAsset: !!asset.organization_id,
        originalData: asset,
      });
    });

    // Audio
    audio.forEach((asset: any) => {
      unified.push({
        id: asset.id,
        name: asset.name,
        type: 'audio',
        path: asset.file_path,
        duration: asset.duration || undefined,
        isOrgAsset: !!asset.organization_id,
        originalData: asset,
      });
    });

    // Images
    images.forEach((asset: any) => {
      unified.push({
        id: asset.id,
        name: asset.name,
        type: 'image',
        path: asset.file_path,
        thumbnailUrl: `asset://localhost/${asset.file_path}`,
        dimensions: asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
        isOrgAsset: !!asset.organization_id,
        originalData: asset,
      });
    });

    // Watermarks
    watermarks.forEach((asset: WatermarkImage) => {
      unified.push({
        id: asset.id,
        name: asset.name,
        type: 'watermark',
        path: asset.file_path,
        thumbnailUrl: `asset://localhost/${asset.file_path}`,
        dimensions: asset.width && asset.height ? { width: asset.width, height: asset.height } : undefined,
        isOrgAsset: !!asset.organization_id,
        originalData: asset,
      });
    });

    allAssets.value = unified;
  } catch (error) {
    console.error('Failed to load assets:', error);
  } finally {
    loading.value = false;
  }
}

function getTabCount(tabId: string): number {
  return allAssets.value.filter(a => a.type === tabId).length;
}

function isSelected(assetId: string): boolean {
  return selectedAssets.value.some(a => a.id === assetId);
}

function toggleSelection(asset: UnifiedAsset) {
  const index = selectedAssets.value.findIndex(a => a.id === asset.id);
  if (index >= 0) {
    selectedAssets.value.splice(index, 1);
  } else {
    selectedAssets.value.push(asset);
  }
}

function toggleAudioPreview(asset: UnifiedAsset) {
  if (playingAudioId.value === asset.id) {
    stopAudio();
  } else {
    playAudio(asset);
  }
}

function playAudio(asset: UnifiedAsset) {
  stopAudio();
  
  audioElement.value = new Audio(`asset://localhost/${asset.path}`);
  audioElement.value.play();
  playingAudioId.value = asset.id;
  
  audioElement.value.onended = () => {
    playingAudioId.value = null;
  };
}

function stopAudio() {
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value = null;
  }
  playingAudioId.value = null;
}

function isPlaying(assetId: string): boolean {
  return playingAudioId.value === assetId;
}

function getAssetIcon(type: string) {
  switch (type) {
    case 'video': return Video;
    case 'audio': return Music;
    case 'image': return ImageIcon;
    case 'watermark': return Droplet;
    default: return ImageIcon;
  }
}

function getEmptyIcon() {
  return getAssetIcon(activeTab.value);
}

function cancel() {
  selectedAssets.value = [];
  stopAudio();
  isOpen.value = false;
}

function confirm() {
  const mediaItems: AIVideoMediaItem[] = selectedAssets.value.map(asset => ({
    id: asset.id,
    name: asset.name,
    type: asset.type === 'watermark' ? 'image' : asset.type,
    source: {
      type: 'asset',
      path: asset.path,
      thumbnailPath: asset.thumbnailUrl,
      duration: asset.duration,
      assetId: asset.id,
    },
    thumbnailUrl: asset.thumbnailUrl,
    duration: asset.duration,
    dimensions: asset.dimensions,
    addedAt: new Date(),
  }));

  emit('select', mediaItems);
  selectedAssets.value = [];
  stopAudio();
  isOpen.value = false;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>
