<template>
  <aside class="fixed left-0 top-0 h-full w-64 bg-muted/12 border-r border-border">
    <!-- Logo/Brand -->
    <div class="h-16 px-6 flex items-center border-b border-border">
      <img src="/logo.svg" alt="Clippster" class="h-7 w-auto" />
    </div>
    <!-- Navigation -->
    <nav class="p-4">
      <ul class="space-y-1">
        <template v-for="(item, index) in visibleNavigationItems" :key="item.path">
          <!-- Category Label -->
          <li v-if="item.category && shouldShowCategory(item.category, index)" class="pt-4 pb-2 px-3">
            <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {{ item.category }}
            </span>
          </li>
          <!-- Navigation Item -->
          <li>
            <router-link :to="item.path" class="nav-link" :class="{ 'nav-link-active': isActive(item.path) }">
              <div
                v-if="item.useImage"
                class="h-5 w-5 transition-all"
                :class="{
                  'brightness-0 invert': isActive(item.path),
                }"
                :style="{
                  backgroundColor: 'currentColor',
                  maskImage: `url(${item.icon})`,
                  WebkitMaskImage: `url(${item.icon})`,
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                }"
              />
              <svg
                v-else-if="item.name === 'PumpFun'"
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                :fill="isActive(item.path) ? 'white' : 'currentColor'"
                viewBox="0 0 24 24"
              >
                <path :d="item.icon" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
              </svg>
              <span>{{ item.name }}</span>
            </router-link>
          </li>
        </template>
      </ul>
    </nav>
    <!-- User info and logout at bottom -->
    <div class="absolute bottom-0 w-64 p-4 border-t border-border">
      <div class="flex items-center justify-between">
        <span class="font-mono text-xs text-primary">{{ formattedAddress }}</span>
        <button @click="handleDisconnect" class="disconnect-btn">Disconnect</button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';
  import { useWallet } from '@/composables/useWallet';
  import { navigationItems } from '@/config/navigation';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const { formatAddress } = useWallet();

  // Filter navigation items based on admin status
  const visibleNavigationItems = computed(() => {
    console.log('🔍 DashboardSidebar - Computing visible navigation items');
    console.log('🔍 authStore.user:', authStore.user);
    console.log('🔍 authStore.user?.is_admin:', authStore.user?.is_admin);
    console.log('🔍 All navigation items:', navigationItems);

    const filtered = navigationItems.filter((item) => {
      console.log(`🔍 Checking item: ${item.name}, adminOnly: ${item.adminOnly}`);
      if (item.adminOnly) {
        const isAdmin = authStore.user?.is_admin === true;
        console.log(`🔍 ${item.name} - Admin check: ${isAdmin}`);
        return isAdmin;
      }
      return true;
    });

    console.log('🔍 Filtered navigation items:', filtered);
    return filtered;
  });

  const isActive = (path: string) => {
    return route.path.startsWith(path);
  };

  const shouldShowCategory = (category: string, index: number) => {
    // Only show category label for the first item with that category
    if (index === 0) return true;
    const previousItem = visibleNavigationItems.value[index - 1];
    return previousItem.category !== category;
  };

  const formattedAddress = computed(() => formatAddress(authStore.walletAddress));

  const handleDisconnect = () => {
    authStore.logout();
    router.push('/login');
  };
</script>

<style scoped>
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.35rem;
    color: var(--muted-foreground);
  }

  .nav-link:hover {
    color: var(--foreground);
    background-color: var(--accent);
  }

  .nav-link-active {
    background-color: rgb(255 255 255 / 0.1);
    color: white;
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
    cursor: pointer;
  }

  .disconnect-btn:hover {
    color: rgb(248 113 113);
    border-color: rgb(248 113 113 / 0.3);
    background-color: rgb(248 113 113 / 0.05);
  }
</style>
