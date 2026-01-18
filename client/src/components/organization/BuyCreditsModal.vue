<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="credits-dialog__overlay" @click.self="handleClose" @keydown.esc="handleClose">
        <Transition name="dialog" appear>
          <div v-if="open" class="credits-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="credits-dialog__accent"></div>

            <!-- Pack Selection Step -->
            <template v-if="paymentStep === 'select'">
              <!-- Header -->
              <div class="credits-dialog__header">
                <button class="credits-dialog__close" @click="handleClose" title="Close" :disabled="paymentProcessing">
                  <X :size="18" />
                </button>
                <div class="credits-dialog__icon">
                  <Coins :size="28" />
                </div>
                <h2 class="credits-dialog__title">Buy Organization Credits</h2>
                <p class="credits-dialog__subtitle">Add credits to {{ organizationName }}'s pool</p>
              </div>

              <!-- Content -->
              <div class="credits-dialog__content">
                <div v-if="loadingPricing" class="credits-dialog__loading">
                  <Loader2 class="credits-dialog__spinner" />
                  <span>Loading pricing...</span>
                </div>

                <template v-else>
                  <div class="credits-dialog__info-box">
                    <Zap class="credits-dialog__info-icon" />
                    <div class="credits-dialog__info-text">
                      <strong>Team Credit Pool</strong>
                      <span>Credits are shared across all organization members</span>
                    </div>
                  </div>

                  <div class="credits-dialog__packs">
                    <button
                      v-for="(pack, key) in creditPacks"
                      :key="key"
                      @click="selectPack(key as string, pack)"
                      class="credits-dialog__pack"
                      :class="{ 'credits-dialog__pack--selected': selectedPackKey === key }"
                    >
                      <div class="credits-dialog__pack-icon">
                        <Zap :size="20" />
                      </div>
                      <div class="credits-dialog__pack-name">{{ key }}</div>
                      <div class="credits-dialog__pack-value">{{ pack.hours }}</div>
                      <div class="credits-dialog__pack-unit">minutes</div>
                      <div class="credits-dialog__pack-divider"></div>
                      <div class="credits-dialog__pack-price">
                        ${{ pack.usd % 1 === 0 ? pack.usd : pack.usd.toFixed(2) }}
                      </div>
                    </button>
                  </div>
                </template>
              </div>

              <!-- Footer -->
              <div class="credits-dialog__footer">
                <button class="credits-dialog__btn credits-dialog__btn--secondary" @click="handleClose">Cancel</button>
                <button
                  class="credits-dialog__btn credits-dialog__btn--primary"
                  @click="paymentStep = 'confirm'"
                  :disabled="!selectedPackKey"
                >
                  Continue
                </button>
              </div>
            </template>

            <!-- Confirm/Pay Step -->
            <template v-else-if="paymentStep === 'confirm'">
              <!-- Header -->
              <div class="credits-dialog__header">
                <button class="credits-dialog__close" @click="handleClose" title="Close" :disabled="paymentProcessing">
                  <X :size="18" />
                </button>
                <div class="credits-dialog__icon credits-dialog__icon--green">
                  <ShoppingCart :size="28" />
                </div>
                <h2 class="credits-dialog__title">Confirm Purchase</h2>
                <p class="credits-dialog__subtitle">For {{ organizationName }}</p>
              </div>

              <!-- Content -->
              <div class="credits-dialog__content">
                <div class="credits-dialog__summary">
                  <div class="credits-dialog__summary-header">
                    <span class="credits-dialog__summary-pack">{{ selectedPackKey }} Pack</span>
                  </div>
                  <div class="credits-dialog__summary-main">
                    <Zap class="credits-dialog__summary-icon" />
                    <div class="credits-dialog__summary-details">
                      <div class="credits-dialog__summary-credits">{{ selectedPack?.hours }} <span>minutes</span></div>
                      <div class="credits-dialog__summary-price">${{ discountedPrice }}</div>
                    </div>
                  </div>
                  <div v-if="validatedPromo" class="credits-dialog__summary-discount">
                    <Percent :size="14" />
                    <span>{{ validatedPromo.percent_off }}% discount applied</span>
                  </div>
                  <div v-if="selectedPack?.solAmount" class="credits-dialog__summary-crypto">
                    <span>~{{ selectedPack.solAmount.toFixed(4) }} SOL</span>
                  </div>
                </div>

                <!-- Promo Code Section -->
                <div class="credits-dialog__promo">
                  <label class="credits-dialog__promo-label">
                    <Tag :size="14" />
                    Promo Code
                  </label>
                  <div class="credits-dialog__promo-input-group">
                    <input
                      v-model="promoCode"
                      type="text"
                      placeholder="Enter discount code"
                      class="credits-dialog__promo-input"
                      :disabled="validatingPromo"
                      @keyup.enter="validatePromoCode"
                    />
                    <button
                      type="button"
                      @click="validatePromoCode"
                      class="credits-dialog__promo-btn"
                      :disabled="validatingPromo || !promoCode.trim()"
                    >
                      <Loader2 v-if="validatingPromo" :size="16" class="credits-dialog__spinner" />
                      <span v-else>Apply</span>
                    </button>
                  </div>

                  <div v-if="promoError" class="credits-dialog__promo-error">
                    <AlertCircle :size="14" />
                    <span>{{ promoError }}</span>
                  </div>

                  <div v-if="validatedPromo" class="credits-dialog__promo-success">
                    <Percent :size="14" />
                    <span>{{ validatedPromo.percent_off }}% discount applied!</span>
                    <button type="button" @click="clearPromoCode" class="credits-dialog__promo-clear">
                      <X :size="14" />
                    </button>
                  </div>
                </div>

                <!-- Payment Section -->
                <div class="credits-dialog__payment-wrapper">
                  <div class="credits-dialog__payment-section">
                    <label class="credits-dialog__payment-label">Choose Payment Method</label>
                    <div class="credits-dialog__payment-buttons">
                      <button 
                        class="credits-dialog__payment-btn credits-dialog__payment-btn--stripe" 
                        @click="initiateStripePayment"
                        :disabled="paymentProcessing"
                      >
                        <div class="credits-dialog__payment-btn-content">
                          <Loader2 v-if="paymentProcessing && paymentMethod === 'stripe'" :size="24" class="credits-dialog__spinner" />
                          <svg v-else class="credits-dialog__payment-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.3 4.5c-2.2 0-3.6 1.1-3.6 2.8 0 1.9 1.4 2.6 3.3 3.2 2.5.8 3.8 1.7 3.8 3.5 0 2.3-1.8 3.5-4.3 3.5-1.8 0-3.3-.5-4.5-1.3l-.8 2.8c1.1.7 2.8 1.2 4.8 1.2 3.3 0 5.3-1.6 5.3-4 0-1.9-1.2-2.8-3.4-3.5-2.2-.7-3.6-1.4-3.6-3 0-1.3 1.1-2.5 3.3-2.5 1.4 0 2.6.4 3.5.8l.7-2.7c-1-.5-2.3-.8-3.5-.8z" fill="currentColor"/>
                          </svg>
                          <div class="credits-dialog__payment-btn-text">
                            <span class="credits-dialog__payment-btn-label">Pay with Card</span>
                            <span class="credits-dialog__payment-btn-hint">Powered by Stripe</span>
                          </div>
                        </div>
                      </button>

                      <button 
                        class="credits-dialog__payment-btn credits-dialog__payment-btn--phantom" 
                        @click="initiateCryptoPayment"
                        :disabled="paymentProcessing"
                      >
                        <div class="credits-dialog__payment-btn-content">
                          <Loader2 v-if="paymentProcessing && paymentMethod === 'crypto'" :size="24" class="credits-dialog__spinner" />
                          <svg v-else class="credits-dialog__payment-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M27 7.5C27 10.5 25 13.5 22 15.5L25 20.5C25.5 21.5 25 23 23.5 23.5C22.5 24 21 23.5 20.5 22L17 16C16.5 16 16 16 15.5 16C14 16 12.5 15.5 11.5 14.5L9 19C8.5 20 7 20.5 6 20C5 19.5 4.5 18 5 17L7.5 12C6 10.5 5 8.5 5 6.5C5 4 6.5 2.5 9 2.5H23C25.5 2.5 27 4 27 7.5ZM10 6.5C10 7.5 10.5 8 11.5 8C12.5 8 13 7.5 13 6.5C13 5.5 12.5 5 11.5 5C10.5 5 10 5.5 10 6.5ZM19 6.5C19 7.5 19.5 8 20.5 8C21.5 8 22 7.5 22 6.5C22 5.5 21.5 5 20.5 5C19.5 5 19 5.5 19 6.5Z" fill="currentColor"/>
                          </svg>
                          <div class="credits-dialog__payment-btn-text">
                            <span class="credits-dialog__payment-btn-label">Pay with Crypto</span>
                            <span class="credits-dialog__payment-btn-hint">Phantom Wallet</span>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <!-- Cancel Button -->
                  <button
                    type="button"
                    class="credits-dialog__cancel-btn"
                    @click="paymentStep = 'select'"
                    :disabled="paymentProcessing"
                  >
                    ← Back to Packs
                  </button>
                </div>
              </div>
            </template>

            <!-- Processing Step -->
            <template v-else-if="paymentStep === 'processing'">
              <div class="credits-dialog__centered">
                <div class="credits-dialog__icon credits-dialog__icon--processing">
                  <Loader2 :size="32" class="credits-dialog__icon-spinner" />
                </div>
                <h3 class="credits-dialog__centered-title">Processing Payment</h3>
                <p class="credits-dialog__centered-subtitle">{{ paymentStatus }}</p>
              </div>
            </template>

            <!-- Success Step -->
            <template v-else-if="paymentStep === 'success'">
              <div class="credits-dialog__centered">
                <div class="credits-dialog__icon credits-dialog__icon--success">
                  <CheckCircle :size="32" />
                </div>
                <h3 class="credits-dialog__centered-title">Credits Added!</h3>
                <p class="credits-dialog__centered-subtitle">
                  {{ selectedPack?.hours }} minutes added to {{ organizationName }}'s pool
                </p>
                <button class="credits-dialog__success-btn" @click="handleSuccess">
                  Done
                </button>
              </div>
            </template>

            <!-- Error Step -->
            <template v-else-if="paymentStep === 'error'">
              <div class="credits-dialog__centered">
                <div class="credits-dialog__icon credits-dialog__icon--error">
                  <AlertTriangle :size="32" />
                </div>
                <h3 class="credits-dialog__centered-title">Payment Failed</h3>
                <p class="credits-dialog__centered-subtitle">{{ paymentErrorMessage }}</p>
                <div class="credits-dialog__error-actions">
                  <button class="credits-dialog__retry-btn" @click="paymentStep = 'confirm'">
                    Try Again
                  </button>
                  <button class="credits-dialog__cancel-btn" @click="handleClose">
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
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import {
    CreditCard,
    Wallet,
    Loader2,
    CheckCircle,
    AlertTriangle,
    AlertCircle,
    X,
    Coins,
    Zap,
    ShoppingCart,
    Tag,
    Percent,
  } from 'lucide-vue-next';
  import api from '@/services/api';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';

  const props = defineProps<{
    open: boolean;
    organizationId: string;
    organizationName: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'success'): void;
  }>();

  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  // State
  const loadingPricing = ref(false);
  const creditPacks = ref<Record<string, { hours: number; usd: number; sol_amount?: number }>>({});
  const companyWallet = ref('');
  const solUsdRate = ref(0);
  const selectedPackKey = ref<string>('');
  const selectedPack = ref<{ hours: number; usd: number; solAmount: number } | null>(null);
  const paymentStep = ref<'select' | 'confirm' | 'processing' | 'success' | 'error'>('select');
  const paymentProcessing = ref(false);
  const paymentStatus = ref('');
  const paymentErrorMessage = ref('');
  const paymentMethod = ref<'stripe' | 'crypto' | null>(null);

  // Promo code state
  const promoCode = ref('');
  const validatedPromo = ref<any>(null);
  const validatingPromo = ref(false);
  const promoError = ref('');

  const discountedPrice = computed(() => {
    if (!selectedPack.value) return '0.00';
    const basePrice = selectedPack.value.usd;
    if (validatedPromo.value) {
      const discount = validatedPromo.value.percent_off / 100;
      return (basePrice * (1 - discount)).toFixed(2);
    }
    return basePrice.toFixed(2);
  });

  async function fetchPricing() {
    loadingPricing.value = true;
    try {
      const response = await api.get('/pricing');
      if (response.data.success) {
        creditPacks.value = response.data.packs;
        solUsdRate.value = response.data.sol_usd_rate;
        companyWallet.value = response.data.company_wallet_address;
      }
    } catch (err) {
      console.error('[BuyCreditsModal] Failed to fetch pricing:', err);
    } finally {
      loadingPricing.value = false;
    }
  }

  function selectPack(key: string, pack: { hours: number; usd: number; sol_amount?: number }) {
    selectedPackKey.value = key;
    selectedPack.value = {
      hours: pack.hours,
      usd: pack.usd,
      solAmount: pack.sol_amount || (solUsdRate.value > 0 ? pack.usd / solUsdRate.value : 0),
    };
  }

  async function validatePromoCode() {
    if (!promoCode.value.trim()) return;

    validatingPromo.value = true;
    promoError.value = '';

    try {
      const response = await api.post(`/organizations/${props.organizationId}/subscription/promo/validate`, {
        code: promoCode.value.trim(),
        tier: selectedPackKey.value,
        type: 'credit_pack'
      });

      if (response.data.success && response.data.promo) {
        validatedPromo.value = response.data.promo;
        showSuccess('Promo code applied!', `${response.data.promo.percent_off}% discount`);
      } else {
        validatedPromo.value = null;
        promoError.value = response.data.error || 'Invalid promo code';
      }
    } catch (error: any) {
      validatedPromo.value = null;
      promoError.value = error.response?.data?.error || error.message || 'Failed to validate promo code';
    } finally {
      validatingPromo.value = false;
    }
  }

  function clearPromoCode() {
    promoCode.value = '';
    validatedPromo.value = null;
    promoError.value = '';
  }

  function resetModal() {
    selectedPackKey.value = '';
    selectedPack.value = null;
    paymentStep.value = 'select';
    paymentErrorMessage.value = '';
    paymentProcessing.value = false;
    paymentStatus.value = '';
    promoCode.value = '';
    validatedPromo.value = null;
    promoError.value = '';
  }

  function handleClose() {
    if (paymentProcessing.value) return;
    resetModal();
    emit('update:open', false);
  }

  function handleSuccess() {
    resetModal();
    emit('update:open', false);
    emit('success');
  }

  async function initiateStripePayment() {
    if (!selectedPackKey.value || !props.organizationId) return;

    paymentMethod.value = 'stripe';
    paymentProcessing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const payload: any = {
        pack_type: selectedPackKey.value,
      };

      // Add promo code if validated
      if (validatedPromo.value && promoCode.value.trim()) {
        payload.promo_code = promoCode.value.trim();
      }

      const response = await api.post(`/organizations/${props.organizationId}/payments/stripe/create-session`, payload);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }

      const { url: checkoutUrl } = response.data;

      const unlisten = await listen('stripe-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        if (paymentResult.success) {
          paymentStep.value = 'success';
          paymentProcessing.value = false;
          unlisten();
        } else {
          unlisten();
        }
      });

      paymentStatus.value = 'Opening payment page...';
      await invoke('open_stripe_payment_window', {
        checkoutUrl: checkoutUrl,
        packKey: selectedPackKey.value,
        packHours: selectedPack.value?.hours,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (err: any) {
      paymentErrorMessage.value = err.message || 'Failed to create checkout session';
      paymentStep.value = 'error';
      paymentProcessing.value = false;
    }
  }

  async function initiateCryptoPayment() {
    if (!selectedPackKey.value || !props.organizationId) return;

    paymentMethod.value = 'crypto';
    paymentProcessing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Getting payment quote...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Get quote with potential promo code discount
      const quotePayload: any = {
        organization_id: props.organizationId,
        pack_type: selectedPackKey.value,
      };

      if (validatedPromo.value && promoCode.value.trim()) {
        quotePayload.promo_code = promoCode.value.trim();
      }

      const quoteResponse = await api.post('/payments/quote', quotePayload);

      if (!quoteResponse.data.success) {
        throw new Error(quoteResponse.data.error || 'Failed to get quote');
      }

      const quote = quoteResponse.data.quote;

      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        paymentStatus.value = 'Verifying payment...';
        try {
          const confirmPayload: any = {
            tx_signature: paymentResult.signature,
            pack_type: paymentResult.pack_key,
            from_address: paymentResult.from_address,
          };

          // Include promo code in confirmation if validated
          if (validatedPromo.value && promoCode.value.trim()) {
            confirmPayload.promo_code = promoCode.value.trim();
          }

          const confirmResponse = await api.post(
            `/organizations/${props.organizationId}/payments/confirm`,
            confirmPayload
          );

          if (confirmResponse.data.success) {
            paymentStep.value = 'success';
            paymentProcessing.value = false;
            unlisten();
          } else {
            throw new Error(confirmResponse.data.error || 'Payment confirmation failed');
          }
        } catch (err: any) {
          paymentErrorMessage.value = err.message || 'Payment verification failed';
          paymentStep.value = 'error';
          paymentProcessing.value = false;
          unlisten();
        }
      });

      paymentStatus.value = 'Opening payment window...';
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await invoke('open_wallet_payment_window', {
        packKey: selectedPackKey.value,
        packName: selectedPackKey.value.charAt(0).toUpperCase() + selectedPackKey.value.slice(1),
        hours: selectedPack.value?.hours,
        usd: quote.amount_usd,
        sol: quote.amount_sol,
        companyWallet: quote.company_wallet,
        authToken: authStore.token,
        apiBase,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (err: any) {
      paymentErrorMessage.value = err.message || 'Failed to open payment window';
      paymentStep.value = 'error';
      paymentProcessing.value = false;
    }
  }

  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen && Object.keys(creditPacks.value).length === 0) {
        fetchPricing();
      }
      if (!isOpen) {
        resetModal();
      }
    }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .credits-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  /* ===== Dialog Container ===== */
  .credits-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    margin-top: 30px;
  }

  /* ===== Accent Bar ===== */
  .credits-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .credits-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 2rem 1.5rem;
    text-align: center;
  }

  .credits-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
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

  .credits-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: rgba(6, 182, 212, 0.15);
    border: 2px solid rgba(6, 182, 212, 0.25);
    color: var(--sidebar-accent);
    margin-bottom: 1rem;
  }

  .credits-dialog__icon--green {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .credits-dialog__icon--processing {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  .credits-dialog__icon--success {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .credits-dialog__icon--error {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .credits-dialog__icon-spinner {
    animation: spin 0.8s linear infinite;
  }

  .credits-dialog__title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .credits-dialog__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0.375rem 0 0;
  }

  /* ===== Content Area ===== */
  .credits-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 0;
  }

  .credits-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .credits-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .credits-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Info Box ===== */
  .credits-dialog__info-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 10px;
  }

  .credits-dialog__info-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .credits-dialog__info-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .credits-dialog__info-text strong {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .credits-dialog__info-text span {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Loading ===== */
  .credits-dialog__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .credits-dialog__spinner {
    width: 28px;
    height: 28px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  /* ===== Pack Selection ===== */
  .credits-dialog__packs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .credits-dialog__pack {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .credits-dialog__pack:hover {
    border-color: rgba(6, 182, 212, 0.3);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .credits-dialog__pack--selected {
    border-color: var(--sidebar-accent);
    box-shadow: 0 4px 20px rgba(6, 182, 212, 0.2);
  }

  .credits-dialog__pack-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 1rem;
  }

  .credits-dialog__pack-name {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .credits-dialog__pack-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    line-height: 1;
    letter-spacing: -0.03em;
    margin-bottom: 0.125rem;
  }

  .credits-dialog__pack-unit {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin-bottom: 1rem;
  }

  .credits-dialog__pack-divider {
    width: 100%;
    height: 1px;
    background-color: var(--sidebar-border);
    margin-bottom: 1rem;
  }

  .credits-dialog__pack-price {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-accent);
    letter-spacing: -0.01em;
  }

  /* ===== Summary Card ===== */
  .credits-dialog__summary {
    padding: 1.5rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
  }

  .credits-dialog__summary-header {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .credits-dialog__summary-pack {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    text-transform: capitalize;
  }

  .credits-dialog__summary-main {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .credits-dialog__summary-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .credits-dialog__summary-details {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .credits-dialog__summary-credits {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
  }

  .credits-dialog__summary-credits span {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin-left: 0.25rem;
  }

  .credits-dialog__summary-price {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-accent);
    letter-spacing: -0.02em;
  }

  .credits-dialog__summary-crypto {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--sidebar-border);
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: center;
  }

  .credits-dialog__summary-discount {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--sidebar-border);
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 500;
  }

  /* ===== Payment Wrapper ===== */
  .credits-dialog__payment-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  /* ===== Payment Section ===== */
  .credits-dialog__payment-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .credits-dialog__payment-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    text-align: center;
  }

  .credits-dialog__payment-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .credits-dialog__payment-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    overflow: hidden;
  }

  .credits-dialog__payment-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-dialog__payment-btn-content {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
    width: 100%;
  }

  .credits-dialog__payment-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .credits-dialog__payment-btn-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    flex: 1;
  }

  .credits-dialog__payment-btn-label {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .credits-dialog__payment-btn-hint {
    font-size: 0.6875rem;
    font-weight: 500;
    opacity: 0.85;
    line-height: 1;
  }

  /* Stripe Button */
  .credits-dialog__payment-btn--stripe {
    background: linear-gradient(135deg, #635bff 0%, #5851ea 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 91, 255, 0.25);
  }

  .credits-dialog__payment-btn--stripe:hover:not(:disabled) {
    background: linear-gradient(135deg, #5851ea 0%, #4d46d9 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(99, 91, 255, 0.35);
  }

  /* Phantom Button */
  .credits-dialog__payment-btn--phantom {
    background: linear-gradient(135deg, #7c65e8 0%, #6a52d9 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(124, 101, 232, 0.3);
  }

  .credits-dialog__payment-btn--phantom:hover:not(:disabled) {
    background: linear-gradient(135deg, #6a52d9 0%, #5c45c7 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 101, 232, 0.4);
  }

  .credits-dialog__cancel-btn {
    width: 100%;
    padding: 0.75rem;
    background-color: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .credits-dialog__cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-dialog__cancel-btn:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--sidebar-text);
  }

  /* ===== Centered States ===== */
  .credits-dialog__centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 2rem;
    gap: 1rem;
  }

  .credits-dialog__centered-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .credits-dialog__centered-subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  .credits-dialog__success-btn {
    margin-top: 0.5rem;
    padding: 0.875rem 2rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .credits-dialog__success-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .credits-dialog__error-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .credits-dialog__retry-btn {
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .credits-dialog__retry-btn:hover {
    opacity: 0.9;
  }

  /* ===== Footer ===== */
  .credits-dialog__footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .credits-dialog__btn {
    flex: 1;
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

  .credits-dialog__btn:disabled {
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
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--sidebar-text);
  }

  .credits-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.25);
  }

  .credits-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.35);
  }

  .credits-dialog__spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Promo Code Section ===== */
  .credits-dialog__promo {
    padding: 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .credits-dialog__promo-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .credits-dialog__promo-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .credits-dialog__promo-input {
    flex: 1;
    padding: 0.625rem 0.75rem;
    background-color: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .credits-dialog__promo-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
  }

  .credits-dialog__promo-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-dialog__promo-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0 1rem;
    background-color: var(--sidebar-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .credits-dialog__promo-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-dialog__promo-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .credits-dialog__promo-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 6px;
    font-size: 0.75rem;
    color: #f87171;
  }

  .credits-dialog__promo-success {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background-color: rgba(16, 185, 129, 0.1);
    border-radius: 6px;
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 500;
  }

  .credits-dialog__promo-clear {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;
  }

  .credits-dialog__promo-clear:hover {
    background-color: rgba(0, 0, 0, 0.1);
    color: #f87171;
  }

  /* ===== Transitions ===== */
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
