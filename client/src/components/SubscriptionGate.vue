<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="close"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-5 sm:p-6 lg:p-8">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                >
                  <component :is="headerIcon" class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                  {{ headerTitle }}
                </h2>
                <p class="text-zinc-400 text-sm mt-2 max-w-sm mx-auto">
                  {{ headerDescription }}
                </p>
              </div>

              <!-- Action context (what user tried to do) -->
              <div v-if="actionContext" class="mb-5 sm:mb-6 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <div class="flex items-center gap-3">
                  <div class="p-1.5 rounded-lg bg-amber-500/10">
                    <component :is="actionIcon" class="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <p class="text-xs text-zinc-500">You tried to:</p>
                    <p class="text-sm font-medium text-white">{{ actionContext }}</p>
                  </div>
                </div>
              </div>

              <!-- Subscription Plans -->
              <div class="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6">
                <button
                  v-for="tier in tiers"
                  :key="tier.id"
                  class="relative p-3 sm:p-4 rounded-xl border transition-all text-center group"
                  :class="[
                    tier.id === 'creator'
                      ? 'bg-gradient-to-b from-violet-500/10 to-violet-500/5 border-violet-500/40'
                      : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600',
                  ]"
                  @click="selectTier(tier)"
                >
                  <!-- Popular badge -->
                  <div
                    v-if="tier.id === 'creator'"
                    class="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-full"
                  >
                    Popular
                  </div>

                  <p class="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide mb-1">{{ tier.name }}</p>
                  <p class="text-lg sm:text-xl font-bold text-white">${{ tier.price_usd }}</p>
                  <p class="text-[10px] sm:text-xs text-zinc-500">/month</p>
                  <div class="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-zinc-700/50">
                    <div class="flex items-center justify-center gap-1">
                      <Zap class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400" />
                      <span class="text-xs sm:text-sm font-medium text-white">{{ tier.monthly_credits }}</span>
                    </div>
                    <span class="text-[10px] sm:text-xs text-zinc-500">credits</span>
                  </div>
                </button>
              </div>

              <!-- CTA Button -->
              <button
                @click="goToPricing"
                class="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group text-sm sm:text-base"
              >
                <div
                  class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                />
                <span class="relative flex items-center justify-center gap-2">
                  <Sparkles class="h-4 w-4 sm:h-5 sm:w-5" />
                  View All Plans & Subscribe
                </span>
              </button>

              <!-- Benefits -->
              <div class="mt-5 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-3">
                <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
                  <div class="p-0.5 sm:p-1 rounded bg-green-500/10">
                    <Check class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400" />
                  </div>
                  <span>Full app access</span>
                </div>
                <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
                  <div class="p-0.5 sm:p-1 rounded bg-green-500/10">
                    <Check class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400" />
                  </div>
                  <span>AI clip detection</span>
                </div>
                <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
                  <div class="p-0.5 sm:p-1 rounded bg-green-500/10">
                    <Check class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400" />
                  </div>
                  <span>Video editor</span>
                </div>
                <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
                  <div class="p-0.5 sm:p-1 rounded bg-green-500/10">
                    <Check class="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400" />
                  </div>
                  <span>Credits roll over</span>
                </div>
              </div>

              <!-- Footer -->
              <div class="mt-5 sm:mt-6 pt-4 border-t border-zinc-800">
                <p class="text-zinc-500 text-xs text-center">Cancel anytime • Secure payment via Stripe or Crypto</p>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { Lock, Sparkles, Check, Zap, Download, Video, Radio, FolderPlus, AlertCircle } from 'lucide-vue-next';

  const router = useRouter();

  // Dialog state
  const isOpen = ref(false);
  const actionContext = ref<string | null>(null);
  const actionType = ref<string | null>(null);

  // Subscription tiers for display (1 credit = 1 minute)
  const tiers = ref([
    { id: 'starter', name: 'Starter', price_usd: 24.99, monthly_credits: 600 },
    { id: 'creator', name: 'Creator', price_usd: 49.99, monthly_credits: 1800 },
    { id: 'pro', name: 'Pro', price_usd: 199.99, monthly_credits: 9000 },
  ]);

  // Dynamic header based on context
  const headerIcon = computed(() => {
    switch (actionType.value) {
      case 'download':
        return Download;
      case 'project':
        return FolderPlus;
      case 'live':
        return Radio;
      case 'editor':
        return Video;
      case 'expired':
        return AlertCircle;
      default:
        return Lock;
    }
  });

  const headerTitle = computed(() => {
    switch (actionType.value) {
      case 'expired':
        return 'Subscription Expired';
      default:
        return 'Subscription Required';
    }
  });

  const headerDescription = computed(() => {
    switch (actionType.value) {
      case 'expired':
        return 'Your subscription has expired. Renew now to continue creating amazing clips.';
      default:
        return 'Subscribe to Clippster to unlock the full video editing experience and AI-powered features.';
    }
  });

  const actionIcon = computed(() => {
    switch (actionType.value) {
      case 'download':
        return Download;
      case 'project':
        return FolderPlus;
      case 'live':
        return Radio;
      case 'editor':
        return Video;
      default:
        return Lock;
    }
  });

  // Open the gate dialog
  function open(context?: string, type?: string) {
    actionContext.value = context || null;
    actionType.value = type || null;
    isOpen.value = true;
  }

  // Close the dialog
  function close() {
    isOpen.value = false;
    actionContext.value = null;
    actionType.value = null;
  }

  // Navigate to billing
  function goToPricing() {
    close();
    router.push('/billing');
  }

  // Select a tier and go to billing
  function selectTier(tier: any) {
    close();
    router.push({ path: '/billing', query: { tier: tier.id } });
  }

  // Listen for subscription-gate events from anywhere in the app
  function handleSubscriptionGateEvent(event: CustomEvent) {
    const { context, type } = event.detail || {};
    open(context, type);
  }

  onMounted(() => {
    window.addEventListener('show-subscription-gate', handleSubscriptionGateEvent as EventListener);
  });

  onUnmounted(() => {
    window.removeEventListener('show-subscription-gate', handleSubscriptionGateEvent as EventListener);
  });

  // Expose methods for direct usage
  defineExpose({ open, close });
</script>

<style scoped>
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
