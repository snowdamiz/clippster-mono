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
                  <CreditCard :size="24" />
                </div>
                <h2 class="credits-dialog__title">Buy Organization Credits</h2>
                <p class="credits-dialog__subtitle">Credits go into the organization pool</p>
              </div>

              <!-- Content -->
              <div class="credits-dialog__content">
                <div v-if="loadingPricing" class="credits-dialog__loading">
                  <Loader2 class="credits-dialog__spinner" />
                  <span>Loading pricing...</span>
                </div>

                <template v-else>
                  <p class="credits-dialog__description">
                    Choose a credit pack to add to your organization's pool for team members to use.
                  </p>

                  <div class="credits-dialog__packs">
                    <button
                      v-for="(pack, key) in creditPacks"
                      :key="key"
                      @click="selectPack(key as string, pack)"
                      class="credits-dialog__pack"
                      :class="{ 'credits-dialog__pack--selected': selectedPackKey === key }"
                    >
                      <div class="credits-dialog__pack-header">
                        <span class="credits-dialog__pack-name">{{ key }}</span>
                        <div v-if="selectedPackKey === key" class="credits-dialog__pack-check">
                          <Check :size="14" />
                        </div>
                      </div>
                      <div class="credits-dialog__pack-value">{{ pack.hours }} min</div>
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
                  <Wallet :size="24" />
                </div>
                <h2 class="credits-dialog__title">Confirm Purchase</h2>
                <p class="credits-dialog__subtitle">For {{ organizationName }}</p>
              </div>

              <!-- Content -->
              <div class="credits-dialog__content">
                <div class="credits-dialog__summary">
                  <div class="credits-dialog__summary-row">
                    <span class="credits-dialog__summary-label">Pack</span>
                    <span class="credits-dialog__summary-value credits-dialog__summary-value--accent">
                      {{ selectedPackKey }} Pack
                    </span>
                  </div>
                  <div class="credits-dialog__summary-row">
                    <span class="credits-dialog__summary-label">Credits</span>
                    <span class="credits-dialog__summary-value">{{ selectedPack?.hours }} minutes</span>
                  </div>
                  <div class="credits-dialog__summary-divider"></div>
                  <div class="credits-dialog__summary-row credits-dialog__summary-row--total">
                    <span class="credits-dialog__summary-label">Total</span>
                    <span class="credits-dialog__summary-value credits-dialog__summary-value--total">
                      ${{ selectedPack?.usd.toFixed(2) }}
                    </span>
                  </div>
                  <div v-if="selectedPack?.solAmount" class="credits-dialog__summary-row">
                    <span class="credits-dialog__summary-label">Crypto</span>
                    <span class="credits-dialog__summary-value credits-dialog__summary-value--muted">
                      ~{{ selectedPack.solAmount.toFixed(4) }} SOL
                    </span>
                  </div>
                </div>

                <label class="credits-dialog__label">Payment Method</label>
                <div class="credits-dialog__payment-methods">
                  <button class="credits-dialog__payment-btn" @click="initiateStripePayment">
                    <CreditCard class="credits-dialog__payment-btn-icon" />
                    <div class="credits-dialog__payment-btn-info">
                      <span class="credits-dialog__payment-btn-label">Pay with Card</span>
                      <span class="credits-dialog__payment-btn-hint">Stripe</span>
                    </div>
                    <ChevronRight class="credits-dialog__payment-btn-arrow" />
                  </button>
                  <button class="credits-dialog__payment-btn" @click="initiateCryptoPayment">
                    <Wallet class="credits-dialog__payment-btn-icon" />
                    <div class="credits-dialog__payment-btn-info">
                      <span class="credits-dialog__payment-btn-label">Pay with Crypto</span>
                      <span class="credits-dialog__payment-btn-hint">Solana</span>
                    </div>
                    <ChevronRight class="credits-dialog__payment-btn-arrow" />
                  </button>
                </div>
              </div>

              <!-- Footer -->
              <div class="credits-dialog__footer">
                <button class="credits-dialog__btn credits-dialog__btn--secondary" @click="paymentStep = 'select'">
                  ← Back
                </button>
              </div>
            </template>

            <!-- Processing Step -->
            <template v-else-if="paymentStep === 'processing'">
              <div class="credits-dialog__header">
                <div class="credits-dialog__icon credits-dialog__icon--processing">
                  <Loader2 :size="24" class="credits-dialog__icon-spinner" />
                </div>
                <h2 class="credits-dialog__title">Processing Payment</h2>
                <p class="credits-dialog__subtitle">{{ paymentStatus }}</p>
              </div>

              <div class="credits-dialog__content credits-dialog__content--center">
                <p class="credits-dialog__processing-hint">Please complete payment in the popup window.</p>
              </div>
            </template>

            <!-- Success Step -->
            <template v-else-if="paymentStep === 'success'">
              <div class="credits-dialog__header">
                <div class="credits-dialog__icon credits-dialog__icon--success">
                  <CheckCircle :size="24" />
                </div>
                <h2 class="credits-dialog__title">Payment Successful!</h2>
                <p class="credits-dialog__subtitle">{{ selectedPack?.hours }} minutes added to pool</p>
              </div>

              <div class="credits-dialog__content credits-dialog__content--center">
                <p class="credits-dialog__success-message">
                  Your organization's credit pool has been updated. Team members can now use these credits.
                </p>
              </div>

              <div class="credits-dialog__footer">
                <button class="credits-dialog__btn credits-dialog__btn--success" @click="handleSuccess">Done</button>
              </div>
            </template>

            <!-- Error Step -->
            <template v-else-if="paymentStep === 'error'">
              <div class="credits-dialog__header">
                <button class="credits-dialog__close" @click="handleClose" title="Close">
                  <X :size="18" />
                </button>
                <div class="credits-dialog__icon credits-dialog__icon--error">
                  <AlertTriangle :size="24" />
                </div>
                <h2 class="credits-dialog__title">Payment Failed</h2>
                <p class="credits-dialog__subtitle">Something went wrong</p>
              </div>

              <div class="credits-dialog__content credits-dialog__content--center">
                <div class="credits-dialog__error">
                  <AlertCircle :size="16" />
                  <span>{{ paymentErrorMessage }}</span>
                </div>
              </div>

              <div class="credits-dialog__footer">
                <button class="credits-dialog__btn credits-dialog__btn--secondary" @click="handleClose">Close</button>
                <button class="credits-dialog__btn credits-dialog__btn--primary" @click="paymentStep = 'confirm'">
                  Try Again
                </button>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import {
    CreditCard,
    Wallet,
    Loader2,
    CheckCircle,
    AlertTriangle,
    AlertCircle,
    X,
    Check,
    ChevronRight,
  } from 'lucide-vue-next';
  import api from '@/services/api';
  import { useAuthStore } from '@/stores/auth';

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

  function resetModal() {
    selectedPackKey.value = '';
    selectedPack.value = null;
    paymentStep.value = 'select';
    paymentErrorMessage.value = '';
    paymentProcessing.value = false;
    paymentStatus.value = '';
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

    paymentProcessing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const response = await api.post(`/organizations/${props.organizationId}/payments/stripe/create-session`, {
        pack_type: selectedPackKey.value,
      });

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

    paymentProcessing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Opening payment window...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        paymentStatus.value = 'Verifying payment...';
        try {
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
          const confirmResponse = await fetch(
            `${API_BASE}/api/organizations/${props.organizationId}/payments/confirm`,
            {
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
            }
          );

          const confirmData = await confirmResponse.json();

          if (confirmData.success) {
            paymentStep.value = 'success';
            paymentProcessing.value = false;
            unlisten();
          } else {
            throw new Error(confirmData.error || 'Payment confirmation failed');
          }
        } catch (err: any) {
          paymentErrorMessage.value = err.message || 'Payment verification failed';
          paymentStep.value = 'error';
          paymentProcessing.value = false;
          unlisten();
        }
      });

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await invoke('open_wallet_payment_window', {
        packKey: selectedPackKey.value,
        packName: selectedPackKey.value.charAt(0).toUpperCase() + selectedPackKey.value.slice(1),
        hours: selectedPack.value?.hours,
        usd: selectedPack.value?.usd,
        sol: selectedPack.value?.solAmount,
        companyWallet: companyWallet.value,
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
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .credits-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
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
    padding: 1.5rem 1.5rem 1rem;
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
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .credits-dialog__icon--green {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .credits-dialog__icon--processing {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .credits-dialog__icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .credits-dialog__icon--error {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .credits-dialog__icon-spinner {
    animation: spin 0.8s linear infinite;
  }

  .credits-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .credits-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .credits-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .credits-dialog__content--center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
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

  /* ===== Description ===== */
  .credits-dialog__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0 0 1rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  /* ===== Loading ===== */
  .credits-dialog__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .credits-dialog__spinner {
    width: 24px;
    height: 24px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  /* ===== Pack Selection ===== */
  .credits-dialog__packs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .credits-dialog__pack {
    position: relative;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .credits-dialog__pack:hover {
    border-color: rgba(6, 182, 212, 0.3);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .credits-dialog__pack--selected {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .credits-dialog__pack-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.375rem;
  }

  .credits-dialog__pack-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    text-transform: capitalize;
  }

  .credits-dialog__pack-check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: var(--sidebar-accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .credits-dialog__pack-value {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--sidebar-accent);
    line-height: 1.2;
  }

  .credits-dialog__pack-price {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  /* ===== Summary ===== */
  .credits-dialog__summary {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .credits-dialog__summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
  }

  .credits-dialog__summary-row--total {
    padding-top: 0.75rem;
  }

  .credits-dialog__summary-label {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .credits-dialog__summary-value {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .credits-dialog__summary-value--accent {
    font-weight: 600;
    text-transform: capitalize;
    color: var(--sidebar-accent);
  }

  .credits-dialog__summary-value--total {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
  }

  .credits-dialog__summary-value--muted {
    color: var(--sidebar-text-muted);
    font-size: 0.8125rem;
  }

  .credits-dialog__summary-divider {
    height: 1px;
    background-color: var(--sidebar-border);
    margin: 0.5rem 0;
  }

  /* ===== Label ===== */
  .credits-dialog__label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.5rem;
  }

  /* ===== Payment Methods ===== */
  .credits-dialog__payment-methods {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .credits-dialog__payment-btn {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .credits-dialog__payment-btn:hover {
    border-color: rgba(6, 182, 212, 0.3);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .credits-dialog__payment-btn-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .credits-dialog__payment-btn-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .credits-dialog__payment-btn-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .credits-dialog__payment-btn-hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .credits-dialog__payment-btn-arrow {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  /* ===== Processing ===== */
  .credits-dialog__processing-hint {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Success ===== */
  .credits-dialog__success-message {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 280px;
    line-height: 1.5;
  }

  /* ===== Error ===== */
  .credits-dialog__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #f87171;
    max-width: 320px;
  }

  /* ===== Footer ===== */
  .credits-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .credits-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
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
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .credits-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .credits-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .credits-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .credits-dialog__btn--success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
  }

  .credits-dialog__btn--success:hover:not(:disabled) {
    opacity: 0.9;
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
