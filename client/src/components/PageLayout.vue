<template>
  <div>
    <!-- Page Title and Actions -->
    <div v-if="showHeader" class="mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div>
            <div class="flex items-center gap-3">
              <div v-if="icon" class="p-1.5 bg-muted rounded-lg flex-shrink-0">
                <!-- SVG file reference -->
                <img v-if="icon.endsWith('.svg')" :src="icon" :alt="title" class="h-5 w-5 text-foreground invert" />
                <!-- Inline SVG path -->
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="icon" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
            </div>
            <p class=" text-sm text-muted-foreground mt-2">{{ description }}</p>
          </div>
        </div>
        <slot name="actions"></slot>
      </div>
    </div>

    <!-- Content -->
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  showHeader?: boolean
  icon?: string
}>()
</script>
