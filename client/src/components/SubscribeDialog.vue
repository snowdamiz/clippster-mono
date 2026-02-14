<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="subscribe-dialog__overlay"
        @click.self="handleClose"
        @keydown.esc="handleClose"
        tabindex="-1"
      >
        <Transition name="dialog" appear>
          <div
            v-if="open"
            class="subscribe-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscribe-dialog-title"
          >
            <!-- Accent bar -->
            <div class="subscribe-dialog__accent"></div>

            <!-- Close Button -->
            <button
              @click="handleClose"
              :disabled="processing"
              class="subscribe-dialog__close"
              aria-label="Close dialog"
            >
              <X :size="18" />
            </button>

            <!-- Confirm Step: Two Column Layout -->
            <template v-if="paymentStep === 'confirm'">
              <div class="subscribe-dialog__grid">
                <!-- Left Column - Marketing/Value Props -->
                <div class="subscribe-dialog__branding">
                  <div class="subscribe-dialog__branding-content">
                    <!-- Plan Badge -->
                    <div class="subscribe-dialog__plan-badge">
                      <Crown :size="14" />
                      <span>{{ plan.name }} Plan</span>
                    </div>

                    <!-- Headline -->
                    <div class="subscribe-dialog__headline">
                      <h2 id="subscribe-dialog-title" class="subscribe-dialog__title">
                        {{ currentPlan ? 'Upgrade Your Access' : 'Unlock Premium Features' }}
                      </h2>
                      <p class="subscribe-dialog__subtitle">
                        {{ context === 'organization' ? 'Power your team with AI-driven workflows' : 'Take your content creation to the next level' }}
                      </p>
                    </div>

                    <!-- Features List -->
                    <div class="subscribe-dialog__features">
                      <div class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--primary">
                          <Zap :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">{{ plan.monthly_credits.toLocaleString() }} Monthly Credits</h3>
                          <p class="subscribe-dialog__feature-desc">Automatic AI processing minutes every month</p>
                        </div>
                      </div>

                      <div v-if="context === 'organization'" class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <Users :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">{{ plan.seats === null ? 'Unlimited Team Seats' : `${plan.seats} Team Seats` }}</h3>
                          <p class="subscribe-dialog__feature-desc">Collaborate with your team on projects</p>
                        </div>
                      </div>

                      <div v-else class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <Infinity :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">Unlimited Exports</h3>
                          <p class="subscribe-dialog__feature-desc">Export as many clips as you need</p>
                        </div>
                      </div>

                      <div v-if="context === 'organization'" class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <FolderOpen :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">Shared Assets</h3>
                          <p class="subscribe-dialog__feature-desc">Team-wide fonts, images, and watermarks</p>
                        </div>
                      </div>

                      <div v-if="context === 'organization'" class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <Calendar :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">Content Scheduling</h3>
                          <p class="subscribe-dialog__feature-desc">Schedule posts across social platforms</p>
                        </div>
                      </div>

                      <div v-if="context === 'organization'" class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <Megaphone :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">Campaign Management</h3>
                          <p class="subscribe-dialog__feature-desc">Run clipping campaigns with your team</p>
                        </div>
                      </div>

                      <div v-if="context === 'organization'" class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <BarChart3 :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">Analytics & Insights</h3>
                          <p class="subscribe-dialog__feature-desc">Track performance across all channels</p>
                        </div>
                      </div>

                      <div v-if="context === 'organization'" class="subscribe-dialog__feature">
                        <div class="subscribe-dialog__feature-icon subscribe-dialog__feature-icon--secondary">
                          <Share2 :size="16" />
                        </div>
                        <div class="subscribe-dialog__feature-content">
                          <h3 class="subscribe-dialog__feature-title">Team Collaboration</h3>
                          <p class="subscribe-dialog__feature-desc">Real-time messaging and clip sharing</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  <!-- Trust Badge -->
                  <div class="subscribe-dialog__trust">
                    <ShieldCheck :size="14" />
                    <span>Secured by Stripe & Solana</span>
                  </div>
                </div>

                <!-- Right Column - Payment Portal -->
                <div class="subscribe-dialog__content">
                  <!-- Plan Summary Card -->
                  <div class="subscribe-dialog__summary-card">
                    <div class="subscribe-dialog__summary-header">
                      <h3 class="subscribe-dialog__summary-title">{{ plan.name }}</h3>
                    </div>

                    <div class="subscribe-dialog__price-display">
                      <span class="subscribe-dialog__price-currency">$</span>
                      <span class="subscribe-dialog__price-amount">{{ discountedPrice }}</span>
                      <span class="subscribe-dialog__price-period">/month</span>
                    </div>

                    <div class="subscribe-dialog__summary-items">
                      <div class="subscribe-dialog__summary-item">
                        <Zap class="subscribe-dialog__summary-item-icon" />
                        <span>{{ plan.monthly_credits.toLocaleString() }} credits/month</span>
                      </div>
                      <div v-if="context === 'organization'" class="subscribe-dialog__summary-item">
                        <Users class="subscribe-dialog__summary-item-icon" />
                        <span>{{ plan.seats === null ? 'Unlimited team seats' : `${plan.seats} team seats` }}</span>
                      </div>
                      <div class="subscribe-dialog__summary-item">
                        <RefreshCcw class="subscribe-dialog__summary-item-icon" />
                        <span>Credits rollover</span>
                      </div>
                    </div>
                  </div>

                  <!-- Promo Code Section -->
                  <div class="subscribe-dialog__promo">
                    <label class="subscribe-dialog__promo-label">
                      <Tag :size="14" />
                      Promo Code
                    </label>
                    <div class="subscribe-dialog__promo-input-group">
                      <input
                        v-model="promoCode"
                        type="text"
                        placeholder="Enter discount code"
                        class="subscribe-dialog__promo-input"
                        :disabled="validatingPromo"
                        @keyup.enter="validatePromoCode"
                      />
                      <button
                        type="button"
                        @click="validatePromoCode"
                        class="subscribe-dialog__promo-btn"
                        :disabled="validatingPromo || !promoCode.trim()"
                      >
                        <Loader2 v-if="validatingPromo" :size="14" class="subscribe-dialog__spinner" />
                        <span v-else>Apply</span>
                      </button>
                    </div>

                    <div v-if="promoError" class="subscribe-dialog__promo-error">
                      <AlertCircle :size="12" />
                      <span>{{ promoError }}</span>
                    </div>

                    <div v-if="validatedPromo" class="subscribe-dialog__promo-success">
                      <Percent :size="12" />
                      <span>{{ validatedPromo.percent_off }}% discount applied!</span>
                      <button type="button" @click="clearPromoCode" class="subscribe-dialog__promo-clear">
                        <X :size="12" />
                      </button>
                    </div>
                  </div>

                  <!-- Payment Section -->
                  <div class="subscribe-dialog__payment-wrapper">
                    <div class="subscribe-dialog__payment-section">
                      <label class="subscribe-dialog__payment-label">Choose Payment Method</label>
                      <div class="subscribe-dialog__payment-buttons">
                        <button
                          type="button"
                          class="subscribe-dialog__payment-btn subscribe-dialog__payment-btn--stripe"
                          @click="initiateStripePayment"
                          :disabled="processing"
                        >
                          <div class="subscribe-dialog__payment-btn-content">
                            <Loader2 v-if="processing && paymentMethod === 'stripe'" :size="20" class="subscribe-dialog__spinner" />
                            <svg v-else class="subscribe-dialog__payment-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M13.3 4.5c-2.2 0-3.6 1.1-3.6 2.8 0 1.9 1.4 2.6 3.3 3.2 2.5.8 3.8 1.7 3.8 3.5 0 2.3-1.8 3.5-4.3 3.5-1.8 0-3.3-.5-4.5-1.3l-.8 2.8c1.1.7 2.8 1.2 4.8 1.2 3.3 0 5.3-1.6 5.3-4 0-1.9-1.2-2.8-3.4-3.5-2.2-.7-3.6-1.4-3.6-3 0-1.3 1.1-2.5 3.3-2.5 1.4 0 2.6.4 3.5.8l.7-2.7c-1-.5-2.3-.8-3.5-.8z" fill="currentColor"/>
                            </svg>
                            <div class="subscribe-dialog__payment-btn-text">
                              <span class="subscribe-dialog__payment-btn-label">Pay with Card</span>
                              <span class="subscribe-dialog__payment-btn-hint">Powered by Stripe</span>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          class="subscribe-dialog__payment-btn subscribe-dialog__payment-btn--phantom subscribe-dialog__payment-btn--coming-soon"
                          disabled
                        >
                          <div class="subscribe-dialog__payment-btn-content">
                            <svg class="subscribe-dialog__payment-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.5">
                              <path d="M27 7.5C27 10.5 25 13.5 22 15.5L25 20.5C25.5 21.5 25 23 23.5 23.5C22.5 24 21 23.5 20.5 22L17 16C16.5 16 16 16 15.5 16C14 16 12.5 15.5 11.5 14.5L9 19C8.5 20 7 20.5 6 20C5 19.5 4.5 18 5 17L7.5 12C6 10.5 5 8.5 5 6.5C5 4 6.5 2.5 9 2.5H23C25.5 2.5 27 4 27 7.5ZM10 6.5C10 7.5 10.5 8 11.5 8C12.5 8 13 7.5 13 6.5C13 5.5 12.5 5 11.5 5C10.5 5 10 5.5 10 6.5ZM19 6.5C19 7.5 19.5 8 20.5 8C21.5 8 22 7.5 22 6.5C22 5.5 21.5 5 20.5 5C19.5 5 19 5.5 19 6.5Z" fill="currentColor"/>
                            </svg>
                            <div class="subscribe-dialog__payment-btn-text">
                              <span class="subscribe-dialog__payment-btn-label">Pay with Crypto</span>
                              <span class="subscribe-dialog__payment-btn-hint">Coming Soon</span>
                            </div>
                          </div>
                          <span class="subscribe-dialog__coming-soon-badge">Coming Soon</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Processing Step -->
            <template v-else-if="paymentStep === 'processing'">
              <div class="subscribe-dialog__centered">
                <div class="subscribe-dialog__icon subscribe-dialog__icon--processing">
                  <Loader2 :size="28" class="subscribe-dialog__icon-spinner" />
                </div>
                <h3 class="subscribe-dialog__centered-title">Processing Payment</h3>
                <p class="subscribe-dialog__centered-subtitle">{{ paymentStatus }}</p>
              </div>
            </template>

            <!-- Success Step -->
            <template v-else-if="paymentStep === 'success'">
              <div class="subscribe-dialog__centered">
                <div class="subscribe-dialog__icon subscribe-dialog__icon--success">
                  <CheckCircle :size="28" />
                </div>
                <h3 class="subscribe-dialog__centered-title">Subscription Activated!</h3>
                <p class="subscribe-dialog__centered-subtitle">
                  Your {{ plan.name }} subscription is now active
                </p>
                <button type="button" class="subscribe-dialog__success-btn" @click="handleSuccess">
                  Get Started
                </button>
              </div>
            </template>

            <!-- Error Step -->
            <template v-else-if="paymentStep === 'error'">
              <div class="subscribe-dialog__centered">
                <div class="subscribe-dialog__icon subscribe-dialog__icon--error">
                  <AlertTriangle :size="28" />
                </div>
                <h3 class="subscribe-dialog__centered-title">Payment Failed</h3>
                <p class="subscribe-dialog__centered-subtitle">{{ errorMessage }}</p>
                <div class="subscribe-dialog__error-actions">
                  <button type="button" class="subscribe-dialog__retry-btn" @click="paymentStep = 'confirm'">
                    Try Again
                  </button>
                  <button type="button" class="subscribe-dialog__cancel-btn" @click="handleClose">
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
import { ref, computed, watch } from 'vue';
import {
  X,
  Crown,
  Zap,
  Sparkles,
  Film,
  Users,
  Infinity,
  TrendingUp,
  ShieldCheck,
  CreditCard,
  Wallet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Tag,
  Percent,
  RefreshCcw,
  FolderOpen,
  Calendar,
  BarChart3,
  Share2,
  Megaphone,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import * as promoCodesApi from '@/services/promoCodesApi';
import { useToast } from '@/composables/useToast';

interface SubscriptionPlan {
  id: string;
  name: string;
  price_usd: number;
  monthly_credits: number;
  seats?: number;
}

interface Props {
  open: boolean;
  plan: SubscriptionPlan;
  context: 'user' | 'organization';
  organizationId?: string;
  organizationName?: string;
  currentPlan?: string;
  type?: 'base' | 'addon';
  billingInterval?: 'monthly' | 'yearly';
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const { success: showSuccess, error: showError } = useToast();

// State
const paymentStep = ref<'confirm' | 'processing' | 'success' | 'error'>('confirm');
const processing = ref(false);
const paymentStatus = ref('');
const errorMessage = ref('');
const paymentMethod = ref<'stripe' | 'crypto' | null>(null);

// Promo code state
const promoCode = ref('');
const validatedPromo = ref<any>(null);
const validatingPromo = ref(false);
const promoError = ref('');

const effectivePrice = computed(() => {
  const monthlyPrice = props.plan.price_usd;
  if (props.billingInterval === 'yearly') {
    return monthlyPrice * 11; // Yearly = 11 months
  }
  return monthlyPrice;
});

const discountedPrice = computed(() => {
  const basePrice = effectivePrice.value;
  if (validatedPromo.value) {
    const discount = validatedPromo.value.percent_off / 100;
    return (basePrice * (1 - discount)).toFixed(2);
  }
  return basePrice.toFixed(2);
});

async function validatePromoCode() {
  if (!promoCode.value.trim()) return;

  validatingPromo.value = true;
  promoError.value = '';

  try {
    let response;
    if (props.context === 'organization' && props.organizationId) {
      // Organization context - use org validation endpoint
      response = await api.post(`/organizations/${props.organizationId}/subscription/promo/validate`, {
        code: promoCode.value.trim(),
        tier: props.plan.id,
        type: 'subscription'
      });
      response = response.data;
    } else {
      // User context - use existing user validation
      response = await promoCodesApi.validatePromoCode(promoCode.value.trim(), props.plan.id);
    }

    if (response.success && response.promo) {
      validatedPromo.value = response.promo;
      showSuccess('Promo code applied!', `${response.promo.percent_off}% discount`);
    } else {
      validatedPromo.value = null;
      promoError.value = response.error || 'Invalid promo code';
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

async function initiateStripePayment() {
  processing.value = true;
  paymentMethod.value = 'stripe';
  paymentStep.value = 'processing';
  paymentStatus.value = 'Creating checkout session...';

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    let endpoint = '';
    let payload: any = {};

    if (props.context === 'organization') {
      endpoint = props.type === 'addon'
        ? `/organizations/${props.organizationId}/subscription/addons/checkout`
        : `/organizations/${props.organizationId}/subscription/checkout`;
      
      payload = props.type === 'addon'
        ? { addon_tier: props.plan.id }
        : { tier: props.plan.id };

      // Add promo code for organization if validated
      if (validatedPromo.value && promoCode.value.trim()) {
        payload.promo_code = promoCode.value.trim();
      }
    } else {
      endpoint = '/subscription/checkout';
      payload = { tier: props.plan.id };

      if (props.billingInterval) {
        payload.billing_interval = props.billingInterval;
      }

      if (validatedPromo.value && promoCode.value.trim()) {
        payload.promo_code = promoCode.value.trim();
      }
    }

    const response = await api.post(endpoint, payload);

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create checkout session');
    }

    const { url: checkoutUrl } = response.data;

    const unlisten = await listen('stripe-payment-complete', async (event: any) => {
      const paymentResult = event.payload;

      if (paymentResult.success) {
        paymentStep.value = 'success';
        processing.value = false;
        unlisten();
      } else {
        unlisten();
      }
    });

    paymentStatus.value = 'Opening payment page...';
    await invoke('open_stripe_payment_window', {
      checkoutUrl: checkoutUrl,
      packKey: props.plan.id,
      packHours: props.plan.monthly_credits,
    });

    paymentStatus.value = 'Complete payment in your browser...';
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to create checkout session';
    paymentStep.value = 'error';
    processing.value = false;
    showError('Payment failed', error.message || 'An error occurred');
  }
}

async function initiateCryptoPayment() {
  processing.value = true;
  paymentMethod.value = 'crypto';
  paymentStep.value = 'processing';
  paymentStatus.value = 'Getting payment quote...';

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    let quoteEndpoint = '';
    let confirmEndpoint = '';
    let quotePayload: any = {};
    let confirmPayload: any = {};

    if (props.context === 'organization') {
      quoteEndpoint = `/organizations/${props.organizationId}/subscription/crypto-quote`;
      confirmEndpoint = `/organizations/${props.organizationId}/subscription/crypto-confirm`;
      
      quotePayload = {
        tier: props.plan.id,
        type: props.type || 'base',
      };

      // Add promo code for organization if validated
      if (validatedPromo.value && promoCode.value.trim()) {
        quotePayload.promo_code = promoCode.value.trim();
      }
    } else {
      quoteEndpoint = '/subscription/crypto-quote';
      confirmEndpoint = '/subscription/crypto-confirm';
      
      quotePayload = { tier: props.plan.id };

      if (validatedPromo.value && promoCode.value.trim()) {
        quotePayload.promo_code = promoCode.value.trim();
      }
    }

    const quoteResponse = await api.post(quoteEndpoint, quotePayload);

    if (!quoteResponse.data.success) {
      throw new Error(quoteResponse.data.error || 'Failed to get quote');
    }

    const quote = quoteResponse.data.quote;

    const unlisten = await listen('wallet-payment-complete', async (event: any) => {
      const paymentResult = event.payload;

      paymentStatus.value = 'Verifying payment...';
      try {
        if (props.context === 'organization') {
          confirmPayload = {
            tier: props.plan.id,
            type: props.type || 'base',
            tx_signature: paymentResult.signature,
            from_address: paymentResult.from_address,
          };

          // Add promo code for organization if validated
          if (validatedPromo.value && promoCode.value.trim()) {
            confirmPayload.promo_code = promoCode.value.trim();
          }
        } else {
          confirmPayload = {
            tier: props.plan.id,
            tx_signature: paymentResult.signature,
            from_address: paymentResult.from_address,
          };

          if (validatedPromo.value && promoCode.value.trim()) {
            confirmPayload.promo_code = promoCode.value.trim();
          }
        }

        const confirmResponse = await api.post(confirmEndpoint, confirmPayload);

        if (confirmResponse.data.success) {
          paymentStep.value = 'success';
          processing.value = false;
          unlisten();
        } else {
          throw new Error(confirmResponse.data.error || 'Payment confirmation failed');
        }
      } catch (error: any) {
        errorMessage.value = error.message || 'Payment verification failed';
        paymentStep.value = 'error';
        processing.value = false;
        unlisten();
      }
    });

    paymentStatus.value = 'Opening payment window...';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    await invoke('open_wallet_payment_window', {
      packKey: props.context === 'organization' ? `org_sub_${props.plan.id}` : `sub_${props.plan.id}`,
      packName: props.plan.name,
      hours: props.plan.monthly_credits,
      usd: quote.amount_usd,
      sol: quote.amount_sol,
      companyWallet: quote.company_wallet,
      authToken: authStore.token,
      apiBase,
    });

    paymentStatus.value = 'Complete payment in your browser...';
  } catch (error: any) {
    errorMessage.value = error.message || 'Failed to process payment';
    paymentStep.value = 'error';
    processing.value = false;
    showError('Payment failed', error.message || 'An error occurred');
  }
}

function handleClose() {
  if (!processing.value) {
    resetDialog();
    emit('update:open', false);
  }
}

function handleSuccess() {
  resetDialog();
  emit('update:open', false);
  emit('success');
}

function resetDialog() {
  paymentStep.value = 'confirm';
  processing.value = false;
  paymentStatus.value = '';
  errorMessage.value = '';
  paymentMethod.value = null;
  promoCode.value = '';
  validatedPromo.value = null;
  promoError.value = '';
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    resetDialog();
  }
});
</script>

