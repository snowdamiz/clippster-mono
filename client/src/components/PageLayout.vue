<template>
  <div>
    <!-- Page Title and Actions -->
    <div v-if="showHeader" class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-foreground">{{ title }}</h1>
          <p class="text-muted-foreground mt-2">{{ description }}</p>
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
}>()
</script>
