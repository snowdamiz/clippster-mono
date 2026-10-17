<template>
  <PageLayout
    title="Affiliate dashboard"
    description="Track your referrals, commissions, and payouts"
    :show-header="true"
    :icon="Handshake"
  >
    <!-- Loading: .skeleton blocks only, shaped like the loaded layout -->
    <div v-if="loading && !dashboard" class="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-5 py-4" aria-busy="true">
      <div class="flex items-center gap-6 border-b border-line-subtle pb-4">
        <div class="flex flex-1 flex-col gap-1.5">
          <div class="skeleton h-3 w-24" />
          <div class="skeleton h-5 w-36" />
        </div>
        <div class="skeleton h-9 w-72" />
      </div>
      <div class="flex flex-col gap-2.5">
        <div class="skeleton h-3.5 w-32" />
        <div class="skeleton h-[74px] rounded-[var(--radius-card)]" />
      </div>
      <div class="flex flex-col gap-2.5">
        <div class="skeleton h-3.5 w-32" />
        <div class="skeleton h-40 rounded-[var(--radius-card)]" />
      </div>
    </div>

    <!-- Error -->
    <EmptyState
      v-else-if="error"
      :icon="AlertTriangle"
      tone="danger"
      title="Something went wrong"
      :description="error"
    >
      <Button variant="secondary" @click="fetchAll">
        <RefreshCw />
        Retry
      </Button>
    </EmptyState>

    <div
      v-else-if="affiliateInfo && dashboard"
      class="mx-auto flex w-full max-w-[1120px] animate-enter flex-col gap-6 px-5 py-4"
    >
      <!-- Header: referral code + sign-up figures, flat on the panel -->
      <section class="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-line-subtle pb-4">
        <div class="flex min-w-0 flex-[1_1_320px] items-center gap-3">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-xs text-fg-muted">
              <Hash class="size-3.5 text-fg-subtle" />
              Your referral code
              <Badge :variant="affiliateStatusVariant(affiliateInfo.status)" class="capitalize">
                {{ affiliateInfo.status }}
              </Badge>
            </p>
            <code class="mt-0.5 block truncate font-mono text-base font-semibold text-fg">
              {{ affiliateInfo.referral_code }}
            </code>
          </div>
          <Button variant="secondary" size="sm" class="shrink-0" @click="copyCode">
            <Check v-if="copied" class="text-success" />
            <Copy v-else />
            {{ copied ? 'Copied' : 'Copy' }}
          </Button>
        </div>

        <StatGrid v-if="dashboard.breakdown" size="sm" class="w-full max-w-[420px]">
          <StatCard
            label="First-time sign-ups"
            :value="dashboard.breakdown.first_subscription?.count || 0"
            :icon="UserPlus"
          />
          <StatCard label="Recurring sign-ups" :value="dashboard.breakdown.recurring?.count || 0" :icon="RefreshCw" />
          <StatCard label="Total sign-ups" :value="getTotalSignups()" :icon="Users" />
        </StatGrid>
      </section>

      <!-- Earnings -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Commission earned" />
        <StatGrid :count="4">
          <StatCard label="This month" :value="`$${dashboard.this_month.total.toFixed(2)}`" :icon="TrendingUp" />
          <StatCard label="Last 3 months" :value="`$${dashboard.three_months.total.toFixed(2)}`" :icon="BarChart3" />
          <StatCard label="Year to date" :value="`$${dashboard.ytd.total.toFixed(2)}`" :icon="CalendarDays" />
          <StatCard label="All time" :value="`$${dashboard.all_time.total.toFixed(2)}`" :icon="DollarSign" />
        </StatGrid>
      </section>

      <!-- Recent referrals -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Recent referrals" description="Commission earned from referred users" />
        <DataTable
          :columns="referralColumns"
          :rows="referrals"
          :row-key="(r) => r.id"
          :empty-icon="Handshake"
          empty-title="No referrals yet"
          empty-description="Share your code to start earning commissions"
        >
          <template #cell-date="{ row }">
            <span class="tabular whitespace-nowrap text-fg-muted">{{ formatDate(row.inserted_at) }}</span>
          </template>
          <template #cell-type="{ row }">
            <Badge variant="neutral">{{ formatEventType(row.event_type) }}</Badge>
          </template>
          <template #cell-amount="{ row }">
            <span class="tabular text-fg">${{ row.amount_usd.toFixed(2) }}</span>
          </template>
          <template #cell-commission="{ row }">
            <span class="tabular font-medium text-success">${{ row.commission_usd.toFixed(2) }}</span>
          </template>
          <template #cell-status="{ row }">
            <Badge :variant="payoutStatusVariant(row.status)" class="capitalize">{{ row.status }}</Badge>
          </template>
        </DataTable>
      </section>

      <!-- Payout history -->
      <section v-if="payouts.length > 0" class="flex flex-col gap-2.5">
        <SectionHeader title="Payout history" description="Your commission payouts" />
        <DataTable :columns="payoutColumns" :rows="payouts" :row-key="(p) => p.id">
          <template #cell-period="{ row }">
            <span class="tabular text-fg-muted">{{ row.period_month }}/{{ row.period_year }}</span>
          </template>
          <template #cell-amount="{ row }">
            <span class="tabular font-medium text-success">${{ row.amount_usd.toFixed(2) }}</span>
          </template>
          <template #cell-method="{ row }">
            <span class="capitalize text-fg-muted">{{ row.payout_method }}</span>
          </template>
          <template #cell-status="{ row }">
            <Badge :variant="payoutStatusVariant(row.status)" class="capitalize">{{ row.status }}</Badge>
          </template>
          <template #cell-paid="{ row }">
            <span class="tabular whitespace-nowrap text-fg-muted">{{ row.paid_at ? formatDate(row.paid_at) : '—' }}</span>
          </template>
        </DataTable>
      </section>

      <!-- Payout settings -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Payout settings" description="Configure how you receive commissions" />
        <div class="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line-subtle bg-surface p-4">
          <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            <Field label="Payout method">
              <CustomDropdown
                v-model="settingsForm.payout_method"
                :options="payoutMethodOptions"
                placeholder="Select method…"
              />
            </Field>
            <Field v-if="settingsForm.payout_method === 'crypto'" label="Solana USDC address" for="aff-solana-address">
              <Input
                id="aff-solana-address"
                v-model="settingsForm.solana_usdc_address"
                type="text"
                placeholder="Enter your Solana USDC address"
              />
            </Field>
            <Field v-if="settingsForm.payout_method === 'paypal'" label="PayPal email" for="aff-paypal-email">
              <Input
                id="aff-paypal-email"
                v-model="settingsForm.paypal_email"
                type="email"
                placeholder="Enter your PayPal email"
              />
            </Field>
          </div>
          <div class="flex justify-end">
            <Button variant="primary" size="sm" :loading="savingSettings" @click="handleSaveSettings">Save settings</Button>
          </div>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Handshake,
    AlertTriangle,
    Hash,
    Copy,
    Check,
    TrendingUp,
    BarChart3,
    DollarSign,
    UserPlus,
    RefreshCw,
    CalendarDays,
    Users,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import { Badge, type BadgeVariants } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import {
    getMyDashboard,
    getMyReferrals,
    getMyPayouts,
    updateMySettings,
    type AffiliateDashboard,
    type AffiliateReferral,
    type AffiliatePayout,
  } from '@/services/affiliateApi';

  const loading = ref(true);
  const error = ref<string | null>(null);
  const copied = ref(false);
  const savingSettings = ref(false);

  const affiliateInfo = ref<{
    id: number;
    referral_code: string;
    status: string;
    payout_method: string | null;
    solana_usdc_address: string | null;
    paypal_email: string | null;
  } | null>(null);

  const dashboard = ref<AffiliateDashboard | null>(null);
  const referrals = ref<AffiliateReferral[]>([]);
  const payouts = ref<AffiliatePayout[]>([]);

  const settingsForm = reactive({
    payout_method: '',
    solana_usdc_address: '',
    paypal_email: '',
  });

  const referralColumns: DataTableColumn[] = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'commission', label: 'Commission' },
    { key: 'status', label: 'Status' },
  ];

  const payoutColumns: DataTableColumn[] = [
    { key: 'period', label: 'Period' },
    { key: 'amount', label: 'Amount' },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status' },
    { key: 'paid', label: 'Paid' },
  ];

  const payoutMethodOptions = [
    { label: 'Crypto (Solana USDC)', value: 'crypto' },
    { label: 'PayPal', value: 'paypal' },
  ];

  function affiliateStatusVariant(status: string): BadgeVariants['variant'] {
    if (status === 'active') return 'success';
    if (status === 'suspended') return 'warning';
    if (status === 'deactivated') return 'danger';
    return 'neutral';
  }

  function payoutStatusVariant(status: string): BadgeVariants['variant'] {
    if (status === 'paid' || status === 'completed') return 'success';
    if (status === 'confirmed') return 'brand';
    if (status === 'pending') return 'warning';
    if (status === 'cancelled') return 'danger';
    return 'neutral';
  }

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      const [dashResult, refResult, payResult] = await Promise.all([
        getMyDashboard(),
        getMyReferrals(),
        getMyPayouts(),
      ]);

      if (dashResult.success) {
        affiliateInfo.value = dashResult.affiliate!;
        dashboard.value = dashResult.dashboard!;
        settingsForm.payout_method = dashResult.affiliate?.payout_method || '';
        settingsForm.solana_usdc_address = dashResult.affiliate?.solana_usdc_address || '';
        settingsForm.paypal_email = dashResult.affiliate?.paypal_email || '';
      } else {
        error.value = dashResult.error || 'Failed to load dashboard';
      }

      if (refResult.success) referrals.value = refResult.referrals;
      if (payResult.success) payouts.value = payResult.payouts;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function copyCode() {
    if (!affiliateInfo.value) return;
    const code = affiliateInfo.value.referral_code;
    try {
      await navigator.clipboard.writeText(code);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    } catch {
      const input = document.createElement('input');
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    }
  }

  async function handleSaveSettings() {
    savingSettings.value = true;
    error.value = null;
    try {
      const result = await updateMySettings({
        payout_method: settingsForm.payout_method || undefined,
        solana_usdc_address: settingsForm.solana_usdc_address || undefined,
        paypal_email: settingsForm.paypal_email || undefined,
      });
      if (!result.success) error.value = result.error || 'Failed to save settings';
    } catch (e: any) {
      error.value = e.message;
    } finally {
      savingSettings.value = false;
    }
  }

  function getTotalSignups() {
    if (!dashboard.value?.breakdown) return 0;
    const firstTime = dashboard.value.breakdown.first_subscription?.count || 0;
    const recurring = dashboard.value.breakdown.recurring?.count || 0;
    return firstTime + recurring;
  }

  function formatDate(dateStr: string) {
    return fmtDate(dateStr);
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
    fetchAll();
  });
</script>
