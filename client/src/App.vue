<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue';
  import Toast from '@/components/Toast.vue';
  import AppCloseDialog from '@/components/AppCloseDialog.vue';
  import TitleBar from '@/components/TitleBar.vue';
  import LoadingScreen from '@/components/LoadingScreen.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { initDatabase, seedDefaultPrompt } from '@/services/database';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { useAuthStore } from '@/stores/auth';
  import { invoke } from '@tauri-apps/api/core';
  import { useRouter } from 'vue-router';

  const { initializeWindowCloseHandler } = useWindowClose();
  const authStore = useAuthStore();
  const router = useRouter();
  const isLoading = ref(true);
  const titleBarPlatformOverride = ref('auto');
  const showAuthModal = ref(false);

  // Auth event listener function
  const handleAuthRequired = () => {
    console.log('[App] Auth required, showing auth modal');
    showAuthModal.value = true;
  };

  // Platform override functions
  const loadPlatformOverride = () => {
    const saved = localStorage.getItem('titlebar-platform-override');
    if (saved) {
      titleBarPlatformOverride.value = saved;
    }
  };

  const handlePlatformOverride = (event: CustomEvent) => {
    const { platform } = event.detail;
    titleBarPlatformOverride.value = platform;
  };

  // Ensure dark mode is always applied and initialize database
  onMounted(async () => {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');

    // Load platform override from localStorage
    loadPlatformOverride();

    // Check authentication status on app start
    try {
      await authStore.checkAuth();
    } catch (error) {
      console.error('[App] Failed to check authentication:', error);
    }

    // Listen for auth-required events (e.g., when token expires)
    window.addEventListener('auth-required', handleAuthRequired);

    // Listen for show-auth-modal events from components
    window.addEventListener('show-auth-modal', () => {
      showAuthModal.value = true;
    });

    // Listen for platform override events from Admin panel
    window.addEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);

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

    // Hide loading screen after initialization and show main window
    isLoading.value = false;

    // Show the main window now that everything is loaded
    try {
      await invoke('show_main_window');
    } catch (error) {
      console.error('[App] Failed to show main window:', error);
    }
  });

  // Cleanup auth event listener on unmount
  onUnmounted(() => {
    window.removeEventListener('auth-required', handleAuthRequired);
    window.removeEventListener('show-auth-modal', () => {
      showAuthModal.value = true;
    });
    window.removeEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);
  });
</script>

<template>
  <!-- Loading screen -->
  <LoadingScreen v-if="isLoading" />

  <!-- Main app (hidden while loading) -->
  <div v-else class="app-container">
    <!-- Custom titlebar -->
    <TitleBar :dark-mode="true" :platform-override="titleBarPlatformOverride" />

    <!-- Main content area with scrolling -->
    <div class="main-content">
      <!-- Toast notifications provider -->
      <Toast />
      <!-- Router view for page content -->
      <router-view />
      <!-- Global app close confirmation dialog -->
      <AppCloseDialog />
      <!-- Authentication Modal -->
      <AuthModal v-model="showAuthModal" />
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
