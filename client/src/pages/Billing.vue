<template>
  <PageLayout
    title="Billing"
    description="Manage your subscription and view payment history"
    :show-header="true"
    :icon="Receipt"
  >
    <!-- Not authenticated -->
    <EmptyState
      v-if="!authStore.isAuthenticated"
      :icon="Receipt"
      title="Sign in to view billing"
      description="Access your subscription details and payment history"
    />

    <div v-else class="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-5 py-4">
      <!-- Subscription gate banner -->
      <Alert v-if="isSubscriptionGateMode" :variant="isExpiredSubscription ? 'warning' : 'info'">
        <AlertCircle />
        <AlertTitle>
          {{ isExpiredSubscription ? 'Your subscription has expired' : 'Welcome to Clippster!' }}
        </AlertTitle>
        <AlertDescription>
          {{
            isExpiredSubscription
              ? 'Please renew your subscription or continue with the free tier to regain access.'
              : 'Choose a plan to get started with Clippster.'
          }}
        </AlertDescription>
      </Alert>

      <!-- Summary: current plan + credit figures, flat on the panel -->
      <section class="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-line-subtle pb-4">
        <!-- Current plan -->
        <div class="flex min-w-0 flex-[1_1_320px] items-center gap-3">
          <IconTile
            :icon="!loadingBalance && hasActiveSubscription ? Crown : CreditCard"
            :tone="!loadingBalance && hasActiveSubscription ? 'brand' : 'neutral'"
            size="md"
          />
          <div v-if="loadingBalance" class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="skeleton h-4 w-32" />
            <div class="skeleton h-3 w-44" />
          </div>
          <div v-else class="min-w-0 flex-1 animate-enter">
            <div class="flex min-w-0 items-center gap-2">
              <h2 class="truncate text-base font-semibold text-fg">
                {{ subscriptionStatus?.tier_name || 'No subscription' }}
              </h2>
              <Badge :variant="statusBadgeVariant">{{ statusBadgeText }}</Badge>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
              <template v-if="subscriptionStatus?.status === 'active'">
                <span class="flex items-center gap-1.5">
                  <CalendarCheck class="size-3.5 shrink-0 text-fg-subtle" />
                  Renews {{ formatDate(subscriptionStatus?.end_date) }}
                  <span class="text-fg-subtle">({{ subscriptionStatus?.days_remaining }} days)</span>
                </span>
                <span v-if="subscriptionStatus?.pending_subscription_tier" class="flex items-center gap-1.5 text-warning">
                  <Clock class="size-3.5 shrink-0" />
                  Switching to {{ subscriptionStatus?.pending_subscription_tier_name }} at period end
                  <button
                    type="button"
                    class="font-medium text-brand hover:text-brand-hover hover:underline"
                    @click="cancelPendingChange"
                  >
                    Undo
                  </button>
                </span>
              </template>
              <span v-else-if="subscriptionStatus?.status === 'cancelled'" class="flex items-center gap-1.5 text-warning">
                <Clock class="size-3.5 shrink-0" />
                Access until {{ formatDate(subscriptionStatus?.end_date) }}
              </span>
              <span v-else-if="subscriptionStatus?.status === 'expired'" class="flex items-center gap-1.5 text-danger">
                <AlertCircle class="size-3.5 shrink-0" />
                Expired {{ formatDate(subscriptionStatus?.end_date) }}
              </span>
              <span v-else>Subscribe to unlock Clippster</span>
            </div>
          </div>
          <Button
            v-if="subscriptionStatus?.status === 'active' && !loadingBalance"
            variant="ghost"
            size="sm"
            :disabled="cancellingSubscription"
            @click="showCancelConfirm = true"
          >
            {{ cancellingSubscription ? 'Cancelling…' : 'Cancel plan' }}
          </Button>
        </div>

        <!-- Credit balance (+ organization allocations) -->
        <div class="flex min-w-0 flex-[1_1_320px] items-center gap-3">
          <StatGrid size="sm" class="min-w-0 flex-1">
            <StatCard
              label="Credit balance"
              :value="typeof hoursRemaining === 'number' ? Math.round(hoursRemaining) : 'Unlimited'"
              :hint="typeof hoursRemaining === 'number' ? 'min' : undefined"
              :icon="Coins"
              :loading="loadingBalance"
            />
            <StatCard
              label="Used total"
              :value="Math.round(hoursUsed)"
              hint="min"
              :icon="TrendingUp"
              :loading="loadingBalance"
            />
            <template v-if="!loadingBalance">
              <StatCard
                v-for="alloc in organizationAllocations"
                :key="alloc.organization_id"
                :label="alloc.organization_name"
                :value="Math.round(alloc.hours_remaining)"
                hint="min"
                :icon="Building"
              />
            </template>
          </StatGrid>
          <Button
            v-if="!loadingBalance && typeof hoursRemaining === 'number'"
            variant="secondary"
            size="sm"
            class="shrink-0"
            @click="showBuyCreditsModal = true"
          >
            <Plus />
            Buy credits
          </Button>
        </div>
      </section>

      <!-- Plans -->
      <section class="flex flex-col gap-3">
        <SectionHeader
          :title="!loadingBalance && hasActiveSubscription ? 'Change plan' : 'Choose a plan'"
          description="Select the plan that works best for you"
        >
          <Badge variant="success" class="max-[560px]:hidden">Save 1 month</Badge>
          <SegmentedControl v-model="billingInterval" :options="intervalOptions" size="sm" />
        </SectionHeader>

        <div v-if="loadingTiers" class="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          <PriceCard v-for="i in 4" :key="i" loading />
        </div>
        <div v-else class="flex animate-fade-in flex-col gap-3">
          <div class="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            <PriceCard
              v-for="plan in paidPlans"
              :key="plan.tier.id"
              :name="plan.tier.name"
              :price="plan.price"
              :period="billingInterval === 'yearly' ? '/yr' : '/mo'"
              :price-note="plan.priceNote"
              :credits="plan.credits"
              :credits-label="plan.creditsLabel"
              :features="plan.features"
              :highlighted="plan.recommended && !isCurrentTier(plan.tier.id)"
              :current="isCurrentTier(plan.tier.id)"
              :badge="plan.recommended ? 'Most popular' : undefined"
            >
              <Button
                block
                :variant="plan.recommended && !isCurrentTier(plan.tier.id) && !isPendingTier(plan.tier.id) ? 'primary' : 'secondary'"
                :disabled="isCurrentTier(plan.tier.id) || isPendingTier(plan.tier.id)"
                @click="plan.tier.id === 'basic' ? handleBasicTierClick() : handleTierClick(plan.tier)"
              >
                <template v-if="isCurrentTier(plan.tier.id)">Current plan</template>
                <template v-else-if="isPendingTier(plan.tier.id)">Switching at period end</template>
                <template v-else-if="hasActiveSubscription">Switch plan</template>
                <template v-else>Get started</template>
              </Button>
            </PriceCard>
          </div>

          <!-- Free plan (always available) -->
          <div
            class="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[var(--radius-card)] border border-line-subtle bg-surface px-4 py-3"
          >
            <div class="flex min-w-[150px] flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-fg">Free</h3>
                <Badge v-if="!hasActiveSubscription" variant="success">Current plan</Badge>
              </div>
              <p class="text-xs text-fg-muted">
                <span class="tabular font-semibold text-fg">$0</span>
                · 60 one-time credits
              </p>
            </div>
            <ul class="flex min-w-0 flex-1 basis-[320px] flex-wrap gap-x-4 gap-y-1">
              <li
                v-for="feature in freePlanFeatures"
                :key="feature.label"
                class="flex items-center gap-1.5 text-xs"
                :class="feature.included === false ? 'text-fg-subtle' : 'text-fg-muted'"
              >
                <Check v-if="feature.included !== false" class="size-3.5 shrink-0 text-success" />
                <X v-else class="size-3.5 shrink-0 text-fg-disabled" />
                {{ feature.label }}
              </li>
            </ul>
            <Button
              variant="secondary"
              class="shrink-0"
              :disabled="(!hasActiveSubscription && !isSubscriptionGateMode && !isNewUserFlow) || pendingDowngradeToFree"
              @click="isSubscriptionGateMode || isNewUserFlow ? continueWithFree() : confirmDowngradeToFree()"
            >
              <template v-if="isSubscriptionGateMode || isNewUserFlow">Continue with free plan</template>
              <template v-else-if="!hasActiveSubscription">Current plan</template>
              <template v-else-if="pendingDowngradeToFree">Downgrading at period end</template>
              <template v-else>Switch plan</template>
            </Button>
          </div>
        </div>
      </section>

      <!-- Payment history -->
      <section class="flex flex-col gap-3">
        <SectionHeader title="Payment history" description="Your recent transactions" />
        <DataTable
          :columns="historyColumns"
          :rows="paymentHistory"
          :row-key="(row) => row.id"
          :loading="loadingHistory"
          :skeleton-rows="3"
          :empty-icon="Receipt"
          empty-title="No payment history yet"
          empty-description="Your transactions will appear here"
        >
          <template #cell-date="{ row }">
            <span class="tabular whitespace-nowrap text-fg-muted">{{ formatDate(row.date) }}</span>
          </template>
          <template #cell-type="{ row }">
            <Badge variant="neutral">{{ row.type === 'subscription' ? 'Subscription' : 'Credits' }}</Badge>
          </template>
          <template #cell-description="{ row }">
            <span class="block truncate">{{ row.description }}</span>
          </template>
          <template #cell-amount="{ row }">
            <span class="tabular font-medium text-fg">${{ row.amount.toFixed(2) }}</span>
          </template>
          <template #cell-method="{ row }">
            <span class="flex items-center gap-1.5 capitalize text-fg-muted">
              <CreditCard v-if="row.method === 'stripe'" class="size-3.5 shrink-0 text-fg-subtle" />
              <Wallet v-else class="size-3.5 shrink-0 text-fg-subtle" />
              {{ row.method }}
            </span>
          </template>
          <template #cell-status="{ row }">
            <Badge :variant="getStatusVariant(row.status)" class="capitalize">{{ row.status }}</Badge>
          </template>
        </DataTable>
      </section>

      <!-- Danger zone -->
      <section v-if="authStore.isAuthenticated" class="flex flex-col gap-1 border-t border-line-subtle pt-4">
        <SectionHeader title="Danger zone" description="Irreversible account actions" />
        <SettingRow
          label="Deactivate profile"
          description="Deactivating your profile will cancel any active subscription and disable your account. Your data will be preserved and you can contact support to reactivate."
          tone="danger"
        >
          <Button variant="destructive-soft" size="sm" @click="showDeactivateConfirm = true">Deactivate profile</Button>
        </SettingRow>
      </section>
    </div>

    <!-- Cancel subscription -->
    <Modal
      :open="showCancelConfirm"
      title="Cancel subscription?"
      :icon="AlertTriangle"
      tone="danger"
      size="sm"
      @close="showCancelConfirm = false"
    >
      <div class="flex flex-col gap-2 text-sm text-fg-muted">
        <p>
          Your subscription will remain active until
          <strong class="font-medium text-fg">{{ formatDate(subscriptionStatus?.end_date) }}</strong>. After that,
          you'll lose access to Clippster features.
        </p>
        <p class="text-xs text-fg-subtle">Your credits will remain in your account.</p>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showCancelConfirm = false">Keep subscription</Button>
        <Button variant="destructive" :loading="cancellingSubscription" :disabled="cancellingSubscription" @click="cancelSubscription">
          {{ cancellingSubscription ? 'Cancelling…' : 'Cancel subscription' }}
        </Button>
      </template>
    </Modal>

    <!-- Tier change -->
    <Modal
      :open="showTierChangeConfirm"
      :title="tierChangeIsUpgrade ? 'Upgrade plan' : 'Switch plan'"
      :icon="tierChangeIsUpgrade ? TrendingUp : AlertTriangle"
      :tone="tierChangeIsUpgrade ? 'brand' : 'warning'"
      size="sm"
      @close="showTierChangeConfirm = false"
    >
      <div class="flex flex-col gap-2 text-sm text-fg-muted">
        <p v-if="tierChangeIsUpgrade">
          You'll be upgraded to <strong class="font-medium text-fg">{{ tierChangeTarget?.name }}</strong> immediately. A
          prorated charge will be applied for the remainder of your billing period.
        </p>
        <p v-else>
          Your plan will switch to <strong class="font-medium text-fg">{{ tierChangeTarget?.name }}</strong> at the end
          of your current billing period (<strong class="font-medium text-fg">{{
            formatDate(subscriptionStatus?.end_date)
          }}</strong>). You'll keep your current plan until then.
        </p>
        <p v-if="tierChangeIsUpgrade" class="text-xs text-fg-subtle">
          You'll also receive {{ tierChangeCreditDiff }} additional credits now.
        </p>
        <Alert v-if="tierChangeTarget?.id === 'basic'" variant="destructive" class="mt-1">
          <AlertTriangle />
          <AlertDescription class="text-fg">
            Downgrading to Basic will remove all your AI credits. This cannot be undone.
          </AlertDescription>
        </Alert>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showTierChangeConfirm = false">Cancel</Button>
        <Button
          :variant="tierChangeIsUpgrade ? 'primary' : 'destructive'"
          :loading="changingTier"
          :disabled="changingTier"
          @click="executeTierChange"
        >
          {{ changingTier ? 'Processing…' : tierChangeIsUpgrade ? 'Confirm upgrade' : 'Confirm switch' }}
        </Button>
      </template>
    </Modal>

    <!-- Downgrade to free -->
    <Modal
      :open="showFreeDowngradeConfirm"
      title="Switch to the free plan?"
      :icon="AlertTriangle"
      tone="warning"
      size="sm"
      @close="showFreeDowngradeConfirm = false"
    >
      <div class="flex flex-col gap-2 text-sm text-fg-muted">
        <p>
          Your subscription will be cancelled at the end of your billing period (<strong class="font-medium text-fg">{{
            formatDate(subscriptionStatus?.end_date)
          }}</strong>). You'll keep your current plan until then.
        </p>
        <p class="text-xs text-fg-subtle">
          On the free plan you'll have daily limits and admin watermarks. Your remaining credits will stay in your
          account but you will <strong class="font-medium text-fg-muted">not</strong> receive the 60 free credits again.
        </p>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showFreeDowngradeConfirm = false">Keep current plan</Button>
        <Button
          variant="destructive"
          :loading="cancellingSubscription"
          :disabled="cancellingSubscription"
          @click="executeDowngradeToFree"
        >
          {{ cancellingSubscription ? 'Processing…' : 'Switch to free' }}
        </Button>
      </template>
    </Modal>

    <!-- Deactivate profile -->
    <Modal
      :open="showDeactivateConfirm"
      title="Deactivate profile?"
      :icon="AlertTriangle"
      tone="danger"
      size="sm"
      @close="showDeactivateConfirm = false"
    >
      <div class="flex flex-col gap-3 text-sm text-fg-muted">
        <p>
          This will deactivate your profile and cancel any active subscription. Your account data will be preserved but
          you won't be able to use Clippster until you reactivate.
        </p>
        <Field for="billing-deactivate-input">
          <template #label>
            Type <strong class="font-semibold text-fg">DEACTIVATE</strong> to confirm
          </template>
          <Input
            id="billing-deactivate-input"
            v-model="deactivateInput"
            type="text"
            placeholder="Type DEACTIVATE"
            autocomplete="off"
          />
        </Field>
      </div>
      <template #footer>
        <Button
          variant="ghost"
          @click="
            showDeactivateConfirm = false;
            deactivateInput = '';
          "
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          :loading="deactivatingProfile"
          :disabled="deactivateInput !== 'DEACTIVATE' || deactivatingProfile"
          @click="executeDeactivateProfile"
        >
          {{ deactivatingProfile ? 'Deactivating…' : 'Deactivate profile' }}
        </Button>
      </template>
    </Modal>

    <!-- Buy credits -->
    <BuyCreditsDialog v-model:open="showBuyCreditsModal" @success="refreshAfterPurchase" />

    <!-- Subscribe dialog -->
    <SubscribeDialog
      v-if="selectedSubscription"
      :open="showPaymentModal"
      :plan="selectedSubscription"
      context="user"
      :current-plan="subscriptionStatus?.tier"
      :billing-interval="billingInterval"
      @update:open="showPaymentModal = $event"
      @success="handleSubscribeSuccess"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import { useToast } from '@/composables/useToast';
  import { useSubscription } from '@/composables/useSubscription';
  import api from '@/services/api';
  import {
    CreditCard,
    Check,
    X,
    Wallet,
    Crown,
    Coins,
    Receipt,
    CalendarCheck,
    Clock,
    AlertCircle,
    AlertTriangle,
    TrendingUp,
    Building,
    Plus,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import SubscribeDialog from '@/components/SubscribeDialog.vue';
  import BuyCreditsDialog from '@/components/billing/BuyCreditsDialog.vue';
  import PriceCard from '@/components/billing/PriceCard.vue';
  import type { PriceFeature } from '@/components/billing/types';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge, type BadgeVariants } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SettingRow } from '@/components/ui/setting-row';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

  import { useRoute, useRouter } from 'vue-router';
  import { getDefaultRoute } from '@/router';

  const authStore = useAuthStore();
  const route = useRoute();
  const router = useRouter();
  const { success: showSuccessToast, error: showErrorToast } = useToast();
  const { fetchSubscriptionStatus } = useSubscription();

  const loadingBalance = ref(true);
  const loadingTiers = ref(true);
  const loadingHistory = ref(true);

  // Billing interval toggle
  const billingInterval = ref<'monthly' | 'yearly'>('monthly');

  // New user flow detection
  const isNewUserFlow = computed(() => route.query.new_user === 'true');

  // Subscription gate mode detection
  const isSubscriptionGateMode = computed(() => route.query.subscription_required === 'true');

  // Expired subscription detection
  const isExpiredSubscription = computed(() => subscriptionStatus.value?.status === 'expired');

  // Subscription data
  const subscriptionTiers = ref<any[]>([]);
  const subscriptionStatus = ref<any>(null);

  // Credit balance
  const hoursRemaining = ref<number | 'unlimited'>(0);
  const hoursUsed = ref<number>(0);
  const organizationAllocations = ref<any[]>([]);
  const isAdmin = ref(false);

  // Payment history
  const paymentHistory = ref<any[]>([]);

  // Payment modal state
  const showPaymentModal = ref(false);
  const selectedSubscription = ref<any>(null);

  // Cancel subscription
  const showCancelConfirm = ref(false);
  const cancellingSubscription = ref(false);

  // Tier change
  const showTierChangeConfirm = ref(false);
  const tierChangeTarget = ref<any>(null);
  const changingTier = ref(false);

  // Free downgrade
  const showFreeDowngradeConfirm = ref(false);

  // Deactivate profile
  const showDeactivateConfirm = ref(false);
  const deactivateInput = ref('');
  const deactivatingProfile = ref(false);

  // Buy credits dialog
  const showBuyCreditsModal = ref(false);

  // Tier hierarchy for upgrade/downgrade detection
  const TIER_HIERARCHY: Record<string, number> = { basic: 0.5, starter: 1, creator: 2, pro: 3 };

  const hasActiveSubscription = computed(() => {
    return subscriptionStatus.value?.status === 'active' || subscriptionStatus.value?.status === 'cancelled';
  });

  const statusBadgeText = computed(() => {
    const status = subscriptionStatus.value?.status;
    if (status === 'active') return 'Active';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'expired') return 'Expired';
    return 'None';
  });

  const statusBadgeVariant = computed<BadgeVariants['variant']>(() => {
    const status = subscriptionStatus.value?.status;
    if (status === 'active') return 'success';
    if (status === 'cancelled') return 'warning';
    if (status === 'expired') return 'danger';
    return 'neutral';
  });

  const intervalOptions: SegmentedOption<'monthly' | 'yearly'>[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const historyColumns: DataTableColumn[] = [
    { key: 'date', label: 'Date', width: '120px' },
    { key: 'type', label: 'Type', width: '120px', hideBelow: 'md' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', width: '96px' },
    { key: 'method', label: 'Method', width: '110px', hideBelow: 'md' },
    { key: 'status', label: 'Status', width: '110px' },
  ];

  /** Plan feature lists (kept in the same order across plans so they compare line by line). */
  const freePlanFeatures: PriceFeature[] = [
    { label: 'Mobile app' },
    { label: '5 clip builds/day' },
    { label: '1 editor export/day' },
    { label: '2 VOD downloads/day' },
    { label: 'Admin watermark applied' },
    { label: 'Social posting', included: false },
    { label: 'AI Video Creator', included: false },
    { label: 'Campaign participation', included: false },
  ];

  const basicPlanFeatures: PriceFeature[] = [
    { label: 'Mobile app' },
    { label: 'Unlimited clip builds' },
    { label: 'Social posting & scheduling' },
    { label: 'Custom watermark & intro/outro' },
    { label: 'Campaign participation' },
    { label: 'AI clip detection', included: false },
    { label: 'Organization membership', included: false },
    { label: 'AI Video Creator', included: false },
    { label: 'Large credit pack only (1,800 @ $39.99)', note: true },
  ];

  function getPaidPlanFeatures(tierId: string): PriceFeature[] {
    return [
      { label: 'Mobile app' },
      { label: 'Unlimited clip builds' },
      { label: 'Social posting & scheduling' },
      { label: 'Custom watermark & intro/outro' },
      { label: 'AI clip detection' },
      { label: 'Organization membership' },
      { label: 'AI Video Creator', included: tierId === 'creator' || tierId === 'pro' },
      { label: 'Credits roll over' },
    ];
  }

  /** Paid plan cards: Basic first, then the remaining tiers in API order. */
  const paidPlans = computed(() => {
    const yearly = billingInterval.value === 'yearly';
    const plans: {
      tier: any;
      price: string;
      priceNote?: string;
      credits: string;
      creditsLabel: string;
      features: PriceFeature[];
      recommended: boolean;
    }[] = [];
    const basicTier = subscriptionTiers.value.find((t: any) => t.id === 'basic');
    if (basicTier) {
      plans.push({
        tier: basicTier,
        price: yearly ? '$142.89' : '$12.99',
        priceNote: yearly ? '$11.91/mo effective' : undefined,
        credits: '0',
        creditsLabel: 'credits/month',
        features: basicPlanFeatures,
        recommended: false,
      });
    }
    for (const tier of subscriptionTiers.value.filter((t: any) => t.id !== 'basic')) {
      plans.push({
        tier,
        price: `$${getDisplayPrice(tier)}`,
        priceNote: yearly ? `$${getEffectiveMonthly(tier)}/mo effective` : undefined,
        credits: yearly ? (tier.monthly_credits * 12).toLocaleString() : tier.monthly_credits.toLocaleString(),
        creditsLabel: yearly ? 'credits upfront' : 'credits/month',
        features: getPaidPlanFeatures(tier.id),
        recommended: tier.id === 'creator',
      });
    }
    return plans;
  });

  function isCurrentTier(tierId: string): boolean {
    return hasActiveSubscription.value && subscriptionStatus.value?.tier === tierId;
  }

  function isPendingTier(tierId: string): boolean {
    return subscriptionStatus.value?.pending_subscription_tier === tierId;
  }

  const pendingDowngradeToFree = computed(() => {
    return subscriptionStatus.value?.status === 'cancelled';
  });

  const tierChangeIsUpgrade = computed(() => {
    if (!tierChangeTarget.value || !subscriptionStatus.value?.tier) return false;
    const currentLevel = TIER_HIERARCHY[subscriptionStatus.value.tier] ?? 0;
    const newLevel = TIER_HIERARCHY[tierChangeTarget.value.id] ?? 0;
    return newLevel > currentLevel;
  });

  const tierChangeCreditDiff = computed(() => {
    if (!tierChangeTarget.value || !subscriptionStatus.value?.tier) return 0;
    const currentTier = subscriptionTiers.value.find((t: any) => t.id === subscriptionStatus.value?.tier);
    const newCredits = tierChangeTarget.value.monthly_credits || 0;
    const currentCredits = currentTier?.monthly_credits || 0;
    return Math.max(0, newCredits - currentCredits);
  });

  function getStatusVariant(status: string): BadgeVariants['variant'] {
    if (status === 'active' || status === 'confirmed') return 'success';
    if (status === 'pending') return 'warning';
    if (status === 'cancelled' || status === 'failed') return 'danger';
    return 'neutral';
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return fmtDate(dateString);
  }

  function showAuthModal() {
    window.dispatchEvent(new CustomEvent('show-auth-modal'));
  }

  onMounted(async () => {
    await loadAllData();

    // Listen for auth state changes and refetch data
    window.addEventListener('auth-state-changed', loadAllData);
  });

  onUnmounted(() => {
    window.removeEventListener('auth-state-changed', loadAllData);
  });

  async function loadAllData() {
    // Fetch all data in parallel - each function manages its own loading state
    await Promise.all([fetchSubscriptionTiers(), fetchBalance(), fetchPaymentHistory()]);
  }

  // The loading flags start true and only cover the first load: refetches (auth change,
  // after a purchase or plan change) keep the current figures on screen instead of
  // swapping them for skeletons.
  async function fetchSubscriptionTiers() {
    try {
      const response = await api.get('/subscription/tiers');
      if (response.data.success) {
        subscriptionTiers.value = response.data.tiers;
      }
    } catch (error: any) {
      console.error('Failed to fetch subscription tiers:', error);
    } finally {
      loadingTiers.value = false;
    }
  }

  async function fetchBalance() {
    if (!authStore.isAuthenticated) {
      loadingBalance.value = false;
      return;
    }

    try {
      const response = await api.get('/credits/balance');
      if (response.data.success) {
        hoursRemaining.value = response.data.balance.hours_remaining;
        hoursUsed.value = response.data.balance.hours_used || 0;
        subscriptionStatus.value = response.data.subscription;
        organizationAllocations.value = response.data.organization_allocations || [];
        isAdmin.value = response.data.balance.hours_remaining === 'unlimited';
      }
    } catch (error: any) {
      console.error('Failed to fetch balance:', error);
    } finally {
      loadingBalance.value = false;
    }
  }

  async function fetchPaymentHistory() {
    if (!authStore.isAuthenticated) {
      loadingHistory.value = false;
      return;
    }

    loadingHistory.value = true;
    try {
      // Fetch subscription history
      const subResponse = await api.get('/subscription/history');
      const subscriptionPayments = subResponse.data.success
        ? subResponse.data.history.map((item: any) => ({
            id: `sub_${item.id}`,
            type: 'subscription',
            description: `${item.tier?.charAt(0).toUpperCase() + item.tier?.slice(1) || 'Unknown'} Plan`,
            amount: item.amount_usd || 0,
            method: item.payment_method,
            status: item.status,
            date: item.created_at,
          }))
        : [];

      // Fetch credit transactions
      let creditPayments: any[] = [];
      try {
        const creditResponse = await api.get('/credits/transactions');
        if (creditResponse.data.success) {
          creditPayments = creditResponse.data.transactions.map((item: any) => ({
            id: `credit_${item.id}`,
            type: 'credit_pack',
            description: `${item.pack_type?.charAt(0).toUpperCase() + item.pack_type?.slice(1) || 'Unknown'} Pack (${item.hours_purchased} min)`,
            amount: item.amount_usd || 0,
            method: item.payment_method,
            status: item.status,
            date: item.created_at,
          }));
        }
      } catch (error) {
        console.log('Credit transactions endpoint not available');
      }

      // Combine and sort by date
      paymentHistory.value = [...subscriptionPayments, ...creditPayments].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error: any) {
      console.error('Failed to fetch payment history:', error);
    } finally {
      loadingHistory.value = false;
    }
  }

  /** Handle clicking a paid tier card button */
  function handleTierClick(tier: any) {
    if (isCurrentTier(tier.id)) return;

    if (hasActiveSubscription.value && subscriptionStatus.value?.status === 'active') {
      // User has active sub — show tier change confirmation (calls PUT /subscription/tier)
      tierChangeTarget.value = tier;
      showTierChangeConfirm.value = true;
    } else {
      // No active sub — go through Stripe checkout
      selectedSubscription.value = tier;
      showPaymentModal.value = true;
    }
  }

  /** Handle clicking Basic tier card button */
  function handleBasicTierClick() {
    if (isCurrentTier('basic')) return;

    const basicTier = subscriptionTiers.value.find(t => t.id === 'basic');
    if (!basicTier) return;

    if (hasActiveSubscription.value && subscriptionStatus.value?.status === 'active') {
      // Show warning about credit wipe when downgrading to Basic
      tierChangeTarget.value = basicTier;
      showTierChangeConfirm.value = true;
    } else {
      // No active sub — go through Stripe checkout
      selectedSubscription.value = basicTier;
      showPaymentModal.value = true;
    }
  }

  /** Open free downgrade confirmation */
  function confirmDowngradeToFree() {
    if (!hasActiveSubscription.value) return;
    showFreeDowngradeConfirm.value = true;
  }

  /** Execute tier change via API (upgrade prorated immediately, downgrade at period end) */
  async function executeTierChange() {
    if (!tierChangeTarget.value) return;
    changingTier.value = true;
    try {
      const response = await api.put('/subscription/tier', { tier: tierChangeTarget.value.id });
      if (response.data.success) {
        showSuccessToast(
          response.data.type === 'upgrade' ? 'Plan Upgraded' : 'Plan Change Scheduled',
          response.data.message
        );
        subscriptionStatus.value = response.data.subscription;
        showTierChangeConfirm.value = false;
        tierChangeTarget.value = null;
        await fetchBalance();
      } else {
        throw new Error(response.data.error || 'Failed to change plan');
      }
    } catch (error: any) {
      showErrorToast('Failed to change plan', error?.response?.data?.error || error.message || 'An error occurred');
    } finally {
      changingTier.value = false;
    }
  }

  /** Execute downgrade to free (cancels subscription at period end) */
  async function executeDowngradeToFree() {
    cancellingSubscription.value = true;
    try {
      const response = await api.post('/subscription/cancel');
      if (response.data.success) {
        showSuccessToast('Switching to Free', 'Your subscription will end at the current billing period. You will NOT receive the 60 free credits again.');
        subscriptionStatus.value = response.data.subscription;
        showFreeDowngradeConfirm.value = false;
      } else {
        throw new Error(response.data.error || 'Failed to switch to free plan');
      }
    } catch (error: any) {
      showErrorToast('Failed to switch', error.message || 'An error occurred');
    } finally {
      cancellingSubscription.value = false;
    }
  }

  /** Cancel a pending tier change */
  async function cancelPendingChange() {
    try {
      const response = await api.post('/subscription/pending-change/cancel');
      if (response.data.success) {
        showSuccessToast('Change Cancelled', response.data.message);
        subscriptionStatus.value = response.data.subscription;
      }
    } catch (error: any) {
      showErrorToast('Failed', error.message || 'An error occurred');
    }
  }

  /** Execute profile deactivation */
  async function executeDeactivateProfile() {
    if (deactivateInput.value !== 'DEACTIVATE') return;
    deactivatingProfile.value = true;
    try {
      const response = await api.post('/subscription/deactivate');
      if (response.data.success) {
        showSuccessToast('Profile Deactivated', 'Your profile has been deactivated.');
        showDeactivateConfirm.value = false;
        deactivateInput.value = '';
        authStore.logout();
        router.push('/');
      } else {
        throw new Error(response.data.error || 'Failed to deactivate profile');
      }
    } catch (error: any) {
      showErrorToast('Failed to deactivate', error?.response?.data?.error || error.message || 'An error occurred');
    } finally {
      deactivatingProfile.value = false;
    }
  }

  /** Continue with free tier — mark plan selected on server and go to default route */
  async function continueWithFree() {
    try {
      await api.post('/subscription/select-free');
      if (authStore.user) {
        (authStore.user as any).has_selected_plan = true;
      }
    } catch (err) {
      console.warn('[Billing] Failed to persist free plan selection on server:', err);
    }
    localStorage.setItem('has_selected_plan', 'true');
    // Trigger auth state refresh to update gates
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { userId: authStore.user?.id } }));
    const targetRoute = getDefaultRoute(authStore.user);
    router.push(targetRoute);
  }

  /** Get displayed price for a tier based on billing interval */
  function getDisplayPrice(tier: any): string {
    if (billingInterval.value === 'yearly') {
      return (tier.price_usd * 11).toFixed(2);
    }
    return tier.price_usd.toFixed(2);
  }

  /** Get effective monthly price for yearly billing */
  function getEffectiveMonthly(tier: any): string {
    if (billingInterval.value === 'yearly') {
      return ((tier.price_usd * 11) / 12).toFixed(2);
    }
    return tier.price_usd.toFixed(2);
  }

  async function handleSubscribeSuccess() {
    showPaymentModal.value = false;
    selectedSubscription.value = null;

    // Refresh subscription status (this updates both subscription state and auth store)
    await fetchSubscriptionStatus();

    // Fetch updated balance and history
    await fetchBalance();
    await fetchPaymentHistory();

    // Show success toast
    showSuccessToast('Subscription activated', 'Your plan is now active');

    // First-time paid plan selection → same redirect as free; tour triggers via completed_tours check
    if (isNewUserFlow.value || isSubscriptionGateMode.value) {
      localStorage.setItem('has_selected_plan', 'true');
      const targetRoute = getDefaultRoute(authStore.user);
      router.push(targetRoute);
    }
  }

  async function cancelSubscription() {
    cancellingSubscription.value = true;
    try {
      const response = await api.post('/subscription/cancel');
      if (response.data.success) {
        showSuccessToast('Subscription cancelled', response.data.message);
        subscriptionStatus.value = response.data.subscription;
        showCancelConfirm.value = false;
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (error: any) {
      showErrorToast('Failed to cancel', error.message || 'An error occurred');
    } finally {
      cancellingSubscription.value = false;
    }
  }

  /** A credit pack was bought: refresh the balance and the payment history. */
  async function refreshAfterPurchase() {
    await Promise.all([fetchBalance(), fetchPaymentHistory()]);
  }
</script>

