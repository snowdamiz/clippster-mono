import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { featureFlags } from '@/composables/useFeatureFlags';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: () => {
        const authStore = useAuthStore();
        const user = authStore.user;
        console.log('[Router] Root redirect logic:', {
          isAuthenticated: authStore.isAuthenticated,
          userId: user?.id,
          accountType: user?.account_type,
          ownedOrgId: user?.owned_organization_id,
          createdByOrgId: user?.created_by_organization_id,
          hasSelectedPlan: !!localStorage.getItem('has_selected_plan'),
          subStatus: (user as any)?.subscription?.status,
        });
        
        // New users without a plan go to billing
        if (
          user &&
          !user.is_admin &&
          user.account_type !== 'organization' &&
          !user.owned_organization_id &&
          !user.created_by_organization_id &&
          !localStorage.getItem('has_selected_plan')
        ) {
          const subStatus = (user as any).subscription?.status;
          if (subStatus !== 'active' && subStatus !== 'cancelled') {
            console.log('[Router] Redirecting to billing (new user)');
            return '/billing?new_user=true';
          }
        }
        const isOrgOwner =
          user?.account_type === 'organization' && user?.owned_organization_id;
        const destination = isOrgOwner ? '/organizations' : '/creators';
        console.log('[Router] Redirecting to:', destination);
        return destination;
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
      meta: { requiresAuth: true },
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
      meta: { requiredTier: 'creator' },
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
      meta: { requiredTier: 'creator' },
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
      meta: { requiresAuth: true, requiredTier: 'creator' },
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
      meta: { requiresAuth: true, requiredTier: 'creator' },
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
      meta: { requiresAuth: true, requiredTier: 'creator' },
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
        {
          path: 'users/:id',
          name: 'admin-user-profile',
          component: () => import('@/pages/admin/AdminUserProfile.vue'),
        },
        {
          path: 'organizations/:id',
          name: 'admin-org-detail',
          component: () => import('@/pages/admin/AdminOrgDetail.vue'),
        },
        {
          path: 'customer-service',
          name: 'admin-customer-service',
          component: () => import('@/pages/admin/AdminCustomerService.vue'),
        },
        {
          path: 'staff-messages',
          name: 'admin-staff-messages',
          component: () => import('@/pages/admin/AdminStaffMessages.vue'),
        },
        {
          path: 'mod-logs',
          name: 'admin-mod-logs',
          component: () => import('@/pages/admin/AdminModLogs.vue'),
        },
        {
          path: 'messaging',
          name: 'admin-messaging',
          component: () => import('@/pages/admin/AdminMessaging.vue'),
        },
        {
          path: 'announcements',
          name: 'admin-announcements',
          component: () => import('@/pages/admin/AdminAnnouncements.vue'),
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
    {
      path: '/verify-email-change/:token',
      name: 'verify-email-change',
      component: () => import('@/pages/EmailChangeVerification.vue'),
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
      meta: { requiresAuth: true, requiresOrgSubscription: true },
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
  user?: { account_type?: string; owned_organization_id?: string | number | null } | null
): boolean {
  const userData = user ?? useAuthStore().user;
  return userData?.account_type === 'organization' && !!userData?.owned_organization_id;
}

// Helper to check if a user needs to select a plan (new user flow)
function needsPlanSelection(
  user?: { account_type?: string; owned_organization_id?: string | number | null; is_admin?: boolean; created_by_organization_id?: string | number | null; subscription?: { status?: string } } | null
): boolean {
  if (!user) return false;
  if (user.is_admin) return false;
  if (user.account_type === 'organization' || user.owned_organization_id) return false;
  if (user.created_by_organization_id) return false;
  const hasSelectedPlan = localStorage.getItem('has_selected_plan');
  if (hasSelectedPlan) return false;
  const subStatus = user.subscription?.status;
  if (subStatus === 'active' || subStatus === 'cancelled') return false;
  return true;
}

// Helper to get the default landing route for a user
export function getDefaultRoute(
  user?: { account_type?: string; owned_organization_id?: string | number | null; is_admin?: boolean; created_by_organization_id?: string | number | null; subscription?: { status?: string } } | null
): string {
  if (needsPlanSelection(user)) return '/billing?new_user=true';
  return isOrgAccountOwner(user) ? '/organizations' : '/creators';
}

// Navigation guard for authentication, admin access, and feature flags
router.beforeEach(async (to, _from, next) => {
  console.log('[Router] beforeEach triggered:', {
    to: to.path,
    from: _from.path,
    isAuthenticated: useAuthStore().isAuthenticated,
  });
  
  const authStore = useAuthStore();
  const ownedOrganizationId = authStore.user?.owned_organization_id;

  // Org-owner accounts should use organization billing, not personal billing.
  if (ownedOrganizationId && to.path === '/billing') {
    next(`/organization/${ownedOrganizationId}/billing`);
    return;
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Auth gate in App.vue will show modal, but we still prevent route navigation
    next(false);
    return;
  }

  // Check if route requires admin or moderator
  if (
    to.meta.requiresAdmin &&
    (!authStore.isAuthenticated || (!authStore.user?.is_admin && !authStore.user?.is_moderator))
  ) {
    next('/projects');
    return;
  }

  // Check if route requires a minimum subscription tier
  if (to.meta.requiredTier && authStore.isAuthenticated) {
    const tierHierarchy: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3 };
    const user = authStore.user;
    // Admins and org-created users bypass tier checks
    if (!user?.is_admin && !user?.created_by_organization_id) {
      const userTier = user?.subscription?.tier || 'free';
      const userLevel = tierHierarchy[userTier] ?? 0;
      const requiredLevel = tierHierarchy[to.meta.requiredTier as string] ?? 0;
      if (userLevel < requiredLevel) {
        // Show subscription gate dialog instead of redirecting to billing
        const routeLabels: Record<string, string> = {
          'campaigns-home': 'Access Campaigns',
          'clipper-profile-home': 'Access Clipper Profile',
          'clippers-directory': 'Browse Clippers',
          'messages-home': 'Access Messages',
          'prompts-home': 'Access Prompts',
        };
        const routeName = typeof to.name === 'string' ? to.name : String(to.name);
        const context = routeLabels[routeName] || `Access ${routeName}`;

        // Dispatch subscription gate event
        const event = new CustomEvent('show-subscription-gate', {
          detail: { context, type: 'general' },
        });
        window.dispatchEvent(event);

        // Prevent navigation
        next(false);
        return;
      }
    }
  }

  // Check org subscription gate
  if (to.meta.requiresOrgSubscription && authStore.isAuthenticated) {
    const orgId = to.params.id as string;
    // Exempt the billing page itself so orgs can actually subscribe
    const isBillingPage = to.name === 'org-billing';
    if (orgId && !isBillingPage) {
      // Check subscription status from cached org data or fetch
      try {
        const { data } = await import('@/services/api').then((m) =>
          m.default.get(`/organizations/${orgId}/subscription`)
        );
        if (data.success && data.subscription) {
          const status = data.subscription.status;
          if (status === 'none' || status === 'expired') {
            next({
              path: `/organization/${orgId}/billing`,
              query: { subscription_required: 'true' },
            });
            return;
          }
        }
      } catch {
        // If we can't check, allow through (don't block on network errors)
      }
    }
  }

  // Block campaigns routes (Coming Soon)
  if (to.path === '/campaigns' || to.name === 'campaigns-home') {
    next('/creators');
    return;
  }
  if (to.name === 'org-campaigns') {
    const orgId = to.params.id as string;
    next(`/organization/${orgId}`);
    return;
  }

  // Check Live Clip feature flag for /live-clip route
  if (to.path.startsWith('/live-clip') && !featureFlags.isLiveClipEnabled.value) {
    next('/creators');
    return;
  }

  console.log('[Router] Navigation allowed to:', to.path);
  next();
});

export default router;
