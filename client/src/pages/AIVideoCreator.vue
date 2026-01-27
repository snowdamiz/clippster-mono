<template>
  <PageLayout
    title="AI Video Creator"
    description="Create AI-powered video compositions"
    :show-header="true"
    :icon="Wand2"
  >
    <template #badge>
      <span class="ai-video__badge">Beta</span>
    </template>

    <template #actions>
      <button
        v-if="composition"
        @click="openExport"
        class="ai-video__export-btn"
      >
        <Download class="ai-video__export-icon" />
        Export
      </button>
    </template>

    <div class="ai-video">
      <!-- Left Sidebar: Media Library + Prompt -->
      <div class="ai-video__sidebar">
        <!-- Media Library -->
        <div class="ai-video__section">
          <div class="ai-video__section-header">
            <h3 class="ai-video__section-title">Media Library</h3>
            <button
              @click="handleUpload"
              class="ai-video__add-btn"
              title="Upload media"
            >
              <Plus :size="16" />
            </button>
          </div>

          <div v-if="mediaItems.length === 0" class="ai-video__empty">
            <Upload class="ai-video__empty-icon" />
            <p class="ai-video__empty-text">No media added yet</p>
            <div class="ai-video__empty-actions">
              <button @click="handleUpload" class="ai-video__empty-btn">
                <Upload :size="16" />
                Upload Files
              </button>
              <button @click="openAssetPicker" class="ai-video__empty-btn">
                <ImageIcon :size="16" />
                From Assets
              </button>
              <button @click="openClipPicker" class="ai-video__empty-btn">
                <Video :size="16" />
                From Clips
              </button>
            </div>
          </div>

          <div v-else class="ai-video__media-list">
            <div
              v-for="item in mediaItems"
              :key="item.id"
              class="ai-video__media-item"
            >
              <div class="ai-video__media-thumb">
                <img
                  v-if="item.thumbnailUrl"
                  :src="item.thumbnailUrl"
                  :alt="item.name"
                />
                <div v-else class="ai-video__media-placeholder">
                  <component :is="getMediaIcon(item.type)" :size="20" />
                </div>
              </div>
              <div class="ai-video__media-info">
                <p class="ai-video__media-name">{{ item.name }}</p>
                <p class="ai-video__media-meta">
                  {{ item.type }} • {{ formatDuration(item.duration) }}
                </p>
              </div>
              <button
                @click="removeMedia(item.id)"
                class="ai-video__media-remove"
                title="Remove"
              >
                <X :size="16" />
              </button>
            </div>
          </div>
        </div>

        <!-- Prompt Section -->
        <div class="ai-video__section ai-video__section--prompt">
          <h3 class="ai-video__section-title">Prompt</h3>
          <textarea
            v-model="prompt"
            placeholder="Describe the video you want to create..."
            class="ai-video__prompt"
            rows="4"
          />
          <button
            @click="handleGenerate"
            :disabled="isGenerating || mediaItems.length === 0 || !prompt.trim()"
            class="ai-video__generate-btn"
          >
            <Wand2 v-if="!isGenerating" :size="16" />
            <Loader2 v-else :size="16" class="ai-video__spinner" />
            {{ isGenerating ? 'Generating...' : 'Generate Video' }}
          </button>
        </div>
      </div>

      <!-- Center: Preview -->
      <div class="ai-video__main">
        <div class="ai-video__preview">
          <RemotionPlayerMount
            :composition="composition"
            :current-time="currentTime"
            :is-playing="isPlaying"
            @time-update="handleTimeUpdate"
            @duration-change="handleDurationChange"
            @playing-change="handlePlayingChange"
          />
        </div>

        <!-- Playback Controls -->
        <div class="ai-video__controls">
          <button
            @click="togglePlayback"
            class="ai-video__control-btn"
            :disabled="!composition"
          >
            <Play v-if="!isPlaying" :size="20" />
            <Pause v-else :size="20" />
          </button>

          <div class="ai-video__timeline">
            <input
              type="range"
              v-model.number="currentTime"
              :min="0"
              :max="duration"
              :step="0.01"
              class="ai-video__timeline-slider"
              :disabled="!composition"
            />
          </div>

          <span class="ai-video__time">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Dialogs -->
    <ClipPickerDialog
      v-model="showClipPicker"
      @select="handleClipsSelected"
    />
    <AssetPickerDialog
      v-model="showAssetPicker"
      @select="handleAssetsSelected"
    />
    <ExportDialog
      v-model="showExportDialog"
      :composition="composition"
    />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Wand2, Plus, Upload, X, Play, Pause, Video, Music, Image as ImageIcon, Loader2, Download } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import RemotionPlayerMount from '@/components/ai-video/RemotionPlayerMount.vue';
