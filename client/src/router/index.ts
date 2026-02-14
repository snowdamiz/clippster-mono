import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { featureFlags } from '@/composables/useFeatureFlags';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        // Dynamic redirect based on user type
        const authStore = useAuthStore();
        const isOrgOwner =
          authStore.user?.account_type === 'organization' && authStore.user?.owned_organization_id;
        return isOrgOwner ? '/organizations' : '/creators';
      },
    },
    {
      path: '/dashboard',
      redirect: '/projects',
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'projects-home',
          component: () => import('@/pages/Projects.vue'),
        },
      ],
    },
    {
      path: '/clips',
      name: 'clips',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'clips-home',
          component: () => import('@/pages/Clips.vue'),
        },
      ],
    },
    {
      path: '/video-editor',
      name: 'video-editor',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'video-editor-home',
          component: () => import('@/pages/VideoEditor.vue'),
        },
      ],
    },
    {
      path: '/ai-video',
      name: 'ai-video',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiredTier: 'creator' },
      children: [
        {
          path: '',
          name: 'ai-video-home',
          component: () => import('@/pages/AIVideoCreator.vue'),
        },
      ],
    },
    {
      path: '/editor',
      name: 'opencut-editor',
      component: () => import('@/pages/OpenCutEditor.vue'),
      meta: { noLayout: true },
    },
    {
      path: '/live-clip',
      name: 'live-clip',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'live-clip-home',
          component: () => import('@/pages/LiveClip.vue'),
        },
      ],
    },
    {
      path: '/assets',
      name: 'assets',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'assets-home',
          component: () => import('@/pages/Assets.vue'),
        },
      ],
    },
    {
      path: '/prompts',
      name: 'prompts',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'prompts-home',
          component: () => import('@/pages/Prompts.vue'),
        },
      ],
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'pricing-home',
          component: () => import('@/pages/Pricing.vue'),
        },
      ],
    },
    {
      path: '/billing',
      name: 'billing',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'billing-home',
          component: () => import('@/pages/Billing.vue'),
        },
      ],
    },
    // Creator Profiles page
    {
      path: '/creators',
      name: 'creators',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'creators-home',
          component: () => import('@/pages/CreatorProfiles.vue'),
        },
      ],
    },
    // Campaigns marketplace
    {
      path: '/campaigns',
      name: 'campaigns',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'campaigns-home',
          component: () => import('@/pages/CampaignsPage.vue'),
        },
      ],
    },
    // Clipper Profile (social accounts, payment methods & campaign history)
    {
      path: '/clipper-profile',
      name: 'clipper-profile',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'clipper-profile-home',
          component: () => import('@/pages/ClipperProfilePage.vue'),
        },
        {
          path: 'edit',
          name: 'clipper-profile-edit',
          component: () => import('@/pages/ClipperProfileEditPage.vue'),
        },
      ],
    },
    // Clipper Directory (browse public profiles)
    {
      path: '/clippers',
      name: 'clippers',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'clippers-directory',
          component: () => import('@/pages/ClipperDirectoryPage.vue'),
        },
        {
          path: 'leaderboard',
          name: 'clippers-leaderboard',
          component: () => import('@/pages/ClipperLeaderboardPage.vue'),
        },
        {
          path: ':slug',
          name: 'clipper-public-profile',
          component: () => import('@/pages/ClipperPublicProfilePage.vue'),
        },
      ],
    },
    // Unified VODs page for all streaming platforms
    {
      path: '/vods',
      name: 'vods',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'vods-home',
          component: () => import('@/pages/StreamVods.vue'),
        },
      ],
    },
    // Messages page (Telegram-style)
    {
      path: '/messages',
      name: 'messages',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'messages-home',
          component: () => import('@/pages/Messages.vue'),
        },
      ],
    },
    // Content Calendar
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'calendar-home',
          component: () => import('@/pages/ContentCalendar.vue'),
        },
      ],
    },
    // Legacy redirects for old platform routes
    {
      path: '/pumpfun',
      redirect: '/vods',
    },
    {
      path: '/kick',
      redirect: '/vods',
    },
    {
      path: '/twitch',
      redirect: '/vods',
    },
    {
      path: '/youtube',
      redirect: '/vods',
    },
    {
      path: '/platform/:platform',
      redirect: '/vods',
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          name: 'admin-hub',
          component: () => import('@/pages/admin/AdminHub.vue'),
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/pages/admin/AdminUsers.vue'),
        },
        {
          path: 'organizations',
          name: 'admin-organizations',
          component: () => import('@/pages/admin/AdminOrganizations.vue'),
        },
        {
          path: 'bug-reports',
          name: 'admin-bug-reports',
          component: () => import('@/pages/admin/AdminBugReports.vue'),
        },
        {
          path: 'ai-usage',
          name: 'admin-ai-usage',
          component: () => import('@/pages/admin/AdminAiUsage.vue'),
        },
        {
          path: 'analytics',
          name: 'admin-analytics',
          component: () => import('@/pages/admin/AdminAnalytics.vue'),
        },
        {
          path: 'beta-codes',
          name: 'admin-beta-codes',
          component: () => import('@/pages/admin/AdminBetaCodes.vue'),
        },
        {
          path: 'discount-codes',
          name: 'admin-discount-codes',
          component: () => import('@/pages/admin/AdminDiscountCodes.vue'),
        },
        {
          path: 'waitlist',
          name: 'admin-waitlist',
          component: () => import('@/pages/admin/AdminWaitlist.vue'),
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('@/pages/admin/AdminSettings.vue'),
        },
        {
          path: 'org-applications',
          name: 'admin-org-applications',
          component: () => import('@/pages/admin/AdminOrgApplications.vue'),
        },
        {
          path: 'affiliates',
          name: 'admin-affiliates',
          component: () => import('@/pages/admin/AdminAffiliates.vue'),
        },
        {
          path: 'affiliates/:id',
          name: 'admin-affiliate-detail',
          component: () => import('@/pages/admin/AdminAffiliateDetail.vue'),
        },
      ],
    },
    // Affiliate dashboard (authenticated, affiliate users only)
    {
      path: '/affiliate',
      name: 'affiliate-dashboard',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'affiliate-home',
          component: () => import('@/pages/AffiliateDashboard.vue'),
        },
      ],
    },
    // Legacy login route - redirect to home (auth is handled via AuthModal)
    {
      path: '/login',
      name: 'login',
      redirect: '/',
    },
    {
      path: '/reset-password/:token',
      name: 'reset-password',
      component: () => import('@/pages/ResetPassword.vue'),
    },
    // Organization routes
    {
      path: '/organizations',
      name: 'organizations',
      component: () => import('@/layouts/DashboardLayout.vue'),
      children: [
        {
          path: '',
          name: 'organizations-home',
          component: () => import('@/pages/Organizations.vue'),
        },
      ],
    },
    {
      path: '/organization',
      name: 'organization',
      redirect: '/organizations', // Redirect to list if no ID specified
    },
    {
      path: '/organization/:id',
      name: 'organization-detail',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'organization-hub',
          component: () => import('@/pages/organization/OrganizationHub.vue'),
        },
        {
          path: 'members',
          name: 'org-members',
          component: () => import('@/pages/organization/OrganizationMembers.vue'),
        },
        {
          path: 'creators',
          name: 'org-creators',
          component: () => import('@/pages/organization/OrganizationCreators.vue'),
        },
        {
          path: 'campaigns',
          name: 'org-campaigns',
          component: () => import('@/pages/organization/OrganizationCampaigns.vue'),
        },
        {
          path: 'clippers',
          name: 'org-clippers',
          component: () => import('@/pages/organization/OrganizationClippers.vue'),
        },
        {
          path: 'hiring',
          name: 'org-hiring',
          component: () => import('@/pages/organization/OrganizationHiring.vue'),
        },
        {
          path: 'shared',
          name: 'org-shared',
          component: () => import('@/pages/organization/OrganizationShared.vue'),
        },
        {
          path: 'social',
          name: 'org-social',
          component: () => import('@/pages/organization/OrganizationSocial.vue'),
        },
        {
          path: 'posts',
          name: 'org-posts',
          component: () => import('@/pages/organization/OrganizationPosts.vue'),
        },
        {
          path: 'assets',
          name: 'org-assets',
          component: () => import('@/pages/organization/OrganizationAssets.vue'),
        },
        {
          path: 'billing',
          name: 'org-billing',
          component: () => import('@/pages/organization/OrganizationBilling.vue'),
        },
        {
          path: 'settings',
          name: 'org-settings',
          component: () => import('@/pages/organization/OrganizationSettings.vue'),
        },
      ],
    },
    // Legacy organization messages route - redirect to main messages page
    {
      path: '/organization/:organizationId/messages',
      redirect: '/messages',
    },
    // Invitation acceptance
    {
      path: '/invite/:token',
      name: 'accept-invitation',
      component: () => import('@/pages/AcceptInvitation.vue'),
    },
    // PIP Controls window (separate always-on-top window)
    {
      path: '/pip-controls',
      name: 'pip-controls',
      component: () => import('@/pages/PipControls.vue'),
      meta: { noPadding: true, noLayout: true },
    },
  ],
});

