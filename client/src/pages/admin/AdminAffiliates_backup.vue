<template>
  <PageLayout
    title="Affiliates"
    description="Manage affiliate accounts and commissions"
    :show-header="true"
    :icon="Handshake"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Affiliates' }]"
  >
    <template #actions>
      <div class="aff-header-actions">
        <button class="aff-header__action-btn" :disabled="loading" @click="fetchAffiliates">
          <RefreshCw v-if="!loading" class="aff-header__action-icon" />
          <Loader2 v-else class="aff-header__action-icon aff-header__action-icon--spin" />
          Refresh
        </button>
        <button class="aff-header__action-btn aff-header__action-btn--primary" @click="showCreateModal = true">
          <Plus class="aff-header__action-icon" />
          New Affiliate
        </button>
      </div>
    </template>

    <div class="admin-aff">
      <!-- Page Heading -->
      <div class="admin-aff__heading">
        <h1 class="admin-aff__title">Affiliates</h1>
        <p class="admin-aff__subtitle">Manage affiliate accounts, commissions, and payouts</p>
      </div>

      <!-- Stats Cards -->
      <div class="admin-aff__cards" v-if="overview">
        <div class="admin-aff__card">
          <div class="admin-aff__card-header">
            <div class="admin-aff__card-icon admin-aff__card-icon--cyan">
              <Users class="admin-aff__card-icon-svg" />
            </div>
            <h3 class="admin-aff__card-label">Total Affiliates</h3>
          </div>
          <p class="admin-aff__card-value">{{ overview.total_affiliates }}</p>
        </div>
        <div class="admin-aff__card">
          <div class="admin-aff__card-header">
            <div class="admin-aff__card-icon admin-aff__card-icon--green">
              <UserCheck class="admin-aff__card-icon-svg" />
            </div>
            <h3 class="admin-aff__card-label">Active</h3>
          </div>
          <p class="admin-aff__card-value admin-aff__card-value--green">{{ overview.active_affiliates }}</p>
        </div>
        <div class="admin-aff__card">
          <div class="admin-aff__card-header">
            <div class="admin-aff__card-icon admin-aff__card-icon--amber">
              <DollarSign class="admin-aff__card-icon-svg" />
            </div>
            <h3 class="admin-aff__card-label">Total Commission</h3>
          </div>
          <p class="admin-aff__card-value admin-aff__card-value--amber">${{ overview.total_commission.toFixed(2) }}</p>
        </div>
        <div class="admin-aff__card">
          <div class="admin-aff__card-header">
            <div class="admin-aff__card-icon admin-aff__card-icon--purple">
              <Clock class="admin-aff__card-icon-svg" />
            </div>
            <h3 class="admin-aff__card-label">Pending Payout</h3>
          </div>
          <p class="admin-aff__card-value admin-aff__card-value--purple">${{ overview.total_pending.toFixed(2) }}</p>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="admin-aff__error">
        <AlertTriangle class="admin-aff__error-icon" />
        <p class="admin-aff__error-text">{{ error }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !affiliates.length" class="admin-aff__loading">
        <Loader2 class="admin-aff__loading-icon" />
        <p class="admin-aff__loading-text">Loading affiliates...</p>
      </div>

      <!-- Affiliates Table -->
      <div v-else-if="affiliates.length > 0" class="admin-aff__table-wrapper">
        <div class="admin-aff__table-scroll">
          <table class="admin-aff__table">
            <thead class="admin-aff__thead">
              <tr>
                <th class="admin-aff__th">User</th>
                <th class="admin-aff__th">Code</th>
                <th class="admin-aff__th">Rates</th>
                <th class="admin-aff__th">Referrals</th>
                <th class="admin-aff__th">Earned</th>
                <th class="admin-aff__th">Pending</th>
                <th class="admin-aff__th">Status</th>
                <th class="admin-aff__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-aff__tbody">
              <tr v-for="aff in affiliates" :key="aff.id" class="admin-aff__row">
                <td class="admin-aff__td">
                  <div class="admin-aff__user">
                    <span class="admin-aff__user-name">{{ aff.user?.name || aff.user?.email || 'Unknown' }}</span>
                    <span class="admin-aff__user-id">#{{ aff.user?.id }}</span>
                  </div>
                </td>
                <td class="admin-aff__td">
                  <code class="admin-aff__code">{{ aff.referral_code }}</code>
                </td>
                <td class="admin-aff__td">
                  <div class="admin-aff__rates">
                    <span>{{ aff.signup_commission_pct }}% signup</span>
                    <span>{{ aff.recurring_commission_pct }}% recurring</span>
                    <span v-if="aff.credit_pack_commission_enabled">{{ aff.credit_pack_commission_pct }}% credits</span>
                  </div>
                </td>
                <td class="admin-aff__td">{{ aff.stats?.total_referrals || 0 }}</td>
                <td class="admin-aff__td admin-aff__td--green">${{ (aff.stats?.total_earned || 0).toFixed(2) }}</td>
                <td class="admin-aff__td admin-aff__td--amber">${{ (aff.stats?.total_pending || 0).toFixed(2) }}</td>
                <td class="admin-aff__td">
                  <span
                    class="admin-aff__status"
                    :class="{
                      'admin-aff__status--active': aff.status === 'active',
                      'admin-aff__status--suspended': aff.status === 'suspended',
                      'admin-aff__status--deactivated': aff.status === 'deactivated',
                    }"
                  >
                    {{ aff.status }}
                  </span>
                </td>
                <td class="admin-aff__td">
                  <router-link :to="`/admin/affiliates/${aff.id}`" class="admin-aff__view-btn">
                    View
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-aff__empty">
        <Handshake class="admin-aff__empty-icon" />
        <h3 class="admin-aff__empty-title">No affiliates yet</h3>
        <p class="admin-aff__empty-text">Create your first affiliate to start tracking referrals.</p>
        <button class="aff-header__action-btn aff-header__action-btn--primary" @click="showCreateModal = true">
          <Plus class="aff-header__action-icon" />
          Create Affiliate
        </button>
      </div>
    </div>

    <!-- Create Affiliate Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateModal" class="create-aff__overlay" @click.self="showCreateModal = false" @keydown.esc="showCreateModal = false">
          <Transition name="dialog" appear>
            <div v-if="showCreateModal" class="create-aff" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="create-aff__accent"></div>

              <!-- Header -->
              <div class="create-aff__header">
                <button class="create-aff__close" @click="showCreateModal = false" title="Close">
                  <X :size="18" />
                </button>
                <div class="create-aff__icon">
                  <Handshake :size="24" />
                </div>
                <h2 class="create-aff__title">Create Affiliate</h2>
                <p class="create-aff__subtitle">Set up a new affiliate partner with referral tracking</p>
              </div>

              <!-- Content -->
              <div class="create-aff__content">
                <div class="create-aff__form">
                  <div class="create-aff__field">
                    <label class="create-aff__label">User Account</label>
                    <div class="create-aff__search-wrapper">
                      <input
                        v-model="userSearch"
                        type="text"
                        class="create-aff__input"
                        placeholder="Search by email..."
                        @input="filterUsers"
                        @focus="showUserDropdown = true"
                      />
                      <div v-if="showUserDropdown && filteredUsers.length > 0" class="create-aff__user-dropdown">
                        <button
                          v-for="u in filteredUsers"
                          :key="u.id"
                          class="create-aff__user-option"
                          @click="selectUser(u)"
                        >
                          <span class="create-aff__user-option-email">{{ u.email || u.wallet_address || 'No email' }}</span>
                          <span class="create-aff__user-option-id">#{{ u.id }}</span>
                        </button>
                      </div>
                    </div>
                    <div v-if="selectedUser" class="create-aff__selected-user">
                      <span>{{ selectedUser.email || selectedUser.wallet_address }}</span>
                      <button class="create-aff__selected-clear" @click="clearSelectedUser">
                        <X :size="14" />
                      </button>
                    </div>
                  </div>

                  <div class="create-aff__field">
                    <label class="create-aff__label">Referral Code</label>
                    <input v-model="createForm.referral_code" type="text" class="create-aff__input" placeholder="e.g. STREAMER_NAME" />
                  </div>

                  <div class="create-aff__field-row">
                    <div class="create-aff__field">
                      <label class="create-aff__label">Signup Commission %</label>
                      <input v-model="createForm.signup_commission_pct" type="number" step="0.1" class="create-aff__input" placeholder="20" />
                    </div>
                    <div class="create-aff__field">
                      <label class="create-aff__label">Recurring Commission %</label>
                      <input v-model="createForm.recurring_commission_pct" type="number" step="0.1" class="create-aff__input" placeholder="10" />
                    </div>
                  </div>

                  <div class="create-aff__field">
                    <label class="create-aff__checkbox-label">
                      <input v-model="createForm.credit_pack_commission_enabled" type="checkbox" class="create-aff__checkbox" />
                      Enable Credit Pack Commission
                    </label>
                  </div>

                  <div v-if="createForm.credit_pack_commission_enabled" class="create-aff__field">
                    <label class="create-aff__label">Credit Pack Commission %</label>
                    <input v-model="createForm.credit_pack_commission_pct" type="number" step="0.1" class="create-aff__input" placeholder="5" />
                  </div>

                  <div class="create-aff__field">
                    <label class="create-aff__label">Notes</label>
                    <textarea v-model="createForm.notes" class="create-aff__input create-aff__input--textarea" placeholder="Optional notes..." rows="3"></textarea>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="create-aff__footer">
                <button class="create-aff__btn create-aff__btn--secondary" @click="showCreateModal = false">Cancel</button>
                <button class="create-aff__btn create-aff__btn--primary" :disabled="creating" @click="handleCreate">
                  <Loader2 v-if="creating" :size="14" class="create-aff__btn-spin" />
                  Create Affiliate
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, watch } from 'vue';
  import {
    Handshake,
    Users,
    UserCheck,
    DollarSign,
    Clock,
    Plus,
    RefreshCw,
    Loader2,
    AlertTriangle,
    X,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import api from '@/services/api';
  import {
    listAffiliates,
    createAffiliate,
    getAdminOverview,
    type Affiliate,
    type AdminOverview,
  } from '@/services/affiliateApi';

  const loading = ref(false);
  const creating = ref(false);
  const error = ref<string | null>(null);
  const affiliates = ref<Affiliate[]>([]);
  const overview = ref<AdminOverview | null>(null);
  const showCreateModal = ref(false);

  // User search state
  const allUsers = ref<any[]>([]);
  const filteredUsers = ref<any[]>([]);
  const userSearch = ref('');
  const showUserDropdown = ref(false);
  const selectedUser = ref<any>(null);

  const createForm = reactive({
    user_id: '' as string | number,
    referral_code: '',
    signup_commission_pct: 20,
    recurring_commission_pct: 10,
    credit_pack_commission_enabled: false,
    credit_pack_commission_pct: 5,
    notes: '',
  });

  async function fetchAffiliates() {
    loading.value = true;
    error.value = null;
    try {
      const [affResult, overviewResult] = await Promise.all([
        listAffiliates(),
        getAdminOverview(),
      ]);
      if (affResult.success) affiliates.value = affResult.affiliates;
      else error.value = affResult.error || 'Failed to load affiliates';
      if (overviewResult.success) overview.value = overviewResult.overview!;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUsers() {
    try {
      const response = await api.get('/admin/users');
      if (response.data.success) {
        allUsers.value = response.data.users;
      }
    } catch (e) {
      console.error('[Affiliates] Failed to fetch users:', e);
    }
  }

  function filterUsers() {
    showUserDropdown.value = true;
    const q = userSearch.value.toLowerCase().trim();
    if (!q) {
      filteredUsers.value = allUsers.value.slice(0, 10);
      return;
    }
    filteredUsers.value = allUsers.value
      .filter((u: any) =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.wallet_address && u.wallet_address.toLowerCase().includes(q)) ||
        String(u.id).includes(q)
      )
      .slice(0, 10);
  }

  function selectUser(u: any) {
    selectedUser.value = u;
    createForm.user_id = u.id;
    userSearch.value = '';
    showUserDropdown.value = false;
  }

  function clearSelectedUser() {
    selectedUser.value = null;
    createForm.user_id = '';
    userSearch.value = '';
  }

  // Close dropdown on click outside
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.create-aff__search-wrapper')) {
      showUserDropdown.value = false;
    }
  }

  watch(showCreateModal, (open) => {
    if (open) {
      if (!allUsers.value.length) fetchUsers();
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
      clearSelectedUser();
    }
  });

  async function handleCreate() {
    if (!createForm.user_id || !createForm.referral_code) {
      error.value = 'Please select a user and enter a referral code';
      return;
    }
    creating.value = true;
    error.value = null;
    try {
      const result = await createAffiliate({
        user_id: Number(createForm.user_id),
        referral_code: createForm.referral_code,
        signup_commission_pct: createForm.signup_commission_pct,
        recurring_commission_pct: createForm.recurring_commission_pct,
        credit_pack_commission_enabled: createForm.credit_pack_commission_enabled,
        credit_pack_commission_pct: createForm.credit_pack_commission_pct,
        notes: createForm.notes || undefined,
      });
      if (result.success) {
        showCreateModal.value = false;
        createForm.user_id = '';
        createForm.referral_code = '';
        createForm.notes = '';
        await fetchAffiliates();
      } else {
        error.value = result.error || 'Failed to create affiliate';
      }
    } catch (e: any) {
      error.value = e.message;
    } finally {
      creating.value = false;
    }
  }

  onMounted(() => {
    fetchAffiliates();
  });
