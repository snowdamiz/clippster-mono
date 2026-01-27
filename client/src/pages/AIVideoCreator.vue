<template>
  <div class="ai-video-creator">
    <!-- Left Sidebar: Media Library + Prompt -->
    <div class="ai-video-creator__sidebar">
      <div class="ai-video-creator__sidebar-header">
        <h2 class="ai-video-creator__sidebar-title">AI Video Creator</h2>
        <span class="ai-video-creator__badge">Beta</span>
      </div>

      <!-- Media Library -->
      <div class="ai-video-creator__media-section">
        <div class="ai-video-creator__section-header">
          <h3 class="ai-video-creator__section-title">Media Library</h3>
          <button
            @click="handleUpload"
            class="ai-video-creator__btn ai-video-creator__btn--sm"
            title="Upload media"
          >
            <Plus class="ai-video-creator__icon" />
          </button>
        </div>

        <div v-if="mediaItems.length === 0" class="ai-video-creator__empty-state">
          <Upload class="ai-video-creator__empty-icon" />
          <p class="ai-video-creator__empty-text">No media added yet</p>
          <button @click="handleUpload" class="ai-video-creator__btn ai-video-creator__btn--secondary">
            Upload Files
          </button>
          <button @click="openAssetPicker" class="ai-video-creator__btn ai-video-creator__btn--secondary">
            From Assets
          </button>
          <button @click="openClipPicker" class="ai-video-creator__btn ai-video-creator__btn--secondary">
            From Clips
          </button>
        </div>

        <div v-else class="ai-video-creator__media-list">
          <div
            v-for="item in mediaItems"
            :key="item.id"
            class="ai-video-creator__media-item"
          >
            <div class="ai-video-creator__media-thumbnail">
              <img
                v-if="item.thumbnailUrl"
                :src="item.thumbnailUrl"
                :alt="item.name"
                class="ai-video-creator__media-img"
              />
              <div v-else class="ai-video-creator__media-placeholder">
                <component :is="getMediaIcon(item.type)" class="ai-video-creator__media-placeholder-icon" />
              </div>
            </div>
            <div class="ai-video-creator__media-info">
              <p class="ai-video-creator__media-name">{{ item.name }}</p>
              <p class="ai-video-creator__media-meta">
                {{ item.type }} • {{ formatDuration(item.duration) }}
              </p>
            </div>
            <button
              @click="removeMedia(item.id)"
              class="ai-video-creator__media-remove"
              title="Remove"
            >
              <X class="ai-video-creator__icon" />
            </button>
          </div>
        </div>
      </div>

      <!-- Prompt Section -->
      <div class="ai-video-creator__prompt-section">
        <h3 class="ai-video-creator__section-title">Prompt</h3>
        <textarea
          v-model="prompt"
          placeholder="Describe the video you want to create..."
          class="ai-video-creator__prompt-input"
          rows="4"
        />
        <button
          @click="handleGenerate"
          :disabled="isGenerating || mediaItems.length === 0 || !prompt.trim()"
          class="ai-video-creator__btn ai-video-creator__btn--primary"
        >
          <Wand2 v-if="!isGenerating" class="ai-video-creator__icon" />
          <Loader2 v-else class="ai-video-creator__icon ai-video-creator__icon--spin" />
          {{ isGenerating ? 'Generating...' : 'Generate Video' }}
        </button>
      </div>
    </div>

    <!-- Center: Preview -->
    <div class="ai-video-creator__preview">
      <div class="ai-video-creator__preview-container">
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
      <div class="ai-video-creator__controls">
        <button
          @click="togglePlayback"
          class="ai-video-creator__control-btn"
          :disabled="!composition"
        >
          <Play v-if="!isPlaying" class="ai-video-creator__icon" />
          <Pause v-else class="ai-video-creator__icon" />
        </button>

        <div class="ai-video-creator__timeline">
          <input
            type="range"
            v-model.number="currentTime"
            :min="0"
            :max="duration"
            :step="0.01"
            class="ai-video-creator__timeline-slider"
            :disabled="!composition"
          />
        </div>

        <span class="ai-video-creator__time">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </span>

        <button
          @click="openExport"
          :disabled="!composition"
          class="ai-video-creator__btn ai-video-creator__btn--primary ai-video-creator__export-btn"
          title="Export video"
        >
          <Download class="ai-video-creator__icon" />
          Export
        </button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Wand2, Plus, Upload, X, Play, Pause, SkipBack, SkipForward, Video, Music, Image as ImageIcon, Loader2, Download } from 'lucide-vue-next';
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
.ai-video-creator {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: 100vh;
  background: hsl(var(--background));
  overflow: hidden;
}