<style scoped>
/* ===== Overlay ===== */
.subscribe-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 9999;
}

/* ===== Dialog Container ===== */
.subscribe-dialog {
  position: relative;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  margin-top: 30px;
}

/* ===== Accent Bar ===== */
.subscribe-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Close Button ===== */
.subscribe-dialog__close {
  position: absolute;
  top: 0.625rem;
  right: 0.625rem;
  z-index: 100;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
  backdrop-filter: blur(4px);
}

.subscribe-dialog__close:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.6);
  color: var(--sidebar-text);
  border-color: rgba(255, 255, 255, 0.15);
}

.subscribe-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Two Column Grid ===== */
.subscribe-dialog__grid {
  display: grid;
  grid-template-columns: 1fr;
  overflow-y: auto;
  max-height: calc(90vh - 3px);
}

@media (min-width: 768px) {
  .subscribe-dialog__grid {
    grid-template-columns: 5fr 4fr;
  }
}

/* ===== Left Column - Branding ===== */
.subscribe-dialog__branding {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1.25rem 1.25rem;
  background-color: rgba(6, 182, 212, 0.04);
  border-bottom: 1px solid var(--sidebar-border);
}

@media (min-width: 768px) {
  .subscribe-dialog__branding {
    padding: 2rem 1.75rem 1.75rem;
    border-bottom: none;
    border-right: 1px solid var(--sidebar-border);
  }
}

