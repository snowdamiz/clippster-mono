<template>
  <div class="billing">
    <PageLayout
      title="Billing"
      description="Manage your subscription and view payment history"
      :show-header="true"
      :icon="Receipt"
    >
      <template #actions>
        <!-- Logout Button (always visible when authenticated) -->
        <button
          v-if="authStore.isAuthenticated"
          @click="handleLogout"
          class="billing-logout-btn"
          title="Log out"
        >
          <LogOut class="billing-logout-btn__icon" />
          <span class="billing-logout-btn__text">Log Out</span>
        </button>
        
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

      <div class="billing__wrapper" :class="{ 'billing__wrapper--empty': !authStore.isAuthenticated }">
        <!-- Not Authenticated -->
        <div v-if="!authStore.isAuthenticated" class="billing__empty">
          <div class="billing__empty-icon-wrapper">
            <Receipt class="billing__empty-icon" />
          </div>
          <h3 class="billing__empty-title">Sign in to view billing</h3>
          <p class="billing__empty-description">Access your subscription details and payment history</p>
        </div>

        <div v-else class="billing__content">
          <!-- Subscription Gate Banner -->
          <div v-if="isSubscriptionGateMode" class="billing__gate-banner">
            <div class="billing__gate-banner-content">
              <AlertCircle class="billing__gate-banner-icon" />
              <div class="billing__gate-banner-text">
                <h3 class="billing__gate-banner-title">
                  {{ isExpiredSubscription ? 'Your subscription has expired' : 'Welcome to Clippster!' }}
                </h3>
                <p class="billing__gate-banner-description">
                  {{ isExpiredSubscription ? 'Please renew your subscription or continue with the free tier to regain access.' : 'Choose a plan to get started with Clippster.' }}
                </p>
              </div>
            </div>
          </div>

          <!-- Page Heading -->
          <div class="billing__heading">
            <h1 class="billing__title">Billing</h1>
            <p class="billing__subtitle">View your current plan, credit balance, and payment history</p>
          </div>

          <!-- Current Subscription & Credits Row -->
          <div class="billing__cards">
            <!-- Current Subscription Card -->
            <div class="billing-card" :class="{ 'billing-card--active': !loadingBalance && hasActiveSubscription }">
              <div
                class="billing-card__indicator"
                :class="{ 'billing-card__indicator--active': !loadingBalance && hasActiveSubscription }"
              ></div>
              <div class="billing-card__inner">
                <div class="billing-card__header">
                  <div class="billing-card__header-left">
                    <div
                      class="billing-card__icon"
                      :class="{ 'billing-card__icon--active': !loadingBalance && hasActiveSubscription }"
                    >
                      <Crown v-if="!loadingBalance && hasActiveSubscription" />
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
                  <div class="billing-card__plan-row">
                    <span class="billing-card__plan-name">
                      <template v-if="loadingBalance">
                        <span class="billing-skeleton__inline billing-skeleton__inline--lg"></span>
                      </template>
                      <template v-else>
                        {{ subscriptionStatus?.tier_name || 'No Subscription' }}
                      </template>
                    </span>
                    <span v-if="!loadingBalance" class="billing-card__status" :class="statusBadgeClass">
                      {{ statusBadgeText }}
                    </span>
                    <span v-else class="billing-skeleton__inline billing-skeleton__inline--badge"></span>
                  </div>
                  <p class="billing-card__info">
                    <template v-if="loadingBalance">
                      <span class="billing-skeleton__inline billing-skeleton__inline--md"></span>
                    </template>
                    <template v-else-if="subscriptionStatus?.status === 'active'">
                      <span class="billing-card__info-row">
                        <CalendarCheck class="billing-card__info-icon" />
                        Renews {{ formatDate(subscriptionStatus?.end_date) }}
                        <span class="billing-card__info-muted">({{ subscriptionStatus?.days_remaining }} days)</span>
                      </span>
                      <span v-if="subscriptionStatus?.pending_subscription_tier" class="billing-card__info-row billing-card__info-row--warning" style="margin-top: 4px;">
                        <Clock class="billing-card__info-icon" />
                        Switching to {{ subscriptionStatus?.pending_subscription_tier_name }} at period end
                        <button class="billing-card__cancel-pending" @click="cancelPendingChange">undo</button>
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
                </div>
              </div>
            </div>

            <!-- Credit Balance Card -->
            <div class="billing-card billing-card--credits">
              <div class="billing-card__indicator billing-card__indicator--credits"></div>
              <div class="billing-card__inner">
                <div class="billing-card__header">
                  <div class="billing-card__header-left">
                    <div class="billing-card__icon billing-card__icon--credits">
                      <Coins />
                    </div>
                    <div class="billing-card__header-text">
                      <h2 class="billing-card__title">Credit Balance</h2>
                      <p class="billing-card__subtitle">Available processing time</p>
                    </div>
                  </div>
                  <button
                    v-if="!loadingBalance && typeof hoursRemaining === 'number'"
                    @click="showBuyCreditsModal = true"
                    class="billing-card__buy-btn"
                  >
                    Buy Credits
                  </button>
                </div>

                <div class="billing-card__body">
                  <div class="billing-card__balance">
                    <template v-if="loadingBalance">
                      <span class="billing-skeleton__inline billing-skeleton__inline--xl"></span>
                    </template>
                    <template v-else>
                      <span class="billing-card__balance-value">
                        {{ typeof hoursRemaining === 'number' ? Math.round(hoursRemaining) : hoursRemaining }}
                      </span>
                      <span class="billing-card__balance-unit">min</span>
                    </template>
                  </div>
                  <div class="billing-card__usage">
                    <TrendingUp class="billing-card__usage-icon" />
                    <template v-if="loadingBalance">
                      <span class="billing-skeleton__inline billing-skeleton__inline--sm"></span>
                    </template>
                    <template v-else>
                      <span>{{ Math.round(hoursUsed) }} min used total</span>
                    </template>
                  </div>

                  <!-- Organization Allocations -->
                  <div v-if="!loadingBalance && organizationAllocations.length > 0" class="billing-card__allocations">
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
                  <template v-if="loadingBalance">Choose a Plan</template>
                  <template v-else>{{ hasActiveSubscription ? 'Change Plan' : 'Choose a Plan' }}</template>
                </h2>
                <p class="billing-plans__subtitle">Select the plan that works best for you</p>
              </div>

              <!-- Monthly/Yearly Toggle -->
              <div class="billing-plans__toggle">
                <button
                  class="billing-plans__toggle-btn"
                  :class="{ 'billing-plans__toggle-btn--active': billingInterval === 'monthly' }"
                  @click="billingInterval = 'monthly'"
                >
                  Monthly
                </button>
                <button
                  class="billing-plans__toggle-btn"
                  :class="{ 'billing-plans__toggle-btn--active': billingInterval === 'yearly' }"
                  @click="billingInterval = 'yearly'"
                >
                  Yearly
                  <span class="billing-plans__toggle-save">Save 1 month</span>
                </button>
              </div>
            </div>

            <div class="billing-plans__grid">
              <!-- Loading skeleton tiers -->
              <template v-if="loadingTiers">
                <div v-for="i in 3" :key="i" class="billing-tier billing-tier--skeleton">
                  <div class="billing-tier__content">
                    <div class="billing-tier__header">
                      <h3 class="billing-tier__name">
                        <span class="billing-skeleton__inline" style="width: 80px; height: 18px"></span>
                      </h3>
                      <div class="billing-tier__price">
                        <span class="billing-skeleton__inline" style="width: 70px; height: 40px"></span>
                      </div>
                    </div>

                    <div class="billing-tier__credits billing-tier__credits--skeleton">
                      <span class="billing-skeleton__inline" style="width: 100%; height: 100%"></span>
                    </div>

                    <div class="billing-tier__divider"></div>

                    <ul class="billing-tier__features">
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>Mobile App</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>Full app access</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>AI clip detection</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>Credits roll over</span>
                      </li>
                    </ul>

                    <button class="billing-tier__btn" disabled>
                      <span class="billing-skeleton__inline" style="width: 80px; height: 16px"></span>
                    </button>
                  </div>
                </div>
              </template>
              <!-- Loaded tiers -->
              <template v-else>
                <!-- Free Tier Card (always visible) -->
                <div
                  class="billing-tier billing-tier--free"
                  :class="{ 'billing-tier--current': !hasActiveSubscription }"
                >
                  <!-- Current Badge for free tier -->
                  <div v-if="!hasActiveSubscription" class="billing-tier__badge billing-tier__badge--current">
                    <Check class="billing-tier__badge-icon" />
                    <span>Current Plan</span>
                  </div>

                  <div class="billing-tier__content">
                    <div class="billing-tier__header">
                      <h3 class="billing-tier__name">Free</h3>
                      <div class="billing-tier__price">
                        <span class="billing-tier__price-currency">$</span>
                        <span class="billing-tier__price-amount">0</span>
                        <span class="billing-tier__price-period">/mo</span>
                      </div>
                    </div>

                    <div class="billing-tier__credits billing-tier__credits--free">
                      <Zap class="billing-tier__credits-icon" />
                      <span class="billing-tier__credits-value">60</span>
                      <span class="billing-tier__credits-label">one-time credits</span>
                    </div>

                    <div class="billing-tier__divider"></div>

                    <ul class="billing-tier__features">
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>Mobile App</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>5 clip builds/day</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>1 editor export/day</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>2 VOD downloads/day</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon billing-tier__feature-icon--muted" />
                        <span>Admin watermark applied</span>
                      </li>
                      <li class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No social posting</span>
                      </li>
                      <li class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No AI Video Creator</span>
                      </li>
                      <li class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No campaign participation</span>
                      </li>
                    </ul>

                    <button
                      class="billing-tier__btn"
                      :class="{
                        'billing-tier__btn--free': !hasActiveSubscription && !isSubscriptionGateMode,
                        'billing-tier__btn--continue-free': isSubscriptionGateMode || isNewUserFlow,
                      }"
                      :disabled="(!hasActiveSubscription && !isSubscriptionGateMode && !isNewUserFlow) || pendingDowngradeToFree"
                      @click="isSubscriptionGateMode || isNewUserFlow ? continueWithFree() : confirmDowngradeToFree()"
                    >
                      <span v-if="isSubscriptionGateMode || isNewUserFlow">Continue with Free Plan</span>
                      <span v-else-if="!hasActiveSubscription">Current Plan</span>
                      <span v-else-if="pendingDowngradeToFree">Downgrading at period end</span>
                      <span v-else>Switch Plan</span>
                    </button>
                  </div>
                </div>

                <!-- Basic Tier Card -->
                <div
                  v-if="subscriptionTiers.find(t => t.id === 'basic')"
                  class="billing-tier"
                  :class="{ 'billing-tier--current': isCurrentTier('basic') }"
                >
                  <!-- Current Badge -->
                  <div v-if="isCurrentTier('basic')" class="billing-tier__badge billing-tier__badge--current">
                    <Check class="billing-tier__badge-icon" />
                    <span>Current Plan</span>
                  </div>

                  <div class="billing-tier__content">
                    <div class="billing-tier__header">
                      <h3 class="billing-tier__name">Basic</h3>
                      <div class="billing-tier__price">
                        <span class="billing-tier__price-currency">$</span>
                        <span class="billing-tier__price-amount">{{ billingInterval === 'yearly' ? '142.89' : '12.99' }}</span>
                        <span class="billing-tier__price-period">{{ billingInterval === 'yearly' ? '/yr' : '/mo' }}</span>
                      </div>
                      <div v-if="billingInterval === 'yearly'" class="billing-tier__price-effective">
                        $11.91/mo effective
                      </div>
                    </div>

                    <div class="billing-tier__credits billing-tier__credits--free">
                      <Zap class="billing-tier__credits-icon" />
                      <span class="billing-tier__credits-value">0</span>
                      <span class="billing-tier__credits-label">credits/month</span>
                    </div>

                    <div class="billing-tier__divider"></div>

                    <ul class="billing-tier__features">
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Mobile App</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Unlimited clip builds</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Social posting &amp; scheduling</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Campaign participation</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Custom watermark &amp; intro/outro</span>
                      </li>
                      <li class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No AI clip detection</span>
                      </li>
                      <li class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No AI Video Creator</span>
                      </li>
                      <li class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No organization membership</span>
                      </li>
                      <li class="billing-tier__feature" style="font-size: 0.75rem; color: rgb(156, 163, 175);">
                        <span>Large credit pack only (1,800 @ $39.99)</span>
                      </li>
                    </ul>

                    <button
                      class="billing-tier__btn"
                      :class="{ 'billing-tier__btn--current': isCurrentTier('basic') }"
                      @click="handleBasicTierClick"
                      :disabled="isCurrentTier('basic') || isPendingTier('basic')"
                    >
                      <span v-if="isCurrentTier('basic')">Current Plan</span>
                      <span v-else-if="isPendingTier('basic')">Switching at period end</span>
                      <span v-else-if="hasActiveSubscription">Switch Plan</span>
                      <span v-else>Get Started</span>
                    </button>
                  </div>
                </div>

                <!-- Paid Tiers (Starter, Creator, Pro) -->
                <div
                  v-for="tier in subscriptionTiers.filter(t => t.id !== 'basic')"
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
                        <span class="billing-tier__price-amount">{{ getDisplayPrice(tier) }}</span>
                        <span class="billing-tier__price-period">{{ billingInterval === 'yearly' ? '/yr' : '/mo' }}</span>
                      </div>
                      <div v-if="billingInterval === 'yearly'" class="billing-tier__price-effective">
                        ${{ getEffectiveMonthly(tier) }}/mo effective
                      </div>
                    </div>

                    <div class="billing-tier__credits">
                      <Zap class="billing-tier__credits-icon" />
                      <span class="billing-tier__credits-value">
                        {{ billingInterval === 'yearly' ? (tier.monthly_credits * 12).toLocaleString() : tier.monthly_credits.toLocaleString() }}
                      </span>
                      <span class="billing-tier__credits-label">
                        {{ billingInterval === 'yearly' ? 'credits upfront' : 'credits/month' }}
                      </span>
                    </div>

                    <div class="billing-tier__divider"></div>

                    <ul class="billing-tier__features">
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Mobile App</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Unlimited clip builds</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>AI clip detection</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Custom watermark &amp; intro/outro</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Social posting &amp; scheduling</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Organization membership</span>
                      </li>
                      <li v-if="tier.id === 'creator' || tier.id === 'pro'" class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>AI Video Creator</span>
                      </li>
                      <li class="billing-tier__feature">
                        <Check class="billing-tier__feature-icon" />
                        <span>Credits roll over</span>
                      </li>
                      <li v-if="tier.id === 'starter'" class="billing-tier__feature billing-tier__feature--disabled">
                        <X class="billing-tier__feature-icon billing-tier__feature-icon--disabled" />
                        <span>No AI Video Creator</span>
                      </li>
                    </ul>

                    <button
                      class="billing-tier__btn"
                      :class="{
                        'billing-tier__btn--current': isCurrentTier(tier.id),
                        'billing-tier__btn--primary': tier.id === 'creator' && !isCurrentTier(tier.id),
                      }"
                      @click="handleTierClick(tier)"
                      :disabled="isCurrentTier(tier.id) || isPendingTier(tier.id)"
                    >
                      <span v-if="isCurrentTier(tier.id)">Current Plan</span>
                      <span v-else-if="isPendingTier(tier.id)">Switching at period end</span>
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
              <!-- Always show table structure, rows show loading or content -->
              <table class="billing-history__table">
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
                  <!-- Loading skeleton rows -->
                  <template v-if="loadingHistory">
                    <tr v-for="i in 3" :key="'skeleton-' + i" class="billing-history__row--skeleton">
                      <td><span class="billing-skeleton__inline billing-skeleton__inline--sm"></span></td>
                      <td><span class="billing-skeleton__inline billing-skeleton__inline--badge"></span></td>
                      <td><span class="billing-skeleton__inline billing-skeleton__inline--md"></span></td>
                      <td><span class="billing-skeleton__inline" style="width: 50px; height: 14px"></span></td>
                      <td><span class="billing-skeleton__inline" style="width: 60px; height: 14px"></span></td>
                      <td><span class="billing-skeleton__inline billing-skeleton__inline--badge"></span></td>
                    </tr>
                  </template>
                  <!-- Empty state row -->
                  <template v-else-if="paymentHistory.length === 0">
                    <tr>
                      <td colspan="6">
                        <div class="billing-history__empty">
                          <div class="billing-history__empty-icon">
                            <Receipt />
                          </div>
                          <p class="billing-history__empty-title">No payment history yet</p>
                          <p class="billing-history__empty-subtitle">Your transactions will appear here</p>
                        </div>
                      </td>
                    </tr>
                  </template>
                  <!-- Actual data rows -->
                  <template v-else>
                    <tr v-for="payment in paymentHistory" :key="payment.id">
                      <td class="billing-history__cell--date">{{ formatDate(payment.date) }}</td>
                      <td>
                        <span
                          class="billing-history__type"
                          :class="
                            payment.type === 'subscription'
                              ? 'billing-history__type--sub'
                              : 'billing-history__type--credit'
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
                  </template>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Deactivate Profile Section -->
          <section v-if="authStore.isAuthenticated" class="billing-deactivate">
            <div class="billing-deactivate__header">
              <div class="billing-deactivate__header-icon">
                <AlertTriangle />
              </div>
              <div class="billing-deactivate__header-text">
                <h2 class="billing-deactivate__title">Danger Zone</h2>
                <p class="billing-deactivate__subtitle">Irreversible account actions</p>
              </div>
            </div>
            <div class="billing-deactivate__card">
              <div class="billing-deactivate__info">
                <h3 class="billing-deactivate__info-title">Deactivate Profile</h3>
                <p class="billing-deactivate__info-desc">
                  Deactivating your profile will cancel any active subscription and disable your account.
                  Your data will be preserved and you can contact support to reactivate.
                </p>
              </div>
              <button class="billing-deactivate__btn" @click="showDeactivateConfirm = true">
                Deactivate Profile
              </button>
            </div>
          </section>
        </div>
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

    <!-- Tier Change Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showTierChangeConfirm" class="billing-modal__overlay" @click.self="showTierChangeConfirm = false">
          <Transition name="dialog" appear>
            <div class="billing-modal">
              <div class="billing-modal__header">
                <div class="billing-modal__icon" :class="tierChangeIsUpgrade ? 'billing-modal__icon--accent' : 'billing-modal__icon--warning'">
                  <TrendingUp v-if="tierChangeIsUpgrade" />
                  <AlertTriangle v-else />
                </div>
                <h2 class="billing-modal__title">
                  {{ tierChangeIsUpgrade ? 'Upgrade Plan' : 'Switch Plan' }}
                </h2>
              </div>

              <div class="billing-modal__body">
                <div class="billing-modal__info">
                  <p v-if="tierChangeIsUpgrade">
                    You'll be upgraded to <strong>{{ tierChangeTarget?.name }}</strong> immediately.
                    A prorated charge will be applied for the remainder of your billing period.
                  </p>
                  <p v-else>
                    Your plan will switch to <strong>{{ tierChangeTarget?.name }}</strong> at the end of your current billing period
                    (<strong>{{ formatDate(subscriptionStatus?.end_date) }}</strong>).
                    You'll keep your current plan until then.
                  </p>
                  <p v-if="tierChangeIsUpgrade" class="billing-modal__info-muted">
                    You'll also receive {{ tierChangeCreditDiff }} additional credits now.
                  </p>
                  <p v-if="tierChangeTarget?.id === 'basic'" class="billing-modal__info-warning" style="color: rgb(239, 68, 68); font-weight: 600; margin-top: 12px;">
                    ⚠️ Downgrading to Basic will remove all your AI credits. This cannot be undone.
                  </p>
                </div>

                <div class="billing-modal__actions">
                  <button
                    @click="executeTierChange"
                    class="billing-modal__btn"
                    :class="tierChangeIsUpgrade ? 'billing-modal__btn--primary' : 'billing-modal__btn--danger'"
                    :disabled="changingTier"
                  >
                    {{ changingTier ? 'Processing...' : (tierChangeIsUpgrade ? 'Confirm Upgrade' : 'Confirm Switch') }}
                  </button>
                  <button @click="showTierChangeConfirm = false" class="billing-modal__btn billing-modal__btn--secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Downgrade to Free Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showFreeDowngradeConfirm" class="billing-modal__overlay" @click.self="showFreeDowngradeConfirm = false">
          <Transition name="dialog" appear>
            <div class="billing-modal">
              <div class="billing-modal__header">
                <div class="billing-modal__icon billing-modal__icon--warning">
                  <AlertTriangle />
                </div>
                <h2 class="billing-modal__title">Switch to Free Plan?</h2>
              </div>

              <div class="billing-modal__body">
                <div class="billing-modal__info">
                  <p>
                    Your subscription will be cancelled at the end of your billing period
                    (<strong>{{ formatDate(subscriptionStatus?.end_date) }}</strong>).
                    You'll keep your current plan until then.
                  </p>
                  <p class="billing-modal__info-muted">
                    On the free plan you'll have daily limits and admin watermarks. Your remaining credits will stay in your account but you will <strong>not</strong> receive the 60 free credits again.
                  </p>
                </div>

                <div class="billing-modal__actions">
                  <button
                    @click="executeDowngradeToFree"
                    class="billing-modal__btn billing-modal__btn--danger"
                    :disabled="cancellingSubscription"
                  >
                    {{ cancellingSubscription ? 'Processing...' : 'Yes, Switch to Free' }}
                  </button>
                  <button @click="showFreeDowngradeConfirm = false" class="billing-modal__btn billing-modal__btn--secondary">
                    Keep Current Plan
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Deactivate Profile Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeactivateConfirm" class="billing-modal__overlay" @click.self="showDeactivateConfirm = false">
          <Transition name="dialog" appear>
            <div class="billing-modal">
              <div class="billing-modal__header">
                <div class="billing-modal__icon billing-modal__icon--danger">
                  <AlertTriangle />
                </div>
                <h2 class="billing-modal__title">Deactivate Profile?</h2>
              </div>

              <div class="billing-modal__body">
                <div class="billing-modal__info">
                  <p>
                    This will deactivate your profile and cancel any active subscription.
                    Your account data will be preserved but you won't be able to use Clippster until you reactivate.
                  </p>
                  <p class="billing-modal__info-muted">
                    Type <strong>DEACTIVATE</strong> to confirm.
                  </p>
                  <input
                    v-model="deactivateInput"
                    type="text"
                    class="billing-modal__input"
                    placeholder="Type DEACTIVATE"
                    autocomplete="off"
                  />
                </div>

                <div class="billing-modal__actions">
                  <button
                    @click="executeDeactivateProfile"
                    class="billing-modal__btn billing-modal__btn--danger"
                    :disabled="deactivateInput !== 'DEACTIVATE' || deactivatingProfile"
                  >
                    {{ deactivatingProfile ? 'Deactivating...' : 'Deactivate Profile' }}
                  </button>
                  <button @click="showDeactivateConfirm = false; deactivateInput = ''" class="billing-modal__btn billing-modal__btn--secondary">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Buy Credits Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showBuyCreditsModal"
          class="credits-dialog__overlay"
          @click.self="closeCreditPackModal"
          @keydown.esc="closeCreditPackModal"
        >
          <Transition name="dialog" appear>
            <div v-if="showBuyCreditsModal" class="credits-dialog" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="credits-dialog__accent"></div>

              <!-- Pack Selection Step -->
              <template v-if="creditPackPaymentStep === 'select'">
                <!-- Header -->
                <div class="credits-dialog__header credits-dialog__header--simple">
                  <button
                    class="credits-dialog__close"
                    @click="closeCreditPackModal"
                    title="Close"
                    :disabled="creditPackProcessing"
                  >
                    <X :size="18" />
                  </button>
                  <h2 class="credits-dialog__title">Buy Credits</h2>
                </div>

                <!-- Content -->
                <div class="credits-dialog__content">
                  <div class="credits-dialog__packs">
                    <button
                      v-for="(pack, key) in sortedCreditPacks"
                      :key="key"
                      @click="selectCreditPack(key as string, pack)"
                      class="credits-dialog__pack"
                      :class="{ 'credits-dialog__pack--selected': selectedCreditPack?.key === key }"
                    >
                      <div class="credits-dialog__pack-content">
                        <h3 class="credits-dialog__pack-name">{{ pack.name }}</h3>
                        <div class="credits-dialog__pack-price">
                          <span class="credits-dialog__pack-price-currency">$</span>
                          <span class="credits-dialog__pack-price-amount">{{
                            pack.usd % 1 === 0 ? pack.usd : pack.usd.toFixed(2)
                          }}</span>
                        </div>
                        <ul class="credits-dialog__pack-features">
                          <li class="credits-dialog__pack-feature">
                            <Zap class="credits-dialog__pack-feature-icon" />
                            <span>{{ pack.hours.toLocaleString() }} credits</span>
                          </li>
                        </ul>
                      </div>
                    </button>
                  </div>
                </div>
              </template>

              <!-- Processing Step -->
              <template v-else-if="creditPackPaymentStep === 'processing'">
                <div class="credits-dialog__centered">
                  <Loader2 class="credits-dialog__spinner" />
                  <h3 class="credits-dialog__centered-title">Processing Payment</h3>
                  <p class="credits-dialog__centered-subtitle">{{ creditPackPaymentStatus }}</p>
                  <button class="credits-dialog__btn credits-dialog__btn--secondary" @click="closeCreditPackModal">
                    Cancel
                  </button>
                </div>
              </template>

              <!-- Success Step -->
              <template v-else-if="creditPackPaymentStep === 'success'">
                <div class="credits-dialog__centered">
                  <div class="credits-dialog__success-icon">
                    <Check :size="32" />
                  </div>
                  <h3 class="credits-dialog__centered-title">Credits Added!</h3>
                  <p class="credits-dialog__centered-subtitle">
                    {{ selectedCreditPack?.hours }} credits added to your account
                  </p>
                  <button class="credits-dialog__btn credits-dialog__btn--primary" @click="closeCreditPackModal">
                    Done
                  </button>
                </div>
              </template>

              <!-- Error Step -->
              <template v-else-if="creditPackPaymentStep === 'error'">
                <div class="credits-dialog__centered">
                  <div class="credits-dialog__error-icon">
                    <AlertTriangle :size="32" />
                  </div>
                  <h3 class="credits-dialog__centered-title">Payment Failed</h3>
                  <p class="credits-dialog__centered-subtitle">{{ creditPackErrorMessage }}</p>
                  <div class="credits-dialog__footer">
                    <button
                      class="credits-dialog__btn credits-dialog__btn--secondary"
                      @click="creditPackPaymentStep = 'select'"
                    >
                      Try Again
                    </button>
                    <button class="credits-dialog__btn credits-dialog__btn--primary" @click="closeCreditPackModal">
                      Close
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Subscribe Dialog -->
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
  </div>
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
    LogOut,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SubscribeDialog from '@/components/SubscribeDialog.vue';

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

  // Buy Credits modal
  const showBuyCreditsModal = ref(false);
  const creditPacks = ref<any>({});
  const selectedCreditPack = ref<any>(null);
  const creditPackPaymentStep = ref<'select' | 'processing' | 'success' | 'error'>('select');
  const creditPackProcessing = ref(false);
  const creditPackPaymentStatus = ref('');
  const creditPackErrorMessage = ref('');

  // Tier hierarchy for upgrade/downgrade detection
  const TIER_HIERARCHY: Record<string, number> = { basic: 0.5, starter: 1, creator: 2, pro: 3 };

  // Computed values
  const sortedCreditPacks = computed(() => {
    return Object.entries(creditPacks.value)
      .sort(([, a], [, b]) => (a as any).usd - (b as any).usd)
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, any>);
  });

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

  function getStatusClass(status: string): string {
    if (status === 'active' || status === 'confirmed') return 'billing-history__status--success';
    if (status === 'pending') return 'billing-history__status--warning';
    if (status === 'cancelled' || status === 'failed') return 'billing-history__status--danger';
    return '';
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
    await fetchCreditPacks();
    
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

  async function fetchCreditPacks() {
    try {
      const response = await api.get('/pricing');
      if (response.data.success) {
        creditPacks.value = response.data.packs;
      }
    } catch (error: any) {
      console.error('Failed to fetch credit packs:', error);
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

  /** Continue with free tier — mark plan selected and go to default route */
  function continueWithFree() {
    localStorage.setItem('has_selected_plan', 'true');
    // Trigger auth state refresh to update gates
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { userId: authStore.user?.id } }));
    const targetRoute = getDefaultRoute(authStore.user);
    router.push(targetRoute);
  }

  /** Handle logout - always accessible */
  async function handleLogout() {
    await authStore.logout();
    router.push('/');
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

  function selectCreditPack(packKey: string, pack: any) {
    selectedCreditPack.value = {
      key: packKey,
      hours: pack.hours,
      usd: pack.usd,
      name: pack.name,
    };
    initiateCreditPackPayment();
  }

  async function initiateCreditPackPayment() {
    if (!selectedCreditPack.value) return;

    creditPackProcessing.value = true;
    creditPackPaymentStep.value = 'processing';
    creditPackPaymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const response = await api.post('/payments/stripe/create-session', {
        pack_type: selectedCreditPack.value.key,
        return_context: 'desktop',
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }

      const { url: checkoutUrl } = response.data;

      const unlisten = await listen('stripe-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        if (paymentResult.success) {
          creditPackPaymentStep.value = 'success';
          creditPackProcessing.value = false;
          showSuccessToast('Payment successful', 'Credits added to your account');
          unlisten();

          setTimeout(async () => {
            await fetchBalance();
            await fetchPaymentHistory();
            closeCreditPackModal();
          }, 2000);
        } else {
          unlisten();
        }
      });

      creditPackPaymentStatus.value = 'Opening payment page...';
      await invoke('open_stripe_payment_window', {
        checkoutUrl: checkoutUrl,
        packKey: selectedCreditPack.value.key,
        packHours: selectedCreditPack.value.hours,
      });

      creditPackPaymentStatus.value = 'Complete payment in your browser...';
    } catch (error: any) {
      creditPackErrorMessage.value = error.message || 'Failed to create checkout session';
      creditPackPaymentStep.value = 'error';
      creditPackProcessing.value = false;
      showErrorToast('Payment failed', error.message || 'An error occurred');
    }
  }

  function closeCreditPackModal() {
    showBuyCreditsModal.value = false;
    selectedCreditPack.value = null;
    creditPackPaymentStep.value = 'select';
    creditPackErrorMessage.value = '';
    creditPackProcessing.value = false;
  }

