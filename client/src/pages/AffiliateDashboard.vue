<template>
  <PageLayout
    title="Affiliate Dashboard"
    description="Track your referrals, commissions, and payouts"
    :show-header="true"
    :icon="Handshake"
  >
    <div class="aff-dash">
      <!-- Loading -->
      <div v-if="loading" class="loading-rows">
        <div v-for="i in 3" :key="i" class="skeleton-row skeleton-row--lg"></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="aff-dash__error">
        <AlertTriangle class="aff-dash__error-icon" />
        <p class="aff-dash__error-text">{{ error }}</p>
      </div>

      <template v-else-if="affiliateInfo && dashboard">
        <!-- Sign-up Stats -->
        <div class="posts-stats-grid" v-if="dashboard && dashboard.breakdown">
          <div class="posts-stat-card posts-stat-card--cyan">
            <div class="posts-stat-card__icon"><UserPlus /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">{{ dashboard.breakdown.first_subscription?.count || 0 }}</span>
              <span class="posts-stat-card__label">First-time Sign-ups</span>
            </div>
          </div>
          <div class="posts-stat-card posts-stat-card--purple">
            <div class="posts-stat-card__icon"><RefreshCw /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">{{ dashboard.breakdown.recurring?.count || 0 }}</span>
              <span class="posts-stat-card__label">Recurring Sign-ups</span>
            </div>
          </div>
          <div class="posts-stat-card posts-stat-card--green">
            <div class="posts-stat-card__icon"><TrendingUp /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">{{ getTotalSignups() }}</span>
              <span class="posts-stat-card__label">Total Sign-ups</span>
            </div>
          </div>
        </div>

        <!-- Referral Code -->
        <div class="aff-tab__link-card">
          <div class="aff-tab__link-header">
            <Hash class="aff-tab__link-icon" />
            <span class="aff-tab__link-label">Your Referral Code</span>
            <span class="aff-tab__status" :class="`aff-tab__status--${affiliateInfo.status}`">{{ affiliateInfo.status }}</span>
          </div>
          <div class="aff-tab__link-row">
            <code class="aff-tab__link-url">{{ affiliateInfo.referral_code }}</code>
            <button class="aff-tab__copy-btn" @click="copyCode">
              <Copy v-if="!copied" :size="14" />
              <Check v-else :size="14" class="aff-tab__copy-ok" />
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>

        <!-- Stats -->
        <div class="posts-stats-grid">
          <div class="posts-stat-card posts-stat-card--cyan">
            <div class="posts-stat-card__icon"><TrendingUp /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">${{ dashboard.this_month.total.toFixed(2) }}</span>
              <span class="posts-stat-card__label">This Month</span>
            </div>
          </div>
          <div class="posts-stat-card posts-stat-card--purple">
            <div class="posts-stat-card__icon"><BarChart3 /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">${{ dashboard.three_months.total.toFixed(2) }}</span>
              <span class="posts-stat-card__label">Last 3 Months</span>
            </div>
          </div>
          <div class="posts-stat-card posts-stat-card--pink">
            <div class="posts-stat-card__icon"><Heart /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">${{ dashboard.ytd.total.toFixed(2) }}</span>
              <span class="posts-stat-card__label">Year to Date</span>
            </div>
          </div>
          <div class="posts-stat-card posts-stat-card--green">
            <div class="posts-stat-card__icon"><DollarSign /></div>
            <div class="posts-stat-card__content">
              <span class="posts-stat-card__value">${{ dashboard.all_time.total.toFixed(2) }}</span>
              <span class="posts-stat-card__label">All Time</span>
            </div>
          </div>
        </div>

        <!-- Recent Referrals -->
        <section class="section section-card">
          <div class="section__header">
            <div class="section__header-icon section__header-icon--cyan"><Handshake /></div>
            <div class="section__header-text">
              <h2 class="section-title">Recent Referrals</h2>
              <p class="section-subtitle">Commission earned from referred users</p>
            </div>
          </div>
          <div v-if="referrals.length === 0" class="empty-state">
            <Handshake class="empty-state__icon" />
            <p class="empty-state__title">No referrals yet</p>
            <p class="empty-state__text">Share your code to start earning commissions</p>
          </div>
          <div v-else class="aff-tab__table-wrapper">
            <table class="aff-tab__table">
              <thead>
                <tr>
                  <th class="aff-tab__th">Date</th>
                  <th class="aff-tab__th">Type</th>
                  <th class="aff-tab__th">Amount</th>
                  <th class="aff-tab__th">Commission</th>
                  <th class="aff-tab__th">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in referrals" :key="r.id" class="aff-tab__row">
                  <td class="aff-tab__td">{{ formatDate(r.inserted_at) }}</td>
                  <td class="aff-tab__td"><span class="aff-tab__event-badge">{{ formatEventType(r.event_type) }}</span></td>
                  <td class="aff-tab__td">${{ r.amount_usd.toFixed(2) }}</td>
                  <td class="aff-tab__td aff-tab__td--green">${{ r.commission_usd.toFixed(2) }}</td>
                  <td class="aff-tab__td"><span class="aff-tab__ref-status" :class="`aff-tab__ref-status--${r.status}`">{{ r.status }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Payout History -->
        <section class="section section-card" v-if="payouts.length > 0">
          <div class="section__header">
            <div class="section__header-icon section__header-icon--green"><DollarSign /></div>
            <div class="section__header-text">
              <h2 class="section-title">Payout History</h2>
              <p class="section-subtitle">Your commission payouts</p>
            </div>
          </div>
          <div class="aff-tab__table-wrapper">
            <table class="aff-tab__table">
              <thead>
                <tr>
                  <th class="aff-tab__th">Period</th>
                  <th class="aff-tab__th">Amount</th>
                  <th class="aff-tab__th">Method</th>
                  <th class="aff-tab__th">Status</th>
                  <th class="aff-tab__th">Paid</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in payouts" :key="p.id" class="aff-tab__row">
                  <td class="aff-tab__td">{{ p.period_month }}/{{ p.period_year }}</td>
                  <td class="aff-tab__td aff-tab__td--green">${{ p.amount_usd.toFixed(2) }}</td>
                  <td class="aff-tab__td">{{ p.payout_method }}</td>
                  <td class="aff-tab__td"><span class="aff-tab__ref-status" :class="`aff-tab__ref-status--${p.status}`">{{ p.status }}</span></td>
                  <td class="aff-tab__td">{{ p.paid_at ? formatDate(p.paid_at) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Payout Settings -->
        <section class="section section-card">
          <div class="section__header">
            <div class="section__header-icon section__header-icon--green"><Wallet /></div>
            <div class="section__header-text">
              <h2 class="section-title">Payout Settings</h2>
              <p class="section-subtitle">Configure how you receive commissions</p>
            </div>
          </div>
          <div class="aff-tab__settings">
            <div class="aff-tab__field">
              <label class="aff-tab__label">Payout Method</label>
              <select v-model="settingsForm.payout_method" class="aff-tab__input">
                <option value="">Select method...</option>
                <option value="crypto">Crypto (Solana USDC)</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            <div v-if="settingsForm.payout_method === 'crypto'" class="aff-tab__field">
              <label class="aff-tab__label">Solana USDC Address</label>
              <input v-model="settingsForm.solana_usdc_address" type="text" class="aff-tab__input" placeholder="Enter your Solana USDC address" />
            </div>
            <div v-if="settingsForm.payout_method === 'paypal'" class="aff-tab__field">
              <label class="aff-tab__label">PayPal Email</label>
              <input v-model="settingsForm.paypal_email" type="email" class="aff-tab__input" placeholder="Enter your PayPal email" />
            </div>
            <button class="aff-tab__save-btn" :disabled="savingSettings" @click="handleSaveSettings">
              <Loader2 v-if="savingSettings" :size="14" class="animate-spin" />
              Save Settings
            </button>
          </div>
        </section>
      </template>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Handshake,
    Loader2,
    AlertTriangle,
    Hash,
    Copy,
    Check,
    TrendingUp,
    BarChart3,
    DollarSign,
    UserPlus,
    RefreshCw,
    Heart,
    Wallet,
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

  async function copyCode() {
    if (!affiliateInfo.value) return;
    const code = affiliateInfo.value.referral_code;
    try {
      await navigator.clipboard.writeText(code);
      copied.value = true;
      setTimeout(() => { copied.value = false; }, 2000);
    } catch {
      const input = document.createElement('input');
      input.value = code;
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

  function getTotalSignups() {
    if (!dashboard.value?.breakdown) return 0;
    const firstTime = dashboard.value.breakdown.first_subscription?.count || 0;
    const recurring = dashboard.value.breakdown.recurring?.count || 0;
    return firstTime + recurring;
  }

  function formatDate(dateStr: string) {
    return fmtDate(dateStr);
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

  .aff-dash__error { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); }
  .aff-dash__error-icon { width: 1rem; height: 1rem; color: #ef4444; flex-shrink: 0; }
  .aff-dash__error-text { font-size: 0.8125rem; color: #fca5a5; }

  .loading-rows { display: flex; flex-direction: column; gap: 0.75rem; }
  .skeleton-row { height: 2.5rem; border-radius: 8px; background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
  .skeleton-row--lg { height: 4rem; }

  /* Referral Code Card */
  .aff-tab__link-card {
    padding: 1.25rem; border-radius: 10px;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background: var(--sidebar-hover, rgba(255, 255, 255, 0.02));
  }
  .aff-tab__link-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
  .aff-tab__link-icon { width: 18px; height: 18px; color: #a855f7; }
  .aff-tab__link-label { font-size: 0.875rem; font-weight: 600; color: var(--sidebar-text, var(--color-foreground)); }
  .aff-tab__status {
    display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px;
    font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; margin-left: auto;
  }
  .aff-tab__status--active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-tab__status--suspended { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-tab__status--deactivated { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
  .aff-tab__link-row { display: flex; align-items: center; gap: 0.75rem; }
  .aff-tab__link-url {
    flex: 1; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8125rem;
    background: rgba(0, 0, 0, 0.3); color: #a855f7; font-family: monospace;
    border: 1px solid rgba(255, 255, 255, 0.06); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .aff-tab__copy-btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;
    background: #7c3aed; color: white; border: none; cursor: pointer; transition: opacity 0.15s; white-space: nowrap;
  }
  .aff-tab__copy-btn:hover { opacity: 0.9; }
  .aff-tab__copy-ok { color: #22c55e; }

  /* Posts Stats Grid */
  .posts-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }
  .posts-stat-card {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 1rem 1.25rem; border-radius: 10px;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background: var(--sidebar-hover, rgba(255, 255, 255, 0.02));
  }
  .posts-stat-card__icon {
    width: 2.25rem; height: 2.25rem; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .posts-stat-card__icon svg { width: 1.125rem; height: 1.125rem; }
  .posts-stat-card__content { flex: 1; }
  .posts-stat-card__value { display: block; font-size: 1.25rem; font-weight: 700; color: var(--sidebar-text, var(--color-foreground)); }
  .posts-stat-card__label { display: block; font-size: 0.6875rem; color: var(--sidebar-text-muted, var(--color-muted-foreground)); margin-top: 0.125rem; }
  .posts-stat-card--cyan .posts-stat-card__icon { background: rgba(34, 211, 238, 0.1); color: #22d3ee; }
  .posts-stat-card--purple .posts-stat-card__icon { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
  .posts-stat-card--pink .posts-stat-card__icon { background: rgba(236, 72, 153, 0.1); color: #ec4899; }
  .posts-stat-card--green .posts-stat-card__icon { background: rgba(34, 197, 94, 0.1); color: #22c55e; }

  /* Sections */
  .section { display: flex; flex-direction: column; gap: 1rem; }
  .section-card {
    padding: 1.25rem; border-radius: 10px;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background: var(--sidebar-hover, rgba(255, 255, 255, 0.02));
  }
  .section__header { display: flex; align-items: center; gap: 0.75rem; }
  .section__header-icon {
    width: 2.25rem; height: 2.25rem; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    background: rgba(34, 211, 238, 0.1); color: #22d3ee;
  }
  .section__header-icon svg { width: 1.125rem; height: 1.125rem; }
  .section__header-icon--cyan { background: rgba(34, 211, 238, 0.1); color: #22d3ee; }
  .section__header-icon--green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .section__header-text { flex: 1; }
  .section-title { font-size: 1rem; font-weight: 600; color: var(--sidebar-text, var(--color-foreground)); }
  .section-subtitle { font-size: 0.75rem; color: var(--sidebar-text-muted, var(--color-muted-foreground)); margin-top: 0.125rem; }

  /* Empty State */
  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 2rem 1rem; gap: 0.5rem;
  }
  .empty-state__icon { width: 2.5rem; height: 2.5rem; color: var(--sidebar-text-muted, var(--color-muted-foreground)); opacity: 0.4; }
  .empty-state__title { font-size: 0.875rem; font-weight: 600; color: var(--sidebar-text, var(--color-foreground)); }
  .empty-state__text { font-size: 0.8125rem; color: var(--sidebar-text-muted, var(--color-muted-foreground)); }

  /* Tables */
  .aff-tab__table-wrapper { border-radius: 10px; border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08)); overflow-x: auto; }
  .aff-tab__table { width: 100%; border-collapse: collapse; }
  .aff-tab__th {
    padding: 0.625rem 0.875rem; text-align: left; font-size: 0.6875rem; font-weight: 600;
    color: var(--sidebar-text-muted, var(--color-muted-foreground)); text-transform: uppercase;
    letter-spacing: 0.05em; background: rgba(255, 255, 255, 0.02); white-space: nowrap;
  }
  .aff-tab__row { border-top: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.06)); transition: background 0.15s; }
  .aff-tab__row:hover { background: var(--sidebar-hover, rgba(255, 255, 255, 0.02)); }
  .aff-tab__td { padding: 0.625rem 0.875rem; font-size: 0.8125rem; color: var(--sidebar-text, var(--color-foreground)); white-space: nowrap; }
  .aff-tab__td--green { color: #22c55e; }
  .aff-tab__event-badge { font-size: 0.75rem; padding: 0.125rem 0.375rem; border-radius: 4px; background: rgba(255, 255, 255, 0.05); }
  .aff-tab__ref-status { display: inline-block; padding: 0.0625rem 0.375rem; border-radius: 9999px; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; }
  .aff-tab__ref-status--pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-tab__ref-status--confirmed { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
  .aff-tab__ref-status--paid { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-tab__ref-status--cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
  .aff-tab__ref-status--completed { background: rgba(34, 197, 94, 0.1); color: #22c55e; }

  /* Settings */
  .aff-tab__settings { display: flex; flex-direction: column; gap: 0.75rem; max-width: 400px; }
  .aff-tab__field { display: flex; flex-direction: column; gap: 0.375rem; }
  .aff-tab__label { font-size: 0.8125rem; font-weight: 500; color: var(--sidebar-text-muted, var(--color-muted-foreground)); }
  .aff-tab__input {
    padding: 0.625rem 0.875rem; font-size: 0.875rem;
    background-color: var(--sidebar-hover, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    border-radius: 8px; color: var(--sidebar-text, var(--color-foreground)); outline: none;
    transition: border-color 150ms ease;
  }
  .aff-tab__input:focus { border-color: #a855f7; box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15); }
  .aff-tab__input option { background: #1a1a1a; color: #e5e5e5; }
  .aff-tab__save-btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
    background: #7c3aed; color: white; border: none; cursor: pointer;
    transition: opacity 0.15s; width: fit-content;
  }
  .aff-tab__save-btn:hover { opacity: 0.9; }
  .aff-tab__save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .animate-spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
