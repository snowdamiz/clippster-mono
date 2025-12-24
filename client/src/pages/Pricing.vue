<template>
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-16 mt-4">
      <div class="flex justify-center items-center gap-3 mb-4">
        <div class="p-2 bg-muted rounded-md">
          <CreditCard class="h-6 w-6 text-foreground" />
        </div>

        <h1 class="text-4xl font-bold">Choose Your Credit Pack</h1>
      </div>

      <p class="text-muted-foreground text-lg">Pay once, use forever. No subscriptions, no expiration dates.</p>

      <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
        <span class="text-sm text-muted-foreground">Current Balance:</span>
        <span v-if="!authStore.isAuthenticated" class="text-sm text-muted-foreground">
          <button @click="showAuthModal" class="text-purple-600 hover:text-purple-700 font-medium">
            Sign in to view balance
          </button>
        </span>
        <span v-else-if="typeof balance.hours_remaining === 'string'" class="text-lg font-bold text-purple-600">
          Unlimited Credits
        </span>
        <span v-else class="text-lg font-bold text-foreground">{{ balance.hours_remaining }} hours</span>
      </div>
    </div>
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
    <!-- Admin State -->
    <div
      v-else-if="authStore.isAuthenticated && typeof balance.hours_remaining === 'string'"
      class="flex flex-col items-center justify-center py-20"
    >
      <div class="text-center max-w-md">
        <div
          class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-full mb-6"
        >
          <Check class="h-8 w-8 text-purple-600" />
        </div>
        <h2 class="text-2xl font-bold text-foreground mb-2">Admin Access</h2>
        <p class="text-muted-foreground text-lg mb-4">
          You have unlimited credits as an administrator. Enjoy unrestricted access to all features!
        </p>
        <div
          class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-md border border-purple-500/30"
        >
          <Shield class="h-5 w-5 text-purple-600" />
          <span class="text-purple-600 font-medium">Unlimited Credits</span>
        </div>
      </div>
    </div>
    <!-- Error State -->
    <div v-else-if="!packs || Object.keys(packs).length === 0" class="flex flex-col items-center justify-center py-20">
      <AlertTriangle class="h-16 w-16 text-red-500 mb-4" />
      <h3 class="text-xl font-bold mb-2">Unable to Load Pricing</h3>

      <p class="text-muted-foreground mb-4">Please check your connection and try again</p>
      <button
        @click="retryLoad"
        class="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-all"
      >
        Retry
      </button>
    </div>
    <!-- Credit Packs Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-2">
      <div
        v-for="packKey in packOrder"
        :key="packKey"
        class="relative group"
        :class="{ 'ring-2 ring-purple-500 rounded-lg': packKey === 'creator' }"
      >
        <!-- Popular Badge -->
        <div
          v-if="packKey === 'creator'"
          class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full z-5 whitespace-nowrap"
        >
          ⭐ MOST POPULAR
        </div>
        <!-- Card -->
        <div
          class="relative overflow-hidden rounded-lg border bg-card hover:border-purple-500 transition-all cursor-pointer h-full flex flex-col"
          :class="packKey === 'creator' ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-border'"
          @click="selectPack(packKey, packs[packKey])"
        >
          <div class="gradient-overlay absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"></div>

          <div class="relative p-6 flex-1 flex flex-col">
            <!-- Pack Name -->
            <h3 class="text-2xl font-bold mb-2 capitalize">{{ packKey }}</h3>
            <!-- Hours -->
            <div class="mb-4" v-if="packs[packKey]">
              <span class="text-4xl font-bold text-foreground">{{ packs[packKey].hours }}</span>
              <span class="text-muted-foreground ml-2">hours</span>
            </div>
            <!-- Price -->
            <div class="mb-6" v-if="packs[packKey]">
              <div class="text-3xl font-bold mb-1">${{ Math.round(packs[packKey].usd) }}</div>

              <div class="text-sm text-muted-foreground">≈{{ getSolAmountForPack(packKey).toFixed(4) }} SOL</div>

              <div class="text-xs text-muted-foreground mt-1">
                ${{ (packs[packKey].usd / packs[packKey].hours).toFixed(2) }}/hour
              </div>
            </div>
            <!-- Features -->
            <ul class="space-y-2.5 mb-6 flex-1" v-if="packs[packKey]">
              <li class="flex items-center gap-2 text-sm text-muted-foreground">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Credits never expire</span>
              </li>

              <li class="flex items-center gap-2 text-sm text-muted-foreground">
                <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Use anytime, no limits</span>
              </li>
            </ul>
            <!-- Button -->
            <button
              class="w-full py-3 rounded-md font-semibold transition-all shadow-sm"
              :class="
                packKey === 'creator'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-md'
                  : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
              "
              @click.stop="selectPack(packKey, packs[packKey])"
            >
              <span v-if="!authStore.isAuthenticated">Sign in to Purchase</span>
              <span v-else-if="packKey === 'creator'">Get Started</span>
              <span v-else>Purchase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Info Section -->
    <div class="mt-10 relative">
      <!-- Background decoration -->
      <div
        class="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 rounded-xl blur-3xl"
      ></div>

      <div
        class="relative bg-gradient-to-br from-card via-card to-muted/30 rounded-xl border border-border/50 overflow-hidden"
      >
        <!-- Top gradient bar -->
        <div class="h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>

        <div class="p-12">
          <div class="text-center mb-12">
            <h3
              class="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent"
            >
              Why Choose Clippster?
            </h3>

            <p class="text-muted-foreground max-w-2xl mx-auto">
              The smarter way to create clips. Save money, protect your privacy, and pay with crypto.
            </p>
          </div>

          <div class="grid md:grid-cols-3 gap-8">
            <!-- Card 1 -->
            <div class="group relative">
              <div
                class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div
                class="relative p-6 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all"
              >
                <div
                  class="flex items-center justify-center w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 mx-auto"
                >
                  <TrendingUp class="w-8 h-8 text-purple-400" />
                </div>

                <div class="text-center">
                  <div class="font-bold text-xl mb-2 text-purple-400">72-81% Cheaper</div>

                  <p class="text-sm text-muted-foreground leading-relaxed">
                    Save thousands compared to Opus Clips subscription plans. Same quality, better price.
                  </p>
                </div>
              </div>
            </div>
            <!-- Card 2 -->
            <div class="group relative">
              <div
                class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div
                class="relative p-6 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:border-indigo-500/50 transition-all"
              >
                <div
                  class="flex items-center justify-center w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mx-auto"
                >
                  <Lock class="w-8 h-8 text-indigo-400" />
                </div>

                <div class="text-center">
                  <div class="font-bold text-xl mb-2 text-indigo-400">Privacy First</div>

                  <p class="text-sm text-muted-foreground leading-relaxed">
                    Desktop app means your videos stay on your machine. No cloud uploads, total control.
                  </p>
                </div>
              </div>
            </div>
            <!-- Card 3 -->
            <div class="group relative">
              <div
                class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div
                class="relative p-6 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all"
              >
                <div
                  class="flex items-center justify-center w-16 h-16 mb-4 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 mx-auto"
                >
                  <DollarSign class="w-8 h-8 text-purple-400" />
                </div>

                <div class="text-center">
                  <div class="font-bold text-xl mb-2 text-purple-400">Crypto Native</div>

                  <p class="text-sm text-muted-foreground leading-relaxed">
                    Pay with SOL via Phantom. No credit cards, no personal info, instant transactions.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <!-- Bottom CTA -->
          <div class="mt-12 text-center">
            <div
              class="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20"
            >
              <Check class="w-5 h-5 text-purple-400" />
              <span class="text-sm font-medium text-muted-foreground">
                Trusted by content creators •
                <span class="text-purple-400 font-semibold">No subscriptions</span>
                • Credits never expire
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
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
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-sm sm:max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

              <div class="p-5 sm:p-6 lg:p-8">
                <!-- Confirm Step -->
                <div v-if="paymentStep === 'confirm'">
                  <!-- Header -->
                  <div class="mb-4 sm:mb-6 text-center">
                    <div
                      class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                    >
                      <Wallet class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                    </div>
                    <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Complete Payment</h2>
                    <p class="text-zinc-400 text-xs sm:text-sm mt-1">Choose your preferred payment method</p>
                  </div>

                  <!-- Order Summary -->
                  <div
                    class="mb-4 sm:mb-5 p-3 sm:p-4 bg-zinc-900/80 rounded-lg sm:rounded-xl border border-zinc-800 space-y-2"
                  >
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="text-zinc-400">Pack:</span>
                      <span class="font-medium text-white capitalize">{{ selectedPack?.key }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="text-zinc-400">Credit Hours:</span>
                      <span class="font-medium text-white">{{ selectedPack?.hours }} hours</span>
                    </div>
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="text-zinc-400">Price:</span>
                      <span class="font-semibold text-violet-400">${{ Math.round(selectedPack?.usd) }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-zinc-800">
                      <span class="text-zinc-400">SOL Equivalent:</span>
                      <span class="font-medium text-zinc-300">≈{{ selectedPack?.solAmount.toFixed(4) }} SOL</span>
                    </div>
                  </div>

                  <!-- Payment Buttons -->
                  <div class="space-y-2 sm:space-y-3">
                    <div class="grid grid-cols-2 gap-2 sm:gap-3">
                      <!-- Crypto Payment Button -->
                      <button
                        class="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                        @click="initiatePayment"
                        :disabled="processing"
                      >
                        <div
                          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                        />
                        <span class="relative flex items-center justify-center gap-1.5">
                          <Loader2 v-if="processing" class="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                          <svg v-else class="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 128 128" fill="currentColor">
                            <path
                              d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm0 116c-28.7 0-52-23.3-52-52S35.3 12 64 12s52 23.3 52 52-23.3 52-52 52z"
                            />
                            <path
                              d="M86.5 49.2L64 71.7 41.5 49.2c-2.3-2.3-6.1-2.3-8.5 0s-2.3 6.1 0 8.5l26.7 26.7c1.2 1.2 2.7 1.8 4.2 1.8s3.1-.6 4.2-1.8l26.7-26.7c2.3-2.3 2.3-6.1 0-8.5s-6-2.3-8.3 0z"
                            />
                          </svg>
                          <span>{{ processing ? 'Processing...' : 'Phantom' }}</span>
                        </span>
                      </button>
                      <!-- Stripe Payment Button -->
                      <button
                        class="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-[#635bff] to-[#4e44cb] text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm hover:from-[#7a73ff] hover:to-[#6359e8]"
                        @click="initiateStripePayment"
                        :disabled="processing"
                      >
                        <div
                          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                        />
                        <span class="relative flex items-center justify-center gap-1.5">
                          <Loader2 v-if="processing" class="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                          <CreditCard v-else class="h-4 w-4 sm:h-5 sm:w-5" />
                          <span>{{ processing ? 'Processing...' : 'Card' }}</span>
                        </span>
                      </button>
                    </div>
                    <!-- Cancel Button -->
                    <button
                      class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 text-sm"
                      @click="closePaymentModal"
                      :disabled="processing"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <!-- Processing Step -->
                <div v-else-if="paymentStep === 'processing'" class="text-center py-4 sm:py-6">
                  <div
                    class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-4 sm:mb-5"
                  >
                    <Loader2 class="h-7 w-7 sm:h-8 sm:w-8 text-violet-400 animate-spin" />
                  </div>
                  <h3 class="text-lg sm:text-xl font-bold text-white mb-2">Processing Payment</h3>
                  <p class="text-zinc-400 text-sm">{{ paymentStatus }}</p>
                </div>

                <!-- Success Step -->
                <div v-else-if="paymentStep === 'success'" class="text-center py-4 sm:py-6">
                  <div
                    class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-4 sm:mb-5"
                  >
                    <Check class="h-7 w-7 sm:h-8 sm:w-8 text-emerald-400" />
                  </div>
                  <h3 class="text-lg sm:text-xl font-bold text-white mb-2">Payment Successful!</h3>
                  <p class="text-zinc-400 text-sm mb-5 sm:mb-6">
                    <span class="font-semibold text-emerald-400">{{ selectedPack?.hours }} hours</span>
                    added to your balance
                  </p>
                  <button
                    class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm"
                    @click="closePaymentModal"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span class="relative">Done</span>
                  </button>
                </div>

                <!-- Error Step -->
                <div v-else-if="paymentStep === 'error'" class="text-center py-4 sm:py-6">
                  <div
                    class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 mb-4 sm:mb-5"
                  >
                    <X class="h-7 w-7 sm:h-8 sm:w-8 text-red-400" />
                  </div>
                  <h3 class="text-lg sm:text-xl font-bold text-white mb-2">Payment Failed</h3>
                  <p class="text-zinc-400 text-sm mb-5 sm:mb-6">{{ errorMessage }}</p>
                  <div class="space-y-2 sm:space-y-3">
                    <button
                      class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm"
                      @click="paymentStep = 'confirm'"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />
                      <span class="relative">Try Again</span>
                    </button>
                    <button
                      class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
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
  import { ref, onMounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import api from '@/services/api';
  import {
    CreditCard,
    Check,
    AlertTriangle,
    Shield,
    TrendingUp,
    Lock,
    DollarSign,
    X,
    Loader2,
    Wallet,
  } from 'lucide-vue-next';
  const authStore = useAuthStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const loading = ref(true);
  const packs = ref<any>({});
  const packOrder = ref(['starter', 'creator', 'pro', 'studio']);
  const companyWallet = ref('');
  const solUsdRate = ref(0);
  const balance = ref<{ hours_remaining: number | 'unlimited'; hours_used: number }>({
    hours_remaining: 0,
    hours_used: 0,
  });

  const showPaymentModal = ref(false);
  const selectedPack = ref<any>(null);
  const paymentStep = ref<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const processing = ref(false);
  const paymentStatus = ref('');
  const errorMessage = ref('');

  async function retryLoad() {
    loading.value = true;
    await Promise.all([fetchPricing(), fetchBalance()]);
    loading.value = false;
  }

  onMounted(async () => {
    await retryLoad();
  });

  async function fetchPricing() {
    try {
      const response = await api.get('/pricing');
      const data = response.data;
      if (data.success) {
        packs.value = data.packs;
        solUsdRate.value = data.sol_usd_rate;
        companyWallet.value = data.company_wallet_address;
      } else {
        throw new Error(data.error || 'Failed to fetch pricing');
      }
    } catch (error: any) {
      showErrorToast(
        'Failed to load pricing',
        error.message || 'An error occurred while loading credit pack prices. Please try again.'
      );
    }
  }

  async function fetchBalance() {
    // Only fetch balance if user is authenticated
    if (!authStore.isAuthenticated) {
      balance.value = { hours_remaining: 0, hours_used: 0 };
      return;
    }

    try {
      const response = await api.get('/credits/balance');
      const data = response.data;
      if (data.success) {
        balance.value = data.balance;
      } else {
        throw new Error(data.error || 'Failed to fetch balance');
      }
    } catch (error: any) {
      showErrorToast(
        'Failed to load balance',
        error.message || 'An error occurred while loading your credit balance. Please try again.'
      );
    }
  }

  // SOL price now fetched from server in fetchPricing()
  // No need for separate client-side price fetching

  function calculateSolAmount(usdAmount: number): number {
    if (solUsdRate.value === 0) return 0;
    return usdAmount / solUsdRate.value;
  }

  function getSolAmountForPack(packKey: string): number {
    // Use server-provided SOL amount if available
    if (packs.value[packKey]?.sol_amount) {
      return packs.value[packKey].sol_amount;
    }
    // Fallback calculation
    return calculateSolAmount(packs.value[packKey]?.usd || 0);
  }

  function selectPack(key: string, pack: any) {
    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      // Show auth modal instead of redirecting
      showAuthModal();
      return;
    }

    selectedPack.value = {
      key,
      hours: pack.hours,
      usd: pack.usd,
      solAmount: pack.sol_amount || calculateSolAmount(pack.usd),
    };
    showPaymentModal.value = true;
    paymentStep.value = 'confirm';
  }

  function showAuthModal() {
    // Dispatch event to show auth modal in App component
    window.dispatchEvent(new CustomEvent('show-auth-modal'));
  }

  async function initiatePayment() {
    processing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Opening payment window...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Set up listener for payment completion
      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        // Verify payment with backend
        paymentStatus.value = 'Verifying payment...';
        try {
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
          const confirmResponse = await fetch(`${API_BASE}/api/payments/confirm`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authStore.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tx_signature: paymentResult.signature,
              pack_type: paymentResult.pack_key,
              from_address: paymentResult.from_address, // Include wallet address for verification
            }),
          });

          const confirmData = await confirmResponse.json();

          if (confirmData.success) {
            balance.value = confirmData.balance;
            paymentStep.value = 'success';
            processing.value = false;

            // Show success toast
            showSuccessToast(
              'Purchase successful',
              `${paymentResult.pack_hours} hours have been added to your account`
            );

            // Cleanup listener
            unlisten();

            // Refresh balance
            await fetchBalance();
          } else {
            throw new Error(confirmData.error || 'Payment confirmation failed');
          }
        } catch (error: any) {
          errorMessage.value = error.message || 'Payment verification failed';
          paymentStep.value = 'error';
          processing.value = false;
          showErrorToast(
            'Payment verification failed',
            error.message || 'An error occurred while verifying your payment. Please contact support.'
          );
          unlisten();
        }
      });

      // Open payment window in browser
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await invoke('open_wallet_payment_window', {
        packKey: selectedPack.value.key,
        packName: selectedPack.value.key.charAt(0).toUpperCase() + selectedPack.value.key.slice(1),
        hours: selectedPack.value.hours,
        usd: selectedPack.value.usd,
        sol: selectedPack.value.solAmount,
        companyWallet: companyWallet.value,
        authToken: authStore.token,
        apiBase,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (error: any) {
      errorMessage.value = error.message || 'Failed to open payment window';
      paymentStep.value = 'error';
      processing.value = false;
      showErrorToast(
        'Payment failed',
        error.message || 'An error occurred while processing your payment. Please try again.'
      );
    }
  }

  async function initiateStripePayment() {
    processing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Create Stripe checkout session
      const response = await api.post('/payments/stripe/create-session', {
        pack_type: selectedPack.value.key,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }

      const { url: checkoutUrl } = response.data;

      // Set up listener for Stripe payment completion
      const unlisten = await listen('stripe-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        if (paymentResult.success) {
          // Payment was successful (webhook will credit the account)
          paymentStep.value = 'success';
          processing.value = false;

          // Show success toast
          showSuccessToast('Purchase successful', `${paymentResult.pack_hours} hours have been added to your account`);

          // Cleanup listener
          unlisten();

          // Refresh balance (give webhook a moment to process)
          setTimeout(async () => {
            await fetchBalance();
          }, 2000);
        } else {
          // This shouldn't happen as cancel page doesn't emit success
          unlisten();
        }
      });

      // Open Stripe checkout in browser
      paymentStatus.value = 'Opening payment page...';
      await invoke('open_stripe_payment_window', {
        checkoutUrl: checkoutUrl,
        packKey: selectedPack.value.key,
        packHours: selectedPack.value.hours,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (error: any) {
      errorMessage.value = error.message || 'Failed to create checkout session';
      paymentStep.value = 'error';
      processing.value = false;
      showErrorToast(
        'Payment failed',
        error.message || 'An error occurred while processing your payment. Please try again.'
      );
    }
  }

  function closePaymentModal() {
    if (!processing.value) {
      showPaymentModal.value = false;
      selectedPack.value = null;
      paymentStep.value = 'confirm';
    }
  }
</script>

<style scoped>
  .gradient-overlay {
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, transparent 50%, rgba(79, 70, 229, 0.1) 100%);
  }

  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
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
