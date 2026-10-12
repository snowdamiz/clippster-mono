/**
 * Promo code entry shared by every checkout: type a code, Apply validates it
 * against whatever the code is for (a plan, a credit pack), Remove clears it.
 *
 *   const promo = usePromoCode((code) => validatePromoCode(code, plan.id));
 *   promo.appliedCode.value // the code to send with the payment, once validated
 *
 * `validate` returns null when promo codes don't apply (nothing is sent).
 */
import { computed, ref } from 'vue';
import { useToast } from '@/composables/useToast';
import type { ValidatePromoResponse } from '@/services/promoCodesApi';

export type ValidatedPromo = NonNullable<ValidatePromoResponse['promo']>;

/** Price a bundle promo charges, in USD. */
export function bundlePriceUsd(promo: ValidatedPromo): number {
  return promo.fixed_price_usd ?? (promo.fixed_price_cents ?? 0) / 100;
}

export function usePromoCode(validate: (code: string) => Promise<ValidatePromoResponse> | null) {
  const toast = useToast();

  const code = ref('');
  const promo = ref<ValidatedPromo | null>(null);
  const validating = ref(false);
  const error = ref('');

  /** The code to send with a payment: only once it has been validated. */
  const appliedCode = computed(() => (promo.value && code.value.trim() ? code.value.trim() : undefined));

  async function apply() {
    const value = code.value.trim();
    if (!value || validating.value) return;
    const request = validate(value);
    if (!request) return;

    validating.value = true;
    error.value = '';
    try {
      const response = await request;
      if (response.success && response.promo) {
        promo.value = response.promo;
        if (response.promo.promo_type === 'bundle') {
          toast.success(
            'Bundle code applied',
            `$${bundlePriceUsd(response.promo).toFixed(2)} for ${response.promo.access_months} months + ${response.promo.total_credits?.toLocaleString()} credits`
          );
        } else {
          toast.success('Promo code applied', `${response.promo.percent_off}% discount`);
        }
      } else {
        promo.value = null;
        error.value = response.error || 'Invalid promo code';
      }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } }; message?: string } | null;
      promo.value = null;
      error.value = err?.response?.data?.error || err?.message || 'Failed to validate promo code';
    } finally {
      validating.value = false;
    }
  }

  function clear() {
    code.value = '';
    promo.value = null;
    error.value = '';
  }

  return { code, promo, validating, error, appliedCode, apply, clear };
}
