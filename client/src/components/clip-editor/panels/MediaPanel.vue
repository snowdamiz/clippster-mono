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
          class="group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-150 hover:translate-x-0.5"
          style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05)"
          :class="getHoverClasses(item.media_type)"
          @click="addToTimeline(item)"
          :title="`Click to add to timeline`"
        >
          <!-- Thumbnail/Preview -->
          <div
            class="w-14 h-14 shrink-0 rounded-lg overflow-hidden flex items-center justify-center relative"
            :style="getThumbnailStyles(item.media_type)"
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
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
                    animation-delay: 0s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 70%;
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
                    animation-delay: 0.1s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 50%;
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
                    animation-delay: 0.2s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 85%;
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
                    animation-delay: 0.3s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 60%;
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
                    animation-delay: 0.4s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 75%;
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
                    animation-delay: 0.5s;
                  "
                ></div>
                <div
                  class="w-0.5 rounded-full animate-[waveform-pulse_1.5s_ease-in-out_infinite]"
                  style="
                    height: 45%;
                    background: linear-gradient(to top, rgba(6, 182, 212, 0.8), rgba(34, 211, 238, 0.6));
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
                :style="getBadgeStyles(item.media_type)"
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
  import { toRef } from 'vue';
  import { Upload, Film, Video, Music, Trash2 } from 'lucide-vue-next';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import {
    useMediaCRUD,
    formatDuration,
    useMediaTypeStyles,
    type MediaItem,
  } from '@/composables/clip-editor';

  const props = defineProps<{
    editId: string | null;
    projectId: string | null;
  }>();

  const emit = defineEmits<{
    (e: 'mediaAdded', mediaId: string): void;
    (e: 'mediaUpdated'): void;
  }>();

  // Use the media CRUD composable
  const {
    mediaItems,
    isLoading: loading,
    handleUploadClick,
    addToTimeline: addToTimelineBase,
    deleteMedia: deleteMediaBase,
  } = useMediaCRUD({
    projectId: toRef(props, 'projectId'),
    editId: toRef(props, 'editId'),
    onUpdate: () => emit('mediaUpdated'),
    onMediaAdded: (id) => emit('mediaAdded', id),
  });

  // Media type styling (from composable)
  const { getThumbnailStyles, getBadgeStyles, getHoverClasses } = useMediaTypeStyles();

  // Wrapper to handle confirmation for delete
  async function deleteMedia(mediaId: string) {
    if (!confirm('Delete this media item?')) return;
    await deleteMediaBase(mediaId);
  }

  // Direct pass-through for addToTimeline
  function addToTimeline(item: MediaItem) {
    addToTimelineBase(item);
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
