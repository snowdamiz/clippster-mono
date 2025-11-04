<template>
  <div
    v-if="showCloseDialog"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    @click.self="cancelClose"
  >
    <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
      <h2 class="text-xl font-bold mb-4">Close Application?</h2>

      <div class="space-y-4">
        <p class="text-muted-foreground">
          There {{ activeDownloadsCount === 1 ? 'is' : 'are' }}
          <span class="font-semibold text-foreground">{{ activeDownloadsCount }}</span>
          active download{{ activeDownloadsCount !== 1 ? 's' : '' }} in progress.
        </p>

        <p class="text-muted-foreground">
          Are you sure you want to close the application? This will cancel all active downloads and remove any partially
          downloaded files. This action cannot be undone.
        </p>
        <button
          class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
          @click="confirmClose"
        >
          Close and Cancel Downloads
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
</template>

<script setup lang="ts">
  import { useWindowClose } from '@/composables/useWindowClose'

  const { showCloseDialog, activeDownloadsCount, confirmCloseWithCleanup, cancelClose } = useWindowClose()

  async function confirmClose() {
    await confirmCloseWithCleanup()
  }
</script>
