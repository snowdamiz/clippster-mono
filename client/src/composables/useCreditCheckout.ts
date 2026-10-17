/**
 * Credit-pack checkout: pricing (shared, fetched once per app session and refreshed
 * on demand) and the pack / promo state used by `BuyCreditsDialog` for both
 * personal balances and organization credit pools. Paying is done by the shared
 * engine in `usePaymentCheckout`:
 *
 *   select → confirm → processing (waiting for the browser / wallet callback) → success | error
 */
import { computed, ref, shallowRef } from 'vue';
import api from '@/services/api';
import { validateOrgPromoCode } from '@/services/promoCodesApi';
import { usePaymentCheckout, type CheckoutStep, type PaymentMethod, type PaymentOrder } from '@/composables/usePaymentCheckout';
import { usePromoCode } from '@/composables/usePromoCode';

export type CreditPurchaseTarget = { type: 'user' } | { type: 'organization'; id: string; name?: string };
export type CreditPaymentMethod = PaymentMethod;
export type CreditCheckoutStep = CheckoutStep;

export interface CreditPack {
  key: string;
  name: string;
  /** Credits (minutes) in the pack. */
  hours: number;
  usd: number;
  /** SOL price from the API, or USD at the current SOL rate (0 when unknown). */
  solAmount: number;
  /** Display only: per-credit saving vs. the most expensive per-credit pack. */
  savingsPercent?: number;
  /** The recommended pack. */
  bestValue: boolean;
}

interface RawPack {
  name?: string;
  hours: number;
  usd: number;
  sol_amount?: number;
}

const BEST_VALUE_PACK = 'medium';

// ───────────────────────────── Pricing (shared) ─────────────────────────────

/**
 * Packs on offer depend on who buys: Basic-plan users may only buy the Large
 * pack for themselves, but an organization's pool isn't limited by the buyer's
 * personal plan — so each context keeps its own list.
 */
export type PricingContext = 'user' | 'organization';

function createPricing(context: PricingContext) {
  const rawPacks = shallowRef<Record<string, RawPack>>({});
  const solUsdRate = ref(0);
  const companyWallet = ref('');
  const loading = ref(false);
  let request: Promise<boolean> | null = null;

  const packs = computed<CreditPack[]>(() => {
    const entries = Object.entries(rawPacks.value);
    const rates = entries.filter(([, p]) => p.hours > 0).map(([, p]) => p.usd / p.hours);
    const maxRate = rates.length ? Math.max(...rates) : 0;
    return entries
      .map(([key, p]) => {
        const savings = p.hours > 0 && maxRate > 0 ? Math.round((1 - p.usd / p.hours / maxRate) * 100) : 0;
        return {
          key,
          name: p.name || capitalize(key),
          hours: p.hours,
          usd: p.usd,
          solAmount: p.sol_amount || (solUsdRate.value > 0 ? p.usd / solUsdRate.value : 0),
          savingsPercent: savings > 0 ? savings : undefined,
          bestValue: key === BEST_VALUE_PACK,
        };
      })
      .sort((a, b) => a.usd - b.usd);
  });

  /** `GET /pricing`; concurrent calls share one request. */
  function load(): Promise<boolean> {
    if (request) return request;
    loading.value = true;
    request = (async () => {
      try {
        const response = await api.get('/pricing', { params: context === 'organization' ? { context } : undefined });
        if (!response.data.success) throw new Error(response.data.error || 'Failed to load pricing');
        rawPacks.value = response.data.packs || {};
        solUsdRate.value = response.data.sol_usd_rate || 0;
        companyWallet.value = response.data.company_wallet_address || '';
        return true;
      } catch (error) {
        console.error('[useCreditPricing] Failed to fetch pricing:', error);
        return false;
      } finally {
        loading.value = false;
        request = null;
      }
    })();
    return request;
  }

  return { packs, loading, companyWallet, load };
}

const pricing: Record<PricingContext, ReturnType<typeof createPricing>> = {
  user: createPricing('user'),
  organization: createPricing('organization'),
};

/** Credit packs for `context`, shared by every credit-pack surface (fetched once, refreshed on demand). */
export function useCreditPricing(context: PricingContext = 'user') {
  const { packs, loading, load } = pricing[context];
  return { packs, loading, loadPricing: load };
}

// ───────────────────────────── Helpers ─────────────────────────────

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "$9.99" / "$25" */
export function formatUsd(usd: number): string {
  return `$${usd % 1 === 0 ? usd : usd.toFixed(2)}`;
}

// ───────────────────────────── Checkout ─────────────────────────────

