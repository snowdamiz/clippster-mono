<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-card rounded-lg max-w-md w-full mx-4 border border-border p-6">
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-foreground mb-2">Upload Asset</h2>
        <p class="text-sm text-muted-foreground">
          Select the type of asset you want to upload and choose the video file.
        </p>
      </div>

      <!-- Asset Type Selection -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-foreground mb-3">Asset Type</label>
        <div class="grid grid-cols-2 gap-3">
          <button
            @click="selectedType = 'intro'"
            :class="[
              'p-4 rounded-lg border-2 transition-all text-left',
              selectedType === 'intro' ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-foreground/20',
            ]"
          >
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <span class="font-medium">Intro</span>
            </div>
            <p class="text-xs text-muted-foreground">Opening sequence for clips</p>
          </button>

          <button
            @click="selectedType = 'outro'"
            :class="[
              'p-4 rounded-md border-2 transition-all text-left',
              selectedType === 'outro'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-border hover:border-foreground/20',
            ]"
          >
            <div class="flex items-center gap-3 mb-2">
              <div class="w-8 h-8 bg-purple-500/20 rounded-md flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-purple-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                </svg>
              </div>
              <span class="font-medium">Outro</span>
            </div>
            <p class="text-xs text-muted-foreground">Closing sequence for clips</p>
          </button>
        </div>
      </div>

      <!-- File Info -->
      <div class="mb-6">
        <div class="bg-muted/30 rounded-md p-4 border border-border/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-500/20 rounded-md flex items-center justify-center flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-foreground">File Selection</p>
              <p class="text-xs text-muted-foreground">A native file dialog will open to select your video file</p>
              <p class="text-xs text-muted-foreground mt-1">Supports: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          @click="$emit('close')"
          class="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-all"
          :disabled="uploading"
        >
          Cancel
        </button>
        <button
          @click="handleUpload"
          :disabled="!selectedType || uploading"
          class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div class="flex items-center justify-center gap-2">
            <svg
              v-if="uploading"
              xmlns="http://www.w3.org/2000/svg"
              class="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {{ uploading ? 'Uploading...' : 'Upload' }}
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useAssetOperations } from '@/composables/useAssetOperations';

  const emit = defineEmits<{
    close: [];
    uploaded: [];
  }>();

  defineProps<{
    show: boolean;
  }>();

  const { uploading, uploadAsset } = useAssetOperations();

  const selectedType = ref<'intro' | 'outro' | null>(null);

  function handleUpload() {
    if (!selectedType.value) return;

    try {
      // Close dialog immediately
      emit('close');

      // Start upload in background without awaiting
      // Note: file selection now happens via native dialog in uploadAsset function
      uploadAsset(selectedType.value)
        .then((result) => {
          if (result.success) {
            emit('uploaded');
          }
        })
        .catch((error) => {
          console.error('Upload failed:', error);
        });
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
</script>
