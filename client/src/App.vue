<script setup lang="ts">
import { onMounted } from 'vue'
import { Toaster } from '@/components/ui/sonner'

// Ensure dark mode is always applied
onMounted(() => {
  document.documentElement.classList.add('dark')
  document.body.classList.add('dark')
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Toast notifications provider -->
    <Toaster position="bottom-right" />
    
    <!-- Router view for page content -->
    <router-view />
  </div>
</template>

<style scoped>
</style>
