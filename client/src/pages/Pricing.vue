<template>
  <PageLayout title="Credit packs" description="Purchase additional credits to use with Clippster" :icon="Coins">
    <template #actions>
      <Button v-if="!authStore.isAuthenticated" variant="primary" size="sm" @click="showAuthModal">
        Sign in to view your status
      </Button>
      <template v-else>
        <span v-if="!loading" class="flex animate-fade-in items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted">
          <Zap class="size-3.5 text-brand" />
          Balance
          <span v-if="typeof balance.hours_remaining === 'string'" class="font-medium text-fg">Unlimited</span>
          <span v-else class="tabular font-medium text-fg">{{ Math.round(balance.hours_remaining) }} min</span>
        </span>
        <router-link to="/billing" :class="buttonVariants({ variant: 'secondary', size: 'sm' })">
          <CreditCard />
          Manage subscription
        </router-link>
      </template>
    </template>

    <!-- Admin state -->
    <EmptyState
      v-if="!loading && authStore.isAuthenticated && typeof balance.hours_remaining === 'string'"
      :icon="Shield"
      tone="brand"
      title="Admin access"
      description="You have unlimited access as an administrator. No subscription or credits needed!"
    >
      <Badge variant="brand" size="md"><Shield />Unlimited access</Badge>
    </EmptyState>

    <!-- Error state -->
    <EmptyState
      v-else-if="!loading && loadError && !packs.length"
      :icon="AlertTriangle"
      tone="danger"
      title="Unable to load pricing"
      description="Please check your connection and try again"
    >
      <Button variant="secondary" @click="retryLoad">
        <RefreshCw />
        Retry
      </Button>
    </EmptyState>

    <div v-else class="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-5 py-4">
      <!-- Credit packs -->
      <section class="flex flex-col gap-3">
        <SectionHeader title="One-time credit packs" description="Top up anytime — pack credits stack with your plan" />
        <div v-if="loading && !packs.length" class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <PriceCard v-for="i in 3" :key="i" loading />
        </div>
        <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <PriceCard
            v-for="pack in packs"
            :key="pack.key"
            :name="pack.name"
            :price="formatUsd(pack.usd)"
            :credits="pack.hours.toLocaleString()"
            credits-label="credits"
            :features="packFeatures"
            :highlighted="pack.bestValue"
            :badge="pack.bestValue ? 'Best value' : undefined"
          >
            <Button block :variant="pack.bestValue ? 'primary' : 'secondary'" @click="buyPack(pack.key)">
              {{ authStore.isAuthenticated ? 'Buy credits' : 'Sign in to purchase' }}
            </Button>
          </PriceCard>
        </div>
      </section>

      <!-- Why Clippster -->
      <section class="flex flex-col gap-3 border-t border-line-subtle pt-4">
        <SectionHeader
          title="Why choose Clippster?"
          description="The smarter way to create clips. Save money, protect your privacy, and pay with crypto."
        />
        <ul class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-6 gap-y-4">
          <li v-for="item in valueProps" :key="item.title" class="flex min-w-0 items-start gap-2.5">
            <component :is="item.icon" class="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <div class="min-w-0">
              <h3 class="text-sm font-medium text-fg">{{ item.title }}</h3>
              <p class="mt-0.5 text-xs leading-relaxed text-fg-muted">{{ item.description }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <BuyCreditsDialog v-model:open="showBuyDialog" :pack="purchasePack" @success="fetchBalance" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import api from '@/services/api';
  import { formatUsd, useCreditPricing } from '@/composables/useCreditCheckout';
  import { CreditCard, AlertTriangle, Shield, TrendingUp, Lock, DollarSign, Coins, Zap, RefreshCw } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import BuyCreditsDialog from '@/components/billing/BuyCreditsDialog.vue';
  import PriceCard from '@/components/billing/PriceCard.vue';
  import type { PriceFeature } from '@/components/billing/types';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SectionHeader } from '@/components/ui/section-header';

  const authStore = useAuthStore();
  const { packs, loadPricing } = useCreditPricing();

  const loading = ref(true);
  const loadError = ref(false);

  const balance = ref<{ hours_remaining: number | 'unlimited'; hours_used: number }>({
    hours_remaining: 0,
    hours_used: 0,
  });

  // Checkout dialog, opened on the order summary of the clicked pack
  const showBuyDialog = ref(false);
  const purchasePack = ref<string>();

  const packFeatures: PriceFeature[] = [
    { label: 'Credits never expire' },
    { label: 'Use anytime' },
    { label: 'Stack with subscription credits' },
  ];

  const valueProps = [
    {
      icon: TrendingUp,
      title: '72-81% cheaper',
      description: 'Save thousands compared to other clipping tools. Same quality, better price.',
    },
    {
      icon: Lock,
      title: 'Privacy first',
      description: 'Desktop app means your videos stay on your machine. No cloud uploads, total control.',
    },
    {
      icon: DollarSign,
      title: 'Crypto native',
      description: 'Pay with SOL via Phantom or use your card. Instant transactions.',
    },
  ];

  async function retryLoad() {
    loading.value = true;
    const [pricingLoaded] = await Promise.all([loadPricing(), fetchBalance()]);
    loadError.value = !pricingLoaded;
    loading.value = false;
  }

  onMounted(retryLoad);

  async function fetchBalance() {
    if (!authStore.isAuthenticated) {
      balance.value = { hours_remaining: 0, hours_used: 0 };
      return;
    }

    try {
      const response = await api.get('/credits/balance');
      if (response.data.success) {
        balance.value = response.data.balance;
      }
    } catch (error: any) {
      console.error('Failed to fetch balance:', error);
    }
  }

  function buyPack(key: string) {
    if (!authStore.isAuthenticated) {
      showAuthModal();
      return;
    }
    purchasePack.value = key;
    showBuyDialog.value = true;
  }

  function showAuthModal() {
    window.dispatchEvent(new CustomEvent('show-auth-modal'));
  }
</script>
