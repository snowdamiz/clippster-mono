<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="credits-modal__backdrop" @click.self="handleClose">
        <div class="credits-modal">
          <div class="credits-modal__accent"></div>

          <div class="credits-modal__content">
            <!-- Pack Selection Step -->
            <div v-if="paymentStep === 'select'">
              <div class="credits-modal__header">
                <div class="credits-modal__header-icon">
                  <CreditCard class="credits-modal__header-icon-svg" />
                </div>
                <h2 class="credits-modal__title">Buy Organization Credits</h2>
                <p class="credits-modal__subtitle">Credits go into the organization pool</p>
              </div>

              <div v-if="loadingPricing" class="credits-modal__loading">
                <Loader2 class="credits-modal__loading-spinner" />
                <span>Loading pricing...</span>
              </div>

              <template v-else>
                <div class="credits-modal__packs">
                  <button
                    v-for="(pack, key) in creditPacks"
                    :key="key"
                    @click="selectPack(key as string, pack)"
                    class="credits-modal__pack"
                    :class="{ 'credits-modal__pack--selected': selectedPackKey === key }"
                  >
                    <div class="credits-modal__pack-name">{{ key }}</div>
                    <div class="credits-modal__pack-hours">{{ pack.hours }} min</div>
                    <div class="credits-modal__pack-price">${{ Math.round(pack.usd) }}</div>
                  </button>
                </div>

                <div class="credits-modal__actions">
                  <button class="credits-modal__btn credits-modal__btn--secondary" @click="handleClose">Cancel</button>
                  <button
                    class="credits-modal__btn credits-modal__btn--primary"
                    @click="paymentStep = 'confirm'"
                    :disabled="!selectedPackKey"
                  >
                    Continue
                  </button>
                </div>
              </template>
            </div>

            <!-- Confirm/Pay Step -->
            <div v-else-if="paymentStep === 'confirm'">
              <div class="credits-modal__header">
                <div class="credits-modal__header-icon credits-modal__header-icon--cyan">
                  <Wallet class="credits-modal__header-icon-svg" />
                </div>
                <h2 class="credits-modal__title">Confirm Purchase</h2>
                <p class="credits-modal__subtitle">For {{ organizationName }}</p>
              </div>

              <div class="credits-modal__summary">
                <div class="credits-modal__summary-row">
                  <span class="credits-modal__summary-label">Pack</span>
                  <span class="credits-modal__summary-value credits-modal__summary-value--highlight">
                    {{ selectedPackKey }} Pack
                  </span>
                </div>
                <div class="credits-modal__summary-row">
                  <span class="credits-modal__summary-label">Credits</span>
                  <span class="credits-modal__summary-value">{{ selectedPack?.hours }} minutes</span>
                </div>
                <div class="credits-modal__summary-divider"></div>
                <div class="credits-modal__summary-row credits-modal__summary-row--total">
                  <span class="credits-modal__summary-label">Total</span>
                  <span class="credits-modal__summary-value credits-modal__summary-value--usd">
                    ${{ selectedPack?.usd.toFixed(2) }}
                  </span>
                </div>
                <div v-if="selectedPack?.solAmount" class="credits-modal__summary-row">
                  <span class="credits-modal__summary-label">Crypto</span>
                  <span class="credits-modal__summary-value credits-modal__summary-value--sol">
                    ~{{ selectedPack.solAmount.toFixed(4) }} SOL
                  </span>
                </div>
              </div>

              <div class="credits-modal__payment-methods">
                <button class="credits-modal__payment-btn" @click="initiateStripePayment">
                  <CreditCard class="credits-modal__payment-btn-icon" />
                  <span class="credits-modal__payment-btn-label">Pay with Card</span>
                  <span class="credits-modal__payment-btn-hint">Stripe</span>
                </button>
                <button class="credits-modal__payment-btn" @click="initiateCryptoPayment">
                  <Wallet class="credits-modal__payment-btn-icon" />
                  <span class="credits-modal__payment-btn-label">Pay with Crypto</span>
                  <span class="credits-modal__payment-btn-hint">Solana</span>
                </button>
              </div>

              <button class="credits-modal__back-btn" @click="paymentStep = 'select'">← Back to pack selection</button>
            </div>

            <!-- Processing Step -->
            <div v-else-if="paymentStep === 'processing'" class="credits-modal__processing">
              <div class="credits-modal__processing-spinner">
                <Loader2 class="credits-modal__processing-spinner-icon" />
              </div>
              <h3 class="credits-modal__processing-title">Processing Payment</h3>
              <p class="credits-modal__processing-status">{{ paymentStatus }}</p>
            </div>

            <!-- Success Step -->
            <div v-else-if="paymentStep === 'success'" class="credits-modal__result">
              <div class="credits-modal__result-icon credits-modal__result-icon--success">
                <CheckCircle class="credits-modal__result-icon-svg" />
              </div>
              <h3 class="credits-modal__result-title">Payment Successful!</h3>
              <p class="credits-modal__result-desc">
                {{ selectedPack?.hours }} minutes have been added to your organization's credit pool.
              </p>
              <button class="credits-modal__btn credits-modal__btn--success" @click="handleSuccess">Done</button>
            </div>

            <!-- Error Step -->
            <div v-else-if="paymentStep === 'error'" class="credits-modal__result">
              <div class="credits-modal__result-icon credits-modal__result-icon--error">
                <AlertTriangle class="credits-modal__result-icon-svg" />
              </div>
              <h3 class="credits-modal__result-title">Payment Failed</h3>
              <p class="credits-modal__result-desc">{{ paymentErrorMessage }}</p>
              <div class="credits-modal__result-actions">
                <button class="credits-modal__btn credits-modal__btn--primary" @click="paymentStep = 'confirm'">
                  Try Again
                </button>
                <button class="credits-modal__btn credits-modal__btn--secondary" @click="handleClose">Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted } from 'vue';
  import { CreditCard, Wallet, Loader2, CheckCircle, AlertTriangle } from 'lucide-vue-next';
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
  .credits-modal__backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .credits-modal {
    background: linear-gradient(to bottom, #18181b, #09090b);
    border-radius: 16px;
    max-width: 480px;
    width: calc(100% - 2rem);
    max-height: 90vh;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .credits-modal__accent {
    height: 4px;
    width: 100%;
    background: linear-gradient(90deg, #8b5cf6 0%, #a855f7 50%, #6366f1 100%);
  }

  .credits-modal__content {
    padding: 1.5rem;
  }

  .credits-modal__header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .credits-modal__header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    margin-bottom: 1rem;
  }

  .credits-modal__header-icon--cyan {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .credits-modal__header-icon--cyan .credits-modal__header-icon-svg {
    color: #22d3ee;
  }

  .credits-modal__header-icon-svg {
    width: 24px;
    height: 24px;
    color: #a78bfa;
  }

  .credits-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .credits-modal__subtitle {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0.25rem 0 0;
  }

  .credits-modal__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: #a1a1aa;
  }

  .credits-modal__loading-spinner {
    width: 24px;
    height: 24px;
    animation: spin 0.8s linear infinite;
  }

  .credits-modal__packs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .credits-modal__pack {
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid #3f3f46;
    background-color: rgba(24, 24, 27, 0.8);
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .credits-modal__pack:hover {
    border-color: #52525b;
    background-color: rgba(39, 39, 42, 0.8);
  }

  .credits-modal__pack--selected {
    background-color: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .credits-modal__pack-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: white;
    text-transform: capitalize;
    margin-bottom: 0.25rem;
  }

  .credits-modal__pack-hours {
    font-size: 1.25rem;
    font-weight: 700;
    color: #a78bfa;
  }

  .credits-modal__pack-price {
    font-size: 0.875rem;
    color: #71717a;
  }

  .credits-modal__actions {
    display: flex;
    gap: 0.75rem;
  }

  .credits-modal__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .credits-modal__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .credits-modal__btn--secondary {
    background-color: #27272a;
    color: #d4d4d8;
    border: 1px solid #3f3f46;
  }

  .credits-modal__btn--secondary:hover:not(:disabled) {
    background-color: #3f3f46;
    color: white;
  }

  .credits-modal__btn--primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
  }

  .credits-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .credits-modal__btn--success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    width: 100%;
  }

  .credits-modal__summary {
    padding: 1rem;
    background-color: rgba(24, 24, 27, 0.8);
    border-radius: 12px;
    border: 1px solid #3f3f46;
    margin-bottom: 1.25rem;
  }

  .credits-modal__summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
  }

  .credits-modal__summary-row--total {
    padding-top: 0.75rem;
  }

  .credits-modal__summary-label {
    font-size: 0.875rem;
    color: #a1a1aa;
  }

  .credits-modal__summary-value {
    font-size: 0.875rem;
    color: #e4e4e7;
  }

  .credits-modal__summary-value--highlight {
    font-weight: 600;
    text-transform: capitalize;
    color: #a78bfa;
  }

  .credits-modal__summary-value--usd {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
  }

  .credits-modal__summary-value--sol {
    color: #71717a;
    font-size: 0.8125rem;
  }

  .credits-modal__summary-divider {
    height: 1px;
    background-color: #3f3f46;
    margin: 0.5rem 0;
  }

  .credits-modal__payment-methods {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1rem;
  }

  .credits-modal__payment-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 10px;
    border: 1px solid #3f3f46;
    background-color: rgba(24, 24, 27, 0.8);
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .credits-modal__payment-btn:hover {
    border-color: rgba(139, 92, 246, 0.4);
    background-color: rgba(139, 92, 246, 0.1);
  }

  .credits-modal__payment-btn-icon {
    width: 20px;
    height: 20px;
    color: #a78bfa;
    flex-shrink: 0;
  }

  .credits-modal__payment-btn-label {
    flex: 1;
    font-weight: 500;
  }

  .credits-modal__payment-btn-hint {
    font-size: 0.75rem;
    color: #71717a;
  }

  .credits-modal__back-btn {
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: #71717a;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: color 150ms ease;
  }

  .credits-modal__back-btn:hover {
    color: #a1a1aa;
  }

  .credits-modal__processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
  }

  .credits-modal__processing-spinner {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .credits-modal__processing-spinner-icon {
    width: 28px;
    height: 28px;
    color: #a78bfa;
    animation: spin 0.8s linear infinite;
  }

  .credits-modal__processing-title {
    font-size: 1rem;
    font-weight: 600;
    color: white;
    margin: 0 0 0.375rem;
  }

  .credits-modal__processing-status {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0;
  }

  .credits-modal__result {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
  }

  .credits-modal__result-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .credits-modal__result-icon--success {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .credits-modal__result-icon--success .credits-modal__result-icon-svg {
    color: #34d399;
  }

  .credits-modal__result-icon--error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .credits-modal__result-icon--error .credits-modal__result-icon-svg {
    color: #f87171;
  }

  .credits-modal__result-icon-svg {
    width: 28px;
    height: 28px;
  }

  .credits-modal__result-title {
    font-size: 1rem;
    font-weight: 600;
    color: white;
    margin: 0 0 0.375rem;
  }

  .credits-modal__result-desc {
    font-size: 0.875rem;
    color: #a1a1aa;
    margin: 0 0 1.25rem;
    max-width: 280px;
  }

  .credits-modal__result-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  /* Modal Transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