import ClipPickerDialog from '@/components/ai-video/pickers/ClipPickerDialog.vue';
import AssetPickerDialog from '@/components/ai-video/pickers/AssetPickerDialog.vue';
import ExportDialog from '@/components/ai-video/ExportDialog.vue';
import { useAIVideoGeneration } from '@/composables/useAIVideoGeneration';
import type { AIVideoComposition, AIVideoMediaItem } from '@/types/ai-video';

// Media library state
const mediaItems = ref<AIVideoMediaItem[]>([]);
const prompt = ref('');

// Dialog state
const showClipPicker = ref(false);
const showAssetPicker = ref(false);
const showExportDialog = ref(false);

// AI generation
const { isGenerating, composition, generate } = useAIVideoGeneration();

// Playback state
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);

function togglePlayback() {
  isPlaying.value = !isPlaying.value;
}

function handleTimeUpdate(time: number) {
  currentTime.value = time;
}

function handleDurationChange(dur: number) {
  duration.value = dur;
}

function handlePlayingChange(playing: boolean) {
  isPlaying.value = playing;
}

async function handleGenerate() {
  try {
    await generate(prompt.value, mediaItems.value, {
      aspectRatio: '16:9',
      duration: 30,
    });
  } catch (error) {
    console.error('Failed to generate video:', error);
  }
}

async function handleUpload() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    
    const files = await open({
      multiple: true,
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac']
        }
      ]
    });
    
    if (!files) return;
    
    const fileArray = Array.isArray(files) ? files : [files];
    
    for (const filePath of fileArray) {
      try {
        await processUploadedFile(filePath, invoke);
      } catch (error) {
        console.error(`Failed to process file ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to upload files:', error);
  }
}

async function processUploadedFile(filePath: string, invoke: any) {
  // Get file info
  const fileInfo = await invoke<{ name: string; size: number; extension: string }>('get_file_info', { path: filePath });
  
  // Validate file size
  const maxSizes = {
    video: 2 * 1024 * 1024 * 1024, // 2GB
    image: 50 * 1024 * 1024, // 50MB
    audio: 100 * 1024 * 1024, // 100MB
  };
  
  const fileType = getFileType(fileInfo.extension);
  const maxSize = maxSizes[fileType];
  
  if (fileInfo.size > maxSize) {
    console.error(`File too large: ${fileInfo.name}. Maximum size for ${fileType}: ${formatBytes(maxSize)}`);
    return;
  }
  
  // Extract metadata
  let metadata: any = {};
  let thumbnailPath: string | undefined;
  
  if (fileType === 'video' || fileType === 'audio') {
    try {
      metadata = await invoke<any>('get_media_metadata', { path: filePath });
    } catch (error) {
      console.error('Failed to extract media metadata:', error);
    }
  }
  
  if (fileType === 'image') {
    try {
      metadata = await invoke<any>('get_image_metadata', { path: filePath });
    } catch (error) {
      console.error('Failed to extract image metadata:', error);
    }
  }
  
  // Generate thumbnail for videos
  if (fileType === 'video') {
    try {
      thumbnailPath = await invoke<string>('generate_video_thumbnail', {
        videoPath: filePath,
        timestamp: 0
      });
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    }
  }
  
  // Add to media library
  const mediaItem: AIVideoMediaItem = {
    id: `local-${Date.now()}-${Math.random()}`,
    name: fileInfo.name,
    type: fileType,
    source: {
      type: 'local',
      path: filePath,
    },
    thumbnailUrl: thumbnailPath ? `asset://localhost/${thumbnailPath}` : undefined,
    duration: metadata.duration,
    dimensions: metadata.width && metadata.height 
      ? { width: metadata.width, height: metadata.height }
      : undefined,
    addedAt: new Date(),
  };
  
  mediaItems.value.push(mediaItem);
}

function getFileType(extension: string): 'video' | 'audio' | 'image' {
  const videoExts = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  
  const ext = extension.toLowerCase();
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return 'image';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function openAssetPicker() {
  showAssetPicker.value = true;
}

function openClipPicker() {
  showClipPicker.value = true;
}

function handleClipsSelected(clips: any[]) {
  // Convert ImportedClipData to AIVideoMediaItem
  const mediaItemsFromClips: AIVideoMediaItem[] = clips.map(clip => ({
    id: clip.clipId,
    name: clip.clipName,
    type: 'video' as const,
    source: {
      type: 'clip',
      clipId: clip.clipId,
      path: clip.builtFilePath || '',
    },
    thumbnailUrl: clip.thumbnailPath ? `asset://localhost/${clip.thumbnailPath}` : undefined,
    duration: clip.duration,
    addedAt: new Date(),
  }));
  mediaItems.value.push(...mediaItemsFromClips);
}

function handleAssetsSelected(assets: AIVideoMediaItem[]) {
  mediaItems.value.push(...assets);
}

function openExport() {
  if (composition.value) {
    showExportDialog.value = true;
  }
}

function removeMedia(id: string) {
  mediaItems.value = mediaItems.value.filter(item => item.id !== id);
}

function getMediaIcon(type: string) {
  switch (type) {
    case 'video': return Video;
    case 'audio': return Music;
    case 'image': return Image;
    default: return Video;
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.ai-video {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.5rem;
  height: 100%;
  padding: 1.5rem;
}

.ai-video__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ai-video__export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #0ea5e9;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.ai-video__export-btn:hover {
  background: #0284c7;
}

.ai-video__export-icon {
  width: 16px;
  height: 16px;
}

.ai-video__sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.ai-video__section {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 1rem;
}

.ai-video__section--prompt {
  margin-top: auto;
}

.ai-video__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.ai-video__section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 0;
}

.ai-video__add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all 0.15s;
}

.ai-video__add-btn:hover {
  background: hsl(var(--accent));
  border-color: hsl(var(--accent));
}

.ai-video__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
  text-align: center;
}

