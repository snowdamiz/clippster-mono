<template>
  <div class="relative bg-card border border-border rounded-md overflow-hidden animate-pulse aspect-video">
    <!-- Thumbnail skeleton -->
    <div class="aspect-video bg-muted/50 relative">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="animate-spin h-8 w-8 text-muted-foreground" />
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
</template>

<script setup lang="ts">
  import { Loader2 } from 'lucide-vue-next';
  // No props needed - matching PumpFun.vue exactly
</script>
