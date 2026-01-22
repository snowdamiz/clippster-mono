<template>
  <div class="media-panel">
    <!-- Upload Section -->
    <div class="media-panel__upload">
      <button class="media-panel__upload-btn" @click="handleUploadClick">
        <Upload :size="20" />
        <span>Upload Media</span>
      </button>
      <p class="media-panel__upload-hint">Videos, Images, or Audio</p>
    </div>

    <!-- Media Library -->
    <div class="media-panel__library">
      <div class="media-panel__section-header">
        <h4 class="media-panel__section-title">Media Library</h4>
        <span class="media-panel__count">{{ mediaItems.length }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="media-panel__loading">
        <div class="media-panel__spinner"></div>
        <p>Loading media...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="mediaItems.length === 0" class="media-panel__empty">
        <Film :size="48" class="media-panel__empty-icon" />
        <p class="media-panel__empty-text">No media uploaded yet</p>
        <p class="media-panel__empty-hint">Upload videos, images, or audio to get started</p>
      </div>

      <!-- Media Grid -->
      <div v-else class="media-panel__grid">
        <div
          v-for="item in mediaItems"
          :key="item.id"
          class="media-item"
          :class="`media-item--${item.media_type}`"
          @click="addToTimeline(item)"
          :title="`Click to add to timeline`"
        >
          <!-- Thumbnail/Preview -->
          <div class="media-item__preview" :class="`media-item__preview--${item.media_type}`">
            <img
              v-if="item.media_type === 'image' && item.thumbnail_path"
              :src="convertFileSrc(item.thumbnail_path)"
              :alt="item.file_name"
              class="media-item__thumbnail"
            />
            <div v-else-if="item.media_type === 'video'" class="media-item__video-preview">
              <Video :size="28" />
            </div>
            <div v-else-if="item.media_type === 'audio'" class="media-item__audio-preview">
              <div class="media-item__audio-icon">
                <Music :size="20" />
              </div>
              <div class="media-item__waveform">
                <div class="media-item__waveform-bar" style="height: 40%"></div>
                <div class="media-item__waveform-bar" style="height: 70%"></div>
                <div class="media-item__waveform-bar" style="height: 50%"></div>
                <div class="media-item__waveform-bar" style="height: 85%"></div>
                <div class="media-item__waveform-bar" style="height: 60%"></div>
                <div class="media-item__waveform-bar" style="height: 75%"></div>
                <div class="media-item__waveform-bar" style="height: 45%"></div>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="media-item__info">
            <p class="media-item__name" :title="item.file_name">{{ item.file_name }}</p>
            <div class="media-item__meta">
              <span class="media-item__type" :class="`media-item__type--${item.media_type}`">{{ item.media_type }}</span>
              <span v-if="item.duration" class="media-item__duration">{{ formatDuration(item.duration) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="media-item__actions">
            <button
              class="media-item__action-btn"
              @click.stop="deleteMedia(item.id)"
              title="Delete"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Upload, Film, Video, Music, Trash2 } from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  addProjectMedia,
  getProjectMedia,
  deleteProjectMedia,
  type ProjectMedia,
} from '@/services/database/project-media';

const props = defineProps<{
  editId: string | null;
  projectId: string | null;
}>();

const emit = defineEmits<{
  (e: 'mediaAdded', mediaId: string): void;
  (e: 'mediaUpdated'): void;
}>();

const mediaItems = ref<ProjectMedia[]>([]);
const loading = ref(false);

onMounted(async () => {
  await loadMedia();
});

async function loadMedia() {
  if (!props.projectId) return;
  
  loading.value = true;
  try {
    mediaItems.value = await getProjectMedia(props.projectId);
  } catch (error) {
    console.error('[MediaPanel] Failed to load media:', error);
  } finally {
    loading.value = false;
  }
}

async function handleUploadClick() {
  if (!props.projectId) {
    console.error('[MediaPanel] No project ID');
    return;
  }

  try {
    // Open file dialog for media files
    const selected = await open({
      multiple: true,
      filters: [{
        name: 'Media Files',
        extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
      }]
    });

    if (!selected) return;

    loading.value = true;

    const filePaths = Array.isArray(selected) ? selected : [selected];

    for (const filePath of filePaths) {
      const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const mediaType = getMediaTypeFromExtension(extension);
      
      await addProjectMedia(props.projectId, {
        mediaType,
        filePath,
        fileName,
      });
    }

    await loadMedia();
    emit('mediaUpdated');
  } catch (error) {
    console.error('[MediaPanel] Failed to upload files:', error);
  } finally {
    loading.value = false;
  }
}

function getMediaTypeFromExtension(extension: string): 'video' | 'image' | 'audio' {
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  
  if (videoExts.includes(extension)) return 'video';
  if (audioExts.includes(extension)) return 'audio';
  if (imageExts.includes(extension)) return 'image';
  return 'video'; // Default fallback
}

async function addToTimeline(item: ProjectMedia) {
  if (!props.editId || !props.projectId) {
    console.error('[MediaPanel] No edit ID or project ID');
    return;
  }

  console.log('[MediaPanel] Adding media to timeline:', item);

  // For audio files, create an audio track
  if (item.media_type === 'audio') {
    try {
      // Get actual audio duration from the file
      const audioUrl = convertFileSrc(item.file_path);
      const audio = new Audio(audioUrl);
      
      // Wait for metadata to load to get duration
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => resolve());
        audio.addEventListener('error', () => reject(new Error('Failed to load audio')));
      });
      
      const audioDuration = audio.duration;
      console.log('[MediaPanel] Audio duration:', audioDuration, 'seconds');
      
      const { createVideoEditorAudioTrack } = await import('@/services/database/video-editor-edits');
      const { updateProjectMedia } = await import('@/services/database/project-media');
      const { getVideoEditorProjectWithSources, updateVideoEditorProject } = await import('@/services/database/video-editor-projects');
      
      // Update the media item with the actual duration
      await updateProjectMedia(item.id, { duration: audioDuration });
      
      // Create audio track with full duration
      await createVideoEditorAudioTrack(props.editId, {
        file_path: item.file_path,
        name: item.file_name,
        start_time: 0,
        end_time: audioDuration,
        volume: 1.0,
        pan: 0,
        fade_in: 0,
        fade_out: 0,
        track_order: 0,
        is_muted: 0,
        is_solo: 0,
      });
      
      // Extend project duration if audio is longer
      const project = await getVideoEditorProjectWithSources(props.projectId);
      if (project && audioDuration > project.total_duration) {
        await updateVideoEditorProject(props.projectId, {
          total_duration: audioDuration,
        });
        console.log('[MediaPanel] Extended project duration to', audioDuration, 'seconds');
      }

      emit('mediaAdded', item.id);
      console.log('[MediaPanel] Audio track created successfully with duration:', audioDuration);
    } catch (error) {
      console.error('[MediaPanel] Failed to create audio track:', error);
    }
  } else {
    // For video/image, emit event for future implementation
    emit('mediaAdded', item.id);
    console.log('[MediaPanel] Video/Image timeline integration coming soon');
  }
}

