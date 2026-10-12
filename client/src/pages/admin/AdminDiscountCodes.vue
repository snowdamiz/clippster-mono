<template>
  <PageLayout
    title="Discount codes"
    description="Create and manage promotional discount codes"
    :icon="Percent"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Discount codes' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh codes" :disabled="loading" @click="fetchPromoCodes">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
      <Button variant="primary" size="sm" @click="showCreateModal = true">
        <Plus />
        New code
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar
        v-model:search="filters.search"
        placeholder="Search codes…"
        :count="filteredPromoCodes.length"
        count-label="code"
      >
        <div class="w-32">
          <CustomDropdown v-model="filters.is_active" :options="statusOptions" placeholder="Status" size="sm" />
        </div>
        <div class="w-28">
          <CustomDropdown v-model="filters.tier" :options="tierOptions" placeholder="Tier" size="sm" />
        </div>
      </AdminFilterBar>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <StatGrid :count="3">
        <StatCard label="Total codes" :value="stats.total" :icon="Tag" :loading="loading && !promoCodes.length" />
        <StatCard
          label="Active"
          :value="stats.active"
          :icon="CheckCircle"
          tone="success"
          :loading="loading && !promoCodes.length"
        />
        <StatCard label="Redemptions" :value="stats.redemptions" :icon="Users" :loading="loading && !promoCodes.length" />
      </StatGrid>

      <Alert v-if="error && !showCreateModal" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <DataTable
        :columns="columns"
        :rows="filteredPromoCodes"
        row-key="id"
        :loading="loading"
        clickable
        @row-click="viewPromo"
      >
        <template #cell-code="{ row: promo }">
          <code class="block truncate font-mono text-sm font-medium text-fg">{{ promo.code }}</code>
          <p v-if="promo.name" class="truncate text-xs text-fg-subtle">{{ promo.name }}</p>
        </template>
        <template #cell-discount="{ row: promo }">
          <span class="tabular block truncate font-medium text-fg" :title="formatDiscount(promo)">{{ formatDiscount(promo) }}</span>
        </template>
        <template #cell-duration="{ row: promo }">
          <span class="block truncate text-xs text-fg-muted" :title="formatDuration(promo)">{{ formatDuration(promo) }}</span>
        </template>
        <template #cell-tiers="{ row: promo }">
          <span class="block truncate text-xs text-fg-muted" :title="formatEligibility(promo)">
            {{ formatEligibility(promo) || '—' }}
          </span>
        </template>
        <template #cell-usage="{ row: promo }">
          <span class="tabular" :class="usageClass(promo)">
            {{ promo.redemption_count }}{{ promo.max_redemptions ? '/' + promo.max_redemptions : '' }}
          </span>
        </template>
        <template #cell-status="{ row: promo }">
          <Badge :variant="promo.is_active ? 'success' : 'neutral'">{{ promo.is_active ? 'Active' : 'Inactive' }}</Badge>
        </template>
        <template #cell-created="{ row: promo }">
          <span class="truncate text-xs text-fg-muted">{{ formatDate(promo.created_at) }}</span>
        </template>
        <template #actions="{ row: promo }">
          <AdminRowActions :label="`Actions for ${promo.code}`">
            <AdminActionItem :icon="Eye" @select="viewPromo(promo)">View details</AdminActionItem>
            <AdminActionItem :icon="Copy" @select="copyCode(promo.code)">Copy code</AdminActionItem>
            <AdminActionItem :icon="Edit" @select="editPromo(promo)">Edit</AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="promo.is_active ? PowerOff : Power" :destructive="promo.is_active" @select="togglePromo(promo)">
              {{ promo.is_active ? 'Deactivate' : 'Activate' }}
            </AdminActionItem>
          </AdminRowActions>
        </template>
        <template #empty>
          <EmptyState
            size="sm"
            :icon="Percent"
            :title="promoCodes.length ? 'No codes match your filters' : 'No discount codes yet'"
          >
            <Button v-if="!promoCodes.length" variant="secondary" size="sm" @click="showCreateModal = true">
              <Plus />
              New code
            </Button>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <!-- Create/Edit Modal -->
    <Modal
      :open="showCreateModal"
      :title="editingPromo ? 'Edit discount code' : 'New discount code'"
      :description="editingPromo ? 'Modify existing promotional code settings' : 'Generate a new promotional code'"
      :icon="Percent"
      size="lg"
      :dismissible="!saving"
      @close="closeCreateModal"
    >
      <form class="flex flex-col gap-4" @submit.prevent="savePromoCode">
        <div class="grid grid-cols-2 gap-3">
          <Field label="Code" required :error="errors.code">
            <div class="flex gap-1.5">
              <Input
                v-model="formData.code"
                placeholder="DISCOUNT2025"
                :disabled="!!editingPromo"
                class="font-mono uppercase"
                :aria-invalid="!!errors.code"
                @input="errors.code = ''"
              />
              <Button
                v-if="!editingPromo"
                type="button"
                variant="secondary"
                size="icon"
                title="Generate random code"
                @click="generateRandomCode"
              >
                <Shuffle />
              </Button>
            </div>
          </Field>
          <Field label="Name (optional)" :error="errors.name">
            <Input v-model="formData.name" placeholder="Summer Sale 2025" @input="errors.name = ''" />
          </Field>
        </div>

        <Field v-if="!editingPromo" label="Code type" required>
          <SegmentedControl
            :model-value="formData.promo_type"
            :options="promoTypeOptions"
            block
            @update:model-value="(type) => (type === 'bundle' ? setPromoType('bundle') : (formData.promo_type = 'percent'))"
          />
          <p v-if="formData.promo_type === 'bundle'" class="text-xs text-fg-subtle">
            Fixed price for platform access + total credits (one-time payment, no recurring subscription).
          </p>
        </Field>

        <div :key="formData.promo_type" class="flex animate-enter flex-col gap-4">
          <!-- Percentage discount -->
          <template v-if="formData.promo_type === 'percent'">
            <Field label="Discount percentage" required>
              <div class="flex items-center gap-3">
                <input v-model.number="formData.percent_off" type="range" min="1" max="100" class="flex-1" />
                <span class="tabular w-12 rounded-md bg-surface-sunken py-1 text-center text-sm font-semibold text-fg">
                  {{ formData.percent_off }}%
                </span>
              </div>
            </Field>
            <div class="grid grid-cols-2 gap-3">
              <Field label="Duration type" required>
                <SegmentedControl v-model="formData.duration_kind" :options="durationOptions" block />
              </Field>
              <Field
                v-if="formData.duration_kind === 'repeating'"
                label="Discount duration (months)"
                required
                :error="errors.duration_months"
              >
                <Input
                  v-model.number="formData.duration_months"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="3"
                  :aria-invalid="!!errors.duration_months"
                  @input="errors.duration_months = ''"
                />
              </Field>
            </div>
          </template>

          <!-- Bundle -->
          <template v-if="formData.promo_type === 'bundle'">
            <div class="grid grid-cols-3 gap-3">
              <Field label="Fixed price (USD)" required :error="errors.fixed_price_usd">
                <Input
                  :model-value="formData.fixed_price_usd ?? ''"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="175.00"
                  :aria-invalid="!!errors.fixed_price_usd"
                  @update:model-value="(v) => (formData.fixed_price_usd = toNumberOrNull(v))"
                  @input="errors.fixed_price_usd = ''"
                />
              </Field>
              <Field label="Months of access" required :error="errors.access_months">
                <Input
                  v-model.number="formData.access_months"
                  type="number"
                  min="1"
                  max="120"
                  placeholder="12"
                  :aria-invalid="!!errors.access_months"
                  @input="errors.access_months = ''"
                />
              </Field>
              <Field label="Total credits" required :error="errors.total_credits">
                <Input
                  v-model.number="formData.total_credits"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="18000"
                  :aria-invalid="!!errors.total_credits"
                  @input="errors.total_credits = ''"
                />
              </Field>
            </div>
          </template>
        </div>

        <!-- Eligibility -->
        <div class="flex flex-col gap-3 border-t border-line-subtle pt-4">
          <Field label="User subscription tiers">
            <template #label-end><span class="text-2xs text-fg-subtle">Personal accounts</span></template>
            <ToggleChips :options="userTierChips" :model-value="formData.allowed_tiers" @toggle="toggleTier" />
          </Field>
          <Field v-if="formData.promo_type === 'percent'" label="Organization subscription tiers">
            <template #label-end><span class="text-2xs text-fg-subtle">Organization plans</span></template>
            <ToggleChips :options="orgTierChips" :model-value="formData.allowed_org_tiers" @toggle="toggleOrgTier" />
          </Field>
          <Field v-if="formData.promo_type === 'percent'" label="Credit packs">
            <template #label-end><span class="text-2xs text-fg-subtle">One-time purchases</span></template>
            <ToggleChips :options="creditPackChips" :model-value="formData.allowed_credit_packs" @toggle="toggleCreditPack" />
          </Field>
        </div>

        <Alert v-if="errors.allowed_tiers" variant="destructive">
          <AlertTriangle />
          <AlertDescription>{{ errors.allowed_tiers }}</AlertDescription>
        </Alert>

        <div class="grid grid-cols-2 gap-3">
          <Field label="Max redemptions (optional)" :error="errors.max_redemptions">
            <Input
              :model-value="formData.max_redemptions ?? ''"
              type="number"
              min="1"
              placeholder="Unlimited"
              @update:model-value="(v) => (formData.max_redemptions = toNumberOrNull(v))"
              @input="errors.max_redemptions = ''"
            />
          </Field>
          <Field label="Expiration date (optional)" :error="errors.redeem_by">
            <Input v-model="formData.redeem_by" type="datetime-local" @input="errors.redeem_by = ''" />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <Textarea v-model="formData.notes" placeholder="Internal notes about this discount code…" rows="2" />
        </Field>

        <Alert v-if="error" variant="destructive">
          <AlertTriangle />
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
      </form>

      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="closeCreateModal">Cancel</Button>
        <Button variant="primary" :loading="saving" :disabled="saving" @click="savePromoCode">
          {{ saving ? 'Saving…' : editingPromo ? 'Save changes' : 'Create code' }}
        </Button>
      </template>
    </Modal>

    <!-- View Details Modal -->
    <Modal
      :open="!!viewingPromo"
      title="Discount code"
      :description="viewingPromo?.name || 'Promotional code details'"
      :icon="Tag"
      size="md"
      body-class="flex flex-col gap-4"
      @close="viewingPromo = null"
    >
      <template v-if="viewingPromo">
        <div class="flex items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface-sunken py-2 pl-3.5 pr-2">
          <code class="truncate font-mono text-lg font-semibold tracking-wide text-fg">{{ viewingPromo.code }}</code>
          <Button variant="ghost" size="icon-sm" title="Copy code" @click="copyCode(viewingPromo.code)"><Copy /></Button>
        </div>

        <StatGrid size="sm">
          <StatCard label="Discount" :value="formatDiscount(viewingPromo)" />
          <StatCard label="Duration" :value="formatDuration(viewingPromo)" />
          <StatCard label="Status" value="">
            <template #value>
              <Badge :variant="viewingPromo.is_active ? 'success' : 'neutral'">
                {{ viewingPromo.is_active ? 'Active' : 'Inactive' }}
              </Badge>
            </template>
          </StatCard>
          <StatCard
            label="Usage"
            :value="`${viewingPromo.redemption_count}${viewingPromo.max_redemptions ? '/' + viewingPromo.max_redemptions : ''}`"
          />
        </StatGrid>

        <div
          v-if="viewingPromo.allowed_tiers?.length || viewingPromo.allowed_org_tiers?.length || viewingPromo.allowed_credit_packs?.length"
          class="flex flex-col gap-2.5"
        >
          <div v-if="viewingPromo.allowed_tiers?.length" class="flex flex-wrap items-center gap-1.5">
            <span class="w-24 shrink-0 text-xs text-fg-muted">User tiers</span>
            <Badge v-for="tier in viewingPromo.allowed_tiers" :key="tier" variant="brand">{{ titleCase(tier) }}</Badge>
          </div>
          <div v-if="viewingPromo.allowed_org_tiers?.length" class="flex flex-wrap items-center gap-1.5">
            <span class="w-24 shrink-0 text-xs text-fg-muted">Org tiers</span>
            <Badge v-for="tier in viewingPromo.allowed_org_tiers" :key="tier" variant="neutral">{{ titleCase(tier) }}</Badge>
          </div>
          <div v-if="viewingPromo.allowed_credit_packs?.length" class="flex flex-wrap items-center gap-1.5">
            <span class="w-24 shrink-0 text-xs text-fg-muted">Credit packs</span>
            <Badge v-for="pack in viewingPromo.allowed_credit_packs" :key="pack" variant="neutral">{{ titleCase(pack) }}</Badge>
          </div>
        </div>

        <div v-if="viewingPromo.max_redemptions || viewingPromo.redeem_by || viewingPromo.notes">
          <InfoRow v-if="viewingPromo.max_redemptions" label="Max redemptions">
            <span class="tabular">{{ viewingPromo.max_redemptions }}</span>
          </InfoRow>
          <InfoRow v-if="viewingPromo.redeem_by" label="Expires">{{ formatDate(viewingPromo.redeem_by) }}</InfoRow>
          <div v-if="viewingPromo.notes" class="py-2">
            <p class="text-xs text-fg-muted">Notes</p>
            <p class="mt-0.5 whitespace-pre-wrap text-sm text-fg">{{ viewingPromo.notes }}</p>
          </div>
        </div>

        <section v-if="viewingPromo.redemptions && viewingPromo.redemptions.length > 0" class="flex flex-col gap-2">
          <SectionHeader title="Redemptions" :count="viewingPromo.redemptions.length" />
          <ul class="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface">
            <li
              v-for="redemption in viewingPromo.redemptions"
              :key="redemption.id"
              class="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div class="min-w-0">
                <code class="block truncate font-mono text-xs text-fg">{{ redemption.user.wallet_address || 'N/A' }}</code>
                <p class="text-2xs text-fg-subtle">{{ formatDate(redemption.redeemed_at) }}</p>
              </div>
              <Badge :variant="statusVariant(redemption.status)">{{ formatStatus(redemption.status) }}</Badge>
            </li>
          </ul>
        </section>
      </template>

      <template #footer>
        <Button variant="secondary" @click="viewingPromo = null">Close</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import { useToast } from '@/composables/useToast';
  import * as promoCodesApi from '@/services/promoCodesApi';
  import type { PromoCode, PromoCodeWithRedemptions } from '@/services/promoCodesApi';
  import {
    Percent,
    RefreshCw,
    Plus,
    Copy,
    Eye,
    Edit,
    Power,
    PowerOff,
    Tag,
    CheckCircle,
    Users,
    AlertTriangle,
    Shuffle,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import type { SegmentedOption } from '@/components/ui/segmented-control/types';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { Textarea } from '@/components/ui/textarea';
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import { InfoRow } from '@/components/ui/info-list';
  import { ToggleChips } from '@/components/ui/toggle-chips';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const loading = ref(true);
  const saving = ref(false);
  const error = ref('');

  const promoCodes = ref<PromoCode[]>([]);
  const stats = ref({ total: 0, active: 0, redemptions: 0 });

  const filters = ref({
    search: '',
    is_active: null as boolean | null,
    tier: null as string | null,
    expired: false,
  });

  const columns: DataTableColumn[] = [
    { key: 'code', label: 'Code' },
    { key: 'discount', label: 'Discount', width: '124px' },
    { key: 'duration', label: 'Duration', width: '120px', hideBelow: 'md' },
    { key: 'tiers', label: 'Eligible', width: '168px', hideBelow: 'md' },
    { key: 'usage', label: 'Usage', width: '76px', align: 'right' },
    { key: 'status', label: 'Status', width: '92px' },
    { key: 'created', label: 'Created', width: '150px', hideBelow: 'lg' },
  ];

  const titleCase = (value: string) =>
    value
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => (w === 'ai' ? 'AI' : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');

  const userTierChips = ['starter', 'creator', 'pro'].map((value) => ({ value, label: titleCase(value) }));
  const orgTierChips = ['enterprise', 'enterprise_ai', 'addon_5_seats', 'addon_5_seats_ai', 'addon_10_seats', 'addon_10_seats_ai'].map(
    (value) => ({ value, label: titleCase(value) })
  );
  const creditPackChips = ['starter', 'creator', 'pro', 'enterprise'].map((value) => ({ value, label: titleCase(value) }));

  const promoTypeOptions: SegmentedOption<'percent' | 'bundle'>[] = [
    { value: 'percent', label: 'Percentage discount' },
    { value: 'bundle', label: 'Bundle deal' },
  ];
  const durationOptions: SegmentedOption<'once' | 'repeating' | 'forever'>[] = [
    { value: 'once', label: 'Once' },
    { value: 'repeating', label: 'Repeating' },
    { value: 'forever', label: 'Forever' },
  ];

  /** Empty number inputs map back to `null`. */
  const toNumberOrNull = (value: string | number) => (value === '' ? null : Number(value));

  /** One-line summary of who can redeem a code, for the table. */
  function formatEligibility(promo: PromoCode): string {
    const parts: string[] = [];
    if (promo.allowed_tiers?.length) parts.push(promo.allowed_tiers.map(titleCase).join(', '));
    if (promo.allowed_org_tiers?.length) parts.push(`Org: ${promo.allowed_org_tiers.map(titleCase).join(', ')}`);
    if (promo.allowed_credit_packs?.length) parts.push(`Packs: ${promo.allowed_credit_packs.map(titleCase).join(', ')}`);
    return parts.join(' · ');
  }

  const statusOptions = [
    { label: 'All statuses', value: null },
    { label: 'Active', value: true },
    { label: 'Inactive', value: false },
  ];

  const tierOptions = [
    { label: 'All tiers', value: null },
    { label: 'Starter', value: 'starter' },
    { label: 'Creator', value: 'creator' },
    { label: 'Pro', value: 'pro' },
  ];

  const showCreateModal = ref(false);
  const editingPromo = ref<PromoCode | null>(null);
  const viewingPromo = ref<PromoCodeWithRedemptions | null>(null);

  const formData = ref({
    code: '',
    name: '',
    promo_type: 'percent' as 'percent' | 'bundle',
    percent_off: 10,
    fixed_price_usd: null as number | null,
    access_months: 12,
    total_credits: 0,
    duration_kind: 'repeating' as 'once' | 'repeating' | 'forever',
    duration_months: 3,
    allowed_tiers: [] as string[],
    allowed_org_tiers: [] as string[],
    allowed_credit_packs: [] as string[],
    max_redemptions: null as number | null,
    redeem_by: '',
    notes: '',
  });

  const errors = ref<Record<string, string>>({});

  const filteredPromoCodes = computed(() => {
    let codes = promoCodes.value;

    if (filters.value.search) {
      const search = filters.value.search.toLowerCase();
      codes = codes.filter(
        (code) => code.code.toLowerCase().includes(search) || (code.name && code.name.toLowerCase().includes(search))
      );
    }

    if (filters.value.is_active !== null) {
      codes = codes.filter((code) => code.is_active === filters.value.is_active);
    }

    if (filters.value.tier) {
      codes = codes.filter((code) => code.allowed_tiers.includes(filters.value.tier!));
    }

    if (filters.value.expired) {
      const now = new Date();
      codes = codes.filter((code) => {
        if (!code.redeem_by) return false;
        return new Date(code.redeem_by) < now;
      });
    }

    return codes;
  });

  async function fetchPromoCodes() {
    loading.value = true;
    error.value = '';

    try {
      const apiFilters: any = {};

      if (filters.value.search) {
        apiFilters.search = filters.value.search;
      }
      if (filters.value.is_active !== null) {
        apiFilters.is_active = filters.value.is_active;
      }
      if (filters.value.tier) {
        apiFilters.tier = filters.value.tier;
      }

      const response = await promoCodesApi.listPromoCodes(apiFilters);

      if (response.success) {
        promoCodes.value = response.promos;
        stats.value = calculateStats(response.promos);
      } else {
        error.value = response.error || 'Failed to load discount codes';
      }
    } catch (e: any) {
      error.value = e.message || 'An error occurred';
    } finally {
      loading.value = false;
    }
  }

  function calculateStats(codes: PromoCode[]) {
    return {
      total: codes.length,
      active: codes.filter((c) => c.is_active).length,
      redemptions: codes.reduce((sum, c) => sum + c.redemption_count, 0),
    };
  }

  function formatDiscount(promo: PromoCode): string {
    if (promo.promo_type === 'bundle') {
      const dollars = promo.fixed_price_cents ? (promo.fixed_price_cents / 100).toFixed(2) : '0.00';
      return `$${dollars} bundle`;
    }
    return `${promo.percent_off ?? 0}%`;
  }

  function formatDuration(promo: PromoCode): string {
    if (promo.promo_type === 'bundle') {
      const months = promo.access_months ?? 0;
      const credits = promo.total_credits ?? 0;
      return `${months} mo access · ${credits.toLocaleString()} credits`;
    }
    if (promo.duration_kind === 'forever') return 'Forever';
    if (promo.duration_kind === 'once') return 'One-time';
    return `${promo.duration_months} month${promo.duration_months! > 1 ? 's' : ''}`;
  }

  function setPromoType(type: 'percent' | 'bundle') {
    formData.value.promo_type = type;
    if (type === 'bundle') {
      formData.value.allowed_org_tiers = [];
      formData.value.allowed_credit_packs = [];
    }
  }

  function usageClass(promo: PromoCode): string {
    if (!promo.max_redemptions) return 'text-fg-muted';
    if (promo.redemption_count >= promo.max_redemptions) return 'text-danger';
    if (promo.redemption_count / promo.max_redemptions > 0.8) return 'text-warning';
    return 'text-fg';
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return formatDateTime(dateString);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      showSuccessToast('Copied!', `Discount code "${code}" copied to clipboard`);
    } catch (e) {
      showErrorToast('Failed to copy', 'Unable to copy code to clipboard');
    }
  }

  function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    formData.value.code = code;
  }

  function toggleTier(tier: string) {
    const index = formData.value.allowed_tiers.indexOf(tier);
    if (index === -1) {
      formData.value.allowed_tiers.push(tier);
    } else {
      formData.value.allowed_tiers.splice(index, 1);
    }
  }

  function toggleOrgTier(tier: string) {
    const index = formData.value.allowed_org_tiers.indexOf(tier);
    if (index === -1) {
      formData.value.allowed_org_tiers.push(tier);
    } else {
      formData.value.allowed_org_tiers.splice(index, 1);
    }
  }

  function toggleCreditPack(pack: string) {
    const index = formData.value.allowed_credit_packs.indexOf(pack);
    if (index === -1) {
      formData.value.allowed_credit_packs.push(pack);
    } else {
      formData.value.allowed_credit_packs.splice(index, 1);
    }
  }

  function editPromo(promo: PromoCode) {
    editingPromo.value = promo;
    formData.value = {
      code: promo.code,
      name: promo.name || '',
      promo_type: promo.promo_type || 'percent',
      percent_off: promo.percent_off ?? 10,
      fixed_price_usd: promo.fixed_price_cents ? promo.fixed_price_cents / 100 : null,
      access_months: promo.access_months ?? 12,
      total_credits: promo.total_credits ?? 0,
      duration_kind: promo.duration_kind,
      duration_months: promo.duration_months || 3,
      allowed_tiers: [...promo.allowed_tiers],
      allowed_org_tiers: [...(promo.allowed_org_tiers || [])],
      allowed_credit_packs: [...(promo.allowed_credit_packs || [])],
      max_redemptions: promo.max_redemptions,
      redeem_by: promo.redeem_by || '',
      notes: promo.notes || '',
    };
    errors.value = {};
    showCreateModal.value = true;
  }

  async function viewPromo(promo: PromoCode) {
    const response = await promoCodesApi.getPromoCode(promo.id);

    if (response.success && response.promo) {
      viewingPromo.value = response.promo;
    } else {
      showErrorToast('Failed to load', response.error || 'Could not load promo code details');
    }
  }

  function closeCreateModal() {
    showCreateModal.value = false;
    editingPromo.value = null;
    resetForm();
  }

  async function savePromoCode() {
    errors.value = {};
    saving.value = true;

    if (!formData.value.code.trim()) {
      errors.value.code = 'Code is required';
      saving.value = false;
      return;
    }

    if (formData.value.promo_type === 'bundle') {
      if (!formData.value.allowed_tiers.length) {
        errors.value.allowed_tiers = 'Bundle deals require at least one user subscription tier';
        saving.value = false;
        return;
      }
      if (!formData.value.fixed_price_usd || formData.value.fixed_price_usd <= 0) {
        errors.value.fixed_price_usd = 'Fixed price is required';
        saving.value = false;
        return;
      }
      if (!formData.value.access_months || formData.value.access_months <= 0) {
        errors.value.access_months = 'Access duration is required';
        saving.value = false;
        return;
      }
      if (formData.value.total_credits === null || formData.value.total_credits < 0) {
        errors.value.total_credits = 'Total credits is required';
        saving.value = false;
        return;
      }
    } else if (!formData.value.allowed_tiers.length && !formData.value.allowed_org_tiers.length && !formData.value.allowed_credit_packs.length) {
      errors.value.allowed_tiers = 'At least one tier, organization tier, or credit pack must be selected';
      saving.value = false;
      return;
    }

    try {
      let response;
      if (editingPromo.value) {
        response = await promoCodesApi.updatePromoCode(editingPromo.value.id, {
          name: formData.value.name || undefined,
          max_redemptions: formData.value.max_redemptions || undefined,
          redeem_by: formData.value.redeem_by || undefined,
          notes: formData.value.notes || undefined,
        });
      } else {
        // Helper to convert numeric fields properly
        const toNumberOrUndefined = (val: any) => {
          if (val === null || val === undefined || val === '') return undefined;
          const num = Number(val);
          return isNaN(num) ? undefined : num;
        };

        const payload: any = {
          code: formData.value.code.toUpperCase().trim(),
          name: formData.value.name || undefined,
          promo_type: formData.value.promo_type,
          allowed_tiers: formData.value.allowed_tiers,
          max_redemptions: toNumberOrUndefined(formData.value.max_redemptions),
          redeem_by: formData.value.redeem_by || undefined,
          notes: formData.value.notes || undefined,
        };

        if (formData.value.promo_type === 'bundle') {
          payload.fixed_price_cents = Math.round((formData.value.fixed_price_usd || 0) * 100);
          payload.access_months = toNumberOrUndefined(formData.value.access_months);
          payload.total_credits = toNumberOrUndefined(formData.value.total_credits);
        } else {
          payload.percent_off = formData.value.percent_off;
          payload.duration_kind = formData.value.duration_kind;
          payload.duration_months = formData.value.duration_kind === 'repeating'
            ? toNumberOrUndefined(formData.value.duration_months)
            : undefined;
          payload.allowed_org_tiers = formData.value.allowed_org_tiers;
          payload.allowed_credit_packs = formData.value.allowed_credit_packs;
        }

        response = await promoCodesApi.createPromoCode(payload);
      }

      if (response.success) {
        showSuccessToast(
          editingPromo.value ? 'Updated!' : 'Created!',
          editingPromo.value ? 'Discount code updated successfully' : 'Discount code created successfully'
        );
        closeCreateModal();
        await fetchPromoCodes();
      } else {
        error.value = response.error || 'Failed to save discount code';
        showErrorToast('Failed to save', error.value);
      }
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'An error occurred';
      showErrorToast('Failed to save', error.value);
    } finally {
      saving.value = false;
    }
  }

  async function togglePromo(promo: PromoCode) {
    try {
      const response = await promoCodesApi.togglePromoCode(promo.id, !promo.is_active);

      if (response.success) {
        const action = !promo.is_active ? 'Activated' : 'Deactivated';
        showSuccessToast(action + '!', `Discount code has been ${action}`);
        await fetchPromoCodes();
      } else {
        showErrorToast('Failed to toggle', response.error || 'Could not toggle discount code status');
      }
    } catch (e: any) {
      showErrorToast('Failed to toggle', e.message || 'An error occurred');
    }
  }

  function resetForm() {
    formData.value = {
      code: '',
      name: '',
      promo_type: 'percent',
      percent_off: 10,
      fixed_price_usd: null,
      access_months: 12,
      total_credits: 0,
      duration_kind: 'repeating',
      duration_months: 3,
      allowed_tiers: [],
      allowed_org_tiers: [],
      allowed_credit_packs: [],
      max_redemptions: null,
      redeem_by: '',
      notes: '',
    };
    errors.value = {};
  }

  onMounted(async () => {
    await fetchPromoCodes();
  });
</script>
