<script setup lang="ts">
  /**
   * The one credit-pack checkout, for a personal balance (Billing, Pricing) or an
   * organization's shared pool (organization billing):
   * pack → order summary + payment method (card / crypto) → waiting for the
   * browser or wallet (cancellable) → success / failure.
   *
   *   <BuyCreditsDialog v-model:open="open" @success="refreshBalance" />
   *   <BuyCreditsDialog v-model:open="open" pack="medium" />            // opens on the order summary
   *   <BuyCreditsDialog v-model:open="open" :target="{ type: 'organization', id, name }" />
   *
   * `success` fires once the purchase is confirmed (a moment later for card
   * payments, so Stripe's webhook has credited the account).
   */
  import { computed, watch } from 'vue';
  import { ArrowLeft, Coins, CreditCard, ShieldCheck, Wallet } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { InfoList, type InfoListItem } from '@/components/ui/info-list';
  import { Modal } from '@/components/ui/modal';
  import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
  import PaymentStatus from './PaymentStatus.vue';
  import PromoCodeField from './PromoCodeField.vue';
  import { formatUsd, useCreditCheckout, type CreditPurchaseTarget } from '@/composables/useCreditCheckout';

  const props = withDefaults(
    defineProps<{
      open: boolean;
      /** Whose balance the credits go to. */
      target?: CreditPurchaseTarget;
      /** Preselected pack key — the dialog opens on the order summary. */
      pack?: string;
    }>(),
    { target: () => ({ type: 'user' }), pack: undefined }
  );

  const emit = defineEmits<{
    'update:open': [value: boolean];
    success: [];
  }>();

  const {
    packs,
    pricingLoading,
    loadPricing,
    step,
    selectedKey,
    selectedPack,
    method,
    verifying,
    statusMessage,
    failure,
    price,
    discountFactor,
    cryptoAvailable,
    promoCode,
    promo,
    promoValidating,
    promoError,
    reset,
    selectPack,
    goTo,
    applyPromo,
    clearPromo,
    pay,
    cancelPayment,
    abandon,
  } = useCreditCheckout({
    target: () => props.target,
    onPurchased: () => emit('success'),
  });

  const organizationName = computed(() =>
    props.target.type === 'organization' ? props.target.name || 'the organization' : ''
  );
  const isStatusStep = computed(() => step.value === 'processing' || step.value === 'success' || step.value === 'error');

  const title = computed(() => (props.target.type === 'organization' ? 'Buy team credits' : 'Buy credits'));
  const description = computed(() => {
    if (isStatusStep.value) return undefined;
    if (step.value === 'confirm') return 'Review your order and choose how to pay.';
    return props.target.type === 'organization'
      ? `Credits go to ${organizationName.value}'s shared pool and never expire.`
      : 'Credits never expire and stack with your plan.';
  });

  /** Order summary on the confirm step. */
  const summaryRows = computed<InfoListItem[]>(() => {
    const pack = selectedPack.value;
    if (!pack) return [];
    const rows: InfoListItem[] = [
      { label: 'Pack', value: pack.name },
      { label: 'Credits', value: pack.hours.toLocaleString() },
    ];
    if (props.target.type === 'organization') rows.push({ label: 'Credit pool', value: organizationName.value });
    if (promo.value) rows.push({ label: 'Discount', value: `${promo.value.percent_off}% off` });
    rows.push({ label: 'Price', value: formatUsd(price.value), strong: true });
    if (cryptoAvailable.value && pack.solAmount > 0) {
      rows.push({ label: 'SOL equivalent', value: `≈${(pack.solAmount * discountFactor.value).toFixed(4)} SOL` });
    }
    return rows;
  });

  // Each opening starts a fresh checkout; closing stops waiting for the payment.
  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen) {
        reset(props.pack);
        loadPricing();
      } else {
        abandon();
      }
    },
    { immediate: true }
  );

  /** Waiting for a payment can only be left through Cancel. */
  function close() {
    if (step.value === 'processing') return;
    emit('update:open', false);
  }
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    :description="description"
    :icon="Coins"
    size="md"
    :dismissible="step !== 'processing'"
    :hide-close="step === 'processing'"
    @close="close"
  >
    <!-- Processing / success / failure carry their own centered title. -->
    <template v-if="isStatusStep" #header><span /></template>

    <!-- Keyed per step so each one eases in. -->
    <div :key="step" class="animate-enter">
      <!-- 1. Pack -->
      <template v-if="step === 'select'">
        <div v-if="!packs.length && pricingLoading" class="skeleton-group flex flex-col gap-2" aria-hidden="true">
          <div
            v-for="i in 3"
            :key="i"
            class="flex h-[54px] items-center gap-3 rounded-lg border border-line-subtle px-3.5"
          >
            <div class="skeleton size-4 rounded-full" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-20" />
              <div class="skeleton h-3 w-36" />
            </div>
            <div class="skeleton h-4 w-12" />
          </div>
        </div>

        <div v-else-if="!packs.length" class="flex items-center justify-between gap-3 py-1 text-sm text-fg-muted">
          Couldn't load credit packs.
          <Button variant="secondary" size="sm" @click="loadPricing">Retry</Button>
        </div>

        <RadioGroup
          v-else
          :model-value="selectedKey"
          class="gap-2"
          aria-label="Credit pack"
          @update:model-value="(key) => selectPack(String(key))"
        >
          <label
            v-for="pack in packs"
            :key="pack.key"
            class="flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors duration-[var(--duration-fast)]"
            :class="selectedKey === pack.key ? 'border-brand-line bg-brand-soft' : 'border-line-subtle hover:bg-surface-hover'"
          >
            <RadioGroupItem :value="pack.key" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-fg">{{ pack.name }}</span>
                <Badge v-if="pack.bestValue" variant="brand">Best value</Badge>
              </span>
              <span class="block truncate text-xs text-fg-muted">
                <span class="tabular">{{ pack.hours.toLocaleString() }}</span> credits
                <template v-if="pack.savingsPercent">· save {{ pack.savingsPercent }}% per credit</template>
              </span>
            </span>
            <span class="tabular shrink-0 text-base font-semibold text-fg">{{ formatUsd(pack.usd) }}</span>
          </label>
        </RadioGroup>
      </template>

      <!-- 2. Order summary + promo code (organization packs) -->
      <div v-else-if="step === 'confirm'" class="flex flex-col gap-4">
        <InfoList :rows="summaryRows" />

        <PromoCodeField
          v-if="target.type === 'organization'"
          id="buy-credits-promo"
          v-model="promoCode"
          :promo="promo"
          :validating="promoValidating"
          :error="promoError"
          @apply="applyPromo"
          @clear="clearPromo"
        />

        <p class="flex items-center gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck class="size-3.5 shrink-0" />
          Card payments by Stripe, crypto in SOL with Phantom.
        </p>
      </div>

      <!-- 3. Waiting for the browser / wallet -->
      <PaymentStatus
        v-else-if="step === 'processing'"
        status="processing"
        :title="verifying ? 'Verifying payment' : 'Waiting for payment'"
      >
        {{ statusMessage }}
        <span v-if="method === 'crypto' && !verifying" class="mt-1 block text-xs text-fg-subtle">
          Keep this dialog open until the transfer is verified.
        </span>
      </PaymentStatus>

      <!-- 4. Done -->
      <PaymentStatus v-else-if="step === 'success'" status="success" title="Credits added">
        <span class="font-medium text-fg">{{ selectedPack?.hours.toLocaleString() }} credits</span>
        {{ target.type === 'organization' ? `added to ${organizationName}'s pool` : 'added to your balance' }}
      </PaymentStatus>

      <!-- 5. Failed / cancelled -->
      <PaymentStatus v-else status="error" :title="failure.title" :message="failure.message" />
    </div>

    <template #footer>
      <template v-if="step === 'select'">
        <Button variant="ghost" @click="close">Cancel</Button>
        <Button variant="primary" :disabled="!selectedPack" @click="goTo('confirm')">Continue</Button>
      </template>
      <template v-else-if="step === 'confirm'">
        <Button variant="ghost" class="mr-auto" @click="goTo('select')">
          <ArrowLeft />
          Back
        </Button>
        <Button
          variant="secondary"
          :disabled="!cryptoAvailable || promoValidating"
          :title="cryptoAvailable ? undefined : 'Crypto pricing is unavailable right now'"
          @click="pay('crypto')"
        >
          <Wallet />
          Pay with crypto
        </Button>
        <Button variant="primary" :disabled="promoValidating" @click="pay('stripe')">
          <CreditCard />
          Pay with card
        </Button>
      </template>
      <Button v-else-if="step === 'processing'" variant="ghost" :disabled="verifying" @click="cancelPayment">
        Cancel
      </Button>
      <Button v-else-if="step === 'success'" variant="primary" @click="close">Done</Button>
      <template v-else>
        <Button variant="ghost" @click="close">Close</Button>
        <Button variant="primary" @click="goTo('confirm')">Try again</Button>
      </template>
    </template>
  </Modal>
</template>
