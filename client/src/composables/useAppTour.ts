import { ref, computed, watch } from 'vue';
import {
  type TourId,
  type TourStep,
  type TourContext,
  type CompletedTours,
  TOUR_VERSION,
  desktopSidebarTour,
  pageTours,
  landingOrgTour,
  filterVisibleSteps,
} from '@clippster/app-tour';
import { useUserPreferencesStore } from '@/stores/userPreferences';
import { useAuthStore } from '@/stores/auth';
import { useSidebarState } from '@/composables/useSidebarState';

const activeTourId = ref<TourId | null>(null);
const currentStepIndex = ref(0);
const showWelcome = ref(false);
const isTourActive = computed(() => activeTourId.value !== null);
const mockStreamerActive = ref(false);
const mockProjectActive = ref(false);
const forceSidebarExpanded = ref(false);

/** Default name for the real project opened during the video-editor tour */
const TOUR_VIDEO_PROJECT_NAME = 'Untitled Project';
/** Set while navigating to an editor; started once the editor UI is mounted */
const pendingEditorTour = ref<TourId | null>(null);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function setGateSuppress(on: boolean): void {
  try {
    if (on) sessionStorage.setItem('app_tour_suppress_gates', '1');
    else sessionStorage.removeItem('app_tour_suppress_gates');
  } catch {
    /* ignore */
  }
}