export function useCreditCheckout(options: {
  target: () => CreditPurchaseTarget;
  /** Fired once a purchase is confirmed (delayed for card payments so the webhook can land). */
  onPurchased?: () => void;
}) {
  const prices = computed(() => pricing[options.target().type === 'organization' ? 'organization' : 'user']);
  const packs = computed(() => prices.value.packs.value);
  const pricingLoading = computed(() => prices.value.loading.value);
  const companyWallet = computed(() => prices.value.companyWallet.value);
  const loadPricing = () => prices.value.load();

  const selectedKey = ref<string>('');
  const selectedPack = computed(() => packs.value.find((p) => p.key === selectedKey.value) ?? null);

  // Promo codes exist for organization credit packs only.
  const promoState = usePromoCode((code) => {
    const target = options.target();
    return target.type === 'organization' ? validateOrgPromoCode(code, target.id, selectedKey.value, 'credit_pack') : null;
  });

  const discountFactor = computed(() => (promoState.promo.value ? 1 - (promoState.promo.value.percent_off ?? 0) / 100 : 1));
  const price = computed(() => (selectedPack.value ? selectedPack.value.usd * discountFactor.value : 0));
  /**
   * Organization payments are quoted by the API; personal ones use the pricing
   * SOL amount and wallet, so they need both to be known.
   */
  const cryptoAvailable = computed(
    () => options.target().type === 'organization' || (!!selectedPack.value?.solAmount && !!companyWallet.value)
  );

  function buildOrder(): PaymentOrder | null {
    const pack = selectedPack.value;
    if (!pack) return null;
    const target = options.target();
    const code = promoState.appliedCode.value;
    const promoBody = code ? { promo_code: code } : {};
    const org = target.type === 'organization' ? target : null;

    return {
      credits: pack.hours,
      stripe: {
        endpoint: org ? `/organizations/${org.id}/payments/stripe/create-session` : '/payments/stripe/create-session',
        body: { pack_type: pack.key, ...promoBody },
        windowKey: pack.key,
      },
      crypto: cryptoAvailable.value
        ? {
            // Personal packs pay the pricing amount; organization packs are quoted (promo codes apply there).
            amounts: org
              ? async () => {
                  const response = await api.post('/payments/quote', {
                    organization_id: org.id,
                    pack_type: pack.key,
                    ...promoBody,
                  });
                  if (!response.data.success) throw new Error(response.data.error || 'Failed to get quote');
                  const quote = response.data.quote;
                  return { usd: quote.amount_usd, sol: quote.amount_sol, wallet: quote.company_wallet };
                }
              : { usd: pack.usd, sol: pack.solAmount, wallet: companyWallet.value },
            windowKey: pack.key,
            windowName: capitalize(pack.key),
            confirm: (tx) => ({
              endpoint: org ? `/organizations/${org.id}/payments/confirm` : '/payments/confirm',
              body: { tx_signature: tx.signature, pack_type: tx.pack_key, from_address: tx.from_address, ...promoBody },
            }),
          }
        : undefined,
      successToast: {
        title: 'Credits added',
        message: org
          ? `${pack.hours.toLocaleString()} credits added to ${org.name || 'the organization'}'s pool`
          : `${pack.hours.toLocaleString()} credits added to your balance`,
      },
    };
  }

  const checkout = usePaymentCheckout({
    order: buildOrder,
    canPay: () => !promoState.validating.value,
    onPurchased: () => options.onPurchased?.(),
  });

  /** Start a fresh checkout; `packKey` skips straight to the confirm step. */
  function reset(packKey?: string) {
    checkout.reset(packKey && packs.value.some((p) => p.key === packKey) ? 'confirm' : 'select');
    selectedKey.value = packKey ?? '';
    promoState.clear();
  }

  function selectPack(key: string) {
    if (key !== selectedKey.value) promoState.clear(); // promos are validated per pack
    selectedKey.value = key;
  }

  function goTo(next: 'select' | 'confirm') {
    if (next === 'confirm' && !selectedPack.value) return;
    checkout.goTo(next);
  }

  return {
    // pricing
    packs,
    pricingLoading,
    loadPricing,
    // state
    step: checkout.step,
    selectedKey,
    selectedPack,
    method: checkout.method,
    verifying: checkout.verifying,
    statusMessage: checkout.statusMessage,
    failure: checkout.failure,
    price,
    discountFactor,
    cryptoAvailable,
    // promo
    promoCode: promoState.code,
    promo: promoState.promo,
    promoValidating: promoState.validating,
    promoError: promoState.error,
    // actions
    reset,
    selectPack,
    goTo,
    applyPromo: promoState.apply,
    clearPromo: promoState.clear,
    pay: checkout.pay,
    cancelPayment: checkout.cancelPayment,
    /** The dialog closed: stop waiting (a wallet transfer already underway is still confirmed). */
    abandon: checkout.abandon,
  };
}