.ai-video__empty-icon {
  width: 40px;
  height: 40px;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}

.ai-video__empty-text {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.ai-video__empty-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.ai-video__empty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-video__empty-btn:hover {
  background: hsl(var(--accent));
  border-color: hsl(var(--accent));
}

.ai-video__media-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.ai-video__media-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  background: hsl(var(--secondary) / 0.5);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  transition: all 0.15s;
}

.ai-video__media-item:hover {
  background: hsl(var(--secondary));
  border-color: hsl(var(--accent));
}

.ai-video__media-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: hsl(var(--muted));
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-video__media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ai-video__media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-video__media-placeholder {
  color: hsl(var(--muted-foreground));
}

.ai-video__media-info {
  flex: 1;
  min-width: 0;
}

.ai-video__media-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-video__media-meta {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
  text-transform: capitalize;
}

.ai-video__media-remove {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.ai-video__media-remove:hover {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

.ai-video__prompt {
  width: 100%;
  padding: 0.75rem;
  background: hsl(var(--input));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 0.75rem;
  transition: all 0.15s;
}

.ai-video__prompt:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.ai-video__prompt::placeholder {
  color: hsl(var(--muted-foreground));
}

.ai-video__generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #0ea5e9;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
}

.ai-video__generate-btn:hover:not(:disabled) {
  background: #0284c7;
}

.ai-video__generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-video__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-video__main {
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  overflow: hidden;
}

.ai-video__preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  min-height: 0;
  position: relative;
}

.ai-video__controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.ai-video__control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.ai-video__control-btn:hover:not(:disabled) {
  background: hsl(var(--accent));
  border-color: hsl(var(--ring));
}

.ai-video__control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-video__timeline {
  flex: 1;
  min-width: 0;
}

.ai-video__timeline-slider {
  width: 100%;
  height: 4px;
  background: hsl(var(--secondary));
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.ai-video__timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #0ea5e9;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-video__timeline-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.ai-video__timeline-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #0ea5e9;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s;
}

.ai-video__timeline-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
}

.ai-video__timeline-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-video__time {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 80px;
  text-align: right;
}
</style>
