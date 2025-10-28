<script setup lang="ts">
import { onMounted } from 'vue'
import Toast from '@/components/Toast.vue'
import { initDatabase } from '@/services/database'

// Ensure dark mode is always applied and initialize database
onMounted(async () => {
  document.documentElement.classList.add('dark')
  document.body.classList.add('dark')
  
  // Initialize database connection
  try {
    await initDatabase()
    console.log('[App] Database initialized successfully')
  } catch (error) {
    console.error('[App] Failed to initialize database:', error)
  }
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Toast notifications provider -->
    <Toast />
    
    <!-- Router view for page content -->
    <router-view />
  </div>
</template>

<style scoped>
</style>
