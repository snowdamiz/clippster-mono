<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="asset-picker">
      <DialogHeader>
        <DialogTitle>Select Assets</DialogTitle>
        <DialogDescription>
          Choose assets from your library to use in your AI video.
        </DialogDescription>
      </DialogHeader>

      <div class="asset-picker__content">
        <!-- Tabs -->
        <div class="asset-picker__tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id as any"
            class="asset-picker__tab"
            :class="{ 'asset-picker__tab--active': activeTab === tab.id }"
          >
            <component :is="tab.icon" class="asset-picker__tab-icon" />
            {{ tab.label }}
            <span v-if="getTabCount(tab.id) > 0" class="asset-picker__tab-count">
              {{ getTabCount(tab.id) }}
            </span>
          </button>
        </div>

        <!-- Search -->
        <div class="asset-picker__search">
          <Search class="asset-picker__search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search assets..."
            class="asset-picker__search-input"
          />
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="asset-picker__loading">
          <Loader2 class="asset-picker__loading-icon" />
          <p>Loading assets...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredAssets.length === 0" class="asset-picker__empty">
          <component :is="getEmptyIcon()" class="asset-picker__empty-icon" />
          <p class="asset-picker__empty-text">No {{ activeTab }} found</p>
          <p class="asset-picker__empty-hint">
            {{ searchQuery ? 'Try adjusting your search' : `Upload some ${activeTab} to your library first` }}
          </p>
        </div>

        <!-- Assets Grid -->
        <div v-else class="asset-picker__grid">
          <div
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="asset-picker__card"
            :class="{ 'asset-picker__card--selected': isSelected(asset.id) }"
            @click="toggleSelection(asset)"
          >
            <!-- Selection Checkbox -->
            <div class="asset-picker__checkbox">
              <Check v-if="isSelected(asset.id)" class="asset-picker__checkbox-icon" />
            </div>

            <!-- Thumbnail/Preview -->
            <div class="asset-picker__thumbnail">
              <img
                v-if="asset.thumbnailUrl"
                :src="asset.thumbnailUrl"
                :alt="asset.name"
                class="asset-picker__thumbnail-img"
              />
              <div v-else class="asset-picker__thumbnail-placeholder">
                <component :is="getAssetIcon(asset.type)" class="asset-picker__thumbnail-icon" />
              </div>

              <!-- Play button for audio -->
              <button
                v-if="asset.type === 'audio'"
                @click.stop="toggleAudioPreview(asset)"
                class="asset-picker__play-btn"
              >
                <Play v-if="!isPlaying(asset.id)" class="asset-picker__play-icon" />
                <Pause v-else class="asset-picker__play-icon" />
              </button>

              <!-- Duration badge -->
              <span v-if="asset.duration" class="asset-picker__duration">
                {{ formatDuration(asset.duration) }}
              </span>
            </div>

            <!-- Info -->
            <div class="asset-picker__info">
              <h4 class="asset-picker__name">{{ asset.name }}</h4>
              <div class="asset-picker__meta">
                <span v-if="asset.isOrgAsset" class="asset-picker__org-badge">
                  <Building2 class="asset-picker__org-icon" />
                  Org
                </span>
                <span v-if="asset.dimensions">
                  {{ asset.dimensions.width }}×{{ asset.dimensions.height }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="cancel">Cancel</Button>
        <Button @click="confirm" :disabled="selectedAssets.length === 0">
          Add {{ selectedAssets.length }} Asset{{ selectedAssets.length !== 1 ? 's' : '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
  Search, 
  Video, 
  Music, 
  Image as ImageIcon, 
  Droplet,
  Check, 
  Loader2,
  Play,
  Pause,
  Building2,
} from 'lucide-vue-next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

<style scoped>
.asset-picker__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 60vh;
  overflow: hidden;
}

.asset-picker__tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.asset-picker__tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--muted-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.asset-picker__tab:hover {
  background: var(--accent);
  color: var(--foreground);
}

.asset-picker__tab--active {
  background: var(--secondary);
  color: var(--foreground);
  border: 1px solid var(--border);
}

.asset-picker__tab-icon {
  width: 16px;
  height: 16px;
}

.asset-picker__tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 0.375rem;
  background: var(--sidebar-active);
  color: var(--sidebar-accent);
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.asset-picker__search {
  position: relative;
}

.asset-picker__search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.asset-picker__search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.875rem;
}

.asset-picker__search-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 3px var(--sidebar-active);
}

.asset-picker__loading,
.asset-picker__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.asset-picker__loading-icon {
  width: 48px;
  height: 48px;
  color: var(--muted-foreground);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.asset-picker__empty-icon {
  width: 48px;
  height: 48px;
  color: var(--muted-foreground);
}

.asset-picker__empty-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--foreground);
  margin: 0;
}

.asset-picker__empty-hint {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.asset-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  overflow-y: auto;
  padding: 0.5rem;
}

.asset-picker__card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms ease;
}

.asset-picker__card:hover {
  border-color: var(--sidebar-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.asset-picker__card--selected {
  border-color: var(--sidebar-accent);
  background: var(--sidebar-active);
}

.asset-picker__checkbox {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 150ms ease;
}

.asset-picker__card--selected .asset-picker__checkbox {
  background: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
}

.asset-picker__checkbox-icon {
  width: 16px;
  height: 16px;
  color: white;
}

.asset-picker__thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--muted);
  overflow: hidden;
}

.asset-picker__thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-picker__thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-picker__thumbnail-icon {
  width: 48px;
  height: 48px;
  color: var(--muted-foreground);
}

.asset-picker__play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  background: rgba(0, 0, 0, 0.8);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
  z-index: 1;
}

.asset-picker__play-btn:hover {
  background: var(--sidebar-accent);
  transform: translate(-50%, -50%) scale(1.1);
}

.asset-picker__play-icon {
  width: 24px;
  height: 24px;
}

.asset-picker__duration {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 6px;
  font-size: 0.75rem;
  color: white;
  font-variant-numeric: tabular-nums;
}

.asset-picker__info {
  padding: 0.75rem;
}

.asset-picker__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-picker__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.asset-picker__org-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  background: var(--sidebar-active);
  color: var(--sidebar-accent);
  border-radius: 4px;
  font-weight: 500;
}

.asset-picker__org-icon {
  width: 12px;
  height: 12px;
}
</style>
