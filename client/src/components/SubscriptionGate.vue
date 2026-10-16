<template>
  <Modal
    :open="isOpen"
    size="md"
    :title="headerTitle"
    :description="headerDescription"
    :icon="headerIcon"
    :tone="actionType === 'expired' ? 'warning' : 'brand'"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <!-- What the user tried to do -->
      <div v-if="actionContext" class="flex items-center gap-2">
        <component :is="actionIcon" class="size-4 shrink-0 text-fg-subtle" />
        <p class="min-w-0 truncate text-sm text-fg-muted">
          You tried to: <span class="font-medium text-fg">{{ actionContext }}</span>
        </p>
      </div>

      <!-- Plans -->
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="tier in tiers"
          :key="tier.id"
          type="button"
          class="flex flex-col rounded-xl border p-3 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          :class="
            tier.id === 'creator'
              ? 'border-brand-line bg-brand-soft hover:bg-[var(--brand-soft-hover)]'
              : 'border-line-subtle bg-surface hover:border-line hover:bg-surface-hover'
          "
          @click="selectTier(tier)"
        >
          <span class="flex items-center justify-between gap-1">
            <span class="text-xs font-medium text-fg-muted">{{ tier.name }}</span>
            <Badge v-if="tier.id === 'creator'" variant="brand">Popular</Badge>
          </span>
          <span class="mt-1.5 flex items-baseline gap-0.5">
            <span class="tabular text-lg font-semibold text-fg">${{ tier.price_usd }}</span>
            <span class="text-2xs text-fg-subtle">/mo</span>
          </span>
          <span class="mt-2 flex items-center gap-1 border-t border-line-subtle pt-2 text-xs text-fg-muted">
            <Zap class="size-3.5 text-brand" />
            <span class="tabular font-medium text-fg">{{ tier.monthly_credits.toLocaleString() }}</span>
            credits
          </span>
        </button>
      </div>

      <!-- Included -->
      <ul class="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <li v-for="benefit in benefits" :key="benefit" class="flex items-center gap-2 text-xs text-fg-muted">
          <Check class="size-3.5 shrink-0 text-brand" />
          {{ benefit }}
        </li>
      </ul>
    </div>

    <template #footer>
      <span class="mr-auto text-xs text-fg-subtle">Cancel anytime · Stripe or crypto</span>
      <Button variant="ghost" @click="close">Not now</Button>
      <Button variant="primary" @click="goToPricing">View plans</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { Lock, Check, Zap, Download, Video, Radio, FolderPlus, AlertCircle } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';

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

  const benefits = ['Mobile app', 'AI clip detection', 'Video editor', 'Credits roll over'];

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
        return 'Subscription expired';
      default:
        return 'Subscription required';
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
