<template>
  <PageLayout
    title="Social accounts"
    description="Manage connected social platforms for your organization"
    :icon="Globe"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Social accounts' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Refresh accounts"
        aria-label="Refresh accounts"
        :disabled="loading"
        @click="loadAccounts"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
      <DropdownMenu v-if="isAdmin">
        <DropdownMenuTrigger as-child>
          <Button variant="primary" size="sm" :loading="connectingPlatform !== null">
            <Plus v-if="connectingPlatform === null" />
            {{ connectingPlatform ? `Connecting ${CONNECT_PLATFORM_LABELS[connectingPlatform]}…` : 'Connect account' }}
            <ChevronDown v-if="connectingPlatform === null" class="-mr-0.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-72">
          <DropdownMenuItem
            v-for="option in connectOptions"
            :key="option.id"
            class="h-auto items-start py-2"
            :disabled="connectingPlatform !== null"
            @select="connectPlatform(option.id)"
          >
            <PlatformLogo :platform="option.logo" size="md" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm text-fg">{{ option.label }}</span>
              <span class="block text-xs text-fg-subtle">{{ option.description }}</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>

    <div class="flex flex-col gap-6 px-5 py-4">
      <!-- Connected accounts -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader
          title="Connected accounts"
          :count="loading && accounts.length === 0 ? undefined : accounts.length"
          description="Accounts your team can publish clips to."
        />

        <!-- Loading -->
        <div
          v-if="loading && accounts.length === 0"
          class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface"
          aria-busy="true"
        >
          <div v-for="i in 2" :key="i" class="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0">
            <div class="skeleton size-8 shrink-0 rounded-full" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-36" />
              <div class="skeleton h-3 w-52 max-w-full" />
            </div>
            <div class="skeleton h-7 w-20" />
          </div>
        </div>

        <!-- Empty -->
        <EmptyState
          v-else-if="accounts.length === 0"
          :icon="Link2"
          size="sm"
          title="No accounts connected"
          description="Connect your social media accounts to publish clips directly from Clippster."
        />

        <!-- Accounts -->
        <ul v-else class="animate-fade-in overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <li
            v-for="account in accounts"
            :key="account.id"
            class="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0"
            :class="{ 'opacity-70': !account.is_active }"
          >
            <!-- Avatar with platform badge -->
            <div class="relative shrink-0">
              <span class="grid size-8 place-items-center overflow-hidden rounded-full border border-line bg-surface-hover">
                <img
                  v-if="account.profile_image_url"
                  :src="account.profile_image_url"
                  :alt="account.username"
                  class="size-full object-cover"
                />
                <PlatformLogo v-else :platform="account.platform" size="lg" shape="circle" />
              </span>
              <PlatformLogo
                v-if="account.profile_image_url"
                :platform="account.platform"
                size="xs"
                shape="circle"
                class="absolute -bottom-0.5 -right-0.5 ring-2 ring-[var(--surface)]"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-sm font-medium text-fg">@{{ account.username }}</span>
                <Badge v-if="!account.is_active">Inactive</Badge>
                <Badge v-else-if="isTokenExpiringSoonForAccount(account)" variant="warning">
                  <AlertTriangle />
                  Token expiring
                </Badge>
                <Badge v-else variant="success">Active</Badge>
              </div>
              <p class="truncate text-xs text-fg-subtle">
                <template v-if="account.display_name">{{ account.display_name }} · </template>
                Connected {{ formatDate(account.connected_at) }}
              </p>
            </div>

            <Button
              v-if="isAdmin"
              variant="ghost"
              size="sm"
              :title="`Manage assignments for @${account.username}`"
              @click="openAssignments(account)"
            >
              <Users />
              <span class="tabular">{{ account.assignments?.length || 0 }}</span>
              <span class="hidden sm:inline">{{ (account.assignments?.length || 0) === 1 ? 'member' : 'members' }}</span>
            </Button>
            <span v-else class="tabular flex items-center gap-1 text-xs text-fg-muted">
              <Users class="size-3.5" />
              {{ account.assignments?.length || 0 }}
            </span>

            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm" title="Account actions" aria-label="Account actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-48">
                <DropdownMenuItem @select="openAssignments(account)">
                  <Users />
                  Manage assignments
                </DropdownMenuItem>
                <DropdownMenuItem @select="reconnectAccount(account)">
                  <RefreshCw />
                  Reconnect
                </DropdownMenuItem>
                <DropdownMenuItem v-if="account.is_active" @select="toggleActive(account, false)">
                  <XCircle />
                  Deactivate
                </DropdownMenuItem>
                <DropdownMenuItem v-else @select="toggleActive(account, true)">
                  <CheckCircle />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                  @select="confirmDelete(account)"
                >
                  <Trash2 />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      </section>

      <!-- Scheduled posts -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Scheduled posts" description="Posts queued for your organization's accounts." />
        <OrgScheduledPostsList v-if="organizationId" :organization-id="organizationId" />
      </section>
    </div>

    <!-- Assignments Dialog -->
    <SocialAccountAssignments
      v-if="selectedAccount"
      :account="selectedAccount"
      :organization-id="organizationId ?? ''"
      :members="members"
      :open="showAssignmentsDialog"
      @close="showAssignmentsDialog = false"
      @updated="loadAccounts"
    />

    <!-- Disconnect confirmation -->
    <Modal
      :open="showDeleteDialog"
      title="Disconnect account"
      :description="accountToDelete ? `@${accountToDelete.username}` : undefined"
      :icon="Trash2"
      tone="danger"
      size="sm"
      @close="showDeleteDialog = false"
    >
      <p class="text-sm text-fg-muted">
        This removes all member assignments. Existing posts will remain but won't be synced.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" @click="deleteAccount">Disconnect account</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Globe,
    Users,
    AlertTriangle,
    Link2,
    Plus,
    RefreshCw,
    MoreHorizontal,
    XCircle,
    CheckCircle,
    Trash2,
    ChevronDown,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import SocialAccountAssignments from '@/components/organization/SocialAccountAssignments.vue';
  import OrgScheduledPostsList from '@/components/organization/OrgScheduledPostsList.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';
  import { canAccessTokend } from '@/utils/tokendAccess';
  import {
    listSocialAccounts,
    startInstagramOAuthPopup,
    startTiktokOAuthPopup,
    startTwitterOAuthPopup,
    startYoutubeOAuthPopup,
    updateSocialAccount,
    deleteSocialAccount,
    type SocialAccount,
  } from '@/services/socialAccountsApi';
  import { startOrgTokendConnection } from '@/services/userTokendApi';
  import { reconnectOrgSocialPlatform } from '@/utils/socialOAuthReconnect';
  import { isTokenExpiringSoonForAccount } from '@/utils/socialTokenExpiry';

  type ConnectPlatform = 'instagram' | 'tiktok' | 'YouTube' | 'x' | 'tokend';

  const CONNECT_PLATFORM_LABELS: Record<ConnectPlatform, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    YouTube: 'YouTube',
    x: 'X',
    tokend: 'Tokend',
  };

  const { organizationId, isAdmin, members, loadOrganization } = useOrganization();
  const { showToast } = useToast();
  const authStore = useAuthStore();
  const canUseTokend = computed(() => canAccessTokend(authStore.user));

  // Platforms offered in the "Connect account" menu
  const connectOptions = computed(() => {
    const options: { id: ConnectPlatform; logo: string; label: string; description: string }[] = [
      { id: 'instagram', logo: 'instagram', label: 'Instagram', description: 'Business or Creator account · publish Reels' },
      { id: 'tiktok', logo: 'tiktok', label: 'TikTok', description: 'Share clips directly to TikTok' },
      { id: 'YouTube', logo: 'youtube', label: 'YouTube Shorts', description: 'Upload clips as Shorts automatically' },
      { id: 'x', logo: 'x', label: 'X (Twitter)', description: 'Post clips directly to X' },
    ];
    if (canUseTokend.value) {
      options.push({
        id: 'tokend',
        logo: 'tokend',
        label: 'Tokend',
        description: 'Native Tokend account for browsing, connect and partner publish',
      });
    }
    return options;
  });

  const loading = ref(true);
  const connectingPlatform = ref<ConnectPlatform | null>(null);
  const accounts = ref<SocialAccount[]>([]);
  const selectedAccount = ref<SocialAccount | null>(null);
  const showAssignmentsDialog = ref(false);
  const showDeleteDialog = ref(false);
  const accountToDelete = ref<SocialAccount | null>(null);

  // Cleanup function for OAuth listener
  let cleanupAuthListener: (() => void) | null = null;

  onMounted(() => {
    loadAccounts();
  });

  onUnmounted(() => {
    if (cleanupAuthListener) {
      cleanupAuthListener();
    }
  });

  async function handleAuthResult(result: { success: boolean; account?: any; error?: string }) {
    const connectedPlatform = connectingPlatform.value;
    const platformLabel = connectedPlatform ? CONNECT_PLATFORM_LABELS[connectedPlatform] : 'Social';

    if (result.success && result.account) {
      showToast(`${platformLabel} account @${result.account.username} connected successfully`, 'success');
      await loadAccounts();
      loadOrganization();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
    connectingPlatform.value = null;
  }

  async function loadAccounts() {
    if (!organizationId.value) return;
    loading.value = true;
    try {
      const response = await listSocialAccounts(organizationId.value, true);
      if (response.success) {
        accounts.value = canUseTokend.value
          ? response.accounts
          : response.accounts.filter((account) => account.platform !== 'tokend');
      } else {
        showToast('Failed to load accounts', 'error');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showToast('Failed to load accounts', 'error');
    } finally {
      loading.value = false;
    }
  }

  async function connectPlatform(platform: ConnectPlatform) {
    if (!organizationId.value) return;
    connectingPlatform.value = platform;

    try {
      if (cleanupAuthListener) {
        cleanupAuthListener();
        cleanupAuthListener = null;
      }

      if (platform === 'instagram') {
        cleanupAuthListener = await startInstagramOAuthPopup(organizationId.value, handleAuthResult);
        return;
      }

      if (platform === 'tiktok') {
        cleanupAuthListener = await startTiktokOAuthPopup(organizationId.value, handleAuthResult);
        return;
      }

      if (platform === 'YouTube') {
        cleanupAuthListener = await startYoutubeOAuthPopup(organizationId.value, handleAuthResult);
        return;
      }

      if (platform === 'tokend') {
        cleanupAuthListener = await startOrgTokendConnection(organizationId.value, async (result) => {
          if (result.success) {
            showToast(
              result.account
                ? `Tokend @${result.account.username} connected`
                : 'Tokend account connected',
              'success'
            );
            await loadAccounts();
          } else {
            showToast(result.message || result.error || 'Failed to connect Tokend', 'error');
          }
          connectingPlatform.value = null;
        });
        return;
      }

      cleanupAuthListener = await startTwitterOAuthPopup(organizationId.value, handleAuthResult);
    } catch (error) {
      const platformLabel = CONNECT_PLATFORM_LABELS[platform];
      console.error(`Failed to connect ${platformLabel}:`, error);
      showToast(error instanceof Error ? error.message : `Failed to connect ${platformLabel}.`, 'error');
      connectingPlatform.value = null;
    }
  }

  function openAssignments(account: SocialAccount) {
    selectedAccount.value = account;
    showAssignmentsDialog.value = true;
  }

  async function toggleActive(account: SocialAccount, active: boolean) {
    if (!organizationId.value) return;
    try {
      const response = await updateSocialAccount(organizationId.value, account.id, {
        is_active: active,
      });

      if (response.success) {
        showToast(`Account ${active ? 'activated' : 'deactivated'}`, 'success');
        await loadAccounts();
      } else {
        showToast(response.error || 'Failed to update account', 'error');
      }
    } catch (error) {
      console.error('Failed to toggle account:', error);
      showToast('Failed to update account', 'error');
    }
  }

  async function reconnectAccount(account: SocialAccount) {
    if (!organizationId.value) return;
    try {
      if (cleanupAuthListener) {
        cleanupAuthListener();
        cleanupAuthListener = null;
      }
      connectingPlatform.value = account.platform as ConnectPlatform;
      cleanupAuthListener = await reconnectOrgSocialPlatform(
        organizationId.value,
        account.platform,
        (result) => {
          if (result.success) {
            showToast(`${account.platform} reconnected`, 'success');
            void loadAccounts();
          } else if (result.error) {
            showToast(result.error, 'error');
          }
          connectingPlatform.value = null;
        },
        {
          socialAccountId: account.id,
          providerAccountId: account.provider_account_id ?? undefined,
        }
      );
    } catch (error) {
      console.error('Failed to reconnect account:', error);
      showToast(error instanceof Error ? error.message : 'Failed to reconnect account', 'error');
      connectingPlatform.value = null;
    }
  }

  function confirmDelete(account: SocialAccount) {
    accountToDelete.value = account;
    showDeleteDialog.value = true;
  }

  async function deleteAccount() {
    if (!accountToDelete.value || !organizationId.value) return;

    try {
      const response = await deleteSocialAccount(organizationId.value, accountToDelete.value.id);
      if (response.success) {
        showToast('Account disconnected', 'success');
        await loadAccounts();
        loadOrganization();
      } else {
        showToast(response.error || 'Failed to disconnect account', 'error');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      showToast('Failed to disconnect account', 'error');
    } finally {
      showDeleteDialog.value = false;
      accountToDelete.value = null;
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return fmtDate(dateString);
  }
</script>

