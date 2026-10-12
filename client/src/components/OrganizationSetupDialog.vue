<template>
  <Modal
    :open="show"
    title="Complete your organization setup"
    description="Your organization has been created with custom billing. Please complete the payment setup to activate your subscription."
    :icon="CreditCard"
    size="md"
    :dismissible="false"
    hide-close
  >
    <div class="flex flex-col gap-3">
      <!-- Plan Details -->
      <InfoList class="border-y border-line-subtle">
        <InfoRow label="Plan">
          <span class="capitalize">
            {{ organization?.subscription_tier === 'custom' ? 'Custom' : organization?.subscription_tier || 'Standard' }}
          </span>
        </InfoRow>
        <InfoRow
          label="Monthly price"
          :value="`$${organization?.admin_price_cents ? (organization.admin_price_cents / 100).toFixed(2) : '0.00'}/mo`"
        />
        <InfoRow label="Seats" :value="organization?.max_seats || 'Unlimited'" />
        <InfoRow label="AI credits" :value="`${organization?.monthly_credits || 0}/mo`" />
      </InfoList>

      <!-- Error Display -->
      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </div>

    <template #footer>
      <p class="mr-auto text-xs text-fg-subtle">Stripe will open in your browser to set up recurring billing.</p>
      <Button variant="primary" :loading="loading" @click="handleProceed">
        <ExternalLink v-if="!loading" />
        {{ loading ? 'Waiting for payment...' : 'Pay now & activate' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { CreditCard, AlertCircle, ExternalLink } from 'lucide-vue-next';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { InfoList, InfoRow } from '@/components/ui/info-list';
  import { Modal } from '@/components/ui/modal';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import api from '@/services/api';

  interface Organization {
    id: number;
    name: string;
    subscription_tier?: string;
    admin_price_cents?: number;
    max_seats?: number;
    monthly_credits?: number;
  }

  interface Props {
    show: boolean;
    organization: Organization | null;
  }

  interface Emits {
    (e: 'setup-complete'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const loading = ref(false);
  const error = ref<string | null>(null);

  const handleProceed = async () => {
    if (!props.organization?.id || loading.value) return;

    loading.value = true;
    error.value = null;

    try {
      const response = await api.post(`/organizations/${props.organization.id}/payments/stripe/setup`);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create payment session');
      }

      if (response.data.redirect_to) {
        // Free org — no payment needed, just mark complete
        await new Promise((resolve) => setTimeout(resolve, 500));
        emit('setup-complete');
        return;
      }

      if (response.data.url) {
        // Open Stripe in the system browser (keeps the Tauri window intact and
        // avoids the transparency rendering issue that occurs when navigating
        // the app's transparent WebView to an external URL).
        const orgId = props.organization!.id;

        const unlisten = await listen('stripe-payment-complete', async (event: any) => {
          unlisten();
          const sessionId: string | undefined = event.payload?.session_id;

          if (!event.payload?.success) {
            // User cancelled — reset so they can try again
            loading.value = false;
            return;
          }

          // Confirm the payment server-side using the session ID so the DB is
          // updated immediately, without waiting for the Stripe webhook (which
          // requires a forwarding tunnel in dev and can have delays in prod).
          if (sessionId) {
            try {
              await api.post(
                `/organizations/${orgId}/payments/stripe/confirm-setup`,
                { session_id: sessionId }
              );
            } catch (err) {
              console.warn('[OrgSetup] confirm-setup call failed, webhook will handle it:', err);
            }
          }

          loading.value = false;
          emit('setup-complete');
        });

        await invoke('open_stripe_payment_window', { checkoutUrl: response.data.url });
        // Button stays in loading state until stripe-payment-complete fires.
      }
    } catch (err) {
      console.error('Failed to open Stripe setup:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      loading.value = false;
    }
  };

  // Reset error when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        error.value = null;
      }
    }
  );
</script>
