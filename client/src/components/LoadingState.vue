<template>
  <div class="flex items-center justify-center py-20">
    <div class="text-muted-foreground">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>