</script>

<style scoped>
  /* ===== Page Container ===== */
  .billing {
    width: 100%;
    min-height: 100%;
  }

  .billing__wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: 1;
  }

  .billing__wrapper--empty {
    justify-content: center;
    align-items: center;
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
    margin: 0 0 0.2rem;
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
  .billing__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .billing__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .billing__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .billing__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .billing__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
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

  .billing-card__buy-btn {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #8b5cf6 100%);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .billing-card__buy-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
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

  .billing-plans__toggle {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 3px;
    margin-left: auto;
  }

  .billing-plans__toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .billing-plans__toggle-btn--active {
    background: var(--sidebar-accent);
    color: white;
    box-shadow: 0 1px 4px rgba(6, 182, 212, 0.3);
  }

  .billing-plans__toggle-save {
    font-size: 0.625rem;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.2);
    color: rgb(16, 185, 129);
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .billing-plans__free-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0;
  }

  .billing-plans__free-btn {
    padding: 10px 28px;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: transparent;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .billing-plans__free-btn:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--sidebar-text-muted);
    color: var(--sidebar-text);
  }

  .billing-plans__free-hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
  }

  .billing-tier__price-effective {
    font-size: 0.6875rem;
    color: rgb(16, 185, 129);
    font-weight: 500;
    margin-top: 2px;
  }

  .billing-plans__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
    margin-top: 1.5rem;
  }

  @media (min-width: 768px) {
    .billing-plans__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .billing-plans__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Logout Button ===== */
  .billing-logout-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #ef4444;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    margin-right: 0.75rem;
  }

  .billing-logout-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .billing-logout-btn__icon {
    width: 16px;
    height: 16px;
  }

  .billing-logout-btn__text {
    white-space: nowrap;
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
    cursor: pointer;
  }

  .billing-tier:hover {
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }

  .billing-tier--popular {
    border-color: rgba(6, 182, 212, 0.4);
  }

  .billing-tier--popular:hover {
    border-color: rgba(6, 182, 212, 0.8);
    box-shadow: 0 4px 20px rgba(6, 182, 212, 0.25), 0 0 0 1px rgba(6, 182, 212, 0.5);
  }

  .billing-tier--current {
    border-color: rgba(16, 185, 129, 0.4);
  }

  .billing-tier--current:hover {
    border-color: rgba(16, 185, 129, 0.6);
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.2), 0 0 0 1px rgba(16, 185, 129, 0.4);
    transform: translateY(-1px);
  }

  .billing-tier--free {
    border-color: rgba(255, 255, 255, 0.05);
    opacity: 0.85;
  }

  .billing-tier--free:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
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

  .billing-tier__credits--skeleton {
    background-color: transparent;
    border-color: var(--sidebar-border);
    padding: 0;
    height: 46px;
    overflow: hidden;
  }

  .billing-tier__credits--skeleton .billing-skeleton__inline {
    border-radius: 8px;
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

  .billing-tier__feature-icon--muted {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .billing-tier__feature--disabled {
    opacity: 0.4;
  }

  .billing-tier__feature-icon--disabled {
    color: #ef4444;
  }

  .billing-tier__credits--free {
    background-color: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.05);
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

  .billing-tier__btn--free {
    background-color: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
    color: var(--sidebar-text-muted);
    cursor: default;
  }

  .billing-tier__btn--free:hover {
    background-color: rgba(255, 255, 255, 0.03);
    transform: none;
  }

  .billing-tier__btn--continue-free {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .billing-tier__btn--continue-free:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
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

  .billing-history__row--skeleton:hover {
    background-color: transparent;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .billing-modal__content--centered .billing-modal__btn {
    width: 100%;
    margin-top: 0.5rem;
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
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: var(--sidebar-accent);
  }

  .billing-modal__icon-spinner {
    width: 26px;
    height: 26px;
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

  .billing-modal__summary-row--discount {
    color: #10b981;
  }

  .billing-modal__summary-discount {
    font-weight: 600;
    color: #10b981;
  }

  .billing-modal__promo {
    padding: 1.125rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .billing-modal__promo-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .billing-modal__promo-toggle:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .billing-modal__promo-icon {
    width: 16px;
    height: 16px;
  }

  .billing-modal__promo-input-wrapper {
    margin-top: 0.75rem;
  }

  .billing-modal__promo-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .billing-modal__promo-input {
    flex: 1;
    padding: 0.625rem 0.75rem;
    background-color: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .billing-modal__promo-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
  }

  .billing-modal__promo-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .billing-modal__promo-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .billing-modal__promo-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .billing-modal__promo-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .billing-modal__promo-btn-spinner {
    animation: spin 1s linear infinite;
  }

  .billing-modal__promo-btn-icon {
    width: 16px;
    height: 16px;
  }

  .billing-modal__promo-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem;
    background-color: transparent;
    color: var(--sidebar-text-muted);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .billing-modal__promo-clear:hover {
    background-color: var(--sidebar-hover);
    color: #f87171;
  }

  .billing-modal__promo-clear-icon {
    width: 16px;
    height: 16px;
  }

  .billing-modal__promo-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem;
    margin-top: 0.5rem;
    background-color: rgba(248, 113, 113, 0.1);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #f87171;
  }

  .billing-modal__promo-error-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .billing-modal__promo-success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem;
    margin-top: 0.5rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #10b981;
    font-weight: 500;
  }

  .billing-modal__promo-success-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .promo-enter-active,
  .promo-leave-active {
    transition: all 150ms ease;
  }

  .promo-enter-from,
  .promo-leave-to {
    opacity: 0;
    transform: translateY(-10px);
  }

  .promo-enter-to,
  .promo-leave-from {
    opacity: 1;
    transform: translateY(0);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Buy Credits Dialog (matches org modal) ===== */
  .credits-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .credits-dialog {
    position: relative;
    background-color: var(--sidebar-bg);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .credits-dialog__accent {
    height: 4px;
    background: linear-gradient(90deg, var(--sidebar-accent) 0%, #8b5cf6 100%);
  }

  .credits-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    z-index: 10;
  }

  .credits-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .credits-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-dialog__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 2rem 1.5rem;
    text-align: center;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .credits-dialog__header--simple {
    align-items: flex-start;
    padding: 1.5rem 2rem;
    text-align: left;
  }

  .credits-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #8b5cf6 100%);
    border-radius: 12px;
    color: white;
    margin-bottom: 1rem;
  }

  .credits-dialog__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .credits-dialog__header--simple .credits-dialog__title {
    margin: 0;
    font-size: 1.25rem;
  }

  .credits-dialog__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .credits-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }

  .credits-dialog__packs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .credits-dialog__pack {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .credits-dialog__pack:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .credits-dialog__pack--selected {
    border-color: var(--sidebar-accent);
    box-shadow: 0 4px 20px rgba(6, 182, 212, 0.2);
  }

  .credits-dialog__pack-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 1.5rem;
    text-align: left;
  }

  .credits-dialog__pack-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .credits-dialog__pack-price {
    display: flex;
    align-items: baseline;
    margin-bottom: 1.5rem;
  }

  .credits-dialog__pack-price-currency {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .credits-dialog__pack-price-amount {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.03em;
  }

  .credits-dialog__pack-features {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .credits-dialog__pack-feature {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .credits-dialog__pack-feature-icon {
    width: 15px;
    height: 15px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .credits-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .credits-dialog__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .credits-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #8b5cf6 100%);
    color: white;
  }

  .credits-dialog__btn--primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  .credits-dialog__btn--primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-dialog__btn--secondary {
    background-color: transparent;
    color: var(--sidebar-text-muted);
    border: 1px solid var(--sidebar-border);
  }

  .credits-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .credits-dialog__centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    text-align: center;
  }

  .credits-dialog__centered-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 1rem 0 0.5rem;
  }

  .credits-dialog__centered-subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin-bottom: 1.5rem;
  }

  .credits-dialog__spinner {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  .credits-dialog__success-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: rgba(16, 185, 129, 0.15);
    border-radius: 50%;
    color: #10b981;
  }

  .credits-dialog__error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: rgba(248, 113, 113, 0.15);
    border-radius: 50%;
    color: #f87171;
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

  /* Inline skeleton loaders for text placeholders */
  .billing-skeleton__inline {
    display: inline-block;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    vertical-align: middle;
  }

  .billing-skeleton__inline--sm {
    height: 14px;
    width: 100px;
  }

  .billing-skeleton__inline--md {
    height: 16px;
    width: 140px;
  }

  .billing-skeleton__inline--lg {
    height: 24px;
    width: 120px;
  }

  .billing-skeleton__inline--xl {
    height: 36px;
    width: 80px;
  }

  .billing-skeleton__inline--badge {
    height: 22px;
    width: 60px;
    border-radius: 5px;
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

  /* ===== Cancel Pending Button ===== */
  .billing-card__cancel-pending {
    background: none;
    border: none;
    color: var(--sidebar-accent);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    text-decoration: underline;
    padding: 0 0 0 4px;
  }

  .billing-card__cancel-pending:hover {
    opacity: 0.8;
  }

  /* ===== Modal Input ===== */
  .billing-modal__input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    font-size: 0.8125rem;
    margin-top: 0.5rem;
    outline: none;
    transition: border-color 150ms ease;
  }

  .billing-modal__input:focus {
    border-color: var(--sidebar-accent);
  }

  .billing-modal__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  /* ===== Subscription Gate Banner ===== */
  .billing__gate-banner {
    margin-bottom: 1.5rem;
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
  }

  .billing__gate-banner-content {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
  }

  .billing__gate-banner-icon {
    width: 20px;
    height: 20px;
    color: #f59e0b;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .billing__gate-banner-text {
    flex: 1;
  }

  .billing__gate-banner-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem 0;
  }

  .billing__gate-banner-description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Modal Icon Variants ===== */
  .billing-modal__icon--accent {
    background-color: rgba(6, 182, 212, 0.12);
    color: #06b6d4;
  }

  .billing-modal__icon--warning {
    background-color: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
  }

  /* ===== Deactivate Profile Section ===== */
  .billing-deactivate {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-top: 1px solid rgba(239, 68, 68, 0.15);
    padding-top: 2rem;
  }

  .billing-deactivate__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .billing-deactivate__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .billing-deactivate__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .billing-deactivate__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: #ef4444;
    margin: 0;
  }

  .billing-deactivate__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .billing-deactivate__card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 1rem 1.25rem;
    background: rgba(239, 68, 68, 0.04);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 10px;
  }

  .billing-deactivate__info-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .billing-deactivate__info-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .billing-deactivate__btn {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.3);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .billing-deactivate__btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.5);
  }
</style>
