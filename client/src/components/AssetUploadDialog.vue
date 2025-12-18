<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
      <Transition name="dialog" appear>
        <div
          class="dialog-container bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 flex-shrink-0" />

          <div class="p-4 sm:p-5 overflow-y-auto flex-1">
            <!-- Header -->
            <div class="mb-4 text-center">
              <div
                class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 mb-2"
              >
                <Upload class="h-5 w-5 text-violet-400" />
              </div>
              <h2 class="text-lg font-bold text-white tracking-tight mb-1">Upload Asset</h2>
              <p class="text-zinc-400 text-xs">Choose the type of media you want to add</p>
            </div>

            <!-- Asset Type Selection -->
            <div class="mb-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                <span class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Asset Type</span>
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              </div>

              <div class="grid grid-cols-5 gap-2">
                <!-- Intro -->
                <button
                  @click="selectedType = 'intro'"
                  :class="[
                    'group relative p-2 rounded-lg border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'intro'
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div class="relative">
                    <div
                      :class="[
                        'w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300',
                        selectedType === 'intro' ? 'bg-cyan-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Play
                        :class="[
                          'h-4 w-4 transition-colors',
                          selectedType === 'intro' ? 'text-white' : 'text-cyan-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-medium text-[11px] block transition-colors',
                        selectedType === 'intro' ? 'text-cyan-400' : 'text-white',
                      ]"
                    >
                      Intro
                    </span>
                  </div>

                  <!-- Check indicator -->
                  <Transition name="check">
                    <div
                      v-if="selectedType === 'intro'"
                      class="absolute top-1 right-1 w-3.5 h-3.5 bg-cyan-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2 w-2 text-white" />
                    </div>
                  </Transition>
                </button>

                <!-- Outro -->
                <button
                  @click="selectedType = 'outro'"
                  :class="[
                    'group relative p-2 rounded-lg border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'outro'
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div class="relative">
                    <div
                      :class="[
                        'w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300',
                        selectedType === 'outro' ? 'bg-violet-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Square
                        :class="[
                          'h-4 w-4 transition-colors',
                          selectedType === 'outro' ? 'text-white' : 'text-violet-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-medium text-[11px] block transition-colors',
                        selectedType === 'outro' ? 'text-violet-400' : 'text-white',
                      ]"
                    >
                      Outro
                    </span>
                  </div>

                  <Transition name="check">
                    <div
                      v-if="selectedType === 'outro'"
                      class="absolute top-1 right-1 w-3.5 h-3.5 bg-violet-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2 w-2 text-white" />
                    </div>
                  </Transition>
                </button>

                <!-- Watermark -->
                <button
                  @click="selectedType = 'watermark'"
                  :class="[
                    'group relative p-2 rounded-lg border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'watermark'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div class="relative">
                    <div
                      :class="[
                        'w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300',
                        selectedType === 'watermark' ? 'bg-amber-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Stamp
                        :class="[
                          'h-4 w-4 transition-colors',
                          selectedType === 'watermark' ? 'text-white' : 'text-amber-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-medium text-[11px] block transition-colors',
                        selectedType === 'watermark' ? 'text-amber-400' : 'text-white',
                      ]"
                    >
                      Watermark
                    </span>
                  </div>

                  <Transition name="check">
                    <div
                      v-if="selectedType === 'watermark'"
                      class="absolute top-1 right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2 w-2 text-white" />
                    </div>
                  </Transition>
                </button>

                <!-- Audio -->
                <button
                  @click="selectedType = 'audio'"
                  :class="[
                    'group relative p-2 rounded-lg border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'audio'
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div class="relative">
                    <div
                      :class="[
                        'w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300',
                        selectedType === 'audio' ? 'bg-emerald-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Music
                        :class="[
                          'h-4 w-4 transition-colors',
                          selectedType === 'audio' ? 'text-white' : 'text-emerald-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-medium text-[11px] block transition-colors',
                        selectedType === 'audio' ? 'text-emerald-400' : 'text-white',
                      ]"
                    >
                      Audio
                    </span>
                  </div>

                  <Transition name="check">
                    <div
                      v-if="selectedType === 'audio'"
                      class="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2 w-2 text-white" />
                    </div>
                  </Transition>
                </button>

                <!-- Image -->
                <button
                  @click="selectedType = 'image'"
                  :class="[
                    'group relative p-2 rounded-lg border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'image'
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div class="relative">
                    <div
                      :class="[
                        'w-8 h-8 mx-auto rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300',
                        selectedType === 'image' ? 'bg-cyan-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <ImageIcon
                        :class="[
                          'h-4 w-4 transition-colors',
                          selectedType === 'image' ? 'text-white' : 'text-cyan-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-medium text-[11px] block transition-colors',
                        selectedType === 'image' ? 'text-cyan-400' : 'text-white',
                      ]"
                    >
                      Image
                    </span>
                  </div>

                  <Transition name="check">
                    <div
                      v-if="selectedType === 'image'"
                      class="absolute top-1 right-1 w-3.5 h-3.5 bg-cyan-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2 w-2 text-white" />
                    </div>
                  </Transition>
                </button>
              </div>
            </div>

            <!-- File Info -->
            <Transition name="slide-fade" mode="out-in">
              <div :key="selectedType || 'default'" class="mb-4 rounded-lg bg-zinc-900/80 border border-zinc-800 p-3">
                <div class="flex items-start gap-2.5">
                  <div
                    :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-300',
                      selectedType === 'intro'
                        ? 'bg-cyan-500/20'
                        : selectedType === 'outro'
                          ? 'bg-violet-500/20'
                          : selectedType === 'watermark'
                            ? 'bg-amber-500/20'
                            : selectedType === 'audio'
                              ? 'bg-emerald-500/20'
                              : selectedType === 'image'
                                ? 'bg-cyan-500/20'
                                : 'bg-zinc-800',
                    ]"
                  >
                    <FileVideo
                      v-if="selectedType === 'intro' || selectedType === 'outro'"
                      :class="[
                        'h-4 w-4 transition-colors duration-300',
                        selectedType === 'intro' ? 'text-cyan-400' : 'text-violet-400',
                      ]"
                    />
                    <ImageIcon v-else-if="selectedType === 'watermark'" class="h-4 w-4 text-amber-400" />
                    <Music v-else-if="selectedType === 'audio'" class="h-4 w-4 text-emerald-400" />
                    <ImageIcon v-else-if="selectedType === 'image'" class="h-4 w-4 text-cyan-400" />
                    <FileVideo v-else class="h-4 w-4 text-zinc-500" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-white mb-0.5">
                      {{ selectedType ? 'Ready to upload' : 'Select an asset type' }}
                    </p>
                    <p class="text-[10px] text-zinc-500 mb-1.5">
                      {{ selectedType ? 'A native file dialog will open' : 'Choose an asset type above' }}
                    </p>
                    <div class="flex flex-wrap gap-1">
                      <template v-if="selectedType === 'watermark'">
                        <span
                          v-for="format in ['PNG', 'JPG', 'WebP', 'GIF']"
                          :key="format"
                          class="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          {{ format }}
                        </span>
                      </template>
                      <template v-else-if="selectedType === 'image'">
                        <span
                          v-for="format in ['PNG', 'JPG', 'WebP', 'GIF', 'BMP', 'TIFF']"
                          :key="format"
                          class="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        >
                          {{ format }}
                        </span>
                      </template>
                      <template v-else-if="selectedType === 'audio'">
                        <span
                          v-for="format in ['MP3', 'WAV', 'FLAC', 'AAC', 'M4A', 'OGG']"
                          :key="format"
                          class="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        >
                          {{ format }}
                        </span>
                      </template>
                      <template v-else>
                        <span
                          v-for="format in ['MP4', 'MOV', 'AVI', 'MKV', 'WebM']"
                          :key="format"
                          :class="[
                            'inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium border',
                            selectedType === 'intro'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                              : selectedType === 'outro'
                                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                : 'bg-zinc-800 text-zinc-500 border-zinc-700',
                          ]"
                        >
                          {{ format }}
                        </span>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- Actions -->
            <div class="flex gap-2">
              <button
                @click="$emit('close')"
                class="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-xs"
                :disabled="isUploading"
              >
                Cancel
              </button>
              <button
                @click="handleUpload"
                :disabled="!selectedType || isUploading"
                :class="[
                  'flex-1 px-3 py-2 rounded-lg font-semibold transition-all duration-300 relative overflow-hidden group text-xs',
                  selectedType ? 'text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
                  selectedType === 'intro' && 'bg-gradient-to-r from-cyan-600 to-cyan-500',
                  selectedType === 'outro' && 'bg-gradient-to-r from-violet-600 to-violet-500',
                  selectedType === 'watermark' && 'bg-gradient-to-r from-amber-600 to-amber-500',
                  selectedType === 'audio' && 'bg-gradient-to-r from-emerald-600 to-emerald-500',
                  selectedType === 'image' && 'bg-gradient-to-r from-cyan-600 to-cyan-500',
                ]"
              >
                <!-- Shine effect -->
                <div
                  v-if="selectedType && !isUploading"
                  class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />
                <div class="relative flex items-center justify-center gap-1.5">
                  <Loader2 v-if="isUploading" class="animate-spin h-3.5 w-3.5" />
                  <Upload v-else-if="selectedType" class="h-3.5 w-3.5" />
                  {{ isUploading ? 'Uploading...' : 'Upload' }}
                </div>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { Upload, Play, Square, Stamp, FileVideo, Loader2, Check, Image as ImageIcon, Music } from 'lucide-vue-next';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { useAudioAssetOperations } from '@/composables/useAudioAssetOperations';
  import { useImageAssetOperations } from '@/composables/useImageAssetOperations';

  const emit = defineEmits<{
    close: [];
    uploaded: [];
  }>();

  defineProps<{
    show: boolean;
  }>();

  const { uploading: assetUploading, uploadAsset } = useAssetOperations();
  const { uploading: watermarkUploading, uploadWatermark } = useWatermarkOperations();
  const { uploading: audioUploading, uploadAudioAsset } = useAudioAssetOperations();
  const { uploading: imageUploading, uploadImageAsset } = useImageAssetOperations();

  const selectedType = ref<'intro' | 'outro' | 'watermark' | 'audio' | 'image' | null>(null);

  const isUploading = computed(
    () => assetUploading.value || watermarkUploading.value || audioUploading.value || imageUploading.value
  );

  function handleUpload() {
    if (!selectedType.value) return;

    try {
      // Close dialog immediately
      emit('close');

      if (selectedType.value === 'watermark') {
        // Upload watermark image
        uploadWatermark()
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Watermark upload failed:', error);
          });
      } else if (selectedType.value === 'audio') {
        // Upload audio file
        uploadAudioAsset()
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Audio upload failed:', error);
          });
      } else if (selectedType.value === 'image') {
        // Upload image file
        uploadImageAsset()
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Image upload failed:', error);
          });
      } else {
        // Upload intro/outro video
        uploadAsset(selectedType.value)
          .then((result) => {
            if (result.success) {
              emit('uploaded');
            }
          })
          .catch((error) => {
            console.error('Upload failed:', error);
          });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }
</script>

<style scoped>
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

  /* Check indicator transition */
  .check-enter-active {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .check-leave-active {
    transition: all 0.15s ease-in;
  }

  .check-enter-from {
    opacity: 0;
    transform: scale(0);
  }

  .check-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }

  /* Slide fade for file info */
  .slide-fade-enter-active {
    transition: all 0.3s ease-out;
  }

  .slide-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-fade-enter-from {
    opacity: 0;
    transform: translateY(-8px);
  }

  .slide-fade-leave-to {
    opacity: 0;
    transform: translateY(8px);
  }

  /* Dialog container subtle animation */
  .dialog-container {
    animation: subtle-float 6s ease-in-out infinite;
  }

  @keyframes subtle-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-2px);
    }
  }
</style>
