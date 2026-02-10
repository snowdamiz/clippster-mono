<template>
  <PageLayout
    title="Affiliate Dashboard"
    description="Track your referrals, commissions, and payouts"
    :show-header="true"
    :icon="Handshake"
  >
    <div class="aff-dash">
      <!-- Loading -->
      <div v-if="loading" class="aff-dash__loading">
        <Loader2 class="aff-dash__loading-icon" />
        <p class="aff-dash__loading-text">Loading dashboard...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="aff-dash__error">
        <AlertTriangle class="aff-dash__error-icon" />
        <p class="aff-dash__error-text">{{ error }}</p>
      </div>

      <template v-else-if="affiliateInfo && dashboard">
        <!-- Referral Link -->
        <div class="aff-dash__link-card">
          <div class="aff-dash__link-header">
            <Link2 class="aff-dash__link-icon" />
            <span class="aff-dash__link-label">Your Referral Link</span>
            <span class="aff-dash__status" :class="`aff-dash__status--${affiliateInfo.status}`">{{ affiliateInfo.status }}</span>
          </div>
          <div class="aff-dash__link-row">
            <code class="aff-dash__link-url">{{ referralUrl }}</code>
            <button class="aff-dash__copy-btn" @click="copyLink">
              <Copy v-if="!copied" class="aff-dash__copy-icon" />
              <Check v-else class="aff-dash__copy-icon aff-dash__copy-icon--success" />
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="aff-dash__cards">
          <div class="aff-dash__card">
            <div class="aff-dash__card-header">
              <div class="aff-dash__card-icon aff-dash__card-icon--cyan">
                <TrendingUp class="aff-dash__card-icon-svg" />
              </div>
              <h3 class="aff-dash__card-label">This Month</h3>
            </div>
            <p class="aff-dash__card-value">${{ dashboard.this_month.total.toFixed(2) }}</p>
            <p class="aff-dash__card-sub">{{ dashboard.this_month.count }} referrals</p>
          </div>
          <div class="aff-dash__card">
            <div class="aff-dash__card-header">
              <div class="aff-dash__card-icon aff-dash__card-icon--green">
                <Calendar class="aff-dash__card-icon-svg" />
              </div>
              <h3 class="aff-dash__card-label">Last 3 Months</h3>
            </div>
            <p class="aff-dash__card-value">${{ dashboard.three_months.total.toFixed(2) }}</p>
            <p class="aff-dash__card-sub">{{ dashboard.three_months.count }} referrals</p>
          </div>
          <div class="aff-dash__card">
            <div class="aff-dash__card-header">
              <div class="aff-dash__card-icon aff-dash__card-icon--amber">
                <BarChart3 class="aff-dash__card-icon-svg" />
              </div>
              <h3 class="aff-dash__card-label">Year to Date</h3>
            </div>
            <p class="aff-dash__card-value">${{ dashboard.ytd.total.toFixed(2) }}</p>
            <p class="aff-dash__card-sub">{{ dashboard.ytd.count }} referrals</p>
          </div>
          <div class="aff-dash__card">
            <div class="aff-dash__card-header">
              <div class="aff-dash__card-icon aff-dash__card-icon--purple">
                <DollarSign class="aff-dash__card-icon-svg" />
              </div>
              <h3 class="aff-dash__card-label">All Time</h3>
            </div>
            <p class="aff-dash__card-value">${{ dashboard.all_time.total.toFixed(2) }}</p>
            <p class="aff-dash__card-sub">{{ dashboard.all_time.count }} referrals</p>
          </div>
        </div>

        <!-- Breakdown -->
        <div class="aff-dash__breakdown" v-if="Object.keys(dashboard.breakdown).length > 0">
          <h3 class="aff-dash__section-title">Commission Breakdown</h3>
          <div class="aff-dash__breakdown-cards">
            <div v-for="(data, type) in dashboard.breakdown" :key="type" class="aff-dash__breakdown-card">
              <span class="aff-dash__breakdown-type">{{ formatEventType(type as string) }}</span>
              <span class="aff-dash__breakdown-total">${{ data.total.toFixed(2) }}</span>
              <span class="aff-dash__breakdown-count">{{ data.count }} events</span>
            </div>
          </div>
        </div>

        <!-- Referrals Table -->
        <div class="aff-dash__section">
          <h3 class="aff-dash__section-title">Recent Referrals</h3>
          <div v-if="referrals.length > 0" class="aff-dash__table-wrapper">
            <table class="aff-dash__table">
              <thead>
                <tr>
                  <th class="aff-dash__th">Date</th>
                  <th class="aff-dash__th">Type</th>
                  <th class="aff-dash__th">Amount</th>
                  <th class="aff-dash__th">Commission</th>
                  <th class="aff-dash__th">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in referrals" :key="r.id" class="aff-dash__row">
                  <td class="aff-dash__td">{{ formatDate(r.inserted_at) }}</td>
                  <td class="aff-dash__td">
                    <span class="aff-dash__event-type">{{ formatEventType(r.event_type) }}</span>
                  </td>
                  <td class="aff-dash__td">${{ r.amount_usd.toFixed(2) }}</td>
                  <td class="aff-dash__td aff-dash__td--green">${{ r.commission_usd.toFixed(2) }}</td>
                  <td class="aff-dash__td">
                    <span class="aff-dash__ref-status" :class="`aff-dash__ref-status--${r.status}`">{{ r.status }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="aff-dash__empty-text">No referrals yet. Share your link to start earning!</p>
        </div>

        <!-- Payout History -->
        <div class="aff-dash__section">
          <h3 class="aff-dash__section-title">Payout History</h3>
          <div v-if="payouts.length > 0" class="aff-dash__table-wrapper">
            <table class="aff-dash__table">
              <thead>
                <tr>
                  <th class="aff-dash__th">Period</th>
                  <th class="aff-dash__th">Amount</th>
                  <th class="aff-dash__th">Method</th>
                  <th class="aff-dash__th">Status</th>
                  <th class="aff-dash__th">Paid</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in payouts" :key="p.id" class="aff-dash__row">
                  <td class="aff-dash__td">{{ p.period_month }}/{{ p.period_year }}</td>
                  <td class="aff-dash__td aff-dash__td--green">${{ p.amount_usd.toFixed(2) }}</td>
                  <td class="aff-dash__td">{{ p.payout_method }}</td>
                  <td class="aff-dash__td">
                    <span class="aff-dash__ref-status" :class="`aff-dash__ref-status--${p.status}`">{{ p.status }}</span>
                  </td>
                  <td class="aff-dash__td">{{ p.paid_at ? formatDate(p.paid_at) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="aff-dash__empty-text">No payouts yet.</p>
        </div>

        <!-- Payout Settings -->
        <div class="aff-dash__section">
          <h3 class="aff-dash__section-title">Payout Settings</h3>
          <div class="aff-dash__settings-card">
            <div class="aff-dash__form-group">
              <label class="aff-dash__label">Payout Method</label>
              <select v-model="settingsForm.payout_method" class="aff-dash__select">
                <option value="">Select method...</option>
                <option value="crypto">Crypto (Solana USDC)</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            <div class="aff-dash__form-group" v-if="settingsForm.payout_method === 'crypto'">
              <label class="aff-dash__label">Solana USDC Address</label>
              <input v-model="settingsForm.solana_usdc_address" type="text" class="aff-dash__input" placeholder="Enter your Solana USDC address" />
            </div>
            <div class="aff-dash__form-group" v-if="settingsForm.payout_method === 'paypal'">
              <label class="aff-dash__label">PayPal Email</label>
              <input v-model="settingsForm.paypal_email" type="email" class="aff-dash__input" placeholder="Enter your PayPal email" />
            </div>
            <button class="aff-dash__btn aff-dash__btn--primary" :disabled="savingSettings" @click="handleSaveSettings">
              <Loader2 v-if="savingSettings" class="aff-dash__btn-icon aff-dash__btn-icon--spin" />
              Save Settings
            </button>
          </div>
        </div>
      </template>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue';
  import {
    Handshake,
    Loader2,
    AlertTriangle,
    Link2,
    Copy,
    Check,
    TrendingUp,
    Calendar,
    BarChart3,
    DollarSign,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import {
    getMyDashboard,
    getMyReferrals,
    getMyPayouts,
    updateMySettings,
    type AffiliateDashboard,
    type AffiliateReferral,
    type AffiliatePayout,
  } from '@/services/affiliateApi';

  const loading = ref(true);
  const error = ref<string | null>(null);
  const copied = ref(false);
  const savingSettings = ref(false);

  const affiliateInfo = ref<{
    id: number;
    referral_code: string;
    status: string;
    payout_method: string | null;
    solana_usdc_address: string | null;
    paypal_email: string | null;
  } | null>(null);

  const dashboard = ref<AffiliateDashboard | null>(null);
  const referrals = ref<AffiliateReferral[]>([]);
  const payouts = ref<AffiliatePayout[]>([]);

  const settingsForm = reactive({
    payout_method: '',
    solana_usdc_address: '',
    paypal_email: '',
  });

  const referralUrl = computed(() => {
    if (!affiliateInfo.value) return '';
    return `https://clippster.app/?ref=${affiliateInfo.value.referral_code}`;
  });

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      const [dashResult, refResult, payResult] = await Promise.all([
        getMyDashboard(),
        getMyReferrals(),
        getMyPayouts(),
      ]);

      if (dashResult.success) {
        affiliateInfo.value = dashResult.affiliate!;
        dashboard.value = dashResult.dashboard!;
        settingsForm.payout_method = dashResult.affiliate?.payout_method || '';
        settingsForm.solana_usdc_address = dashResult.affiliate?.solana_usdc_address || '';
        settingsForm.paypal_email = dashResult.affiliate?.paypal_email || '';
      } else {
        error.value = dashResult.error || 'Failed to load dashboard';
      }

      if (refResult.success) referrals.value = refResult.referrals;
      if (payResult.success) payouts.value = payResult.payouts;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralUrl.value);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = referralUrl.value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    }
  }

  async function handleSaveSettings() {
    savingSettings.value = true;
    error.value = null;
    try {
      const result = await updateMySettings({
        payout_method: settingsForm.payout_method || undefined,
        solana_usdc_address: settingsForm.solana_usdc_address || undefined,
        paypal_email: settingsForm.paypal_email || undefined,
      });
      if (!result.success) error.value = result.error || 'Failed to save settings';
    } catch (e: any) {
      error.value = e.message;
    } finally {
      savingSettings.value = false;
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
    fetchAll();
  });
</script>

<style scoped>
  .aff-dash { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem; }

  .aff-dash__loading { display: flex; flex-direction: column; align-items: center; padding: 3rem; gap: 0.75rem; }
  .aff-dash__loading-icon { width: 2rem; height: 2rem; color: var(--color-muted-foreground); animation: spin 1s linear infinite; }
  .aff-dash__loading-text { font-size: 0.875rem; color: var(--color-muted-foreground); }

  .aff-dash__error { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); }
  .aff-dash__error-icon { width: 1rem; height: 1rem; color: #ef4444; flex-shrink: 0; }
  .aff-dash__error-text { font-size: 0.8125rem; color: #fca5a5; }

  /* Referral Link Card */
  .aff-dash__link-card {
    padding: 1.25rem; border-radius: 0.75rem;
    border: 1px solid rgba(168, 85, 247, 0.2);
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%);
  }
  .aff-dash__link-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .aff-dash__link-icon { width: 1.125rem; height: 1.125rem; color: #a855f7; }
  .aff-dash__link-label { font-size: 0.875rem; font-weight: 600; color: var(--color-foreground); }
  .aff-dash__link-row { display: flex; align-items: center; gap: 0.75rem; }
  .aff-dash__link-url {
    flex: 1; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem;
    background: rgba(0, 0, 0, 0.3); color: #a855f7; font-family: monospace;
    border: 1px solid rgba(255, 255, 255, 0.06); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .aff-dash__copy-btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500;
    background: #7c3aed; color: white; border: none; cursor: pointer; transition: opacity 0.15s; white-space: nowrap;
  }
  .aff-dash__copy-btn:hover { opacity: 0.9; }
  .aff-dash__copy-icon { width: 0.875rem; height: 0.875rem; }
  .aff-dash__copy-icon--success { color: #22c55e; }

  .aff-dash__status { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; margin-left: auto; }
  .aff-dash__status--active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-dash__status--suspended { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-dash__status--deactivated { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  /* Stats Cards */
  .aff-dash__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
  .aff-dash__card {
    padding: 1rem 1.25rem; border-radius: 0.75rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-card, rgba(255, 255, 255, 0.02));
  }
  .aff-dash__card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .aff-dash__card-icon { width: 1.75rem; height: 1.75rem; border-radius: 0.375rem; display: flex; align-items: center; justify-content: center; }
  .aff-dash__card-icon--cyan { background: rgba(34, 211, 238, 0.1); color: #22d3ee; }
  .aff-dash__card-icon--green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-dash__card-icon--amber { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-dash__card-icon--purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
  .aff-dash__card-icon-svg { width: 0.875rem; height: 0.875rem; }
  .aff-dash__card-label { font-size: 0.6875rem; font-weight: 500; color: var(--color-muted-foreground); }
  .aff-dash__card-value { font-size: 1.375rem; font-weight: 700; color: var(--color-foreground); }
  .aff-dash__card-sub { font-size: 0.6875rem; color: var(--color-muted-foreground); margin-top: 0.125rem; }

  /* Breakdown */
  .aff-dash__breakdown { display: flex; flex-direction: column; gap: 0.75rem; }
  .aff-dash__breakdown-cards { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .aff-dash__breakdown-card {
    display: flex; flex-direction: column; gap: 0.25rem;
    padding: 0.75rem 1rem; border-radius: 0.5rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-card, rgba(255, 255, 255, 0.02)); min-width: 140px;
  }
  .aff-dash__breakdown-type { font-size: 0.75rem; font-weight: 500; color: var(--color-muted-foreground); }
  .aff-dash__breakdown-total { font-size: 1.125rem; font-weight: 700; color: #22c55e; }
  .aff-dash__breakdown-count { font-size: 0.6875rem; color: var(--color-muted-foreground); }

  /* Sections */
  .aff-dash__section { display: flex; flex-direction: column; gap: 0.75rem; }
  .aff-dash__section-title { font-size: 1rem; font-weight: 600; color: var(--color-foreground); }

  /* Tables */
  .aff-dash__table-wrapper { border-radius: 0.75rem; border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08)); overflow-x: auto; }
  .aff-dash__table { width: 100%; border-collapse: collapse; }
  .aff-dash__th { padding: 0.625rem 0.75rem; text-align: left; font-size: 0.6875rem; font-weight: 600; color: var(--color-muted-foreground); text-transform: uppercase; letter-spacing: 0.05em; background: rgba(255, 255, 255, 0.02); white-space: nowrap; }
  .aff-dash__row { border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.06)); }
  .aff-dash__row:hover { background: rgba(255, 255, 255, 0.02); }
  .aff-dash__td { padding: 0.625rem 0.75rem; font-size: 0.8125rem; color: var(--color-foreground); white-space: nowrap; }
  .aff-dash__td--green { color: #22c55e; }

  .aff-dash__event-type { font-size: 0.75rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; background: rgba(255, 255, 255, 0.05); }

  .aff-dash__ref-status { display: inline-block; padding: 0.0625rem 0.375rem; border-radius: 9999px; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; }
  .aff-dash__ref-status--pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-dash__ref-status--confirmed { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
  .aff-dash__ref-status--paid { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-dash__ref-status--cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
  .aff-dash__ref-status--completed { background: rgba(34, 197, 94, 0.1); color: #22c55e; }

  .aff-dash__empty-text { font-size: 0.875rem; color: var(--color-muted-foreground); padding: 1rem 0; }

  /* Settings */
  .aff-dash__settings-card {
    display: flex; flex-direction: column; gap: 0.75rem;
    padding: 1.25rem; border-radius: 0.75rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-card, rgba(255, 255, 255, 0.02)); max-width: 28rem;
  }
  .aff-dash__form-group { display: flex; flex-direction: column; gap: 0.375rem; }
  .aff-dash__label { font-size: 0.75rem; font-weight: 500; color: var(--color-muted-foreground); }
  .aff-dash__input, .aff-dash__select {
    padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: rgba(255, 255, 255, 0.03); color: var(--color-foreground); outline: none;
  }
  .aff-dash__input:focus, .aff-dash__select:focus { border-color: #7c3aed; }
  .aff-dash__select option { background: #1a1a1a; color: #e5e5e5; }

  .aff-dash__btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500;
    cursor: pointer; transition: all 0.15s; border: none; width: fit-content;
  }
  .aff-dash__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .aff-dash__btn--primary { background: #7c3aed; color: white; }
  .aff-dash__btn--primary:hover { opacity: 0.9; }
  .aff-dash__btn-icon { width: 0.875rem; height: 0.875rem; }
  .aff-dash__btn-icon--spin { animation: spin 1s linear infinite; }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
