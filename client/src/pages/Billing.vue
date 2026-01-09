<template>
  <div class="billing-page">
    <PageLayout
      title="Billing"
      description="Manage your subscription and view payment history"
      :show-header="true"
      :icon="Receipt"
    >
      <template #actions>
        <router-link
          to="/pricing"
          class="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:from-indigo-500 hover:to-violet-500 transition-all font-medium text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
        >
          <div
            class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
          />
          <Coins class="h-4 w-4 relative z-10" />
          <span class="relative z-10">Buy Credits</span>
        </router-link>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <SkeletonGrid />
      </div>

      <!-- Not Authenticated -->
      <EmptyState
        v-else-if="!authStore.isAuthenticated"
        title="Sign in to view billing"
        description="Access your subscription details and payment history"
      >
        <template #icon>
          <Receipt class="h-16 w-16 text-muted-foreground" />
        </template>
        <template #action>
          <button
            @click="showAuthModal"
            class="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all font-semibold shadow-lg shadow-violet-500/25"
          >
            Sign In
          </button>
        </template>
      </EmptyState>

      <!-- Admin State -->
      <EmptyState
        v-else-if="isAdmin"
        title="Admin Access"
        description="You have unlimited access as an administrator. No subscription or billing needed!"
      >
        <template #icon>
          <Shield class="h-16 w-16 text-violet-500" />
        </template>
        <template #action>
          <div
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500/20 to-indigo-500/20 rounded-lg border border-violet-500/30 shadow-lg shadow-violet-500/10"
          >
            <Shield class="h-5 w-5 text-violet-400" />
            <span class="text-violet-400 font-semibold">Unlimited Access</span>
          </div>
        </template>
      </EmptyState>

      <div v-else class="space-y-8">
        <!-- Current Subscription & Credits Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Current Subscription Card -->
          <div class="group relative">
            <div
              class="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
            <div
              class="relative bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden hover:border-border transition-all duration-300"
            >
              <div
                class="h-1 w-full bg-gradient-to-r"
                :class="
                  hasActiveSubscription
                    ? 'from-emerald-500 via-green-500 to-emerald-500'
                    : 'from-muted via-muted-foreground/30 to-muted'
                "
              />

              <div class="p-6">
                <div class="flex items-center gap-3 mb-5">
                  <div
                    class="p-2.5 rounded-xl"
                    :class="
                      hasActiveSubscription
                        ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30'
                        : 'bg-muted border border-border'
                    "
                  >
                    <Crown v-if="hasActiveSubscription" class="h-5 w-5 text-emerald-400" />
                    <CreditCard v-else class="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 class="font-semibold text-foreground">Subscription</h2>
                    <p class="text-xs text-muted-foreground">Your current plan</p>
                  </div>
                </div>

                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-3 mb-2">
                      <span class="text-2xl font-bold tracking-tight">
                        {{ subscriptionStatus?.tier_name || 'No Subscription' }}
                      </span>
                      <span :class="statusBadgeClass" class="text-xs font-semibold px-2.5 py-1 rounded-full">
                        {{ statusBadgeText }}
                      </span>
                    </div>
                    <p class="text-sm text-muted-foreground leading-relaxed">
                      <template v-if="subscriptionStatus?.status === 'active'">
                        <span class="flex items-center gap-1.5">
                          <CalendarCheck class="h-3.5 w-3.5" />
                          Renews {{ formatDate(subscriptionStatus?.end_date) }}
                          <span class="text-muted-foreground/60 ml-1">
                            ({{ subscriptionStatus?.days_remaining }} days)
                          </span>
                        </span>
                      </template>
                      <template v-else-if="subscriptionStatus?.status === 'cancelled'">
                        <span class="flex items-center gap-1.5 text-amber-400">
                          <Clock class="h-3.5 w-3.5" />
                          Access until {{ formatDate(subscriptionStatus?.end_date) }}
                        </span>
                      </template>
                      <template v-else-if="subscriptionStatus?.status === 'expired'">
                        <span class="flex items-center gap-1.5 text-red-400">
                          <AlertCircle class="h-3.5 w-3.5" />
                          Expired {{ formatDate(subscriptionStatus?.end_date) }}
                        </span>
                      </template>
                      <template v-else>Subscribe to unlock Clippster</template>
                    </p>
                  </div>

                  <div class="flex items-center gap-2">
                    <template v-if="subscriptionStatus?.status === 'active'">
                      <button
                        @click="showCancelConfirm = true"
                        class="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"
                        :disabled="cancellingSubscription"
                      >
                        {{ cancellingSubscription ? 'Cancelling...' : 'Cancel' }}
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Credit Balance Card -->
          <div class="group relative">
            <div
              class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
            <div
              class="relative bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden hover:border-border transition-all duration-300"
            >
              <div class="h-1 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

              <div class="p-6">
                <div class="flex items-center gap-3 mb-5">
                  <div
                    class="p-2.5 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-xl border border-indigo-500/30"
                  >
                    <Coins class="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 class="font-semibold text-foreground">Credit Balance</h2>
                    <p class="text-xs text-muted-foreground">Available processing time</p>
                  </div>
                </div>

                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-baseline gap-2 mb-2">
                      <span
                        class="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent"
                      >
                        {{ typeof hoursRemaining === 'number' ? Math.round(hoursRemaining) : hoursRemaining }}
                      </span>
                      <span class="text-lg text-muted-foreground font-medium">min</span>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp class="h-3.5 w-3.5 text-emerald-400" />
                      <span>{{ Math.round(hoursUsed) }} min used total</span>
                    </div>
                  </div>
                </div>

                <!-- Organization Allocations -->
                <div v-if="organizationAllocations.length > 0" class="mt-5 pt-5 border-t border-border/50">
                  <div class="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Building class="h-3.5 w-3.5" />
                    <span class="font-medium uppercase tracking-wide">Organization Allocations</span>
                  </div>
                  <div class="space-y-2">
                    <div
                      v-for="alloc in organizationAllocations"
                      :key="alloc.organization_id"
                      class="flex items-center justify-between text-sm p-2.5 bg-muted/30 rounded-lg border border-border/30"
                    >
                      <span class="text-muted-foreground truncate">{{ alloc.organization_name }}</span>
                      <span class="font-semibold text-foreground tabular-nums">
                        {{ Math.round(alloc.hours_remaining) }} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscription Plans Section -->
        <div class="relative">
          <div
            class="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-indigo-500/5 to-violet-500/5 rounded-2xl blur-3xl"
          />

          <div class="relative">
            <div class="flex items-center gap-3 mb-6">
              <div
                class="p-2.5 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-xl border border-violet-500/30"
              >
                <Sparkles class="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 class="font-semibold text-foreground text-lg">
                  {{ hasActiveSubscription ? 'Change Plan' : 'Choose a Plan' }}
                </h2>
                <p class="text-xs text-muted-foreground">Select the plan that works best for you</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div v-for="tier in subscriptionTiers" :key="tier.id" class="relative group">
                <!-- Popular Badge -->
                <div
                  v-if="tier.id === 'creator'"
                  class="absolute -top-3.5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full z-10 whitespace-nowrap shadow-lg shadow-violet-500/30"
                >
                  POPULAR
                </div>

                <!-- Current Plan Badge -->
                <div
                  v-if="isCurrentTier(tier.id)"
                  class="absolute -top-3.5 right-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold px-4 py-1 rounded-full z-10 whitespace-nowrap shadow-lg shadow-emerald-500/30"
                >
                  CURRENT
                </div>

                <div
                  class="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 hover:shadow-xl transition-all duration-300 h-full flex flex-col group-hover:-translate-y-1"
                  :class="[
                    isCurrentTier(tier.id)
                      ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10'
                      : tier.id === 'creator'
                        ? 'border-violet-500/50 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/10'
                        : 'border-border hover:border-border/80',
                  ]"
                >
                  <!-- Gradient overlay for creator tier -->
                  <div
                    v-if="tier.id === 'creator'"
                    class="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5 pointer-events-none"
                  />

                  <div class="relative p-6 flex-1 flex flex-col">
                    <h3 class="text-xl font-bold mb-1">{{ tier.name }}</h3>
                    <div class="mb-5">
                      <span class="text-4xl font-bold tracking-tight">${{ tier.price_usd }}</span>
                      <span class="text-muted-foreground text-sm font-medium">/mo</span>
                    </div>

                    <!-- Credits Badge -->
                    <div
                      class="mb-5 p-3 rounded-lg"
                      :class="
                        tier.id === 'creator'
                          ? 'bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20'
                          : 'bg-muted/50 border border-border/50'
                      "
                    >
                      <div class="flex items-center gap-2">
                        <Zap :class="tier.id === 'creator' ? 'h-4 w-4 text-violet-400' : 'h-4 w-4 text-amber-400'" />
                        <span class="font-semibold">{{ tier.monthly_credits }} credits/month</span>
                      </div>
                    </div>

                    <ul class="space-y-3 mb-6 flex-1 text-sm">
                      <li class="flex items-center gap-2.5 text-muted-foreground">
                        <div class="p-0.5 rounded-full bg-emerald-500/20">
                          <Check class="h-3 w-3 text-emerald-400" />
                        </div>
                        <span>Full app access</span>
                      </li>
                      <li class="flex items-center gap-2.5 text-muted-foreground">
                        <div class="p-0.5 rounded-full bg-emerald-500/20">
                          <Check class="h-3 w-3 text-emerald-400" />
                        </div>
                        <span>AI clip detection</span>
                      </li>
                      <li class="flex items-center gap-2.5 text-muted-foreground">
                        <div class="p-0.5 rounded-full bg-emerald-500/20">
                          <Check class="h-3 w-3 text-emerald-400" />
                        </div>
                        <span>Credits roll over</span>
                      </li>
                    </ul>

                    <button
                      class="w-full py-2.5 rounded-lg font-semibold transition-all text-sm relative overflow-hidden group/btn"
                      :class="getButtonClass(tier.id)"
                      @click="selectSubscription(tier)"
                      :disabled="isCurrentTier(tier.id)"
                    >
                      <div
                        v-if="!isCurrentTier(tier.id)"
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
                      />
                      <span class="relative">
                        <span v-if="isCurrentTier(tier.id)">Current Plan</span>
                        <span v-else-if="hasActiveSubscription">Switch Plan</span>
                        <span v-else>Subscribe</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment History Section -->
        <div class="relative">
          <div class="flex items-center gap-3 mb-5">
            <div class="p-2.5 bg-muted rounded-xl border border-border">
              <History class="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 class="font-semibold text-foreground text-lg">Payment History</h2>
              <p class="text-xs text-muted-foreground">Your recent transactions</p>
            </div>
          </div>

          <div
            class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden"
          >
            <div v-if="loadingHistory" class="p-12 flex flex-col items-center justify-center gap-3">
              <div class="animate-spin rounded-full h-10 w-10 border-2 border-muted border-t-violet-500"></div>
              <span class="text-sm text-muted-foreground">Loading history...</span>
            </div>
            <div v-else-if="paymentHistory.length === 0" class="p-12 text-center">
              <div class="inline-flex items-center justify-center w-14 h-14 bg-muted/50 rounded-xl mb-4">
                <Receipt class="h-6 w-6 text-muted-foreground" />
              </div>
              <p class="text-muted-foreground font-medium">No payment history yet</p>
              <p class="text-sm text-muted-foreground/60 mt-1">Your transactions will appear here</p>
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-border/50">
                    <th
                      class="px-5 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      class="px-5 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      class="px-5 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Description
                    </th>
                    <th
                      class="px-5 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Amount
                    </th>
                    <th
                      class="px-5 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Method
                    </th>
                    <th
                      class="px-5 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/30">
                  <tr v-for="payment in paymentHistory" :key="payment.id" class="hover:bg-muted/20 transition-colors">
                    <td class="px-5 py-4 text-sm font-medium">{{ formatDate(payment.date) }}</td>
                    <td class="px-5 py-4 text-sm">
                      <span
                        :class="
                          payment.type === 'subscription'
                            ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
                            : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                        "
                        class="px-2.5 py-1 rounded-full text-xs font-semibold border"
                      >
                        {{ payment.type === 'subscription' ? 'Subscription' : 'Credits' }}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-sm text-muted-foreground">{{ payment.description }}</td>
                    <td class="px-5 py-4 text-sm font-semibold tabular-nums">${{ payment.amount.toFixed(2) }}</td>
                    <td class="px-5 py-4 text-sm">
                      <span class="capitalize text-muted-foreground flex items-center gap-1.5">
                        <CreditCard v-if="payment.method === 'stripe'" class="h-3.5 w-3.5" />
                        <Wallet v-else class="h-3.5 w-3.5" />
                        {{ payment.method }}
                      </span>
                    </td>
                    <td class="px-5 py-4 text-sm">
                      <span
                        :class="getStatusClass(payment.status)"
                        class="px-2.5 py-1 rounded-full text-xs font-semibold border"
                      >
                        {{ payment.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Cancel Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCancelConfirm"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="showCancelConfirm = false"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10 shadow-2xl"
            >
              <div class="text-center mb-6">
                <div
                  class="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl border border-red-500/30 mb-4"
                >
                  <AlertTriangle class="h-7 w-7 text-red-400" />
                </div>
                <h2 class="text-2xl font-bold text-white">Cancel Subscription?</h2>
              </div>

              <div class="space-y-4">
                <div class="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
                  <p class="text-zinc-400 text-sm leading-relaxed">
                    Your subscription will remain active until
                    <span class="text-white font-medium">{{ formatDate(subscriptionStatus?.end_date) }}</span>
                    . After that, you'll lose access to Clippster features.
                  </p>
                  <p class="text-zinc-500 text-sm mt-2">Your credits will remain in your account.</p>
                </div>

                <button
                  @click="cancelSubscription"
                  class="w-full py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold hover:from-red-500 hover:to-rose-500 transition-all shadow-lg shadow-red-500/25"
                  :disabled="cancellingSubscription"
                >
                  {{ cancellingSubscription ? 'Cancelling...' : 'Yes, Cancel Subscription' }}
                </button>
                <button
                  @click="showCancelConfirm = false"
                  class="w-full py-3 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl font-semibold hover:bg-zinc-700 transition-all border border-zinc-700"
                >
                  Keep Subscription
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Payment Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPaymentModal"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closePaymentModal"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden shadow-2xl"
            >
              <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500" />

              <div class="p-6 sm:p-8">
                <!-- Confirm Step -->
                <div v-if="paymentStep === 'confirm'">
                  <div class="mb-6 text-center">
                    <div
                      class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 mb-4"
                    >
                      <Wallet class="h-7 w-7 text-violet-400" />
                    </div>
                    <h2 class="text-xl font-bold text-white">
                      {{ hasActiveSubscription ? 'Change Plan' : 'Subscribe' }}
                    </h2>
                    <p class="text-zinc-400 text-sm mt-1">Choose your preferred payment method</p>
                  </div>

                  <!-- Order Summary -->
                  <div class="mb-5 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-3">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-zinc-400">Plan:</span>
                      <span class="font-semibold text-white">{{ selectedSubscription?.name }}</span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-zinc-400">Credits/month:</span>
                      <span class="font-medium text-white">{{ selectedSubscription?.monthly_credits }}</span>
                    </div>
                    <div class="pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <span class="text-zinc-400">Total:</span>
                      <span class="font-bold text-lg text-violet-400">
                        ${{ selectedSubscription?.price_usd }}/month
                      </span>
                    </div>
                  </div>

                  <!-- Payment Buttons -->
                  <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <button
                        class="relative px-4 py-3 bg-gradient-to-r from-[#635bff] to-[#4e44cb] hover:from-[#7a73ff] hover:to-[#6359e8] text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 overflow-hidden group"
                        @click="initiateStripePayment"
                        :disabled="processing"
                      >
                        <div
                          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                        />
                        <Loader2 v-if="processing" class="h-4 w-4 animate-spin relative" />
                        <CreditCard v-else class="h-5 w-5 relative" />
                        <span class="relative">Card</span>
                      </button>

                      <button
                        class="relative px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 overflow-hidden group"
                        @click="initiateSubscriptionCrypto"
                        :disabled="processing"
                      >
                        <div
                          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                        />
                        <Loader2 v-if="processing" class="h-4 w-4 animate-spin relative" />
                        <Wallet v-else class="h-5 w-5 relative" />
                        <span class="relative">Phantom</span>
                      </button>
                    </div>

                    <button
                      class="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 text-sm"
                      @click="closePaymentModal"
                      :disabled="processing"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <!-- Processing Step -->
                <div v-else-if="paymentStep === 'processing'" class="text-center py-8">
                  <div
                    class="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 mb-5"
                  >
                    <Loader2 class="h-8 w-8 text-violet-400 animate-spin" />
                  </div>
                  <h3 class="text-xl font-bold text-white mb-2">Processing Payment</h3>
                  <p class="text-zinc-400 text-sm mb-6">{{ paymentStatus }}</p>
                  <button
                    @click="cancelPaymentProcess"
                    class="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>

                <!-- Success Step -->
                <div v-else-if="paymentStep === 'success'" class="text-center py-8">
                  <div
                    class="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-5"
                  >
                    <Check class="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 class="text-xl font-bold text-white mb-2">Subscription Activated!</h3>
                  <p class="text-zinc-400 text-sm mb-6">
                    Your
                    <span class="font-semibold text-emerald-400">{{ selectedSubscription?.name }}</span>
                    subscription is now active!
                  </p>
                  <button
                    class="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl font-semibold transition-all relative overflow-hidden group text-sm"
                    @click="closePaymentModal"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span class="relative">Done</span>
                  </button>
                </div>

                <!-- Error Step -->
                <div v-else-if="paymentStep === 'error'" class="text-center py-8">
                  <div
                    class="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 mb-5"
                  >
                    <X class="h-8 w-8 text-red-400" />
                  </div>
                  <h3 class="text-xl font-bold text-white mb-2">Payment Failed</h3>
                  <p class="text-zinc-400 text-sm mb-6">{{ errorMessage }}</p>
                  <div class="space-y-3">
                    <button
                      class="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-semibold transition-all relative overflow-hidden group text-sm"
                      @click="paymentStep = 'confirm'"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />
                      <span class="relative">Try Again</span>
                    </button>
                    <button
                      class="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                      @click="closePaymentModal"
                    >
                      Close
                    </button>
                  </div>
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
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';

  const authStore = useAuthStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const loading = ref(true);
  const loadingHistory = ref(false);

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
    if (status === 'active') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    if (status === 'cancelled') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    if (status === 'expired') return 'bg-red-500/15 text-red-400 border border-red-500/30';
    return 'bg-muted text-muted-foreground border border-border';
  });

  function isCurrentTier(tierId: string): boolean {
    return hasActiveSubscription.value && subscriptionStatus.value?.tier === tierId;
  }

  function getButtonClass(tierId: string): string {
    if (isCurrentTier(tierId)) {
      return 'bg-emerald-500/15 text-emerald-400 cursor-not-allowed border border-emerald-500/30';
    }
    if (tierId === 'creator') {
      return 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/25';
    }
    return 'bg-secondary text-foreground hover:bg-secondary/80 border border-border';
  }

  function getStatusClass(status: string): string {
    if (status === 'active' || status === 'confirmed')
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (status === 'pending') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (status === 'cancelled' || status === 'failed') return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-muted text-muted-foreground border-border';
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
    loading.value = true;
    await Promise.all([fetchSubscriptionTiers(), fetchBalance(), fetchPaymentHistory()]);
    loading.value = false;
  }

  async function fetchSubscriptionTiers() {
    try {
      const response = await api.get('/subscription/tiers');
      if (response.data.success) {
        subscriptionTiers.value = response.data.tiers;
      }
    } catch (error: any) {
      console.error('Failed to fetch subscription tiers:', error);
    }
  }

  async function fetchBalance() {
    if (!authStore.isAuthenticated) return;

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
    }
  }

  async function fetchPaymentHistory() {
    if (!authStore.isAuthenticated) return;

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
    // Reset the processing state and go back to confirm step
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
  .billing-page {
    position: relative;
    width: 100%;
    min-height: 100%;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
