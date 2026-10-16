/**
 * Payment engine shared by every checkout (credit packs, subscriptions): the
 * step state machine, Stripe / Phantom payment windows and their callbacks,
 * cancel, double-click guards and cleanup. Product-specific composables
 * (`useCreditCheckout`, `SubscribeDialog`) describe *what* is bought as a
 * `PaymentOrder`; this decides *how* it's paid.
 *
 *   [select →] confirm → processing (waiting for the browser / wallet) → success | error
 *
 * Card payments open Stripe Checkout in the system browser; the Tauri callback
 * server emits `stripe-payment-complete` when Stripe redirects back (Stripe's
 * webhook does the crediting). Crypto payments open the local Phantom payment
 * page; it emits `wallet-payment-complete` with the transaction signature, and
 * only this app confirms it with the API — so the wallet listener outlives
 * Cancel / closing the dialog (the browser page may still send the transfer)
 * and is released when a new crypto attempt replaces it or on unmount.
 */
import { onScopeDispose, ref, type Ref } from 'vue';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

export type PaymentMethod = 'stripe' | 'crypto';
export type CheckoutStep = 'select' | 'confirm' | 'processing' | 'success' | 'error';

/** Payload of the Tauri `wallet-payment-complete` event (see src-tauri/src/auth.rs). */
export interface WalletPaymentResult {
  signature: string;
  pack_key: string;
  from_address: string;
  pack_hours: number;
}

/** Payload of the Tauri `stripe-payment-complete` event (see src-tauri/src/stripe_callback.rs). */
interface StripePaymentResult {
  success: boolean;
  session_id?: string | null;
  error?: string | null;
}

export interface CryptoAmounts {
  usd: number;
  sol: number;
  wallet: string;
}

/** What is being bought, built when a payment starts (so late callbacks keep their own order). */
export interface PaymentOrder {
  /** Credits the purchase grants; shown by the payment pages. */
  credits: number;
  stripe: {
    /** POST endpoint creating a Stripe Checkout session; responds `{ success, url }`. */
    endpoint: string;
    /** Request body (`return_context: 'desktop'` is added). */
    body: Record<string, unknown>;
    /** Product key passed to the Stripe payment window. */
    windowKey: string;
  };
  crypto?: {
    /** Fixed amounts, or a server quote requested when the payment starts. */
    amounts: CryptoAmounts | (() => Promise<CryptoAmounts>);
    /** Product key and name shown on the Phantom payment page. */
    windowKey: string;
    windowName: string;
    /** How to confirm the signed transfer with the API. */
    confirm: (tx: WalletPaymentResult) => { endpoint: string; body: Record<string, unknown> };
  };
  /** Toast once the payment is confirmed; omit when the page announces it itself. */
  successToast?: { title: string; message: string };
}

/** Card payments redirect before Stripe's webhook has landed; tell the page a bit later. */
const STRIPE_SETTLE_MS = 2000;
/** "Pay with card" replaces "Continue" / "Try again" / "Cancel" in the footer: a double click must not start a payment. */
const STEP_CLICK_GUARD_MS = 400;

export function errorText(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { error?: string } }; message?: string } | null;
  return e?.response?.data?.error || e?.message || fallback;
}

/** Same API origin the wallet payment page has always received (normalized again on the Rust side). */
function walletApiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : 'https://api.clippster.app');
}

