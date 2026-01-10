<template>
  <aside class="sidebar" :class="{ 'sidebar--native': isNativeEnvironment }">
    <!-- Bug Report Dialog -->
    <BugReportDialog
      :show="showBugReportDialog"
      @close="showBugReportDialog = false"
      @submitted="handleBugReportSubmitted"
    />

    <!-- ===== Header Section ===== -->
    <div v-if="!isNativeEnvironment" class="sidebar-header">
      <div class="sidebar-logo">
        <img src="/logo.svg" alt="Clippster" class="sidebar-logo__image" />
        <span class="sidebar-logo__text">Clippster</span>
      </div>
    </div>

    <!-- ===== Navigation Section ===== -->
    <nav class="sidebar-nav">
      <div class="sidebar-nav__scroll">
        <div class="sidebar-nav__content">
          <template v-for="group in sortedNavigationGroups" :key="group.key">
            <div v-if="getVisibleGroupItems(group.items).length > 0" class="sidebar-nav-group">
              <!-- Group Label -->
              <div v-if="group.label" class="sidebar-nav-group__label">
                {{ group.label }}
              </div>

              <!-- Navigation Items -->
              <ul class="sidebar-nav-group__items">
                <li v-for="item in getVisibleGroupItems(group.items)" :key="item.path">
                  <router-link
                    :to="item.path"
                    class="sidebar-nav-item"
                    :class="{ 'sidebar-nav-item--active': isActive(item.path) }"
                  >
                    <div class="sidebar-nav-item__icon">
                      <div
                        v-if="item.useImage"
                        class="sidebar-nav-item__custom-icon"
                        :style="{
                          maskImage: `url(${item.icon})`,
                          WebkitMaskImage: `url(${item.icon})`,
                        }"
                      />
                      <component v-else :is="item.icon as Component" class="w-[18px] h-[18px]" />
                      <!-- Unread badge for Messages -->
                      <span v-if="item.name === 'Messages' && totalUnreadMessages > 0" class="sidebar-nav-item__badge">
                        {{ totalUnreadMessages > 99 ? '99+' : totalUnreadMessages }}
                      </span>
                    </div>
                    <span class="sidebar-nav-item__text">{{ item.name }}</span>
                  </router-link>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <!-- ===== Footer Section ===== -->
    <div class="sidebar-footer">
      <!-- User Profile Section -->
      <div class="sidebar-user">
        <template v-if="authStore.isAuthenticated">
          <DropdownMenu>
            <DropdownMenuTrigger class="sidebar-user__trigger">
              <div class="sidebar-user__avatar">
                <span class="sidebar-user__avatar-text">{{ userInitials }}</span>
              </div>
              <span class="sidebar-user__name" :title="formattedAddress">
                {{ formattedAddress }}
              </span>
              <ChevronRight class="sidebar-user__chevron" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" :side-offset="12" class="sidebar-dropdown">
              <DropdownMenuLabel class="sidebar-dropdown__label">
                {{ formattedAddress }}
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="sidebar-dropdown__separator" />
              <!-- Credits Display -->
              <DropdownMenuItem
                v-if="isAIAllowed"
                class="sidebar-dropdown__item sidebar-dropdown__credits"
                @click="router.push('/billing')"
              >
                <Zap class="w-4 h-4 mr-2 text-sidebar-accent" />
                <span class="sidebar-dropdown__credits-label">Credits</span>
                <span v-if="!loadingBalance" class="sidebar-dropdown__credits-value">
                  <template v-if="typeof hoursRemaining === 'string'">Unlimited</template>
                  <template v-else>{{ Math.round(hoursRemaining as number) }} min</template>
                </span>
                <span v-else class="sidebar-dropdown__credits-loading"></span>
              </DropdownMenuItem>
              <DropdownMenuSeparator v-if="isAIAllowed" class="sidebar-dropdown__separator" />
              <DropdownMenuItem class="sidebar-dropdown__item" @click="router.push('/clipper-profile')">
                <UserCircle class="w-4 h-4 mr-2" />
                Clipper Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator class="sidebar-dropdown__separator" />
              <!-- Admin Link (conditional) -->
              <DropdownMenuItem
                v-if="authStore.user?.is_admin"
                class="sidebar-dropdown__item"
                @click="router.push('/admin')"
              >
                <Settings class="w-4 h-4 mr-2" />
                Admin
              </DropdownMenuItem>
              <!-- Bug Report -->
              <DropdownMenuItem class="sidebar-dropdown__item" @click="showBugReportDialog = true">
                <Bug class="w-4 h-4 mr-2" />
                Bug Report
              </DropdownMenuItem>
              <DropdownMenuSeparator class="sidebar-dropdown__separator" />
              <DropdownMenuItem class="sidebar-dropdown__item sidebar-dropdown__item--danger" @click="handleDisconnect">
                <LogOut class="w-4 h-4 mr-2" />
                {{ disconnectButtonText }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </template>
        <template v-else>
          <button class="sidebar-signin-btn" @click="showAuthModal">Sign In</button>
        </template>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, type Component } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';
  import { useMessagingStore } from '@/stores/messaging';
  import { useWallet } from '@/composables/useWallet';
  import { useAIPermission } from '@/composables/useAIPermission';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { getSortedNavigationGroups, type NavigationItem } from '@/config/navigation';
  import BugReportDialog from '@/components/BugReportDialog.vue';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import api from '@/services/api';
  import { Zap, UserCircle, ChevronRight, LogOut, Settings, Bug } from 'lucide-vue-next';

  // ===== Composables & Stores =====
  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const messagingStore = useMessagingStore();
  const { formatAddress } = useWallet();
  const { isAIAllowed } = useAIPermission();
  const { isLiveClipEnabled, initialize: initFeatureFlags } = useFeatureFlags();

  // ===== Emits =====
  const emit = defineEmits<{
    'show-auth-modal': [];
  }>();

  // ===== Reactive State =====
  const hoursRemaining = ref<number | 'unlimited'>(0);
  const loadingBalance = ref(false);
  const isNativeEnvironment = ref(false);
  const showBugReportDialog = ref(false);
  const userOrganizations = ref<any[]>([]);
  let balanceRefreshInterval: ReturnType<typeof setInterval> | null = null;

  // ===== Computed Properties =====
  const totalUnreadMessages = computed(() => messagingStore.totalUnread);

  const sortedNavigationGroups = computed(() => getSortedNavigationGroups());

  const isOrgAccountOwner = computed(() => {
    return authStore.user?.account_type === 'organization' && authStore.user?.owned_organization_id;
  });

  const formattedAddress = computed(() => {
    if (!authStore.isAuthenticated) return '';
    if (authStore.authProvider && ['google', 'email'].includes(authStore.authProvider) && authStore.email) {
      return authStore.email;
    }
    return formatAddress(authStore.walletAddress ?? '');
  });

  const userInitials = computed(() => {
    if (!authStore.isAuthenticated) return '';
    const email = authStore.email;
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    const wallet = authStore.walletAddress;
    if (wallet) {
      return wallet.slice(0, 2).toUpperCase();
    }
    return '??';
  });

  const disconnectButtonText = computed(() => {
    return authStore.authProvider && ['google', 'email'].includes(authStore.authProvider) ? 'Sign Out' : 'Disconnect';
  });

  // ===== Navigation Filtering =====
  function getVisibleGroupItems(items: NavigationItem[]): NavigationItem[] {
    return items.filter((item) => {
      // Hide Admin and Bug Report from navigation - they're now in the profile dropdown
      if (item.name === 'Admin' || item.name === 'Bug Report') {
        return false;
      }
      // Check admin-only items
      if (item.adminOnly) {
        return authStore.user?.is_admin === true;
      }
      // Check organization owner-only items
      if (item.orgOnly) {
        return isOrgAccountOwner.value;
      }
      // Check organization member items
      if (item.orgMember) {
        if (isOrgAccountOwner.value) return true;
        return userOrganizations.value.length > 0;
      }
      // Hide Live when feature is disabled
      if (item.path === '/live-clip' && !isLiveClipEnabled.value) {
        return false;
      }
      return true;
    });
  }

  function isActive(path: string): boolean {
    if (path === '/organizations') {
      return route.path.startsWith('/organizations') || route.path.startsWith('/organization/');
    }
    return route.path.startsWith(path);
  }

  // ===== Event Handlers =====
  function handleDisconnect() {
    authStore.logout();
    router.push('/');
  }

  function showAuthModal() {
    emit('show-auth-modal');
  }

  function handleBugReportSubmitted() {
    console.log('Bug report submitted successfully');
  }

  // ===== Data Fetching =====
  async function loadUserOrganizations() {
    if (!authStore.isAuthenticated) {
      userOrganizations.value = [];
      return;
    }
    try {
      const result = await authStore.getOrganizations();
      if (result.success) {
        userOrganizations.value = result.organizations || [];
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  }

  async function fetchBalance() {
    if (!authStore.isAuthenticated) {
      hoursRemaining.value = 0;
      return;
    }

    loadingBalance.value = true;
    try {
      const response = await api.get('/credits/balance');
      if (response.data.success) {
        hoursRemaining.value = response.data.balance.hours_remaining;
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      loadingBalance.value = false;
    }
  }

  function handleAuthStateChanged(event: CustomEvent) {
    console.log('[DashboardSidebar] Auth state changed, refetching balance. User ID:', event.detail?.userId);
    if (event.detail?.userId === null) {
      hoursRemaining.value = 0;
    } else {
      fetchBalance();
    }
  }

  // ===== Watchers =====
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        loadUserOrganizations();
      } else {
        userOrganizations.value = [];
      }
    },
    { immediate: true }
  );

  // ===== Lifecycle =====
  onMounted(() => {
    isNativeEnvironment.value = typeof window !== 'undefined' && '__TAURI__' in window;
    fetchBalance();
    balanceRefreshInterval = setInterval(fetchBalance, 30000);
    window.addEventListener('auth-state-changed', handleAuthStateChanged as EventListener);
    initFeatureFlags();
  });

  onUnmounted(() => {
    if (balanceRefreshInterval) {
      clearInterval(balanceRefreshInterval);
      balanceRefreshInterval = null;
    }
    window.removeEventListener('auth-state-changed', handleAuthStateChanged as EventListener);
  });
