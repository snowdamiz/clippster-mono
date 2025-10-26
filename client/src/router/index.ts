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
          path: 'clips',
          name: 'clips',
          component: () => import('@/pages/Clips.vue')
        },
        {
          path: 'prompts',
          name: 'prompts',
          component: () => import('@/pages/Prompts.vue')
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