<template>
  <div class="admin-user-profile">
    <PageLayout
      :title="affiliate ? `Affiliate: ${affiliate.referral_code}` : 'Affiliate Detail'"
      description="Detailed affiliate information and management"
      :show-header="true"
      :show-back-button="true"
      :icon="Handshake"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Affiliates', path: '/admin/affiliates' }, { label: affiliate?.referral_code || 'Detail' }]"
    >
      <!-- Loading State -->
      <div v-if="loading" class="user-content user-content--loading">
        <div class="loading-spinner">
          <Loader2 class="loading-spinner__icon" />
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="user-content user-content--empty">
        <div class="empty-state">
          <div class="empty-state__icon-wrapper">
            <AlertTriangle class="empty-state__icon" />
          </div>
          <h3 class="empty-state__title">Failed to load affiliate</h3>
          <p class="empty-state__description">{{ error }}</p>
          <button class="btn-retry" @click="fetchAffiliate">Try Again</button>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else-if="affiliate" class="user-content">
        <!-- Affiliate Header -->
        <header class="user-header">
          <div class="user-header__main">
            <div class="user-avatar">
              <Handshake class="user-avatar__fallback" />
            </div>
            <div class="user-meta">
              <div class="user-meta__top">
                <h1 class="user-name">{{ affiliate.referral_code }}</h1>
                <span :class="['status-badge', `status-badge--${affiliate.status}`]">
                  {{ affiliate.status }}
                </span>
              </div>
              <p class="user-bio">{{ affiliate.user?.name || affiliate.user?.email || 'No user info' }}</p>
            </div>
          </div>
          <div class="user-stats">
            <div class="stat">
              <span class="stat__value">{{ referrals.length }}</span>
              <span class="stat__label">Referrals</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ formatDate(affiliate.inserted_at) }}</span>
              <span class="stat__label">Created</span>
            </div>
          </div>
        </header>

        <!-- Two Column Layout -->
        <div class="main-layout">
          <!-- Left Column -->
          <div class="main-column">
            <!-- Actions Section -->
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <Settings />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Affiliate Actions</h2>
                  <p class="section__subtitle">Manage affiliate status and settings</p>
                </div>
              </div>
              
              <!-- Status Group -->
              <div class="action-group">
                <div class="action-group__label">Status</div>
                <div class="action-group__buttons">
                  <button @click="handleActivate" v-if="affiliate.status !== 'active'" class="action-btn action-btn--success">
                    <Check :size="18" />
                    <span>Activate Affiliate</span>
                  </button>
                  <button @click="handleDeactivate" v-if="affiliate.status === 'active'" class="action-btn action-btn--warning">
                    <Ban :size="18" />
                    <span>Deactivate Affiliate</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- Commission Rates Section -->
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--green">
                  <DollarSign />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Commission Rates</h2>
                  <p class="section__subtitle">Configure affiliate earnings</p>
                </div>
              </div>
              
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Signup Commission %</label>
                  <input v-model="editForm.signup_commission_pct" type="number" step="0.1" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Recurring Commission %</label>
                  <input v-model="editForm.recurring_commission_pct" type="number" step="0.1" class="form-input" />
                </div>
                <div class="form-group form-group--full">
                  <label class="checkbox-label">
                    <input v-model="editForm.credit_pack_commission_enabled" type="checkbox" class="checkbox-input" />
                    Enable Credit Pack Commission
                  </label>
                </div>
                <div v-if="editForm.credit_pack_commission_enabled" class="form-group">
                  <label class="form-label">Credit Pack Commission %</label>
                  <input v-model="editForm.credit_pack_commission_pct" type="number" step="0.1" class="form-input" />
                </div>
                <div class="form-group form-group--full">
                  <label class="form-label">Notes</label>
                  <textarea v-model="editForm.notes" class="form-textarea" rows="3"></textarea>
                </div>
              </div>
              <button class="btn-primary" :disabled="saving" @click="handleSave">
                <Loader2 v-if="saving" class="btn-icon btn-icon--spin" />
                Save Changes
              </button>
            </section>

            <!-- User Discount Settings Section -->
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--purple">
                  <Percent />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">User Discount Settings</h2>
                  <p class="section__subtitle">Configure discounts for referred users</p>
                </div>
              </div>
              
              <div class="form-grid">
                <div class="form-group form-group--full">
                  <label class="checkbox-label">
                    <input v-model="editForm.discount_enabled" type="checkbox" class="checkbox-input" />
                    Enable Discount for Referred Users
                  </label>
                </div>
                
                <template v-if="editForm.discount_enabled">
                  <div class="form-group form-group--full">
                    <label class="form-label">Discount Type</label>
                    <div class="relative">
                      <button
                        @click="showDiscountTypeDropdown = !showDiscountTypeDropdown"
                        class="dropdown-select"
                      >
                        <span class="truncate">
                          {{ discountTypeLabel || 'Select type...' }}
                        </span>
                        <ChevronDown
                          class="dropdown-select__icon"
                          :class="{ 'dropdown-select__icon--open': showDiscountTypeDropdown }"
                        />
                      </button>

                      <div v-if="showDiscountTypeDropdown" class="dropdown-menu">
                        <button
                          @click="selectDiscountType('')"
                          class="dropdown-item"
                          :class="{ 'dropdown-item--selected': !editForm.discount_type }"
                        >
                          Select type...
                        </button>
                        <button
                          @click="selectDiscountType('one_time')"
                          class="dropdown-item"
                          :class="{ 'dropdown-item--selected': editForm.discount_type === 'one_time' }"
                        >
                          One-time (First month only)
                        </button>
                        <button
                          @click="selectDiscountType('recurring')"
                          class="dropdown-item"
                          :class="{ 'dropdown-item--selected': editForm.discount_type === 'recurring' }"
                        >
                          Recurring (Every month)
                        </button>
                        <button
                          @click="selectDiscountType('tiered')"
                          class="dropdown-item"
                          :class="{ 'dropdown-item--selected': editForm.discount_type === 'tiered' }"
                        >
                          Tiered (Different first & recurring)
                        </button>
                      </div>
                    </div>
                  </div>

                  <div v-if="editForm.discount_type === 'one_time' || editForm.discount_type === 'tiered'" class="form-group">
                    <label class="form-label">First Month Discount %</label>
                    <input v-model="editForm.first_month_discount_pct" type="number" step="0.1" min="0" max="100" class="form-input" placeholder="e.g., 10" />
                    <span class="form-help">Discount applied to the first month's subscription</span>
                  </div>

                  <div v-if="editForm.discount_type === 'recurring' || editForm.discount_type === 'tiered'" class="form-group">
                    <label class="form-label">Recurring Discount %</label>
                    <input v-model="editForm.recurring_discount_pct" type="number" step="0.1" min="0" max="100" class="form-input" placeholder="e.g., 5" />
                    <span class="form-help">
                      {{ editForm.discount_type === 'tiered' ? 'Discount applied to subsequent months' : 'Discount applied every month' }}
                    </span>
                  </div>

                  <div v-if="editForm.discount_type" class="form-group form-group--full">
                    <div class="discount-preview">
                      <h4 class="discount-preview__title">Preview</h4>
                      <div class="discount-preview__content">
                        <template v-if="editForm.discount_type === 'one_time'">
                          <p>✓ First month: <strong>{{ editForm.first_month_discount_pct || 0 }}% off</strong></p>
                          <p>• Subsequent months: <strong>Full price</strong></p>
                        </template>
                        <template v-else-if="editForm.discount_type === 'recurring'">
                          <p>✓ Every month: <strong>{{ editForm.recurring_discount_pct || 0 }}% off</strong></p>
                        </template>
                        <template v-else-if="editForm.discount_type === 'tiered'">
                          <p>✓ First month: <strong>{{ editForm.first_month_discount_pct || 0 }}% off</strong></p>
                          <p>✓ Subsequent months: <strong>{{ editForm.recurring_discount_pct || 0 }}% off</strong></p>
                        </template>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
              <button class="btn-primary" :disabled="saving" @click="handleSave">
                <Loader2 v-if="saving" class="btn-icon btn-icon--spin" />
                Save Changes
              </button>
            </section>

            <!-- Referrals Section -->
            <section v-if="referrals.length > 0" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--blue">
                  <Users />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Referrals</h2>
                  <p class="section__subtitle">{{ referrals.length }} total referrals</p>
                </div>
              </div>
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>User</th>
                      <th>Amount</th>
                      <th>Rate</th>
                      <th>Commission</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in referrals" :key="r.id">
                      <td>{{ formatDate(r.inserted_at) }}</td>
                      <td><span class="event-type">{{ formatEventType(r.event_type) }}</span></td>
                      <td>{{ r.referred_user?.email || r.referred_user?.name || 'N/A' }}</td>
                      <td>${{ r.amount_usd.toFixed(2) }}</td>
                      <td>{{ r.commission_pct }}%</td>
                      <td class="text-green">${{ r.commission_usd.toFixed(2) }}</td>
                      <td><span :class="['ref-status', `ref-status--${r.status}`]">{{ r.status }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <!-- Payouts Section -->
            <section v-if="payouts.length > 0" class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <CreditCard />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Payout History</h2>
                  <p class="section__subtitle">{{ payouts.length }} total payouts</p>
                </div>
              </div>
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Transaction ID</th>
                      <th>Status</th>
                      <th>Paid At</th>
                      <th>Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in payouts" :key="p.id">
                      <td>{{ p.period_month }}/{{ p.period_year }}</td>
                      <td class="text-green">${{ p.amount_usd.toFixed(2) }}</td>
                      <td>{{ p.payout_method }}</td>
                      <td class="text-mono">{{ p.transaction_id || '—' }}</td>
                      <td><span :class="['ref-status', `ref-status--${p.status}`]">{{ p.status }}</span></td>
                      <td>{{ p.paid_at ? formatDate(p.paid_at) : '—' }}</td>
                      <td>
                        <a v-if="p.proof_screenshot_url" :href="p.proof_screenshot_url" target="_blank" class="proof-link">View</a>
                        <span v-else>—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- Right Sidebar -->
          <aside class="sidebar-column">
            <!-- Payout Info Card -->
            <div class="sidebar-card">
              <div class="sidebar-card__header">
                <Wallet class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Payout Info</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="info-list">
                  <div class="info-list-item">
                    <div class="info-list-item__label">Method</div>
                    <div class="info-list-item__value">{{ affiliate.payout_method || 'Not set' }}</div>
                  </div>
                  <div v-if="affiliate.payout_method === 'crypto'" class="info-list-item">
                    <div class="info-list-item__label">USDC Address</div>
                    <div class="info-list-item__value info-list-item__value--mono">{{ affiliate.solana_usdc_address || 'Not set' }}</div>
                  </div>
                  <div v-if="affiliate.payout_method === 'paypal'" class="info-list-item">
                    <div class="info-list-item__label">PayPal Email</div>
                    <div class="info-list-item__value">{{ affiliate.paypal_email || 'Not set' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Details Card -->
            <div class="sidebar-card">
              <div class="sidebar-card__header">
                <Info class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Details</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="info-list">
                  <div class="info-list-item">
                    <div class="info-list-item__label">Affiliate ID</div>
                    <div class="info-list-item__value info-list-item__value--mono">{{ affiliate.id }}</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">User ID</div>
                    <div class="info-list-item__value info-list-item__value--mono">{{ affiliate.user?.id }}</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Created</div>
                    <div class="info-list-item__value">{{ formatFullDate(affiliate.inserted_at) }}</div>
                  </div>
                  <div v-if="affiliate.updated_at" class="info-list-item">
                    <div class="info-list-item__label">Last Updated</div>
                    <div class="info-list-item__value">{{ formatFullDate(affiliate.updated_at) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Record Payout Card -->
            <div class="sidebar-card">
              <div class="sidebar-card__header">
                <DollarSign class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Record Payout</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="form-grid">
                  <div class="form-group">
                    <label class="form-label">Period Month</label>
                    <input v-model="payoutForm.period_month" type="number" min="1" max="12" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Period Year</label>
                    <input v-model="payoutForm.period_year" type="number" min="2025" class="form-input" />
                  </div>
                  <div class="form-group form-group--full">
                    <label class="form-label">Manual Amount (USD)</label>
                    <input v-model="payoutForm.manual_amount" type="number" step="0.01" min="0" class="form-input" placeholder="Leave empty to use calculated amount" />
                    <span class="form-help">Only use this for testing or manual payouts without commissions</span>
                  </div>
                  <div class="form-group form-group--full">
                    <label class="form-label">Transaction ID</label>
                    <input v-model="payoutForm.transaction_id" type="text" class="form-input" placeholder="Blockchain tx hash or PayPal ID" />
                  </div>
                  <div class="form-group form-group--full">
                    <label class="form-label">Proof Screenshot</label>
                    <input type="file" accept="image/*" class="form-input" @change="handleScreenshotChange" />
                  </div>
                  <div class="form-group form-group--full">
                    <label class="form-label">Notes</label>
                    <textarea v-model="payoutForm.notes" class="form-textarea" rows="2" placeholder="Optional notes..."></textarea>
                  </div>
                </div>
                <button class="btn-primary" :disabled="payingOut" @click="handleRecordPayout">
                  <Loader2 v-if="payingOut" class="btn-icon btn-icon--spin" />
                  Record Payout
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, computed } from 'vue';
  import { useRoute } from 'vue-router';
  import { formatDate as fmtDate, formatDateTime } from '@/utils/dateTimeUtils';
  import {
    Handshake,
    Loader2,
    AlertTriangle,
    Ban,
    Check,
    DollarSign,
    Percent,
    Users,
    CreditCard,
    Wallet,
    Info,
    Settings,
    ChevronDown,
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
  const showDiscountTypeDropdown = ref(false);

  const editForm = reactive({
    signup_commission_pct: 0,
    recurring_commission_pct: 0,
    credit_pack_commission_enabled: false,
    credit_pack_commission_pct: 0,
    notes: '',
    discount_enabled: false,
    discount_type: '',
    first_month_discount_pct: 0,
    recurring_discount_pct: 0,
  });

  const now = new Date();
  const payoutForm = reactive({
    period_month: now.getMonth() === 0 ? 12 : now.getMonth(),
    period_year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    manual_amount: null as number | null,
    transaction_id: '',
    notes: '',
    screenshot: null as File | null,
  });

  const discountTypeLabel = computed(() => {
    const types: Record<string, string> = {
      one_time: 'One-time (First month only)',
      recurring: 'Recurring (Every month)',
      tiered: 'Tiered (Different first & recurring)',
    };
    return types[editForm.discount_type] || '';
  });

  function selectDiscountType(type: string) {
    editForm.discount_type = type;
    showDiscountTypeDropdown.value = false;
  }

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
        editForm.discount_enabled = result.affiliate.discount_enabled || false;
        editForm.discount_type = result.affiliate.discount_type || '';
        editForm.first_month_discount_pct = result.affiliate.first_month_discount_pct || 0;
        editForm.recurring_discount_pct = result.affiliate.recurring_discount_pct || 0;
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
        discount_enabled: editForm.discount_enabled,
        discount_type: editForm.discount_type,
        first_month_discount_pct: editForm.first_month_discount_pct,
        recurring_discount_pct: editForm.recurring_discount_pct,
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
        manual_amount: payoutForm.manual_amount || undefined,
        transaction_id: payoutForm.transaction_id || undefined,
        notes: payoutForm.notes || undefined,
        screenshot: payoutForm.screenshot || undefined,
      });
      if (result.success) {
        payoutForm.manual_amount = null;
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
    return fmtDate(dateStr);
  }

  function formatFullDate(dateStr: string) {
    return formatDateTime(dateStr);
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
/* ===== Base Styles from AdminUserProfile ===== */
.admin-user-profile {
  width: 100%;
  min-height: 100%;
}

.user-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.user-content--loading,
.user-content--empty {
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner__icon {
  width: 40px;
  height: 40px;
  color: var(--sidebar-text-muted);
  animation: spin 1s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-state__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background-color: var(--sidebar-hover);
  border-radius: 16px;
  margin-bottom: 1.5rem;
}

.empty-state__icon {
  width: 36px;
  height: 36px;
  color: var(--sidebar-text-muted);
}

.empty-state__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.empty-state__description {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 1.5rem;
  max-width: 320px;
  line-height: 1.5;
}

.user-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
}

@media (max-width: 640px) {
  .user-header {
    flex-direction: column;
  }
}

.user-header__main {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  flex: 1;
}

.user-avatar {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  background: var(--sidebar-surface);
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar__fallback {
  width: 100%;
  height: 100%;
  padding: 16px;
  color: var(--sidebar-text-muted);
}

.user-meta {
  flex: 1;
  min-width: 0;
}

.user-meta__top {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-bottom: 0.375rem;
}

.user-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge--active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-badge--suspended {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.status-badge--deactivated {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.user-bio {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
  max-width: 420px;
}

.user-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  text-align: center;
}

.stat__value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.stat__label {
  display: block;
  font-size: 0.5625rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
}

.main-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 1.25rem;
}

.section__header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1.25rem;
}

.section__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

.section__header-icon svg {
  width: 20px;
  height: 20px;
}

.section__header-text {
  flex: 1;
  min-width: 0;
}

.section__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.section__subtitle {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.1875rem 0 0;
}

.action-group {
  margin-bottom: 1.5rem;
}

.action-group:last-child {
  margin-bottom: 0;
}

.action-group__label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.action-group__buttons {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
  width: 100%;
  text-align: left;
}

.action-btn:hover:not(:disabled) {
  background: var(--sidebar-surface);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.action-btn svg {
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 150ms ease;
}

.action-btn:hover:not(:disabled) svg {
  opacity: 1;
}

.action-btn--success {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.action-btn--success:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
}

.action-btn--warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.action-btn--warning:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b;
}

/* Additional styles for dropdown matching ClipDetectionConfirmDialog */
.dropdown-select {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
}

.dropdown-select:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.dropdown-select__icon {
  width: 16px;
  height: 16px;
  transition: transform 150ms ease;
  flex-shrink: 0;
}

.dropdown-select__icon--open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
  max-height: 12rem;
  overflow-y: auto;
}

.dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: background-color 150ms ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.section__header-icon--green {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.section__header-icon--purple {
  background-color: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.section__header-icon--blue {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group--full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.form-input,
.form-textarea {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
  outline: none;
  transition: border-color 150ms ease;
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-help {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  margin-top: 0.125rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  cursor: pointer;
}

.checkbox-input {
  accent-color: var(--sidebar-accent);
}

.btn-primary,
.btn-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
  border: none;
  background: var(--sidebar-accent);
  color: var(--sidebar-bg);
  width: fit-content;
}

.btn-primary:hover,
.btn-retry:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.btn-icon--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.discount-preview {
  padding: 1rem;
  border-radius: 8px;
  background: rgba(168, 85, 247, 0.05);
  border: 1px solid rgba(168, 85, 247, 0.2);
}

.discount-preview__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.75rem;
}

.discount-preview__content p {
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  margin: 0.375rem 0;
  line-height: 1.5;
}

.discount-preview__content strong {
  color: #a855f7;
  font-weight: 600;
}

.data-table {
  border-radius: 10px;
  border: 1px solid var(--sidebar-border);
  overflow: hidden;
}

.data-table table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: var(--sidebar-hover);
}

.data-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.data-table tbody tr {
  border-top: 1px solid var(--sidebar-border);
  transition: background 150ms ease;
}

.data-table tbody tr:hover {
  background: var(--sidebar-hover);
}

.data-table td {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  white-space: nowrap;
}

.text-green {
  color: #22c55e;
}

.text-mono {
  font-family: monospace;
  font-size: 0.75rem;
}

.event-type {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  background: var(--sidebar-hover);
}

.ref-status {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.ref-status--pending {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.ref-status--confirmed {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.ref-status--paid,
.ref-status--completed {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.ref-status--cancelled,
.ref-status--failed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.ref-status--processing {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.proof-link {
  color: #a855f7;
  text-decoration: none;
  font-size: 0.8125rem;
}

.proof-link:hover {
  text-decoration: underline;
}

.sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1.5rem;
}

.sidebar-card {
  border-radius: 10px;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-surface);
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.sidebar-card__icon {
  width: 18px;
  height: 18px;
  color: var(--sidebar-text-muted);
  flex-shrink: 0;
}

.sidebar-card__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.sidebar-card__content {
  padding: 1.25rem;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.info-list-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-list-item__label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-list-item__value {
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  font-weight: 500;
  word-break: break-word;
}

.info-list-item__value--mono {
  font-family: monospace;
  font-size: 0.75rem;
}
</style>
