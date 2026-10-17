<template>
  <PageLayout
    title="Billing"
    description="Manage your organization's credits and view payment history"
    :icon="Wallet"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Billing' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button v-if="isAdmin" variant="primary" size="sm" @click="showBuyCreditsModal = true">
        <Plus />
        Buy credits
      </Button>
    </template>
    <template v-if="isAdmin" #toolbar>
      <SegmentedControl v-model="activeTab" :options="tabs" />
    </template>

    <!-- Keyed by tab so each panel eases in instead of popping -->
    <div :key="activeTab" class="flex animate-enter flex-col gap-6 px-5 py-4">
      <!-- ───────────── Credits ───────────── -->
      <template v-if="isAdmin && activeTab === 'allocations'">
        <!-- No subscription callout -->
        <Alert v-if="!hasActiveSubscription" variant="warning">
          <Crown />
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div class="min-w-[200px] flex-1">
              <AlertTitle>No active subscription</AlertTitle>
              <AlertDescription>
                Your organization needs an active subscription to access credits and features.
              </AlertDescription>
            </div>
            <Button variant="secondary" size="sm" @click="activeTab = 'subscriptions'">
              <Crown />
              Set up subscription
            </Button>
          </div>
        </Alert>

        <StatGrid :count="3">
          <StatCard
            label="Pool balance"
            :value="`${credits.hoursRemaining} min`"
            hint="Available for allocation"
            :icon="Coins"
            tone="brand"
          />
          <StatCard label="Total used" :value="`${credits.hoursUsed} min`" hint="All-time usage" :icon="TrendingUp" />
          <StatCard
            label="My allocation"
            :value="`${formatAllocation(myAllocation?.hours_remaining)} min`"
            hint="Your remaining credits"
            :icon="User"
          />
        </StatGrid>

        <section class="flex flex-col gap-2.5">
          <SectionHeader
            title="Member allocations"
            :count="members.length"
            description="Distribute pool credits to team members."
          />
          <div class="@container overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <table class="w-full table-fixed text-sm">
              <thead>
                <tr class="eyebrow border-b border-line-subtle text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-semibold">
                  <th>Member</th>
                  <th class="hidden w-24 text-right @[50rem]:table-cell">Allocated</th>
                  <th class="hidden w-24 text-right @[50rem]:table-cell">Used</th>
                  <th class="w-24 text-right">Remaining</th>
                  <th class="w-[4.5rem] @[50rem]:w-24" title="Let this member draw from the pool once their allocation runs out">
                    Fallback
                  </th>
                  <th class="w-40 @[50rem]:w-[11rem]">Add credits</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="member in members"
                  :key="member.id"
                  class="border-b border-line-subtle last:border-b-0 [&>td]:px-4 [&>td]:py-2"
                >
                  <td class="min-w-0"><OrgUserCell :user="member.user" /></td>
                  <td class="tabular hidden whitespace-nowrap text-right text-fg @[50rem]:table-cell">
                    {{ formatAllocation(member.allocation?.hours_allocated) }}
                    <span class="text-xs text-fg-subtle">min</span>
                  </td>
                  <td class="tabular hidden whitespace-nowrap text-right text-fg-muted @[50rem]:table-cell">
                    {{ formatAllocation(member.allocation?.hours_used) }}
                    <span class="text-xs text-fg-subtle">min</span>
                  </td>
                  <td class="tabular whitespace-nowrap text-right font-medium text-fg">
                    {{ formatAllocation(member.allocation?.hours_remaining) }}
                    <span class="text-xs font-normal text-fg-subtle">min</span>
                  </td>
                  <td>
                    <label class="flex items-center gap-2 text-xs text-fg-muted">
                      <Switch
                        :model-value="!!member.allocation?.allow_pool_fallback"
                        :title="member.allocation?.allow_pool_fallback ? 'Disable pool fallback' : 'Enable pool fallback'"
                        @update:model-value="handleTogglePoolFallback(member.user_id, !member.allocation?.allow_pool_fallback)"
                      />
                      <span class="hidden @[50rem]:inline">{{ member.allocation?.allow_pool_fallback ? 'On' : 'Off' }}</span>
                    </label>
                  </td>
                  <td>
                    <div class="flex items-center gap-1.5">
                      <div class="relative min-w-0 flex-1">
                        <Input
                          v-model="allocations[member.user_id]"
                          type="number"
                          min="0"
                          :max="poolBalance"
                          step="0.5"
                          placeholder="0"
                          class="tabular h-[var(--control-sm)] appearance-none pr-9 text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          :disabled="poolBalance === 0"
                          :aria-label="`Minutes to allocate to ${member.user?.name || member.user?.email || 'member'}`"
                        />
                        <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs text-fg-subtle">
                          min
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        :disabled="
                          poolBalance === 0 ||
                          !allocations[member.user_id] ||
                          allocations[member.user_id] <= 0 ||
                          allocations[member.user_id] > poolBalance
                        "
                        @click="handleAllocateCredits(member.user_id)"
                      >
                        Add
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- ───────────── Payment history ───────────── -->
      <section v-if="isAdmin && activeTab === 'history'" class="flex flex-col gap-2.5">
        <SectionHeader
          title="Payment history"
          :description="transactionsTotal > 0 ? `${transactionsTotal} transactions recorded` : 'Credit purchases and subscription payments'"
        >
          <Button
            v-if="transactionsLoaded || invoicesLoaded"
            variant="ghost"
            size="sm"
            :disabled="transactionsLoading || invoicesLoading"
            @click="loadTransactions(transactionsPage); loadInvoices()"
          >
            <RefreshCw :class="{ 'animate-spin': transactionsLoading || invoicesLoading }" />
            Refresh
          </Button>
        </SectionHeader>

        <!-- Not loaded yet -->
        <EmptyState
          v-if="!transactionsLoaded && !invoicesLoaded && !transactionsLoading && !invoicesLoading"
          :icon="Receipt"
          size="sm"
          title="Payment history isn't loaded"
          description="Load your organization's payment records to review past purchases."
        >
          <Button variant="secondary" size="sm" @click="loadTransactions(1); loadInvoices()">
            <Download />
            Load history
          </Button>
        </EmptyState>

        <!-- Loading (first load only; refreshes keep the records on screen) -->
        <div
          v-else-if="(transactionsLoading || invoicesLoading) && invoices.length === 0 && transactions.length === 0"
          class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface"
          aria-busy="true"
        >
          <div v-for="i in 4" :key="i" class="flex items-center gap-3 border-b border-line-subtle px-4 py-3 last:border-b-0">
            <div class="skeleton size-8 shrink-0 rounded-lg" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-32" />
              <div class="skeleton h-3 w-52 max-w-full" />
            </div>
            <div class="skeleton h-3.5 w-14" />
          </div>
        </div>

        <div v-else-if="invoicesLoaded || transactionsLoaded" class="flex animate-enter flex-col gap-6">
          <!-- Subscription invoices -->
          <div v-if="invoices.length > 0" class="flex flex-col gap-2">
            <SectionHeader title="Subscription payments" />
            <ul class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
              <li
                v-for="inv in invoices"
                :key="inv.id"
                class="flex items-center gap-3 border-b border-line-subtle px-4 py-2 last:border-b-0"
              >
                <IconTile :icon="CreditCard" size="md" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium text-fg">{{ inv.number || 'Subscription invoice' }}</span>
                    <Badge :variant="invoiceStatusVariant(inv.status)" class="capitalize">{{ inv.status }}</Badge>
                  </div>
                  <p class="truncate text-xs text-fg-subtle">
                    {{ inv.created ? formatTransactionDate(new Date(inv.created * 1000).toISOString()) : '—' }}
                    · Stripe
                    <template v-if="inv.period_start && inv.period_end">
                      · {{ new Date(inv.period_start * 1000).toLocaleDateString() }} –
                      {{ new Date(inv.period_end * 1000).toLocaleDateString() }}
                    </template>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-3">
                  <span class="tabular text-sm font-semibold text-fg">
                    ${{ inv.amount_paid != null ? (inv.amount_paid / 100).toFixed(2) : '—' }}
                  </span>
                  <a
                    v-if="inv.hosted_invoice_url"
                    :href="inv.hosted_invoice_url"
                    target="_blank"
                    rel="noopener"
                    :class="buttonVariants({ variant: 'ghost', size: 'xs' })"
                  >
                    View
                    <ExternalLink />
                  </a>
                </div>
              </li>
            </ul>
          </div>

          <!-- Credit pack transactions -->
          <div v-if="transactions.length > 0" class="flex flex-col gap-2">
            <SectionHeader v-if="invoices.length > 0" title="Credit purchases" />
            <div class="@container overflow-hidden rounded-xl border border-line-subtle bg-surface">
              <table class="w-full table-fixed text-sm">
                <thead>
                  <tr class="eyebrow border-b border-line-subtle text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-semibold">
                    <th>Purchase</th>
                    <th class="hidden w-48 @[44rem]:table-cell">Date</th>
                    <th class="hidden w-40 @[56rem]:table-cell">Purchased by</th>
                    <th class="w-24">Status</th>
                    <th class="w-28 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tx in transactions"
                    :key="tx.id"
                    class="border-b border-line-subtle last:border-b-0 [&>td]:px-4 [&>td]:py-2"
                  >
                    <td>
                      <div class="flex min-w-0 items-center gap-2.5">
                        <IconTile :icon="tx.payment_method === 'stripe' ? CreditCard : Wallet" size="md" />
                        <div class="min-w-0">
                          <p class="truncate font-medium text-fg">{{ getPackLabel(tx.pack_type) }}</p>
                          <p class="truncate text-xs text-fg-subtle">
                            {{ getPaymentMethodLabel(tx.payment_method) }}
                            <span class="@[44rem]:hidden">· {{ formatTransactionDate(tx.purchased_at) }}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td class="hidden truncate text-xs text-fg-muted @[44rem]:table-cell">
                      {{ formatTransactionDate(tx.purchased_at) }}
                    </td>
                    <td class="hidden truncate text-xs text-fg-muted @[56rem]:table-cell">
                      {{ tx.purchased_by ? tx.purchased_by.name || tx.purchased_by.email : '—' }}
                    </td>
                    <td>
                      <Badge :variant="invoiceStatusVariant(tx.status)" class="capitalize">{{ tx.status }}</Badge>
                    </td>
                    <td class="text-right">
                      <p class="tabular font-semibold text-fg">${{ parseFloat(tx.amount_usd).toFixed(2) }}</p>
                      <p class="tabular text-2xs text-fg-subtle">+{{ parseFloat(tx.hours_purchased).toFixed(0) }} min</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <PaginationFooter
              v-if="totalTransactionPages > 1"
              mode="static"
              :current-page="transactionsPage"
              :total-pages="totalTransactionPages"
              :total-items="transactionsTotal"
              item-label="transaction"
              @go-to-page="loadTransactions"
              @previous="loadTransactions(transactionsPage - 1)"
              @next="loadTransactions(transactionsPage + 1)"
            />
          </div>

          <!-- Nothing found -->
          <EmptyState
            v-if="invoices.length === 0 && transactions.length === 0"
            :icon="Receipt"
            size="sm"
            title="No payment history"
            description="Payments will appear here once they are processed."
          />
        </div>
      </section>

      <!-- ───────────── Subscription ───────────── -->
      <template v-if="isAdmin && activeTab === 'subscriptions'">
        <!-- Current plan -->
        <section v-if="hasActiveSubscription" class="flex flex-col gap-2.5">
          <SectionHeader title="Current plan" />
          <div class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <div class="flex flex-wrap items-center gap-3 px-4 py-3">
              <IconTile
                :icon="subscription?.status === 'active' ? Crown : AlertCircle"
                :tone="subscription?.status === 'active' ? 'brand' : 'warning'"
                size="md"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="truncate text-sm font-semibold text-fg">{{ subscription?.tier_name || 'Subscription' }}</h3>
                  <Badge :variant="subscription?.status === 'active' ? 'success' : 'warning'">
                    {{ subscription?.status === 'active' ? 'Active' : 'Cancelled' }}
                  </Badge>
                </div>
                <p v-if="subscription?.end_date" class="text-xs text-fg-muted">
                  <template v-if="subscription.status === 'active'">
                    Renews {{ formatDate(subscription.end_date) }} · {{ subscription.days_remaining }} days left
                  </template>
                  <template v-else>Access until {{ formatDate(subscription.end_date) }}</template>
                </p>
              </div>
              <div v-if="subscription?.status === 'active' && isAdmin" class="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" class="hover:bg-danger-soft hover:text-danger" @click="showCancelSubscriptionDialog = true">
                  Cancel plan
                </Button>
                <Button variant="secondary" size="sm" @click="showChangePlanDialog = true">Change plan</Button>
              </div>
            </div>
            <div class="border-t border-line-subtle px-4 py-3">
              <StatGrid size="sm" :items="planStats" />
            </div>
            <div
              v-if="subscription?.pending_subscription_tier"
              class="flex items-center gap-2 border-t border-line-subtle bg-warning-soft px-4 py-2.5 text-xs text-warning"
            >
              <AlertTriangle class="size-3.5 shrink-0" />
              Downgrading to {{ subscription.pending_subscription_tier }} at the end of the billing period
            </div>
          </div>
        </section>

        <!-- No subscription: plan picker -->
        <section v-else class="flex flex-col gap-2.5">
          <SectionHeader title="Choose a plan" description="Select a base subscription to get started." />
          <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            <OrgPlanCard
              v-for="tier in sortedBaseTiers"
              :key="tier.id"
              :tier="tier"
              :highlighted="tier.id === 'enterprise_ai'"
            >
              <Button
                :variant="tier.id === 'enterprise_ai' ? 'brand' : 'secondary'"
                size="sm"
                block
                @click="selectSubscription(tier, 'base')"
              >
                Get started
              </Button>
            </OrgPlanCard>
          </div>
        </section>

        <!-- Add-ons -->
        <section v-if="hasActiveSubscription" class="flex flex-col gap-2.5">
          <SectionHeader title="Add-ons" description="Expand your organization's capacity." />
          <div class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <div
              class="eyebrow grid grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-line-subtle px-4 py-2"
            >
              <span>Seats</span>
              <span class="flex items-center gap-1.5"><Users class="size-3" />Standard</span>
              <span class="flex items-center gap-1.5 text-ai"><Sparkles class="size-3" />Includes AI</span>
            </div>
            <div
              v-for="group in groupedAddons"
              :key="group.seats"
              class="grid grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-line-subtle px-4 py-3 last:border-b-0"
            >
              <p class="tabular text-sm font-semibold text-fg">
                +{{ group.seats }} <span class="text-xs font-normal text-fg-subtle">seats</span>
              </p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <template v-if="group.standard">
                  <p class="tabular text-sm text-fg">
                    ${{ group.standard.usd }}<span class="text-xs text-fg-subtle">/mo</span>
                  </p>
                  <Button size="xs" variant="secondary" @click="selectSubscription(group.standard, 'addon')">
                    Add to plan
                  </Button>
                </template>
                <span v-else class="text-fg-disabled">—</span>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <template v-if="group.ai">
                  <div>
                    <p class="tabular text-sm text-fg">
                      ${{ group.ai.usd }}<span class="text-xs text-fg-subtle">/mo</span>
                    </p>
                    <p v-if="group.ai.monthly_credits > 0" class="tabular text-2xs text-fg-subtle">
                      {{ group.ai.monthly_credits.toLocaleString() }} credits/mo
                    </p>
                  </div>
                  <Button size="xs" variant="secondary" @click="selectSubscription(group.ai, 'addon')">
                    Add to plan
                  </Button>
                </template>
                <span v-else class="text-fg-disabled">—</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <!-- ───────────── Non-admin ───────────── -->
      <template v-if="!isAdmin">
        <StatCard
          label="My allocation"
          :value="`${formatAllocation(myAllocation?.hours_remaining)} min`"
          hint="Your remaining credits"
          :icon="Zap"
          tone="brand"
          class="max-w-xs"
        />
        <p class="text-sm text-fg-muted">
          Contact your organization admin if you need additional credits allocated to your account.
        </p>
      </template>
    </div>

    <!-- Buy credits for the organization's pool -->
    <BuyCreditsDialog
      v-if="organizationId"
      v-model:open="showBuyCreditsModal"
      :target="{ type: 'organization', id: organizationId, name: organization?.name ?? undefined }"
      @success="loadOrganization(true)"
    />

    <!-- Subscribe Dialog -->
    <SubscribeDialog
      v-if="selectedPlan && organizationId"
      :open="showSubscriptionModal"
      :plan="selectedPlan"
      context="organization"
      :organization-id="organizationId"
      :organization-name="organization?.name ?? undefined"
      :current-plan="subscription?.tier ?? undefined"
      :type="selectedType"
      @update:open="showSubscriptionModal = $event"
      @success="handleSubscribeSuccess"
    />

    <!-- Change Plan Dialog -->
    <Modal
      :open="showChangePlanDialog"
      title="Change plan"
      :description="`Current plan: ${subscription?.tier_name || '—'}`"
      :icon="Crown"
      size="xl"
      @close="closeChangePlanDialog"
    >
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <OrgPlanCard
          v-for="tier in sortedBaseTiers.filter((t: any) => t.id !== subscription?.tier)"
          :key="tier.id"
          :tier="tier"
          :highlighted="tier.id === 'enterprise_ai'"
          selectable
          :selected="changePlanTier === tier.id"
          @select="selectChangePlanTier(tier.id)"
        />
      </div>

      <div v-if="prorationLoading" class="flex justify-center py-4">
        <Loader2 class="size-5 animate-spin text-fg-subtle" />
      </div>

      <InfoList v-if="prorationPreview && !prorationLoading" class="mt-4 animate-enter border-t border-line-subtle pt-1">
        <InfoRow label="Type">
          <Badge :variant="prorationPreview.change_type === 'upgrade' ? 'success' : 'warning'">
            {{ prorationPreview.change_type === 'upgrade' ? 'Upgrade' : 'Downgrade' }}
          </Badge>
        </InfoRow>
        <InfoRow label="New price" :value="`$${prorationPreview.new_price}/mo`" strong />
        <InfoRow
          v-if="prorationPreview.change_type === 'upgrade' && prorationPreview.proration_amount > 0"
          label="Prorated charge now"
          :value="`$${prorationPreview.proration_amount}`"
          strong
        />
        <InfoRow
          label="Effective"
          :value="prorationPreview.effective_date === 'immediate' ? 'Immediately' : formatDate(prorationPreview.effective_date)"
        />
      </InfoList>

      <template #footer>
        <Button variant="ghost" @click="closeChangePlanDialog">Cancel</Button>
        <Button
          variant="primary"
          :loading="changePlanLoading"
          :disabled="!changePlanTier || changePlanLoading"
          @click="handleChangePlan"
        >
          {{ changePlanLoading ? 'Changing…' : 'Confirm change' }}
        </Button>
      </template>
    </Modal>

    <!-- Cancel Subscription Confirmation -->
    <Modal
      :open="showCancelSubscriptionDialog"
      title="Cancel subscription?"
      description="Your organization will lose access after the current period ends."
      :icon="AlertTriangle"
      tone="danger"
      size="sm"
      @close="showCancelSubscriptionDialog = false"
    >
      <p class="text-sm text-fg-muted">
        Your subscription stays active until
        <span class="font-medium text-fg">{{ formatDate(subscription?.end_date || '') }}</span>. After that, your
        organization loses access to subscription features.
      </p>
      <p class="mt-2 text-xs text-fg-subtle">Your credits will remain in your organization pool.</p>
      <template #footer>
        <Button variant="ghost" @click="showCancelSubscriptionDialog = false">Keep subscription</Button>
        <Button variant="destructive" @click="cancelSubscription">Cancel subscription</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, markRaw, computed, onMounted } from 'vue';
  import {
    Wallet,
    Coins,
    TrendingUp,
    User,
    Users,
    Receipt,
    CreditCard,
    RefreshCw,
    Loader2,
    Plus,
    History,
    Download,
    Zap,
    Crown,
    AlertCircle,
    Sparkles,
    AlertTriangle,
    ExternalLink,
  } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { InfoList, InfoRow } from '@/components/ui/info-list';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Switch } from '@/components/ui/switch';
  import PageLayout from '@/components/PageLayout.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import OrgPlanCard from './components/OrgPlanCard.vue';
  import OrgUserCell from './components/OrgUserCell.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import BuyCreditsDialog from '@/components/billing/BuyCreditsDialog.vue';
  import SubscribeDialog from '@/components/SubscribeDialog.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import { useToast } from '@/composables/useToast';
  import { useSubscription } from '@/composables/useSubscription';
  import api from '@/services/api';

  const { success: showSuccess, error: showError } = useToast();
  const { fetchSubscriptionStatus } = useSubscription();

  const {
    organizationId,
    organization,
    members,
    credits,
    myAllocation,
    isAdmin,
    poolBalance,
    subscription,
    subscriptionLoading,
    hasActiveSubscription,
    transactions,
    transactionsLoading,
    transactionsTotal,
    transactionsPage,
    transactionsLoaded,
    totalTransactionPages,
    invoices,
    invoicesLoading,
    invoicesLoaded,
    loadOrganization,
    loadSubscription,
    loadTransactions,
    loadInvoices,
    allocateCredits,
    togglePoolFallback,
    formatAllocation,
    formatTransactionDate,
    getPaymentMethodLabel,
    getPackLabel,
    formatDate,
  } = useOrganization();

  type BillingTab = 'allocations' | 'history' | 'subscriptions';

  const tabs: SegmentedOption<BillingTab>[] = [
    { value: 'allocations', label: 'Credits', icon: markRaw(Coins) },
    { value: 'history', label: 'Payment history', icon: markRaw(History) },
    { value: 'subscriptions', label: 'Subscription', icon: markRaw(Crown) },
  ];

  const activeTab = ref<BillingTab>('allocations');
  const showBuyCreditsModal = ref(false);
  const allocations = ref<Record<number, number>>({});

  // Subscription state
  const loadingTiers = ref(true);
  const baseTiers = ref<any[]>([]);
  const addonTiers = ref<any[]>([]);
  const showSubscriptionModal = ref(false);
  const showCancelSubscriptionDialog = ref(false);
  const selectedPlan = ref<any>(null);
  const selectedType = ref<'base' | 'addon'>('base');

  // Change Plan state
  const showChangePlanDialog = ref(false);
  const changePlanTier = ref<string | null>(null);
  const changePlanLoading = ref(false);
  const prorationPreview = ref<any>(null);
  const prorationLoading = ref(false);

  const sortedBaseTiers = computed(() => {
    // Sort base tiers by price (cheapest to most expensive)
    return [...baseTiers.value].sort((a, b) => a.usd - b.usd);
  });

  const planStats = computed(() => [
    {
      label: 'Seats used',
      value: subscription.value?.current_members || members.value.length || 0,
      hint: `/ ${subscription.value?.total_seats || '∞'}`,
    },
    {
      label: 'Monthly credits',
      value: subscription.value?.total_monthly_credits?.toLocaleString() || 0,
      hint: 'min',
    },
    { label: 'Add-ons', value: subscription.value?.addons?.length || 0 },
  ]);

  const groupedAddons = computed(() => {
    if (!subscription.value) return [];
    const groups: Record<number, { standard: any | null; ai: any | null }> = {};
    for (const addon of addonTiers.value) {
      if (!groups[addon.seats]) groups[addon.seats] = { standard: null, ai: null };
      if (addon.requires_ai) groups[addon.seats].ai = addon;
      else groups[addon.seats].standard = addon;
    }
    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([seats, opts]) => ({ seats: Number(seats), ...opts }));
  });

  // Payment / invoice status → badge tone
  function invoiceStatusVariant(status?: string) {
    switch (status) {
      case 'paid':
      case 'completed':
      case 'succeeded':
        return 'success' as const;
      case 'pending':
      case 'open':
      case 'processing':
        return 'warning' as const;
      case 'failed':
      case 'void':
      case 'uncollectible':
      case 'refunded':
        return 'danger' as const;
      default:
        return 'neutral' as const;
    }
  }

  async function handleAllocateCredits(userId: number) {
    const minutes = allocations.value[userId];
    const result = await allocateCredits(userId, minutes);
    if (result.success) {
      allocations.value[userId] = 0;
    }
  }

  async function handleTogglePoolFallback(userId: number, allowFallback: boolean) {
    await togglePoolFallback(userId, allowFallback);
  }

  // Subscription functions
  async function fetchSubscriptionTiers() {
    if (!organizationId.value) return;

    loadingTiers.value = true;
    try {
      const response = await api.get(`/organizations/${organizationId.value}/subscription/tiers`);
      if (response.data.success) {
        baseTiers.value = response.data.base_tiers;
        addonTiers.value = response.data.addon_tiers;
      }
    } catch (err) {
      console.error('[OrgBilling] Failed to fetch tiers:', err);
    } finally {
      loadingTiers.value = false;
    }
  }

  function selectSubscription(plan: any, type: 'base' | 'addon') {
    selectedPlan.value = {
      id: plan.id,
      name: plan.name,
      price_usd: plan.usd,
      monthly_credits: plan.monthly_credits,
      seats: plan.seats,
    };
    selectedType.value = type;
    showSubscriptionModal.value = true;
  }

  async function handleSubscribeSuccess() {
    showSubscriptionModal.value = false;
    selectedPlan.value = null;
    
    // Refresh user subscription status (updates auth store)
    await fetchSubscriptionStatus();
    
    // Reload organization data
    await loadOrganization();
    
    showSuccess('Subscription activated', 'Your organization plan is now active');
  }

  async function cancelSubscription() {
    if (!organizationId.value) return;

    try {
      const response = await api.post(`/organizations/${organizationId.value}/subscription/cancel`);
      if (response.data.success) {
        showSuccess('Subscription cancelled', response.data.message);
        showCancelSubscriptionDialog.value = false;
        await loadOrganization();
      } else {
        showError('Failed to cancel', response.data.error);
      }
    } catch (err: any) {
      showError('Failed to cancel', err.message || 'An error occurred');
    }
  }

  async function fetchProrationPreview(tier: string) {
    if (!organizationId.value) return;
    prorationLoading.value = true;
    try {
      const response = await api.get(`/organizations/${organizationId.value}/subscription/proration-preview?tier=${tier}`);
      if (response.data.success) {
        prorationPreview.value = response.data.preview;
      }
    } catch { /* ignore */ }
    finally { prorationLoading.value = false; }
  }

  async function handleChangePlan() {
    if (!organizationId.value || !changePlanTier.value) return;
    changePlanLoading.value = true;
    try {
      const response = await api.put(`/organizations/${organizationId.value}/subscription/tier`, { tier: changePlanTier.value });
      if (response.data.success) {
        showSuccess('Plan changed', response.data.message || 'Subscription tier updated');
        showChangePlanDialog.value = false;
        changePlanTier.value = null;
        prorationPreview.value = null;
        await loadOrganization();
      } else {
        showError('Failed', response.data.error);
      }
    } catch (err: any) {
      showError('Failed', err.message || 'An error occurred');
    } finally {
      changePlanLoading.value = false;
    }
  }

  function selectChangePlanTier(tierId: string) {
    changePlanTier.value = tierId;
    fetchProrationPreview(tierId);
  }

  function closeChangePlanDialog() {
    showChangePlanDialog.value = false;
    changePlanTier.value = null;
    prorationPreview.value = null;
  }

  onMounted(async () => {
    await fetchSubscriptionTiers();
  });
</script>

