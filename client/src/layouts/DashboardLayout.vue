<template>
  <div class="dashboard-container flex h-full">
    <DashboardSidebar :disabled="sidebarDisabled" @show-auth-modal="showAuthModal = true" />
    <!-- Main content area with left margin to account for fixed sidebar -->
    <main
      class="flex-1 flex flex-col transition-[margin-left] duration-200 ease-out dashboard-container"
      :class="isCollapsed ? 'ml-12' : 'ml-60'"
    >
      <!-- <DashboardHeader /> -->
      <!-- Page content: rendered via slot so layouts like OrganizationLayout
           can inject their own gated router-view instead of this default one. -->
      <div class="flex-1 min-h-0 dashboard-container">
        <slot>
          <router-view v-slot="{ Component }">
            <!-- Avoid mode="out-in": a setup crash on the entering page can leave a permanent blank content area -->
            <transition name="fade">
              <component :is="Component" :key="route.fullPath" class="h-full" />
            </transition>
          </router-view>
        </slot>
      </div>
    </main>
    <!-- Authentication Modal -->
    <AuthModal v-model="showAuthModal" />
    <!-- Global Audio Player -->
    <GlobalAudioPlayer />
    <!-- App tour -->
    <AppTourWelcomeDialog
      :show="showWelcome"
      @take="acceptWelcome"
      @skip="skipWelcome"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import DashboardSidebar from '@/components/DashboardSidebar.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import GlobalAudioPlayer from '@/components/GlobalAudioPlayer.vue';
  import AppTourWelcomeDialog from '@/components/tour/AppTourWelcomeDialog.vue';
  import { useAuthStore } from '@/stores/auth';
  import { useUserPreferencesStore } from '@/stores/userPreferences';
  import { subscriptionStillCoversAccess } from '@/composables/useSubscription';
  import { useSidebarState } from '@/composables/useSidebarState';
  import { useAppTour, useTourFlags } from '@/composables/useAppTour';

  const route = useRoute();
  const authStore = useAuthStore();
  const { isCollapsed, expand } = useSidebarState();
  const {
    showWelcome,
    acceptWelcome,
    skipWelcome,
    maybeShowSidebarWelcome,
  } = useAppTour();
  const preferencesStore = useUserPreferencesStore();
  const { forceSidebarExpanded } = useTourFlags();
  const showAuthModal = ref(false);
  const isOrgOnlyAccount = computed(() => {
    const personalSubStatus = (authStore.user as any)?.subscription?.status;
    if (personalSubStatus === 'active') return false;
    return authStore.user?.account_type === 'organization' || !!authStore.user?.owned_organization_id;
  });

  /** Match DashboardSidebar: admins always use personal nav; only true org-nav accounts skip personal tour */
  const usesOrganizationSidebar = computed(() => {
    if (authStore.user?.is_admin) return false;
    if (!authStore.user?.owned_organization_id) return false;
    const personalSubStatus = (authStore.user as any)?.subscription?.status;
    if (personalSubStatus === 'active') return false;
    return true;
  });

  // Compute sidebar disabled state based on subscription gate
  const sidebarDisabled = computed(() => {
    if (!authStore.isAuthenticated) return false;
    if (authStore.user?.is_admin) return false;
    if (isOrgOnlyAccount.value) return false;
    if (authStore.user?.created_by_organization_id) return false;

    const hasSelectedPlan = localStorage.getItem('has_selected_plan');
    const u = authStore.user as any;
    const subscription = u?.subscription ?? {
      status: u?.subscription_status,
      end_date: u?.subscription_end_date,
      days_remaining: u?.subscription?.days_remaining,
    };

    if (subscriptionStillCoversAccess(subscription)) {
      return false;
    }

    // Disable sidebar only if no plan selected (including free tier)
    // If user has selected free tier, allow access even if subscription expired
    return !hasSelectedPlan;
  });

  // Check if user needs to select account type
  const needsAccountTypeSelection = computed(() => {
    // Not authenticated - no need to show
    if (!authStore.isAuthenticated || !authStore.user) {
      return false;
    }

    // Already has account_type set - no need to show
    if (authStore.user.account_type) {
      return false;
    }

    // Already owns an organization - definitely an org account, no need to show
    if (authStore.user.owned_organization_id) {
      return false;
    }

    // User is authenticated but has no account_type and doesn't own an org
    return true;
  });

  // Automatically set account type to personal for new users
  watch(
    needsAccountTypeSelection,
    async (needs) => {
      if (needs) {
        await authStore.setAccountType('personal');
      }
    },
    { immediate: true }
  );

  watch(forceSidebarExpanded, (force) => {
    if (force) expand();
  });

  /** Offer the once-only sidebar tour to every account that hasn't finished/skipped it */
  async function tryOfferSidebarTour() {
    if (!authStore.isAuthenticated) return;
    // Wait until user can use the app (past plan/subscription gate)
    if (sidebarDisabled.value) return;
    // Don't interrupt plan selection on billing
    if (route.path.startsWith('/billing')) return;
    // Only skip when the UI is actually on org sidebar (admins keep personal nav + tour)
    if (usesOrganizationSidebar.value) return;
    await maybeShowSidebarWelcome();
  }

  onMounted(() => {
    tryOfferSidebarTour();
  });

  watch(
    [
      () => authStore.isAuthenticated,
      () => authStore.user?.id,
      () => authStore.user?.is_admin,
      () => preferencesStore.syncedFromServer,
      () => preferencesStore.preferences.completed_tours,
      sidebarDisabled,
      () => route.path,
      usesOrganizationSidebar,
    ],
    () => {
      tryOfferSidebarTour();
    }
  );
</script>

<style scoped>
  .dashboard-container {
    background-color: var(--sidebar-bg);
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.1s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
