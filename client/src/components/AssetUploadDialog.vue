<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
      @click.self="$emit('close')"
    >
      <Transition name="dialog" appear>
        <div
          class="dialog-container bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500" />

          <div class="p-5 sm:p-6 lg:p-8">
            <!-- Header -->
            <div class="mb-5 sm:mb-6 lg:mb-8 text-center">
              <div
                class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 mb-3 sm:mb-4"
              >
                <Upload class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
              </div>
              <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1.5 sm:mb-2">Upload Asset</h2>
              <p class="text-zinc-400 text-xs sm:text-sm">Choose the type of media you want to add</p>
            </div>

            <!-- Asset Type Selection -->
            <div class="mb-5 sm:mb-6 lg:mb-8">
              <div class="flex items-center gap-2 mb-3 sm:mb-4">
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                <span class="text-[10px] sm:text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Asset Type
                </span>
                <div class="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              </div>

              <div class="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                <!-- Intro -->
                <button
                  @click="selectedType = 'intro'"
                  :class="[
                    'group relative p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'intro'
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <!-- Selection glow effect -->
                  <div
                    v-if="selectedType === 'intro'"
                    class="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none"
                  />

                  <div class="relative">
                    <div
                      :class="[
                        'w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto rounded-lg lg:rounded-xl flex items-center justify-center mb-2 sm:mb-3 transition-all duration-300',
                        selectedType === 'intro' ? 'bg-cyan-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Play
                        :class="[
                          'h-4 w-4 sm:h-5 sm:w-5 transition-colors',
                          selectedType === 'intro' ? 'text-white' : 'text-cyan-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-semibold text-xs sm:text-sm block mb-0.5 sm:mb-1 transition-colors',
                        selectedType === 'intro' ? 'text-cyan-400' : 'text-white',
                      ]"
                    >
                      Intro
                    </span>
                    <p class="text-[10px] sm:text-[11px] text-zinc-500 hidden sm:block">Opening sequence</p>
                  </div>

                  <!-- Check indicator -->
                  <Transition name="check">
                    <div
                      v-if="selectedType === 'intro'"
                      class="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 bg-cyan-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                    </div>
                  </Transition>
                </button>

                <!-- Outro -->
                <button
                  @click="selectedType = 'outro'"
                  :class="[
                    'group relative p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'outro'
                      ? 'border-violet-500/50 bg-violet-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div
                    v-if="selectedType === 'outro'"
                    class="absolute inset-0 bg-gradient-to-b from-violet-500/10 to-transparent pointer-events-none"
                  />

                  <div class="relative">
                    <div
                      :class="[
                        'w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto rounded-lg lg:rounded-xl flex items-center justify-center mb-2 sm:mb-3 transition-all duration-300',
                        selectedType === 'outro' ? 'bg-violet-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Square
                        :class="[
                          'h-4 w-4 sm:h-5 sm:w-5 transition-colors',
                          selectedType === 'outro' ? 'text-white' : 'text-violet-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-semibold text-xs sm:text-sm block mb-0.5 sm:mb-1 transition-colors',
                        selectedType === 'outro' ? 'text-violet-400' : 'text-white',
                      ]"
                    >
                      Outro
                    </span>
                    <p class="text-[10px] sm:text-[11px] text-zinc-500 hidden sm:block">Closing sequence</p>
                  </div>

                  <Transition name="check">
                    <div
                      v-if="selectedType === 'outro'"
                      class="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 bg-violet-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                    </div>
                  </Transition>
                </button>

                <!-- Watermark -->
                <button
                  @click="selectedType = 'watermark'"
                  :class="[
                    'group relative p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border transition-all duration-300 text-center overflow-hidden',
                    selectedType === 'watermark'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50',
                  ]"
                >
                  <div
                    v-if="selectedType === 'watermark'"
                    class="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none"
                  />

                  <div class="relative">
                    <div
                      :class="[
                        'w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto rounded-lg lg:rounded-xl flex items-center justify-center mb-2 sm:mb-3 transition-all duration-300',
                        selectedType === 'watermark' ? 'bg-amber-500' : 'bg-zinc-800 group-hover:bg-zinc-700',
                      ]"
                    >
                      <Stamp
                        :class="[
                          'h-4 w-4 sm:h-5 sm:w-5 transition-colors',
                          selectedType === 'watermark' ? 'text-white' : 'text-amber-400',
                        ]"
                      />
                    </div>
                    <span
                      :class="[
                        'font-semibold text-xs sm:text-sm block mb-0.5 sm:mb-1 transition-colors',
                        selectedType === 'watermark' ? 'text-amber-400' : 'text-white',
                      ]"
                    >
                      Watermark
                    </span>
                    <p class="text-[10px] sm:text-[11px] text-zinc-500 hidden sm:block">Logo overlay</p>
                  </div>

                  <Transition name="check">
                    <div
                      v-if="selectedType === 'watermark'"
                      class="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 bg-amber-500 rounded-full flex items-center justify-center"
                    >
                      <Check class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
                    </div>
                  </Transition>
                </button>
              </div>
            </div>

            <!-- File Info -->
            <Transition name="slide-fade" mode="out-in">
              <div
                :key="selectedType || 'default'"
                class="mb-5 sm:mb-6 lg:mb-8 rounded-lg sm:rounded-xl bg-zinc-900/80 border border-zinc-800 p-3 sm:p-4"
              >
                <div class="flex items-start gap-3 sm:gap-4">
                  <div
                    :class="[
                      'w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300',
                      selectedType === 'intro'
                        ? 'bg-cyan-500/20'
                        : selectedType === 'outro'
                          ? 'bg-violet-500/20'
                          : selectedType === 'watermark'
                            ? 'bg-amber-500/20'
                            : 'bg-zinc-800',
                    ]"
                  >
                    <FileVideo
                      v-if="selectedType !== 'watermark'"
                      :class="[
                        'h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-300',
                        selectedType === 'intro'
                          ? 'text-cyan-400'
                          : selectedType === 'outro'
                            ? 'text-violet-400'
                            : 'text-zinc-500',
                      ]"
                    />
                    <ImageIcon v-else class="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs sm:text-sm font-medium text-white mb-0.5 sm:mb-1">
                      {{ selectedType ? 'Ready to upload' : 'Select an asset type' }}
                    </p>
                    <p class="text-[10px] sm:text-xs text-zinc-500 mb-1.5 sm:mb-2">
                      {{
                        selectedType
                          ? 'A native file dialog will open to select your file'
                          : 'Choose from intro, outro, or watermark above'
                      }}
                    </p>
                    <div class="flex flex-wrap gap-1 sm:gap-1.5">
                      <template v-if="selectedType === 'watermark'">
                        <span
                          v-for="format in ['PNG', 'JPG', 'WebP', 'GIF']"
                          :key="format"
                          class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        >
                          {{ format }}
                        </span>
                      </template>
                      <template v-else>
                        <span
                          v-for="format in ['MP4', 'MOV', 'AVI', 'MKV', 'WebM', 'FLV']"
                          :key="format"
                          :class="[
                            'inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium border',
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
            <div class="flex gap-2 sm:gap-3">
              <button
                @click="$emit('close')"
                class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                :disabled="isUploading"
              >
                Cancel
              </button>
              <button
                @click="handleUpload"
                :disabled="!selectedType || isUploading"
                :class="[
                  'flex-1 px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 relative overflow-hidden group text-sm',
                  selectedType ? 'text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
                  selectedType === 'intro' && 'bg-gradient-to-r from-cyan-600 to-cyan-500',
                  selectedType === 'outro' && 'bg-gradient-to-r from-violet-600 to-violet-500',
                  selectedType === 'watermark' && 'bg-gradient-to-r from-amber-600 to-amber-500',
                ]"
              >
                <!-- Shine effect -->
                <div
                  v-if="selectedType && !isUploading"
                  class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />
                <div class="relative flex items-center justify-center gap-2">
                  <Loader2 v-if="isUploading" class="animate-spin h-4 w-4" />
                  <Upload v-else-if="selectedType" class="h-4 w-4" />
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
  import { Upload, Play, Square, Stamp, FileVideo, Loader2, Check, Image as ImageIcon } from 'lucide-vue-next';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';

  const emit = defineEmits<{
    close: [];
    uploaded: [];
  }>();

  defineProps<{
    show: boolean;
  }>();

  const { uploading: assetUploading, uploadAsset } = useAssetOperations();
  const { uploading: watermarkUploading, uploadWatermark } = useWatermarkOperations();

  const selectedType = ref<'intro' | 'outro' | 'watermark' | null>(null);

  const isUploading = computed(() => assetUploading.value || watermarkUploading.value);

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
