import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/creators',
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
        {
          path: 'new',
          name: 'prompts-new',
          component: () => import('@/pages/NewPrompt.vue'),
        },
        {
          path: ':id/edit',
          name: 'prompts-edit',
          component: () => import('@/pages/EditPrompt.vue'),
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
          name: 'admin-home',
          component: () => import('@/pages/Admin.vue'),
        },
      ],
    },
    // Authentication routes
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/Auth.vue'),
    },
    {
      path: '/reset-password/:token',
      name: 'reset-password',
      component: () => import('@/pages/ResetPassword.vue'),
    },
    // Organization routes
    {
      path: '/organization/setup',
      name: 'organization-setup',
      component: () => import('@/components/OrganizationSetupWizard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/organizations',
      name: 'organizations',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
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
          name: 'organization-detail-home',
          component: () => import('@/components/OrganizationDashboard.vue'),
        },
      ],
    },
    // Invitation acceptance
    {
      path: '/invite/:token',
      name: 'accept-invitation',
      component: () => import('@/pages/AcceptInvitation.vue'),
    },
  ],
});

// Navigation guard for authentication and admin access
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

  // Prevent org-created accounts from accessing organization setup
  if (to.name === 'organization-setup' && authStore.user?.created_by_organization_id) {
    next('/projects');
    return;
  }

  next();
});

export default router;