async function deleteMedia(mediaId: string) {
  if (!confirm('Delete this media item?')) return;

  try {
    await deleteProjectMedia(mediaId);
    await loadMedia();
    emit('mediaUpdated');
  } catch (error) {
    console.error('[MediaPanel] Failed to delete media:', error);
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.media-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
}

.media-panel__upload {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.media-panel__upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(14, 165, 233, 0.25));
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 8px;
  color: var(--editor-accent);
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 150ms ease;
}

.media-panel__upload-btn:hover {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(14, 165, 233, 0.35));
  border-color: rgba(14, 165, 233, 0.5);
  transform: translateY(-1px);
}

.media-panel__upload-hint {
  font-size: 0.75rem;
  color: var(--editor-text-muted);
  text-align: center;
  margin: 0;
}

.media-panel__library {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

.media-panel__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.media-panel__section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--editor-text);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.media-panel__count {
  font-size: 0.75rem;
  color: var(--editor-text-muted);
  background-color: rgba(255, 255, 255, 0.05);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.media-panel__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem 1rem;
  color: var(--editor-text-muted);
  font-size: 0.875rem;
}

.media-panel__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(14, 165, 233, 0.2);
  border-top-color: var(--editor-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.media-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.media-panel__empty-icon {
  color: var(--editor-text-muted);
  opacity: 0.5;
}

.media-panel__empty-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--editor-text);
  margin: 0;
}

.media-panel__empty-hint {
  font-size: 0.75rem;
  color: var(--editor-text-muted);
  margin: 0;
}

.media-panel__grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
}

.media-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.media-item:hover {
  background-color: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.3);
  transform: translateX(2px);
}

.media-item__preview {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.media-item__preview--audio {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 139, 250, 0.2));
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.media-item__preview--video {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(59, 130, 246, 0.2));
  border: 1px solid rgba(14, 165, 233, 0.3);
}

.media-item__preview--image {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(52, 211, 153, 0.2));
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.media-item__thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-item__video-preview {
  color: rgba(14, 165, 233, 0.8);
}

.media-item__audio-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  height: 100%;
  padding: 0.5rem;
}

.media-item__audio-icon {
  color: rgba(139, 92, 246, 0.9);
}

.media-item__waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  height: 12px;
  width: 100%;
}

.media-item__waveform-bar {
  width: 2px;
  background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
  border-radius: 1px;
  animation: waveform-pulse 1.5s ease-in-out infinite;
}

.media-item__waveform-bar:nth-child(1) { animation-delay: 0s; }
.media-item__waveform-bar:nth-child(2) { animation-delay: 0.1s; }
.media-item__waveform-bar:nth-child(3) { animation-delay: 0.2s; }
.media-item__waveform-bar:nth-child(4) { animation-delay: 0.3s; }
.media-item__waveform-bar:nth-child(5) { animation-delay: 0.4s; }
.media-item__waveform-bar:nth-child(6) { animation-delay: 0.5s; }
.media-item__waveform-bar:nth-child(7) { animation-delay: 0.6s; }

@keyframes waveform-pulse {
  0%, 100% { opacity: 0.6; transform: scaleY(1); }
  50% { opacity: 1; transform: scaleY(1.2); }
}

.media-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.media-item__name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--editor-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-item__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  color: var(--editor-text-muted);
}

.media-item__type {
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.625rem;
}

.media-item__type--audio {
  background-color: rgba(139, 92, 246, 0.2);
  color: rgba(168, 139, 250, 1);
}

.media-item__type--video {
  background-color: rgba(14, 165, 233, 0.2);
  color: rgba(59, 130, 246, 1);
}

.media-item__type--image {
  background-color: rgba(16, 185, 129, 0.2);
  color: rgba(52, 211, 153, 1);
}

.media-item__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 150ms ease;
}

.media-item:hover .media-item__actions {
  opacity: 1;
}

.media-item__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--editor-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.media-item__action-btn:hover {
  background-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
</style>
