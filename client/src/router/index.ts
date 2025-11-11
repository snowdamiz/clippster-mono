import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/projects',
    },
    {
      path: '/dashboard',
      redirect: '/projects',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/WalletAuth.vue'),
      beforeEnter: (_to, _from, next) => {
        const authStore = useAuthStore();
        if (authStore.isAuthenticated) {
          next('/projects');
        } else {
          next();
        }
      },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
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
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'clips-home',
          component: () => import('@/pages/Clips.vue'),
        },
      ],
    },
    {
      path: '/videos',
      name: 'videos',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'videos-home',
          component: () => import('@/pages/Videos.vue'),
        },
      ],
    },
    {
      path: '/assets',
      name: 'assets',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
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
      meta: { requiresAuth: true },
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
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'pricing-home',
          component: () => import('@/pages/Pricing.vue'),
        },
      ],
    },
    {
      path: '/pumpfun',
      name: 'pumpfun',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'pumpfun-home',
          component: () => import('@/pages/PumpFun.vue'),
        },
      ],
    },
    {
      path: '/kick',
      name: 'kick',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'kick-home',
          component: () => import('@/pages/Kick.vue'),
        },
      ],
    },
    {
      path: '/twitch',
      name: 'twitch',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'twitch-home',
          component: () => import('@/pages/Twitch.vue'),
        },
      ],
    },
    {
      path: '/youtube',
      name: 'youtube',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'youtube-home',
          component: () => import('@/pages/YouTube.vue'),
        },
      ],
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
  ],
});

// Navigation guard to check authentication and admin access
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && !authStore.user?.is_admin) {
    next('/projects'); // Redirect to projects if not admin
  } else {
    next();
  }
});

export default router;
