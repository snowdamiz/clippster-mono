<template>
  <div class="flex flex-col gap-6 h-full">
    <!-- Upload Section -->
    <div class="flex flex-col gap-2">
      <button
        class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm cursor-pointer transition-all duration-150 hover:bg-[linear-gradient(135deg,rgba(14,165,233,0.25),rgba(14,165,233,0.35))] hover:border-[rgba(14,165,233,0.5)] hover:-translate-y-px"
        style="
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(14, 165, 233, 0.25));
          border: 1px solid rgba(14, 165, 233, 0.3);
          color: var(--editor-accent);
        "
        @click="handleUploadClick"
      >
        <Upload :size="20" />
        <span>Upload Media</span>
      </button>
      <p class="text-xs text-center" style="color: var(--editor-text-muted)">Videos, Images, or Audio</p>
    </div>

    <!-- Media Library -->
    <div class="flex flex-col gap-4 flex-1 min-h-0">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold uppercase tracking-wider m-0" style="color: var(--editor-text)">
          Media Library
        </h4>
        <span
          class="text-xs px-2 py-1 rounded"
          style="color: var(--editor-text-muted); background-color: rgba(255, 255, 255, 0.05)"
        >
          {{ mediaItems.length }}
        </span>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading"
        class="flex flex-col items-center justify-center gap-4 py-12 px-4 text-sm"
        style="color: var(--editor-text-muted)"
      >
        <div
          class="w-8 h-8 rounded-full animate-spin"
          style="border: 3px solid rgba(14, 165, 233, 0.2); border-top-color: var(--editor-accent)"
        ></div>
        <p>Loading media...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="mediaItems.length === 0"
        class="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center"
      >
        <Film :size="48" class="opacity-50" style="color: var(--editor-text-muted)" />
        <p class="text-sm font-medium m-0" style="color: var(--editor-text)">No media uploaded yet</p>
        <p class="text-xs m-0" style="color: var(--editor-text-muted)">
          Upload videos, images, or audio to get started
        </p>
      </div>

      <!-- Media Grid -->
      <div v-else class="flex flex-col gap-2 overflow-y-auto">
        <div
          v-for="item in mediaItems"
          :key="item.id"
          class="group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 hover:bg-[rgba(14,165,233,0.1)] hover:border-[rgba(14,165,233,0.3)] hover:translate-x-0.5"
          style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05)"
          :class="{
            'hover:!bg-[rgba(139,92,246,0.1)] hover:!border-[rgba(139,92,246,0.3)]': item.media_type === 'audio',
            'hover:!bg-[rgba(14,165,233,0.1)] hover:!border-[rgba(14,165,233,0.3)]': item.media_type === 'video',
            'hover:!bg-[rgba(16,185,129,0.1)] hover:!border-[rgba(16,185,129,0.3)]': item.media_type === 'image',
          }"
          @click="addToTimeline(item)"
          :title="`Click to add to timeline`"
        >
          <!-- Thumbnail/Preview -->
          <div
            class="w-14 h-14 shrink-0 rounded-lg overflow-hidden flex items-center justify-center relative"
            :style="{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              ...(item.media_type === 'audio'
                ? {
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 139, 250, 0.2))',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                  }
                : item.media_type === 'video'
                  ? {
                      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(59, 130, 246, 0.2))',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                    }
                  : {
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(52, 211, 153, 0.2))',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }),
            }"
          >
            <img
              v-if="item.media_type === 'image' && item.thumbnail_path"
              :src="convertFileSrc(item.thumbnail_path)"
              :alt="item.file_name"
              class="w-full h-full object-cover"
            />
            <div v-else-if="item.media_type === 'video'" class="text-[rgba(14,165,233,0.8)]">
              <Video :size="28" />
            </div>
            <div
              v-else-if="item.media_type === 'audio'"
              class="flex flex-col items-center justify-center gap-1 w-full h-full p-2"
            >
              <div class="text-[rgba(139,92,246,0.9)]">
                <Music :size="20" />
              </div>
              <div class="flex items-center justify-center gap-px h-3 w-full">
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 40%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 70%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0.1s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 50%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0.2s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 85%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0.3s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 60%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0.4s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 75%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0.5s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 45%;
                    background: linear-gradient(to top, rgba(139, 92, 246, 0.8), rgba(168, 139, 250, 0.6));
                    animation-delay: 0.6s;
                  "
                ></div>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <p class="text-sm font-medium m-0 truncate" :title="item.file_name" style="color: var(--editor-text)">
              {{ item.file_name }}
            </p>
            <div class="flex items-center gap-2 text-xs" style="color: var(--editor-text-muted)">
              <span
                class="uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded text-[10px]"
                :style="{
                  ...(item.media_type === 'audio'
                    ? {
                        backgroundColor: 'rgba(139, 92, 246, 0.2)',
                        color: 'rgba(168, 139, 250, 1)',
                      }
                    : item.media_type === 'video'
                      ? {
                          backgroundColor: 'rgba(14, 165, 233, 0.2)',
                          color: 'rgba(59, 130, 246, 1)',
                        }
                      : {
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          color: 'rgba(52, 211, 153, 1)',
                        }),
                }"
              >
                {{ item.media_type }}
              </span>
              <span v-if="item.duration">{{ formatDuration(item.duration) }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              class="flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150 hover:bg-[rgba(239,68,68,0.2)] hover:text-red-400"
              style="color: var(--editor-text-muted); background: transparent; border: none; cursor: pointer"
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
        filters: [
          {
            name: 'Media Files',
            extensions: [
              'mp4',
              'mov',
              'avi',
              'mkv',
              'webm',
              'mp3',
              'wav',
              'ogg',
              'm4a',
              'aac',
              'jpg',
              'jpeg',
              'png',
              'gif',
              'webp',
              'svg',
            ],
          },
        ],
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
        const { getVideoEditorProjectWithSources, updateVideoEditorProject } =
          await import('@/services/database/video-editor-projects');

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

<style>
  @keyframes waveform-pulse {
    0%,
    100% {
      opacity: 0.6;
      transform: scaleY(1);
    }
    50% {
      opacity: 1;
      transform: scaleY(1.2);
    }
  }
</style>
