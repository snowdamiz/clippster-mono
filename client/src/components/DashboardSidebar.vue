<template>
  <aside class="fixed pt-8 left-0 top-0 h-full w-64 bg-muted/12 border-r border-border">
    <!-- Bug Report Dialog -->
    <BugReportDialog
      :show="showBugReportDialog"
      @close="showBugReportDialog = false"
      @submitted="handleBugReportSubmitted"
    />
    <!-- Logo/Brand - only show in web environment, not in native app -->
    <div v-if="!isNativeEnvironment" class="h-16 px-6 flex items-center border-b border-border">
      <img src="/logo.svg" alt="Clippster" class="h-7 w-auto" />
    </div>
    <!-- Navigation -->
    <nav class="p-4">
      <ul class="space-y-1">
        <template v-for="(item, index) in visibleNavigationItems" :key="item.path">
          <!-- Category Label -->
          <li v-if="item.category && shouldShowCategory(item.category, index)" class="pt-4 pb-2 px-3">
            <span class="text-xs font-semibold text-white/90 uppercase tracking-wider">
              {{ item.category }}
            </span>
          </li>
          <!-- Navigation Item -->
          <li>
            <router-link
              v-if="!item.action"
              :to="item.path"
              class="nav-link"
              :class="{ 'nav-link-active': isActive(item.path) }"
            >
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
              <component v-else :is="item.icon" class="h-5 w-5" />
              <span>{{ item.name }}</span>
            </router-link>

            <!-- Dialog Action Item -->
            <button v-else @click="handleDialogAction(item)" class="nav-link w-full text-left">
              <div
                v-if="item.useImage"
                class="h-5 w-5 transition-all"
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
              <component v-else :is="item.icon" class="h-5 w-5" />
              <span>{{ item.name }}</span>
            </button>
          </li>
        </template>
      </ul>
    </nav>
    <!-- User info and logout at bottom -->
    <div class="absolute bottom-0 w-64 border-t border-border">
      <!-- Credit Balance -->
      <div class="px-2 pb-2 pt-2">
        <button
          @click="handleCreditClick"
          class="credit-balance-card w-full"
          :title="authStore.isAuthenticated ? 'View Pricing & Purchase Credits' : 'Sign in to view credits'"
        >
          <div class="credit-balance-header">
            <div class="credit-left">
              <div class="credit-icon-wrapper">
                <DollarSign class="credit-icon" />
              </div>
              <span class="credit-label">Credits</span>
            </div>

            <div v-if="!loadingBalance" class="credit-right">
              <!-- Authenticated user: show balance -->
              <div v-if="authStore.isAuthenticated">
                <div v-if="typeof hoursRemaining === 'string'" class="credit-value-wrapper">
                  <span class="credit-value unlimited">∞</span>
                </div>
                <div v-else class="credit-value-wrapper">
                  <span class="credit-value">
                    {{ hoursRemaining }}
                  </span>
                  <span class="credit-unit">{{ hoursRemaining === 1 ? 'hr' : 'hrs' }}</span>
                </div>
              </div>
              <!-- Unauthenticated user: show sign in prompt -->
              <div v-else class="credit-sign-in-prompt">
                <span class="credit-sign-in-text">Sign in</span>
              </div>
            </div>

            <div v-else class="credit-right">
              <div class="credit-loading">
                <div class="loading-spinner"></div>
              </div>
            </div>
          </div>
        </button>
      </div>
      <!-- Wallet info -->
      <div :class="authStore.isAuthenticated ? 'px-4 pb-4 pt-4' : 'px-2 pb-2 pt-2'" class="border-t border-border">
        <div v-if="authStore.isAuthenticated" class="flex items-center justify-between">
          <span class="font-mono text-xs text-primary">{{ formattedAddress }}</span>
          <button @click="handleDisconnect" class="disconnect-btn">Disconnect</button>
        </div>
        <div v-else class="flex items-center justify-center">
          <button @click="showAuthModal" class="sign-in-btn">Sign In</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';
  import { useWallet } from '@/composables/useWallet';
  import { navigationItems } from '@/config/navigation';
  import BugReportDialog from '@/components/BugReportDialog.vue';
  import api from '@/services/api';
  import { DollarSign } from 'lucide-vue-next';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const { formatAddress } = useWallet();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const emit = defineEmits<{
    'show-auth-modal': [];
  }>();

  const hoursRemaining = ref<number | 'unlimited'>(0);
  const loadingBalance = ref(false);
  const isNativeEnvironment = ref(false);

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

  const formattedAddress = computed(() => {
    return authStore.isAuthenticated ? formatAddress(authStore.walletAddress) : '';
  });

  const handleDisconnect = () => {
    authStore.logout();
  };

  const showAuthModal = () => {
    emit('show-auth-modal');
  };

  const handleCreditClick = () => {
    if (authStore.isAuthenticated) {
      router.push('/pricing');
    } else {
      showAuthModal();
    }
  };

  // Dialog handling
  const showBugReportDialog = ref(false);

  const handleDialogAction = (item: any) => {
    if (item.action === 'dialog' && item.name === 'Bug Report') {
      showBugReportDialog.value = true;
    }
  };

  const handleBugReportSubmitted = () => {
    console.log('Bug report submitted successfully');
    // Could add a toast notification here if needed
  };

  async function fetchBalance() {
    if (!authStore.isAuthenticated) {
      hoursRemaining.value = null;
      return;
    }

    loadingBalance.value = true;
    try {
      const response = await api.get('/credits/balance');

      if (response.data.success) {
        hoursRemaining.value =
          response.data.balance.hours_remaining === 'unlimited'
            ? 'unlimited'
            : parseFloat(response.data.balance.hours_remaining.toFixed(1));
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      loadingBalance.value = false;
    }
  }

  onMounted(() => {
    // Check if running in native Tauri environment
    isNativeEnvironment.value = typeof window !== 'undefined' && '__TAURI__' in window;

    fetchBalance();
    // Refresh balance every 30 seconds
    setInterval(fetchBalance, 30000);
  });
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
    font-size: 0.75rem;
    line-height: 1rem;
    color: rgb(239 68 68);
    cursor: pointer;
  }

  .disconnect-btn:hover {
    color: rgb(248 113 113);
    border-color: rgb(248 113 113 / 0.3);
    background-color: rgb(248 113 113 / 0.05);
  }

  /* Credit Balance Card Styles */
  .credit-balance-card {
    display: block;
    width: 100%;
    padding: 0.625rem;
    border-radius: 0.375rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
    border: 1px solid rgba(99, 102, 241, 0.2);
    transition: all 0.2s ease;
    cursor: pointer;
    text-align: left;
    font: inherit;
  }

  .credit-balance-card:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
    border-color: rgba(99, 102, 241, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
  }

  .credit-balance-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* margin-bottom: 0.5rem; */
  }

  .credit-left {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .credit-right {
    display: flex;
    align-items: center;
  }

  .credit-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    background: rgba(99, 102, 241, 0.15);
  }

  .credit-icon {
    width: 1rem;
    height: 1rem;
    color: rgb(99, 102, 241);
  }

  .credit-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.7);
  }

  .credit-value-wrapper {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
  }

  .credit-value {
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1;
    color: white;
  }

  .credit-value.unlimited {
    background: linear-gradient(135deg, rgb(99, 102, 241) 0%, rgb(139, 92, 246) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .credit-unit {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  .credit-loading {
    display: flex;
    align-items: center;
  }

  .loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(99, 102, 241, 0.2);
    border-top-color: rgb(99, 102, 241);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .credit-sign-in-prompt {
    display: flex;
    align-items: center;
  }

  .credit-sign-in-text {
    font-size: 0.775rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .sign-in-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.8) 100%);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 0.375rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .sign-in-btn:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(139, 92, 246, 1) 100%);
    border-color: rgba(99, 102, 241, 0.5);
    transform: translateY(-1px);
  }
</style>
