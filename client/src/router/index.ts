import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/videos',
      redirect: '/dashboard/videos'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/WalletAuth.vue'),
      beforeEnter: (_to, _from, next) => {
        const authStore = useAuthStore()
        if (authStore.isAuthenticated) {
          next('/dashboard')
        } else {
          next()
        }
      }
    },
    {
      path: '/dashboard',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard/projects'
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('@/pages/Projects.vue')
        },
        {
          path: 'videos',
          name: 'videos',
          component: () => import('@/pages/Videos.vue')
        },
        {
          path: 'clips',
          name: 'clips',
          component: () => import('@/pages/Clips.vue')
        },
        {
          path: 'prompts',
          name: 'prompts',
          component: () => import('@/pages/Prompts.vue')
        },
        {
          path: 'prompts/new',
          name: 'prompts-new',
          component: () => import('@/pages/NewPrompt.vue')
        },
        {
          path: 'prompts/:id/edit',
          name: 'prompts-edit',
          component: () => import('@/pages/EditPrompt.vue')
        },
        {
          path: 'pricing',
          name: 'pricing',
          component: () => import('@/pages/Pricing.vue')
        },
        {
          path: 'pumpfun',
          name: 'pumpfun',
          component: () => import('@/pages/PumpFun.vue')
        }
      ]
    }
  ]
})

// Navigation guard to check authentication
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router