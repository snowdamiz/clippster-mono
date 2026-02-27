<template>
  <PageLayout
    title="Billing & Credits"
    description="Manage your organization's credits and view payment history"
    :show-header="true"
    :icon="Wallet"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Billing & Credits' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button v-if="isAdmin" size="sm" @click="showBuyCreditsModal = true" class="org-billing__buy-btn">
        <Plus class="org-billing__buy-btn-icon" />
        Buy Credits
      </Button>
    </template>

    <div class="org-billing">
      <!-- Page Heading -->
      <div class="org-billing__heading">
        <h1 class="org-billing__title">Billing, credits, and subscriptions</h1>
        <p class="org-billing__subtitle">
          Monitor your credit pool, allocate to team members, and track payment history
        </p>
      </div>

      <!-- Tab Navigation (Admin Only) -->
      <nav v-if="isAdmin" class="org-billing__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="org-billing__tab"
          :class="{ 'org-billing__tab--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" class="org-billing__tab-icon" />
          {{ tab.label }}
        </button>
      </nav>

      <!-- Member Allocations Section (Admin Only) -->
      <section v-if="isAdmin && activeTab === 'allocations'" class="org-billing__section">
        <!-- Credit Overview Cards -->
        <div class="org-billing__cards">
          <!-- Pool Balance Card -->
          <div class="org-billing__card org-billing__card--pool">
            <div class="org-billing__card-indicator org-billing__card-indicator--pool"></div>
            <div class="org-billing__card-inner">
              <div class="org-billing__card-header">
                <div class="org-billing__card-icon org-billing__card-icon--pool">
                  <Coins />
                </div>
                <div class="org-billing__card-header-text">
                  <h3 class="org-billing__card-title">Pool Balance</h3>
                  <p class="org-billing__card-subtitle">Available for allocation</p>
                </div>
              </div>
              <div class="org-billing__card-body">
                <div class="org-billing__card-value">
                  <span class="org-billing__card-amount org-billing__card-amount--pool">
                    {{ credits.hoursRemaining }}
                  </span>
                  <span class="org-billing__card-unit">min</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Total Used Card -->
          <div class="org-billing__card">
            <div class="org-billing__card-indicator"></div>
            <div class="org-billing__card-inner">
              <div class="org-billing__card-header">
                <div class="org-billing__card-icon">
                  <TrendingUp />
                </div>
                <div class="org-billing__card-header-text">
                  <h3 class="org-billing__card-title">Total Used</h3>
                  <p class="org-billing__card-subtitle">All time usage</p>
                </div>
              </div>
              <div class="org-billing__card-body">
                <div class="org-billing__card-value">
                  <span class="org-billing__card-amount">{{ credits.hoursUsed }}</span>
                  <span class="org-billing__card-unit">min</span>
                </div>
              </div>
            </div>
          </div>

          <!-- My Allocation Card -->
          <div class="org-billing__card org-billing__card--accent">
            <div class="org-billing__card-indicator org-billing__card-indicator--accent"></div>
            <div class="org-billing__card-inner">
              <div class="org-billing__card-header">
                <div class="org-billing__card-icon org-billing__card-icon--accent">
                  <User />
                </div>
                <div class="org-billing__card-header-text">
                  <h3 class="org-billing__card-title">My Allocation</h3>
                  <p class="org-billing__card-subtitle">Your remaining credits</p>
                </div>
              </div>
              <div class="org-billing__card-body">
                <div class="org-billing__card-value">
                  <span class="org-billing__card-amount org-billing__card-amount--accent">
                    {{ formatAllocation(myAllocation?.hours_remaining) }}
                  </span>
                  <span class="org-billing__card-unit">min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="org-billing__section-header">
          <div class="org-billing__section-title-group">
            <div class="org-billing__section-icon">
              <Users />
            </div>
            <div>
              <h2 class="org-billing__section-title">Member Allocations</h2>
              <p class="org-billing__section-subtitle">Distribute credits to {{ members.length }} team members</p>
            </div>
          </div>
        </div>

        <!-- Members Table -->
        <div class="org-billing__table-wrapper">
          <table class="org-billing__table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Allocated</th>
                <th>Used</th>
                <th>Remaining</th>
                <th>Pool Fallback</th>
                <th>Add Credits</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in members" :key="member.id" class="org-billing__table-row">
                <td>
                  <div class="org-billing__member-cell">
                    <div
                      class="org-billing__member-avatar"
                      :class="{ 'org-billing__member-avatar--has-image': member.user?.avatar_url && !avatarFailed[member.user_id] }"
                    >
                      <img
                        v-if="member.user?.avatar_url && !avatarFailed[member.user_id]"
                        :src="member.user.avatar_url"
                        :alt="member.user?.name || member.user?.email || 'User'"
                        class="org-billing__member-avatar-img"
                        referrerpolicy="no-referrer"
                        @error="avatarFailed[member.user_id] = true"
                      />
                      <span v-else>{{ getMemberInitials(member) }}</span>
                    </div>
                    <div class="org-billing__member-details">
                      <span class="org-billing__member-name">
                        {{ member.user?.name || member.user?.email }}
                      </span>
                      <span v-if="member.user?.name && member.user?.email" class="org-billing__member-email">
                        {{ member.user?.email }}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="org-billing__table-value">
                    {{ formatAllocation(member.allocation?.hours_allocated) }}
                    <span class="org-billing__table-value-unit">min</span>
                  </span>
                </td>
                <td>
                  <span class="org-billing__table-value org-billing__table-value--muted">
                    {{ formatAllocation(member.allocation?.hours_used) }}
                    <span class="org-billing__table-value-unit">min</span>
                  </span>
                </td>
                <td>
                  <span class="org-billing__table-value org-billing__table-value--accent">
                    {{ formatAllocation(member.allocation?.hours_remaining) }}
                    <span class="org-billing__table-value-unit">min</span>
                  </span>
                </td>
                <td>
                  <div class="org-billing__toggle-cell">
                    <button
                      class="org-billing__toggle"
                      :class="{ 'org-billing__toggle--active': member.allocation?.allow_pool_fallback }"
                      @click="handleTogglePoolFallback(member.user_id, !member.allocation?.allow_pool_fallback)"
                      :title="member.allocation?.allow_pool_fallback ? 'Disable pool fallback' : 'Enable pool fallback'"
                    >
                      <span class="org-billing__toggle-slider"></span>
                    </button>
                    <span class="org-billing__toggle-label">
                      {{ member.allocation?.allow_pool_fallback ? 'Enabled' : 'Disabled' }}
                    </span>
                  </div>
                </td>
                <td>
                  <div class="org-billing__allocate-form">
                    <div class="org-billing__input-wrap">
                      <Input
                        type="number"
                        v-model="allocations[member.user_id]"
                        min="0"
                        :max="poolBalance"
                        step="0.5"
                        placeholder="0"
                        class="org-billing__allocate-input"
                        :disabled="poolBalance === 0"
                      />
                      <span class="org-billing__input-unit">min</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="handleAllocateCredits(member.user_id)"
                      :disabled="
                        poolBalance === 0 ||
                        !allocations[member.user_id] ||
                        allocations[member.user_id] <= 0 ||
                        allocations[member.user_id] > poolBalance
                      "
                      class="org-billing__allocate-btn"
                    >
                      <Plus class="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Payment History Section (Admin Only) -->
      <section v-if="isAdmin && activeTab === 'history'" class="org-billing__section">
        <div class="org-billing__section-header">
          <div class="org-billing__section-title-group">
            <div class="org-billing__section-icon">
              <History />
            </div>
            <div>
              <h2 class="org-billing__section-title">Payment History</h2>
              <p class="org-billing__section-subtitle">
                {{
                  transactionsTotal > 0 ? `${transactionsTotal} transactions recorded` : 'Track all credit purchases'
                }}
              </p>
            </div>
          </div>
          <div class="org-billing__section-actions">
            <button
              v-if="!transactionsLoaded"
              @click="loadTransactions(1)"
              class="org-billing__load-btn"
              :disabled="transactionsLoading"
            >
              <Loader2 v-if="transactionsLoading" class="org-billing__load-btn-spinner" />
              <Download v-else class="org-billing__load-btn-icon" />
              <span>{{ transactionsLoading ? 'Loading...' : 'Load History' }}</span>
            </button>
            <button
              v-else-if="transactions.length > 0"
              @click="loadTransactions(transactionsPage)"
              class="org-billing__load-btn"
              :disabled="transactionsLoading"
            >
              <RefreshCw
                class="org-billing__load-btn-icon"
                :class="{ 'org-billing__load-btn-icon--spin': transactionsLoading }"
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- Not Loaded Yet -->
        <div v-if="!transactionsLoaded && !transactionsLoading" class="org-billing__empty-state">
          <div class="org-billing__empty-icon">
            <Receipt />
          </div>
          <h3 class="org-billing__empty-title">No history loaded</h3>
          <p class="org-billing__empty-desc">Click "Load History" to view your payment records</p>
        </div>

        <!-- Loading Skeleton -->
        <div v-else-if="transactionsLoading && transactions.length === 0" class="org-billing__skeleton-list">
          <div v-for="i in 3" :key="i" class="org-billing__skeleton-item">
            <div class="org-billing__skeleton-icon"></div>
            <div class="org-billing__skeleton-lines">
              <div class="org-billing__skeleton-line" style="width: 120px"></div>
              <div class="org-billing__skeleton-line org-billing__skeleton-line--sm" style="width: 200px"></div>
            </div>
            <div class="org-billing__skeleton-amount"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="transactionsLoaded && transactions.length === 0" class="org-billing__empty-state">
          <div class="org-billing__empty-icon">
            <Receipt />
          </div>
          <h3 class="org-billing__empty-title">No payment history</h3>
          <p class="org-billing__empty-desc">Transactions will appear here after purchasing credits</p>
        </div>

        <!-- Transaction List -->
        <div v-else class="org-billing__history-card">
          <div class="org-billing__history-list">
            <div v-for="tx in transactions" :key="tx.id" class="org-billing__history-item">
              <div
                class="org-billing__history-icon"
                :class="
                  tx.payment_method === 'stripe'
                    ? 'org-billing__history-icon--stripe'
                    : 'org-billing__history-icon--crypto'
                "
              >
                <CreditCard v-if="tx.payment_method === 'stripe'" />
                <Wallet v-else />
              </div>
              <div class="org-billing__history-info">
                <div class="org-billing__history-row">
                  <span class="org-billing__history-pack">{{ getPackLabel(tx.pack_type) }}</span>
                  <span class="org-billing__history-status">{{ tx.status }}</span>
                </div>
                <div class="org-billing__history-meta">
                  <span>{{ formatTransactionDate(tx.purchased_at) }}</span>
                  <span class="org-billing__history-dot">•</span>
                  <span>{{ getPaymentMethodLabel(tx.payment_method) }}</span>
                  <template v-if="tx.purchased_by">
                    <span class="org-billing__history-dot">•</span>
                    <span>{{ tx.purchased_by.name || tx.purchased_by.email }}</span>
                  </template>
                </div>
              </div>
              <div class="org-billing__history-amount">
                <span class="org-billing__history-usd">${{ parseFloat(tx.amount_usd).toFixed(2) }}</span>
                <span class="org-billing__history-mins">+{{ parseFloat(tx.hours_purchased).toFixed(0) }} min</span>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalTransactionPages > 1" class="org-billing__pagination">
            <span class="org-billing__pagination-info">Page {{ transactionsPage }} of {{ totalTransactionPages }}</span>
            <div class="org-billing__pagination-btns">
              <button
                @click="loadTransactions(transactionsPage - 1)"
                :disabled="transactionsPage <= 1 || transactionsLoading"
                class="org-billing__pagination-btn"
              >
                <ChevronLeft class="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                @click="loadTransactions(transactionsPage + 1)"
                :disabled="transactionsPage >= totalTransactionPages || transactionsLoading"
                class="org-billing__pagination-btn"
              >
                Next
                <ChevronRight class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Subscriptions Section (Admin Only) -->
      <section v-if="isAdmin && activeTab === 'subscriptions'" class="org-billing__section">
        <!-- Subscription Stats Cards -->
        <div class="org-billing__cards">
          <!-- Current Plan Card -->
          <div class="org-billing__card" :class="{ 'org-billing__card--active': hasActiveSubscription }">
            <div
              class="org-billing__card-indicator"
              :class="{
                'org-billing__card-indicator--active': hasActiveSubscription && subscription?.status === 'active',
                'org-billing__card-indicator--warning': subscription?.status === 'cancelled',
              }"
            ></div>
            <div class="org-billing__card-inner">
              <div class="org-billing__card-header">
                <div
                  class="org-billing__card-icon"
                  :class="{ 'org-billing__card-icon--active': hasActiveSubscription }"
                >
                  <Crown v-if="hasActiveSubscription" />
                  <CreditCard v-else />
                </div>
                <div class="org-billing__card-header-text">
                  <h3 class="org-billing__card-title">Current Plan</h3>
                  <p class="org-billing__card-subtitle">
                    {{ hasActiveSubscription ? subscription?.tier_name || 'Active' : 'No subscription' }}
                  </p>
                </div>
              </div>
              <div class="org-billing__card-body">
                <div v-if="hasActiveSubscription" class="org-billing__card-value">
                  <span
                    class="org-billing__card-status-badge"
                    :class="{
                      'org-billing__card-status-badge--active': subscription?.status === 'active',
                      'org-billing__card-status-badge--cancelled': subscription?.status === 'cancelled',
                    }"
                  >
                    {{ subscription?.status === 'active' ? 'Active' : 'Cancelled' }}
                  </span>
                </div>
                <div v-else class="org-billing__card-value">
                  <span class="org-billing__card-amount" style="font-size: 1.25rem">No active plan</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Seats Usage Card -->
          <div class="org-billing__card">
            <div class="org-billing__card-indicator"></div>
            <div class="org-billing__card-inner">
              <div class="org-billing__card-header">
                <div class="org-billing__card-icon">
                  <Users />
                </div>
                <div class="org-billing__card-header-text">
                  <h3 class="org-billing__card-title">Team Seats</h3>
                  <p class="org-billing__card-subtitle">Members in organization</p>
                </div>
              </div>
              <div class="org-billing__card-body">
                <div class="org-billing__card-value">
                  <span class="org-billing__card-amount">
                    {{ subscription?.current_members || members.length || 0 }}
                  </span>
                  <span class="org-billing__card-unit"> / </span>
                  <span class="org-billing__card-amount" style="color: var(--sidebar-text-muted)">
                    {{ subscription?.total_seats || '∞' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Monthly Credits Card -->
          <div class="org-billing__card org-billing__card--accent">
            <div class="org-billing__card-indicator org-billing__card-indicator--accent"></div>
            <div class="org-billing__card-inner">
              <div class="org-billing__card-header">
                <div class="org-billing__card-icon org-billing__card-icon--accent">
                  <Zap />
                </div>
                <div class="org-billing__card-header-text">
                  <h3 class="org-billing__card-title">Monthly Credits</h3>
                  <p class="org-billing__card-subtitle">From subscription</p>
                </div>
              </div>
              <div class="org-billing__card-body">
                <div class="org-billing__card-value">
                  <span class="org-billing__card-amount org-billing__card-amount--accent">
                    {{ subscription?.total_monthly_credits?.toLocaleString() || 0 }}
                  </span>
                  <span class="org-billing__card-unit">min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscription Overview Card (if subscribed) -->
        <div v-if="hasActiveSubscription" class="org-billing__subscription-card">
          <div
            class="org-billing__subscription-indicator"
            :class="{
              'org-billing__subscription-indicator--active': subscription?.status === 'active',
              'org-billing__subscription-indicator--cancelled': subscription?.status === 'cancelled',
            }"
          ></div>
          <div class="org-billing__subscription-inner">
            <div class="org-billing__subscription-header">
              <div class="org-billing__subscription-icon">
                <Crown v-if="subscription?.status === 'active'" />
                <AlertCircle v-else />
              </div>
              <div class="org-billing__subscription-header-text">
                <h3 class="org-billing__subscription-title">{{ subscription?.tier_name || 'Subscription' }}</h3>
                <p class="org-billing__subscription-subtitle">
                  {{ subscription?.status === 'active' ? 'Active' : 'Cancelled' }}
                </p>
              </div>
              <div v-if="subscription?.status === 'active' && isAdmin" class="org-billing__sub-actions">
                <button @click="showChangePlanDialog = true" class="org-billing__change-plan-btn">
                  Change Plan
                </button>
                <button @click="showCancelSubscriptionDialog = true" class="org-billing__cancel-btn">
                  Cancel
                </button>
              </div>
            </div>
            <div class="org-billing__subscription-body">
              <div class="org-billing__subscription-stats">
                <div class="org-billing__subscription-stat">
                  <Users class="org-billing__subscription-stat-icon" />
                  <div class="org-billing__subscription-stat-info">
                    <span class="org-billing__subscription-stat-value">
                      {{ subscription?.current_members || 0 }} / {{ subscription?.total_seats || '∞' }}
                    </span>
                    <span class="org-billing__subscription-stat-label">Seats Used</span>
                  </div>
                </div>
                <div class="org-billing__subscription-stat">
                  <Zap class="org-billing__subscription-stat-icon" />
                  <div class="org-billing__subscription-stat-info">
                    <span class="org-billing__subscription-stat-value">
                      {{ subscription?.total_monthly_credits?.toLocaleString() || 0 }}
                    </span>
                    <span class="org-billing__subscription-stat-label">Credits/Month</span>
                  </div>
                </div>
              </div>
              <div v-if="subscription?.pending_subscription_tier" class="org-billing__subscription-renewal org-billing__subscription-renewal--warning" style="margin-bottom: 0.5rem">
                <AlertTriangle class="org-billing__subscription-renewal-icon" />
                <span>Downgrading to {{ subscription.pending_subscription_tier }} at end of billing period</span>
              </div>
              <div v-if="subscription?.end_date" class="org-billing__subscription-renewal">
                <CalendarCheck class="org-billing__subscription-renewal-icon" />
                <span v-if="subscription.status === 'active'">
                  Renews {{ formatDate(subscription.end_date) }} ({{ subscription.days_remaining }} days)
                </span>
                <span v-else class="org-billing__subscription-renewal--warning">
                  Access until {{ formatDate(subscription.end_date) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscription Plans Section -->
        <div v-if="!hasActiveSubscription" class="org-billing__plans-section">
          <div class="org-billing__section-header">
            <div class="org-billing__section-title-group">
              <div class="org-billing__section-icon">
                <Sparkles />
              </div>
              <div>
                <h2 class="org-billing__section-title">Choose Your Plan</h2>
                <p class="org-billing__section-subtitle">Select a base subscription to get started</p>
              </div>
            </div>
          </div>

          <div class="org-billing__plans-grid">
            <div
              v-for="tier in sortedBaseTiers"
              :key="tier.id"
              class="org-billing__plan-card"
              :class="{ 'org-billing__plan-card--popular': tier.id === 'enterprise_ai' }"
            >
              <div class="org-billing__plan-content">
                <div v-if="tier.monthly_credits > 0" class="org-billing__plan-corner-badge">
                  <Star class="org-billing__plan-corner-badge-icon" />
                  <span>Includes AI</span>
                </div>
                <h3 class="org-billing__plan-name">{{ tier.name }}</h3>
                <div class="org-billing__plan-price">
                  <span class="org-billing__plan-price-currency">$</span>
                  <span class="org-billing__plan-price-amount">{{ tier.usd }}</span>
                  <span class="org-billing__plan-price-period">/mo</span>
                </div>
                <ul class="org-billing__plan-features">
                  <li class="org-billing__plan-feature">
                    <Check class="org-billing__plan-feature-icon" />
                    <span>{{ tier.seats === null ? 'Unlimited team seats' : tier.seats === 0 ? 'No team seats (owner only)' : `${tier.seats} team seats` }}</span>
                  </li>
                  <li v-if="tier.monthly_credits > 0" class="org-billing__plan-feature">
                    <Check class="org-billing__plan-feature-icon" />
                    <span>{{ tier.monthly_credits.toLocaleString() }} credits/month</span>
                  </li>
                  <li class="org-billing__plan-feature">
                    <Check class="org-billing__plan-feature-icon" />
                    <span>Team collaboration tools</span>
                  </li>
                  <li class="org-billing__plan-feature">
                    <Check class="org-billing__plan-feature-icon" />
                    <span>Shared assets & profiles</span>
                  </li>
                </ul>
                <Button
                  @click="selectSubscription(tier, 'base')"
                  class="org-billing__plan-btn"
                  :class="{ 'org-billing__plan-btn--primary': tier.id === 'enterprise_ai' }"
                >
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add-ons Section (only if has base subscription) -->
        <div v-if="hasActiveSubscription" class="org-billing__addons-section">
          <div class="org-billing__section-header">
            <div class="org-billing__section-title-group">
              <div class="org-billing__section-icon">
                <Package />
              </div>
              <div>
                <h2 class="org-billing__section-title">Add-ons</h2>
                <p class="org-billing__section-subtitle">Expand your organization's capacity</p>
              </div>
            </div>
          </div>

          <div class="org-billing__addons-grid">
            <div v-for="addon in availableAddons" :key="addon.id" class="org-billing__addon-card">
              <div class="org-billing__addon-content">
                <div v-if="addon.requires_ai" class="org-billing__addon-corner-badge">
                  <Star class="org-billing__addon-corner-badge-icon" />
                  <span>Includes AI</span>
                </div>
                <h3 class="org-billing__addon-name">{{ addon.name }}</h3>
                <div class="org-billing__addon-price">
                  <span class="org-billing__addon-price-currency">$</span>
                  <span class="org-billing__addon-price-amount">{{ addon.usd }}</span>
                  <span class="org-billing__addon-price-period">/mo</span>
                </div>
                <ul class="org-billing__addon-features">
                  <li class="org-billing__addon-feature">
                    <Check class="org-billing__addon-feature-icon" />
                    <span>{{ addon.seats }} seats</span>
                  </li>
                  <li v-if="addon.monthly_credits > 0" class="org-billing__addon-feature">
                    <Check class="org-billing__addon-feature-icon" />
                    <span>{{ addon.monthly_credits.toLocaleString() }} credits/month</span>
                  </li>
                </ul>
                <Button
                  @click="selectSubscription(addon, 'addon')"
                  class="org-billing__addon-btn"
                >
                  Add to Plan
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Non-Admin View -->
      <div v-if="!isAdmin" class="org-billing__member-view">
        <div class="org-billing__member-view-icon">
          <Zap />
        </div>
        <h3 class="org-billing__member-view-title">Your allocation is displayed above</h3>
        <p class="org-billing__member-view-desc">
          Contact your organization admin if you need additional credits allocated to your account
        </p>
      </div>
      
      <!-- Owner without subscription - redirect to subscription setup -->
      <div v-if="isAdmin && !hasActiveSubscription && activeTab === 'allocations'" class="org-billing__no-subscription">
        <div class="org-billing__no-subscription-icon">
          <Crown />
        </div>
        <h3 class="org-billing__no-subscription-title">No Active Subscription</h3>
        <p class="org-billing__no-subscription-desc">
          Your organization needs an active subscription to access credits and features.
        </p>
        <Button @click="activeTab = 'subscriptions'" size="lg">
          <Crown class="org-billing__no-subscription-btn-icon" />
          Set Up Subscription
        </Button>
      </div>
    </div>

    <!-- Buy Credits Modal -->
    <BuyCreditsModal
      v-model:open="showBuyCreditsModal"
      :organization-id="organizationId ?? ''"
      :organization-name="organization?.name ?? ''"
      @success="handleCreditsSuccess"
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
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showChangePlanDialog" class="org-billing-modal__overlay" @click.self="closeChangePlanDialog">
          <Transition name="dialog" appear>
            <div class="org-billing-modal" style="max-width: 520px">
              <div class="org-billing-modal__content">
                <div class="org-billing-modal__header">
                  <div class="org-billing-modal__icon" style="background-color: rgba(6, 182, 212, 0.15); color: #22d3ee">
                    <Crown />
                  </div>
                  <h2 class="org-billing-modal__title">Change Plan</h2>
                  <p class="org-billing-modal__subtitle">Current: {{ subscription?.tier_name }}</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem">
                  <button
                    v-for="tier in sortedBaseTiers.filter((t: any) => t.id !== subscription?.tier)"
                    :key="tier.id"
                    @click="selectChangePlanTier(tier.id)"
                    class="org-billing__tier-option"
                    :class="{ 'org-billing__tier-option--selected': changePlanTier === tier.id }"
                  >
                    <span class="org-billing__tier-option-name">{{ tier.name }}</span>
                    <span class="org-billing__tier-option-price">${{ tier.usd }}<span style="font-size:0.75rem;font-weight:400;color:var(--sidebar-text-muted)">/mo</span></span>
                    <span class="org-billing__tier-option-info">
                      {{ tier.seats === null ? '∞' : tier.seats === 0 ? '0' : tier.seats }} seats
                      <template v-if="tier.monthly_credits > 0"> · {{ tier.monthly_credits.toLocaleString() }}/mo</template>
                    </span>
                  </button>
                </div>

                <div v-if="prorationLoading" style="display:flex;justify-content:center;padding:1rem">
                  <Loader2 style="width:20px;height:20px;color:#22d3ee;animation:spin 1s linear infinite" />
                </div>

                <div v-if="prorationPreview && !prorationLoading" class="org-billing__proration-preview">
                  <div class="org-billing__proration-row">
                    <span>Type</span>
                    <span :style="{ color: prorationPreview.change_type === 'upgrade' ? '#4ade80' : '#fbbf24', fontWeight: 600 }">
                      {{ prorationPreview.change_type === 'upgrade' ? 'Upgrade' : 'Downgrade' }}
                    </span>
                  </div>
                  <div class="org-billing__proration-row">
                    <span>New price</span>
                    <span style="color:white;font-weight:600">${{ prorationPreview.new_price }}/mo</span>
                  </div>
                  <div v-if="prorationPreview.change_type === 'upgrade' && prorationPreview.proration_amount > 0" class="org-billing__proration-row">
                    <span>Prorated charge now</span>
                    <span style="color:white;font-weight:600">${{ prorationPreview.proration_amount }}</span>
                  </div>
                  <div class="org-billing__proration-row">
                    <span>Effective</span>
                    <span style="color:white">{{ prorationPreview.effective_date === 'immediate' ? 'Immediately' : formatDate(prorationPreview.effective_date) }}</span>
                  </div>
                </div>

                <div class="org-billing-modal__actions">
                  <button
                    class="org-billing-modal__btn org-billing-modal__btn--primary"
                    :disabled="!changePlanTier || changePlanLoading"
                    @click="handleChangePlan"
                  >
                    <Loader2 v-if="changePlanLoading" style="width:16px;height:16px;animation:spin 1s linear infinite" />
                    {{ changePlanLoading ? 'Changing...' : 'Confirm Change' }}
                  </button>
                  <button class="org-billing-modal__btn org-billing-modal__btn--secondary" @click="closeChangePlanDialog">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Cancel Subscription Confirmation -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCancelSubscriptionDialog" class="org-billing-modal__overlay" @click.self="showCancelSubscriptionDialog = false">
          <Transition name="dialog" appear>
            <div class="org-billing-modal">
              <div class="org-billing-modal__content">
                <div class="org-billing-modal__header">
                  <div class="org-billing-modal__icon org-billing-modal__icon--danger">
                    <AlertTriangle />
                  </div>
                  <h2 class="org-billing-modal__title">Cancel Subscription?</h2>
                  <p class="org-billing-modal__subtitle">Your organization will lose access after the current period ends</p>
                </div>

                <div class="org-billing-modal__body">
                  <div class="org-billing-modal__info">
                    <p>
                      Your subscription will remain active until
                      <strong>{{ formatDate(subscription?.end_date || '') }}</strong>.
                      After that, your organization will lose access to subscription features.
                    </p>
                    <p class="org-billing-modal__info-muted">Your credits will remain in your organization pool.</p>
                  </div>

                  <div class="org-billing-modal__actions">
                    <button class="org-billing-modal__btn org-billing-modal__btn--danger" @click="cancelSubscription">
                      Yes, Cancel Subscription
                    </button>
                    <button class="org-billing-modal__btn org-billing-modal__btn--secondary" @click="showCancelSubscriptionDialog = false">
                      Keep Subscription
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
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
    ChevronLeft,
    ChevronRight,
    Loader2,
    Plus,
    History,
    Download,
    Zap,
    Crown,
    AlertCircle,
    CalendarCheck,
    Sparkles,
    Star,
    Check,
    Package,
    X,
    AlertTriangle,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import BuyCreditsModal from '@/components/organization/BuyCreditsModal.vue';
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
    loadOrganization,
    loadSubscription,
    loadTransactions,
    allocateCredits,
    togglePoolFallback,
    formatAllocation,
    formatTransactionDate,
    getPaymentMethodLabel,
    getPackLabel,
    formatDate,
  } = useOrganization();

  const tabs = [
    { id: 'allocations', label: 'Credits', icon: markRaw(Users) },
    { id: 'history', label: 'History', icon: markRaw(History) },
    { id: 'subscriptions', label: 'Subscriptions', icon: markRaw(Crown) },
  ];

  const activeTab = ref('allocations');
  const showBuyCreditsModal = ref(false);
  const allocations = ref<Record<number, number>>({});
  const avatarFailed = ref<Record<number, boolean>>({});

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

  const availableAddons = computed(() => {
    if (!subscription.value) return [];
    
    // Show all add-ons sorted by seat count (smallest to largest)
    return [...addonTiers.value].sort((a, b) => a.seats - b.seats);
  });

  function getMemberInitials(member: any): string {
    const name = member.user?.name || member.user?.email || '';
    if (!name) return '??';
    const parts = name.split(/[\s@]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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

  function handleCreditsSuccess() {
    showBuyCreditsModal.value = false;
    loadOrganization();
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

<style scoped>
  /* ===== Container ===== */
  .org-billing {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  /* ===== Page Heading ===== */
  .org-billing__heading {
    margin-bottom: -0.3rem;
  }

  .org-billing__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.025em;
  }

  .org-billing__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Buy Credits Button ===== */
  .org-billing__buy-btn {
    height: 32px;
    padding: 0 0.75rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 150ms ease;
  }

  .org-billing__buy-btn:hover {
    opacity: 0.9;
  }

  .org-billing__buy-btn-icon {
    width: 14px;
    height: 14px;
    margin-right: 0.25rem;
  }

  /* ===== Cards Grid ===== */
  .org-billing__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
    margin-top: -0.5rem;
    margin-bottom: 0.7rem;
  }

  @media (min-width: 768px) {
    .org-billing__cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* ===== Card (Flat Style) ===== */
  .org-billing__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-billing__card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .org-billing__card-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-billing__card-indicator--pool {
    background-color: #10b981;
  }

  .org-billing__card-indicator--accent {
    background-color: var(--sidebar-accent);
  }

  .org-billing__card-indicator--active {
    background-color: #10b981;
  }

  .org-billing__card-indicator--warning {
    background-color: #fbbf24;
  }

  .org-billing__card-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .org-billing__card-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-billing__card-icon {
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

  .org-billing__card-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-billing__card-icon--pool {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-billing__card-icon--accent {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-billing__card-icon--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-billing__card-header-text {
    flex: 1;
    min-width: 0;
  }

  .org-billing__card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-billing__card-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-billing__card-body {
    padding: 1.25rem;
  }

  .org-billing__card-value {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
  }

  .org-billing__card-amount {
    font-size: 2rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.03em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .org-billing__card-amount--pool {
    color: #10b981;
  }

  .org-billing__card-amount--accent {
    color: var(--sidebar-accent);
  }

  .org-billing__card-unit {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .org-billing__card-status-badge {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-block;
  }

  .org-billing__card-status-badge--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .org-billing__card-status-badge--cancelled {
    background-color: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
  }

  /* ===== Tabs ===== */
  .org-billing__tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-billing__tab {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing__tab:hover {
    color: var(--sidebar-text);
  }

  .org-billing__tab--active {
    color: var(--sidebar-text);
    border-bottom-color: var(--sidebar-accent);
  }

  .org-billing__tab-icon {
    width: 15px;
    height: 15px;
  }

  /* ===== Section Styles ===== */
  .org-billing__section {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .org-billing__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .org-billing__section-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .org-billing__section-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-billing__section-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-billing__section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-billing__section-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-billing__section-actions {
    flex-shrink: 0;
  }

  /* ===== Table Wrapper ===== */
  .org-billing__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
  }

  .org-billing__table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .org-billing__table thead {
    background-color: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-billing__table th {
    padding: 0.875rem 1.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    text-align: left;
  }

  /* Column 1: Member - left aligned */
  .org-billing__table th:nth-child(1),
  .org-billing__table td:nth-child(1) {
    width: 25%;
    text-align: left;
  }

  /* Column 2: Allocated - right aligned */
  .org-billing__table th:nth-child(2),
  .org-billing__table td:nth-child(2) {
    width: 12%;
    text-align: right;
  }

  /* Column 3: Used - right aligned */
  .org-billing__table th:nth-child(3),
  .org-billing__table td:nth-child(3) {
    width: 12%;
    text-align: right;
  }

  /* Column 4: Remaining - right aligned */
  .org-billing__table th:nth-child(4),
  .org-billing__table td:nth-child(4) {
    width: 12%;
    text-align: right;
  }

  /* Column 5: Pool Fallback - center aligned */
  .org-billing__table th:nth-child(5),
  .org-billing__table td:nth-child(5) {
    width: 14%;
    text-align: center;
  }

  /* Column 6: Add Credits - right aligned */
  .org-billing__table th:nth-child(6),
  .org-billing__table td:nth-child(6) {
    width: 25%;
    text-align: right;
  }

  .org-billing__table-row {
    border-bottom: 1px solid var(--sidebar-border);
    transition: background-color 150ms ease;
  }

  .org-billing__table-row:last-child {
    border-bottom: none;
  }

  .org-billing__table-row:hover {
    background-color: var(--sidebar-hover);
  }

  .org-billing__table td {
    padding: 1rem 1.25rem;
    vertical-align: middle;
  }

  .org-billing__table-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .org-billing__table-value--muted {
    color: var(--sidebar-text-muted);
  }

  .org-billing__table-value--accent {
    color: var(--sidebar-accent);
  }

  .org-billing__table-value-unit {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin-left: 0.25rem;
  }

  /* ===== Toggle Cell ===== */
  .org-billing__toggle-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .org-billing__toggle {
    position: relative;
    width: 44px;
    height: 24px;
    background-color: var(--sidebar-border);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 200ms ease;
    padding: 0;
  }

  .org-billing__toggle:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .org-billing__toggle--active {
    background-color: var(--sidebar-accent);
  }

  .org-billing__toggle--active:hover {
    background-color: rgba(6, 182, 212, 0.8);
  }

  .org-billing__toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background-color: white;
    border-radius: 50%;
    transition: transform 200ms ease;
  }

  .org-billing__toggle--active .org-billing__toggle-slider {
    transform: translateX(20px);
  }

  .org-billing__toggle-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  /* ===== Member Cell ===== */
  .org-billing__member-cell {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .org-billing__member-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--sidebar-accent), rgba(6, 182, 212, 0.6));
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--sidebar-bg);
    flex-shrink: 0;
    overflow: hidden;
  }

  .org-billing__member-avatar--has-image {
    background: transparent;
  }

  .org-billing__member-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-billing__member-details {
    min-width: 0;
  }

  .org-billing__member-name {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .org-billing__member-email {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.125rem;
  }

  /* ===== Allocate Form ===== */
  .org-billing__allocate-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .org-billing__input-wrap {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .org-billing__allocate-input {
    width: 72px;
    text-align: right;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }

  .org-billing__input-unit {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__allocate-btn {
    font-size: 0.75rem;
    gap: 0.25rem;
  }

  /* ===== Load Button ===== */
  .org-billing__load-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing__load-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .org-billing__load-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-billing__load-btn-icon {
    width: 16px;
    height: 16px;
  }

  .org-billing__load-btn-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .org-billing__load-btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Empty State ===== */
  .org-billing__empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    text-align: center;
  }

  .org-billing__empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .org-billing__empty-icon svg {
    width: 28px;
    height: 28px;
    color: var(--sidebar-accent);
  }

  .org-billing__empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .org-billing__empty-desc {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 300px;
  }

  /* ===== Skeleton Loaders ===== */
  .org-billing__skeleton-list {
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
  }

  .org-billing__skeleton-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-billing__skeleton-item:last-child {
    border-bottom: none;
  }

  .org-billing__skeleton-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-billing__skeleton-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-billing__skeleton-line {
    height: 14px;
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

  .org-billing__skeleton-line--sm {
    height: 12px;
  }

  .org-billing__skeleton-amount {
    width: 70px;
    height: 40px;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      var(--sidebar-hover) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      var(--sidebar-hover) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  /* ===== History Card ===== */
  .org-billing__history-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
  }

  .org-billing__history-list {
    max-height: 440px;
    overflow-y: auto;
  }

  .org-billing__history-list::-webkit-scrollbar {
    width: 6px;
  }

  .org-billing__history-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-billing__history-list::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .org-billing__history-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
    transition: background-color 150ms ease;
  }

  .org-billing__history-item:last-child {
    border-bottom: none;
  }

  .org-billing__history-item:hover {
    background-color: var(--sidebar-hover);
  }

  .org-billing__history-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-billing__history-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-billing__history-icon--stripe {
    background-color: rgba(99, 91, 255, 0.12);
    color: #635bff;
  }

  .org-billing__history-icon--crypto {
    background-color: rgba(139, 92, 246, 0.12);
    color: #a78bfa;
  }

  .org-billing__history-info {
    flex: 1;
    min-width: 0;
  }

  .org-billing__history-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .org-billing__history-pack {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-billing__history-status {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background-color: rgba(16, 185, 129, 0.12);
    color: #34d399;
  }

  .org-billing__history-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .org-billing__history-dot {
    opacity: 0.4;
  }

  .org-billing__history-amount {
    text-align: right;
    flex-shrink: 0;
  }

  .org-billing__history-usd {
    display: block;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-billing__history-mins {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    margin-top: 0.125rem;
  }

  /* ===== Pagination ===== */
  .org-billing__pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
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
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: var(--sidebar-hover);
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing__pagination-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .org-billing__pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ===== Non-Admin View ===== */
  .org-billing__member-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, transparent 60%);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 12px;
    text-align: center;
  }

  .org-billing__member-view-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(6, 182, 212, 0.15);
    margin-bottom: 1.25rem;
  }

  .org-billing__member-view-icon svg {
    width: 28px;
    height: 28px;
    color: var(--sidebar-accent);
  }

  .org-billing__member-view-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .org-billing__member-view-desc {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 360px;
    line-height: 1.5;
  }

  /* ===== No Subscription View ===== */
  .org-billing__no-subscription {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    background: var(--sidebar-card);
    border-radius: 12px;
    border: 1px solid var(--sidebar-border);
    text-align: center;
  }

  .org-billing__no-subscription-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, var(--sidebar-accent-hover) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
  }

  .org-billing__no-subscription-icon svg {
    width: 28px;
    height: 28px;
    color: white;
  }

  .org-billing__no-subscription-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-billing__no-subscription-desc {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 400px;
  }

  .org-billing__no-subscription-btn-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Subscription Card ===== */
  .org-billing__subscription-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .org-billing__subscription-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-billing__subscription-indicator--active {
    background-color: #10b981;
  }

  .org-billing__subscription-indicator--cancelled {
    background-color: #fbbf24;
  }

  .org-billing__subscription-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .org-billing__subscription-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-billing__subscription-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-billing__subscription-icon svg {
    width: 24px;
    height: 24px;
  }

  .org-billing__subscription-header-text {
    flex: 1;
  }

  .org-billing__subscription-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .org-billing__subscription-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .org-billing__sub-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .org-billing__change-plan-btn {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #22d3ee;
    background: transparent;
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing__change-plan-btn:hover {
    background-color: rgba(6, 182, 212, 0.1);
  }

  .org-billing__cancel-btn {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing__cancel-btn:hover {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background-color: rgba(248, 113, 113, 0.1);
  }

  .org-billing__tier-option {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid var(--sidebar-border);
    background: var(--sidebar-hover);
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-billing__tier-option:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .org-billing__tier-option--selected {
    border-color: rgba(6, 182, 212, 0.6);
    background: rgba(6, 182, 212, 0.1);
    box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.3);
  }

  .org-billing__tier-option-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin-bottom: 0.25rem;
  }

  .org-billing__tier-option-price {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin-bottom: 0.5rem;
  }

  .org-billing__tier-option-info {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__proration-preview {
    padding: 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .org-billing__proration-row {
    display: flex;
    justify-content: space-between;
    padding: 0.375rem 0;
    color: var(--sidebar-text-muted);
  }

  .org-billing__proration-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .org-billing__subscription-body {
    padding: 1.5rem;
  }

  .org-billing__subscription-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .org-billing__subscription-stat {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .org-billing__subscription-stat-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
  }

  .org-billing__subscription-stat-info {
    display: flex;
    flex-direction: column;
  }

  .org-billing__subscription-stat-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
  }

  .org-billing__subscription-stat-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .org-billing__subscription-renewal {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__subscription-renewal-icon {
    width: 14px;
    height: 14px;
  }

  .org-billing__subscription-renewal--warning {
    color: #fbbf24;
  }

  /* ===== Plans Section ===== */
  .org-billing__plans-section,
  .org-billing__addons-section {
    margin-bottom: 2rem;
  }

  .org-billing__plans-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
    margin-top: 1.6rem;
  }

  @media (min-width: 768px) {
    .org-billing__plans-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .org-billing__plans-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .org-billing__plan-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-billing__plan-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .org-billing__plan-card--popular {
    border-color: rgba(6, 182, 212, 0.4);
  }

  .org-billing__plan-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 1.5rem;
  }

  .org-billing__plan-corner-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    background: linear-gradient(135deg, var(--sidebar-accent), rgba(6, 182, 212, 0.8));
    color: var(--sidebar-bg);
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
  }

  .org-billing__plan-corner-badge-icon {
    width: 11px;
    height: 11px;
  }

  .org-billing__plan-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-billing__plan-price {
    display: flex;
    align-items: baseline;
    margin-bottom: 1.5rem;
  }

  .org-billing__plan-price-currency {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-billing__plan-price-amount {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.03em;
  }

  .org-billing__plan-price-period {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin-left: 0.25rem;
  }

  .org-billing__plan-features {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .org-billing__plan-feature {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__plan-feature-icon {
    width: 15px;
    height: 15px;
    color: #34d399;
    flex-shrink: 0;
  }

  .org-billing__plan-btn {
    width: 100%;
    margin-top: auto;
  }

  .org-billing__plan-btn--primary {
    background-color: var(--sidebar-accent) !important;
    color: var(--sidebar-bg) !important;
  }

  /* ===== Add-ons Grid ===== */
  .org-billing__addons-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
    margin-top: 1rem;
  }

  @media (min-width: 640px) {
    .org-billing__addons-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .org-billing__addons-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .org-billing__addon-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-billing__addon-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .org-billing__addon-content {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 1.5rem;
  }

  .org-billing__addon-corner-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    background: linear-gradient(135deg, var(--sidebar-accent), rgba(6, 182, 212, 0.8));
    color: var(--sidebar-bg);
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
  }

  .org-billing__addon-corner-badge-icon {
    width: 11px;
    height: 11px;
  }

  .org-billing__addon-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-billing__addon-price {
    display: flex;
    align-items: baseline;
    margin-bottom: 1.5rem;
  }

  .org-billing__addon-price-currency {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-billing__addon-price-amount {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.03em;
  }

  .org-billing__addon-price-period {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin-left: 0.25rem;
  }

  .org-billing__addon-features {
    list-style: none;
    margin: 0 0 1.5rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .org-billing__addon-feature {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .org-billing__addon-feature-icon {
    width: 15px;
    height: 15px;
    color: #34d399;
    flex-shrink: 0;
  }

  .org-billing__addon-btn {
    width: 100%;
    margin-top: auto;
  }

  /* ===== Modal Styles ===== */
  .org-billing-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .org-billing-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .org-billing-modal__accent-bar {
    height: 3px;
    background-color: var(--sidebar-accent);
  }

  .org-billing-modal__content {
    padding: 1.75rem;
  }

  .org-billing-modal__content--centered {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .org-billing-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .org-billing-modal__close {
    position: absolute;
    top: 0;
    right: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-billing-modal__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-billing-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .org-billing-modal__icon svg {
    width: 26px;
    height: 26px;
  }

  .org-billing-modal__icon--loading {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-billing-modal__icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .org-billing-modal__icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-billing-modal__icon-spinner {
    animation: spin 0.8s linear infinite;
  }

  .org-billing-modal__title {
    font-size: 1.1875rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .org-billing-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .org-billing-modal__body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .org-billing-modal__summary {
    padding: 1.125rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .org-billing-modal__summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    padding: 0.375rem 0;
  }

  .org-billing-modal__summary-row strong {
    color: var(--sidebar-text);
  }

  .org-billing-modal__summary-row--total {
    border-top: 1px solid var(--sidebar-border);
    margin-top: 0.625rem;
    padding-top: 0.875rem;
  }

  .org-billing-modal__summary-total {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--sidebar-accent);
  }

  .org-billing-modal__info {
    padding: 1.125rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
  }

  .org-billing-modal__info p {
    margin: 0 0 0.5rem;
  }

  .org-billing-modal__info p:last-child {
    margin-bottom: 0;
  }

  .org-billing-modal__info strong {
    color: var(--sidebar-text);
  }

  .org-billing-modal__info-muted {
    opacity: 0.7;
  }

  .org-billing-modal__actions {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .org-billing-modal__payment-btns {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
  }

  .org-billing-modal__btn {
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

  .org-billing-modal__btn svg {
    width: 18px;
    height: 18px;
  }

  .org-billing-modal__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-billing-modal__btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .org-billing-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-billing-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .org-billing-modal__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
  }

  .org-billing-modal__btn--danger {
    background-color: #ef4444;
    color: white;
  }

  .org-billing-modal__btn--danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .org-billing-modal__btn--success {
    background-color: #10b981;
    color: white;
  }

  .org-billing-modal__btn--success:hover:not(:disabled) {
    background-color: #059669;
  }

  /* ===== Modal Animations ===== */
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

  /* ===== Animations ===== */
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
