<template>
  <aside
    class="sidebar fixed left-0 top-0 h-screen flex flex-col bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-out z-40"
    :class="{
      'sidebar--native': isNativeEnvironment,
      'w-60': !isCollapsed,
      'w-12': isCollapsed
    }"
  >
    <!-- Bug Report Dialog -->
    <BugReportDialog
      :show="showBugReportDialog"
      @close="showBugReportDialog = false"
      @submitted="handleBugReportSubmitted"
    />

    <!-- ===== Navigation Section ===== -->
    <nav class="flex-1 overflow-hidden">
      <div class="sidebar-nav__scroll h-full overflow-y-auto overflow-x-hidden">
        <div class="flex flex-col" :class="isCollapsed ? 'p-1.5 gap-1' : 'p-3 gap-4'">
          <template v-for="(group, groupIndex) in sortedNavigationGroups" :key="group.key">
            <div v-if="getVisibleGroupItems(group.items).length > 0" class="flex flex-col gap-1">
              <!-- Collapsed divider between groups -->
              <div
                v-if="isCollapsed && groupIndex > 0"
                class="sidebar-collapsed-divider mx-1.5 my-1"
              />

              <!-- Group Label (hidden when collapsed) -->
              <div
                v-if="group.label && !isCollapsed"
                class="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)] pt-2 px-3 pb-1 opacity-70"
              >
                {{ group.label }}
              </div>

              <!-- Navigation Items -->
              <ul class="sidebar-nav-group__items m-0 p-0 flex flex-col gap-0.5">
                <li v-for="item in getVisibleGroupItems(group.items)" :key="item.path">
                  <router-link
                    :to="item.path"
                    class="flex items-center w-full py-2 rounded-md text-[var(--sidebar-text-muted)] bg-transparent border-[none] no-underline text-sm transition-all duration-150 cursor-pointer hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                    :class="{
                      'sidebar-nav-item--active': isActive(item.path),
                      'justify-center px-0': isCollapsed,
                      'gap-3 px-3': !isCollapsed
                    }"
                    :title="isCollapsed ? item.name : undefined"
                  >
                    <div class="relative flex items-center justify-center shrink-0">
                      <div
                        v-if="item.useImage"
                        class="sidebar-nav-item__custom-icon w-[18px] h-[18px] bg-current"
                        :style="{
                          maskImage: `url(${item.icon})`,
                          WebkitMaskImage: `url(${item.icon})`,
                        }"
                      />
                      <component v-else :is="item.icon as Component" class="w-[18px] h-[18px]" />
                      <!-- Unread badge for Messages (icon badge when collapsed) -->
                      <span
                        v-if="item.name === 'Messages' && totalUnreadMessages > 0 && isCollapsed"
                        class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center text-xs font-semibold bg-[#ef4444] text-black rounded-lg"
                      >
                        {{ totalUnreadMessages > 99 ? '99+' : totalUnreadMessages }}
                      </span>
                      <!-- Live badge for Live (icon badge when collapsed) -->
                      <span
                        v-if="item.name === 'Live' && liveCount > 0 && isCollapsed"
                        class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center text-xs font-semibold bg-[var(--sidebar-accent)] text-black rounded-lg"
                      >
                        {{ liveCount > 99 ? '99+' : liveCount }}
                      </span>
                      <!-- Live badge for Creators (icon badge when collapsed) -->
                      <span
                        v-if="item.name === 'Creators' && liveCreatorsCount > 0 && isCollapsed"
                        class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center text-xs font-semibold bg-[var(--sidebar-accent)] text-black rounded-lg"
                      >
                        {{ liveCreatorsCount > 99 ? '99+' : liveCreatorsCount }}
                      </span>
                    </div>
                    <span v-if="!isCollapsed" class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</span>
                    <!-- Unread badge for Messages (right side when expanded) -->
                    <span
                      v-if="item.name === 'Messages' && totalUnreadMessages > 0 && !isCollapsed"
                      class="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold bg-[#ef4444] text-black rounded-md"
                    >
                      {{ totalUnreadMessages > 99 ? '99+' : totalUnreadMessages }}
                    </span>
                    <!-- Live badge for Live (right side when expanded) -->
                    <span
                      v-if="item.name === 'Live' && liveCount > 0 && !isCollapsed"
                      class="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold bg-[var(--sidebar-accent)] text-black rounded-md"
                    >
                      {{ liveCount > 99 ? '99+' : liveCount }}
                    </span>
                    <!-- Live badge for Creators (right side when expanded) -->
                    <span
                      v-if="item.name === 'Creators' && liveCreatorsCount > 0 && !isCollapsed"
                      class="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold bg-[var(--sidebar-accent)] text-black rounded-md"
                    >
                      {{ liveCreatorsCount > 99 ? '99+' : liveCreatorsCount }}
                    </span>
                  </router-link>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </nav>

    <!-- ===== Footer Section ===== -->
    <div class="sidebar-footer p-[0.3rem] flex flex-col gap-2">
      <!-- User Profile Section -->
      <div class="flex" :class="isCollapsed ? 'justify-center' : ''">
        <template v-if="authStore.isAuthenticated">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="sidebar-user__trigger flex items-center rounded-md bg-transparent border-[none] text-[var(--sidebar-text)] cursor-pointer transform-none hover:bg-[var(--sidebar-hover)]"
              :class="isCollapsed ? 'justify-center p-1.5 w-full' : 'gap-2 w-full py-2 px-2'"
              :title="isCollapsed ? formattedAddress : undefined"
            >
              <div class="shrink-0 flex items-center justify-center rounded-[20px] overflow-hidden"
                   :class="[
                     authStore.user?.avatar_url && !avatarFailed ? '' : 'bg-[var(--sidebar-accent)]',
                     isCollapsed ? 'w-6 h-6' : 'w-7 h-7'
                   ]">
                <img
                  v-if="authStore.user?.avatar_url && !avatarFailed"
                  :src="authStore.user.avatar_url"
                  :alt="authStore.user.name || authStore.email || 'User'"
                  class="w-full h-full object-cover"
                  referrerpolicy="no-referrer"
                  @error="avatarFailed = true"
                />
                <span v-else class="text-xs font-extrabold text-[#0a0a0b] uppercase">{{ userInitials }}</span>
              </div>
              <span
                v-if="!isCollapsed"
                class="flex-1 text-xs text-left whitespace-nowrap overflow-hidden text-ellipsis text-[var(--sidebar-text-muted)]"
                :title="formattedAddress"
              >
                {{ formattedAddress }}
              </span>
              <ChevronRight v-if="!isCollapsed" class="w-3.5 h-3.5 text-[var(--sidebar-text-muted)] shrink-0" />
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
          <button
            class="flex items-center justify-center py-2 rounded-md bg-[var(--sidebar-accent)] text-[var(--sidebar-bg)] border-[none] text-sm font-medium cursor-pointer transition-all duration-150 hover:opacity-90"
            :class="isCollapsed ? 'w-full h-9 px-0' : 'w-full px-3'"
            :title="isCollapsed ? 'Sign In' : undefined"
            @click="showAuthModal"
          >
            <span v-if="!isCollapsed">Sign In</span>
            <LogOut v-else class="w-4 h-4 rotate-180" />
          </button>
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
  import { usePermissionsStore } from '@/stores/permissions';
  import { useLiveStatusStore } from '@/stores/liveStatus';
  import { useWallet } from '@/composables/useWallet';
  import { useAIPermission } from '@/composables/useAIPermission';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useSidebarState } from '@/composables/useSidebarState';
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
  const permissionsStore = usePermissionsStore();
  const liveStatusStore = useLiveStatusStore();
  const { formatAddress } = useWallet();
  const { isAIAllowed } = useAIPermission();
  const { isLiveClipEnabled, initialize: initFeatureFlags } = useFeatureFlags();
  const { isCollapsed } = useSidebarState();

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
  const avatarFailed = ref(false);
  let balanceRefreshInterval: ReturnType<typeof setInterval> | null = null;

  // ===== Computed Properties =====
  const totalUnreadMessages = computed(() => messagingStore.totalUnread);
  const liveCount = computed(() => liveStatusStore.liveCount);
  const liveCreatorsCount = computed(() => liveStatusStore.liveCreatorsCount);

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
      // Always show Organizations page (even if not a member of any organization)
      if (item.path === '/organizations') {
        return true;
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
      // Check restricted account items
      if (item.restrictedHidden && permissionsStore.isRestricted) {
        // Special handling for items with specific permission checks
        if (item.path === '/assets' && permissionsStore.allowAssetUploads) {
          return true;
        }
        if (item.path === '/prompts' && permissionsStore.allowCustomPrompts) {
          return true;
        }
        // Otherwise hide if marked as restrictedHidden
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
        permissionsStore.fetchRestrictions();
      } else {
        userOrganizations.value = [];
        permissionsStore.reset();
      }
    },
    { immediate: true }
  );

  // Reset avatar failed state when user changes
  watch(
    () => authStore.user?.id,
    () => {
      avatarFailed.value = false;
    }
  );

  // ===== Lifecycle =====
  onMounted(() => {
    isNativeEnvironment.value = typeof window !== 'undefined' && '__TAURI__' in window;
    fetchBalance();
    balanceRefreshInterval = setInterval(fetchBalance, 30000);
    window.addEventListener('auth-state-changed', handleAuthStateChanged as EventListener);
    initFeatureFlags();
    
    // Fetch user restrictions
    if (authStore.isAuthenticated) {
      permissionsStore.fetchRestrictions();
    }

    // Start polling for live status (both monitored streamers and creator profiles)
    liveStatusStore.startPollingAll();
  });

  onUnmounted(() => {
    if (balanceRefreshInterval) {
      clearInterval(balanceRefreshInterval);
      balanceRefreshInterval = null;
    }
    window.removeEventListener('auth-state-changed', handleAuthStateChanged as EventListener);
    
    // Stop polling for live status
    liveStatusStore.stopPolling();
  });
</script>

<style scoped>
  .sidebar {
    border-right: 1px solid var(--sidebar-border);
  }

  .sidebar-header {
    border-bottom: 1px solid var(--sidebar-border);
  }

  .sidebar-nav-group__items {
    list-style: none;
  }

  .sidebar-nav-item__custom-icon {
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
  }

  .sidebar-footer {
    border-top: 1px solid var(--sidebar-border);
  }

  .sidebar-user__trigger {
    animation: none !important;
  }

  .sidebar--native {
    padding-top: 32px; /* Account for custom titlebar */
  }

  .sidebar-nav-item--active {
    background-color: var(--sidebar-active);
    color: var(--sidebar-accent);
  }

  .sidebar-nav-item--active:hover {
    background-color: var(--sidebar-active-hover);
  }

  .sidebar-collapsed-divider {
    height: 1px;
    background-color: var(--sidebar-border);
    opacity: 0.8;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

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

  .sidebar-nav__scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .sidebar-user__trigger[data-state='open'] {
    background-color: var(--sidebar-hover);
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