// Helper to check if a user is an organization account owner
export function isOrgAccountOwner(
  user?: { account_type?: string; owned_organization_id?: string | null } | null
): boolean {
  const userData = user ?? useAuthStore().user;
  return userData?.account_type === 'organization' && !!userData?.owned_organization_id;
}

// Helper to get the default landing route for a user
export function getDefaultRoute(
  user?: { account_type?: string; owned_organization_id?: string | null } | null
): string {
  return isOrgAccountOwner(user) ? '/organizations' : '/creators';
}

// Navigation guard for authentication, admin access, and feature flags
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Save intended destination and redirect to login
    next({ path: '/login', query: { redirect: to.fullPath } });
    return;
  }

  // Check if route requires admin
  if (to.meta.requiresAdmin && (!authStore.isAuthenticated || !authStore.user?.is_admin)) {
    next('/projects');
    return;
  }

  // Check if route requires a minimum subscription tier
  if (to.meta.requiredTier && authStore.isAuthenticated) {
    const tierHierarchy: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3 };
    const user = authStore.user;
    // Admins and org-created users bypass tier checks
    if (!user?.is_admin && !user?.created_by_organization_id) {
      const userTier = (user as any)?.subscription_tier || 'free';
      const userLevel = tierHierarchy[userTier] ?? 0;
      const requiredLevel = tierHierarchy[to.meta.requiredTier as string] ?? 0;
      if (userLevel < requiredLevel) {
        next({ path: '/billing', query: { upgrade: to.meta.requiredTier as string, reason: to.name as string } });
        return;
      }
    }
  }

  // Check Live Clip feature flag for /live-clip route
  if (to.path.startsWith('/live-clip') && !featureFlags.isLiveClipEnabled.value) {
    next('/creators');
    return;
  }

  next();
});

export default router;