</script>

<style scoped>
  .aff-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .aff-header__action-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: transparent;
    color: var(--color-foreground, #e5e5e5);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .aff-header__action-btn:hover { background: rgba(255, 255, 255, 0.05); }
  .aff-header__action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .aff-header__action-btn--primary {
    background: #7c3aed;
    border-color: #7c3aed;
    color: white;
  }
  .aff-header__action-btn--primary:hover { opacity: 0.9; }
  .aff-header__action-icon { width: 1rem; height: 1rem; }
  .aff-header__action-icon--spin { animation: spin 1s linear infinite; }

  .admin-aff { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem; }
  .admin-aff__heading { margin-bottom: 0.5rem; }
  .admin-aff__title { font-size: 1.5rem; font-weight: 700; color: var(--color-foreground, #e5e5e5); }
  .admin-aff__subtitle { font-size: 0.875rem; color: var(--color-muted-foreground, #a3a3a3); margin-top: 0.25rem; }

  .admin-aff__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
  .admin-aff__card {
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    background: var(--color-card, rgba(255, 255, 255, 0.02));
  }
  .admin-aff__card-header { display: flex; align-items: center; gap: 0.625rem; margin-bottom: 0.75rem; }
  .admin-aff__card-icon {
    width: 2rem; height: 2rem; border-radius: 0.5rem;
    display: flex; align-items: center; justify-content: center;
  }
  .admin-aff__card-icon--cyan { background: rgba(34, 211, 238, 0.1); color: #22d3ee; }
  .admin-aff__card-icon--green { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .admin-aff__card-icon--amber { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .admin-aff__card-icon--purple { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
  .admin-aff__card-icon-svg { width: 1rem; height: 1rem; }
  .admin-aff__card-label { font-size: 0.75rem; font-weight: 500; color: var(--color-muted-foreground, #a3a3a3); }
  .admin-aff__card-value { font-size: 1.5rem; font-weight: 700; color: var(--color-foreground, #e5e5e5); }
  .admin-aff__card-value--green { color: #22c55e; }
  .admin-aff__card-value--amber { color: #f59e0b; }
  .admin-aff__card-value--purple { color: #a855f7; }

  .admin-aff__error { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); }
  .admin-aff__error-icon { width: 1rem; height: 1rem; color: #ef4444; flex-shrink: 0; }
  .admin-aff__error-text { font-size: 0.8125rem; color: #fca5a5; }

  .admin-aff__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; gap: 0.75rem; }
  .admin-aff__loading-icon { width: 2rem; height: 2rem; color: var(--color-muted-foreground); animation: spin 1s linear infinite; }
  .admin-aff__loading-text { font-size: 0.875rem; color: var(--color-muted-foreground); }

  .admin-aff__table-wrapper { border-radius: 0.75rem; border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08)); overflow: hidden; }
  .admin-aff__table-scroll { overflow-x: auto; }
  .admin-aff__table { width: 100%; border-collapse: collapse; }
  .admin-aff__thead { background: rgba(255, 255, 255, 0.02); }
  .admin-aff__th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--color-muted-foreground, #a3a3a3); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .admin-aff__tbody {}
  .admin-aff__row { border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.06)); transition: background 0.15s; }
  .admin-aff__row:hover { background: rgba(255, 255, 255, 0.02); }
  .admin-aff__td { padding: 0.75rem 1rem; font-size: 0.8125rem; color: var(--color-foreground, #e5e5e5); white-space: nowrap; }
  .admin-aff__td--green { color: #22c55e; }
  .admin-aff__td--amber { color: #f59e0b; }

  .admin-aff__user { display: flex; flex-direction: column; gap: 0.125rem; }
  .admin-aff__user-name { font-weight: 500; }
  .admin-aff__user-id { font-size: 0.6875rem; color: var(--color-muted-foreground); }

  .admin-aff__code { font-family: monospace; font-size: 0.8125rem; padding: 0.125rem 0.375rem; border-radius: 0.25rem; background: rgba(255, 255, 255, 0.05); color: #a855f7; }

  .admin-aff__rates { display: flex; flex-direction: column; gap: 0.125rem; font-size: 0.75rem; color: var(--color-muted-foreground); }

  .admin-aff__status { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .admin-aff__status--active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .admin-aff__status--suspended { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .admin-aff__status--deactivated { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  .admin-aff__view-btn {
    padding: 0.25rem 0.625rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 500;
    background: rgba(255, 255, 255, 0.05); color: var(--color-foreground);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    text-decoration: none; cursor: pointer; transition: all 0.15s;
  }
  .admin-aff__view-btn:hover { background: rgba(255, 255, 255, 0.1); }

  .admin-aff__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 0.75rem; }
  .admin-aff__empty-icon { width: 3rem; height: 3rem; color: var(--color-muted-foreground); opacity: 0.5; }
  .admin-aff__empty-title { font-size: 1.125rem; font-weight: 600; color: var(--color-foreground); }
  .admin-aff__empty-text { font-size: 0.875rem; color: var(--color-muted-foreground); }

  /* ===== Create Affiliate Dialog ===== */
  .create-aff__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .create-aff {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .create-aff__accent {
    height: 3px;
    background: linear-gradient(90deg, #a855f7, rgba(168, 85, 247, 0.5));
    flex-shrink: 0;
  }

  .create-aff__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .create-aff__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .create-aff__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .create-aff__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
    margin-bottom: 0.875rem;
  }

  .create-aff__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .create-aff__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .create-aff__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
  }

  .create-aff__content::-webkit-scrollbar { width: 6px; }
  .create-aff__content::-webkit-scrollbar-track { background: transparent; }
  .create-aff__content::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 3px; }

  .create-aff__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .create-aff__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .create-aff__field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .create-aff__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .create-aff__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
    box-sizing: border-box;
  }

  .create-aff__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .create-aff__input:focus {
    outline: none;
    border-color: #a855f7;
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
  }

  .create-aff__input--textarea {
    resize: vertical;
    font-family: inherit;
  }

  /* User search dropdown */
  .create-aff__search-wrapper {
    position: relative;
  }

  .create-aff__user-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .create-aff__user-dropdown::-webkit-scrollbar { width: 6px; }
  .create-aff__user-dropdown::-webkit-scrollbar-track { background: transparent; }
  .create-aff__user-dropdown::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 3px; }

  .create-aff__user-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    color: var(--sidebar-text);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background-color 150ms ease;
    text-align: left;
  }

  .create-aff__user-option:hover {
    background-color: var(--sidebar-hover);
  }

  .create-aff__user-option + .create-aff__user-option {
    border-top: 1px solid var(--sidebar-border);
  }

  .create-aff__user-option-email {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .create-aff__user-option-id {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
    margin-left: 0.5rem;
  }

  .create-aff__selected-user {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background-color: rgba(168, 85, 247, 0.1);
    border: 1px solid rgba(168, 85, 247, 0.25);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #c084fc;
    margin-top: 0.375rem;
  }

  .create-aff__selected-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: all 150ms ease;
  }

  .create-aff__selected-clear:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: var(--sidebar-text);
  }

  .create-aff__checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .create-aff__checkbox {
    accent-color: #a855f7;
  }

  .create-aff__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .create-aff__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .create-aff__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-aff__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .create-aff__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .create-aff__btn--primary {
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
    color: #fff;
  }

  .create-aff__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .create-aff__btn-spin {
    animation: spin 1s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
