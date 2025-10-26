<template>
  <div class="min-h-screen bg-background flex">
    <!-- Sidebar -->
    <aside class="fixed left-0 top-0 h-full w-64 bg-card border-r border-border">
      <!-- Logo/Brand -->
      <div class="h-16 px-6 flex items-center border-b border-border">
        <img src="/logo.svg" alt="Clippster" class="h-8 w-auto" />
      </div>

      <!-- Navigation -->
      <nav class="p-4">
        <ul class="space-y-1">
          <li>
            <router-link
              to="/dashboard/projects"
              class="nav-link"
              :class="{ 'nav-link-active': isActive('/dashboard/projects') }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Projects</span>
            </router-link>
          </li>
          <li>
            <router-link
              to="/dashboard/clips"
              class="nav-link"
              :class="{ 'nav-link-active': isActive('/dashboard/clips') }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
              </svg>
              <span>Clips</span>
            </router-link>
          </li>
          <li>
            <router-link
              to="/dashboard/prompts"
              class="nav-link"
              :class="{ 'nav-link-active': isActive('/dashboard/prompts') }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
              </svg>
              <span>Prompts</span>
            </router-link>
          </li>
        </ul>
      </nav>

      <!-- User info and logout at bottom -->
      <div class="absolute bottom-0 w-64 p-4 border-t border-border">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span class="text-sm text-muted-foreground">Connected</span>
            <span v-if="authStore.user?.is_admin" class="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20">
              Admin
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs text-primary">{{ formatAddress(authStore.walletAddress) }}</span>
          <button
            @click="disconnect"
            class="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content area with left margin to account for fixed sidebar -->
    <main class="flex-1 ml-64">
      <!-- Header -->
      <header class="sticky top-0 z-10 h-16 px-8 flex items-center justify-between border-b border-border bg-card">
        <h2 class="text-lg font-semibold text-foreground capitalize">{{ currentPageTitle }}</h2>
        <div class="text-sm text-muted-foreground">
          {{ new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}
        </div>
      </header>

      <!-- Page content -->
      <div class="p-8">
        <div class="max-w-7xl mx-auto">
          <router-view />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isActive = (path: string) => {
  return route.path.startsWith(path)
}

const currentPageTitle = computed(() => {
  const path = route.path.split('/').pop()
  return path || 'Dashboard'
})

const formatAddress = (address: string | null) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const disconnect = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  color: var(--muted-foreground);
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--foreground);
  background-color: var(--accent);
}

.nav-link-active {
  background-color: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
}

.nav-link-active:hover {
  background-color: rgba(var(--primary-rgb), 0.15);
  color: var(--primary);
}
</style>
