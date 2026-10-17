<template>
  <aside
    class="sidebar relative flex h-full shrink-0 flex-col bg-canvas transition-[width] duration-200 ease-out"
    :class="isCollapsed ? 'w-[var(--sidebar-width-collapsed)]' : 'w-[var(--sidebar-width)]'"
  >
    <BugReportDialog
      :show="showBugReportDialog"
      @close="showBugReportDialog = false"
      @submitted="handleBugReportSubmitted"
    />
    <AccountSettingsDialog :show="showAccountSettingsDialog" @close="showAccountSettingsDialog = false" />

    <!-- Navigation -->
    <nav
      ref="navEl"
      class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      :class="{ 'nav-fade-bottom': navOverflowsBelow, 'nav-fade-top': navOverflowsAbove }"
      aria-label="Main"
      @scroll.passive="updateNavOverflow"
    >
      <div class="flex flex-col gap-3 pb-3 pt-1" :class="isCollapsed ? 'px-2' : 'px-2.5'">
        <template v-for="(group, groupIndex) in sortedNavigationGroups" :key="group.key">
          <div v-if="getVisibleGroupItems(group.items).length > 0" class="flex flex-col">
            <div v-if="isCollapsed && groupIndex > 0" class="mx-2 mb-3 h-px bg-line-subtle" />
            <div
              v-if="group.label && !isCollapsed"
              class="px-2.5 pb-1 pt-1 text-2xs font-medium text-fg-subtle"
            >
              {{ group.label }}
            </div>
            <ul class="m-0 flex list-none flex-col gap-px p-0">
              <li v-for="item in getVisibleGroupItems(group.items)" :key="item.path">
                <SidebarNavigationItem
                  :name="item.name"
                  :href="item.path"
                  :icon="item.icon as Component"
                  :use-image="item.useImage"
                  :badge="item.badge"
                  :disabled="item.disabled"
                  :collapsed="isCollapsed"
                  :active="isActive(item.path)"
                  :link-component="RouterLink"
                  :data-tour-id="tourIdForItem(item)"
                  :count="
                    item.name === 'Messages'
                      ? totalUnreadMessages
                      : item.name === 'Live Streams'
                        ? liveCount
                        : item.name === 'My Creators'
                          ? liveCreatorsCount
                          : 0
                  "
                  :count-tone="item.name === 'Messages' ? 'brand' : 'live'"
                  @click="(e: MouseEvent) => !item.disabled && onNavClick(e, item)"
                />
              </li>
            </ul>
          </div>
        </template>
      </div>
    </nav>

    <!-- Account -->
    <div class="shrink-0 p-2">
      <template v-if="authStore.isAuthenticated">
        <DropdownMenu>
          <DropdownMenuTrigger
            class="sidebar-account flex w-full items-center rounded-lg text-left transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover"
            :class="isCollapsed ? 'justify-center p-1.5' : 'gap-2.5 px-2 py-1.5'"
            :title="isCollapsed ? displayName : undefined"
            data-tour-id="nav-profile-menu"
          >
            <Avatar :src="displayAvatar" :name="displayName" size="sm" tone="brand">{{ userInitials }}</Avatar>
            <span v-if="!isCollapsed" class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-fg">{{ displayName }}</span>
              <span class="block truncate text-2xs text-fg-subtle">{{ planLabel }}</span>
            </span>
            <ChevronsUpDown v-if="!isCollapsed" class="size-3.5 shrink-0 text-fg-subtle" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" :side-offset="10" class="w-60">
            <div class="flex items-center gap-2.5 px-2 py-2">
              <Avatar :src="displayAvatar" :name="displayName" size="md" tone="brand">{{ userInitials }}</Avatar>
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-fg">{{ displayName }}</span>
                <span class="block truncate text-xs text-fg-subtle">{{ formattedAddress }}</span>
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="isAIAllowed" @click="goToCredits">
              <Zap />
              <span class="flex-1">Credits</span>
              <span v-if="!loadingBalance" class="tabular text-xs font-medium text-brand">
                <template v-if="typeof hoursRemaining === 'string'">Unlimited</template>
                <template v-else>{{ Math.round(hoursRemaining as number) }} min</template>
              </span>
              <Loader2 v-else class="!size-3 animate-spin" />
            </DropdownMenuItem>
            <DropdownMenuItem v-if="!permissionsStore.isRestricted" @click="router.push('/billing')">
              <Receipt />
              Billing & plan
            </DropdownMenuItem>
            <DropdownMenuItem @click="router.push('/clipper-profile')">
              <UserCircle />
              Clipper profile
            </DropdownMenuItem>
            <DropdownMenuItem @click="showAccountSettingsDialog = true">
              <Settings />
              Account settings
            </DropdownMenuItem>
            <template v-if="authStore.user?.is_admin || authStore.user?.is_moderator">
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="router.push('/admin')">
                <ShieldCheck />
                {{ authStore.user?.is_admin ? 'Admin' : 'Moderator' }}
              </DropdownMenuItem>
            </template>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="showBugReportDialog = true">
              <Bug />
              Report a bug
            </DropdownMenuItem>
            <DropdownMenuItem class="text-danger focus:bg-danger-soft [&>svg]:!text-danger" @click="handleDisconnect">
              <LogOut />
              {{ disconnectButtonText }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
      <Button
        v-else
        variant="primary"
        block
        :size="isCollapsed ? 'icon' : 'md'"
        :title="isCollapsed ? 'Sign in' : undefined"
        @click="showAuthModal"
      >
        <LogIn />
        <span v-if="!isCollapsed">Sign in</span>
      </Button>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import SidebarNavigationItem from './SidebarNavigationItem.vue';
  import { ref, computed, onMounted, onUnmounted, watch, type Component } from 'vue';
  import { RouterLink, useRoute, useRouter } from 'vue-router';
  import { useAuthStore } from '@/stores/auth';

  const props = defineProps<{
    disabled?: boolean;
  }>();
  import { useMessagingStore } from '@/stores/messaging';
  import { usePermissionsStore } from '@/stores/permissions';
  import { useLiveStatusStore } from '@/stores/liveStatus';
  import { useWallet } from '@/composables/useWallet';
  import { useAIPermission } from '@/composables/useAIPermission';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useSidebarState } from '@/composables/useSidebarState';
  import { useAvatarProxy } from '@/composables/useAvatarProxy';
  import { getSortedNavigationGroups, type NavigationItem } from '@/config/navigation';
  import { getMyClipperProfile, type ClipperProfile } from '@/services/clipperProfilesApi';
  import BugReportDialog from '@/components/BugReportDialog.vue';
  import AccountSettingsDialog from '@/components/AccountSettingsDialog.vue';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import api from '@/services/api';
  import { canAccessAIVideo } from '@/utils/aiVideoAccess';
  import { canAccessCampaigns, canAccessImageEditor } from '@/utils/featureAccess';
  import { useAppTour, useTourFlags } from '@/composables/useAppTour';
  import { Avatar } from '@/components/ui/avatar';
  import { Button } from '@/components/ui/button';
  import {
    Zap,
    UserCircle,
    ChevronsUpDown,
    LogIn,
    LogOut,
    Loader2,
    ShieldCheck,
    Settings,
    Bug,
    LayoutGrid,
    Users,
    Megaphone,
    Scissors,
    Share2,
    Globe,
    FileText,
    FolderOpen,
    Receipt,
    Briefcase,
  } from 'lucide-vue-next';

  interface SidebarNavigationGroup {
    key: string;
    label: string;
    items: NavigationItem[];
  }

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
  const { isCollapsed: sidebarCollapsed } = useSidebarState();
  const { handleEditorNavClick, shouldInterceptEditorNav } = useAppTour();
  const { forceSidebarExpanded } = useTourFlags();

  const isCollapsed = computed(() => {
    if (forceSidebarExpanded.value) return false;
    return sidebarCollapsed.value;
  });

  function tourIdForItem(item: NavigationItem): string {
    if (item.tourId) return item.tourId;
    const slug = item.path.replace(/^\//, '').replace(/\//g, '-');
    return `nav-${slug}`;
  }

  async function onNavClick(e: MouseEvent, item: NavigationItem) {
    if (item.path === '/video-editor') {
      // Must preventDefault sync — awaiting first lets router-link win and skip the tour
      if (!shouldInterceptEditorNav('video')) return;
      e.preventDefault();
      e.stopPropagation();
      await handleEditorNavClick('video', router);
      return;
    }
    if (item.path === '/design-studio') {
      if (!shouldInterceptEditorNav('image')) return;
      e.preventDefault();
      e.stopPropagation();
      await handleEditorNavClick('image', router);
    }
  }

  // ===== Nav overflow hint (fade edges when the list scrolls) =====
  const navEl = ref<HTMLElement | null>(null);
  const navOverflowsBelow = ref(false);
  const navOverflowsAbove = ref(false);
  let navResizeObserver: ResizeObserver | null = null;

  function updateNavOverflow() {
    const el = navEl.value;
    if (!el) return;
    navOverflowsAbove.value = el.scrollTop > 2;
    navOverflowsBelow.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
  }

  // ===== Emits =====
  const emit = defineEmits<{
    'show-auth-modal': [];
  }>();

  // ===== Reactive State =====
  const hoursRemaining = ref<number | 'unlimited'>(0);
  const loadingBalance = ref(false);
  const isNativeEnvironment = ref(false);
  const showBugReportDialog = ref(false);
  const showAccountSettingsDialog = ref(false);
  const userOrganizations = ref<any[]>([]);
  const clipperProfile = ref<ClipperProfile | null>(null);
  const loadingClipperProfile = ref(false);
  let balanceRefreshInterval: ReturnType<typeof setInterval> | null = null;
  let unreadRefreshInterval: ReturnType<typeof setInterval> | null = null;

  // ===== Computed Properties =====
  const totalUnreadMessages = computed(() => messagingStore.totalUnread);
  const liveCount = computed(() => liveStatusStore.liveCount);
  const liveCreatorsCount = computed(() => liveStatusStore.liveCreatorsCount);

  const isOrgAccountOwner = computed(() => {
    return !!authStore.user?.owned_organization_id;
  });

  const orgSidebarOrganizationId = computed(() => {
    const routeOrgId = route.params.id;
    if (typeof routeOrgId === 'string' && routeOrgId.length > 0) {
      return routeOrgId;
    }
    if (authStore.user?.owned_organization_id) {
      return String(authStore.user.owned_organization_id);
    }
    return '';
  });

  const useOrganizationSidebar = computed(() => {
    if (authStore.user?.is_admin) return false;
    if (!isOrgAccountOwner.value || !orgSidebarOrganizationId.value) return false;
    // If admin granted a personal subscription, prefer personal nav
    const personalSubStatus = (authStore.user as any)?.subscription?.status;
    if (personalSubStatus === 'active') return false;
    return true;
  });

  const orgNavigationGroups = computed<SidebarNavigationGroup[]>(() => {
    const orgId = orgSidebarOrganizationId.value;
    if (!orgId) return [];

    const basePath = `/organization/${orgId}`;

    return [
      {
        key: 'team',
        label: 'Team',
        items: [
          { name: 'Hub', path: basePath, icon: LayoutGrid, group: 'browse' },
          { name: 'Members', path: `${basePath}/members`, icon: Users, group: 'browse' },
          { name: 'Creators', path: `${basePath}/creators`, icon: UserCircle, group: 'browse' },
        ],
      },
      {
        key: 'content',
        label: 'Content',
        items: [
          {
            name: 'Campaigns',
            path: `${basePath}/campaigns`,
            icon: Megaphone,
            group: 'create',
            navHidden: true,
          },
          { name: 'Clippers', path: `${basePath}/clippers`, icon: Scissors, group: 'create' },
          { name: 'Shared Clips', path: `${basePath}/shared`, icon: Share2, group: 'create' },
          { name: 'Social Accounts', path: `${basePath}/social`, icon: Globe, group: 'create' },
          { name: 'Posts', path: `${basePath}/posts`, icon: FileText, group: 'create' },
          { name: 'Hiring', path: `${basePath}/hiring`, icon: Briefcase, group: 'create' },
        ],
      },
      {
        key: 'management',
        label: 'Management',
        items: [
          { name: 'Assets', path: `${basePath}/assets`, icon: FolderOpen, group: 'manage' },
          { name: 'Billing', path: `${basePath}/billing`, icon: Receipt, group: 'manage' },
          { name: 'Settings', path: `${basePath}/settings`, icon: Settings, group: 'manage' },
        ],
      },
    ];
  });

  const sortedNavigationGroups = computed<SidebarNavigationGroup[]>(() => {
    if (useOrganizationSidebar.value && orgNavigationGroups.value.length > 0) {
      return orgNavigationGroups.value;
    }
    return getSortedNavigationGroups();
  });

  const formattedAddress = computed(() => {
    if (!authStore.isAuthenticated) return '';
    if (authStore.authProvider && ['google', 'email'].includes(authStore.authProvider) && authStore.email) {
      return authStore.email;
    }
    return formatAddress(authStore.walletAddress ?? '');
  });

  // Display name and avatar from clipper profile, falling back to user info
  const displayName = computed(() => {
    if (clipperProfile.value?.display_name) {
      return clipperProfile.value.display_name;
    }
    if (authStore.user?.name) {
      return authStore.user.name;
    }
    return formattedAddress.value;
  });

  const sourceAvatarUrl = computed(() => clipperProfile.value?.avatar_url || authStore.user?.avatar_url || null);

  const { resolvedUrl: displayAvatar } = useAvatarProxy(() => sourceAvatarUrl.value);

  const userInitials = computed(() => {
    if (!authStore.isAuthenticated) return '';

    // Use clipper profile display name if available
    if (clipperProfile.value?.display_name) {
      const name = clipperProfile.value.display_name;
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }

    // Use user name if available
    if (authStore.user?.name) {
      const name = authStore.user.name;
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }

    // Fallback to email or wallet
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

  const planLabel = computed(() => {
    const sub = (authStore.user as any)?.subscription;
    const plan = sub?.plan_name || sub?.tier || sub?.plan;
    if (plan && (sub?.status === 'active' || sub?.status === 'trialing')) {
      return `${String(plan).charAt(0).toUpperCase()}${String(plan).slice(1)} plan`;
    }
    return formattedAddress.value;
  });

  const disconnectButtonText = computed(() => {
    return authStore.authProvider && ['google', 'email'].includes(authStore.authProvider) ? 'Sign out' : 'Disconnect';
  });

  // ===== Navigation Filtering =====
  function getVisibleGroupItems(items: NavigationItem[]): NavigationItem[] {
    if (useOrganizationSidebar.value) {
      return items.filter((item) => item.name !== 'Admin' && item.name !== 'Bug Report' && !item.navHidden);
    }

    return items
      .filter((item) => {
        if (item.navHidden) {
          return false;
        }
        // Hide Admin and Bug Report from navigation - they're now in the profile dropdown
        if (item.name === 'Admin' || item.name === 'Bug Report') {
          return false;
        }
        // Check affiliate-only items
        if (item.affiliateOnly) {
          return authStore.user?.is_affiliate === true;
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
        if (item.path === '/campaigns' && !canAccessCampaigns(authStore.user)) {
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
      })
      .map((item) => {
        if (item.path === '/ai-video') {
          const hasAccess = canAccessAIVideo(authStore.user);
          return {
            ...item,
            disabled: !hasAccess,
            badge: hasAccess ? item.badge : 'Coming Soon',
          };
        }
        if (item.path === '/design-studio' || item.path === '/ai-image') {
          const hasAccess = canAccessImageEditor(authStore.user);
          return {
            ...item,
            disabled: !hasAccess,
            badge: hasAccess ? item.badge : 'Coming Soon',
          };
        }
        return item;
      });
  }

  function isActive(path: string): boolean {
    if (path === '/organizations') {
      if (useOrganizationSidebar.value) {
        return route.path === '/organizations';
      }
      return route.path.startsWith('/organizations') || route.path.startsWith('/organization/');
    }

    const orgHubPath = orgSidebarOrganizationId.value ? `/organization/${orgSidebarOrganizationId.value}` : '';
    if (path === orgHubPath) {
      return route.path === orgHubPath || route.path === `${orgHubPath}/`;
    }

    return route.path === path || route.path.startsWith(`${path}/`);
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

  function goToCredits() {
    if (useOrganizationSidebar.value && orgSidebarOrganizationId.value) {
      router.push(`/organization/${orgSidebarOrganizationId.value}/billing`);
      return;
    }
    router.push('/billing');
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

  async function loadClipperProfile() {
    if (!authStore.isAuthenticated) {
      clipperProfile.value = null;
      return;
    }

    loadingClipperProfile.value = true;
    try {
      const result = await getMyClipperProfile();
      if (result.success && result.profile) {
        clipperProfile.value = result.profile;
      }
    } catch (error) {
      console.error('Failed to load clipper profile:', error);
    } finally {
      loadingClipperProfile.value = false;
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
        loadClipperProfile();
        permissionsStore.fetchRestrictions();
        // Refresh live counts now that we're authenticated (to get org profiles)
        liveStatusStore.refreshCreators();
        messagingStore.fetchTotalUnread();
      } else {
        userOrganizations.value = [];
        clipperProfile.value = null;
        permissionsStore.reset();
      }
    },
    { immediate: true }
  );

  // ===== Lifecycle =====
  onMounted(() => {
    if (navEl.value) {
      navResizeObserver = new ResizeObserver(updateNavOverflow);
      navResizeObserver.observe(navEl.value);
      if (navEl.value.firstElementChild) navResizeObserver.observe(navEl.value.firstElementChild);
    }
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

    // Fetch total unread messages for sidebar badge and poll every 30s
    if (authStore.isAuthenticated) {
      messagingStore.fetchTotalUnread();
    }
    unreadRefreshInterval = setInterval(() => {
      if (authStore.isAuthenticated) {
        messagingStore.fetchTotalUnread();
      }
    }, 30000);
  });

  onUnmounted(() => {
    navResizeObserver?.disconnect();
    if (balanceRefreshInterval) {
      clearInterval(balanceRefreshInterval);
      balanceRefreshInterval = null;
    }
    if (unreadRefreshInterval) {
      clearInterval(unreadRefreshInterval);
      unreadRefreshInterval = null;
    }
    window.removeEventListener('auth-state-changed', handleAuthStateChanged as EventListener);

    // Stop polling for live status
    liveStatusStore.stopPolling();
  });
</script>

<style scoped>
  .nav-fade-bottom {
    mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
  }
  .nav-fade-top {
    mask-image: linear-gradient(to bottom, transparent, #000 20px);
  }
  .nav-fade-top.nav-fade-bottom {
    mask-image: linear-gradient(to bottom, transparent, #000 20px, #000 calc(100% - 28px), transparent);
  }
</style>