.subscribe-dialog__branding-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  flex: 1;
}

.subscribe-dialog__plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: linear-gradient(135deg, var(--sidebar-accent), rgba(6, 182, 212, 0.8));
  color: white;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  align-self: flex-start;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
}

.subscribe-dialog__headline {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.subscribe-dialog__title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

@media (min-width: 768px) {
  .subscribe-dialog__title {
    font-size: 1.5rem;
  }
}

.subscribe-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.4;
}

/* ===== Features List ===== */
.subscribe-dialog__features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.subscribe-dialog__feature {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.subscribe-dialog__feature-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.subscribe-dialog__feature-icon--primary {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1));
  border: 1px solid rgba(6, 182, 212, 0.3);
  color: var(--sidebar-accent);
}

.subscribe-dialog__feature-icon--secondary {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1));
  border: 1px solid rgba(6, 182, 212, 0.3);
  color: var(--sidebar-accent);
}

.subscribe-dialog__feature-content {
  flex: 1;
  min-width: 0;
}

.subscribe-dialog__feature-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.125rem;
}

.subscribe-dialog__feature-desc {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.4;
}

/* ===== Trust Badge ===== */
.subscribe-dialog__trust {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  margin-top: auto;
  border-top: 1px solid var(--sidebar-border);
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
}

