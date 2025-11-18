<template>
  <div class="space-y-6">
    <!-- Skeleton Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Show 6 skeleton cards during loading -->
      <div
        v-for="i in 6"
        :key="i"
        class="relative bg-card border border-border rounded-md overflow-hidden animate-pulse"
      >
        <!-- Thumbnail skeleton -->
        <div class="aspect-video bg-muted/50 relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <svg
                class="animate-spin h-8 w-8 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span class="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        </div>
        <!-- Info skeleton -->
        <div class="p-4">
          <div class="h-5 bg-muted/50 rounded mb-2 w-3/4"></div>
          <div class="h-3 bg-muted/50 rounded mb-2 w-1/2"></div>
          <div class="h-3 bg-muted/50 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  // No props needed - hardcoded to match PumpFun.vue exactly
</script>
