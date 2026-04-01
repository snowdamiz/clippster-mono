<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="org-setup-dialog__overlay">
        <Transition name="dialog" appear>
          <div v-if="show" class="org-setup-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="org-setup-dialog__accent"></div>

            <!-- Header -->
            <div class="org-setup-dialog__header">
              <div class="org-setup-dialog__icon">
                <CreditCard :size="32" />
              </div>
              <h2 class="org-setup-dialog__title">Complete Your Organization Setup</h2>
              <p class="org-setup-dialog__subtitle">
                Your organization has been created with custom billing. Please complete the payment setup to activate your subscription.
              </p>
            </div>

            <!-- Content -->
            <div class="org-setup-dialog__content">
              <!-- Plan Details -->
              <div class="org-setup-dialog__details">
                <div class="org-setup-dialog__detail">
                  <span class="org-setup-dialog__label">Plan:</span>
                  <span class="org-setup-dialog__value">
                    {{ organization?.subscription_tier === 'custom' ? 'Custom' : organization?.subscription_tier || 'Standard' }}
                  </span>
                </div>
                <div class="org-setup-dialog__detail">
                  <span class="org-setup-dialog__label">Monthly Price:</span>
                  <span class="org-setup-dialog__value">
                    ${{ organization?.admin_price_cents ? (organization.admin_price_cents / 100).toFixed(2) : '0.00' }}/mo
                  </span>
                </div>
                <div class="org-setup-dialog__detail">
                  <span class="org-setup-dialog__label">Seats:</span>
                  <span class="org-setup-dialog__value">{{ organization?.max_seats || 'Unlimited' }}</span>
                </div>
                <div class="org-setup-dialog__detail">
                  <span class="org-setup-dialog__label">AI Credits:</span>
                  <span class="org-setup-dialog__value">{{ organization?.monthly_credits || 0 }}/mo</span>
                </div>
              </div>

              <!-- Error Display -->
              <div v-if="error" class="org-setup-dialog__alert org-setup-dialog__alert--error">
                <AlertCircle :size="16" />
                <p class="org-setup-dialog__alert-text">{{ error }}</p>
              </div>

              <p class="org-setup-dialog__note">You'll be redirected to Stripe to set up recurring billing.</p>
            </div>

            <!-- Footer -->
            <div class="org-setup-dialog__footer">
              <button
                @click="handleProceed"
                :disabled="loading"
                class="org-setup-dialog__btn org-setup-dialog__btn--primary"
              >
                <Loader2 v-if="loading" :size="16" class="org-setup-dialog__spinner" />
                {{ loading ? 'Redirecting...' : 'Pay Now & Activate' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Loader2, CreditCard, AlertCircle } from 'lucide-vue-next';
  import api from '@/services/api';

  interface Organization {
    id: number;
    name: string;
    subscription_tier?: string;
    admin_price_cents?: number;
    max_seats?: number;
    monthly_credits?: number;
  }

  interface Props {
    show: boolean;
    organization: Organization | null;
  }

  interface Emits {
    (e: 'setup-complete'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const loading = ref(false);
  const error = ref<string | null>(null);

  const handleProceed = async () => {
    if (!props.organization?.id || loading.value) return;
    
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post(`/organizations/${props.organization.id}/payments/stripe/setup`);
      
      if (response.data.success) {
        if (response.data.url) {
          // Redirect to Stripe checkout
          window.location.href = response.data.url;
        } else if (response.data.redirect_to) {
          // Free org case - reload to refresh data
          await new Promise(resolve => setTimeout(resolve, 500));
          emit('setup-complete');
        }
      } else {
        throw new Error(response.data.error || 'Failed to create payment session');
      }
    } catch (err) {
      console.error('Failed to open Stripe setup:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      loading.value = false;
    }
  };

  // Reset error when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        error.value = null;
      }
    }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .org-setup-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .org-setup-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    width: 100%;
    max-width: 520px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  }

  /* ===== Accent Bar ===== */
  .org-setup-dialog__accent {
    height: 4px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .org-setup-dialog__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 2rem 1.5rem;
    text-align: center;
  }

  .org-setup-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%);
    border: 1px solid rgba(6, 182, 212, 0.3);
    color: var(--sidebar-accent);
    margin-bottom: 1.25rem;
  }

  .org-setup-dialog__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.75rem;
    letter-spacing: -0.02em;
  }

  .org-setup-dialog__subtitle {
    font-size: 0.9375rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
    margin: 0;
    max-width: 420px;
  }

  /* ===== Content Area ===== */
  .org-setup-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .org-setup-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-setup-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-setup-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Plan Details ===== */
  .org-setup-dialog__details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.875rem;
  }

  .org-setup-dialog__detail {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.875rem 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .org-setup-dialog__label {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .org-setup-dialog__value {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 600;
  }

  /* ===== Alert Box ===== */
  .org-setup-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 10px;
  }

  .org-setup-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .org-setup-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  .org-setup-dialog__note {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    text-align: center;
  }

  /* ===== Footer ===== */
  .org-setup-dialog__footer {
    display: flex;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .org-setup-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-setup-dialog__btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .org-setup-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .org-setup-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .org-setup-dialog__spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 250ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 200ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
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

  /* ===== Responsive ===== */
  @media (max-width: 640px) {
    .org-setup-dialog__details {
      grid-template-columns: 1fr;
    }
  }
</style>
