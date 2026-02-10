<template>
  <PageLayout
    title="Affiliate Detail"
    description="View and manage affiliate account"
    :show-header="true"
    :icon="Handshake"
    :breadcrumbs="[
      { label: 'Admin', path: '/admin' },
      { label: 'Affiliates', path: '/admin/affiliates' },
      { label: affiliate?.referral_code || 'Detail' },
    ]"
  >
    <template #actions>
      <div class="aff-detail-actions" v-if="affiliate">
        <button
          v-if="affiliate.status === 'active'"
          class="aff-detail__action-btn aff-detail__action-btn--danger"
          @click="handleDeactivate"
        >
          <Ban class="aff-detail__action-icon" />
          Deactivate
        </button>
        <button
          v-else
          class="aff-detail__action-btn aff-detail__action-btn--success"
          @click="handleActivate"
        >
          <Check class="aff-detail__action-icon" />
          Activate
        </button>
      </div>
    </template>

    <div class="aff-detail">
      <!-- Loading -->
      <div v-if="loading" class="aff-detail__loading">
        <Loader2 class="aff-detail__loading-icon" />
        <p>Loading affiliate...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="aff-detail__error">
        <AlertTriangle class="aff-detail__error-icon" />
        <p>{{ error }}</p>
        <button class="aff-detail__btn aff-detail__btn--secondary" @click="fetchAffiliate">Retry</button>
      </div>

      <template v-else-if="affiliate">
        <!-- Info + Settings -->
        <div class="aff-detail__grid">
          <!-- Left: Info Card -->
          <div class="aff-detail__card">
            <h3 class="aff-detail__card-title">Affiliate Info</h3>
            <div class="aff-detail__info-rows">
              <div class="aff-detail__info-row">
                <span class="aff-detail__info-label">User</span>
                <span class="aff-detail__info-value">{{ affiliate.user?.name || affiliate.user?.email || 'N/A' }} (#{{ affiliate.user?.id }})</span>
              </div>
              <div class="aff-detail__info-row">
                <span class="aff-detail__info-label">Referral Code</span>
                <code class="aff-detail__code">{{ affiliate.referral_code }}</code>
              </div>
              <div class="aff-detail__info-row">
                <span class="aff-detail__info-label">Status</span>
                <span class="aff-detail__status" :class="`aff-detail__status--${affiliate.status}`">{{ affiliate.status }}</span>
              </div>
              <div class="aff-detail__info-row">
                <span class="aff-detail__info-label">Payout Method</span>
                <span class="aff-detail__info-value">{{ affiliate.payout_method || 'Not set' }}</span>
              </div>
              <div class="aff-detail__info-row" v-if="affiliate.payout_method === 'crypto'">
                <span class="aff-detail__info-label">USDC Address</span>
                <span class="aff-detail__info-value aff-detail__info-value--mono">{{ affiliate.solana_usdc_address || 'Not set' }}</span>
              </div>
              <div class="aff-detail__info-row" v-if="affiliate.payout_method === 'paypal'">
                <span class="aff-detail__info-label">PayPal Email</span>
                <span class="aff-detail__info-value">{{ affiliate.paypal_email || 'Not set' }}</span>
              </div>
              <div class="aff-detail__info-row">
                <span class="aff-detail__info-label">Created</span>
                <span class="aff-detail__info-value">{{ formatDate(affiliate.inserted_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Commission Rates (Editable) -->
          <div class="aff-detail__card">
            <h3 class="aff-detail__card-title">Commission Rates</h3>
            <div class="aff-detail__form">
              <div class="aff-detail__form-group">
                <label class="aff-detail__label">Signup Commission %</label>
                <input v-model="editForm.signup_commission_pct" type="number" step="0.1" class="aff-detail__input" />
              </div>
              <div class="aff-detail__form-group">
                <label class="aff-detail__label">Recurring Commission %</label>
                <input v-model="editForm.recurring_commission_pct" type="number" step="0.1" class="aff-detail__input" />
              </div>
              <div class="aff-detail__form-group aff-detail__form-group--checkbox">
                <label class="aff-detail__checkbox-label">
                  <input v-model="editForm.credit_pack_commission_enabled" type="checkbox" class="aff-detail__checkbox" />
                  Enable Credit Pack Commission
                </label>
              </div>
              <div class="aff-detail__form-group" v-if="editForm.credit_pack_commission_enabled">
                <label class="aff-detail__label">Credit Pack Commission %</label>
                <input v-model="editForm.credit_pack_commission_pct" type="number" step="0.1" class="aff-detail__input" />
              </div>
              <div class="aff-detail__form-group">
                <label class="aff-detail__label">Notes</label>
                <textarea v-model="editForm.notes" class="aff-detail__textarea" rows="3"></textarea>
              </div>
              <button class="aff-detail__btn aff-detail__btn--primary" :disabled="saving" @click="handleSave">
                <Loader2 v-if="saving" class="aff-detail__btn-icon aff-detail__btn-icon--spin" />
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <!-- Referrals Table -->
        <div class="aff-detail__section">
          <h3 class="aff-detail__section-title">Referrals ({{ referrals.length }})</h3>
          <div v-if="referrals.length > 0" class="aff-detail__table-wrapper">
            <table class="aff-detail__table">
              <thead>
                <tr>
                  <th class="aff-detail__th">Date</th>
                  <th class="aff-detail__th">Type</th>
                  <th class="aff-detail__th">User</th>
                  <th class="aff-detail__th">Amount</th>
                  <th class="aff-detail__th">Rate</th>
                  <th class="aff-detail__th">Commission</th>
                  <th class="aff-detail__th">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in referrals" :key="r.id" class="aff-detail__row">
                  <td class="aff-detail__td">{{ formatDate(r.inserted_at) }}</td>
                  <td class="aff-detail__td">
                    <span class="aff-detail__event-type">{{ formatEventType(r.event_type) }}</span>
                  </td>
                  <td class="aff-detail__td">{{ r.referred_user?.email || r.referred_user?.name || 'N/A' }}</td>
                  <td class="aff-detail__td">${{ r.amount_usd.toFixed(2) }}</td>
                  <td class="aff-detail__td">{{ r.commission_pct }}%</td>
                  <td class="aff-detail__td aff-detail__td--green">${{ r.commission_usd.toFixed(2) }}</td>
                  <td class="aff-detail__td">
                    <span class="aff-detail__ref-status" :class="`aff-detail__ref-status--${r.status}`">{{ r.status }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="aff-detail__empty-text">No referrals yet.</p>
        </div>

        <!-- Payouts Table -->
        <div class="aff-detail__section">
          <h3 class="aff-detail__section-title">Payout History ({{ payouts.length }})</h3>
          <div v-if="payouts.length > 0" class="aff-detail__table-wrapper">
            <table class="aff-detail__table">
              <thead>
                <tr>
                  <th class="aff-detail__th">Period</th>
                  <th class="aff-detail__th">Amount</th>
                  <th class="aff-detail__th">Method</th>
                  <th class="aff-detail__th">Transaction ID</th>
                  <th class="aff-detail__th">Status</th>
                  <th class="aff-detail__th">Paid At</th>
                  <th class="aff-detail__th">Proof</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in payouts" :key="p.id" class="aff-detail__row">
                  <td class="aff-detail__td">{{ p.period_month }}/{{ p.period_year }}</td>
                  <td class="aff-detail__td aff-detail__td--green">${{ p.amount_usd.toFixed(2) }}</td>
                  <td class="aff-detail__td">{{ p.payout_method }}</td>
                  <td class="aff-detail__td aff-detail__td--mono">{{ p.transaction_id || '—' }}</td>
                  <td class="aff-detail__td">
                    <span class="aff-detail__ref-status" :class="`aff-detail__ref-status--${p.status}`">{{ p.status }}</span>
                  </td>
                  <td class="aff-detail__td">{{ p.paid_at ? formatDate(p.paid_at) : '—' }}</td>
                  <td class="aff-detail__td">
                    <a v-if="p.proof_screenshot_url" :href="p.proof_screenshot_url" target="_blank" class="aff-detail__proof-link">View</a>
                    <span v-else>—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="aff-detail__empty-text">No payouts yet.</p>
        </div>

        <!-- Record Payout Form -->
        <div class="aff-detail__section">
          <h3 class="aff-detail__section-title">Record Payout</h3>
          <div class="aff-detail__card">
            <div class="aff-detail__payout-form">
              <div class="aff-detail__form-row">
                <div class="aff-detail__form-group">
                  <label class="aff-detail__label">Period Month</label>
                  <input v-model="payoutForm.period_month" type="number" min="1" max="12" class="aff-detail__input" />
                </div>
                <div class="aff-detail__form-group">
                  <label class="aff-detail__label">Period Year</label>
                  <input v-model="payoutForm.period_year" type="number" min="2025" class="aff-detail__input" />
                </div>
              </div>
              <div class="aff-detail__form-group">
                <label class="aff-detail__label">Transaction ID</label>
                <input v-model="payoutForm.transaction_id" type="text" class="aff-detail__input" placeholder="Blockchain tx hash or PayPal ID" />
              </div>
              <div class="aff-detail__form-group">
                <label class="aff-detail__label">Proof Screenshot</label>
                <input type="file" accept="image/*" class="aff-detail__input" @change="handleScreenshotChange" />
              </div>
              <div class="aff-detail__form-group">
                <label class="aff-detail__label">Notes</label>
                <textarea v-model="payoutForm.notes" class="aff-detail__textarea" rows="2" placeholder="Optional notes..."></textarea>
              </div>
              <button class="aff-detail__btn aff-detail__btn--primary" :disabled="payingOut" @click="handleRecordPayout">
                <Loader2 v-if="payingOut" class="aff-detail__btn-icon aff-detail__btn-icon--spin" />
                Record Payout
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import {
    Handshake,
    Loader2,
    AlertTriangle,
    Ban,
    Check,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import {
    getAffiliate,
    updateAffiliate,
    deactivateAffiliate,
    activateAffiliate,
    recordPayout,
    type Affiliate,
    type AffiliateReferral,
    type AffiliatePayout,
  } from '@/services/affiliateApi';

  const route = useRoute();
  const affiliateId = Number(route.params.id);

  const loading = ref(true);
  const saving = ref(false);
  const payingOut = ref(false);
  const error = ref<string | null>(null);
  const affiliate = ref<Affiliate | null>(null);
  const referrals = ref<AffiliateReferral[]>([]);
  const payouts = ref<AffiliatePayout[]>([]);

  const editForm = reactive({
    signup_commission_pct: 0,
    recurring_commission_pct: 0,
    credit_pack_commission_enabled: false,
    credit_pack_commission_pct: 0,
    notes: '',
  });

  const now = new Date();
  const payoutForm = reactive({
    period_month: now.getMonth() === 0 ? 12 : now.getMonth(),
    period_year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    transaction_id: '',
    notes: '',
    screenshot: null as File | null,
  });

  async function fetchAffiliate() {
    loading.value = true;
    error.value = null;
    try {
      const result = await getAffiliate(affiliateId);
      if (result.success && result.affiliate) {
        affiliate.value = result.affiliate;
        referrals.value = result.referrals || [];
        payouts.value = result.payouts || [];
        editForm.signup_commission_pct = result.affiliate.signup_commission_pct;
        editForm.recurring_commission_pct = result.affiliate.recurring_commission_pct;
        editForm.credit_pack_commission_enabled = result.affiliate.credit_pack_commission_enabled;
        editForm.credit_pack_commission_pct = result.affiliate.credit_pack_commission_pct;
        editForm.notes = result.affiliate.notes || '';
      } else {
        error.value = result.error || 'Affiliate not found';
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function handleSave() {
    saving.value = true;
    error.value = null;
    try {
      const result = await updateAffiliate(affiliateId, {
        signup_commission_pct: editForm.signup_commission_pct,
        recurring_commission_pct: editForm.recurring_commission_pct,
        credit_pack_commission_enabled: editForm.credit_pack_commission_enabled,
        credit_pack_commission_pct: editForm.credit_pack_commission_pct,
        notes: editForm.notes,
      });
      if (!result.success) error.value = result.error || 'Failed to save';
      else await fetchAffiliate();
    } catch (e: any) {
      error.value = e.message;
    } finally {
      saving.value = false;
    }
  }

  async function handleDeactivate() {
    if (!confirm('Deactivate this affiliate?')) return;
    try {
      const result = await deactivateAffiliate(affiliateId);
      if (result.success) await fetchAffiliate();
      else error.value = result.error || 'Failed to deactivate';
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function handleActivate() {
    try {
      const result = await activateAffiliate(affiliateId);
      if (result.success) await fetchAffiliate();
      else error.value = result.error || 'Failed to activate';
    } catch (e: any) {
      error.value = e.message;
    }
  }

  function handleScreenshotChange(e: Event) {
    const target = e.target as HTMLInputElement;
    payoutForm.screenshot = target.files?.[0] || null;
  }

  async function handleRecordPayout() {
    payingOut.value = true;
    error.value = null;
    try {
      const result = await recordPayout(affiliateId, {
        period_month: payoutForm.period_month,
        period_year: payoutForm.period_year,
        transaction_id: payoutForm.transaction_id || undefined,
        notes: payoutForm.notes || undefined,
        screenshot: payoutForm.screenshot || undefined,
      });
      if (result.success) {
        payoutForm.transaction_id = '';
        payoutForm.notes = '';
        payoutForm.screenshot = null;
        await fetchAffiliate();
      } else {
        error.value = result.error || 'Failed to record payout';
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      payingOut.value = false;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatEventType(type: string) {
    const map: Record<string, string> = {
      first_subscription: 'Signup',
      recurring: 'Recurring',
      credit_pack: 'Credit Pack',
    };
    return map[type] || type;
  }

  onMounted(() => {
    fetchAffiliate();
  });
</script>

<style scoped>
  .aff-detail-actions { display: flex; gap: 0.5rem; }
  .aff-detail__action-btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: transparent; color: var(--color-foreground); cursor: pointer; transition: all 0.15s;
  }
  .aff-detail__action-btn--danger { border-color: rgba(239, 68, 68, 0.3); color: #ef4444; }
  .aff-detail__action-btn--danger:hover { background: rgba(239, 68, 68, 0.1); }
  .aff-detail__action-btn--success { border-color: rgba(34, 197, 94, 0.3); color: #22c55e; }
  .aff-detail__action-btn--success:hover { background: rgba(34, 197, 94, 0.1); }
  .aff-detail__action-icon { width: 1rem; height: 1rem; }

  .aff-detail { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem; }

  .aff-detail__loading, .aff-detail__error {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 3rem; gap: 0.75rem; color: var(--color-muted-foreground);
  }
  .aff-detail__loading-icon { width: 2rem; height: 2rem; animation: spin 1s linear infinite; }
  .aff-detail__error-icon { width: 2rem; height: 2rem; color: #ef4444; }

  .aff-detail__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 768px) { .aff-detail__grid { grid-template-columns: 1fr; } }

  .aff-detail__card {
    padding: 1.25rem; border-radius: 0.75rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-card, rgba(255, 255, 255, 0.02));
  }
  .aff-detail__card-title { font-size: 1rem; font-weight: 600; color: var(--color-foreground); margin-bottom: 1rem; }

  .aff-detail__info-rows { display: flex; flex-direction: column; gap: 0.625rem; }
  .aff-detail__info-row { display: flex; justify-content: space-between; align-items: center; }
  .aff-detail__info-label { font-size: 0.8125rem; color: var(--color-muted-foreground); }
  .aff-detail__info-value { font-size: 0.8125rem; color: var(--color-foreground); font-weight: 500; }
  .aff-detail__info-value--mono { font-family: monospace; font-size: 0.75rem; }

  .aff-detail__code { font-family: monospace; padding: 0.125rem 0.375rem; border-radius: 0.25rem; background: rgba(255, 255, 255, 0.05); color: #a855f7; font-size: 0.875rem; }

  .aff-detail__status { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; }
  .aff-detail__status--active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-detail__status--suspended { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-detail__status--deactivated { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  .aff-detail__form { display: flex; flex-direction: column; gap: 0.75rem; }
  .aff-detail__form-group { display: flex; flex-direction: column; gap: 0.375rem; }
  .aff-detail__form-group--checkbox { flex-direction: row; align-items: center; }
  .aff-detail__form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .aff-detail__label { font-size: 0.75rem; font-weight: 500; color: var(--color-muted-foreground); }
  .aff-detail__input {
    padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: rgba(255, 255, 255, 0.03); color: var(--color-foreground); outline: none;
  }
  .aff-detail__input:focus { border-color: #7c3aed; }
  .aff-detail__textarea {
    padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: rgba(255, 255, 255, 0.03); color: var(--color-foreground); outline: none;
    resize: vertical; font-family: inherit;
  }
  .aff-detail__checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; color: var(--color-foreground); cursor: pointer; }
  .aff-detail__checkbox { accent-color: #7c3aed; }

  .aff-detail__btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500;
    cursor: pointer; transition: all 0.15s; border: 1px solid transparent; width: fit-content;
  }
  .aff-detail__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .aff-detail__btn--primary { background: #7c3aed; color: white; }
  .aff-detail__btn--primary:hover { opacity: 0.9; }
  .aff-detail__btn--secondary { background: transparent; border-color: var(--color-border); color: var(--color-foreground); }
  .aff-detail__btn-icon { width: 0.875rem; height: 0.875rem; }
  .aff-detail__btn-icon--spin { animation: spin 1s linear infinite; }

  .aff-detail__section { display: flex; flex-direction: column; gap: 0.75rem; }
  .aff-detail__section-title { font-size: 1rem; font-weight: 600; color: var(--color-foreground); }

  .aff-detail__table-wrapper { border-radius: 0.75rem; border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08)); overflow-x: auto; }
  .aff-detail__table { width: 100%; border-collapse: collapse; }
  .aff-detail__th { padding: 0.625rem 0.75rem; text-align: left; font-size: 0.6875rem; font-weight: 600; color: var(--color-muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; background: rgba(255, 255, 255, 0.02); white-space: nowrap; }
  .aff-detail__row { border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.06)); }
  .aff-detail__row:hover { background: rgba(255, 255, 255, 0.02); }
  .aff-detail__td { padding: 0.625rem 0.75rem; font-size: 0.8125rem; color: var(--color-foreground); white-space: nowrap; }
  .aff-detail__td--green { color: #22c55e; }
  .aff-detail__td--mono { font-family: monospace; font-size: 0.75rem; }

  .aff-detail__event-type { font-size: 0.75rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; background: rgba(255, 255, 255, 0.05); }

  .aff-detail__ref-status { display: inline-block; padding: 0.0625rem 0.375rem; border-radius: 9999px; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; }
  .aff-detail__ref-status--pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-detail__ref-status--confirmed { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
  .aff-detail__ref-status--paid { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-detail__ref-status--cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
  .aff-detail__ref-status--completed { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-detail__ref-status--processing { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
  .aff-detail__ref-status--failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  .aff-detail__proof-link { color: #a855f7; text-decoration: none; font-size: 0.8125rem; }
  .aff-detail__proof-link:hover { text-decoration: underline; }

  .aff-detail__empty-text { font-size: 0.875rem; color: var(--color-muted-foreground); padding: 1rem 0; }

  .aff-detail__payout-form { display: flex; flex-direction: column; gap: 0.75rem; }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
