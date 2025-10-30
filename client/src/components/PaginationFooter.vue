<template>
  <footer
    v-if="totalPages > 1"
    class="fixed bottom-0 left-64 right-0 h-16 px-8 flex items-center justify-between border-t border-border/40 bg-background/95 backdrop-blur-sm z-10"
  >
    <!-- Page info -->
    <div class="text-sm text-muted-foreground">
      <span v-if="totalItems > 0">
        {{ totalItems }} {{ itemLabel }}{{ totalItems !== 1 ? 's' : '' }} •
        Page {{ currentPage }} of {{ totalPages }}
      </span>
    </div>

    <!-- Pagination Controls -->
    <div class="flex items-center gap-2 rounded-md p-0.5">
      <!-- Previous Button -->
      <button
        @click="$emit('previous')"
        :disabled="currentPage === 1"
        class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all text-sm"
        title="Previous page"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Previous
      </button>

      <!-- Page Numbers -->
      <div class="flex items-center gap-1">
        <!-- Generate page numbers with smart ellipsis -->
        <template v-for="page in totalPages" :key="page">
          <!-- Show first page -->
          <button
            v-if="page === 1"
            @click="$emit('goToPage', page)"
            :class="[
              'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
              currentPage === page
                ? 'text-purple-500'
                : 'hover:bg-muted/80 text-foreground'
            ]"
          >
            {{ page }}
          </button>

          <!-- Show ellipsis before current page range -->
          <span v-else-if="page === currentPage - 2 && page > 2" class="px-1.5 text-muted-foreground text-sm">...</span>

          <!-- Show pages around current -->
          <button
            v-else-if="page >= currentPage - 1 && page <= currentPage + 1"
            @click="$emit('goToPage', page)"
            :class="[
              'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
              currentPage === page
                ? 'text-purple-500'
                : 'hover:bg-muted/80 text-foreground'
            ]"
          >
            {{ page }}
          </button>

          <!-- Show ellipsis after current page range -->
          <span v-else-if="page === currentPage + 2 && page < totalPages - 1" class="px-1.5 text-muted-foreground text-sm">...</span>

          <!-- Show last page -->
          <button
            v-else-if="page === totalPages && totalPages > 1"
            @click="$emit('goToPage', page)"
            :class="[
              'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
              currentPage === page
                ? 'bg-purple-500 text-white'
                : 'hover:bg-muted/80 text-foreground'
            ]"
          >
            {{ page }}
          </button>
        </template>
      </div>

      <!-- Next Button -->
      <button
        @click="$emit('next')"
        :disabled="currentPage === totalPages"
        class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all text-sm"
        title="Next page"
      >
        Next
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number
  totalPages: number
  totalItems: number
  itemLabel?: string
}

interface Emits {
  (e: 'goToPage', page: number): void
  (e: 'previous'): void
  (e: 'next'): void
}

withDefaults(defineProps<Props>(), {
  itemLabel: 'item'
})

defineEmits<Emits>()
</script>