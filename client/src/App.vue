<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import Toast from '@/components/Toast.vue';
  import AppCloseDialog from '@/components/AppCloseDialog.vue';
  import TitleBar from '@/components/TitleBar.vue';
  import LoadingScreen from '@/components/LoadingScreen.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import LivestreamWatchDialog from '@/components/LivestreamWatchDialog.vue';
  import MandatoryUpdateDialog from '@/components/MandatoryUpdateDialog.vue';
  import SubscriptionGate from '@/components/SubscriptionGate.vue';
  import BrandingProfileSelector from '@/components/BrandingProfileSelector.vue';
  import AnnouncementDialog from '@/components/AnnouncementDialog.vue';
  import OrganizationInviteDialog from '@/components/OrganizationInviteDialog.vue';
  import FloatingChat from '@/components/chat/FloatingChat.vue';
  import AudioPlayer from '@/components/AudioPlayer.vue';
  import { useAnnouncements } from '@/composables/useAnnouncements';
  import { listMyInvitations, acceptInvitationById, declineInvitation, type OrganizationInvitation } from '@/services/organizationsApi';
  import {
    initDatabase,
    seedDefaultPrompt,
    seedGamingPrompt,
    seedGamblingPrompt,
    seedBreakingNewsPrompt,
    ensureOrganizationAssetColumns,
  } from '@/services/database';
  import { healSchema } from '@/services/database/schema-healing';
  import { initClipBuildEventHandler, cleanupClipBuildEventHandler } from '@/services/clipBuildEventHandler';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { useAuthStore } from '@/stores/auth';
  import { useLivestreamStore } from '@/stores/livestream';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useAppUpdater } from '@/composables/useAppUpdater';
  import { useToast } from '@/composables/useToast';
  import { useActivityTracker } from '@/composables/useActivityTracker';
  import { useMessagingStore } from '@/stores/messaging';
  import { useUserPreferencesStore } from '@/stores/userPreferences';
  import { initGlobalLiveStatusPolling, stopGlobalLiveStatusPolling } from '@/composables/useLivestreamMonitoring';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  // Platform detection for OS-specific styling (e.g., rounded corners on macOS)
  const detectedPlatform = ref<string>('unknown');

  const { initializeWindowCloseHandler } = useWindowClose();
  const authStore = useAuthStore();
  const preferencesStore = useUserPreferencesStore();
  const livestreamStore = useLivestreamStore();
  const { fetchFeatureFlags } = useFeatureFlags();
  const { state: updateState, checkForUpdates } = useAppUpdater();
  const messagingStore = useMessagingStore();
  const { success } = useToast();

  // Track user activity to update last_active_at
  // Will be initialized after authentication check completes
  const { startTracking } = useActivityTracker();

  const { fetchAndEnqueue, subscribeToChannel, unsubscribe } = useAnnouncements();

  // Organization invites state
  const pendingInvitations = ref<OrganizationInvitation[]>([]);
  const currentInvitation = ref<OrganizationInvitation | null>(null);
  const showInviteDialog = ref(false);
  let invitationPollInterval: number | null = null;

  // Fetch pending organization invitations
  const fetchPendingInvitations = async () => {
    if (!authStore.isAuthenticated) return;
    
    const response = await listMyInvitations();
    if (response.success && response.invitations.length > 0) {
      // Check if there are new invitations
      const newInvitations = response.invitations.filter(
        invite => !pendingInvitations.value.some(existing => existing.id === invite.id)
      );
      
      pendingInvitations.value = response.invitations;
      
      // Show the first invitation if dialog is not already showing
      if (!showInviteDialog.value && pendingInvitations.value.length > 0) {
        currentInvitation.value = pendingInvitations.value[0];
        showInviteDialog.value = true;
      }
    } else {
      pendingInvitations.value = [];
    }
  };

  // Start polling for new invitations (every 30 seconds)
  const startInvitationPolling = () => {
    if (invitationPollInterval) return; // Already polling
    
    // Fetch immediately
    fetchPendingInvitations();
    
    // Then poll every 30 seconds
    invitationPollInterval = window.setInterval(() => {
      fetchPendingInvitations();
    }, 30000); // 30 seconds
  };

  // Stop polling for invitations
  const stopInvitationPolling = () => {
    if (invitationPollInterval) {
      clearInterval(invitationPollInterval);
      invitationPollInterval = null;
    }
  };

  // Handle invitation acceptance
  const handleAcceptInvitation = async (invitation: OrganizationInvitation) => {
    const result = await acceptInvitationById(invitation.id);
    
    if (result.success) {
      success(`You've joined ${invitation.organization_name}!`);
      // Remove from pending list
      pendingInvitations.value = pendingInvitations.value.filter(inv => inv.id !== invitation.id);
      showInviteDialog.value = false;
      
      // Refresh auth to get updated organization membership
      await authStore.checkAuth();
      
      // Show next invitation if any
      if (pendingInvitations.value.length > 0) {
        setTimeout(() => {
          currentInvitation.value = pendingInvitations.value[0];
          showInviteDialog.value = true;
        }, 500);
      }
    } else {
      success(result.error || 'Failed to accept invitation', 'error');
    }
  };

  // Handle invitation decline
  const handleDeclineInvitation = async (invitation: OrganizationInvitation) => {
    const result = await declineInvitation(invitation.id);
    
    if (result.success) {
      success('Invitation declined');
    }
    
    // Remove from pending list
    pendingInvitations.value = pendingInvitations.value.filter(inv => inv.id !== invitation.id);
    showInviteDialog.value = false;
    
    // Show next invitation if any
    if (pendingInvitations.value.length > 0) {
      setTimeout(() => {
        currentInvitation.value = pendingInvitations.value[0];
        showInviteDialog.value = true;
      }, 500);
    }
  };

  // Update check must complete before app continues
  const isCheckingForUpdates = ref(true);
  const updateRequired = ref(false);

  const isLoading = ref(true);
  const titleBarPlatformOverride = ref('auto');
  const showAuthModal = ref(false);
  const router = useRouter();

  // Check if this is the PIP window (no title bar needed)
  const isPipWindow = computed(() => window.location.pathname === '/pip-controls');

  // Check if this is the full-screen editor page (no scroll, minimal chrome)
  const currentRoute = useRoute();
  const isEditorPage = computed(() => currentRoute.path === '/editor');

  // Authentication Gate: Block all app interaction until user authenticates
  const requiresAuthGate = computed(() => {
    return !authStore.isAuthenticated && !isPipWindow.value;
  });

  // Subscription Gate: Force plan selection for authenticated users
  const requiresSubscriptionGate = computed(() => {
    if (!authStore.isAuthenticated) return false;
    if (isPipWindow.value) return false;
    if (authStore.user?.is_admin) return false;
    if (authStore.user?.account_type === 'organization' || authStore.user?.owned_organization_id) return false;
    if (authStore.user?.created_by_organization_id) return false;
    if (currentRoute.path === '/billing') return false;

    const subscriptionStatus = (authStore.user as any)?.subscription?.status;
    const hasSelectedPlan = localStorage.getItem('has_selected_plan');

    console.log('[App] Subscription gate check:', {
      subscriptionStatus,
      hasSelectedPlan,
      userSubscription: (authStore.user as any)?.subscription,
    });

    // Users with active or cancelled subscriptions always bypass the gate
    if (subscriptionStatus === 'active' || subscriptionStatus === 'cancelled') {
      // Also set the flag so future checks are faster
      if (!hasSelectedPlan) {
        localStorage.setItem('has_selected_plan', 'true');
      }
      return false;
    }

    // Show gate only if:
    // 1. No plan has been selected AND
    // 2. Subscription is either expired or doesn't exist (none/undefined)
    if (!hasSelectedPlan) {
      console.log('[App] No plan selected, showing subscription gate');
      return true;
    }

    // If plan was selected (including free tier), allow access even if subscription expired
    // User has explicitly chosen to continue with free tier
    console.log('[App] Plan selected (including free tier), bypassing gate');
    return false;
  });

  // Sidebar should be disabled when subscription gate is active
  const sidebarDisabled = computed(() => requiresSubscriptionGate.value);

  // Beta activation removed - beta codes are now only required for downloads on landing page

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

  // Handle streamer went live event (skip toast on Live page — status already visible)
  const handleStreamerWentLive = (event: CustomEvent) => {
    if (currentRoute.path.startsWith('/live-clip')) return;
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

  // Watch for subscription gate and redirect to billing
  // Also watch authStore.user to re-evaluate when user data loads
  // Only start watching AFTER the app is initialized (isLoading = false)
  watch(
    [requiresSubscriptionGate, () => authStore.user, isLoading],
    ([needsGate, _user, loading]) => {
      // Don't run during initialization to avoid redirect loops
      if (loading) return;
      
      console.log('[App] Subscription gate watch triggered:', {
        needsGate,
        currentPath: currentRoute.path,
        isAuthenticated: authStore.isAuthenticated,
        userId: authStore.user?.id,
      });
      if (needsGate && currentRoute.path !== '/billing') {
        console.log('[App] Subscription gate active, redirecting to billing');
        router.push('/billing?subscription_required=true');
      }
    }
  );

  // Clear plan selection flag on logout
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (!isAuth) {
        localStorage.removeItem('has_selected_plan');
      }
    }
  );

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
      
      // Start polling for organization invitations
      startInvitationPolling();
    } else if (!event.detail?.userId) {
      // User logged out — clear announcement queue and leave channel
      unsubscribe();
      // Clear plan selection flag
      localStorage.removeItem('has_selected_plan');
      // Stop polling and clear pending invitations
      stopInvitationPolling();
      pendingInvitations.value = [];
      currentInvitation.value = null;
      showInviteDialog.value = false;
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

  // Window resize handler with debouncing
  let resizeTimeout: number | null = null;
  const handleWindowResize = async () => {
    // Debounce resize events to avoid excessive saves
    if (resizeTimeout !== null) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = window.setTimeout(async () => {
      try {
        const appWindow = getCurrentWindow();
        const size = await appWindow.innerSize();
        // Don't persist minimized/collapsed window sizes
        if (size.width < 800 || size.height < 600) return;
        await invoke('save_window_size', {
          width: size.width,
          height: size.height,
        });
      } catch (error) {
        console.error('[App] Failed to save window size:', error);
      }
    }, 500); // Wait 500ms after resize stops before saving
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

    // Set up window resize listener to save size
    const appWindow = getCurrentWindow();
    const unlistenResize = await appWindow.onResized(handleWindowResize);

    // Store unlisten function for cleanup
    (window as any).__unlistenWindowResize = unlistenResize;

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
    console.log('[App] initializeApp started, current path:', window.location.pathname);
    
    // Check if this is the PIP window - it only needs minimal initialization
    const isPipWindow = window.location.pathname === '/pip-controls';

    if (isPipWindow) {
      // PIP window only needs to show content, no DB/auth/etc
      console.log('[App] PIP window detected, skipping full init');
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
    console.log('[App] Starting parallel initialization tasks...');
    await Promise.allSettled([
      // Auth path: check auth, then start tracker + fetch announcements if authenticated
      (async () => {
        console.log('[App] Starting auth check...');
        await authStore.checkAuth();
        console.log('[App] Auth check complete:', {
          isAuthenticated: authStore.isAuthenticated,
          userId: authStore.user?.id,
          accountType: authStore.user?.account_type,
        });
        if (authStore.isAuthenticated) {
          console.log('[App] User authenticated, starting activity tracker');
          startTracking();
          // Load preferences from local cache immediately (server sync happens via event)
          if (authStore.user?.id) {
            preferencesStore
              .loadFromLocal(String(authStore.user.id))
              .catch((e) => console.error('[App] Failed to load local preferences:', e));
          }
          // Announcements don't need to block startup - fire and forget
          fetchAndEnqueue().catch((e) => console.error('[App] Failed to fetch announcements:', e));
          subscribeToChannel(authStore.user?.account_type ?? 'personal');
          // Initialize global messaging socket for floating chat
          messagingStore.initializeGlobal().catch((e) => console.error('[App] Failed to init global messaging:', e));
          // Start polling for organization invitations
          startInvitationPolling();
        }
      })().catch((error) => {
        console.error('[App] Failed to check authentication:', error);
      }),

      // Feature flags (independent)
      (async () => {
        console.log('[App] Starting feature flags fetch...');
        await fetchFeatureFlags();
        console.log('[App] Feature flags fetch complete');
      })().catch((error) => {
        console.error('[App] Failed to fetch feature flags:', error);
      }),

      // Database init (local only, no network)
      (async () => {
        console.log('[App] Starting database initialization...');
        await initDatabase();
        console.log('[App] Database initialized, starting schema healing...');
        await healSchema();
        console.log('[App] Schema healing complete, seeding prompts...');
        await seedDefaultPrompt();
        await seedGamingPrompt();
        await seedGamblingPrompt();
        await seedBreakingNewsPrompt();
        await ensureOrganizationAssetColumns();
        console.log('[App] Database initialization complete');
      })().catch((error) => {
        console.error('[App] Failed to initialize database:', error);
      }),
    ]);
    console.log('[App] All parallel initialization tasks completed');

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

    // Wait for router to be ready before hiding loading screen
    // This ensures the route is fully resolved and the component will mount
    console.log('[App] Waiting for router to be ready...');
    await router.isReady();
    console.log('[App] Router ready, current route:', router.currentRoute.value.path);
    console.log('[App] Router current route details:', {
      path: router.currentRoute.value.path,
      name: router.currentRoute.value.name,
      matched: router.currentRoute.value.matched.length,
    });

    // Hide loading screen - app is usable now
    console.log('[App] Hiding loading screen, showing main app');
    isLoading.value = false;
    console.log('[App] isLoading set to false, app should be visible now');

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

    // Cleanup window resize listener
    const unlistenResize = (window as any).__unlistenWindowResize;
    if (unlistenResize) {
      unlistenResize();
    }

    // Cleanup global clip build event handler
    cleanupClipBuildEventHandler();
    
    // Stop invitation polling
    stopInvitationPolling();
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
    <!-- Mandatory Authentication Gate (blocks all interaction until authenticated) -->
    <AuthModal v-if="requiresAuthGate" :model-value="true" :mandatory="true" />

    <!-- Custom titlebar (hidden for PIP window) -->
    <TitleBar v-if="!isPipWindow" :dark-mode="true" :platform-override="titleBarPlatformOverride" />

    <!-- Main content area with scrolling -->
    <div
      class="main-content dashboard-container"
      :class="{ 'pip-content': isPipWindow, 'editor-content': isEditorPage }"
    >
      <!-- Toast notifications provider -->
      <Toast />
      <!-- Router view for page content (key changes on auth to force refresh) -->
      <router-view :key="routerKey" :sidebar-disabled="sidebarDisabled" />
      <!-- Global app close confirmation dialog -->
      <AppCloseDialog />
      <!-- Authentication Modal (optional, for manual trigger) -->
      <AuthModal v-model="showAuthModal" />

      <!-- Subscription Gate Dialog (triggered on protected actions) -->
      <SubscriptionGate />

      <!-- Global Branding Profile Selector Dialog -->
      <BrandingProfileSelector />

      <!-- Global Announcement Dialog -->
      <AnnouncementDialog />

      <!-- Organization Invite Dialog -->
      <OrganizationInviteDialog
        v-model="showInviteDialog"
        :invitation="currentInvitation"
        @accept="handleAcceptInvitation"
        @decline="handleDeclineInvitation"
      />

      <!-- Floating Chat Widget (Messenger-style popout) -->
      <FloatingChat />

      <!-- Global Audio Player -->
      <AudioPlayer />

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
