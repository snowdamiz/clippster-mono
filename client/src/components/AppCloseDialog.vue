<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showCloseDialog"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="cancelClose"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600" />

            <div class="p-5 sm:p-6 lg:p-8">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 mb-3 sm:mb-4"
                >
                  <AlertTriangle class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-red-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                  {{ dialogTitle }}
                </h2>
              </div>

              <!-- Content -->
              <div class="mb-5 sm:mb-6 lg:mb-8 space-y-3 sm:space-y-4">
                <!-- Downloads warning -->
                <div
                  v-if="activeDownloadsCount > 0"
                  class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/80 border border-zinc-800"
                >
                  <p class="text-zinc-300 text-xs sm:text-sm">
                    There {{ activeDownloadsCount === 1 ? 'is' : 'are' }}
                    <span class="font-semibold text-amber-400">{{ activeDownloadsCount }}</span>
                    active download{{ activeDownloadsCount !== 1 ? 's' : '' }} in progress.
                  </p>
                </div>

                <!-- Clip generation warning -->
                <div
                  v-if="clipGenerationInProgress"
                  class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/80 border border-zinc-800"
                >
                  <p class="text-zinc-300 text-xs sm:text-sm">
                    <span class="font-semibold text-violet-400">Clip generation</span>
                    is currently in progress.
                  </p>
                  <p class="text-zinc-500 text-[10px] sm:text-xs mt-1">
                    This process requires significant time and computational resources.
                  </p>
                </div>

                <!-- Combined warning message -->
                <p class="text-zinc-400 text-xs sm:text-sm text-center">
                  Are you sure you want to close the application? This will cancel all active operations and may lose
                  partially completed work.
                </p>
                <p class="text-zinc-500 text-[10px] sm:text-xs text-center">This action cannot be undone.</p>
              </div>

              <!-- Actions -->
              <div class="space-y-2 sm:space-y-3">
                <button
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm sm:text-base"
                  @click="confirmClose"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <span class="relative">{{ confirmButtonText }}</span>
                </button>
                <button
                  class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm sm:text-base"
                  @click="cancelClose"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { AlertTriangle } from 'lucide-vue-next';
  import { useWindowClose } from '@/composables/useWindowClose';

  const { showCloseDialog, activeDownloadsCount, clipGenerationInProgress, confirmCloseWithCleanup, cancelClose } =
    useWindowClose();

  // Computed properties for dynamic messaging
  const hasMultipleOperations = computed(() => {
    return activeDownloadsCount.value > 0 && clipGenerationInProgress.value;
  });

  const hasDownloadsOnly = computed(() => {
    return activeDownloadsCount.value > 0 && !clipGenerationInProgress.value;
  });

  const hasClipGenerationOnly = computed(() => {
    return clipGenerationInProgress.value && activeDownloadsCount.value === 0;
  });

  // Computed button text based on active operations
  const confirmButtonText = computed(() => {
    if (hasDownloadsOnly.value) {
      return activeDownloadsCount.value === 1 ? 'Close and Cancel Download' : 'Close and Cancel Downloads';
    } else if (hasClipGenerationOnly.value) {
      return 'Close and Cancel Clip Detection';
    } else if (hasMultipleOperations.value) {
      const downloadText = activeDownloadsCount.value === 1 ? 'Download' : 'Downloads';
      return `Close and Cancel ${downloadText} and Clip Detection`;
    }
    return 'Close Application';
  });

  const dialogTitle = computed(() => {
    if (hasDownloadsOnly.value) {
      return activeDownloadsCount.value === 1 ? 'Close Application?' : 'Downloads in Progress';
    } else if (hasClipGenerationOnly.value) {
      return 'Clip Detection in Progress';
    } else if (hasMultipleOperations.value) {
      return 'Operations in Progress';
    }
    return 'Close Application?';
  });

  async function confirmClose() {
    await confirmCloseWithCleanup();
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
</style>
