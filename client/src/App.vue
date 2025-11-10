<script setup lang="ts">
  import { onMounted } from 'vue';
  import Toast from '@/components/Toast.vue';
  import AppCloseDialog from '@/components/AppCloseDialog.vue';
  import TitleBar from '@/components/TitleBar.vue';
  import { initDatabase, seedDefaultPrompt } from '@/services/database';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { useAuthStore } from '@/stores/auth';

  const { initializeWindowCloseHandler } = useWindowClose();
  const authStore = useAuthStore();

  // Ensure dark mode is always applied and initialize database
  onMounted(async () => {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');

    // Check authentication status on app start
    try {
      await authStore.checkAuth();
    } catch (error) {
      console.error('[App] Failed to check authentication:', error);
    }

    // Initialize database connection
    try {
      await initDatabase();

      // Seed default prompt if it doesn't exist
      await seedDefaultPrompt();
    } catch (error) {
      console.error('[App] Failed to initialize database:', error);
    }

    // Initialize window close handler
    try {
      await initializeWindowCloseHandler();
    } catch (error) {
      console.error('[App] Failed to initialize window close handler:', error);
    }
  });
</script>

<template>
  <div class="app-container">
    <!-- Custom titlebar -->
    <TitleBar :dark-mode="true" />

    <!-- Main content area with scrolling -->
    <div class="main-content">
      <!-- Toast notifications provider -->
      <Toast />
      <!-- Router view for page content -->
      <router-view />
      <!-- Global app close confirmation dialog -->
      <AppCloseDialog />
    </div>
  </div>
</template>

<style scoped>
  .app-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    width: 100%;
    height: 100vh;
    padding-top: 32px; /* Account for fixed titlebar height (will be adjusted by JS for macOS) */
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }
</style>
