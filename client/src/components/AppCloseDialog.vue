<template>
  <Teleport to="body">
    <div
      v-if="showCloseDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      @click.self="cancelClose"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-xl font-bold mb-4">
          {{ dialogTitle }}
        </h2>

        <div class="space-y-4">
          <!-- Downloads warning -->
          <div v-if="activeDownloadsCount > 0" class="space-y-2">
            <p class="text-muted-foreground">
              There {{ activeDownloadsCount === 1 ? 'is' : 'are' }}
              <span class="font-semibold text-foreground">{{ activeDownloadsCount }}</span>
              active download{{ activeDownloadsCount !== 1 ? 's' : '' }} in progress.
            </p>
          </div>

          <!-- Clip generation warning -->
          <div v-if="clipGenerationInProgress" class="space-y-2">
            <p class="text-muted-foreground">
              <span class="font-semibold text-foreground">Clip generation</span>
              is currently in progress.
            </p>
            <p class="text-sm text-muted-foreground">
              This process requires significant time and computational resources.
            </p>
          </div>

          <!-- Combined warning message -->
          <p class="text-muted-foreground">
            Are you sure you want to close the application? This will cancel all active operations and may lose
            partially completed work. This action cannot be undone.
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="confirmClose"
          >
            {{ confirmButtonText }}
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
            @click="cancelClose"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
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
