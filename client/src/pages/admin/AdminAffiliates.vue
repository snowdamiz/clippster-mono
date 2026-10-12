<template>
  <PageLayout
    title="Affiliates"
    description="Manage affiliate accounts and commissions"
    :icon="Handshake"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Affiliates' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh" :disabled="loading" @click="fetchAffiliates">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
      <Button variant="primary" size="sm" @click="showCreateModal = true">
        <Plus />
        New affiliate
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Overview -->
      <StatGrid v-if="overview" :count="4" class="animate-enter">
        <StatCard label="Total affiliates" :value="overview.total_affiliates" :icon="Users" />
        <StatCard label="Active" :value="overview.active_affiliates" :icon="UserCheck" tone="success" />
        <StatCard label="Total commission" :value="`$${overview.total_commission.toFixed(2)}`" :icon="DollarSign" />
        <StatCard label="Pending payout" :value="`$${overview.total_pending.toFixed(2)}`" :icon="Clock" />
      </StatGrid>

      <Alert v-if="error && !showCreateModal" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <DataTable
        :columns="columns"
        :rows="affiliates"
        row-key="id"
        :loading="loading"
        clickable
        @row-click="(aff) => $router.push(`/admin/affiliates/${aff.id}`)"
      >
        <template #cell-user="{ row: aff }">
          <p class="truncate font-medium text-fg">{{ aff.user?.name || aff.user?.email || 'Unknown' }}</p>
          <p class="tabular truncate text-xs text-fg-subtle">
            <code class="font-mono text-fg-muted">{{ aff.referral_code }}</code>
            · #{{ aff.user?.id }}
          </p>
        </template>
        <template #cell-rates="{ row: aff }">
          <p class="tabular truncate text-xs text-fg">
            {{ aff.signup_commission_pct }}% signup · {{ aff.recurring_commission_pct }}% recurring
          </p>
          <p v-if="aff.credit_pack_commission_enabled" class="tabular truncate text-xs text-fg-subtle">
            {{ aff.credit_pack_commission_pct }}% credit packs
          </p>
        </template>
        <template #cell-referrals="{ row: aff }">
          <span class="tabular">{{ aff.stats?.total_referrals || 0 }}</span>
        </template>
        <template #cell-earned="{ row: aff }">
          <p class="tabular text-fg">${{ (aff.stats?.total_earned || 0).toFixed(2) }}</p>
          <p class="tabular truncate text-xs" :class="aff.stats?.total_pending ? 'text-warning' : 'text-fg-subtle'">
            +${{ (aff.stats?.total_pending || 0).toFixed(2) }} pending
          </p>
        </template>
        <template #cell-status="{ row: aff }">
          <Badge :variant="statusVariant(aff.status)">{{ formatStatus(aff.status) }}</Badge>
        </template>
        <template #actions="{ row: aff }">
          <router-link
            :to="`/admin/affiliates/${aff.id}`"
            :class="buttonVariants({ variant: 'ghost', size: 'icon-sm' })"
            :title="`View ${aff.user?.name || aff.user?.email || 'affiliate'}`"
          >
            <ChevronRight />
          </router-link>
        </template>
        <template #empty>
          <EmptyState
            size="sm"
            :icon="Handshake"
            title="No affiliates yet"
            description="Create your first affiliate to start tracking referrals."
          >
            <Button variant="secondary" size="sm" @click="showCreateModal = true"><Plus />New affiliate</Button>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <!-- Create Affiliate Modal -->
    <Modal
      v-model:open="showCreateModal"
      title="New affiliate"
      description="Set up a new affiliate partner with referral tracking"
      :icon="Handshake"
      body-class="flex flex-col gap-4"
    >
      <Field label="User account">
        <div
          v-if="selectedUser"
          class="flex h-[var(--control-md)] items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface-sunken pl-2.5 pr-1"
        >
          <span class="truncate text-sm text-fg">{{ selectedUser.email || selectedUser.wallet_address }}</span>
          <Button variant="ghost" size="icon-xs" title="Clear selection" @click="clearSelectedUser"><X /></Button>
        </div>
        <div v-else class="create-aff__search-wrapper flex flex-col gap-1.5">
          <SearchField
            :model-value="userSearch"
            placeholder="Search by email…"
            @update:model-value="
              (value: string) => {
                userSearch = value;
                filterUsers();
              }
            "
            @focusin="showUserDropdown = true"
          />
          <div
            v-if="showUserDropdown && filteredUsers.length > 0"
            class="max-h-48 overflow-y-auto rounded-[var(--radius-control)] border border-line bg-surface p-1"
          >
            <button
              v-for="u in filteredUsers"
              :key="u.id"
              type="button"
              class="flex h-8 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-surface-hover"
              @click="selectUser(u)"
            >
              <span class="truncate text-fg">{{ u.email || u.wallet_address || 'No email' }}</span>
              <span class="tabular shrink-0 text-xs text-fg-subtle">#{{ u.id }}</span>
            </button>
          </div>
        </div>
      </Field>

      <Field label="Referral code">
        <Input v-model="createForm.referral_code" placeholder="e.g. STREAMER_NAME" class="font-mono" />
      </Field>

      <div class="grid grid-cols-2 gap-3">
        <Field label="Signup commission (%)">
          <Input v-model="createForm.signup_commission_pct" type="number" step="0.1" placeholder="20" />
        </Field>
        <Field label="Recurring commission (%)">
          <Input v-model="createForm.recurring_commission_pct" type="number" step="0.1" placeholder="10" />
        </Field>
      </div>

      <label class="flex items-center gap-2 text-sm text-fg">
        <Checkbox v-model="createForm.credit_pack_commission_enabled" />
        Enable credit pack commission
      </label>

      <Field v-if="createForm.credit_pack_commission_enabled" label="Credit pack commission (%)">
        <Input v-model="createForm.credit_pack_commission_pct" type="number" step="0.1" placeholder="5" />
      </Field>

      <Field label="Notes">
        <Textarea v-model="createForm.notes" placeholder="Optional notes…" rows="3" />
      </Field>

      <Alert v-if="error" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <template #footer>
        <Button variant="ghost" @click="showCreateModal = false">Cancel</Button>
        <Button variant="primary" :loading="creating" :disabled="creating" @click="handleCreate">Create affiliate</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, watch } from 'vue';
  import {
    Handshake,
    Users,
    UserCheck,
    DollarSign,
    Clock,
    Plus,
    RefreshCw,
    AlertTriangle,
    ChevronRight,
    X,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { Textarea } from '@/components/ui/textarea';
  import { formatStatus, statusVariant } from '@/components/admin/shared';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import api from '@/services/api';
  import {
    listAffiliates,
    createAffiliate,
    getAdminOverview,
    type Affiliate,
    type AdminOverview,
  } from '@/services/affiliateApi';

  const loading = ref(false);
  const creating = ref(false);
  const error = ref<string | null>(null);
  const affiliates = ref<Affiliate[]>([]);
  const overview = ref<AdminOverview | null>(null);
  const showCreateModal = ref(false);

  const columns: DataTableColumn[] = [
    { key: 'user', label: 'Affiliate' },
    { key: 'rates', label: 'Rates', width: '212px', hideBelow: 'md' },
    { key: 'referrals', label: 'Referrals', width: '100px', align: 'right' },
    { key: 'earned', label: 'Earned', width: '136px', align: 'right' },
    { key: 'status', label: 'Status', width: '108px' },
  ];

  // User search state
  const allUsers = ref<any[]>([]);
  const filteredUsers = ref<any[]>([]);
  const userSearch = ref('');
  const showUserDropdown = ref(false);
  const selectedUser = ref<any>(null);

  const createForm = reactive({
    user_id: '' as string | number,
    referral_code: '',
    signup_commission_pct: 20,
    recurring_commission_pct: 10,
    credit_pack_commission_enabled: false,
    credit_pack_commission_pct: 5,
    notes: '',
  });

  async function fetchAffiliates() {
    loading.value = true;
    error.value = null;
    try {
      const [affResult, overviewResult] = await Promise.all([
        listAffiliates(),
        getAdminOverview(),
      ]);
      if (affResult.success) affiliates.value = affResult.affiliates;
      else error.value = affResult.error || 'Failed to load affiliates';
      if (overviewResult.success) overview.value = overviewResult.overview!;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUsers() {
    try {
      const response = await api.get('/admin/users');
      if (response.data.success) {
        allUsers.value = response.data.users;
      }
    } catch (e) {
      console.error('[Affiliates] Failed to fetch users:', e);
    }
  }

  function filterUsers() {
    showUserDropdown.value = true;
    const q = userSearch.value.toLowerCase().trim();
    if (!q) {
      filteredUsers.value = allUsers.value.slice(0, 10);
      return;
    }
    filteredUsers.value = allUsers.value
      .filter((u: any) =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.wallet_address && u.wallet_address.toLowerCase().includes(q)) ||
        String(u.id).includes(q)
      )
      .slice(0, 10);
  }

  function selectUser(u: any) {
    selectedUser.value = u;
    createForm.user_id = u.id;
    userSearch.value = '';
    showUserDropdown.value = false;
  }

  function clearSelectedUser() {
    selectedUser.value = null;
    createForm.user_id = '';
    userSearch.value = '';
  }

  // Close dropdown on click outside
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.create-aff__search-wrapper')) {
      showUserDropdown.value = false;
    }
  }

  watch(showCreateModal, (open) => {
    if (open) {
      if (!allUsers.value.length) fetchUsers();
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
      clearSelectedUser();
    }
  });

  async function handleCreate() {
    if (!createForm.user_id || !createForm.referral_code) {
      error.value = 'Please select a user and enter a referral code';
      return;
    }
    creating.value = true;
    error.value = null;
    try {
      const result = await createAffiliate({
        user_id: Number(createForm.user_id),
        referral_code: createForm.referral_code,
        signup_commission_pct: createForm.signup_commission_pct,
        recurring_commission_pct: createForm.recurring_commission_pct,
        credit_pack_commission_enabled: createForm.credit_pack_commission_enabled,
        credit_pack_commission_pct: createForm.credit_pack_commission_pct,
        notes: createForm.notes || undefined,
      });
      if (result.success) {
        showCreateModal.value = false;
        createForm.user_id = '';
        createForm.referral_code = '';
        createForm.notes = '';
        await fetchAffiliates();
      } else {
        error.value = result.error || 'Failed to create affiliate';
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      creating.value = false;
    }
  }

  onMounted(() => {
    fetchAffiliates();
  });
</script>