</script>

<style scoped>
  /* ===== Sidebar Container ===== */
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    width: 240px;
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    transition: width 200ms ease-out;
    z-index: 40;
  }

  .sidebar--native {
    padding-top: 32px; /* Account for custom titlebar */
  }

  /* ===== Header ===== */
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    height: 56px;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .sidebar-logo__image {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .sidebar-logo__text {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== Navigation ===== */
  .sidebar-nav {
    flex: 1;
    overflow: hidden;
  }

  .sidebar-nav__scroll {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Custom scrollbar for navigation */
  .sidebar-nav__scroll::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar-nav__scroll::-webkit-scrollbar-button {
    display: none;
  }

  .sidebar-nav__scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-nav__scroll::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .sidebar-nav__scroll::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* Firefox scrollbar */
  .sidebar-nav__scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .sidebar-nav__content {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Navigation Groups */
  .sidebar-nav-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .sidebar-nav-group__label {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    padding: 0.5rem 0.75rem 0.25rem;
    opacity: 0.7;
  }

  .sidebar-nav-group__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* Navigation Items */
  .sidebar-nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 150ms ease;
    cursor: pointer;
  }

  .sidebar-nav-item:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .sidebar-nav-item--active {
    background-color: var(--sidebar-active);
    color: var(--sidebar-accent);
  }

  .sidebar-nav-item--active:hover {
    background-color: var(--sidebar-active-hover);
  }

  .sidebar-nav-item__icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sidebar-nav-item__custom-icon {
    width: 18px;
    height: 18px;
    background-color: currentColor;
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
  }

  .sidebar-nav-item__text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-nav-item__badge {
    position: absolute;
    top: -6px;
    right: -8px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: 600;
    background-color: #ef4444;
    color: white;
    border-radius: 8px;
  }

  /* ===== Footer ===== */
  .sidebar-footer {
    padding: 0.3rem;
    border-top: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* User Section */
  .sidebar-user {
    display: flex;
  }

  .sidebar-user__trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.5rem;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--sidebar-text);
    cursor: pointer;
    /* Prevent any animations/transforms from dropdown library */
    transform: none !important;
    animation: none !important;
  }

  .sidebar-user__trigger:hover {
    background-color: var(--sidebar-hover);
  }

  .sidebar-user__trigger[data-state='open'] {
    background-color: var(--sidebar-hover);
  }

  .sidebar-user__avatar {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    background-color: var(--sidebar-accent);
  }

  .sidebar-user__avatar-text {
    font-size: 0.625rem;
    font-weight: 800;
    color: #0a0a0b;
    text-transform: uppercase;
  }

  .sidebar-user__name {
    flex: 1;
    font-size: 0.75rem;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--sidebar-text-muted);
  }

  .sidebar-user__chevron {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  /* Sign In Button */
  .sidebar-signin-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .sidebar-signin-btn:hover {
    opacity: 0.9;
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  .sidebar-dropdown {
    width: 200px !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    /* Disable all slide/zoom animations, only fade */
    animation: sidebarDropdownFade 100ms ease-out !important;
    --tw-enter-translate-x: 0 !important;
    --tw-enter-translate-y: 0 !important;
    --tw-enter-scale: 1 !important;
  }

  @keyframes sidebarDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .sidebar-dropdown__label {
    padding: 0.5rem 0.75rem !important;
    font-size: 0.75rem !important;
    font-weight: 400 !important;
    color: var(--sidebar-text-muted) !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-dropdown__separator {
    height: 1px !important;
    margin: 0.25rem 0 !important;
    background-color: var(--sidebar-border) !important;
  }

  .sidebar-dropdown__item {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 4px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    cursor: pointer !important;
  }

  .sidebar-dropdown__item:hover,
  .sidebar-dropdown__item:focus,
  .sidebar-dropdown__item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    outline: none !important;
  }

  .sidebar-dropdown__item--danger {
    color: #f87171 !important;
  }

  .sidebar-dropdown__item--danger:hover,
  .sidebar-dropdown__item--danger:focus,
  .sidebar-dropdown__item--danger[data-highlighted] {
    background-color: rgba(248, 113, 113, 0.1) !important;
    color: #f87171 !important;
  }

  /* Credits item in dropdown */
  .sidebar-dropdown__credits {
    justify-content: flex-start !important;
  }

  .sidebar-dropdown__credits .text-sidebar-accent {
    color: var(--sidebar-accent) !important;
  }

  .sidebar-dropdown__credits-label {
    flex: 1;
  }

  .sidebar-dropdown__credits-value {
    font-weight: 600;
    color: var(--sidebar-accent) !important;
    font-size: 0.8125rem;
  }

  .sidebar-dropdown__credits-loading {
    width: 12px;
    height: 12px;
    border: 2px solid var(--sidebar-border);
    border-top-color: var(--sidebar-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
</style>
