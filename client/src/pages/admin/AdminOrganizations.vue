<template>
  <PageLayout
    title="Organizations"
    description="Manage organizations and their credits"
    :icon="Building2"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Organizations' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh organizations" :disabled="loading" @click="fetchOrganizations">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
      <Button variant="primary" size="sm" @click="showCreateOrgDialog = true">
        <Plus />
        Create org account
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar
        v-model:search="searchQuery"
        placeholder="Search organizations…"
        :count="filteredOrganizations.length"
        count-label="organization"
      />
    </template>

    <div class="px-5 py-4">
      <DataTable
        :columns="columns"
        :rows="filteredOrganizations"
        row-key="id"
        :loading="loading"
        clickable
        :empty-icon="Building2"
        :empty-title="searchQuery ? 'No organizations match your search' : 'No organizations found'"
        @row-click="(org) => navigateToOrgDetail(org.id)"
      >
        <template #cell-id="{ row: org }">
          <span class="tabular text-xs text-fg-subtle">#{{ org.id }}</span>
        </template>

        <template #cell-name="{ row: org }">
          <div class="flex min-w-0 items-center gap-2.5">
            <Avatar :name="org.name" :icon="Building2" shape="square" size="sm" />
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-1.5">
                <span class="truncate font-medium text-fg">{{ org.name }}</span>
                <Badge v-if="org.created_by_admin" variant="outline" title="Created by an admin">Admin</Badge>
              </div>
              <p v-if="org.description" class="truncate text-xs text-fg-subtle">{{ org.description }}</p>
            </div>
          </div>
        </template>

        <template #cell-subscription="{ row: org }">
          <div class="flex min-w-0 items-center gap-1.5">
            <Badge :variant="statusVariant(org.subscription_status)">{{ formatStatus(org.subscription_status) }}</Badge>
            <span v-if="isExpiredSubscription(org) && org.subscription_end_date" class="tabular truncate text-xs text-fg-subtle">
              {{ formatExpiredDate(org.subscription_end_date) }}
            </span>
          </div>
          <p v-if="org.subscription_tier || org.admin_price_cents != null" class="mt-0.5 truncate text-xs text-fg-muted">
            <span v-if="org.subscription_tier">{{ formatTier(org.subscription_tier) }}</span>
            <span v-if="org.subscription_tier && org.admin_price_cents != null" class="text-fg-subtle"> · </span>
            <span v-if="org.admin_price_cents != null" class="tabular">${{ (org.admin_price_cents / 100).toFixed(2) }}/mo</span>
          </p>
        </template>

        <template #cell-seats="{ row: org }">
          <span class="tabular text-fg">{{ org.member_count }}</span>
          <span v-if="org.max_seats" class="tabular text-fg-subtle"> / {{ org.max_seats }}</span>
        </template>

        <template #cell-credits="{ row: org }">
          <p class="tabular text-fg">
            {{ formatCredits(org.credits.hours_remaining) }}
            <span class="text-xs text-fg-subtle">min</span>
          </p>
          <p v-if="org.monthly_credits" class="tabular text-xs text-fg-subtle">{{ org.monthly_credits }}/mo</p>
        </template>

        <template #cell-created="{ row: org }">
          <span class="tabular block truncate text-fg">{{ formatExpiredDate(org.created_at) }}</span>
          <span class="tabular block truncate text-xs text-fg-subtle">{{ formatClock(org.created_at) }}</span>
        </template>

        <template #actions="{ row: org }">
          <AdminRowActions :label="`Actions for ${org.name}`">
            <AdminActionItem :icon="ArrowUpRight" @select="navigateToOrgDetail(org.id)">View details</AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="CreditCard" @select="openOrgCreditDialog(org)">Set credits</AdminActionItem>
            <AdminActionItem :icon="Crown" @select="openGrantSubDialog(org)">Grant subscription</AdminActionItem>
            <AdminActionItem v-if="org.subscription_status === 'active'" :icon="Settings" @select="openEditSubDialog(org)">
              Edit subscription
            </AdminActionItem>
            <AdminActionItem :icon="KeyRound" @select="openResetPwDialog(org)">Reset owner password</AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem v-if="org.subscription_status === 'active'" :icon="XCircle" destructive @select="cancelOrgSub(org)">
              Cancel subscription
            </AdminActionItem>
            <AdminActionItem v-else :icon="Trash2" destructive @select="openDeleteOrgDialog(org)">
              Delete organization
            </AdminActionItem>
          </AdminRowActions>
        </template>
      </DataTable>
    </div>

    <!-- Create org account -->
    <Modal
      v-model:open="showCreateOrgDialog"
      title="Create organization account"
      description="Admin-managed org with custom billing"
      :icon="Building2"
      size="md"
      :dismissible="!creatingOrg"
    >
      <form class="flex flex-col gap-4" @submit.prevent="createOrgAccount">
        <Field label="Organization name" for="create-org-name" required>
          <Input id="create-org-name" v-model="createOrgForm.org_name" required placeholder="Acme Corp" />
        </Field>

        <Field label="Owner account">
          <SegmentedControl :model-value="createOrgMode" :options="ownerModeOptions" block @update:model-value="setCreateOrgMode" />
        </Field>

        <div :key="createOrgMode" class="animate-enter">
          <template v-if="createOrgMode === 'new'">
            <div class="grid grid-cols-2 gap-3">
              <Field label="Owner email" for="create-org-email" required>
                <Input id="create-org-email" v-model="createOrgForm.email" type="email" placeholder="owner@example.com" />
              </Field>
              <Field label="Owner password" for="create-org-password" required>
                <Input id="create-org-password" v-model="createOrgForm.password" type="text" placeholder="Temporary password" />
              </Field>
            </div>
          </template>

          <Field v-else label="Search by email" required>
            <!-- Selected user -->
            <div
              v-if="selectedExistingUser"
              class="flex min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] border border-brand-line bg-brand-soft px-2.5 py-1.5"
            >
              <Avatar :name="selectedExistingUser.name || selectedExistingUser.email" size="xs" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-fg">{{ selectedExistingUser.name || selectedExistingUser.email }}</p>
                <p v-if="selectedExistingUser.name" class="truncate text-xs text-fg-muted">{{ selectedExistingUser.email }}</p>
              </div>
              <Button variant="ghost" size="icon-xs" title="Clear selection" @click="clearExistingUser">
                <X />
              </Button>
            </div>

            <template v-else>
              <SearchField
                v-model="existingUserSearch"
                placeholder="Type at least 3 characters…"
                :loading="searchingUsers"
                @update:model-value="onExistingUserInput"
              />
              <div
                v-if="existingUserResults.length > 0"
                class="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-control)] border border-line bg-surface p-1"
              >
                <button
                  v-for="u in existingUserResults"
                  :key="u.id"
                  type="button"
                  class="flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="u.owned_organization_id != null"
                  @click="selectExistingUser(u)"
                >
                  <Avatar :name="u.name || u.email" :src="u.avatar_url" size="xs" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm text-fg">{{ u.email }}</span>
                    <span class="block truncate text-xs text-fg-subtle">{{ u.name || 'No name' }}</span>
                  </span>
                  <Badge v-if="u.owned_organization_id" variant="neutral">Has org</Badge>
                </button>
              </div>
              <p
                v-else-if="existingUserSearch.length >= 3 && !searchingUsers"
                class="text-xs text-fg-subtle"
              >
                No users found
              </p>
            </template>
          </Field>
        </div>

        <Field label="Tier">
          <CustomDropdown v-model="createOrgForm.tier" :options="createTierOptions" placeholder="Select tier" />
        </Field>

        <div class="grid grid-cols-3 gap-3">
          <Field label="Max seats" for="create-org-seats" hint="0 = unlimited">
            <Input id="create-org-seats" v-model.number="createOrgForm.max_seats" type="number" min="0" placeholder="0" />
          </Field>
          <Field label="AI credits/mo" for="create-org-credits">
            <Input id="create-org-credits" v-model.number="createOrgForm.monthly_credits" type="number" min="0" placeholder="0" />
          </Field>
          <Field label="Price ($/month)" for="create-org-price">
            <Input
              id="create-org-price"
              v-model.number="createOrgForm.price_dollars"
              type="number"
              step="0.01"
              min="0"
              placeholder="0 = free"
            />
          </Field>
        </div>

        <Alert v-if="createOrgError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ createOrgError }}</AlertDescription>
        </Alert>
      </form>

      <template #footer>
        <Button variant="ghost" :disabled="creatingOrg" @click="showCreateOrgDialog = false">Cancel</Button>
        <Button variant="primary" :loading="creatingOrg" :disabled="creatingOrg" @click="createOrgAccount">
          {{ creatingOrg ? 'Creating…' : 'Create account' }}
        </Button>
      </template>
    </Modal>

    <!-- Grant subscription -->
    <Modal
      v-model:open="showGrantSubDialog"
      title="Grant subscription"
      :description="grantSubOrg?.name"
      :icon="Crown"
      size="sm"
      :dismissible="grantingSubId === null"
    >
      <form class="flex flex-col gap-4" @submit.prevent="grantSubscription">
        <Field label="Tier">
          <CustomDropdown v-model="grantSubForm.tier" :options="availableTiers" placeholder="Select tier" />
        </Field>
        <Field label="Days" for="grant-sub-days">
          <Input id="grant-sub-days" v-model.number="grantSubForm.days" type="number" min="1" />
        </Field>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <Checkbox v-model="grantSubForm.grant_credits" />
          Grant AI credits
        </label>
        <Alert v-if="grantSubError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ grantSubError }}</AlertDescription>
        </Alert>
      </form>
      <template #footer>
        <Button variant="ghost" :disabled="grantingSubId !== null" @click="showGrantSubDialog = false">Cancel</Button>
        <Button variant="primary" :loading="grantingSubId !== null" :disabled="grantingSubId !== null" @click="grantSubscription">
          {{ grantingSubId !== null ? 'Granting…' : 'Grant subscription' }}
        </Button>
      </template>
    </Modal>

    <!-- Edit subscription -->
    <Modal
      v-model:open="showEditSubDialog"
      title="Edit subscription"
      :description="editSubOrg?.name"
      :icon="Settings"
      size="sm"
      :dismissible="editingSubId === null"
    >
      <form class="flex flex-col gap-4" @submit.prevent="updateOrgSub">
        <Field label="Tier">
          <CustomDropdown v-model="editSubForm.tier" :options="availableTiers" placeholder="Select tier" />
        </Field>
        <div class="grid grid-cols-2 gap-3">
          <Field label="Max seats" for="edit-sub-seats" hint="0 = unlimited">
            <Input id="edit-sub-seats" v-model.number="editSubForm.max_seats" type="number" min="0" placeholder="0" />
          </Field>
          <Field label="AI credits/mo" for="edit-sub-credits">
            <Input id="edit-sub-credits" v-model.number="editSubForm.monthly_credits" type="number" min="0" />
          </Field>
        </div>
        <Field label="Price ($/month)" for="edit-sub-price">
          <Input id="edit-sub-price" v-model.number="editSubForm.price_dollars" type="number" step="0.01" min="0" />
        </Field>
        <Alert v-if="editSubError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ editSubError }}</AlertDescription>
        </Alert>
      </form>
      <template #footer>
        <Button variant="ghost" :disabled="editingSubId !== null" @click="showEditSubDialog = false">Cancel</Button>
        <Button variant="primary" :loading="editingSubId !== null" :disabled="editingSubId !== null" @click="updateOrgSub">
          {{ editingSubId !== null ? 'Saving…' : 'Save changes' }}
        </Button>
      </template>
    </Modal>

    <!-- Reset owner password -->
    <Modal
      :open="showResetPwDialog"
      title="Reset owner password"
      :description="resetPwOrg?.name"
      :icon="KeyRound"
      size="sm"
      :dismissible="!resettingPw"
      @close="closeResetPwDialog"
    >
      <form class="flex flex-col gap-4" @submit.prevent="submitResetPw">
        <Field label="New password" for="reset-owner-pw" required>
          <Input id="reset-owner-pw" v-model="resetPwForm.new_password" type="text" required placeholder="Enter new password" />
        </Field>
        <Alert v-if="resetPwError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ resetPwError }}</AlertDescription>
        </Alert>
        <Alert v-if="resetPwSuccess" variant="success">
          <Check />
          <AlertDescription>{{ resetPwSuccess }}</AlertDescription>
        </Alert>
      </form>
      <template #footer>
        <Button variant="ghost" :disabled="resettingPw" @click="closeResetPwDialog">Cancel</Button>
        <Button variant="primary" :loading="resettingPw" :disabled="resettingPw" @click="submitResetPw">
          {{ resettingPw ? 'Resetting…' : 'Reset password' }}
        </Button>
      </template>
    </Modal>

    <!-- Delete organization -->
    <Modal
      :open="showDeleteOrgDialog"
      title="Delete organization"
      :description="deleteOrgTarget?.name"
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!deletingOrg"
      body-class="flex flex-col gap-4"
      @close="closeDeleteOrgDialog"
    >
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>This action cannot be undone. All organization data will be permanently deleted.</AlertDescription>
      </Alert>
      <Field for="delete-org-confirm">
        <template #label>
          Type <span class="font-semibold text-fg">{{ deleteOrgTarget?.name }}</span> to confirm
        </template>
        <Input id="delete-org-confirm" v-model="deleteOrgConfirmName" placeholder="Organization name" />
      </Field>
      <Alert v-if="deleteOrgError" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ deleteOrgError }}</AlertDescription>
      </Alert>
      <template #footer>
        <Button variant="ghost" :disabled="deletingOrg" @click="closeDeleteOrgDialog">Cancel</Button>
        <Button
          variant="destructive"
          :loading="deletingOrg"
          :disabled="deletingOrg || deleteOrgConfirmName !== deleteOrgTarget?.name"
          @click="submitDeleteOrg"
        >
          {{ deletingOrg ? 'Deleting…' : 'Delete organization' }}
        </Button>
      </template>
    </Modal>

    <!-- Cancel subscription -->
    <Modal
      :open="showCancelSubDialog"
      title="Cancel subscription"
      :description="cancelSubOrg?.name"
      :icon="XCircle"
      tone="danger"
      size="sm"
      :dismissible="cancellingSubId === null"
      body-class="flex flex-col gap-4"
      @close="closeCancelSubDialog"
    >
      <Alert variant="warning">
        <AlertCircle />
        <AlertDescription>
          This immediately cancels the organization's subscription. This action cannot be undone.
        </AlertDescription>
      </Alert>
      <Alert v-if="cancelSubError" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ cancelSubError }}</AlertDescription>
      </Alert>
      <template #footer>
        <Button variant="ghost" :disabled="cancellingSubId !== null" @click="closeCancelSubDialog">Keep subscription</Button>
        <Button
          variant="destructive"
          :loading="cancellingSubId !== null"
          :disabled="cancellingSubId !== null"
          @click="confirmCancelOrgSub"
        >
          {{ cancellingSubId !== null ? 'Cancelling…' : 'Cancel subscription' }}
        </Button>
      </template>
    </Modal>

    <!-- Organization credits -->
    <Modal
      :open="showOrgCreditDialog"
      title="Set organization credits"
      :description="orgToEditCredits?.name"
      :icon="CreditCard"
      size="sm"
      :dismissible="updatingOrgCreditsId === null"
      @close="handleOrgCreditDialogClose"
    >
      <form class="flex flex-col gap-4" @submit.prevent="updateOrgCredits">
        <StatGrid
          v-if="orgToEditCredits?.credits"
          size="sm"
          :items="[
            { label: 'Remaining', value: `${formatCredits(orgToEditCredits.credits.hours_remaining)} min` },
            { label: 'Used', value: `${formatCredits(orgToEditCredits.credits.hours_used)} min` },
          ]"
        />

        <div class="grid grid-cols-2 gap-3">
          <Field label="New remaining credits" for="hours_remaining">
            <Input
              id="hours_remaining"
              v-model.number="orgCreditForm.hours_remaining"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="Remaining"
            />
          </Field>
          <Field label="Credits used" for="hours_used">
            <Input
              id="hours_used"
              v-model.number="orgCreditForm.hours_used"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="Used"
            />
          </Field>
        </div>

        <Alert v-if="orgCreditError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ orgCreditError }}</AlertDescription>
        </Alert>
      </form>
      <template #footer>
        <Button variant="ghost" :disabled="updatingOrgCreditsId !== null" @click="handleOrgCreditDialogClose">Cancel</Button>
        <Button
          variant="primary"
          :loading="updatingOrgCreditsId !== null"
          :disabled="updatingOrgCreditsId !== null"
          @click="updateOrgCredits"
        >
          {{ updatingOrgCreditsId !== null ? 'Saving…' : 'Save credits' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { formatDate as formatDateOnly, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import {
    Building2,
    RefreshCw,
    CreditCard,
    X,
    AlertCircle,
    Plus,
    Crown,
    Settings,
    XCircle,
    KeyRound,
    Trash2,
    Check,
    ArrowUpRight,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { StatGrid } from '@/components/ui/stat-card';
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import api from '@/services/api';
  import { checkOrgNameAvailable } from '@/services/organizationsApi';

  interface Organization {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
    credits: {
      hours_remaining: number;
      hours_used: number;
    };
    subscription_status: string | null;
    subscription_tier: string | null;
    max_seats: number | null;
    monthly_credits: number | null;
    subscription_end_date: string | null;
    admin_price_cents: number | null;
    created_by_admin: boolean;
    setup_completed: boolean;
    created_at: string;
    owner_id: number | null;
  }

  const organizations = ref<Organization[]>([]);
  const loading = ref(false);
  const showOrgCreditDialog = ref(false);
  const orgToEditCredits = ref<Organization | null>(null);
  const updatingOrgCreditsId = ref<number | null>(null);
  const orgCreditForm = ref({ hours_remaining: 0, hours_used: 0 });
  const orgCreditError = ref<string | null>(null);

  // Create Org Account
  const showCreateOrgDialog = ref(false);
  const newOrgName = ref('');
  const newOrgDescription = ref('');
  const creatingOrg = ref(false);
  const createOrgError = ref<string | null>(null);

  const router = useRouter();

  const searchQuery = ref('');

  const filteredOrganizations = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return organizations.value;
    return organizations.value.filter(
      (org) =>
        org.name.toLowerCase().includes(query) ||
        (org.description || '').toLowerCase().includes(query) ||
        String(org.id) === query.replace(/^#/, '')
    );
  });

  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', width: '64px', hideBelow: 'md' },
    { key: 'name', label: 'Organization' },
    { key: 'subscription', label: 'Subscription', width: '190px' },
    { key: 'seats', label: 'Seats', width: '80px', align: 'right' },
    { key: 'credits', label: 'Credits', width: '100px', align: 'right', hideBelow: 'md' },
    { key: 'created', label: 'Created', width: '112px', hideBelow: 'md' },
  ];

  const navigateToOrgDetail = (orgId: number) => {
    router.push(`/admin/organizations/${orgId}`);
  };

  const createOrgForm = ref({
    org_name: '',
    email: '',
    password: '',
    tier: 'enterprise_base',
    max_seats: 5,
    monthly_credits: 0,
    price_dollars: 0,
  });

  // Existing user assignment state
  const createOrgMode = ref<'new' | 'existing'>('new');
  const existingUserSearch = ref('');
  const existingUserResults = ref<Array<{ id: number; email: string; name: string | null; avatar_url: string | null; owned_organization_id: number | null }>>([]);
  const selectedExistingUser = ref<{ id: number; email: string; name: string | null } | null>(null);
  const searchingUsers = ref(false);
  let userSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  const searchExistingUsers = async (query: string) => {
    if (query.length < 3) {
      existingUserResults.value = [];
      return;
    }
    searchingUsers.value = true;
    try {
      const response = await api.get('/admin/users/search', { params: { email: query } });
      if (response.data.success) {
        existingUserResults.value = response.data.users;
      }
    } catch {
      existingUserResults.value = [];
    } finally {
      searchingUsers.value = false;
    }
  };

  const onExistingUserInput = () => {
    selectedExistingUser.value = null;
    if (userSearchTimeout) clearTimeout(userSearchTimeout);
    userSearchTimeout = setTimeout(() => searchExistingUsers(existingUserSearch.value), 300);
  };

  const selectExistingUser = (user: { id: number; email: string; name: string | null; avatar_url: string | null; owned_organization_id: number | null }) => {
    selectedExistingUser.value = user;
    existingUserSearch.value = user.email;
    existingUserResults.value = [];
  };

  const ownerModeOptions: SegmentedOption<'new' | 'existing'>[] = [
    { value: 'new', label: 'Create new user' },
    { value: 'existing', label: 'Assign existing user' },
  ];

  const setCreateOrgMode = (mode: 'new' | 'existing') => {
    if (mode === createOrgMode.value) return;
    createOrgMode.value = mode;
    if (mode === 'new') {
      selectedExistingUser.value = null;
      existingUserSearch.value = '';
    } else {
      createOrgForm.value.email = '';
      createOrgForm.value.password = '';
    }
  };

  const clearExistingUser = () => {
    selectedExistingUser.value = null;
    existingUserSearch.value = '';
  };

  const resetCreateOrgDialog = () => {
    createOrgForm.value = { org_name: '', email: '', password: '', tier: 'enterprise_base', max_seats: 5, monthly_credits: 0, price_dollars: 0 };
    createOrgMode.value = 'new';
    existingUserSearch.value = '';
    existingUserResults.value = [];
    selectedExistingUser.value = null;
    createOrgError.value = null;
  };

  // Reset Owner Password
  const showResetPwDialog = ref(false);
  const resetPwOrg = ref<Organization | null>(null);
  const resettingPw = ref(false);
  const resetPwError = ref<string | null>(null);
  const resetPwSuccess = ref<string | null>(null);
  const resetPwForm = ref({ new_password: '' });

  const openResetPwDialog = (org: Organization) => {
    resetPwOrg.value = org;
    resetPwForm.value = { new_password: '' };
    resetPwError.value = null;
    resetPwSuccess.value = null;
    showResetPwDialog.value = true;
  };

  const closeResetPwDialog = () => {
    showResetPwDialog.value = false;
    resetPwOrg.value = null;
    resetPwForm.value = { new_password: '' };
    resetPwError.value = null;
    resetPwSuccess.value = null;
  };

  const submitResetPw = async () => {
    if (!resetPwOrg.value) return;
    if (!resetPwOrg.value.owner_id) {
      resetPwError.value = 'This organization has no owner on record.';
      return;
    }
    resettingPw.value = true;
    resetPwError.value = null;
    resetPwSuccess.value = null;
    try {
      const response = await api.post(`/admin/users/${resetPwOrg.value.owner_id}/reset-password`, {
        new_password: resetPwForm.value.new_password,
      });
      if (response.data.success) {
        resetPwSuccess.value = 'Password reset successfully.';
        resetPwForm.value = { new_password: '' };
      } else {
        throw new Error(response.data.error || 'Failed to reset password');
      }
    } catch (err) {
      resetPwError.value = err instanceof Error ? err.message : 'Failed to reset password';
    } finally {
      resettingPw.value = false;
    }
  };

  // Delete Organization
  const showDeleteOrgDialog = ref(false);
  const deleteOrgTarget = ref<Organization | null>(null);
  const deletingOrg = ref(false);
  const deleteOrgError = ref<string | null>(null);
  const deleteOrgConfirmName = ref('');

  const openDeleteOrgDialog = (org: Organization) => {
    deleteOrgTarget.value = org;
    deleteOrgConfirmName.value = '';
    deleteOrgError.value = null;
    showDeleteOrgDialog.value = true;
  };

  const closeDeleteOrgDialog = () => {
    showDeleteOrgDialog.value = false;
    deleteOrgTarget.value = null;
    deleteOrgConfirmName.value = '';
    deleteOrgError.value = null;
  };

  const submitDeleteOrg = async () => {
    if (!deleteOrgTarget.value) return;
    if (deleteOrgConfirmName.value !== deleteOrgTarget.value.name) return;
    deletingOrg.value = true;
    deleteOrgError.value = null;
    try {
      const response = await api.delete(`/admin/organizations/${deleteOrgTarget.value.id}`);
      if (response.data.success) {
        organizations.value = organizations.value.filter((o) => o.id !== deleteOrgTarget.value!.id);
        closeDeleteOrgDialog();
      } else {
        throw new Error(response.data.error || 'Failed to delete organization');
      }
    } catch (err) {
      deleteOrgError.value = err instanceof Error ? err.message : 'Failed to delete organization';
    } finally {
      deletingOrg.value = false;
    }
  };

  const showGrantSubDialog = ref(false);
  const grantSubOrg = ref<Organization | null>(null);
  const grantingSubId = ref<number | null>(null);
  const grantSubError = ref<string | null>(null);
  const grantSubForm = ref({ tier: 'enterprise_base', days: 30, grant_credits: false });
  const showTierDropdown = ref(false);

  const availableTiers = [
    { value: 'solo', label: 'Solo' },
    { value: 'enterprise_base', label: 'Enterprise Base' },
    { value: 'enterprise_ai', label: 'Enterprise AI' },
    { value: 'enterprise_unlimited', label: 'Enterprise Unlimited' },
  ];


  const createTierOptions = [
    { value: 'solo', label: 'Solo ($149.99)' },
    { value: 'enterprise_base', label: 'Enterprise Base ($349.99)' },
    { value: 'enterprise_ai', label: 'Enterprise AI ($549.99)' },
    { value: 'enterprise_unlimited', label: 'Enterprise Unlimited ($2199.99)' },
    { value: 'custom', label: 'Custom (Admin-Defined)' },
  ];

  const getTierDisplayName = (tierValue: string) => {
    const tier = availableTiers.find(t => t.value === tierValue);
    return tier ? tier.label : 'Select tier';
  };

  const selectTier = (tierValue: string) => {
    grantSubForm.value.tier = tierValue;
    showTierDropdown.value = false;
  };

  // Edit Subscription
  const showEditSubDialog = ref(false);
  const editSubOrg = ref<Organization | null>(null);
  const editingSubId = ref<number | null>(null);
  const editSubError = ref<string | null>(null);
  const editSubForm = ref({ tier: '', max_seats: 0, monthly_credits: 0, price_dollars: 0 });

  const fetchOrganizations = async () => {
    loading.value = true;
    try {
      const response = await api.get('/admin/organizations');
      if (response.data.success) {
        organizations.value = response.data.organizations;
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    } finally {
      loading.value = false;
    }
  };

  const formatTier = (tier: string) => availableTiers.find((t) => t.value === tier)?.label || formatStatus(tier);

  const formatExpiredDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateOnly(dateString) || 'N/A';
    } catch {
      return 'Invalid date';
    }
  };

  const isExpiredSubscription = (org: Organization) => {
    return org.subscription_status === 'expired';
  };

  const formatCredits = (credits: number) => {
    if (!credits || credits === 0) return '0';
    return Math.round(credits).toString();
  };

  const openOrgCreditDialog = (org: Organization) => {
    orgToEditCredits.value = org;
    orgCreditForm.value = {
      hours_remaining: org.credits.hours_remaining,
      hours_used: org.credits.hours_used,
    };
    orgCreditError.value = null;
    showOrgCreditDialog.value = true;
  };

  const handleOrgCreditDialogClose = () => {
    showOrgCreditDialog.value = false;
    orgToEditCredits.value = null;
    orgCreditForm.value = { hours_remaining: 0, hours_used: 0 };
    orgCreditError.value = null;
  };

  const updateOrgCredits = async () => {
    if (!orgToEditCredits.value) return;
    updatingOrgCreditsId.value = orgToEditCredits.value.id;
    orgCreditError.value = null;
    try {
      const response = await api.put(`/admin/organizations/${orgToEditCredits.value.id}/credits`, {
        hours_remaining: orgCreditForm.value.hours_remaining,
        hours_used: orgCreditForm.value.hours_used,
      });
      if (response.data.success) {
        const orgIndex = organizations.value.findIndex((o) => o.id === orgToEditCredits.value!.id);
        if (orgIndex !== -1) {
          organizations.value[orgIndex] = {
            ...organizations.value[orgIndex],
            credits: response.data.credits,
          };
        }
        handleOrgCreditDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to update credits');
      }
    } catch (err) {
      orgCreditError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingOrgCreditsId.value = null;
    }
  };

  // Create Org Account
  const createOrgAccount = async () => {
    createOrgError.value = null;

    if (!createOrgForm.value.org_name.trim()) {
      createOrgError.value = 'Organization name is required.';
      return;
    }
    if (createOrgMode.value === 'existing' && !selectedExistingUser.value) {
      createOrgError.value = 'Please select an existing user from the search results.';
      return;
    }
    if (createOrgMode.value === 'new' && (!createOrgForm.value.email || !createOrgForm.value.password)) {
      createOrgError.value = 'Email and password are required for new user accounts.';
      return;
    }

    creatingOrg.value = true;
    try {
      // Check if org name is available
      const nameCheck = await checkOrgNameAvailable(createOrgForm.value.org_name.trim());
      if (!nameCheck.success || !nameCheck.available) {
        createOrgError.value = 'An organization with this name already exists. Please choose a different name.';
        creatingOrg.value = false;
        return;
      }

      const payload: Record<string, unknown> = {
        org_name: createOrgForm.value.org_name,
        tier: createOrgForm.value.tier,
        max_seats: createOrgForm.value.max_seats,
        monthly_credits: createOrgForm.value.monthly_credits,
        price_cents: Math.round(createOrgForm.value.price_dollars * 100),
      };

      if (createOrgMode.value === 'existing') {
        payload.existing_user_id = selectedExistingUser.value!.id;
      } else {
        payload.email = createOrgForm.value.email;
        payload.password = createOrgForm.value.password;
      }

      const response = await api.post('/admin/organizations/create-account', payload);
      if (response.data.success) {
        showCreateOrgDialog.value = false;
        resetCreateOrgDialog();
        fetchOrganizations();
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      createOrgError.value = err instanceof Error ? err.message : 'Failed to create org account';
    } finally {
      creatingOrg.value = false;
    }
  };

  // Grant Subscription
  const openGrantSubDialog = (org: Organization) => {
    grantSubOrg.value = org;
    grantSubForm.value = { tier: org.subscription_tier || 'enterprise_base', days: 30, grant_credits: false };
    grantSubError.value = null;
    showGrantSubDialog.value = true;
  };

  const grantSubscription = async () => {
    if (!grantSubOrg.value) return;
    grantingSubId.value = grantSubOrg.value.id;
    grantSubError.value = null;
    try {
      const response = await api.post(`/admin/organizations/${grantSubOrg.value.id}/subscription`, {
        tier: grantSubForm.value.tier,
        days: grantSubForm.value.days,
        grant_credits: grantSubForm.value.grant_credits,
      });
      if (response.data.success) {
        showGrantSubDialog.value = false;
        fetchOrganizations();
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      grantSubError.value = err instanceof Error ? err.message : 'Failed to grant subscription';
    } finally {
      grantingSubId.value = null;
    }
  };

  // Edit Subscription
  const openEditSubDialog = (org: Organization) => {
    editSubOrg.value = org;
    editSubForm.value = {
      tier: org.subscription_tier || 'enterprise_base',
      max_seats: org.max_seats || 0,
      monthly_credits: org.monthly_credits || 0,
      price_dollars: org.admin_price_cents != null ? org.admin_price_cents / 100 : 0,
    };
    editSubError.value = null;
    showEditSubDialog.value = true;
  };

  const updateOrgSub = async () => {
    if (!editSubOrg.value) return;
    editingSubId.value = editSubOrg.value.id;
    editSubError.value = null;
    try {
      const response = await api.put(`/admin/organizations/${editSubOrg.value.id}/subscription`, {
        tier: editSubForm.value.tier,
        max_seats: editSubForm.value.max_seats,
        monthly_credits: editSubForm.value.monthly_credits,
        admin_price_cents: Math.round(editSubForm.value.price_dollars * 100),
      });
      if (response.data.success) {
        showEditSubDialog.value = false;
        fetchOrganizations();
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      editSubError.value = err instanceof Error ? err.message : 'Failed to update subscription';
    } finally {
      editingSubId.value = null;
    }
  };

  // Cancel Subscription
  const showCancelSubDialog = ref(false);
  const cancelSubOrg = ref<Organization | null>(null);
  const cancellingSubId = ref<number | null>(null);
  const cancelSubError = ref<string | null>(null);

  const cancelOrgSub = (org: Organization) => {
    cancelSubOrg.value = org;
    cancelSubError.value = null;
    showCancelSubDialog.value = true;
  };

  const closeCancelSubDialog = () => {
    showCancelSubDialog.value = false;
    cancelSubOrg.value = null;
    cancelSubError.value = null;
  };

  const confirmCancelOrgSub = async () => {
    if (!cancelSubOrg.value) return;
    cancellingSubId.value = cancelSubOrg.value.id;
    cancelSubError.value = null;
    try {
      const response = await api.post(`/admin/organizations/${cancelSubOrg.value.id}/subscription/cancel`);
      if (response.data.success) {
        closeCancelSubDialog();
        fetchOrganizations();
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      cancelSubError.value = err instanceof Error ? err.message : 'Failed to cancel subscription';
    } finally {
      cancellingSubId.value = null;
    }
  };

  onMounted(() => {
    fetchOrganizations();
  });
</script>
