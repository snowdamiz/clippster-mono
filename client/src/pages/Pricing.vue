<template>
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-12">
      <div class="flex justify-center items-center gap-3 mb-4">
        <div class="p-2 bg-muted rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>

        <h1 class="text-4xl font-bold">Choose Your Credit Pack</h1>
      </div>

      <p class="text-muted-foreground text-lg">Pay once, use forever. No subscriptions, no expiration dates.</p>

      <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
        <span class="text-sm text-muted-foreground">Current Balance:</span>
        <span class="text-lg font-bold text-foreground">{{ balance.hours_remaining }} hours</span>
      </div>
    </div>
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
    <!-- Error State -->
    <div v-else-if="!packs || Object.keys(packs).length === 0" class="flex flex-col items-center justify-center py-20">
      <svg class="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 class="text-xl font-bold mb-2">Unable to Load Pricing</h3>

      <p class="text-muted-foreground mb-4">Please check your connection and try again</p>
      <button
        @click="retryLoad"
        class="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
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
        :class="{ 'ring-2 ring-purple-500 rounded-2xl': packKey === 'creator' }"
      >
        <!-- Popular Badge -->
        <div
          v-if="packKey === 'creator'"
          class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full z-10 whitespace-nowrap"
        >
          ⭐ MOST POPULAR
        </div>
        <!-- Card -->
        <div
          class="relative overflow-hidden rounded-2xl border bg-card hover:border-purple-500 transition-all cursor-pointer h-full flex flex-col"
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
                <svg class="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Credits never expire</span>
              </li>

              <li class="flex items-center gap-2 text-sm text-muted-foreground">
                <svg class="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Use anytime, no limits</span>
              </li>

              <li class="flex items-center gap-2 text-sm text-muted-foreground">
                <svg class="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>~{{ Math.floor(packs[packKey].hours / 2) }}-{{ packs[packKey].hours }} videos</span>
              </li>
            </ul>
            <!-- Button -->
            <button
              class="w-full py-3 rounded-lg font-semibold transition-all shadow-sm"
              :class="
                packKey === 'creator'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-md'
                  : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border'
              "
              @click.stop="selectPack(packKey, packs[packKey])"
            >
              <span v-if="packKey === 'creator'">Get Started</span>
              <span v-else>Purchase</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Info Section -->
    <div class="mt-20 relative">
      <!-- Background decoration -->
      <div
        class="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 rounded-3xl blur-3xl"
      ></div>

      <div
        class="relative bg-gradient-to-br from-card via-card to-muted/30 rounded-3xl border border-border/50 overflow-hidden"
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
                class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div
                class="relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all"
              >
                <div
                  class="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 mx-auto"
                >
                  <svg class="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
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
                class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div
                class="relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-indigo-500/50 transition-all"
              >
                <div
                  class="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mx-auto"
                >
                  <svg class="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
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
                class="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
              ></div>

              <div
                class="relative p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all"
              >
                <div
                  class="flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 mx-auto"
                >
                  <svg class="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
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
              <svg class="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
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
    <div
      v-if="showPaymentModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="closePaymentModal"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Complete Payment</h2>

        <div v-if="paymentStep === 'confirm'" class="space-y-4">
          <div class="p-4 bg-muted rounded-lg">
            <div class="flex justify-between mb-2">
              <span class="text-muted-foreground">Pack:</span>
              <span class="font-semibold capitalize">{{ selectedPack?.key }}</span>
            </div>

            <div class="flex justify-between mb-2">
              <span class="text-muted-foreground">Credit Hours:</span>
              <span class="font-semibold">{{ selectedPack?.hours }}</span>
            </div>

            <div class="flex justify-between mb-2">
              <span class="text-muted-foreground">Price:</span>
              <span class="font-semibold">${{ Math.round(selectedPack?.usd) }}</span>
            </div>

            <div class="flex justify-between">
              <span class="text-muted-foreground">SOL Amount:</span>
              <span class="font-semibold">{{ selectedPack?.solAmount.toFixed(4) }} SOL</span>
            </div>
          </div>
          <!-- Payment Buttons Row -->
          <div class="grid grid-cols-2 gap-3 mt-7">
            <!-- Crypto Payment Button -->
            <button
              class="py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
              @click="initiatePayment"
              :disabled="processing"
            >
              <span v-if="!processing">Pay with Phantom</span>
              <span v-else>Processing...</span>
            </button>
            <!-- Stripe Payment Button (Coming Soon) -->
            <div class="relative">
              <div
                class="absolute -top-3 -right-3 bg-purple-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10 whitespace-nowrap"
              >
                Coming Soon
              </div>
              <button
                class="w-full py-3 bg-gradient-to-r from-[#635bff] to-[#4e44cb] text-white rounded-lg font-semibold opacity-60 cursor-not-allowed transition-all"
                disabled
                title="Stripe payments coming soon"
              >
                <div class="flex items-center justify-center gap-2">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.902-1.305 2.227 0 4.515.858 6.09 1.631l.894-5.494C18.25 1.242 15.908 0 12.183 0 9.735 0 7.735.658 6.332 1.896 4.862 3.193 4.106 5.058 4.106 7.307c0 4.349 2.637 6.172 5.433 7.344 2.33.946 3.231 1.58 3.231 2.583 0 .96-.813 1.413-2.354 1.413-1.876 0-4.938-.919-7.088-2.144l-.894 5.633c2.162 1.242 4.856 1.896 7.828 1.896 2.566 0 4.693-.62 6.162-1.799 1.574-1.242 2.401-3.066 2.401-5.508 0-4.416-2.672-6.228-5.749-7.525zM24 11.757c0 2.532-2.055 4.587-4.587 4.587S14.826 14.289 14.826 11.757 16.881 7.17 19.413 7.17 24 9.225 24 11.757z"
                    />
                  </svg>
                  Pay with Card
                </div>
              </button>
            </div>
          </div>
          <!-- Cancel Button -->
          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
            @click="closePaymentModal"
            :disabled="processing"
          >
            Cancel
          </button>
        </div>

        <div v-else-if="paymentStep === 'processing'" class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>

          <p class="text-muted-foreground">{{ paymentStatus }}</p>
        </div>

        <div v-else-if="paymentStep === 'success'" class="text-center py-8">
          <svg class="h-16 w-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <h3 class="text-xl font-bold mb-2">Payment Successful!</h3>

          <p class="text-muted-foreground mb-4">{{ selectedPack?.hours }} hours added to your balance</p>
          <button
            class="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
            @click="closePaymentModal"
          >
            Done
          </button>
        </div>

        <div v-else-if="paymentStep === 'error'" class="text-center py-8">
          <svg class="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <h3 class="text-xl font-bold mb-2">Payment Failed</h3>

          <p class="text-muted-foreground mb-4">{{ errorMessage }}</p>
          <button
            class="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all"
            @click="paymentStep = 'confirm'"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useAuthStore } from '@/stores/auth'
  import { useToast } from '@/composables/useToast'

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const authStore = useAuthStore()
  const { success: showSuccessToast, error: showErrorToast } = useToast()

  const loading = ref(true)
  const packs = ref<any>({})
  const packOrder = ref(['starter', 'creator', 'pro', 'studio'])
  const companyWallet = ref('')
  const solUsdRate = ref(0)
  const balance = ref({ hours_remaining: 0, hours_used: 0 })

  const showPaymentModal = ref(false)
  const selectedPack = ref<any>(null)
  const paymentStep = ref<'confirm' | 'processing' | 'success' | 'error'>('confirm')
  const processing = ref(false)
  const paymentStatus = ref('')
  const errorMessage = ref('')

  async function retryLoad() {
    loading.value = true
    await Promise.all([fetchPricing(), fetchBalance()])
    loading.value = false
  }

  onMounted(async () => {
    await retryLoad()
  })

  async function fetchPricing() {
    try {
      const response = await fetch(`${API_BASE}/api/pricing`)
      const data = await response.json()
      if (data.success) {
        packs.value = data.packs
        solUsdRate.value = data.sol_usd_rate
        companyWallet.value = data.company_wallet_address
      } else {
        throw new Error(data.error || 'Failed to fetch pricing')
      }
    } catch (error: any) {
      console.error('Failed to fetch pricing:', error)
      showErrorToast(
        'Failed to load pricing',
        error.message || 'An error occurred while loading credit pack prices. Please try again.'
      )
    }
  }

  async function fetchBalance() {
    try {
      const response = await fetch(`${API_BASE}/api/credits/balance`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      if (data.success) {
        balance.value = data.balance
      } else {
        throw new Error(data.error || 'Failed to fetch balance')
      }
    } catch (error: any) {
      console.error('Failed to fetch balance:', error)
      showErrorToast(
        'Failed to load balance',
        error.message || 'An error occurred while loading your credit balance. Please try again.'
      )
    }
  }

  // SOL price now fetched from server in fetchPricing()
  // No need for separate client-side price fetching

  function calculateSolAmount(usdAmount: number): number {
    if (solUsdRate.value === 0) return 0
    return usdAmount / solUsdRate.value
  }

  function getSolAmountForPack(packKey: string): number {
    // Use server-provided SOL amount if available
    if (packs.value[packKey]?.sol_amount) {
      return packs.value[packKey].sol_amount
    }
    // Fallback calculation
    return calculateSolAmount(packs.value[packKey]?.usd || 0)
  }

  function selectPack(key: string, pack: any) {
    selectedPack.value = {
      key,
      hours: pack.hours,
      usd: pack.usd,
      solAmount: pack.sol_amount || calculateSolAmount(pack.usd)
    }
    showPaymentModal.value = true
    paymentStep.value = 'confirm'
  }

  async function initiatePayment() {
    processing.value = true
    paymentStep.value = 'processing'
    paymentStatus.value = 'Opening payment window...'

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const { listen } = await import('@tauri-apps/api/event')

      // Set up listener for payment completion
      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload

        // Verify payment with backend
        paymentStatus.value = 'Verifying payment...'
        try {
          const confirmResponse = await fetch(`${API_BASE}/api/payments/confirm`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authStore.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tx_signature: paymentResult.signature,
              pack_type: paymentResult.pack_key
            })
          })

          const confirmData = await confirmResponse.json()

          if (confirmData.success) {
            balance.value = confirmData.balance
            paymentStep.value = 'success'
            processing.value = false

            // Show success toast
            showSuccessToast('Purchase successful', `${paymentResult.pack_hours} hours have been added to your account`)

            // Cleanup listener
            unlisten()

            // Refresh balance
            await fetchBalance()
          } else {
            throw new Error(confirmData.error || 'Payment confirmation failed')
          }
        } catch (error: any) {
          console.error('Payment verification error:', error)
          errorMessage.value = error.message || 'Payment verification failed'
          paymentStep.value = 'error'
          processing.value = false
          showErrorToast(
            'Payment verification failed',
            error.message || 'An error occurred while verifying your payment. Please contact support.'
          )
          unlisten()
        }
      })

      // Open payment window in browser
      await invoke('open_wallet_payment_window', {
        packKey: selectedPack.value.key,
        packName: selectedPack.value.key.charAt(0).toUpperCase() + selectedPack.value.key.slice(1),
        hours: selectedPack.value.hours,
        usd: selectedPack.value.usd,
        sol: selectedPack.value.solAmount,
        companyWallet: companyWallet.value,
        authToken: authStore.token
      })

      paymentStatus.value = 'Complete payment in your browser...'
    } catch (error: any) {
      console.error('Payment error:', error)
      errorMessage.value = error.message || 'Failed to open payment window'
      paymentStep.value = 'error'
      processing.value = false
      showErrorToast(
        'Payment failed',
        error.message || 'An error occurred while processing your payment. Please try again.'
      )
    }
  }

  function closePaymentModal() {
    if (!processing.value) {
      showPaymentModal.value = false
      selectedPack.value = null
      paymentStep.value = 'confirm'
    }
  }
</script>

<style scoped>
  .gradient-overlay {
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, transparent 50%, rgba(79, 70, 229, 0.1) 100%);
  }
</style>