export function usePaymentCheckout(options: {
  /** The order for the current selection, or null when nothing can be paid for yet. */
  order: () => PaymentOrder | null;
  /** Extra precondition for starting a payment (e.g. no promo validation in flight). */
  canPay?: () => boolean;
  /** Fired once a payment is confirmed — a moment later for card payments, so Stripe's webhook has landed. */
  onPurchased?: (method: PaymentMethod) => void;
}) {
  const authStore = useAuthStore();
  const toast = useToast();

  const step = ref<CheckoutStep>('confirm');
  const method = ref<PaymentMethod | null>(null);
  /** The wallet callback arrived and the transfer is being confirmed — can't be cancelled. */
  const verifying = ref(false);
  const statusMessage = ref('');
  const failure = ref<{ title: string; message: string }>({ title: '', message: '' });

  // Each payment attempt gets an id; cancelling or closing bumps it so late
  // responses from an abandoned attempt no longer drive the dialog.
  let attempt = 0;
  let unlistenStripe: (() => void) | null = null;
  let unlistenWallet: (() => void) | null = null;
  let stepChangedAt = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function setStep(next: CheckoutStep) {
    step.value = next;
    stepChangedAt = Date.now();
  }

  function stopStripeListener() {
    unlistenStripe?.();
    unlistenStripe = null;
  }

  function stopWalletListener() {
    unlistenWallet?.();
    unlistenWallet = null;
  }

  /** Stop driving the dialog from the current attempt (cancel / close / reopen). */
  function abandon() {
    attempt++;
    stopStripeListener();
  }

  /** Start a fresh checkout on `initial`. */
  function reset(initial: 'select' | 'confirm' = 'confirm') {
    abandon();
    setStep(initial);
    method.value = null;
    verifying.value = false;
    statusMessage.value = '';
    failure.value = { title: '', message: '' };
  }

  /** Move between the pre-payment steps; a payment in progress can only be left through `cancelPayment`. */
  function goTo(next: 'select' | 'confirm') {
    if (step.value === 'processing') return;
    setStep(next);
  }

  /** `current` is false when the dialog was closed while a confirmed transfer was being verified. */
  function succeed(order: PaymentOrder, paidWith: PaymentMethod, current = true) {
    if (current) {
      setStep('success');
      verifying.value = false;
    }
    if (order.successToast) toast.success(order.successToast.title, order.successToast.message);
    if (!options.onPurchased) return;
    if (paidWith === 'stripe') {
      const timer = setTimeout(() => {
        timers.delete(timer);
        options.onPurchased?.(paidWith);
      }, STRIPE_SETTLE_MS);
      timers.add(timer);
    } else {
      options.onPurchased(paidWith);
    }
  }

  function fail(title: string, message: string, notify = true) {
    stopStripeListener();
    setStep('error');
    verifying.value = false;
    failure.value = { title, message };
    if (notify) toast.error(title, message);
  }

  async function startStripe(id: number, order: PaymentOrder) {
    const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]);

    const response = await api.post(order.stripe.endpoint, { ...order.stripe.body, return_context: 'desktop' });
    if (id !== attempt) return;
    if (!response.data.success) throw new Error(response.data.error || 'Failed to create checkout session');

    const off = await listen<StripePaymentResult>('stripe-payment-complete', (event) => {
      if (id !== attempt) return;
      stopStripeListener();
      if (event.payload?.success) succeed(order, 'stripe');
      // Stripe's cancel page: nothing was charged, so no error toast.
      else fail('Payment cancelled', 'Checkout was cancelled. No charge was made.', false);
    });
    if (id !== attempt) return off();
    stopStripeListener();
    unlistenStripe = off;

    statusMessage.value = 'Opening payment page…';
    await invoke('open_stripe_payment_window', {
      checkoutUrl: response.data.url,
      packKey: order.stripe.windowKey,
      packHours: order.credits,
    });
    if (id === attempt) statusMessage.value = 'Complete the payment in your browser…';
  }

  async function startCrypto(id: number, order: PaymentOrder) {
    const crypto = order.crypto!;
    const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')]);

    const amounts = typeof crypto.amounts === 'function' ? await crypto.amounts() : crypto.amounts;
    if (id !== attempt) return;

    // A transfer is confirmed even if this attempt was cancelled or the dialog closed
    // meanwhile; then only the toasts report the result.
    const off = await listen<WalletPaymentResult>('wallet-payment-complete', async (event) => {
      if (unlistenWallet === off) stopWalletListener();
      if (id === attempt) {
        verifying.value = true;
        statusMessage.value = 'Verifying the transfer…';
      }
      try {
        const request = crypto.confirm(event.payload);
        const response = await api.post(request.endpoint, request.body);
        if (!response.data.success) throw new Error(response.data.error || 'Payment confirmation failed');
        succeed(order, 'crypto', id === attempt);
      } catch (error) {
        const message = errorText(error, 'Payment verification failed');
        if (id === attempt) fail('Payment verification failed', message);
        else toast.error('Payment verification failed', message);
      }
    });
    if (id !== attempt) return off();
    stopWalletListener(); // the new payment window replaces any earlier one
    unlistenWallet = off;

    statusMessage.value = 'Opening payment window…';
    try {
      await invoke('open_wallet_payment_window', {
        packKey: crypto.windowKey,
        packName: crypto.windowName,
        hours: order.credits,
        usd: amounts.usd,
        sol: amounts.sol,
        companyWallet: amounts.wallet,
        authToken: authStore.token,
        apiBase: walletApiBase(),
      });
    } catch (error) {
      if (unlistenWallet === off) stopWalletListener(); // no payment page, nothing to wait for
      throw error;
    }
    if (id === attempt && !verifying.value) statusMessage.value = 'Approve the transfer in Phantom in your browser…';
  }

  /** Start paying for the current order. Ignored while a payment is already in progress. */
  async function pay(paidWith: PaymentMethod) {
    if (step.value !== 'confirm' || options.canPay?.() === false) return;
    if (Date.now() - stepChangedAt < STEP_CLICK_GUARD_MS) return;
    const order = options.order();
    if (!order || (paidWith === 'crypto' && !order.crypto)) return;

    const id = ++attempt;
    method.value = paidWith;
    verifying.value = false;
    setStep('processing');
    statusMessage.value =
      paidWith === 'stripe'
        ? 'Creating checkout session…'
        : typeof order.crypto?.amounts === 'function'
          ? 'Getting payment quote…'
          : 'Opening payment window…';

    try {
      await (paidWith === 'stripe' ? startStripe(id, order) : startCrypto(id, order));
    } catch (error) {
      if (id === attempt) {
        fail(
          'Payment failed',
          errorText(error, paidWith === 'stripe' ? 'Failed to create checkout session' : 'Failed to open payment window')
        );
      }
    }
  }

  /** Stop waiting for the browser / wallet and go back to the order. */
  function cancelPayment() {
    if (step.value !== 'processing' || verifying.value) return;
    abandon();
    method.value = null;
    setStep('confirm');
  }

  onScopeDispose(() => {
    abandon();
    stopWalletListener();
    timers.forEach(clearTimeout);
    timers.clear();
  });

  return {
    step: step as Readonly<Ref<CheckoutStep>>,
    method,
    verifying,
    statusMessage,
    failure,
    reset,
    goTo,
    pay,
    cancelPayment,
    /** The dialog closed: stop waiting (a wallet transfer already underway is still confirmed). */
    abandon,
  };
}