export function useAppTour() {
  const preferencesStore = useUserPreferencesStore();
  const authStore = useAuthStore();
  const { expand } = useSidebarState();

  const completedTours = computed<CompletedTours>(() => {
    return (preferencesStore.preferences.completed_tours || {}) as CompletedTours;
  });

  const activeSteps = computed<TourStep[]>(() => {
    if (!activeTourId.value) return [];
    const def =
      activeTourId.value === 'desktop_sidebar'
        ? desktopSidebarTour
        : activeTourId.value === 'landing_org'
          ? landingOrgTour
          : pageTours[activeTourId.value];
    if (!def) return [];
    return filterVisibleSteps(def.steps, buildContext());
  });

  const currentStep = computed(() => activeSteps.value[currentStepIndex.value] ?? null);

  const progress = computed(() => ({
    current: currentStepIndex.value + 1,
    total: Math.max(activeSteps.value.length, 1),
  }));

  function buildContext(): TourContext {
    return {
      isAdmin: !!authStore.user?.is_admin,
      isAffiliate: !!(authStore.user as any)?.is_affiliate,
      isLiveClipEnabled: true,
      isRestricted: !!(authStore.user as any)?.is_restricted,
      isTourActive: isTourActive.value,
      completedTours: completedTours.value,
    };
  }

  function getAuthToken(): string | null {
    return (authStore as any).getAuthToken?.() || authStore.token || localStorage.getItem('auth_token');
  }

  function hasCompleted(tourId: TourId): boolean {
    return !!completedTours.value[tourId];
  }

  async function markTourComplete(tourId: TourId): Promise<void> {
    const userId = authStore.user?.id;
    const token = getAuthToken();
    const next = {
      ...completedTours.value,
      [tourId]: todayIso(),
    };

    if (userId) {
      const { saveLocalPreferences } = await import('@/services/database/user-preferences');
      try {
        await saveLocalPreferences(String(userId), {
          completed_tours: next,
          tour_version_seen: TOUR_VERSION,
        });
        preferencesStore.preferences.completed_tours = next;
        preferencesStore.preferences.tour_version_seen = TOUR_VERSION;
      } catch (e) {
        console.warn('[AppTour] Failed to persist tour completion locally', e);
      }
    }

    if (!userId || !token) return;

    const ok = await preferencesStore.updatePreferences(
      {
        completed_tours: next,
        tour_version_seen: TOUR_VERSION,
      },
      String(userId),
      token
    );
    if (!ok) {
      // Keep local completion so editor nav isn't re-intercepted after a failed sync
      preferencesStore.preferences.completed_tours = next;
      preferencesStore.preferences.tour_version_seen = TOUR_VERSION;
    }
  }

  async function restartTour(tourId: TourId): Promise<void> {
    const userId = authStore.user?.id;
    const token = getAuthToken();
    if (userId && token) {
      const next = { ...completedTours.value };
      delete next[tourId];
      await preferencesStore.updatePreferences({ completed_tours: next }, String(userId), token);
    }
    if (tourId === 'desktop_sidebar') {
      openWelcome();
      return;
    }
    if (tourId === 'page_video_editor' || tourId === 'page_image_editor') {
      const routerMod = await import('@/router');
      const router = routerMod.default;
      const kind = tourId === 'page_video_editor' ? 'video' : 'image';
      // Completion key already cleared above — force the editor tour path
      if (kind === 'video') {
        const { createVideoEditorProject } = await import('@/services/database/video-editor-projects');
        const projectId = await createVideoEditorProject(TOUR_VIDEO_PROJECT_NAME);
        pendingEditorTour.value = 'page_video_editor';
        await router.push({ path: '/editor', query: { projectId, tour: '1' } });
      } else {
        pendingEditorTour.value = 'page_image_editor';
        await router.push({ path: '/design-studio/edit', query: { tour: '1' } });
      }
      return;
    }

    const pageRoutes: Partial<Record<TourId, string>> = {
      page_creators: '/creators',
      page_live_clip: '/live-clip',
      page_vods: '/vods',
      page_projects: '/projects',
    };
    const route = pageRoutes[tourId];
    if (route) {
      const routerMod = await import('@/router');
      await routerMod.default.push(route);
      // Page onMounted calls maybeStartPageTour once completion key is cleared
      maybeStartPageTour(tourId);
      return;
    }
    startTour(tourId);
  }

  function startTour(tourId: TourId): void {
    activeTourId.value = tourId;
    currentStepIndex.value = 0;
    showWelcome.value = false;
    forceSidebarExpanded.value = tourId === 'desktop_sidebar';
    if (tourId === 'desktop_sidebar') expand();
    // Suppress free-tier product gates during teaching tours (not AI)
    setGateSuppress(tourId !== 'landing_org');
    syncMockFlags();
  }

  function openWelcome(): void {
    if (hasCompleted('desktop_sidebar')) return;
    if (isTourActive.value) return;
    showWelcome.value = true;
  }

  /**
   * Show the sidebar welcome once for any account (free or paid) that has not
   * completed/skipped the tour. Restart from Account Settings is the only re-trigger.
   */
  async function maybeShowSidebarWelcome(): Promise<void> {
    if (!authStore.isAuthenticated) return;
    const userId = authStore.user?.id;
    const token =
      (authStore as any).getAuthToken?.() || authStore.token || localStorage.getItem('auth_token');
    if (userId && token && !preferencesStore.syncedFromServer) {
      await preferencesStore.ensureSyncedFromServer(String(userId), token);
    }
    if (!preferencesStore.syncedFromServer) return;
    if (hasCompleted('desktop_sidebar')) return;
    if (showWelcome.value || isTourActive.value) return;
    sessionStorage.removeItem('pending_app_tour');
    openWelcome();
  }

  function acceptWelcome(): void {
    showWelcome.value = false;
    startTour('desktop_sidebar');
  }

  async function skipWelcome(): Promise<void> {
    showWelcome.value = false;
    await markTourComplete('desktop_sidebar');
  }

  function syncMockFlags(): void {
    const step = currentStep.value;
    mockStreamerActive.value = step?.injectMock === 'streamer';
    mockProjectActive.value = step?.injectMock === 'project';
  }

  async function nextStep(): Promise<void> {
    if (currentStepIndex.value >= activeSteps.value.length - 1) {
      await finishTour();
      return;
    }
    currentStepIndex.value += 1;
    syncMockFlags();
  }

  /**
   * After skip/complete of an editor tour: keep the editor open on the same
   * project (it is the user's real starting project) and drop ?tour=1.
   */
  async function finalizeEditorTour(): Promise<void> {
    try {
      const { default: router } = await import('@/router');
      const route = router.currentRoute.value;
      if (route.query.tour == null) return;
      const nextQuery = { ...route.query };
      delete nextQuery.tour;
      await router.replace({ path: route.path, query: nextQuery });
    } catch (e) {
      console.warn('[AppTour] Failed to clear tour query after editor tour', e);
    }
  }

  async function finishTour(): Promise<void> {
    const id = activeTourId.value;
    const wasEditorTour = id === 'page_video_editor' || id === 'page_image_editor';
    clearTourState();
    if (id) await markTourComplete(id);
    if (wasEditorTour) {
      await finalizeEditorTour();
    }
  }

  async function skipTour(): Promise<void> {
    await finishTour();
  }

  function clearTourState(): void {
    activeTourId.value = null;
    currentStepIndex.value = 0;
    forceSidebarExpanded.value = false;
    mockStreamerActive.value = false;
    mockProjectActive.value = false;
    pendingEditorTour.value = null;
    setGateSuppress(false);
  }

  /** Call after plan selection */
  function setPendingSidebarTour(): void {
    sessionStorage.setItem('pending_app_tour', 'desktop_sidebar');
  }

  function consumePendingSidebarTour(): boolean {
    const pending = sessionStorage.getItem('pending_app_tour');
    if (pending === 'desktop_sidebar' && !hasCompleted('desktop_sidebar')) {
      sessionStorage.removeItem('pending_app_tour');
      return true;
    }
    if (pending) sessionStorage.removeItem('pending_app_tour');
    return false;
  }

  /** Page tour: only if sidebar done/skipped and this page not completed */
  function maybeStartPageTour(tourId: TourId): void {
    if (!hasCompleted('desktop_sidebar')) return;
    if (hasCompleted(tourId)) return;
    if (isTourActive.value) return;
    startTour(tourId);
  }

  /** Sync gate — callers must preventDefault before awaiting the async handler. */
  function shouldInterceptEditorNav(kind: 'video' | 'image'): boolean {
    if (!hasCompleted('desktop_sidebar')) return false;
    const tourId: TourId = kind === 'video' ? 'page_video_editor' : 'page_image_editor';
    if (hasCompleted(tourId)) return false;
    if (isTourActive.value) return false;
    return true;
  }

  /**
   * First-click interceptor for Video Editor / Image Editor tabs.
   * Caller must call shouldInterceptEditorNav + preventDefault synchronously first.
   */
  async function handleEditorNavClick(
    kind: 'video' | 'image',
    router: { push: (loc: any) => Promise<any> | any }
  ): Promise<boolean> {
    if (!shouldInterceptEditorNav(kind)) return false;

    if (kind === 'video') {
      const { createVideoEditorProject } = await import('@/services/database/video-editor-projects');
      const projectId = await createVideoEditorProject(TOUR_VIDEO_PROJECT_NAME);
      pendingEditorTour.value = 'page_video_editor';
      // tour=1 survives remounts / races so OpenCutEditor can start the walkthrough
      await router.push({ path: '/editor', query: { projectId, tour: '1' } });
    } else {
      pendingEditorTour.value = 'page_image_editor';
      await router.push({ path: '/design-studio/edit', query: { tour: '1' } });
    }
    return true;
  }

  /**
   * Call from OpenCutEditor / ImageEditor after the editor chrome is on screen.
   * Pass tourId when the route has ?tour=1 so we don't rely only on in-memory pending.
   */
  function notifyEditorReadyForTour(tourId?: TourId): void {
    const id = tourId ?? pendingEditorTour.value;
    if (!id) return;
    if (id !== 'page_video_editor' && id !== 'page_image_editor') return;
    if (hasCompleted(id) || isTourActive.value) {
      pendingEditorTour.value = null;
      return;
    }
    pendingEditorTour.value = null;
    startTour(id);
  }

  watch(currentStep, syncMockFlags);

  return {
    activeTourId,
    currentStepIndex,
    currentStep,
    activeSteps,
    progress,
    showWelcome,
    isTourActive,
    mockStreamerActive,
    mockProjectActive,
    forceSidebarExpanded,
    completedTours,
    hasCompleted,
    startTour,
    openWelcome,
    maybeShowSidebarWelcome,
    acceptWelcome,
    skipWelcome,
    nextStep,
    finishTour,
    skipTour,
    restartTour,
    setPendingSidebarTour,
    consumePendingSidebarTour,
    maybeStartPageTour,
    markTourComplete,
    shouldInterceptEditorNav,
    handleEditorNavClick,
    notifyEditorReadyForTour,
  };
}

/** Singleton-friendly refs for components outside setup that need tour flags */
export function useTourFlags() {
  return {
    isTourActive,
    mockStreamerActive,
    mockProjectActive,
    forceSidebarExpanded,
    activeTourId,
  };
}
