<template>
  <Transition name="slide">
    <div v-if="showBanner" :class="bannerClass" class="px-4 py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <component :is="bannerIcon" class="h-5 w-5 flex-shrink-0" />
        <div>
          <p class="font-medium text-sm">{{ bannerTitle }}</p>
          <p class="text-xs opacity-90">{{ bannerMessage }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <router-link
          v-if="showUpgradeButton"
          to="/pricing"
          class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
        >
          {{ subscriptionStatus?.status === 'cancelled' ? 'Resubscribe' : 'Subscribe' }}
        </router-link>
        <button @click="dismiss" class="p-1 hover:bg-white/10 rounded transition-colors" aria-label="Dismiss">
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { Clock, AlertTriangle, CreditCard, X, Zap } from 'lucide-vue-next';
  import { useCreditBalance } from '@/composables/useCreditBalance';
  import { useAuthStore } from '@/stores/auth';

  const authStore = useAuthStore();
  const { subscriptionStatus, totalAvailable, canAccessApp, fetchBalance } = useCreditBalance();

  const dismissed = ref(false);
  const dismissedKey = ref('');

  // Reset dismissed state when subscription changes
  watch(
    () => subscriptionStatus.value?.status,
    (newStatus, oldStatus) => {
      if (newStatus !== oldStatus) {
        dismissed.value = false;
      }
    }
  );

  const showBanner = computed(() => {
    if (!authStore.isAuthenticated) return false;
    if (dismissed.value) return false;

    // Don't show if user doesn't need subscription (admin/org-created)
    if (!subscriptionStatus.value?.needs_subscription) return false;

    // Show for: cancelled subscription, expiring soon, or low credits
    const status = subscriptionStatus.value?.status;
    const daysRemaining = subscriptionStatus.value?.days_remaining || 0;

    // Cancelled subscription
    if (status === 'cancelled') return true;

    // Subscription expiring in less than 7 days
    if (status === 'active' && daysRemaining > 0 && daysRemaining <= 7) return true;

    // Low credits warning (less than 2 credits and not unlimited)
    if (totalAvailable.value !== 'unlimited' && typeof totalAvailable.value === 'number' && totalAvailable.value < 2) {
      return true;
    }

    return false;
  });

  const bannerType = computed(() => {
    const status = subscriptionStatus.value?.status;
    const daysRemaining = subscriptionStatus.value?.days_remaining || 0;

    if (status === 'cancelled') return 'cancelled';
    if (status === 'active' && daysRemaining <= 3) return 'expiring-urgent';
    if (status === 'active' && daysRemaining <= 7) return 'expiring';
    if (totalAvailable.value !== 'unlimited' && typeof totalAvailable.value === 'number' && totalAvailable.value < 2) {
      return 'low-credits';
    }
    return 'info';
  });

  const bannerClass = computed(() => {
    switch (bannerType.value) {
      case 'cancelled':
        return 'bg-orange-500 text-white';
      case 'expiring-urgent':
        return 'bg-red-500 text-white';
      case 'expiring':
        return 'bg-yellow-500 text-yellow-900';
      case 'low-credits':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-zinc-800 text-white';
    }
  });

  const bannerIcon = computed(() => {
    switch (bannerType.value) {
      case 'cancelled':
        return AlertTriangle;
      case 'expiring-urgent':
      case 'expiring':
        return Clock;
      case 'low-credits':
        return Zap;
      default:
        return CreditCard;
    }
  });

  const bannerTitle = computed(() => {
    switch (bannerType.value) {
      case 'cancelled':
        return 'Subscription Cancelled';
      case 'expiring-urgent':
        return 'Subscription Expiring Soon!';
      case 'expiring':
        return 'Subscription Expiring';
      case 'low-credits':
        return 'Low on Credits';
      default:
        return 'Subscription Notice';
    }
  });

  const bannerMessage = computed(() => {
    const daysRemaining = subscriptionStatus.value?.days_remaining || 0;

    switch (bannerType.value) {
      case 'cancelled':
        return `Your access ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Resubscribe to continue using Clippster.`;
      case 'expiring-urgent':
        return `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left! Renew now to avoid losing access.`;
      case 'expiring':
        return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your subscription.`;
      case 'low-credits':
        return `Only ${totalAvailable.value} credit${totalAvailable.value !== 1 ? 's' : ''} remaining. Purchase more to continue using AI features.`;
      default:
        return '';
    }
  });

  const showUpgradeButton = computed(() => {
    return ['cancelled', 'expiring-urgent', 'expiring'].includes(bannerType.value);
  });

  function dismiss() {
    dismissed.value = true;
  }
</script>

<style scoped>
  .slide-enter-active,
  .slide-leave-active {
    transition: all 0.3s ease;
  }

  .slide-enter-from,
  .slide-leave-to {
    transform: translateY(-100%);
    opacity: 0;
  }
</style>
