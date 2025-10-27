<template>
  <header class="h-16 px-8 flex items-center justify-between border-b border-border/40 bg-background">
    <nav class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">Dashboard</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span class="text-foreground capitalize">{{ currentPageTitle }}</span>
    </nav>
    
    <!-- Global Search -->
    <div class="relative">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input 
        type="text" 
        placeholder="Search..." 
        class="pl-9 pr-4 py-2 mr-[-18px] bg-background border border-border rounded-lg focus:outline-none focus:border-foreground/30 w-64 text-sm"
      >
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const currentPageTitle = computed(() => {
  const path = route.path.split('/').pop()
  return path || 'Dashboard'
})
</script>
