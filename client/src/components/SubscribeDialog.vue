<template>
  <Modal
    :open="open"
    size="md"
    :title="header.title"
    :description="header.description"
    :icon="Crown"
    :dismissible="step !== 'processing'"
    :hide-close="step === 'processing'"
    @close="handleClose"
  >
    <!-- Processing / success / failure carry their own centered title. -->
    <template v-if="isStatusStep" #header><span /></template>

    <!-- Keyed per step so each one eases in. -->
    <div :key="step" class="animate-enter">
      <!-- 1. Plan summary + promo code -->
      <div v-if="step === 'confirm'" class="flex flex-col gap-4">
        <section class="flex flex-col gap-3 border-b border-line-subtle pb-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-semibold text-fg">{{ plan.name }}</h3>
                <Badge v-if="billingInterval === 'yearly'" variant="success">Save 1 month</Badge>
              </div>
              <p class="mt-0.5 text-xs text-fg-muted">{{ planCaption }}</p>
            </div>
            <div class="shrink-0 text-right">
              <div class="flex items-baseline justify-end gap-1.5">
                <span v-if="promo" class="tabular text-sm text-fg-subtle line-through">
                  ${{ basePrice.toFixed(2) }}
                </span>
                <span class="tabular text-lg font-semibold tracking-[-0.01em] text-fg">${{ price.toFixed(2) }}</span>
              </div>
              <p class="text-xs text-fg-muted">{{ periodLabel }}</p>
            </div>
          </div>
          <ul class="grid grid-cols-2 gap-x-4 gap-y-2">
            <li v-for="feature in features" :key="feature" class="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
              <Check class="size-3.5 shrink-0 text-brand" />
              <span class="truncate">{{ feature }}</span>
            </li>
          </ul>
        </section>

        <PromoCodeField
          id="subscribe-promo-code"
          v-model="promoCode"
          :promo="promo"
          :validating="promoValidating"
          :error="promoError"
          @apply="applyPromo"
          @clear="clearPromo"
        />

        <p class="flex items-center gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck class="size-3.5 shrink-0" />
          Secured by Stripe &amp; Solana
        </p>
      </div>

      <!-- 2. Waiting for the browser / wallet -->
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

      <!-- 3. Done -->
      <PaymentStatus v-else-if="step === 'success'" status="success" title="Subscription activated">
        Your <span class="font-medium text-fg">{{ plan.name }}</span> plan is active —
        {{ plan.monthly_credits.toLocaleString() }} credits / month.
      </PaymentStatus>

      <!-- 4. Failed / cancelled -->
      <PaymentStatus v-else status="error" :title="failure.title" :message="failure.message" />
    </div>

    <template #footer>
      <template v-if="step === 'confirm'">
        <Button variant="secondary" disabled title="Coming soon">
          <Wallet />
          Pay with crypto
          <Badge>Soon</Badge>
        </Button>
        <Button variant="primary" :disabled="promoValidating" @click="pay('stripe')">
          <CreditCard />
          Pay with card
        </Button>
      </template>
      <Button v-else-if="step === 'processing'" variant="ghost" :disabled="verifying" @click="cancelPayment">
        Cancel
      </Button>
      <Button v-else-if="step === 'success'" variant="primary" @click="finish">Get started</Button>
      <template v-else>
        <Button variant="ghost" @click="handleClose">Close</Button>
        <Button variant="primary" @click="goTo('confirm')">Try again</Button>
      </template>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  /**
   * Subscribe to (or switch / add) a plan, personal or organization. Paying is
   * the shared checkout engine (`usePaymentCheckout`), the same one credit packs
   * use: summary + promo → waiting for the browser (cancellable) → success / failure.
   *
   * `success` fires when the dialog is left after a confirmed payment — no
   * earlier than Stripe's webhook needs to activate the plan.
   */
  import { computed, watch } from 'vue';
  import { Check, CreditCard, Crown, ShieldCheck, Wallet } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Modal } from '@/components/ui/modal';
  import PaymentStatus from '@/components/billing/PaymentStatus.vue';
  import PromoCodeField from '@/components/billing/PromoCodeField.vue';
  import api from '@/services/api';
  import { validateOrgPromoCode, validatePromoCode } from '@/services/promoCodesApi';
  import { usePaymentCheckout, type PaymentOrder } from '@/composables/usePaymentCheckout';
  import { bundlePriceUsd, usePromoCode } from '@/composables/usePromoCode';

  interface SubscriptionPlan {
    id: string;
    name: string;
    price_usd: number;
    monthly_credits: number;
    seats?: number | null;
  }

  const props = defineProps<{
    open: boolean;
    plan: SubscriptionPlan;
    context: 'user' | 'organization';
    organizationId?: string;
    organizationName?: string;
    currentPlan?: string;
    type?: 'base' | 'addon';
    billingInterval?: 'monthly' | 'yearly';
  }>();

  const emit = defineEmits<{
    'update:open': [value: boolean];
    success: [];
  }>();

  const isOrganization = computed(() => props.context === 'organization' && !!props.organizationId);

  // ── Promo code ─────────────────────────────────────────────────────────────
  const {
    code: promoCode,
    promo,
    validating: promoValidating,
    error: promoError,
    appliedCode,
    apply: applyPromo,
    clear: clearPromo,
  } = usePromoCode((code) =>
    isOrganization.value
      ? validateOrgPromoCode(code, props.organizationId!, props.plan.id, 'subscription')
      : validatePromoCode(code, props.plan.id)
  );

  // ── Price ──────────────────────────────────────────────────────────────────
  /** Yearly billing is 11 months for the price of 12. */
  const basePrice = computed(() => (props.billingInterval === 'yearly' ? props.plan.price_usd * 11 : props.plan.price_usd));
  const price = computed(() => {
    if (!promo.value) return basePrice.value;
    if (promo.value.promo_type === 'bundle') return bundlePriceUsd(promo.value);
    return basePrice.value * (1 - (promo.value.percent_off ?? 0) / 100);
  });

  // ── Checkout ───────────────────────────────────────────────────────────────
  function buildOrder(): PaymentOrder {
    const { plan } = props;
    const code = appliedCode.value;
    const promoBody = code ? { promo_code: code } : {};
    const orgBase = isOrganization.value ? `/organizations/${props.organizationId}/subscription` : null;
    const orgType = props.type || 'base';

    return {
      credits: plan.monthly_credits,
      stripe: orgBase
        ? {
            endpoint: props.type === 'addon' ? `${orgBase}/addons/checkout` : `${orgBase}/checkout`,
            body: { ...(props.type === 'addon' ? { addon_tier: plan.id } : { tier: plan.id }), ...promoBody },
            windowKey: plan.id,
          }
        : {
            endpoint: '/subscription/checkout',
            body: {
              tier: plan.id,
              ...(props.billingInterval ? { billing_interval: props.billingInterval } : {}),
              ...promoBody,
            },
            windowKey: plan.id,
          },
      // Not offered yet (the button says "Soon"); kept so the flow matches the API.
      crypto: {
        amounts: async () => {
          const response = await api.post(
            orgBase ? `${orgBase}/crypto-quote` : '/subscription/crypto-quote',
            orgBase ? { tier: plan.id, type: orgType, ...promoBody } : { tier: plan.id, ...promoBody }
          );
          if (!response.data.success) throw new Error(response.data.error || 'Failed to get quote');
          const quote = response.data.quote;
          return { usd: quote.amount_usd, sol: quote.amount_sol, wallet: quote.company_wallet };
        },
        windowKey: orgBase ? `org_sub_${plan.id}` : `sub_${plan.id}`,
        windowName: plan.name,
        confirm: (tx) => ({
          endpoint: orgBase ? `${orgBase}/crypto-confirm` : '/subscription/crypto-confirm',
          body: {
            tier: plan.id,
            ...(orgBase ? { type: orgType } : {}),
            tx_signature: tx.signature,
            from_address: tx.from_address,
            ...promoBody,
          },
        }),
      },
    };
  }

  // `success` waits until the payment has settled (Stripe's webhook) even if the
  // dialog is left right away.
  let settled = false;
  let emitWhenSettled = false;

  const { step, method, verifying, statusMessage, failure, reset, goTo, pay, cancelPayment, abandon } =
    usePaymentCheckout({
      order: buildOrder,
      canPay: () => !promoValidating.value,
      onPurchased: () => {
        settled = true;
        if (emitWhenSettled) {
          emitWhenSettled = false;
          emit('success');
        }
      },
    });

  // ── Presentation ───────────────────────────────────────────────────────────
  const isStatusStep = computed(() => step.value !== 'confirm' && step.value !== 'select');

  const header = computed(() => ({
    title:
      props.type === 'addon'
        ? `Add ${props.plan.name}`
        : props.currentPlan
          ? `Switch to ${props.plan.name}`
          : `Subscribe to ${props.plan.name}`,
    description: isOrganization.value
      ? 'Power your team with AI-driven workflows.'
      : 'Take your content creation to the next level.',
  }));

  const planCaption = computed(() => {
    if (props.context === 'organization') {
      return props.organizationName ? `For ${props.organizationName}` : 'Organization plan';
    }
    return props.billingInterval === 'yearly' ? 'Billed yearly' : 'Billed monthly';
  });

  const periodLabel = computed(() => {
    if (promo.value?.promo_type === 'bundle') return `for ${promo.value.access_months} months`;
    return props.billingInterval === 'yearly' ? 'per year' : 'per month';
  });

  const features = computed<string[]>(() => {
    const credits = `${props.plan.monthly_credits.toLocaleString()} credits / month`;
    if (props.context === 'organization') {
      const seats = props.plan.seats;
      return [
        credits,
        ...(seats === null ? ['Unlimited team seats'] : seats !== undefined ? [`${seats} team seats`] : []),
        'Shared team assets',
        'Content scheduling',
        'Campaign management',
        'Analytics and insights',
        'Team collaboration',
        'Credits roll over',
      ];
    }
    return [credits, 'Unlimited exports', 'Credits roll over'];
  });

  // ── Open / close ───────────────────────────────────────────────────────────
  watch(
    () => props.open,
    (isOpen) => {
      if (isOpen) {
        reset('confirm');
        clearPromo();
        if (!emitWhenSettled) settled = false;
      } else {
        abandon();
      }
    },
    { immediate: true }
  );

  /** Leave after a confirmed payment: the page refreshes once the payment has settled. */
  function finish() {
    emit('update:open', false);
    if (settled) emit('success');
    else emitWhenSettled = true;
  }

  /** Waiting for a payment can only be left through Cancel. */
  function handleClose() {
    if (step.value === 'processing') return;
    if (step.value === 'success') finish();
    else emit('update:open', false);
  }
</script>
