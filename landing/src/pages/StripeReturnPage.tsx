import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

function mobileDeepLink(kind: 'success' | 'cancel', sessionId: string | null): string {
  if (kind === 'cancel') return 'clippster://stripe/cancel';
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
  return `clippster://stripe/success${qs}`;
}

export function StripeReturnPage({ kind }: { kind: 'success' | 'cancel' }) {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const returnTo = params.get('return_to');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (returnTo === 'mobile') {
        window.location.href = mobileDeepLink(kind, sessionId);
        return;
      }
      window.location.href = sessionId
        ? `/organization/billing?session_id=${encodeURIComponent(sessionId)}`
        : '/organization/billing';
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [kind, returnTo, sessionId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold">
          {kind === 'success' ? 'Payment successful' : 'Checkout cancelled'}
        </h1>
        <p className="mt-3 text-sm text-neutral-400">
          {kind === 'success'
            ? 'Returning you to Clippster…'
            : 'No charge was made. You can pick a plan again anytime.'}
        </p>
      </div>
    </main>
  );
}