/* ===== Right Column - Content ===== */
.subscribe-dialog__content {
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1.25rem 1.5rem;
  gap: 1rem;
  overflow-y: auto;
  min-height: 0;
}

@media (min-width: 768px) {
  .subscribe-dialog__content {
    padding: 2rem 1.75rem 1.75rem;
  }
}

/* ===== Summary Card ===== */
.subscribe-dialog__summary-card {
  padding: 1.125rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
}

.subscribe-dialog__summary-header {
  margin-bottom: 0.375rem;
}

.subscribe-dialog__summary-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.125rem;
}

.subscribe-dialog__summary-org {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
}

.subscribe-dialog__price-display {
  display: flex;
  align-items: baseline;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.subscribe-dialog__price-currency {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin-right: 0.125rem;
}

.subscribe-dialog__price-amount {
  font-size: 2rem;
  font-weight: 700;
  color: var(--sidebar-accent);
  letter-spacing: -0.03em;
  line-height: 1;
}

.subscribe-dialog__price-period {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin-left: 0.25rem;
}

.subscribe-dialog__summary-items {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.subscribe-dialog__summary-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.subscribe-dialog__summary-item-icon {
  width: 14px;
  height: 14px;
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

/* ===== Promo Code Section ===== */
.subscribe-dialog__promo {
  padding: 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.subscribe-dialog__promo-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.subscribe-dialog__promo-input-group {
  display: flex;
  gap: 0.5rem;
}

.subscribe-dialog__promo-input {
  flex: 1;
  padding: 0.5rem 0.625rem;
  background-color: var(--sidebar-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.subscribe-dialog__promo-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
}

.subscribe-dialog__promo-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.subscribe-dialog__promo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0 0.875rem;
  background-color: var(--sidebar-accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.subscribe-dialog__promo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.subscribe-dialog__promo-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.subscribe-dialog__promo-error {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background-color: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: #f87171;
}

.subscribe-dialog__promo-success {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background-color: rgba(16, 185, 129, 0.1);
  border-radius: 6px;
  font-size: 0.6875rem;
  color: #10b981;
  font-weight: 500;
}

.subscribe-dialog__promo-clear {
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

.subscribe-dialog__promo-clear:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: #f87171;
}

/* ===== Payment Wrapper ===== */
.subscribe-dialog__payment-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

/* ===== Payment Section ===== */
.subscribe-dialog__payment-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.125rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.subscribe-dialog__payment-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--sidebar-text);
  text-align: center;
}

.subscribe-dialog__payment-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.subscribe-dialog__payment-btn {
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

.subscribe-dialog__payment-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.subscribe-dialog__payment-btn-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  width: 100%;
}

.subscribe-dialog__payment-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.subscribe-dialog__payment-btn-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  flex: 1;
}

.subscribe-dialog__payment-btn-label {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.2;
}

.subscribe-dialog__payment-btn-hint {
  font-size: 0.6875rem;
  font-weight: 500;
  opacity: 0.85;
  line-height: 1;
}

/* Stripe Button */
.subscribe-dialog__payment-btn--stripe {
  background: linear-gradient(135deg, #635bff 0%, #5851ea 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(99, 91, 255, 0.25);
}

.subscribe-dialog__payment-btn--stripe:hover:not(:disabled) {
  background: linear-gradient(135deg, #5851ea 0%, #4d46d9 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 91, 255, 0.35);
}

/* Phantom Button */
.subscribe-dialog__payment-btn--phantom {
  background: linear-gradient(135deg, #7c65e8 0%, #6a52d9 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(124, 101, 232, 0.3);
}

.subscribe-dialog__payment-btn--coming-soon {
  position: relative;
  opacity: 0.55;
  cursor: not-allowed !important;
}

.subscribe-dialog__coming-soon-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.625rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.subscribe-dialog__payment-btn--phantom:hover:not(:disabled) {
  background: linear-gradient(135deg, #6a52d9 0%, #5c45c7 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 101, 232, 0.4);
}

/* ===== Centered States ===== */
.subscribe-dialog__centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.5rem 1.75rem;
  gap: 0.875rem;
}

.subscribe-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 0.375rem;
}

.subscribe-dialog__icon--processing {
  background-color: rgba(6, 182, 212, 0.1);
  border: 2px solid rgba(6, 182, 212, 0.2);
  color: var(--sidebar-accent);
}

.subscribe-dialog__icon--success {
  background-color: rgba(16, 185, 129, 0.1);
  border: 2px solid rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.subscribe-dialog__icon--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.subscribe-dialog__icon-spinner {
  animation: spin 0.8s linear infinite;
}

.subscribe-dialog__centered-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
}

.subscribe-dialog__centered-subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  max-width: 300px;
  line-height: 1.4;
}

.subscribe-dialog__success-btn {
  margin-top: 0.375rem;
  padding: 0.75rem 1.75rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.subscribe-dialog__success-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.subscribe-dialog__error-actions {
  display: flex;
  gap: 0.625rem;
  margin-top: 0.375rem;
}

.subscribe-dialog__retry-btn {
  padding: 0.75rem 1.375rem;
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.subscribe-dialog__retry-btn:hover {
  opacity: 0.9;
}

.subscribe-dialog__cancel-btn {
  padding: 0.75rem 1.375rem;
  background-color: transparent;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.subscribe-dialog__cancel-btn:hover {
  background-color: var(--sidebar-hover);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--sidebar-text);
}

.subscribe-dialog__spinner {
  animation: spin 0.8s linear infinite;
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
