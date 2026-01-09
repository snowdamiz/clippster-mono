import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export interface SubscriptionTier {
  id: string;
  name: string;
  monthly_credits: number;
  price_usd: number;
}

export interface SubscriptionStatus {
  status: 'none' | 'active' | 'cancelled' | 'expired';
  tier: string | null;
  tier_name: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_method: 'stripe' | 'crypto' | null;
  needs_subscription: boolean;
  days_remaining: number;
}

export function useSubscription() {
  const authStore = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Subscription state
  const subscriptionStatus = ref<SubscriptionStatus | null>(null);
  const subscriptionTiers = ref<SubscriptionTier[]>([]);

  // Computed properties
  const isAuthenticated = computed(() => authStore.isAuthenticated);

  const hasValidSubscription = computed(() => {
    if (!subscriptionStatus.value) return false;
    return ['active', 'cancelled'].includes(subscriptionStatus.value.status);
  });

  const hasActiveSubscription = computed(() => {
    return subscriptionStatus.value?.status === 'active';
  });

  const isCancelled = computed(() => {
    return subscriptionStatus.value?.status === 'cancelled';
  });

  const isExpired = computed(() => {
    return subscriptionStatus.value?.status === 'expired';
  });

  const needsSubscription = computed(() => {
    return subscriptionStatus.value?.needs_subscription ?? true;
  });

  const currentTier = computed(() => {
    return subscriptionStatus.value?.tier || null;
  });

  const currentTierName = computed(() => {
    return subscriptionStatus.value?.tier_name || null;
  });

  const daysRemaining = computed(() => {
    return subscriptionStatus.value?.days_remaining || 0;
  });

  const subscriptionEndDate = computed(() => {
    return subscriptionStatus.value?.end_date || null;
  });

  /**
   * Fetch subscription status from the server
   */
  async function fetchSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    if (!authStore.token) {
      subscriptionStatus.value = null;
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await api.get('/subscription/status');

      if (response.data.success) {
        subscriptionStatus.value = response.data.subscription;
        return subscriptionStatus.value;
      } else {
        throw new Error(response.data.error || 'Failed to fetch subscription status');
      }
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to fetch subscription status:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch available subscription tiers
   */
  async function fetchSubscriptionTiers(): Promise<SubscriptionTier[]> {
    try {
      const response = await api.get('/subscription/tiers');

      if (response.data.success) {
        subscriptionTiers.value = response.data.tiers;
        return subscriptionTiers.value;
      } else {
        throw new Error(response.data.error || 'Failed to fetch subscription tiers');
      }
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to fetch subscription tiers:', err);
      return [];
    }
  }

  /**
   * Create a Stripe checkout session for subscription
   */
  async function createStripeCheckout(
    tier: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/subscription/checkout', { tier });

      if (response.data.success) {
        return { success: true, url: response.data.url };
      } else {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      error.value = err.message;
      return { success: false, error: err.message };
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get a crypto quote for subscription payment
   */
  async function getCryptoQuote(tier: string): Promise<{
    success: boolean;
    quote?: {
      tier: string;
      tier_name: string;
      monthly_credits: number;
      amount_usd: number;
      amount_sol: number;
      company_wallet: string;
      expires_at: string;
    };
    error?: string;
  }> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/subscription/crypto-quote', { tier });

      if (response.data.success) {
        return { success: true, quote: response.data.quote };
      } else {
        throw new Error(response.data.error || 'Failed to get crypto quote');
      }
    } catch (err: any) {
      error.value = err.message;
      return { success: false, error: err.message };
    } finally {
      loading.value = false;
    }
  }

  /**
   * Confirm crypto payment for subscription
   */
  async function confirmCryptoPayment(
    tier: string,
    txSignature: string,
    fromAddress: string
  ): Promise<{ success: boolean; subscription?: SubscriptionStatus; error?: string }> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/subscription/crypto-confirm', {
        tier,
        tx_signature: txSignature,
        from_address: fromAddress,
      });

      if (response.data.success) {
        subscriptionStatus.value = response.data.subscription;
        return { success: true, subscription: response.data.subscription };
      } else {
        throw new Error(response.data.error || 'Failed to confirm crypto payment');
      }
    } catch (err: any) {
      error.value = err.message;
      return { success: false, error: err.message };
    } finally {
      loading.value = false;
    }
  }

  /**
   * Cancel the current subscription
   */
  async function cancelSubscription(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    loading.value = true;
    error.value = null;

    try {
      const response = await api.post('/subscription/cancel');

      if (response.data.success) {
        subscriptionStatus.value = response.data.subscription;
        return { success: true, message: response.data.message };
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (err: any) {
      error.value = err.message;
      return { success: false, error: err.message };
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get subscription history
   */
  async function getSubscriptionHistory(): Promise<any[]> {
    try {
      const response = await api.get('/subscription/history');

      if (response.data.success) {
        return response.data.history;
      } else {
        throw new Error(response.data.error || 'Failed to fetch subscription history');
      }
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to fetch subscription history:', err);
      return [];
    }
  }

  /**
   * Update subscription status from balance response
   * Called by useCreditBalance to keep subscription status in sync
   */
  function updateFromBalanceResponse(subscription: SubscriptionStatus | null) {
    if (subscription) {
      subscriptionStatus.value = subscription;
    }
  }

  /**
   * Check if user can access the app
   * Returns true if user has valid subscription, is admin, or is org-created user
   */
  function canAccessApp(): boolean {
    if (!needsSubscription.value) return true;
    return hasValidSubscription.value;
  }

  /**
   * Check if user can use AI features (requires credits)
   * This is separate from subscription - user needs credits regardless of subscription
   */
  function canUseAIFeatures(totalCredits: number | 'unlimited'): boolean {
    if (totalCredits === 'unlimited') return true;
    return totalCredits > 0;
  }

  return {
    // State
    loading,
    error,
    subscriptionStatus,
    subscriptionTiers,

    // Computed
    isAuthenticated,
    hasValidSubscription,
    hasActiveSubscription,
    isCancelled,
    isExpired,
    needsSubscription,
    currentTier,
    currentTierName,
    daysRemaining,
    subscriptionEndDate,

    // Methods
    fetchSubscriptionStatus,
    fetchSubscriptionTiers,
    createStripeCheckout,
    getCryptoQuote,
    confirmCryptoPayment,
    cancelSubscription,
    getSubscriptionHistory,
    updateFromBalanceResponse,
    canAccessApp,
    canUseAIFeatures,
  };
}
