<script setup lang="ts">
import { onMounted } from 'vue'
import Toast from '@/components/Toast.vue'
import AppCloseDialog from '@/components/AppCloseDialog.vue'
import { initDatabase, seedDefaultPrompt } from '@/services/database'
import { useWindowClose } from '@/composables/useWindowClose'

const { initializeWindowCloseHandler } = useWindowClose()

// Ensure dark mode is always applied and initialize database
onMounted(async () => {
  document.documentElement.classList.add('dark')
  document.body.classList.add('dark')

  // Initialize database connection
  try {
    await initDatabase()
    console.log('[App] Database initialized successfully')

    // Seed default prompt if it doesn't exist
    await seedDefaultPrompt()
  } catch (error) {
    console.error('[App] Failed to initialize database:', error)
  }

  // Initialize window close handler
  try {
    await initializeWindowCloseHandler()
    console.log('[App] Window close handler initialized successfully')
  } catch (error) {
    console.error('[App] Failed to initialize window close handler:', error)
  }
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Toast notifications provider -->
    <Toast />

    <!-- Router view for page content -->
    <router-view />

    <!-- Global app close confirmation dialog -->
    <AppCloseDialog />
  </div>
</template>

<style scoped>
</style>
