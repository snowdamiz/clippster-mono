<template>
  <div class="space-y-6">
    <!-- Skeleton Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <!-- Show 6 skeleton cards during loading -->
      <div v-for="i in 6" :key="i" class="relative bg-card rounded-md overflow-hidden aspect-video animate-pulse">
        <!-- Thumbnail background skeleton -->
        <div class="absolute inset-0 z-0 bg-muted/40">
          <div class="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20"></div>
        </div>

        <!-- Top right time badge skeleton -->
        <div class="absolute top-4 right-4 z-5">
          <div class="h-5 w-12 bg-muted/70 rounded-md"></div>
        </div>

        <!-- Bottom left title and description skeleton -->
        <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
          <div class="h-5 bg-muted/70 rounded mb-1 w-3/4"></div>
          <div class="h-3 bg-muted/70 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  // No props needed - hardcoded to match PumpFun.vue exactly
</script>
