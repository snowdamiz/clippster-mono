<template>
  <aside class="fixed left-0 top-0 h-full w-64 bg-card border-r border-border">
    <!-- Logo/Brand -->
    <div class="h-16 px-6 flex items-center border-b border-border">
      <img src="/logo.svg" alt="Clippster" class="h-7 w-auto" />
    </div>

    <!-- Navigation -->
    <nav class="p-4">
      <ul class="space-y-1">
        <li v-for="item in navigationItems" :key="item.path">
          <router-link
            :to="item.path"
            class="nav-link"
            :class="{ 'nav-link-active': isActive(item.path) }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
            </svg>
            <span>{{ item.name }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- User info and logout at bottom -->
    <div class="absolute bottom-0 w-64 p-4 border-t border-border">
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs text-primary">{{ formattedAddress }}</span>
        <button
          @click="handleDisconnect"
          class="disconnect-btn"
        >
          Disconnect
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWallet } from '@/composables/useWallet'
import { navigationItems } from '@/config/navigation'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { formatAddress } = useWallet()

const isActive = (path: string) => {
  return route.path.startsWith(path)
}

const formattedAddress = computed(() => formatAddress(authStore.walletAddress))

const handleDisconnect = () => {
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
  border-radius: 0.35rem;
  color: var(--muted-foreground);
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--foreground);
  background-color: var(--accent);
}

.nav-link-active {
  background-color: rgb(255 255 255 / 0.1);
  color: white;
  border-left: 3px solid rgb(255 255 255);
  padding-left: calc(0.75rem - 2px);
}

.nav-link-active:hover {
  background-color: rgb(255 255 255 / 0.15);
  color: rgb(255 255 255);
}

.disconnect-btn {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  line-height: 1rem;
  color: rgb(239 68 68);
  border: 1px solid transparent;
  border-radius: 0.25rem;
  transition: all 0.2s;
  cursor: pointer;
}

.disconnect-btn:hover {
  color: rgb(248 113 113);
  border-color: rgb(248 113 113 / 0.3);
  background-color: rgb(248 113 113 / 0.05);
}
</style>
