<template>
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-12 mt-4">
      <div class="flex justify-center items-center gap-3 mb-4">
        <div class="p-2 bg-muted rounded-md">
          <Coins class="h-6 w-6 text-foreground" />
        </div>
        <h1 class="text-4xl font-bold">Credit Packs</h1>
      </div>
      <p class="text-muted-foreground text-lg">Purchase additional credits to use with Clippster</p>

      <!-- Current Status -->
      <div class="mt-4 inline-flex items-center gap-4 px-6 py-3 bg-muted rounded-lg">
        <div v-if="!authStore.isAuthenticated" class="text-sm text-muted-foreground">
          <button @click="showAuthModal" class="text-purple-600 hover:text-purple-700 font-medium">
            Sign in to view your status
          </button>
        </div>
        <template v-else>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">Credits:</span>
            <span v-if="typeof balance.hours_remaining === 'string'" class="text-sm font-bold text-purple-600">
              Unlimited
            </span>
            <span v-else class="text-sm font-bold text-foreground">{{ Math.round(balance.hours_remaining) }} min</span>
          </div>
          <div class="w-px h-4 bg-border"></div>
          <router-link
            to="/billing"
            class="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <CreditCard class="h-4 w-4" />
            Manage Subscription
          </router-link>
        </template>
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
          <Shield class="h-8 w-8 text-purple-600" />
        </div>
        <h2 class="text-2xl font-bold text-foreground mb-2">Admin Access</h2>
        <p class="text-muted-foreground text-lg mb-4">
          You have unlimited access as an administrator. No subscription or credits needed!
        </p>
        <div
          class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-md border border-purple-500/30"
        >
          <Shield class="h-5 w-5 text-purple-600" />
          <span class="text-purple-600 font-medium">Unlimited Access</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="flex flex-col items-center justify-center py-20">
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

    <template v-else>
      <!-- Credit Packs Section -->
      <div class="mb-16">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            v-for="packKey in packOrder"
            :key="packKey"
            class="relative group"
            :class="{ 'ring-2 ring-indigo-500 rounded-lg': packKey === 'medium' }"
          >
            <!-- Best Value Badge -->
            <div
              v-if="packKey === 'medium'"
              class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full z-5 whitespace-nowrap"
            >
              BEST VALUE
            </div>

            <!-- Card -->
            <div
              class="relative overflow-hidden rounded-lg border bg-card hover:border-indigo-500 transition-all h-full flex flex-col"
              :class="packKey === 'medium' ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-border'"
            >
              <div
                class="gradient-overlay-blue absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div class="relative p-6 flex-1 flex flex-col">
                <!-- Pack Name -->
                <h3 class="text-2xl font-bold mb-2 capitalize">{{ packs[packKey]?.name || packKey }}</h3>

                <!-- Credits -->
                <div class="mb-4" v-if="packs[packKey]">
                  <span class="text-4xl font-bold text-foreground">{{ packs[packKey].hours }}</span>
                  <span class="text-muted-foreground ml-2">credits</span>
                </div>

                <!-- Price -->
                <div class="mb-6" v-if="packs[packKey]">
                  <div class="text-3xl font-bold mb-1">${{ Math.round(packs[packKey].usd) }}</div>
                </div>

                <!-- Features -->
                <ul class="space-y-2.5 mb-6 flex-1" v-if="packs[packKey]">
                  <li class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Credits never expire</span>
                  </li>
                  <li class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Use anytime</span>
                  </li>
                  <li class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check class="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>Stack with subscription credits</span>
                  </li>
                </ul>

                <!-- Button -->
                <button
                  class="w-full py-3 rounded-md font-semibold transition-all shadow-sm"
                  :class="getCreditPackButtonClass(packKey)"
                  @click="selectPack(packKey, packs[packKey])"
                >
                  <span v-if="!authStore.isAuthenticated">Sign in to Purchase</span>
                  <span v-else>Buy Credits</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Info Section -->
      <div class="mt-10 relative">
        <div
          class="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 rounded-xl blur-3xl"
        ></div>

        <div
          class="relative bg-gradient-to-br from-card via-card to-muted/30 rounded-xl border border-border/50 overflow-hidden"
        >
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
                      Save thousands compared to other clipping tools. Same quality, better price.
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
                      Pay with SOL via Phantom or use your card. Instant transactions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

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
              <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

              <div class="p-5 sm:p-6 lg:p-8">
                <!-- Confirm Step -->
                <div v-if="paymentStep === 'confirm'">
                  <div class="mb-4 sm:mb-6 text-center">
                    <div
                      class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                    >
                      <Wallet class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                    </div>
                    <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Purchase Credits</h2>
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
                      <span class="text-zinc-400">Credits:</span>
                      <span class="font-medium text-white">{{ selectedPack?.hours }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs sm:text-sm">
                      <span class="text-zinc-400">Price:</span>
                      <span class="font-semibold text-violet-400">${{ Math.round(selectedPack?.usd || 0) }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-zinc-800">
                      <span class="text-zinc-400">SOL Equivalent:</span>
                      <span class="font-medium text-zinc-300">≈{{ selectedPack?.solAmount?.toFixed(4) }} SOL</span>
                    </div>
                  </div>

                  <!-- Payment Buttons -->
                  <div class="space-y-2 sm:space-y-3">
                    <div class="grid grid-cols-2 gap-2 sm:gap-3">
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

                      <!-- Crypto Payment Button -->
                      <button
                        class="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                        @click="initiateCryptoPayment"
                        :disabled="processing"
                      >
                        <div
                          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                        />
                        <span class="relative flex items-center justify-center gap-1.5">
                          <Loader2 v-if="processing" class="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                          <Wallet v-else class="h-4 w-4 sm:h-5 sm:w-5" />
                          <span>{{ processing ? 'Processing...' : 'Phantom' }}</span>
                        </span>
                      </button>
                    </div>

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
                  <h3 class="text-lg sm:text-xl font-bold text-white mb-2">Purchase Successful!</h3>
                  <p class="text-zinc-400 text-sm mb-5 sm:mb-6">
                    <span class="font-semibold text-emerald-400">{{ selectedPack?.hours }} credits</span>
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
    Coins,
  } from 'lucide-vue-next';

  const authStore = useAuthStore();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const loading = ref(true);
  const loadError = ref(false);

  // Credit pack data
  const packs = ref<any>({});
  const packOrder = ref(['small', 'medium', 'large']);
  const companyWallet = ref('');
  const solUsdRate = ref(0);

  const balance = ref<{ hours_remaining: number | 'unlimited'; hours_used: number }>({
    hours_remaining: 0,
    hours_used: 0,
  });

  // Payment modal state
  const showPaymentModal = ref(false);
  const selectedPack = ref<any>(null);
  const paymentStep = ref<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const processing = ref(false);
  const paymentStatus = ref('');
  const errorMessage = ref('');

  function getCreditPackButtonClass(packKey: string): string {
    if (packKey === 'medium') {
      return 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 hover:shadow-md';
    }
    return 'bg-secondary text-foreground hover:bg-secondary/80 border border-border';
  }

  async function retryLoad() {
    loading.value = true;
    loadError.value = false;
    await Promise.all([fetchPricing(), fetchBalance()]);
    loading.value = false;
  }

  onMounted(async () => {
    await retryLoad();
  });

  async function fetchPricing() {
    try {
      const response = await api.get('/pricing');
      if (response.data.success) {
        packs.value = response.data.packs;
        solUsdRate.value = response.data.sol_usd_rate;
        companyWallet.value = response.data.company_wallet_address;
      }
    } catch (error: any) {
      console.error('Failed to fetch pricing:', error);
      loadError.value = true;
    }
  }

  async function fetchBalance() {
    if (!authStore.isAuthenticated) {
      balance.value = { hours_remaining: 0, hours_used: 0 };
      return;
    }

    try {
      const response = await api.get('/credits/balance');
      if (response.data.success) {
        balance.value = response.data.balance;
      }
    } catch (error: any) {
      console.error('Failed to fetch balance:', error);
    }
  }

  function getSolAmountForPack(packKey: string): number {
    if (packs.value[packKey]?.sol_amount) {
      return packs.value[packKey].sol_amount;
    }
    if (solUsdRate.value === 0) return 0;
    return (packs.value[packKey]?.usd || 0) / solUsdRate.value;
  }

  function selectPack(key: string, pack: any) {
    if (!authStore.isAuthenticated) {
      showAuthModal();
      return;
    }

    selectedPack.value = {
      key,
      hours: pack.hours,
      usd: pack.usd,
      solAmount: pack.sol_amount || (solUsdRate.value > 0 ? pack.usd / solUsdRate.value : 0),
    };
    showPaymentModal.value = true;
    paymentStep.value = 'confirm';
  }

  function showAuthModal() {
    window.dispatchEvent(new CustomEvent('show-auth-modal'));
  }

  async function initiateStripePayment() {
    processing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const response = await api.post('/payments/stripe/create-session', {
        pack_type: selectedPack.value.key,
        return_context: 'desktop',
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
          showSuccessToast('Payment successful', 'Your purchase has been completed');
          unlisten();

          setTimeout(async () => {
            await fetchBalance();
          }, 2000);
        } else {
          unlisten();
        }
      });

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
      showErrorToast('Payment failed', error.message || 'An error occurred');
    }
  }

  async function initiateCryptoPayment() {
    processing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Opening payment window...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        paymentStatus.value = 'Verifying payment...';
        try {
          const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.clippster.app');
          const confirmResponse = await fetch(`${API_BASE}/api/payments/confirm`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authStore.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tx_signature: paymentResult.signature,
              pack_type: paymentResult.pack_key,
              from_address: paymentResult.from_address,
            }),
          });

          const confirmData = await confirmResponse.json();

          if (confirmData.success) {
            balance.value = confirmData.balance;
            paymentStep.value = 'success';
            processing.value = false;
            showSuccessToast('Purchase successful', `${paymentResult.pack_hours} credits added`);
            unlisten();
            await fetchBalance();
          } else {
            throw new Error(confirmData.error || 'Payment confirmation failed');
          }
        } catch (error: any) {
          errorMessage.value = error.message || 'Payment verification failed';
          paymentStep.value = 'error';
          processing.value = false;
          showErrorToast('Payment verification failed', error.message);
          unlisten();
        }
      });

      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.clippster.app');
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
      showErrorToast('Payment failed', error.message);
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
  .gradient-overlay-blue {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, transparent 50%, rgba(59, 130, 246, 0.1) 100%);
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