.ai-video-creator__sidebar {
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
  overflow-y: auto;
}

.ai-video-creator__sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  border-bottom: 1px solid hsl(var(--border));
}

.ai-video-creator__sidebar-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 0;
}

.ai-video-creator__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background: rgba(14, 165, 233, 0.15);
  color: #0ea5e9;
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.ai-video-creator__media-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-bottom: 1px solid hsl(var(--border));
  min-height: 0;
}

.ai-video-creator__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.ai-video-creator__section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 0;
}

.ai-video-creator__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}

.ai-video-creator__empty-icon {
  width: 48px;
  height: 48px;
  color: hsl(var(--muted-foreground));
}

.ai-video-creator__empty-text {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.ai-video-creator__media-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  min-height: 0;
}

.ai-video-creator__media-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition: all 150ms ease;
}

.ai-video-creator__media-item:hover {
  border-color: rgba(14, 165, 233, 0.3);
}

.ai-video-creator__media-thumbnail {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: hsl(var(--muted));
}

.ai-video-creator__media-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ai-video-creator__media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-video-creator__media-placeholder-icon {
  width: 24px;
  height: 24px;
  color: hsl(var(--muted-foreground));
}

.ai-video-creator__media-info {
  flex: 1;
  min-width: 0;
}

.ai-video-creator__media-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-video-creator__media-meta {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin: 0;
}

.ai-video-creator__media-remove {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  border-radius: 4px;
  transition: all 150ms ease;
}

.ai-video-creator__media-remove:hover {
  background: hsl(var(--destructive));
  color: white;
}

.ai-video-creator__prompt-section {
  padding: 1rem;
}

.ai-video-creator__prompt-input {
  width: 100%;
  padding: 0.75rem;
  background: hsl(var(--input));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 0.75rem;
  transition: all 150ms ease;
}

.ai-video-creator__prompt-input:focus {
  outline: none;
  border-color: rgba(14, 165, 233, 0.5);
  box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
}

.ai-video-creator__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  width: 100%;
}

.ai-video-creator__btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
}

.ai-video-creator__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-video-creator__btn--primary {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
}

.ai-video-creator__btn--secondary {
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
}

.ai-video-creator__btn--secondary:hover:not(:disabled) {
  background: hsl(var(--accent));
  border-color: rgba(14, 165, 233, 0.3);
}

.ai-video-creator__btn--sm {
  padding: 0.375rem;
  width: auto;
}

.ai-video-creator__icon {
  width: 16px;
  height: 16px;
}

.ai-video-creator__icon--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-video-creator__preview {
  display: flex;
  flex-direction: column;
  background: #0a0a0b;
}

.ai-video-creator__preview-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  min-height: 0;
}

.ai-video-creator__controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.ai-video-creator__control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all 150ms ease;
}

.ai-video-creator__control-btn:hover:not(:disabled) {
  background: hsl(var(--accent));
  border-color: rgba(14, 165, 233, 0.3);
}

.ai-video-creator__control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-video-creator__timeline {
  flex: 1;
}

.ai-video-creator__timeline-slider {
  width: 100%;
  height: 6px;
  background: hsl(var(--secondary));
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.ai-video-creator__timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #0ea5e9;
  border-radius: 50%;
  cursor: pointer;
}

.ai-video-creator__timeline-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #0ea5e9;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.ai-video-creator__time {
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
  min-width: 100px;
  text-align: right;
}
</style>
