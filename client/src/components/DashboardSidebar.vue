<template>
  <aside
    class="sidebar fixed left-0 top-0 h-screen flex flex-col bg-[var(--sidebar-bg)] transition-[width] duration-200 ease-out z-40"
    :class="{
      'sidebar--native': isNativeEnvironment,
      'w-60': !isCollapsed,
      'w-12': isCollapsed,
      'sidebar--disabled': disabled,
    }"
  >
    <!-- Bug Report Dialog -->
    <BugReportDialog
      :show="showBugReportDialog"
      @close="showBugReportDialog = false"
      @submitted="handleBugReportSubmitted"
    />

    <!-- Account Settings Dialog -->
    <AccountSettingsDialog :show="showAccountSettingsDialog" @close="showAccountSettingsDialog = false" />

    <!-- ===== Navigation Section ===== -->
    <nav class="flex-1 overflow-hidden">
      <div class="sidebar-nav__scroll h-full overflow-y-auto overflow-x-hidden">
        <div class="flex flex-col" :class="isCollapsed ? 'p-1.5 gap-1' : 'p-3 gap-4'">
          <template v-for="(group, groupIndex) in sortedNavigationGroups" :key="group.key">
            <div v-if="getVisibleGroupItems(group.items).length > 0" class="flex flex-col gap-1">
              <!-- Collapsed divider between groups -->
              <div v-if="isCollapsed && groupIndex > 0" class="sidebar-collapsed-divider mx-1.5 my-1" />

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
                  <!-- Disabled item (non-clickable) -->
                  <div
                    v-if="item.disabled"
                    class="flex items-center w-full py-2 rounded-md text-[var(--sidebar-text-muted)] bg-transparent border-[none] no-underline text-sm opacity-40 cursor-not-allowed select-none"
                    :class="{
                      'justify-center px-0': isCollapsed,
                      'gap-3 px-3': !isCollapsed,
                    }"
                    :title="isCollapsed ? item.badge || item.name : undefined"
                    :data-tour-id="tourIdForItem(item)"
                  >
                    <div class="relative flex items-center justify-center shrink-0">
                      <component :is="item.icon as Component" class="w-[18px] h-[18px]" />
                    </div>
                    <span v-if="!isCollapsed" class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {{ item.name }}
                    </span>
                    <span
                      v-if="item.badge && !isCollapsed"
                      class="ml-auto px-1.5 py-0.5 text-[0.5625rem] font-semibold leading-none rounded whitespace-nowrap"
                      :class="
                        item.badge === 'Beta'
                          ? 'bg-[var(--sidebar-accent)] text-black'
                          : 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]'
                      "
                    >
                      {{ item.badge }}
                    </span>
                  </div>
                  <!-- Normal nav item -->
                  <router-link
                    v-else
                    :to="item.path"
                    class="flex items-center w-full py-2 rounded-md text-[var(--sidebar-text-muted)] bg-transparent border-[none] no-underline text-sm transition-all duration-150 cursor-pointer hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                    :class="{
                      'sidebar-nav-item--active': isActive(item.path),
                      'justify-center px-0': isCollapsed,
                      'gap-3 px-3': !isCollapsed,
                    }"
                    :title="isCollapsed ? item.badge ? `${item.name} (${item.badge})` : item.name : undefined"
                    :data-tour-id="tourIdForItem(item)"
                    @click="(e) => onNavClick(e, item)"
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
                      <!-- Live badge for My Creators (icon badge when collapsed) -->
                      <span
                        v-if="item.name === 'My Creators' && liveCreatorsCount > 0 && isCollapsed"
                        class="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center text-xs font-semibold bg-[var(--sidebar-accent)] text-black rounded-lg"
                      >
                        {{ liveCreatorsCount > 99 ? '99+' : liveCreatorsCount }}
                      </span>
                    </div>
                    <span v-if="!isCollapsed" class="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
                      {{ item.name }}
                    </span>
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
                    <!-- Live badge for My Creators (right side when expanded) -->
                    <span
                      v-if="item.name === 'My Creators' && liveCreatorsCount > 0 && !isCollapsed"
                      class="ml-auto flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-semibold bg-[var(--sidebar-accent)] text-black rounded-md"
                    >
                      {{ liveCreatorsCount > 99 ? '99+' : liveCreatorsCount }}
                    </span>
                    <span
                      v-if="item.badge && !isCollapsed && item.name !== 'Messages' && item.name !== 'Live' && item.name !== 'My Creators'"
                      class="ml-auto px-1.5 py-0.5 text-[0.5625rem] font-semibold leading-none rounded whitespace-nowrap"
                      :class="
                        item.badge === 'Beta'
                          ? 'bg-[var(--sidebar-accent)] text-black'
                          : 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)]'
                      "
                    >
                      {{ item.badge }}
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
              data-tour-id="nav-profile-menu"
            >
              <div
                class="shrink-0 flex items-center justify-center rounded-[20px] overflow-hidden"
                :class="[displayAvatar ? '' : 'bg-[var(--sidebar-accent)]', isCollapsed ? 'w-6 h-6' : 'w-7 h-7']"
              >
                <img v-if="displayAvatar" :src="displayAvatar" :alt="displayName" class="w-full h-full object-cover" />
                <span v-else class="text-xs font-extrabold text-[#0a0a0b] uppercase">{{ userInitials }}</span>
              </div>
              <span
                v-if="!isCollapsed"
                class="flex-1 text-xs text-left whitespace-nowrap overflow-hidden text-ellipsis text-[var(--sidebar-text-muted)]"
                :title="displayName"
              >
                {{ displayName }}
              </span>
              <ChevronRight v-if="!isCollapsed" class="w-3.5 h-3.5 text-[var(--sidebar-text-muted)] shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" :side-offset="12" class="sidebar-dropdown">
              <DropdownMenuLabel class="sidebar-dropdown__label">
                {{ displayName }}
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="sidebar-dropdown__separator" />
              <!-- Credits Display -->
              <DropdownMenuItem
                v-if="isAIAllowed"
                class="sidebar-dropdown__item sidebar-dropdown__credits"
                @click="goToCredits"
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
              <!-- Account Settings -->
              <DropdownMenuItem class="sidebar-dropdown__item" @click="showAccountSettingsDialog = true">
                <Settings class="w-4 h-4 mr-2" />
                Account Settings
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
              <!-- Moderator Link (conditional) -->
              <DropdownMenuItem
                v-if="authStore.user?.is_moderator && !authStore.user?.is_admin"
                class="sidebar-dropdown__item"
                @click="router.push('/admin')"
              >
                <Settings class="w-4 h-4 mr-2" />
                Moderator
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import api from '@/services/api';
  import { canAccessAIVideo } from '@/utils/aiVideoAccess';
  import { useAppTour, useTourFlags } from '@/composables/useAppTour';
  import {
    Zap,
    UserCircle,
    ChevronRight,
    LogOut,
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

  const disconnectButtonText = computed(() => {
    return authStore.authProvider && ['google', 'email'].includes(authStore.authProvider) ? 'Sign Out' : 'Disconnect';
  });

  // ===== Navigation Filtering =====
  function getVisibleGroupItems(items: NavigationItem[]): NavigationItem[] {
    if (useOrganizationSidebar.value) {
      return items.filter(
        (item) => item.name !== 'Admin' && item.name !== 'Bug Report' && !item.navHidden
      );
    }

    return items.filter((item) => {
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
    }).map((item) => {
      // Dynamically disable AI Video Editor / AI Thumbnail Creator for non-authorized users
      // (same grant: admin, or ai_editor_enabled + Creator/Pro)
      if (item.path === '/ai-video' || item.path === '/ai-thumbnail') {
        const hasAccess = canAccessAIVideo(authStore.user);
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

  /* Disabled state removed - free tier users have full sidebar access */
  /* Individual features are gated via feature flags, not the entire sidebar */
</style>
