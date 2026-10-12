<template>
  <PageLayout
    title="Users"
    description="Manage user accounts, credits, and subscriptions"
    :icon="Users"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Users' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh users" :disabled="loading" @click="fetchUsers">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar
        v-model:search="searchQuery"
        placeholder="Search by email or wallet…"
        :count="filteredAndSortedUsers.length"
        count-label="user"
      >
        <template #end>
          <Button
            variant="ghost"
            size="sm"
            :disabled="!users.some((user) => Boolean(user.email))"
            @click="exportUsersCsv"
          >
            <Download />
            Export CSV
          </Button>
        </template>
      </AdminFilterBar>
    </template>

    <div class="px-5 py-4">
      <!-- Error -->
      <EmptyState v-if="error" :icon="AlertTriangle" tone="danger" title="Failed to load users" :description="error">
        <Button variant="secondary" @click="fetchUsers">Try again</Button>
      </EmptyState>

      <!-- Users table -->
      <DataTable
        v-else
        :columns="columns"
        :rows="filteredAndSortedUsers"
        row-key="id"
        :loading="loading"
        :sort-key="sortColumn"
        :sort-direction="sortDirection"
        clickable
        :empty-icon="Users"
        :empty-title="searchQuery ? 'No users match your search' : 'No users yet'"
        @sort="toggleSort($event as SortColumn)"
        @row-click="(user) => navigateToUserProfile(user.id)"
      >
        <template #cell-id="{ row: user }">
          <span class="tabular text-xs text-fg-subtle">#{{ user.id }}</span>
        </template>

        <template #cell-account="{ row: user }">
          <div class="flex min-w-0 items-center gap-2.5">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-surface-raised text-fg-subtle @max-3xl:hidden">
              <component :is="getProviderIcon(user.provider)" class="size-3.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="group/acct flex min-w-0 items-center gap-1">
                <template v-if="user.email && (!user.wallet_address || user.provider !== 'wallet')">
                  <span class="truncate font-medium text-fg">{{ user.email }}</span>
                  <!-- Role column is hidden on narrow windows; keep staff visible here -->
                  <Badge v-if="user.is_admin" variant="brand" class="@3xl:hidden">Admin</Badge>
                  <Badge v-else-if="user.is_moderator" variant="neutral" class="@3xl:hidden">Mod</Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="opacity-0 group-hover/acct:opacity-100"
                    :title="`Copy ${user.email}`"
                    @click.stop="copyToClipboard(user.email!)"
                  >
                    <Copy />
                  </Button>
                </template>
                <template v-else-if="user.wallet_address">
                  <code class="truncate font-mono text-xs text-fg">{{ formatWalletAddress(user.wallet_address) }}</code>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="opacity-0 group-hover/acct:opacity-100"
                    :title="`Copy ${user.wallet_address}`"
                    @click.stop="copyToClipboard(user.wallet_address!)"
                  >
                    <Copy />
                  </Button>
                </template>
                <span v-else class="truncate italic text-fg-subtle">No account info</span>
              </div>
              <p class="truncate text-xs text-fg-subtle">
                {{ formatProvider(user.provider) }} · Joined {{ formatExpiredDate(user.created_at) }}
              </p>
            </div>
          </div>
        </template>

        <template #cell-role="{ row: user }">
          <div class="flex min-w-0 flex-wrap items-center gap-1">
            <Badge v-if="user.is_admin" variant="brand"><ShieldCheck />Admin</Badge>
            <Badge v-else-if="user.is_moderator" variant="neutral"><Shield />Moderator</Badge>
            <span v-else class="text-xs text-fg-muted">User</span>
            <Badge
              v-if="user.is_affiliate"
              :variant="statusVariant(user.affiliate_status || 'active')"
              :title="`Affiliate (${formatStatus(user.affiliate_status || 'active')})`"
            >
              <Handshake />Affiliate
            </Badge>
            <Badge v-if="user.created_by_organization_id" variant="outline" title="Created by organization">
              <Building2 />Org
            </Badge>
          </div>
        </template>

        <template #cell-subscription="{ row: user }">
          <button
            type="button"
            class="-mx-1.5 flex max-w-full flex-col items-start rounded-md px-1.5 py-0.5 text-left transition-colors enabled:hover:bg-surface-hover disabled:cursor-default"
            :disabled="user.is_admin"
            :title="user.is_admin ? undefined : 'Manage subscription'"
            @click.stop="openSubscriptionDialog(user)"
          >
            <span class="flex max-w-full items-center gap-1.5 text-sm">
              <span v-if="user.subscription?.tier_name" class="truncate font-medium capitalize text-fg">
                {{ user.subscription.tier_name }}
              </span>
              <span v-else-if="user.created_by_organization_id" class="truncate text-fg-muted">Organization</span>
              <span v-else class="text-fg-subtle">None</span>
              <Building2
                v-if="user.subscription?.organization_id"
                class="size-3 shrink-0 text-fg-subtle"
                title="Organization subscription"
              />
            </span>
            <span class="flex max-w-full items-center gap-1 whitespace-nowrap text-xs">
              <span :class="subscriptionStatusText(user.subscription?.status)">
                {{ formatStatus(user.subscription?.status) }}
              </span>
              <span v-if="user.subscription?.days_remaining > 0" class="tabular text-fg-subtle">
                · {{ user.subscription.days_remaining }}d left
              </span>
              <span
                v-else-if="isExpiredSubscription(user.subscription) && user.subscription.end_date"
                class="truncate text-fg-subtle"
              >
                · {{ formatExpiredDate(user.subscription.end_date) }}
              </span>
            </span>
          </button>
        </template>

        <template #cell-credits="{ row: user }">
          <p class="tabular text-sm text-fg">
            {{ formatCredits(user.credits?.hours_remaining || 0) }}
            <span class="text-xs text-fg-subtle">min</span>
          </p>
          <p class="tabular text-xs text-fg-subtle">{{ formatCredits(user.credits?.hours_used || 0) }} used</p>
        </template>

        <template #actions="{ row: user }">
          <AdminRowActions
            v-if="!user.is_admin"
            :label="`Actions for ${getUserDisplayName(user)}`"
            :loading="isUserBusy(user.id)"
          >
            <AdminActionItem :icon="User" @select="navigateToUserProfile(user.id)">View profile</AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem
              v-if="!user.is_moderator"
              :icon="Shield"
              :loading="promotingModUserId === user.id"
              @select="confirmPromoteToModerator(user)"
            >
              Promote to moderator
            </AdminActionItem>
            <AdminActionItem
              v-if="user.is_moderator"
              :icon="ShieldOff"
              :loading="demotingModUserId === user.id"
              @select="confirmDemoteModerator(user)"
            >
              Demote moderator
            </AdminActionItem>
            <AdminActionItem :icon="ShieldCheck" :loading="promotingUserId === user.id" @select="confirmPromoteUser(user)">
              Promote to admin
            </AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem
              :icon="CreditCard"
              :loading="updatingCreditsUserId === user.id"
              @select="openCreditDialog(user)"
            >
              Add credits
            </AdminActionItem>
            <AdminActionItem
              :icon="Layers"
              :loading="updatingSubscriptionUserId === user.id"
              @select="openSubscriptionDialog(user)"
            >
              Subscription
            </AdminActionItem>
            <template v-if="!user.subscription?.tier_name">
              <DropdownMenuSeparator />
              <AdminActionItem
                :icon="Trash2"
                destructive
                :loading="deletingUserId === user.id"
                @select="confirmDeleteUser(user)"
              >
                Delete account
              </AdminActionItem>
            </template>
          </AdminRowActions>
        </template>
      </DataTable>
    </div>

    <!-- Promotion Confirmation Modal -->
    <ConfirmationModal
      :show="showPromoteDialog"
      title="Promote user to admin"
      :message="'Are you sure you want to promote'"
      :item-name="userToPromote ? getUserDisplayName(userToPromote) : ''"
      suffix="to admin?"
      confirm-text="Promote"
      :icon="ShieldCheck"
      @close="handlePromoteDialogClose"
      @confirm="promoteUserConfirmed"
    />

    <!-- Moderator Promotion Confirmation Modal -->
    <ConfirmationModal
      :show="showPromoteModDialog"
      title="Promote user to moderator"
      :message="'Are you sure you want to promote'"
      :item-name="userToPromoteMod ? getUserDisplayName(userToPromoteMod) : ''"
      suffix="to moderator?"
      confirm-text="Promote"
      :icon="Shield"
      @close="handlePromoteModDialogClose"
      @confirm="promoteToModeratorConfirmed"
    />

    <!-- Moderator Demotion Confirmation Modal -->
    <ConfirmationModal
      :show="showDemoteModDialog"
      title="Demote moderator"
      :message="'Are you sure you want to demote'"
      :item-name="userToDemoteMod ? getUserDisplayName(userToDemoteMod) : ''"
      suffix="from moderator?"
      confirm-text="Demote"
      variant="destructive"
      @close="handleDemoteModDialogClose"
      @confirm="demoteModeratorConfirmed"
    />

    <!-- Credit Editing Modal -->
    <Modal
      :open="showCreditDialog"
      title="Add credits"
      :description="userToEditCredits ? getUserDisplayName(userToEditCredits) : ''"
      :icon="CreditCard"
      size="sm"
      :dismissible="updatingCreditsUserId === null"
      @close="handleCreditDialogClose"
    >
      <form class="flex flex-col gap-4" @submit.prevent="updateUserCredits">
        <StatGrid
          v-if="userToEditCredits?.credits"
          size="sm"
          :items="[
            { label: 'Remaining', value: `${formatCredits(userToEditCredits.credits.hours_remaining)} min` },
            { label: 'Used', value: `${formatCredits(userToEditCredits.credits.hours_used)} min` },
          ]"
        />

        <Field label="Minutes to add" for="hours_to_add">
          <Input
            id="hours_to_add"
            v-model.number="creditForm.hours_to_add"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Enter minutes to add"
          />
        </Field>

        <p
          v-if="creditForm.hours_to_add && creditForm.hours_to_add > 0 && userToEditCredits?.credits"
          class="text-xs text-fg-muted"
        >
          New balance:
          <span class="tabular font-medium text-success">
            {{
              formatCredits(
                (userToEditCredits.credits.hours_remaining === 'unlimited'
                  ? 0
                  : Number(userToEditCredits.credits.hours_remaining)) + creditForm.hours_to_add
              )
            }}
            min
          </span>
        </p>

        <Alert v-if="creditError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ creditError }}</AlertDescription>
        </Alert>
      </form>

      <template #footer>
        <Button variant="ghost" :disabled="updatingCreditsUserId !== null" @click="handleCreditDialogClose">Cancel</Button>
        <Button
          variant="primary"
          :loading="updatingCreditsUserId !== null"
          :disabled="updatingCreditsUserId !== null || !creditForm.hours_to_add"
          @click="updateUserCredits"
        >
          {{ updatingCreditsUserId !== null ? 'Adding…' : 'Add credits' }}
        </Button>
      </template>
    </Modal>

    <!-- Subscription Management Modal -->
    <Modal
      :open="showSubscriptionDialog"
      title="Subscription"
      :description="userToEditSubscription ? getUserDisplayName(userToEditSubscription) : ''"
      :icon="Layers"
      size="lg"
      :dismissible="updatingSubscriptionUserId === null"
      body-class="flex flex-col gap-5"
      @close="handleSubscriptionDialogClose"
    >
      <!-- Current subscription -->
      <StatGrid v-if="userToEditSubscription?.subscription" size="sm">
        <StatCard label="Tier" :value="userToEditSubscription.subscription.tier_name || 'None'" class="capitalize" />
        <StatCard label="Status" value="">
          <template #value>
            <Badge :variant="statusVariant(userToEditSubscription.subscription.status)">
              {{ formatStatus(userToEditSubscription.subscription.status) }}
            </Badge>
          </template>
        </StatCard>
        <StatCard
          v-if="userToEditSubscription.subscription.end_date"
          label="Ends"
          :value="formatExpiredDate(userToEditSubscription.subscription.end_date)"
          :title="formatDate(userToEditSubscription.subscription.end_date)"
        />
        <StatCard label="Days remaining" :value="userToEditSubscription.subscription.days_remaining" />
      </StatGrid>

      <!-- Grant subscription (also for expired — lets admin start a fresh period) -->
      <section
        v-if="!userToEditSubscription?.subscription?.tier_name || userToEditSubscription?.subscription?.status === 'expired'"
        class="flex flex-col gap-2.5"
      >
        <SectionHeader
          :title="userToEditSubscription?.subscription?.status === 'expired' ? 'Grant new subscription' : 'Grant subscription'"
        />
        <div class="grid grid-cols-[minmax(0,1fr)_120px_auto] items-end gap-3">
          <Field label="Tier">
            <CustomDropdown v-model="subscriptionForm.grant_tier" :options="tierOptions" placeholder="Select tier" />
          </Field>
          <Field label="Duration (days)">
            <Input v-model.number="subscriptionForm.grant_days" type="number" min="1" placeholder="30" />
          </Field>
          <div class="flex h-[var(--control-md)] items-center gap-3">
            <label class="flex items-center gap-2 text-xs text-fg-muted">
              <Checkbox v-model="subscriptionForm.grant_credits" />
              Grant credits
            </label>
            <Button
              variant="secondary"
              :loading="updatingSubscriptionUserId !== null"
              :disabled="updatingSubscriptionUserId !== null"
              @click="grantSubscription"
            >
              Grant
            </Button>
          </div>
        </div>
      </section>

      <!-- Extend subscription -->
      <section v-if="userToEditSubscription?.subscription?.tier_name" class="flex flex-col gap-2.5">
        <SectionHeader title="Extend subscription" />
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <Field label="Additional days">
            <Input v-model.number="subscriptionForm.extend_days" type="number" min="1" placeholder="30" />
          </Field>
          <div class="flex h-[var(--control-md)] items-center gap-3">
            <label class="flex items-center gap-2 text-xs text-fg-muted">
              <Checkbox v-model="subscriptionForm.extend_credits" />
              Grant credits
            </label>
            <Button
              variant="secondary"
              :loading="updatingSubscriptionUserId !== null"
              :disabled="updatingSubscriptionUserId !== null"
              @click="extendSubscription"
            >
              Extend
            </Button>
          </div>
        </div>
      </section>

      <!-- Change tier -->
      <section v-if="userToEditSubscription?.subscription?.tier_name" class="flex flex-col gap-2.5">
        <SectionHeader title="Change tier" />
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <Field label="New tier">
            <CustomDropdown v-model="subscriptionForm.change_tier" :options="tierOptions" placeholder="Select tier" />
          </Field>
          <div class="flex h-[var(--control-md)] items-center gap-3">
            <label class="flex items-center gap-2 text-xs text-fg-muted">
              <Checkbox v-model="subscriptionForm.change_credits" />
              Grant credits
            </label>
            <Button
              variant="secondary"
              :loading="updatingSubscriptionUserId !== null"
              :disabled="updatingSubscriptionUserId !== null"
              @click="changeSubscriptionTier"
            >
              Change
            </Button>
          </div>
        </div>
      </section>

      <!-- Cancel subscription -->
      <section
        v-if="userToEditSubscription?.subscription?.tier_name && userToEditSubscription?.subscription?.status !== 'expired'"
        class="flex items-center justify-between gap-4 border-t border-line-subtle pt-4"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-fg">Cancel subscription</p>
          <p class="text-xs text-fg-muted">
            Stops future renewals. The user keeps access until the current end date.
          </p>
        </div>
        <Button
          variant="destructive-soft"
          size="sm"
          :disabled="updatingSubscriptionUserId !== null"
          @click="confirmCancelSubscription"
        >
          Cancel subscription
        </Button>
      </section>

      <!-- Subscription history -->
      <section v-if="subscriptionHistory.length > 0" class="flex flex-col gap-2.5">
        <SectionHeader title="History" :count="subscriptionHistory.length" />
        <DataTable :columns="historyColumns" :rows="subscriptionHistory" row-key="id">
          <template #cell-tier="{ row: sub }">
            <span class="truncate font-medium capitalize">{{ sub.tier }}</span>
          </template>
          <template #cell-status="{ row: sub }">
            <Badge :variant="statusVariant(sub.status)">{{ formatStatus(sub.status) }}</Badge>
          </template>
          <template #cell-start_date="{ row: sub }">
            <span class="truncate text-xs text-fg-muted">{{ formatExpiredDate(sub.start_date) }}</span>
          </template>
          <template #cell-end_date="{ row: sub }">
            <span class="truncate text-xs text-fg-muted">{{ formatExpiredDate(sub.end_date) }}</span>
          </template>
          <template #cell-credits_granted="{ row: sub }">
            <span class="tabular">{{ sub.credits_granted || 0 }}</span>
          </template>
        </DataTable>
      </section>

      <Alert v-if="subscriptionError" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ subscriptionError }}</AlertDescription>
      </Alert>
    </Modal>

    <!-- Subscription Cancel Confirmation Modal -->
    <ConfirmationModal
      :show="showCancelSubscriptionDialog"
      title="Cancel subscription"
      :message="'Are you sure you want to cancel subscription for'"
      :item-name="userToEditSubscription ? getUserDisplayName(userToEditSubscription) : ''"
      suffix="?"
      confirm-text="Cancel subscription"
      variant="destructive"
      @close="handleCancelSubscriptionDialogClose"
      @confirm="cancelSubscriptionConfirmed"
    />

    <!-- Delete User Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteUserDialog"
      title="Delete user account"
      :message="'Are you sure you want to permanently delete the account for'"
      :item-name="userToDelete ? getUserDisplayName(userToDelete) : ''"
      suffix="?"
      confirm-text="Delete account"
      variant="destructive"
      @close="handleDeleteUserDialogClose"
      @confirm="deleteUserConfirmed"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { formatDate as formatDateOnly, formatDateTime } from '@/utils/dateTimeUtils';
  import { downloadRecordsCsv } from '@/utils/downloadRecordsCsv';
  import {
    Users,
    RefreshCw,
    AlertTriangle,
    AlertCircle,
    Copy,
    Shield,
    ShieldCheck,
    ShieldOff,
    User,
    CreditCard,
    Layers,
    Handshake,
    Building2,
    Trash2,
    Download,
    Mail,
    Wallet,
    Globe,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import api from '@/services/api';

  interface UserType {
    id: number;
    wallet_address: string | null;
    email: string | null;
    provider: string;
    is_admin: boolean;
    is_moderator: boolean;
    is_affiliate: boolean;
    affiliate_status: string | null;
    created_by_organization_id: number | null;
    created_at: string;
    updated_at: string;
    credits: {
      hours_remaining: number | 'unlimited';
      hours_used: number;
    };
    subscription: {
      status: string;
      tier: string | null;
      tier_name: string | null;
      start_date: string | null;
      end_date: string | null;
      days_remaining: number;
      organization_id?: number | null;
    };
  }

  type UserSubscription = UserType['subscription'];

  const authStore = useAuthStore();
  const { error: showErrorToast } = useToast();

  const tierOptions = [
    { label: 'Starter (600 credits)', value: 'starter' },
    { label: 'Creator (1800 credits)', value: 'creator' },
    { label: 'Pro (9000 credits)', value: 'pro' },
  ];

  const users = ref<UserType[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Search and sort state
  type SortColumn = 'id' | 'account' | 'role' | 'subscription';
  const searchQuery = ref('');
  const sortColumn = ref<SortColumn>('id');
  const sortDirection = ref<'asc' | 'desc'>('asc');
  const promotingUserId = ref<number | null>(null);
  const showPromoteDialog = ref(false);
  const userToPromote = ref<UserType | null>(null);
  const promotingModUserId = ref<number | null>(null);
  const demotingModUserId = ref<number | null>(null);
  const showPromoteModDialog = ref(false);
  const showDemoteModDialog = ref(false);
  const userToPromoteMod = ref<UserType | null>(null);
  const userToDemoteMod = ref<UserType | null>(null);
  const showCreditDialog = ref(false);
  const userToEditCredits = ref<UserType | null>(null);
  const updatingCreditsUserId = ref<number | null>(null);
  const creditForm = ref({ hours_to_add: 0 });
  const creditError = ref<string | null>(null);

  // Subscription state
  const showSubscriptionDialog = ref(false);
  const userToEditSubscription = ref<UserType | null>(null);
  const updatingSubscriptionUserId = ref<number | null>(null);
  const subscriptionForm = ref({
    grant_tier: 'starter',
    grant_days: 30,
    grant_credits: false,
    extend_days: 30,
    extend_credits: false,
    change_tier: 'starter',
    change_credits: false,
  });
  const subscriptionError = ref<string | null>(null);
  const subscriptionHistory = ref<any[]>([]);
  const showCancelSubscriptionDialog = ref(false);

  // Delete user state
  const showDeleteUserDialog = ref(false);
  const userToDelete = ref<UserType | null>(null);
  const deletingUserId = ref<number | null>(null);

  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true, width: '64px', hideBelow: 'md' },
    { key: 'account', label: 'Account', sortable: true },
    { key: 'role', label: 'Role', sortable: true, width: '160px', hideBelow: 'md' },
    { key: 'subscription', label: 'Subscription', sortable: true, width: '156px' },
    { key: 'credits', label: 'Credits', width: '96px', hideBelow: 'md' },
  ];

  const historyColumns: DataTableColumn[] = [
    { key: 'tier', label: 'Tier' },
    { key: 'status', label: 'Status', width: '96px' },
    { key: 'start_date', label: 'Start', width: '110px' },
    { key: 'end_date', label: 'End', width: '110px' },
    { key: 'credits_granted', label: 'Credits', width: '92px', align: 'right' },
  ];

  /** True while any per-user action for this row is in flight. */
  const isUserBusy = (userId: number) =>
    [
      promotingUserId.value,
      promotingModUserId.value,
      demotingModUserId.value,
      updatingCreditsUserId.value,
      updatingSubscriptionUserId.value,
      deletingUserId.value,
    ].includes(userId);

  const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : 'https://api.clippster.app');

  // Filtered and sorted users
  const filteredAndSortedUsers = computed(() => {
    let result = [...users.value];

    // Apply search filter
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      result = result.filter(user => {
        const email = user.email?.toLowerCase() || '';
        const wallet = user.wallet_address?.toLowerCase() || '';
        return email.includes(query) || wallet.includes(query);
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn.value) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'account':
          aValue = (a.email || a.wallet_address || '').toLowerCase();
          bValue = (b.email || b.wallet_address || '').toLowerCase();
          break;
        case 'role':
          // Admin > Moderator > User
          aValue = a.is_admin ? 3 : a.is_moderator ? 2 : 1;
          bValue = b.is_admin ? 3 : b.is_moderator ? 2 : 1;
          break;
        case 'subscription':
          aValue = a.subscription?.tier_name || '';
          bValue = b.subscription?.tier_name || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection.value === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection.value === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  const toggleSort = (column: 'id' | 'account' | 'role' | 'subscription') => {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn.value = column;
      sortDirection.value = 'asc';
    }
  };

  const fetchUsers = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/admin/users');
      if (response.data.success) {
        users.value = response.data.users;
      } else {
        throw new Error('Failed to load users data');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading.value = false;
    }
  };

  const formatWalletAddress = (address: string | null | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return Globe;
      case 'email':
        return Mail;
      case 'wallet':
        return Wallet;
      default:
        return User;
    }
  };

  const formatProvider = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'email':
        return 'Email';
      case 'wallet':
        return 'Wallet';
      default:
        return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
    }
  };

  const getUserDisplayName = (user: UserType) => {
    if (user.email && (!user.wallet_address || user.provider !== 'wallet')) {
      return user.email;
    }
    return formatWalletAddress(user.wallet_address);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  const formatExpiredDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateOnly(dateString) || 'N/A';
    } catch {
      return 'Invalid date';
    }
  };

  const isExpiredSubscription = (subscription: UserSubscription | null | undefined) => {
    return subscription?.status === 'expired';
  };

  const formatCredits = (credits: number | 'unlimited') => {
    if (credits === 'unlimited') return '∞';
    if (!credits || credits === 0) return '0';
    return Math.round(credits).toString();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const exportUsersCsv = async () => {
    if (!users.value.length) {
      showErrorToast('Export failed', 'No users to export');
      return;
    }
    try {
      await downloadRecordsCsv(users.value, 'users.csv');
    } catch (err) {
      console.error('Failed to export users:', err);
      showErrorToast('Export failed', err instanceof Error ? err.message : 'Failed to export users CSV');
    }
  };

  /** Text color for the compact status line in the subscription column. */
  const subscriptionStatusText = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'text-success';
      case 'cancelled':
        return 'text-danger';
      case 'expired':
        return 'text-warning';
      default:
        return 'text-fg-subtle';
    }
  };

  // Promotion functions
  const confirmPromoteUser = (user: UserType) => {
    userToPromote.value = user;
    showPromoteDialog.value = true;
  };

  const handlePromoteDialogClose = () => {
    showPromoteDialog.value = false;
    userToPromote.value = null;
  };

  const promoteUserConfirmed = async () => {
    if (!userToPromote.value) return;
    promotingUserId.value = userToPromote.value.id;
    try {
      const response = await api.post(`/admin/users/${userToPromote.value.id}/promote`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToPromote.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_admin: true,
            updated_at: response.data.user.updated_at,
          };
        }
      } else {
        throw new Error(response.data.error || 'Failed to promote user');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      promotingUserId.value = null;
      showPromoteDialog.value = false;
      userToPromote.value = null;
    }
  };

  // Moderator promotion functions
  const confirmPromoteToModerator = (user: UserType) => {
    userToPromoteMod.value = user;
    showPromoteModDialog.value = true;
  };

  const handlePromoteModDialogClose = () => {
    showPromoteModDialog.value = false;
    userToPromoteMod.value = null;
  };

  const promoteToModeratorConfirmed = async () => {
    if (!userToPromoteMod.value) return;
    promotingModUserId.value = userToPromoteMod.value.id;
    try {
      const response = await api.post(`/admin/users/${userToPromoteMod.value.id}/moderator`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToPromoteMod.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_moderator: true,
            updated_at: response.data.user.updated_at,
          };
        }
      } else {
        throw new Error(response.data.error || 'Failed to promote user to moderator');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to promote user to moderator';
      error.value = errorMessage;
      console.error('Error promoting user to moderator:', err);
    } finally {
      promotingModUserId.value = null;
      showPromoteModDialog.value = false;
      userToPromoteMod.value = null;
    }
  };

  // Moderator demotion functions
  const confirmDemoteModerator = (user: UserType) => {
    userToDemoteMod.value = user;
    showDemoteModDialog.value = true;
  };

  const handleDemoteModDialogClose = () => {
    showDemoteModDialog.value = false;
    userToDemoteMod.value = null;
  };

  const demoteModeratorConfirmed = async () => {
    if (!userToDemoteMod.value) return;
    demotingModUserId.value = userToDemoteMod.value.id;
    try {
      const response = await api.delete(`/admin/users/${userToDemoteMod.value.id}/moderator`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToDemoteMod.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_moderator: false,
            updated_at: response.data.user.updated_at,
          };
        }
      } else {
        throw new Error(response.data.error || 'Failed to demote moderator');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      demotingModUserId.value = null;
      showDemoteModDialog.value = false;
      userToDemoteMod.value = null;
    }
  };

  // Credit functions
  const openCreditDialog = (user: UserType) => {
    userToEditCredits.value = user;
    creditForm.value = { hours_to_add: 0 };
    creditError.value = null;
    showCreditDialog.value = true;
  };

  const handleCreditDialogClose = () => {
    showCreditDialog.value = false;
    userToEditCredits.value = null;
    creditForm.value = { hours_to_add: 0 };
    creditError.value = null;
  };

  const updateUserCredits = async () => {
    if (!userToEditCredits.value) return;
    updatingCreditsUserId.value = userToEditCredits.value.id;
    creditError.value = null;
    try {
      const response = await fetch(`${API_BASE}/admin/users/${userToEditCredits.value.id}/credits`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hours_to_add: creditForm.value.hours_to_add }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update credits: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditCredits.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            credits: data.credits,
            updated_at: data.updated_at,
          };
        }
        handleCreditDialogClose();
      } else {
        throw new Error(data.error || 'Failed to update credits');
      }
    } catch (err) {
      creditError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingCreditsUserId.value = null;
    }
  };

  // Subscription functions
  const openSubscriptionDialog = async (user: UserType) => {
    userToEditSubscription.value = user;
    subscriptionForm.value = {
      grant_tier: 'starter',
      grant_days: 30,
      grant_credits: false,
      extend_days: 30,
      extend_credits: false,
      change_tier: 'starter',
      change_credits: false,
    };
    subscriptionError.value = null;
    subscriptionHistory.value = [];
    if (user.subscription?.tier_name) {
      await fetchSubscriptionHistory(user.id);
    }
    showSubscriptionDialog.value = true;
  };

  const handleSubscriptionDialogClose = () => {
    showSubscriptionDialog.value = false;
    userToEditSubscription.value = null;
    subscriptionError.value = null;
    subscriptionHistory.value = [];
  };

  const fetchSubscriptionHistory = async (userId: number) => {
    try {
      const response = await api.get(`/admin/users/${userId}/subscription/history`);
      if (response.data.success) {
        subscriptionHistory.value = response.data.subscriptions;
      }
    } catch (err) {
      console.error('Error fetching subscription history:', err);
    }
  };

  const grantSubscription = async () => {
    if (!userToEditSubscription.value) return;
    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;
    try {
      const response = await api.post(`/admin/users/${userToEditSubscription.value.id}/subscription`, {
        tier: subscriptionForm.value.grant_tier,
        days: subscriptionForm.value.grant_days,
        grant_credits: subscriptionForm.value.grant_credits,
      });
      if (response.data.success) {
        // Update the user in the list with the new subscription data
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
        }
        // Update the dialog user reference
        if (userToEditSubscription.value) {
          userToEditSubscription.value = { ...userToEditSubscription.value, subscription: response.data.subscription };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
        // Refresh the entire user list to ensure consistency
        await fetchUsers();
      } else {
        throw new Error(response.data.error || 'Failed to grant subscription');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to grant subscription';
      subscriptionError.value = errorMessage;
      console.error('Error granting subscription:', err);
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const extendSubscription = async () => {
    if (!userToEditSubscription.value) return;
    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;
    try {
      const response = await api.put(`/admin/users/${userToEditSubscription.value.id}/subscription/extend`, {
        days: subscriptionForm.value.extend_days,
        grant_credits: subscriptionForm.value.extend_credits,
      });
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
        }
        if (userToEditSubscription.value) {
          userToEditSubscription.value = { ...userToEditSubscription.value, subscription: response.data.subscription };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
        await fetchUsers();
      } else {
        throw new Error(response.data.error || 'Failed to extend subscription');
      }
    } catch (err: any) {
      subscriptionError.value = err?.response?.data?.error || err?.message || 'Failed to extend subscription';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const changeSubscriptionTier = async () => {
    if (!userToEditSubscription.value) return;
    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;
    try {
      const response = await api.put(`/admin/users/${userToEditSubscription.value.id}/subscription/tier`, {
        tier: subscriptionForm.value.change_tier,
        grant_credits: subscriptionForm.value.change_credits,
      });
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
        }
        if (userToEditSubscription.value) {
          userToEditSubscription.value = { ...userToEditSubscription.value, subscription: response.data.subscription };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
        await fetchUsers();
      } else {
        throw new Error(response.data.error || 'Failed to change tier');
      }
    } catch (err: any) {
      subscriptionError.value = err?.response?.data?.error || err?.message || 'Failed to change tier';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const confirmCancelSubscription = () => {
    showCancelSubscriptionDialog.value = true;
  };

  const handleCancelSubscriptionDialogClose = () => {
    showCancelSubscriptionDialog.value = false;
  };

  const cancelSubscriptionConfirmed = async () => {
    if (!userToEditSubscription.value) return;
    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;
    try {
      const response = await api.post(`/admin/users/${userToEditSubscription.value.id}/subscription/cancel`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
        handleCancelSubscriptionDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      subscriptionError.value = err instanceof Error ? err.message : 'Failed to cancel subscription';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const router = useRouter();

  const navigateToUserProfile = (userId: number) => {
    router.push(`/admin/users/${userId}`);
  };

  // Delete user functions
  const confirmDeleteUser = (user: UserType) => {
    userToDelete.value = user;
    showDeleteUserDialog.value = true;
  };

  const handleDeleteUserDialogClose = () => {
    showDeleteUserDialog.value = false;
    userToDelete.value = null;
  };

  const deleteUserConfirmed = async () => {
    if (!userToDelete.value) return;
    deletingUserId.value = userToDelete.value.id;
    try {
      const response = await api.delete(`/admin/users/${userToDelete.value.id}`);
      if (response.data.success) {
        // Remove user from the list
        users.value = users.value.filter((u) => u.id !== userToDelete.value!.id);
        handleDeleteUserDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to delete user';
      error.value = errorMessage;
      console.error('Error deleting user:', err);
    } finally {
      deletingUserId.value = null;
      showDeleteUserDialog.value = false;
      userToDelete.value = null;
    }
  };

  onMounted(() => {
    fetchUsers();
  });
</script>
