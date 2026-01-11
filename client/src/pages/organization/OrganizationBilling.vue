<template>
  <PageLayout
    title="Billing & Credits"
    description="Manage your organization's credits and view payment history"
    :show-header="true"
    :icon="Wallet"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Billing & Credits' }]"
  >
    <template #actions>
      <Button v-if="isAdmin" @click="showBuyCreditsModal = true">
        <Wallet class="h-4 w-4 mr-1.5" />
        Buy Credits
      </Button>
    </template>

    <div class="org-billing">
      <!-- Credit Overview Cards -->
      <div class="org-billing__cards">
        <div class="org-billing__card org-billing__card--primary">
          <div class="org-billing__card-indicator org-billing__card-indicator--primary"></div>
          <div class="org-billing__card-inner">
            <div class="org-billing__card-header">
              <Wallet class="org-billing__card-icon org-billing__card-icon--primary" />
              <span class="org-billing__card-label">Pool Balance</span>
            </div>
            <div class="org-billing__card-value">{{ credits.hoursRemaining }} min</div>
            <div class="org-billing__card-desc">Available for allocation</div>
          </div>
        </div>
        <div class="org-billing__card">
          <div class="org-billing__card-indicator"></div>
          <div class="org-billing__card-inner">
            <div class="org-billing__card-header">
              <Clock class="org-billing__card-icon" />
              <span class="org-billing__card-label">Total Used</span>
            </div>
            <div class="org-billing__card-value">{{ credits.hoursUsed }} min</div>
            <div class="org-billing__card-desc">All time usage</div>
          </div>
        </div>
        <div class="org-billing__card">
          <div class="org-billing__card-indicator"></div>
          <div class="org-billing__card-inner">
            <div class="org-billing__card-header">
              <User class="org-billing__card-icon" />
              <span class="org-billing__card-label">My Allocation</span>
            </div>
            <div class="org-billing__card-value">{{ formatAllocation(myAllocation?.hours_remaining) }} min</div>
            <div class="org-billing__card-desc">Your remaining credits</div>
          </div>
        </div>
      </div>

      <!-- Member Allocations Section (Admin Only) -->
      <div v-if="isAdmin" class="org-billing__allocations">
        <div class="org-billing__section-header">
          <h3 class="org-billing__section-title">Member Allocations</h3>
          <span class="org-billing__section-count">({{ members.length }} members)</span>
        </div>

        <div v-if="poolBalance === 0" class="org-billing__warning">
          <AlertTriangle class="org-billing__warning-icon" />
          <span>Organization pool is empty. Buy credits to allocate to members.</span>
        </div>

        <div class="org-billing__allocation-list">
          <div v-for="member in members" :key="member.id" class="org-billing__allocation-card">
            <div class="org-billing__allocation-info">
              <div class="org-billing__allocation-name">
                {{ member.user?.name || member.user?.email }}
              </div>
              <div class="org-billing__allocation-meta">
                Allocated: {{ formatAllocation(member.allocation?.hours_allocated) }} min • Used:
                {{ formatAllocation(member.allocation?.hours_used) }} min •
                <span class="org-billing__allocation-remaining">
                  Remaining: {{ formatAllocation(member.allocation?.hours_remaining) }} min
                </span>
              </div>
            </div>
            <div class="org-billing__allocation-actions">
              <Input
                type="number"
                v-model="allocations[member.user_id]"
                min="0"
                :max="poolBalance"
                step="0.5"
                placeholder="0"
                class="org-billing__allocation-input"
                :disabled="poolBalance === 0"
              />
              <span class="org-billing__allocation-unit">min</span>
              <Button
                size="sm"
                @click="handleAllocateCredits(member.user_id)"
                :disabled="
                  poolBalance === 0 ||
                  !allocations[member.user_id] ||
                  allocations[member.user_id] <= 0 ||
                  allocations[member.user_id] > poolBalance
                "
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment History Section (Admin Only) -->
      <div v-if="isAdmin" class="org-billing__history">
        <div class="org-billing__section-header">
          <h3 class="org-billing__section-title">
            Payment History
            <span v-if="transactionsTotal > 0" class="org-billing__section-hint">({{ transactionsTotal }} total)</span>
          </h3>
          <button
            v-if="!transactionsLoaded"
            @click="loadTransactions(1)"
            class="org-billing__load-btn"
            :disabled="transactionsLoading"
          >
            <Loader2 v-if="transactionsLoading" class="org-billing__load-spinner" />
            <span>{{ transactionsLoading ? 'Loading...' : 'Load History' }}</span>
          </button>
          <button
            v-else-if="transactions.length > 0"
            @click="loadTransactions(transactionsPage)"
            class="org-billing__refresh-btn"
            :disabled="transactionsLoading"
          >
            <RefreshCw
              class="org-billing__refresh-icon"
              :class="{ 'org-billing__refresh-icon--spin': transactionsLoading }"
            />
            Refresh
          </button>
        </div>

        <!-- Not Loaded Yet -->
        <div v-if="!transactionsLoaded && !transactionsLoading" class="org-billing__empty">
          <Receipt class="org-billing__empty-icon" />
          <p class="org-billing__empty-text">Click "Load History" to view payment history</p>
        </div>

        <!-- Loading -->
        <div v-else-if="transactionsLoading && transactions.length === 0" class="org-billing__loading">
          <div v-for="i in 3" :key="i" class="org-billing__skeleton-row">
            <div class="org-billing__skeleton-icon"></div>
            <div class="org-billing__skeleton-content">
              <div class="org-billing__skeleton-line"></div>
              <div class="org-billing__skeleton-line org-billing__skeleton-line--short"></div>
            </div>
            <div class="org-billing__skeleton-amount"></div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="transactionsLoaded && transactions.length === 0" class="org-billing__empty">
          <Receipt class="org-billing__empty-icon" />
          <p class="org-billing__empty-text">No payment history yet</p>
          <p class="org-billing__empty-hint">Transactions will appear here after purchasing credits</p>
        </div>

        <!-- Transaction List -->
        <div v-else class="org-billing__transactions">
          <div class="org-billing__transactions-list">
            <div v-for="tx in transactions" :key="tx.id" class="org-billing__transaction">
              <div
                class="org-billing__transaction-icon"
                :class="
                  tx.payment_method === 'stripe'
                    ? 'org-billing__transaction-icon--stripe'
                    : 'org-billing__transaction-icon--crypto'
                "
              >
                <CreditCard v-if="tx.payment_method === 'stripe'" class="org-billing__transaction-icon-svg" />
                <Wallet v-else class="org-billing__transaction-icon-svg" />
              </div>
              <div class="org-billing__transaction-info">
                <div class="org-billing__transaction-header">
                  <span class="org-billing__transaction-pack">{{ getPackLabel(tx.pack_type) }}</span>
                  <span class="org-billing__transaction-status">{{ tx.status }}</span>
                </div>
                <div class="org-billing__transaction-meta">
                  <span>{{ formatTransactionDate(tx.purchased_at) }}</span>
                  <span class="org-billing__transaction-dot">•</span>
                  <span>{{ getPaymentMethodLabel(tx.payment_method) }}</span>
                  <template v-if="tx.purchased_by">
                    <span class="org-billing__transaction-dot">•</span>
                    <span>{{ tx.purchased_by.name || tx.purchased_by.email }}</span>
                  </template>
                </div>
              </div>
              <div class="org-billing__transaction-amount">
                <div class="org-billing__transaction-usd">${{ parseFloat(tx.amount_usd).toFixed(2) }}</div>
                <div class="org-billing__transaction-mins">+{{ parseFloat(tx.hours_purchased).toFixed(0) }} min</div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalTransactionPages > 1" class="org-billing__pagination">
            <span class="org-billing__pagination-info">
              Page {{ transactionsPage }} of {{ totalTransactionPages }} ({{ transactionsTotal }} transactions)
            </span>
            <div class="org-billing__pagination-btns">
              <button
                @click="loadTransactions(transactionsPage - 1)"
                :disabled="transactionsPage <= 1 || transactionsLoading"
                class="org-billing__pagination-btn"
              >
                <ChevronLeft class="org-billing__pagination-icon" />
                Previous
              </button>
              <button
                @click="loadTransactions(transactionsPage + 1)"
                :disabled="transactionsPage >= totalTransactionPages || transactionsLoading"
                class="org-billing__pagination-btn"
              >
                Next
                <ChevronRight class="org-billing__pagination-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Non-Admin View -->
      <div v-if="!isAdmin" class="org-billing__non-admin">
        <DollarSign class="org-billing__non-admin-icon" />
        <p class="org-billing__non-admin-text">Your credit allocation is shown above</p>
        <p class="org-billing__non-admin-hint">Contact an admin to request more credits</p>
      </div>
    </div>

    <!-- Buy Credits Modal -->
    <BuyCreditsModal
      v-model:open="showBuyCreditsModal"
      :organization-id="organizationId ?? ''"
      :organization-name="organization?.name ?? ''"
      @success="handleCreditsSuccess"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import {
    Wallet,
    Clock,
    User,
    AlertTriangle,
    Receipt,
    CreditCard,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    Loader2,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import PageLayout from '@/components/PageLayout.vue';
  import BuyCreditsModal from '@/components/organization/BuyCreditsModal.vue';
  import { useOrganization } from '@/composables/useOrganization';

  const {
    organizationId,
    organization,
    members,
    credits,
    myAllocation,
    isAdmin,
    poolBalance,
    transactions,
    transactionsLoading,
    transactionsTotal,
    transactionsPage,
    transactionsLoaded,
    totalTransactionPages,
    loadOrganization,
    loadTransactions,
    allocateCredits,
    formatAllocation,
    formatTransactionDate,
    getPaymentMethodLabel,
    getPackLabel,
  } = useOrganization();

  const showBuyCreditsModal = ref(false);
  const allocations = ref<Record<number, number>>({});

  async function handleAllocateCredits(userId: number) {
    const minutes = allocations.value[userId];
    const result = await allocateCredits(userId, minutes);
    if (result.success) {
      allocations.value[userId] = 0;
    }
  }

  function handleCreditsSuccess() {
    showBuyCreditsModal.value = false;
    loadOrganization();
  }
</script>

<style scoped>
  .org-billing {
    width: 100%;
    padding: 1.5rem;
  }

  /* Credit Cards */
  .org-billing__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  @media (min-width: 768px) {
    .org-billing__cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .org-billing__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-billing__card:hover {
    border-color: rgba(255, 255, 255, 0.08);
  }

  .org-billing__card--primary {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0.03) 100%);
    border-color: rgba(6, 182, 212, 0.2);
  }

  .org-billing__card--primary:hover {
    border-color: rgba(6, 182, 212, 0.35);
  }

  .org-billing__card-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-billing__card-indicator--primary {
    background-color: var(--sidebar-accent);
  }

  .org-billing__card-inner {
    flex: 1;
    padding: 1rem;
  }

  .org-billing__card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .org-billing__card-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .org-billing__card-icon--primary {
    color: var(--sidebar-accent);
  }

  .org-billing__card-label {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .org-billing__card-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
    opacity: 0.8;
  }

  /* Allocations */
  .org-billing__allocations {
    margin-bottom: 2rem;
  }

  .org-billing__section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .org-billing__section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .org-billing__section-count,
  .org-billing__section-hint {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 400;
  }

  .org-billing__warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: #fbbf24;
  }

  .org-billing__warning-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .org-billing__allocation-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-billing__allocation-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .org-billing__allocation-info {
    flex: 1;
    min-width: 0;
  }

  .org-billing__allocation-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-billing__allocation-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  .org-billing__allocation-remaining {
    color: var(--sidebar-accent);
    font-weight: 500;
  }

  .org-billing__allocation-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .org-billing__allocation-input {
    width: 80px;
    text-align: right;
    font-size: 0.875rem;
  }

  .org-billing__allocation-unit {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* Payment History */
  .org-billing__history {
    margin-top: 2rem;
  }

  .org-billing__load-btn,
  .org-billing__refresh-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--sidebar-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 150ms ease;
  }

  .org-billing__load-btn:hover,
  .org-billing__refresh-btn:hover {
    color: var(--sidebar-text);
  }

  .org-billing__load-btn:disabled,
  .org-billing__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-billing__load-spinner {
    width: 12px;
    height: 12px;
    animation: spin 0.8s linear infinite;
  }

  .org-billing__refresh-icon {
    width: 12px;
    height: 12px;
  }

  .org-billing__refresh-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .org-billing__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .org-billing__empty-icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    margin-bottom: 0.75rem;
  }

  .org-billing__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .org-billing__empty-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: 0.25rem 0 0;
  }

  .org-billing__loading {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-billing__skeleton-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .org-billing__skeleton-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-billing__skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-billing__skeleton-line {
    height: 16px;
    width: 120px;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-billing__skeleton-line--short {
    width: 180px;
    height: 12px;
  }

  .org-billing__skeleton-amount {
    width: 60px;
    height: 24px;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-billing__transactions-list {
    max-height: 480px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-right: 0.25rem;
  }

  .org-billing__transaction {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    transition: background-color 150ms ease;
  }

  .org-billing__transaction:hover {
    background-color: rgba(0, 0, 0, 0.3);
  }

  .org-billing__transaction-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-billing__transaction-icon--stripe {
    background-color: rgba(99, 91, 255, 0.1);
  }

  .org-billing__transaction-icon--stripe .org-billing__transaction-icon-svg {
    color: #635bff;
  }

  .org-billing__transaction-icon--crypto {
    background-color: rgba(139, 92, 246, 0.1);
  }

  .org-billing__transaction-icon--crypto .org-billing__transaction-icon-svg {
    color: #a78bfa;
  }

  .org-billing__transaction-icon-svg {
    width: 16px;
    height: 16px;
  }

  .org-billing__transaction-info {
    flex: 1;
    min-width: 0;
  }

  .org-billing__transaction-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .org-billing__transaction-pack {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-billing__transaction-status {
    font-size: 0.6875rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background-color: rgba(16, 185, 129, 0.1);
    color: #34d399;
  }

  .org-billing__transaction-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .org-billing__transaction-dot {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .org-billing__transaction-amount {
    text-align: right;
    flex-shrink: 0;
  }

  .org-billing__transaction-usd {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-billing__transaction-mins {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-accent);
  }

  .org-billing__pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.75rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 0.75rem;
  }

  .org-billing__pagination-info {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__pagination-btns {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .org-billing__pagination-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    background-color: rgba(0, 0, 0, 0.3);
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing__pagination-btn:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-billing__pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-billing__pagination-icon {
    width: 12px;
    height: 12px;
  }

  /* Non-Admin View */
  .org-billing__non-admin {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .org-billing__non-admin-icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    margin-bottom: 0.75rem;
  }

  .org-billing__non-admin-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .org-billing__non-admin-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: 0.25rem 0 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
