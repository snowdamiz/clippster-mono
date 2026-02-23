<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import Toast from '@/components/Toast.vue';
  import AppCloseDialog from '@/components/AppCloseDialog.vue';
  import TitleBar from '@/components/TitleBar.vue';
  import LoadingScreen from '@/components/LoadingScreen.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import BetaActivationDialog from '@/components/BetaActivationDialog.vue';
  import LivestreamWatchDialog from '@/components/LivestreamWatchDialog.vue';
  import MandatoryUpdateDialog from '@/components/MandatoryUpdateDialog.vue';
  import SubscriptionGate from '@/components/SubscriptionGate.vue';
  import BrandingProfileSelector from '@/components/BrandingProfileSelector.vue';
  import AnnouncementDialog from '@/components/AnnouncementDialog.vue';
  import { useAnnouncements } from '@/composables/useAnnouncements';
  import { initDatabase, seedDefaultPrompt, seedGamingPrompt, seedGamblingPrompt, seedBreakingNewsPrompt, ensureOrganizationAssetColumns } from '@/services/database';
  import { healSchema } from '@/services/database/schema-healing';
  import { initClipBuildEventHandler, cleanupClipBuildEventHandler } from '@/services/clipBuildEventHandler';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { useAuthStore } from '@/stores/auth';
  import { useLivestreamStore } from '@/stores/livestream';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useAppUpdater } from '@/composables/useAppUpdater';
  import { useToast } from '@/composables/useToast';
  import { useActivityTracker } from '@/composables/useActivityTracker';
  import { useUserPreferencesStore } from '@/stores/userPreferences';
  import { initGlobalLiveStatusPolling, stopGlobalLiveStatusPolling } from '@/composables/useLivestreamMonitoring';
  import { invoke } from '@tauri-apps/api/core';

  // Platform detection for OS-specific styling (e.g., rounded corners on macOS)
  const detectedPlatform = ref<string>('unknown');

  const { initializeWindowCloseHandler } = useWindowClose();
  const authStore = useAuthStore();
  const preferencesStore = useUserPreferencesStore();
  const livestreamStore = useLivestreamStore();
  const { isBetaModeEnabled, fetchFeatureFlags } = useFeatureFlags();
  const { state: updateState, checkForUpdates } = useAppUpdater();
  const { success } = useToast();
  
  // Track user activity to update last_active_at
  // Will be initialized after authentication check completes
  const { startTracking } = useActivityTracker();

  const { fetchAndEnqueue, subscribeToChannel, unsubscribe } = useAnnouncements();

  // Update check must complete before app continues
  const isCheckingForUpdates = ref(true);
  const updateRequired = ref(false);

  const isLoading = ref(true);
  const titleBarPlatformOverride = ref('auto');
  const showAuthModal = ref(false);

  // Check if this is the PIP window (no title bar needed)
  const isPipWindow = computed(() => window.location.pathname === '/pip-controls');

  // Check if this is the full-screen editor page (no scroll, minimal chrome)
  const currentRoute = useRoute();
  const isEditorPage = computed(() => currentRoute.path === '/editor');

  // Show beta activation dialog when:
  // - User is authenticated
  // - Beta mode is enabled
  // - User is not an admin (admins bypass beta requirement)
  // - User has not activated their beta access
  const showBetaActivationDialog = computed(() => {
    return (
      authStore.isAuthenticated &&
      isBetaModeEnabled.value &&
      !authStore.user?.is_admin &&
      !authStore.user?.beta_activated
    );
  });

  // Handle beta activation success
  const handleBetaActivated = async () => {
    // Refresh user data to get updated beta_activated status
    await authStore.checkAuth();
  };

  // Handle logout from beta dialog
  const handleBetaLogout = async () => {
    await authStore.logout();
  };

  // Handle clip created from global livestream dialog
  function handleClipCreated(clipPath: string, projectId: string) {
    console.log('[App] Clip created:', { clipPath, projectId });
    // Dispatch event so LiveClip page can react if open
    window.dispatchEvent(
      new CustomEvent('livestream-clip-created', {
        detail: { clipPath, projectId },
      })
    );
  }

  // Handle streamer went live event
  const handleStreamerWentLive = (event: CustomEvent) => {
    const { displayName } = event.detail;
    success(`${displayName} is now live!`, undefined, 7000, 'livestream');
  };

  // Handle user preferences loaded from server (dispatched by auth store)
  const handlePreferencesLoaded = (event: CustomEvent) => {
    const { userId, preferences } = event.detail;
    if (userId && preferences) {
      preferencesStore.syncFromServer(userId, preferences);
    }
  };

  // Key for router-view to force re-render on auth changes
  const routerKey = ref(0);

  // Auth event listener function
  const handleAuthRequired = () => {
    console.log('[App] Auth required, showing auth modal');
    showAuthModal.value = true;
  };

  // Handle auth state changes (login/logout) by refreshing the router view
  const handleAuthStateChanged = async (event: CustomEvent) => {
    console.log('[App] Auth state changed, refreshing data. User ID:', event.detail?.userId);
    
    if (event.detail?.userId && authStore.isAuthenticated) {
      console.log('[App] User logged in, starting activity tracker');
      startTracking();

      // Fetch and show any unseen announcements for the newly logged-in user
      await fetchAndEnqueue();
      subscribeToChannel(authStore.user?.account_type ?? 'personal');
    } else if (!event.detail?.userId) {
      // User logged out — clear announcement queue and leave channel
      unsubscribe();
    }
    
    // Increment key to force Vue to re-mount all route components
    routerKey.value++;
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

    // Detect platform for OS-specific styling (e.g., rounded corners on macOS)
    // This supplements the early detection in index.html with accurate Tauri-based detection
    try {
      const platform = (await invoke('get_platform')) as string;
      detectedPlatform.value = platform;
      // Add platform class to document for CSS targeting (classList.add handles duplicates)
      document.documentElement.classList.add(`platform-${platform}`);
    } catch (error) {
      console.error('[App] Failed to detect platform:', error);
    }

    // Load platform override from localStorage
    loadPlatformOverride();

    // Show the main window early so users can see the update check
    try {
      await invoke('show_main_window');
    } catch (error) {
      console.error('[App] Failed to show main window:', error);
    }

    // MANDATORY UPDATE CHECK - must complete before app continues
    // Skip update check in development environment
    if (import.meta.env.DEV) {
      console.log('[App] Skipping update check in development mode');
      isCheckingForUpdates.value = false;
    } else {
      // Check for updates FIRST before any other initialization
      try {
        console.log('[App] Checking for mandatory updates...');
        const hasUpdate = await checkForUpdates();
        if (hasUpdate) {
          console.log('[App] Update required - blocking app until update is installed');
          updateRequired.value = true;
          isCheckingForUpdates.value = false;
          // Stop here - user must update before continuing
          return;
        }
        console.log('[App] No update required, continuing with app initialization');
      } catch (error) {
        console.error('[App] Failed to check for updates:', error);
        // On error, allow app to continue (don't block users if update server is down)
      }
      isCheckingForUpdates.value = false;
    }

    // Continue with normal app initialization only if no update required
    await initializeApp();
  });

  // Separate function for app initialization (called after update check passes)
  async function initializeApp() {
    // Check if this is the PIP window - it only needs minimal initialization
    const isPipWindow = window.location.pathname === '/pip-controls';

    if (isPipWindow) {
      // PIP window only needs to show content, no DB/auth/etc
      isLoading.value = false;
      return;
    }

    // Register event listeners (synchronous, no reason to delay)
    window.addEventListener('auth-required', handleAuthRequired);
    window.addEventListener('show-auth-modal', () => {
      showAuthModal.value = true;
    });
    window.addEventListener('auth-state-changed', handleAuthStateChanged as unknown as EventListener);
    window.addEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);
    window.addEventListener('streamer-went-live', handleStreamerWentLive as EventListener);
    window.addEventListener('user-preferences-loaded', handlePreferencesLoaded as EventListener);

    // Run independent startup tasks in parallel:
    // - Auth check + announcements (announcements depend on auth, but both are independent of DB)
    // - Feature flags (independent of everything)
    // - Database init + schema healing + seeds (independent of network)
    await Promise.allSettled([
      // Auth path: check auth, then start tracker + fetch announcements if authenticated
      (async () => {
        await authStore.checkAuth();
        if (authStore.isAuthenticated) {
          console.log('[App] User authenticated, starting activity tracker');
          startTracking();
          // Load preferences from local cache immediately (server sync happens via event)
          if (authStore.user?.id) {
            preferencesStore.loadFromLocal(String(authStore.user.id)).catch((e) =>
              console.error('[App] Failed to load local preferences:', e)
            );
          }
          // Announcements don't need to block startup - fire and forget
          fetchAndEnqueue().catch((e) => console.error('[App] Failed to fetch announcements:', e));
          subscribeToChannel(authStore.user?.account_type ?? 'personal');
        }
      })().catch((error) => {
        console.error('[App] Failed to check authentication:', error);
      }),

      // Feature flags (independent)
      fetchFeatureFlags().catch((error) => {
        console.error('[App] Failed to fetch feature flags:', error);
      }),

      // Database init (local only, no network)
      (async () => {
        await initDatabase();
        await healSchema();
        await seedDefaultPrompt();
        await seedGamingPrompt();
        await seedGamblingPrompt();
        await seedBreakingNewsPrompt();
        await ensureOrganizationAssetColumns();
      })().catch((error) => {
        console.error('[App] Failed to initialize database:', error);
      }),
    ]);

    // These are fast local operations, run them after the parallel batch
    try {
      await initializeWindowCloseHandler();
    } catch (error) {
      console.error('[App] Failed to initialize window close handler:', error);
    }

    try {
      await initClipBuildEventHandler();
    } catch (error) {
      console.error('[App] Failed to initialize clip build event handler:', error);
    }

    // Hide loading screen - app is usable now
    isLoading.value = false;

    // Live status polling runs in the background AFTER the app is visible.
    // It makes N external API calls and should never block the loading screen.
    initGlobalLiveStatusPolling().catch((error) => {
      console.error('[App] Failed to initialize global live status polling:', error);
    });
  }

  // Cleanup auth event listener on unmount
  onUnmounted(() => {
    window.removeEventListener('auth-required', handleAuthRequired);
    window.removeEventListener('show-auth-modal', () => {
      showAuthModal.value = true;
    });
    window.removeEventListener('titlebar-platform-override', handlePlatformOverride as EventListener);
    window.removeEventListener('auth-state-changed', handleAuthStateChanged as unknown as EventListener);
    window.removeEventListener('streamer-went-live', handleStreamerWentLive as EventListener);
    window.removeEventListener('user-preferences-loaded', handlePreferencesLoaded as EventListener);

    // Cleanup global clip build event handler
    cleanupClipBuildEventHandler();
  });
