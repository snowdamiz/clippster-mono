<template>
  <div class="billing">
    <PageLayout
      title="Billing"
      description="Manage your subscription and view payment history"
      :show-header="true"
      :icon="Receipt"
    >
      <template #actions>
        <!-- Subscription Indicator -->
        <div v-if="authStore.isAuthenticated" class="billing-indicator">
          <template v-if="loadingBalance">
            <div class="billing-indicator__skeleton"></div>
          </template>
          <!-- Admin State -->
          <template v-else-if="isAdmin">
            <div class="billing-indicator__admin">
              <Shield class="billing-indicator__admin-icon" />
              <span class="billing-indicator__admin-text">Admin</span>
              <span class="billing-indicator__status billing-indicator__status--admin">Unlimited</span>
            </div>
          </template>
          <template v-else-if="hasActiveSubscription">
            <!-- Subscribed State -->
            <div class="billing-indicator__plan">
              <Crown class="billing-indicator__plan-icon" />
              <span class="billing-indicator__plan-name">{{ subscriptionStatus?.tier_name }}</span>
              <span class="billing-indicator__status" :class="indicatorStatusClass">
                {{ subscriptionStatus?.status === 'active' ? 'Active' : 'Ending' }}
              </span>
            </div>
            <div class="billing-indicator__divider"></div>
            <div class="billing-indicator__credits">
              <Zap class="billing-indicator__credits-icon" />
              <span class="billing-indicator__credits-value">
                {{ typeof hoursRemaining === 'number' ? Math.round(hoursRemaining) : hoursRemaining }}
              </span>
              <span class="billing-indicator__credits-unit">min</span>
            </div>
          </template>
          <template v-else>
            <!-- Not Subscribed State -->
            <div class="billing-indicator__no-plan">
              <CreditCard class="billing-indicator__no-plan-icon" />
              <span class="billing-indicator__no-plan-text">No active plan</span>
            </div>
          </template>
        </div>
      </template>

      <!-- Not Authenticated -->
      <EmptyState
        v-if="!authStore.isAuthenticated"
        title="Sign in to view billing"
        description="Access your subscription details and payment history"
      >
        <template #icon>
          <Receipt class="billing__empty-icon" />
        </template>
        <template #action>
          <button @click="showAuthModal" class="billing__signin-btn">Sign In</button>
        </template>
      </EmptyState>

      <div v-else class="billing__content">
        <!-- Page Heading -->
        <div class="billing__heading">
          <h1 class="billing__title">Manage Your Subscription</h1>
          <p class="billing__subtitle">View your current plan, credit balance, and payment history</p>
        </div>

        <!-- Current Subscription & Credits Row -->
        <div class="billing__cards">
          <!-- Current Subscription Card -->
          <div class="billing-card" :class="{ 'billing-card--active': hasActiveSubscription }">
            <div
              class="billing-card__indicator"
              :class="{ 'billing-card__indicator--active': hasActiveSubscription }"
            ></div>
            <div class="billing-card__inner">
              <div class="billing-card__header">
                <div class="billing-card__header-left">
                  <div class="billing-card__icon" :class="{ 'billing-card__icon--active': hasActiveSubscription }">
                    <Crown v-if="hasActiveSubscription" />
                    <CreditCard v-else />
                  </div>
                  <div class="billing-card__header-text">
                    <h2 class="billing-card__title">Subscription</h2>
                    <p class="billing-card__subtitle">Your current plan</p>
                  </div>
                </div>
                <button
                  v-if="subscriptionStatus?.status === 'active' && !loadingBalance"
                  @click="showCancelConfirm = true"
                  class="billing-card__cancel-btn"
                  :disabled="cancellingSubscription"
                >
                  {{ cancellingSubscription ? 'Cancelling...' : 'Cancel' }}
                </button>
              </div>

              <div class="billing-card__body">
                <!-- Loading skeleton -->
                <template v-if="loadingBalance">
                  <div class="billing-skeleton">
                    <div class="billing-skeleton__line billing-skeleton__line--lg"></div>
                    <div class="billing-skeleton__line billing-skeleton__line--md"></div>
                  </div>
                </template>
                <!-- Loaded content -->
                <template v-else>
                  <div class="billing-card__plan-row">
                    <span class="billing-card__plan-name">
                      {{ subscriptionStatus?.tier_name || 'No Subscription' }}
                    </span>
                    <span class="billing-card__status" :class="statusBadgeClass">
                      {{ statusBadgeText }}
                    </span>
                  </div>
                  <p class="billing-card__info">
                    <template v-if="subscriptionStatus?.status === 'active'">
                      <span class="billing-card__info-row">
                        <CalendarCheck class="billing-card__info-icon" />
                        Renews {{ formatDate(subscriptionStatus?.end_date) }}
                        <span class="billing-card__info-muted">({{ subscriptionStatus?.days_remaining }} days)</span>
                      </span>
                    </template>
                    <template v-else-if="subscriptionStatus?.status === 'cancelled'">
                      <span class="billing-card__info-row billing-card__info-row--warning">
                        <Clock class="billing-card__info-icon" />
                        Access until {{ formatDate(subscriptionStatus?.end_date) }}
                      </span>
                    </template>
                    <template v-else-if="subscriptionStatus?.status === 'expired'">
                      <span class="billing-card__info-row billing-card__info-row--danger">
                        <AlertCircle class="billing-card__info-icon" />
                        Expired {{ formatDate(subscriptionStatus?.end_date) }}
                      </span>
                    </template>
                    <template v-else>Subscribe to unlock Clippster</template>
                  </p>
                </template>
              </div>
            </div>
          </div>

          <!-- Credit Balance Card -->
          <div class="billing-card billing-card--credits">
            <div class="billing-card__indicator billing-card__indicator--credits"></div>
            <div class="billing-card__inner">
              <div class="billing-card__header">
                <div class="billing-card__icon billing-card__icon--credits">
                  <Coins />
                </div>
                <div class="billing-card__header-text">
                  <h2 class="billing-card__title">Credit Balance</h2>
                  <p class="billing-card__subtitle">Available processing time</p>
                </div>
              </div>

              <div class="billing-card__body">
                <!-- Loading skeleton -->
                <template v-if="loadingBalance">
                  <div class="billing-skeleton">
                    <div class="billing-skeleton__line billing-skeleton__line--xl"></div>
                    <div class="billing-skeleton__line billing-skeleton__line--sm"></div>
                  </div>
                </template>
                <!-- Loaded content -->
                <template v-else>
                  <div class="billing-card__balance">
                    <span class="billing-card__balance-value">
                      {{ typeof hoursRemaining === 'number' ? Math.round(hoursRemaining) : hoursRemaining }}
                    </span>
                    <span class="billing-card__balance-unit">min</span>
                  </div>
                  <div class="billing-card__usage">
                    <TrendingUp class="billing-card__usage-icon" />
                    <span>{{ Math.round(hoursUsed) }} min used total</span>
                  </div>

                  <!-- Organization Allocations -->
                  <div v-if="organizationAllocations.length > 0" class="billing-card__allocations">
                    <div class="billing-card__allocations-header">
                      <Building class="billing-card__allocations-icon" />
                      <span>Organization Allocations</span>
                    </div>
                    <div class="billing-card__allocations-list">
                      <div
                        v-for="alloc in organizationAllocations"
                        :key="alloc.organization_id"
                        class="billing-card__allocation-item"
                      >
                        <span class="billing-card__allocation-name">{{ alloc.organization_name }}</span>
                        <span class="billing-card__allocation-value">{{ Math.round(alloc.hours_remaining) }} min</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscription Plans Section -->
        <section class="billing-plans">
          <div class="billing-plans__header">
            <div class="billing-plans__header-icon">
              <Sparkles />
            </div>
            <div class="billing-plans__header-text">
              <h2 class="billing-plans__title">
                {{ hasActiveSubscription ? 'Change Plan' : 'Choose a Plan' }}
              </h2>
              <p class="billing-plans__subtitle">Select the plan that works best for you</p>
            </div>
          </div>

          <div class="billing-plans__grid">
            <!-- Loading skeleton tiers -->
            <template v-if="loadingTiers">
              <div v-for="i in 3" :key="i" class="billing-tier billing-tier--skeleton">
                <div class="billing-tier__content">
                  <div class="billing-skeleton">
                    <div class="billing-skeleton__line billing-skeleton__line--sm" style="width: 60%"></div>
                    <div class="billing-skeleton__line billing-skeleton__line--xl" style="width: 50%"></div>
                  </div>
                  <div class="billing-skeleton" style="margin-top: 1rem">
                    <div class="billing-skeleton__box"></div>
                  </div>
                  <div class="billing-skeleton" style="margin-top: 1rem">
                    <div class="billing-skeleton__line billing-skeleton__line--sm"></div>
                    <div class="billing-skeleton__line billing-skeleton__line--sm"></div>
                    <div class="billing-skeleton__line billing-skeleton__line--sm"></div>
                  </div>
                  <div class="billing-skeleton" style="margin-top: 1rem">
                    <div class="billing-skeleton__btn"></div>
                  </div>
                </div>
              </div>
            </template>
            <!-- Loaded tiers -->
            <template v-else>
              <div
                v-for="tier in subscriptionTiers"
                :key="tier.id"
                class="billing-tier"
                :class="{
                  'billing-tier--current': isCurrentTier(tier.id),
                  'billing-tier--popular': tier.id === 'creator',
                }"
              >
                <!-- Popular Badge -->
                <div v-if="tier.id === 'creator' && !isCurrentTier(tier.id)" class="billing-tier__badge">
                  <Star class="billing-tier__badge-icon" />
                  <span>Most Popular</span>
                </div>

                <!-- Current Badge -->
                <div v-if="isCurrentTier(tier.id)" class="billing-tier__badge billing-tier__badge--current">
                  <Check class="billing-tier__badge-icon" />
                  <span>Current Plan</span>
                </div>

                <div class="billing-tier__content">
                  <div class="billing-tier__header">
                    <h3 class="billing-tier__name">{{ tier.name }}</h3>
                    <div class="billing-tier__price">
                      <span class="billing-tier__price-currency">$</span>
                      <span class="billing-tier__price-amount">{{ tier.price_usd }}</span>
                      <span class="billing-tier__price-period">/mo</span>
                    </div>
                  </div>

                  <div class="billing-tier__credits">
                    <Zap class="billing-tier__credits-icon" />
                    <span class="billing-tier__credits-value">{{ tier.monthly_credits.toLocaleString() }}</span>
                    <span class="billing-tier__credits-label">credits/month</span>
                  </div>

                  <div class="billing-tier__divider"></div>

                  <ul class="billing-tier__features">
                    <li class="billing-tier__feature">
                      <Check class="billing-tier__feature-icon" />
                      <span>Full app access</span>
                    </li>
                    <li class="billing-tier__feature">
                      <Check class="billing-tier__feature-icon" />
                      <span>AI clip detection</span>
                    </li>
                    <li class="billing-tier__feature">
                      <Check class="billing-tier__feature-icon" />
                      <span>Credits roll over</span>
                    </li>
                  </ul>

                  <button
                    class="billing-tier__btn"
                    :class="{
                      'billing-tier__btn--current': isCurrentTier(tier.id),
                      'billing-tier__btn--primary': tier.id === 'creator' && !isCurrentTier(tier.id),
                    }"
                    @click="selectSubscription(tier)"
                    :disabled="isCurrentTier(tier.id)"
                  >
                    <span v-if="isCurrentTier(tier.id)">Current Plan</span>
                    <span v-else-if="hasActiveSubscription">Switch Plan</span>
                    <span v-else>Get Started</span>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </section>

        <!-- Payment History Section -->
        <section class="billing-history">
          <div class="billing-history__header">
            <div class="billing-history__header-icon">
              <History />
            </div>
            <div class="billing-history__header-text">
              <h2 class="billing-history__title">Payment History</h2>
              <p class="billing-history__subtitle">Your recent transactions</p>
            </div>
          </div>

          <div class="billing-history__table-wrapper">
            <div v-if="loadingHistory" class="billing-history__loading">
              <div class="billing-history__spinner"></div>
              <span>Loading history...</span>
            </div>
            <div v-else-if="paymentHistory.length === 0" class="billing-history__empty">
              <div class="billing-history__empty-icon">
                <Receipt />
              </div>
              <p class="billing-history__empty-title">No payment history yet</p>
              <p class="billing-history__empty-subtitle">Your transactions will appear here</p>
            </div>
            <table v-else class="billing-history__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="payment in paymentHistory" :key="payment.id">
                  <td class="billing-history__cell--date">{{ formatDate(payment.date) }}</td>
                  <td>
                    <span
                      class="billing-history__type"
                      :class="
                        payment.type === 'subscription' ? 'billing-history__type--sub' : 'billing-history__type--credit'
                      "
                    >
                      {{ payment.type === 'subscription' ? 'Subscription' : 'Credits' }}
                    </span>
                  </td>
                  <td class="billing-history__cell--desc">{{ payment.description }}</td>
                  <td class="billing-history__cell--amount">${{ payment.amount.toFixed(2) }}</td>
                  <td class="billing-history__cell--method">
                    <CreditCard v-if="payment.method === 'stripe'" />
                    <Wallet v-else />
                    <span>{{ payment.method }}</span>
                  </td>
                  <td>
                    <span class="billing-history__status" :class="getStatusClass(payment.status)">
                      {{ payment.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageLayout>

    <!-- Cancel Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCancelConfirm" class="billing-modal__overlay" @click.self="showCancelConfirm = false">
          <Transition name="dialog" appear>
            <div class="billing-modal">
              <div class="billing-modal__header">
                <div class="billing-modal__icon billing-modal__icon--danger">
                  <AlertTriangle />
                </div>
                <h2 class="billing-modal__title">Cancel Subscription?</h2>
              </div>

              <div class="billing-modal__body">
                <div class="billing-modal__info">
                  <p>
                    Your subscription will remain active until
                    <strong>{{ formatDate(subscriptionStatus?.end_date) }}</strong>
                    . After that, you'll lose access to Clippster features.
                  </p>
                  <p class="billing-modal__info-muted">Your credits will remain in your account.</p>
                </div>

                <div class="billing-modal__actions">
                  <button
                    @click="cancelSubscription"
                    class="billing-modal__btn billing-modal__btn--danger"
                    :disabled="cancellingSubscription"
                  >
                    {{ cancellingSubscription ? 'Cancelling...' : 'Yes, Cancel Subscription' }}
                  </button>
                  <button @click="showCancelConfirm = false" class="billing-modal__btn billing-modal__btn--secondary">
                    Keep Subscription
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Payment Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPaymentModal" class="billing-modal__overlay" @click.self="closePaymentModal">
          <Transition name="dialog" appear>
            <div class="billing-modal">
              <div class="billing-modal__accent-bar"></div>

              <!-- Confirm Step -->
              <div v-if="paymentStep === 'confirm'" class="billing-modal__content">
                <div class="billing-modal__header">
                  <div class="billing-modal__icon">
                    <Wallet />
                  </div>
                  <h2 class="billing-modal__title">
                    {{ hasActiveSubscription ? 'Change Plan' : 'Subscribe' }}
                  </h2>
                  <p class="billing-modal__subtitle">Choose your preferred payment method</p>
                </div>

                <div class="billing-modal__body">
                  <div class="billing-modal__summary">
                    <div class="billing-modal__summary-row">
                      <span>Plan:</span>
                      <strong>{{ selectedSubscription?.name }}</strong>
                    </div>
                    <div class="billing-modal__summary-row">
                      <span>Credits/month:</span>
                      <span>{{ selectedSubscription?.monthly_credits?.toLocaleString() }}</span>
                    </div>
                    <div class="billing-modal__summary-row billing-modal__summary-row--total">
                      <span>Total:</span>
                      <span class="billing-modal__summary-total">${{ selectedSubscription?.price_usd }}/month</span>
                    </div>
                  </div>

                  <div class="billing-modal__actions">
                    <div class="billing-modal__payment-btns">
                      <button
                        class="billing-modal__btn billing-modal__btn--stripe"
                        @click="initiateStripePayment"
                        :disabled="processing"
                      >
                        <Loader2 v-if="processing" class="billing-modal__btn-spinner" />
                        <CreditCard v-else />
                        <span>Card</span>
                      </button>
                      <button
                        class="billing-modal__btn billing-modal__btn--primary"
                        @click="initiateSubscriptionCrypto"
                        :disabled="processing"
                      >
                        <Loader2 v-if="processing" class="billing-modal__btn-spinner" />
                        <Wallet v-else />
                        <span>Phantom</span>
                      </button>
                    </div>
                    <button
                      class="billing-modal__btn billing-modal__btn--secondary"
                      @click="closePaymentModal"
                      :disabled="processing"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              <!-- Processing Step -->
              <div
                v-else-if="paymentStep === 'processing'"
                class="billing-modal__content billing-modal__content--centered"
              >
                <div class="billing-modal__icon billing-modal__icon--loading">
                  <Loader2 class="billing-modal__icon-spinner" />
                </div>
                <h3 class="billing-modal__title">Processing Payment</h3>
                <p class="billing-modal__subtitle">{{ paymentStatus }}</p>
                <button @click="cancelPaymentProcess" class="billing-modal__btn billing-modal__btn--secondary">
                  Cancel
                </button>
              </div>

              <!-- Success Step -->
              <div
                v-else-if="paymentStep === 'success'"
                class="billing-modal__content billing-modal__content--centered"
              >
                <div class="billing-modal__icon billing-modal__icon--success">
                  <Check />
                </div>
                <h3 class="billing-modal__title">Subscription Activated!</h3>
                <p class="billing-modal__subtitle">
                  Your
                  <strong>{{ selectedSubscription?.name }}</strong>
                  subscription is now active!
                </p>
                <button class="billing-modal__btn billing-modal__btn--success" @click="closePaymentModal">Done</button>
              </div>

              <!-- Error Step -->
              <div v-else-if="paymentStep === 'error'" class="billing-modal__content billing-modal__content--centered">
                <div class="billing-modal__icon billing-modal__icon--danger">
                  <X />
                </div>
                <h3 class="billing-modal__title">Payment Failed</h3>
                <p class="billing-modal__subtitle">{{ errorMessage }}</p>
                <div class="billing-modal__actions">
                  <button class="billing-modal__btn billing-modal__btn--primary" @click="paymentStep = 'confirm'">
                    Try Again
                  </button>
                  <button class="billing-modal__btn billing-modal__btn--secondary" @click="closePaymentModal">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import api from '@/services/api';
  import {
    CreditCard,
    Check,
    Shield,
    X,
    Loader2,
    Wallet,
    Zap,
    Crown,
    Coins,
    Receipt,
    History,
    CalendarCheck,
    Clock,
    AlertCircle,
    AlertTriangle,
    TrendingUp,
    Building,
    Sparkles,
    Star,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';

  const authStore = useAuthStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const loadingBalance = ref(true);
  const loadingTiers = ref(true);
  const loadingHistory = ref(true);

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
  const paymentStep = ref<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const processing = ref(false);
  const paymentStatus = ref('');
  const errorMessage = ref('');

  // Cancel subscription
  const showCancelConfirm = ref(false);
  const cancellingSubscription = ref(false);

  // Computed values
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

  const statusBadgeClass = computed(() => {
    const status = subscriptionStatus.value?.status;
    if (status === 'active') return 'billing-card__status--active';
    if (status === 'cancelled') return 'billing-card__status--warning';
    if (status === 'expired') return 'billing-card__status--danger';
    return 'billing-card__status--none';
  });

  const indicatorStatusClass = computed(() => {
    const status = subscriptionStatus.value?.status;
    if (status === 'active') return 'billing-indicator__status--active';
    if (status === 'cancelled') return 'billing-indicator__status--warning';
    return '';
  });

  function isCurrentTier(tierId: string): boolean {
    return hasActiveSubscription.value && subscriptionStatus.value?.tier === tierId;
  }

  function getStatusClass(status: string): string {
    if (status === 'active' || status === 'confirmed') return 'billing-history__status--success';
    if (status === 'pending') return 'billing-history__status--warning';
    if (status === 'cancelled' || status === 'failed') return 'billing-history__status--danger';
    return '';
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function showAuthModal() {
    window.dispatchEvent(new CustomEvent('show-auth-modal'));
  }

  onMounted(async () => {
    await loadAllData();
  });

  async function loadAllData() {
    // Fetch all data in parallel - each function manages its own loading state
    await Promise.all([fetchSubscriptionTiers(), fetchBalance(), fetchPaymentHistory()]);
  }

  async function fetchSubscriptionTiers() {
    loadingTiers.value = true;
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

    loadingBalance.value = true;
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

  function selectSubscription(tier: any) {
    if (isCurrentTier(tier.id)) return;

    selectedSubscription.value = tier;
    showPaymentModal.value = true;
    paymentStep.value = 'confirm';
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

  async function initiateStripePayment() {
    processing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const response = await api.post('/subscription/checkout', {
        tier: selectedSubscription.value.id,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }

      const { url: checkoutUrl } = response.data;

      const unlisten = await listen('stripe-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        if (paymentResult.success) {
          paymentStep.value = 'success';
          processing.value = false;
          showSuccessToast('Payment successful', 'Your subscription has been activated');
          unlisten();

          setTimeout(async () => {
            await fetchBalance();
            await fetchPaymentHistory();
          }, 2000);
        } else {
          unlisten();
        }
      });

      paymentStatus.value = 'Opening payment page...';
      await invoke('open_stripe_payment_window', {
        checkoutUrl: checkoutUrl,
        packKey: selectedSubscription.value.id,
        packHours: selectedSubscription.value.monthly_credits,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (error: any) {
      errorMessage.value = error.message || 'Failed to create checkout session';
      paymentStep.value = 'error';
      processing.value = false;
      showErrorToast('Payment failed', error.message || 'An error occurred');
    }
  }

  async function initiateSubscriptionCrypto() {
    processing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Getting payment quote...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const quoteResponse = await api.post('/subscription/crypto-quote', {
        tier: selectedSubscription.value.id,
      });

      if (!quoteResponse.data.success) {
        throw new Error(quoteResponse.data.error || 'Failed to get quote');
      }

      const quote = quoteResponse.data.quote;

      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        paymentStatus.value = 'Verifying payment...';
        try {
          const confirmResponse = await api.post('/subscription/crypto-confirm', {
            tier: selectedSubscription.value.id,
            tx_signature: paymentResult.signature,
            from_address: paymentResult.from_address,
          });

          if (confirmResponse.data.success) {
            subscriptionStatus.value = confirmResponse.data.subscription;
            if (confirmResponse.data.balance) {
              hoursRemaining.value = confirmResponse.data.balance.hours_remaining;
              hoursUsed.value = confirmResponse.data.balance.hours_used || 0;
            }
            paymentStep.value = 'success';
            processing.value = false;
            showSuccessToast('Subscription activated', `${selectedSubscription.value.name} subscription is now active`);
            unlisten();
            await fetchPaymentHistory();
          } else {
            throw new Error(confirmResponse.data.error || 'Payment confirmation failed');
          }
        } catch (error: any) {
          errorMessage.value = error.message || 'Payment verification failed';
          paymentStep.value = 'error';
          processing.value = false;
          showErrorToast('Payment verification failed', error.message);
          unlisten();
        }
      });

      paymentStatus.value = 'Opening payment window...';
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await invoke('open_wallet_payment_window', {
        packKey: `sub_${selectedSubscription.value.id}`,
        packName: `${selectedSubscription.value.name} Subscription`,
        hours: selectedSubscription.value.monthly_credits,
        usd: quote.amount_usd,
        sol: quote.amount_sol,
        companyWallet: quote.company_wallet,
        authToken: authStore.token,
        apiBase,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (error: any) {
      errorMessage.value = error.message || 'Failed to process subscription';
      paymentStep.value = 'error';
      processing.value = false;
      showErrorToast('Payment failed', error.message);
    }
  }

  function cancelPaymentProcess() {
    processing.value = false;
    paymentStep.value = 'confirm';
    paymentStatus.value = '';
  }

  function closePaymentModal() {
    if (!processing.value) {
      showPaymentModal.value = false;
      selectedSubscription.value = null;
      paymentStep.value = 'confirm';
    }
  }
</script>

<style scoped>
  /* ===== Page Container ===== */
  .billing {
    width: 100%;
    min-height: 100%;
  }

  .billing__content {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .billing__loading {
    padding: 1.5rem;
  }

  /* ===== Page Heading ===== */
  .billing__heading {
    margin-bottom: 0.5rem;
  }

  .billing__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .billing__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Buy Credits Button ===== */
  .billing__buy-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 150ms ease;
  }

  .billing__buy-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .billing__buy-btn-icon {
    width: 15px;
    height: 15px;
  }

  /* ===== Subscription Indicator ===== */
  .billing-indicator {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .billing-indicator__skeleton {
    width: 120px;
    height: 20px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .billing-indicator__plan {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .billing-indicator__plan-icon {
    width: 14px;
    height: 14px;
    color: #fbbf24;
  }

  .billing-indicator__plan-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .billing-indicator__status {
    font-size: 0.5625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1875rem 0.375rem;
    border-radius: 4px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .billing-indicator__status--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .billing-indicator__status--warning {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .billing-indicator__status--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .billing-indicator__admin {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .billing-indicator__admin-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-accent);
  }

  .billing-indicator__admin-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .billing-indicator__divider {
    width: 1px;
    height: 20px;
    background-color: var(--sidebar-border);
  }

  .billing-indicator__credits {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .billing-indicator__credits-icon {
    width: 13px;
    height: 13px;
    color: var(--sidebar-accent);
  }

  .billing-indicator__credits-value {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--sidebar-accent);
    font-variant-numeric: tabular-nums;
  }

  .billing-indicator__credits-unit {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .billing-indicator__no-plan {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .billing-indicator__no-plan-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .billing-indicator__no-plan-text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Empty States ===== */
  .billing__empty-icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text-muted);
  }

  .billing__empty-icon--accent {
    color: var(--sidebar-accent);
  }

  .billing__signin-btn {
    padding: 0.75rem 1.5rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .billing__signin-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ===== Cards Grid ===== */
  .billing__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    .billing__cards {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* ===== Billing Card ===== */
  .billing-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .billing-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .billing-card__indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .billing-card__indicator--active {
    background-color: #10b981;
  }

  .billing-card__indicator--credits {
    background-color: var(--sidebar-accent);
  }

  .billing-card__inner {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .billing-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.875rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .billing-card__header-left {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .billing-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .billing-card__icon svg {
    width: 20px;
    height: 20px;
  }

  .billing-card__icon--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .billing-card__icon--credits {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .billing-card__header-text {
    flex: 1;
    min-width: 0;
  }

  .billing-card__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .billing-card__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .billing-card__body {
    padding: 1.5rem;
    flex: 1;
  }

  .billing-card__plan-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.625rem;
  }

  .billing-card__plan-name {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
  }

  .billing-card__status {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.3125rem 0.625rem;
    border-radius: 5px;
  }

  .billing-card__status--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .billing-card__status--warning {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .billing-card__status--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .billing-card__status--none {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .billing-card__info {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .billing-card__info-row {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .billing-card__info-row--warning {
    color: #fbbf24;
  }

  .billing-card__info-row--danger {
    color: #f87171;
  }

  .billing-card__info-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .billing-card__info-muted {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .billing-card__cancel-btn {
    padding: 0.5rem 0.875rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .billing-card__cancel-btn:hover:not(:disabled) {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background-color: rgba(248, 113, 113, 0.1);
  }

  .billing-card__cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Credits Card Specific */
  .billing-card__balance {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .billing-card__balance-value {
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--sidebar-accent);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .billing-card__balance-unit {
    font-size: 1rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .billing-card__usage {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .billing-card__usage-icon {
    width: 14px;
    height: 14px;
    color: #34d399;
  }

  .billing-card__allocations {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .billing-card__allocations-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.75rem;
  }

  .billing-card__allocations-icon {
    width: 12px;
    height: 12px;
  }

  .billing-card__allocations-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .billing-card__allocation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0.875rem;
    background-color: var(--sidebar-hover);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .billing-card__allocation-name {
    color: var(--sidebar-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .billing-card__allocation-value {
    font-weight: 600;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  /* ===== Billing Plans ===== */
  .billing-plans {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .billing-plans__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .billing-plans__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .billing-plans__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .billing-plans__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .billing-plans__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .billing-plans__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
    padding-top: 0.75rem;
  }

  @media (min-width: 768px) {
    .billing-plans__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* ===== Billing Tier Card ===== */
  .billing-tier {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: visible;
    transition: all 200ms ease;
    display: flex;
    flex-direction: column;
  }

  .billing-tier:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .billing-tier--popular {
    border-color: rgba(6, 182, 212, 0.4);
  }

  .billing-tier--popular:hover {
    border-color: rgba(6, 182, 212, 0.6);
  }

  .billing-tier--current {
    border-color: rgba(16, 185, 129, 0.4);
  }

  .billing-tier--current:hover {
    border-color: rgba(16, 185, 129, 0.6);
    transform: none;
  }

  .billing-tier__badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 20px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
  }

  .billing-tier__badge--current {
    background-color: #10b981;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .billing-tier__badge-icon {
    width: 11px;
    height: 11px;
  }

  .billing-tier__content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .billing-tier__header {
    margin-bottom: 1.25rem;
  }

  .billing-tier__name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.01em;
  }

  .billing-tier__price {
    display: flex;
    align-items: baseline;
  }

  .billing-tier__price-currency {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin-right: 0.125rem;
  }

  .billing-tier__price-amount {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .billing-tier__price-period {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin-left: 0.25rem;
  }

  .billing-tier__credits {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
    margin-bottom: 1.25rem;
  }

  .billing-tier__credits-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-accent);
  }

  .billing-tier__credits-value {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--sidebar-text);
  }

  .billing-tier__credits-label {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .billing-tier__divider {
    height: 1px;
    background-color: var(--sidebar-border);
    margin-bottom: 1.25rem;
  }

  .billing-tier__features {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .billing-tier__feature {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .billing-tier__feature-icon {
    width: 15px;
    height: 15px;
    color: #34d399;
    flex-shrink: 0;
  }

  .billing-tier__btn {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .billing-tier__btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .billing-tier__btn--primary {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .billing-tier__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
    background-color: var(--sidebar-accent);
    transform: translateY(-1px);
  }

  .billing-tier__btn--current {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
    cursor: default;
  }

  .billing-tier__btn--current:hover {
    background-color: rgba(16, 185, 129, 0.15);
    transform: none;
  }

  /* ===== Payment History ===== */
  .billing-history {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .billing-history__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .billing-history__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .billing-history__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .billing-history__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .billing-history__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .billing-history__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .billing-history__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .billing-history__spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--sidebar-border);
    border-top-color: var(--sidebar-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .billing-history__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
  }

  .billing-history__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background-color: var(--sidebar-hover);
    border-radius: 12px;
    margin-bottom: 1rem;
    color: var(--sidebar-text-muted);
  }

  .billing-history__empty-icon svg {
    width: 24px;
    height: 24px;
  }

  .billing-history__empty-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .billing-history__empty-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .billing-history__table {
    width: 100%;
    border-collapse: collapse;
  }

  .billing-history__table thead {
    border-bottom: 1px solid var(--sidebar-border);
  }

  .billing-history__table th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
  }

  .billing-history__table tbody tr {
    border-bottom: 1px solid var(--sidebar-border);
    transition: background-color 150ms ease;
  }

  .billing-history__table tbody tr:last-child {
    border-bottom: none;
  }

  .billing-history__table tbody tr:hover {
    background-color: var(--sidebar-hover);
  }

  .billing-history__table td {
    padding: 1rem 1.25rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  .billing-history__cell--date {
    font-weight: 500;
  }

  .billing-history__cell--desc {
    color: var(--sidebar-text-muted);
  }

  .billing-history__cell--amount {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .billing-history__cell--method {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--sidebar-text-muted);
    text-transform: capitalize;
  }

  .billing-history__cell--method svg {
    width: 14px;
    height: 14px;
  }

  .billing-history__type {
    display: inline-block;
    padding: 0.3125rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 5px;
  }

  .billing-history__type--sub {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .billing-history__type--credit {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .billing-history__status {
    display: inline-block;
    padding: 0.3125rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 5px;
    text-transform: capitalize;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .billing-history__status--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .billing-history__status--warning {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .billing-history__status--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  /* ===== Modal ===== */
  .billing-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .billing-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .billing-modal__accent-bar {
    height: 3px;
    background-color: var(--sidebar-accent);
  }

  .billing-modal__content {
    padding: 1.75rem;
  }

  .billing-modal__content--centered {
    text-align: center;
    padding: 2.5rem 1.75rem;
  }

  .billing-modal__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .billing-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.5rem;
  }

  .billing-modal__icon svg {
    width: 26px;
    height: 26px;
  }

  .billing-modal__icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .billing-modal__icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .billing-modal__icon--loading {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .billing-modal__icon-spinner {
    animation: spin 0.8s linear infinite;
  }

  .billing-modal__title {
    font-size: 1.1875rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .billing-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .billing-modal__body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .billing-modal__info {
    padding: 1.125rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
  }

  .billing-modal__info p {
    margin: 0;
  }

  .billing-modal__info strong {
    color: var(--sidebar-text);
  }

  .billing-modal__info-muted {
    margin-top: 0.625rem !important;
    opacity: 0.7;
  }

  .billing-modal__summary {
    padding: 1.125rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .billing-modal__summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    padding: 0.375rem 0;
  }

  .billing-modal__summary-row strong {
    color: var(--sidebar-text);
  }

  .billing-modal__summary-row--total {
    border-top: 1px solid var(--sidebar-border);
    margin-top: 0.625rem;
    padding-top: 0.875rem;
  }

  .billing-modal__summary-total {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--sidebar-accent);
  }

  .billing-modal__actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .billing-modal__payment-btns {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
  }

  .billing-modal__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .billing-modal__btn svg {
    width: 18px;
    height: 18px;
  }

  .billing-modal__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .billing-modal__btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .billing-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .billing-modal__btn--stripe {
    background-color: #635bff;
    color: white;
  }

  .billing-modal__btn--stripe:hover:not(:disabled) {
    background-color: #7a73ff;
  }

  .billing-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .billing-modal__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .billing-modal__btn--danger {
    background-color: #ef4444;
    color: white;
  }

  .billing-modal__btn--danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .billing-modal__btn--success {
    background-color: #10b981;
    color: white;
  }

  .billing-modal__btn--success:hover:not(:disabled) {
    background-color: #059669;
  }

  .billing-modal__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Skeleton Loaders ===== */
  .billing-skeleton {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .billing-skeleton__line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .billing-skeleton__line--sm {
    height: 14px;
    width: 70%;
  }

  .billing-skeleton__line--md {
    height: 18px;
    width: 85%;
  }

  .billing-skeleton__line--lg {
    height: 24px;
    width: 60%;
  }

  .billing-skeleton__line--xl {
    height: 36px;
    width: 40%;
  }

  .billing-skeleton__box {
    height: 48px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  .billing-skeleton__btn {
    height: 44px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  .billing-tier--skeleton {
    pointer-events: none;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
