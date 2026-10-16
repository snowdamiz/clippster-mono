<template>
  <PageLayout
    :title="affiliate ? affiliate.referral_code : 'Affiliate'"
    description="Detailed affiliate information and management"
    :icon="Handshake"
    :breadcrumbs="[
      { label: 'Admin', path: '/admin' },
      { label: 'Affiliates', path: '/admin/affiliates' },
      { label: affiliate?.referral_code || 'Detail' },
    ]"
  >
    <!-- Loading -->
    <div v-if="loading && !affiliate" class="flex flex-col gap-4 px-5 py-4" aria-busy="true">
      <div class="flex items-center gap-3.5 border-b border-line-subtle pb-4">
        <div class="skeleton size-10 rounded-lg" />
        <div class="flex flex-col gap-2">
          <div class="skeleton h-4 w-40" />
          <div class="skeleton h-3 w-28" />
        </div>
      </div>
      <div class="grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_300px]">
        <div class="skeleton h-72 rounded-[var(--radius-card)]" />
        <div class="skeleton h-40 rounded-[var(--radius-card)]" />
      </div>
    </div>

    <!-- Error -->
    <EmptyState v-else-if="error" :icon="AlertTriangle" tone="danger" title="Failed to load affiliate" :description="error">
      <Button variant="secondary" @click="fetchAffiliate">Try again</Button>
    </EmptyState>

    <!-- Main content -->
    <div v-else-if="affiliate" class="@container flex animate-enter flex-col gap-4 px-5 py-4">
      <AdminDetailHeader
        :title="affiliate.referral_code"
        :subtitle="affiliate.user?.name || affiliate.user?.email || 'No user info'"
        :icon="Handshake"
        avatar-shape="square"
        :stats="[
          { label: 'Referrals', value: referrals.length },
          { label: 'Earned', value: `$${totalEarned}` },
          { label: 'Pending', value: `$${totalPending}` },
        ]"
      >
        <template #badges>
          <Badge :variant="statusVariant(affiliate.status)">{{ formatStatus(affiliate.status) }}</Badge>
        </template>
        <template #meta>
          <span>Created {{ formatDate(affiliate.inserted_at) }}</span>
          <span v-if="affiliate.user?.id">User #{{ affiliate.user.id }}</span>
        </template>
        <template #actions>
          <Button variant="ghost" size="sm" :title="refCodeCopied ? 'Copied!' : 'Copy code'" @click="copyRefCode">
            <Check v-if="refCodeCopied" />
            <Copy v-else />
            {{ refCodeCopied ? 'Copied' : 'Copy code' }}
          </Button>
          <Button v-if="affiliate.status !== 'active'" variant="secondary" size="sm" @click="handleActivate">
            <Check />
            Activate
          </Button>
          <Button v-else variant="secondary" size="sm" @click="handleDeactivate">
            <Ban />
            Deactivate
          </Button>
        </template>
      </AdminDetailHeader>

      <div class="grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_300px]">
        <!-- Rates & discounts -->
        <SectionCard title="Commission & discounts" :icon="Percent" body-class="flex flex-col gap-5 py-4">
          <div class="flex flex-col gap-3">
            <p class="eyebrow">Commission</p>
            <div class="grid grid-cols-2 gap-3">
              <Field label="Signup commission (%)">
                <Input v-model="editForm.signup_commission_pct" type="number" step="0.1" />
              </Field>
              <Field label="Recurring commission (%)">
                <Input v-model="editForm.recurring_commission_pct" type="number" step="0.1" />
              </Field>
            </div>
            <label class="flex items-center gap-2 text-sm text-fg">
              <Checkbox v-model="editForm.credit_pack_commission_enabled" />
              Enable credit pack commission
            </label>
            <Field v-if="editForm.credit_pack_commission_enabled" label="Credit pack commission (%)" class="max-w-[50%]">
              <Input v-model="editForm.credit_pack_commission_pct" type="number" step="0.1" />
            </Field>
            <Field label="Notes">
              <Textarea v-model="editForm.notes" rows="3" />
            </Field>
          </div>

          <div class="flex flex-col gap-3 border-t border-line-subtle pt-4">
            <p class="eyebrow">Referred-user discount</p>
            <Field inline label="Discount for referred users" hint="Applied to subscriptions bought with this code">
              <Switch v-model="editForm.discount_enabled" aria-label="Discount for referred users" />
            </Field>

            <template v-if="editForm.discount_enabled">
              <Field label="Discount type">
                <CustomDropdown v-model="editForm.discount_type" :options="discountTypeOptions" placeholder="Select type…" />
              </Field>
              <div class="grid grid-cols-2 gap-3">
                <Field
                  v-if="editForm.discount_type === 'one_time' || editForm.discount_type === 'tiered'"
                  label="First month discount (%)"
                  hint="Applied to the first month's subscription"
                >
                  <Input v-model="editForm.first_month_discount_pct" type="number" step="0.1" min="0" max="100" placeholder="e.g. 10" />
                </Field>
                <Field
                  v-if="editForm.discount_type === 'recurring' || editForm.discount_type === 'tiered'"
                  label="Recurring discount (%)"
                  :hint="editForm.discount_type === 'tiered' ? 'Applied to subsequent months' : 'Applied every month'"
                >
                  <Input v-model="editForm.recurring_discount_pct" type="number" step="0.1" min="0" max="100" placeholder="e.g. 5" />
                </Field>
              </div>

              <div v-if="editForm.discount_type" class="text-sm">
                <p class="mb-1 text-xs font-medium text-fg-muted">Preview</p>
                <ul class="flex flex-col gap-1 text-fg-muted">
                  <template v-if="editForm.discount_type === 'one_time'">
                    <li>First month: <span class="font-medium text-success">{{ editForm.first_month_discount_pct || 0 }}% off</span></li>
                    <li>Subsequent months: <span class="font-medium text-fg">Full price</span></li>
                  </template>
                  <li v-else-if="editForm.discount_type === 'recurring'">
                    Every month: <span class="font-medium text-success">{{ editForm.recurring_discount_pct || 0 }}% off</span>
                  </li>
                  <template v-else-if="editForm.discount_type === 'tiered'">
                    <li>First month: <span class="font-medium text-success">{{ editForm.first_month_discount_pct || 0 }}% off</span></li>
                    <li>Subsequent months: <span class="font-medium text-success">{{ editForm.recurring_discount_pct || 0 }}% off</span></li>
                  </template>
                </ul>
              </div>
            </template>
          </div>

          <template #footer>
            <Button variant="primary" size="sm" :loading="saving" :disabled="saving" @click="handleSave">Save changes</Button>
          </template>
        </SectionCard>

        <!-- Side column -->
        <aside class="flex min-w-0 flex-col gap-4">
          <SectionCard title="Payout info" :icon="Wallet" body-class="py-1">
            <InfoRow label="Method"><span class="capitalize">{{ affiliate.payout_method || 'Not set' }}</span></InfoRow>
            <InfoRow v-if="affiliate.payout_method === 'crypto'" label="USDC address" mono>
              <span class="truncate" :title="affiliate.solana_usdc_address || undefined">{{ affiliate.solana_usdc_address || 'Not set' }}</span>
            </InfoRow>
            <InfoRow v-if="affiliate.payout_method === 'paypal'" label="PayPal email">
              <span class="truncate">{{ affiliate.paypal_email || 'Not set' }}</span>
            </InfoRow>
          </SectionCard>

          <SectionCard title="Details" :icon="Info" body-class="py-1">
            <InfoRow label="Affiliate ID" mono>{{ affiliate.id }}</InfoRow>
            <InfoRow label="User ID" mono>{{ affiliate.user?.id }}</InfoRow>
            <InfoRow label="Created">{{ formatFullDate(affiliate.inserted_at) }}</InfoRow>
            <InfoRow v-if="affiliate.updated_at" label="Last updated">{{ formatFullDate(affiliate.updated_at) }}</InfoRow>
          </SectionCard>

          <SectionCard title="Record payout" :icon="DollarSign" body-class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-3">
              <Field label="Month">
                <Input v-model="payoutForm.period_month" type="number" min="1" max="12" />
              </Field>
              <Field label="Year">
                <Input v-model="payoutForm.period_year" type="number" min="2025" />
              </Field>
            </div>
            <Field label="Manual amount (USD)" hint="Only for testing or manual payouts without commissions">
              <Input
                :model-value="payoutForm.manual_amount ?? ''"
                type="number"
                step="0.01"
                min="0"
                placeholder="Calculated amount"
                @update:model-value="(v) => (payoutForm.manual_amount = v === '' ? null : Number(v))"
              />
            </Field>
            <Field label="Transaction ID">
              <Input v-model="payoutForm.transaction_id" placeholder="Tx hash or PayPal ID" />
            </Field>
            <Field label="Proof screenshot">
              <input
                type="file"
                accept="image/*"
                class="block w-full text-xs text-fg-muted file:mr-2.5 file:h-7 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-surface-raised file:px-2.5 file:text-xs file:font-medium file:text-fg hover:file:bg-surface-hover"
                @change="handleScreenshotChange"
              />
            </Field>
            <Field label="Notes">
              <Textarea v-model="payoutForm.notes" rows="2" placeholder="Optional notes…" />
            </Field>
            <template #footer>
              <Button variant="secondary" size="sm" :loading="payingOut" :disabled="payingOut" @click="handleRecordPayout">
                Record payout
              </Button>
            </template>
          </SectionCard>
        </aside>
      </div>

      <!-- Referrals -->
      <SectionCard v-if="referrals.length > 0" title="Referrals" :count="referrals.length" :icon="Users" flush>
        <DataTable :columns="referralColumns" :rows="referrals" row-key="id" bare>
          <template #cell-date="{ row: r }">
            <span class="truncate text-xs text-fg-muted">{{ formatDate(r.inserted_at) }}</span>
          </template>
          <template #cell-type="{ row: r }">
            <Badge variant="neutral">{{ formatEventType(r.event_type) }}</Badge>
          </template>
          <template #cell-user="{ row: r }">
            <span class="block truncate">{{ r.referred_user?.email || r.referred_user?.name || 'N/A' }}</span>
          </template>
          <template #cell-amount="{ row: r }">
            <span class="tabular">${{ r.amount_usd.toFixed(2) }}</span>
          </template>
          <template #cell-rate="{ row: r }">
            <span class="tabular text-fg-muted">{{ r.commission_pct }}%</span>
          </template>
          <template #cell-commission="{ row: r }">
            <span class="tabular text-success">${{ r.commission_usd.toFixed(2) }}</span>
          </template>
          <template #cell-status="{ row: r }">
            <Badge :variant="statusVariant(r.status)">{{ formatStatus(r.status) }}</Badge>
          </template>
        </DataTable>
      </SectionCard>

      <!-- Payouts -->
      <SectionCard v-if="payouts.length > 0" title="Payout history" :count="payouts.length" :icon="CreditCard" flush>
        <DataTable :columns="payoutColumns" :rows="payouts" row-key="id" bare>
          <template #cell-period="{ row: p }">
            <span class="tabular">{{ p.period_month }}/{{ p.period_year }}</span>
          </template>
          <template #cell-amount="{ row: p }">
            <span class="tabular text-success">${{ p.amount_usd.toFixed(2) }}</span>
          </template>
          <template #cell-method="{ row: p }">
            <span class="truncate capitalize text-fg-muted">{{ p.payout_method }}</span>
          </template>
          <template #cell-transaction="{ row: p }">
            <code class="block truncate font-mono text-xs text-fg-muted" :title="p.transaction_id || undefined">
              {{ p.transaction_id || '—' }}
            </code>
          </template>
          <template #cell-status="{ row: p }">
            <Badge :variant="statusVariant(p.status)">{{ formatStatus(p.status) }}</Badge>
          </template>
          <template #cell-paid="{ row: p }">
            <span class="truncate text-xs text-fg-muted">{{ p.paid_at ? formatDate(p.paid_at) : '—' }}</span>
          </template>
          <template #cell-proof="{ row: p }">
            <a
              v-if="p.proof_screenshot_url"
              :href="p.proof_screenshot_url"
              target="_blank"
              :class="buttonVariants({ variant: 'link', size: 'sm' })"
            >
              View
            </a>
            <span v-else class="text-fg-subtle">—</span>
          </template>
        </DataTable>
      </SectionCard>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { confirmDialog } from '@/composables/useDialogs';
  import { ref, reactive, onMounted, computed } from 'vue';
  import { useRoute } from 'vue-router';
  import { formatDate as fmtDate, formatDateTime } from '@/utils/dateTimeUtils';
  import {
    Handshake,
    AlertTriangle,
    Ban,
    Check,
    DollarSign,
    Percent,
    Users,
    CreditCard,
    Wallet,
    Info,
    Copy,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import {
    AdminDetailHeader,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import { SectionCard } from '@/components/ui/section-card';
  import { InfoRow } from '@/components/ui/info-list';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import {
    getAffiliate,
    updateAffiliate,
    deactivateAffiliate,
    activateAffiliate,
    recordPayout,
    type Affiliate,
    type AffiliateReferral,
    type AffiliatePayout,
  } from '@/services/affiliateApi';

  const route = useRoute();
  const affiliateId = Number(route.params.id);

  const loading = ref(true);
  const saving = ref(false);
  const payingOut = ref(false);
  const error = ref<string | null>(null);
  const affiliate = ref<Affiliate | null>(null);
  const referrals = ref<AffiliateReferral[]>([]);
  const payouts = ref<AffiliatePayout[]>([]);
  const refCodeCopied = ref(false);

  const referralColumns: DataTableColumn[] = [
    { key: 'date', label: 'Date', width: '104px' },
    { key: 'type', label: 'Type', width: '104px' },
    { key: 'user', label: 'User' },
    { key: 'amount', label: 'Amount', width: '88px', align: 'right' },
    { key: 'rate', label: 'Rate', width: '64px', align: 'right', hideBelow: 'md' },
    { key: 'commission', label: 'Commission', width: '104px', align: 'right' },
    { key: 'status', label: 'Status', width: '100px' },
  ];

  const payoutColumns: DataTableColumn[] = [
    { key: 'period', label: 'Period', width: '80px' },
    { key: 'amount', label: 'Amount', width: '96px', align: 'right' },
    { key: 'method', label: 'Method', width: '96px' },
    { key: 'transaction', label: 'Transaction ID', hideBelow: 'md' },
    { key: 'status', label: 'Status', width: '100px' },
    { key: 'paid', label: 'Paid', width: '104px' },
    { key: 'proof', label: 'Proof', width: '64px' },
  ];

  const discountTypeOptions = [
    { label: 'Select type…', value: '' },
    { label: 'One-time (first month only)', value: 'one_time' },
    { label: 'Recurring (every month)', value: 'recurring' },
    { label: 'Tiered (different first & recurring)', value: 'tiered' },
  ];

  const totalEarned = computed(() => {
    return referrals.value
      .filter(r => r.status === 'confirmed')
      .reduce((sum, r) => sum + (r.commission_usd || 0), 0)
      .toFixed(2);
  });

  const totalPending = computed(() => {
    return referrals.value
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + (r.commission_usd || 0), 0)
      .toFixed(2);
  });

  async function copyRefCode() {
    if (!affiliate.value) return;
    try {
      await navigator.clipboard.writeText(affiliate.value.referral_code);
      refCodeCopied.value = true;
      setTimeout(() => { refCodeCopied.value = false; }, 2000);
    } catch {
      // Fallback
    }
  }

  const editForm = reactive({
    signup_commission_pct: 0,
    recurring_commission_pct: 0,
    credit_pack_commission_enabled: false,
    credit_pack_commission_pct: 0,
    notes: '',
    discount_enabled: false,
    discount_type: '',
    first_month_discount_pct: 0,
    recurring_discount_pct: 0,
  });

  const now = new Date();
  const payoutForm = reactive({
    period_month: now.getMonth() === 0 ? 12 : now.getMonth(),
    period_year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    manual_amount: null as number | null,
    transaction_id: '',
    notes: '',
    screenshot: null as File | null,
  });

  async function fetchAffiliate() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getAffiliate(affiliateId);
      if (result.success && result.affiliate) {
        affiliate.value = result.affiliate;
        referrals.value = result.referrals || [];
        payouts.value = result.payouts || [];
        editForm.signup_commission_pct = result.affiliate.signup_commission_pct;
        editForm.recurring_commission_pct = result.affiliate.recurring_commission_pct;
        editForm.credit_pack_commission_enabled = result.affiliate.credit_pack_commission_enabled;
        editForm.credit_pack_commission_pct = result.affiliate.credit_pack_commission_pct;
        editForm.notes = result.affiliate.notes || '';
        editForm.discount_enabled = result.affiliate.discount_enabled || false;
        editForm.discount_type = result.affiliate.discount_type || '';
        editForm.first_month_discount_pct = result.affiliate.first_month_discount_pct || 0;
        editForm.recurring_discount_pct = result.affiliate.recurring_discount_pct || 0;
      } else {
        error.value = result.error || 'Affiliate not found';
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function handleSave() {
    saving.value = true;
    error.value = null;
    try {
      const result = await updateAffiliate(affiliateId, {
        signup_commission_pct: editForm.signup_commission_pct,
        recurring_commission_pct: editForm.recurring_commission_pct,
        credit_pack_commission_enabled: editForm.credit_pack_commission_enabled,
        credit_pack_commission_pct: editForm.credit_pack_commission_pct,
        notes: editForm.notes,
        discount_enabled: editForm.discount_enabled,
        discount_type: editForm.discount_type,
        first_month_discount_pct: editForm.first_month_discount_pct,
        recurring_discount_pct: editForm.recurring_discount_pct,
      });
      if (!result.success) error.value = result.error || 'Failed to save';
      else await fetchAffiliate();
    } catch (e: any) {
      error.value = e.message;
    } finally {
      saving.value = false;
    }
  }

  async function handleDeactivate() {
    if (!(await confirmDialog({ title: 'Deactivate affiliate?', message: 'Their code stops earning commission until reactivated.', confirmText: 'Deactivate', variant: 'destructive' }))) return;
    try {
      const result = await deactivateAffiliate(affiliateId);
      if (result.success) await fetchAffiliate();
      else error.value = result.error || 'Failed to deactivate';
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function handleActivate() {
    try {
      const result = await activateAffiliate(affiliateId);
      if (result.success) await fetchAffiliate();
      else error.value = result.error || 'Failed to activate';
    } catch (e: any) {
      error.value = e.message;
    }
  }

  function handleScreenshotChange(e: Event) {
    const target = e.target as HTMLInputElement;
    payoutForm.screenshot = target.files?.[0] || null;
  }

  async function handleRecordPayout() {
    payingOut.value = true;
    error.value = null;
    try {
      const result = await recordPayout(affiliateId, {
        period_month: payoutForm.period_month,
        period_year: payoutForm.period_year,
        manual_amount: payoutForm.manual_amount || undefined,
        transaction_id: payoutForm.transaction_id || undefined,
        notes: payoutForm.notes || undefined,
        screenshot: payoutForm.screenshot || undefined,
      });
      if (result.success) {
        payoutForm.manual_amount = null;
        payoutForm.transaction_id = '';
        payoutForm.notes = '';
        payoutForm.screenshot = null;
        await fetchAffiliate();
      } else {
        error.value = result.error || 'Failed to record payout';
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      payingOut.value = false;
    }
  }

  function formatDate(dateStr: string) {
    return fmtDate(dateStr);
  }

  function formatFullDate(dateStr: string) {
    return formatDateTime(dateStr);
  }

  function formatEventType(type: string) {
    const map: Record<string, string> = {
      first_subscription: 'Signup',
      recurring: 'Recurring',
      credit_pack: 'Credit Pack',
    };
    return map[type] || type;
  }

  onMounted(() => {
    fetchAffiliate();
  });
</script>