</script>

<template>
  <!-- Mandatory Update Dialog - blocks entire app when update is required -->
  <MandatoryUpdateDialog
    v-if="
      isCheckingForUpdates ||
      updateRequired ||
      updateState.status === 'available' ||
      updateState.status === 'downloading' ||
      updateState.status === 'installing'
    "
  />

  <!-- Loading screen (only shown after update check passes) -->
  <LoadingScreen v-else-if="isLoading" />

  <!-- Main app (hidden while loading or updating) -->
  <div v-else class="app-container">
    <!-- Custom titlebar (hidden for PIP window) -->
    <TitleBar v-if="!isPipWindow" :dark-mode="true" :platform-override="titleBarPlatformOverride" />

    <!-- Main content area with scrolling -->
    <div class="main-content dashboard-container" :class="{ 'pip-content': isPipWindow, 'editor-content': isEditorPage }">
      <!-- Toast notifications provider -->
      <Toast />
      <!-- Router view for page content (key changes on auth to force refresh) -->
      <router-view :key="routerKey" />
      <!-- Global app close confirmation dialog -->
      <AppCloseDialog />
      <!-- Authentication Modal -->
      <AuthModal v-model="showAuthModal" />

      <!-- Beta Activation Dialog -->
      <BetaActivationDialog
        :show="showBetaActivationDialog"
        @activated="handleBetaActivated"
        @logout="handleBetaLogout"
      />

      <!-- Subscription Gate Dialog (triggered on protected actions) -->
      <SubscriptionGate />

      <!-- Global Branding Profile Selector Dialog -->
      <BrandingProfileSelector />

      <!-- Global Announcement Dialog -->
      <AnnouncementDialog />

      <!-- Global Livestream Watch Dialog (persists across navigation for PIP mode) -->
      <LivestreamWatchDialog
        v-if="livestreamStore.currentStreamer.mintId"
        v-model="livestreamStore.watchState.isOpen"
        :mint-id="livestreamStore.currentStreamer.mintId"
        :streamer-id="livestreamStore.currentStreamer.streamerId"
        :display-name="livestreamStore.currentStreamer.displayName"
        :profile-image-url="livestreamStore.currentStreamer.profileImageUrl"
        :platform="livestreamStore.watchState.platform"
        :is-pip-mode-external="livestreamStore.isInPipMode"
        @clip-created="handleClipCreated"
        @pip-mode-changed="(isPip: boolean) => (isPip ? livestreamStore.enterPipMode() : livestreamStore.exitPipMode())"
        @closed="livestreamStore.reset()"
      />
    </div>
  </div>
</template>

<style scoped>
  .app-container {
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .main-content {
    width: 100%;
    height: calc(100vh - 32px);
    margin-top: 32px; /* Account for fixed titlebar height */
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
  }

  .main-content.pip-content {
    height: 100vh;
    margin-top: 0; /* No title bar in PIP window */
    overflow: hidden;
  }

  .dashboard-container {
    background-color: var(--sidebar-bg);
  }

  .main-content.editor-content {
    overflow: hidden;
  }
</style>
