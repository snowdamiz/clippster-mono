<template>
  <PageLayout
    title="Waitlist"
    description="Users who signed up for early access"
    :show-header="true"
    :icon="UserPlus"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Waitlist' }]"
  >
    <template #actions>
      <button class="admin-waitlist__action-btn" :disabled="loading" @click="fetchWaitlist">
        <RefreshCw v-if="!loading" class="admin-waitlist__action-icon" />
        <Loader2 v-else class="admin-waitlist__action-icon admin-waitlist__action-icon--spin" />
        Refresh Waitlist
      </button>
    </template>

    <div class="admin-waitlist">
      <!-- Page Heading -->
      <div class="admin-waitlist__heading">
        <h1 class="admin-waitlist__title">Waitlist</h1>
        <p class="admin-waitlist__subtitle">Users who signed up for early access</p>
      </div>

      <!-- Stats Cards -->
      <div class="admin-waitlist__cards">
        <div class="admin-waitlist__card">
          <div class="admin-waitlist__card-header">
            <div class="admin-waitlist__card-icon admin-waitlist__card-icon--violet">
              <Users class="admin-waitlist__card-icon-svg" />
            </div>
            <h3 class="admin-waitlist__card-label">Total Signups</h3>
          </div>
          <p class="admin-waitlist__card-value">{{ waitlistStats.total }}</p>
        </div>
        <div class="admin-waitlist__card">
          <div class="admin-waitlist__card-header">
            <div class="admin-waitlist__card-icon admin-waitlist__card-icon--green">
              <Activity class="admin-waitlist__card-icon-svg" />
            </div>
            <h3 class="admin-waitlist__card-label">Invited</h3>
          </div>
          <p class="admin-waitlist__card-value admin-waitlist__card-value--green">{{ waitlistStats.invited }}</p>
        </div>
        <div class="admin-waitlist__card">
          <div class="admin-waitlist__card-header">
            <div class="admin-waitlist__card-icon admin-waitlist__card-icon--amber">
              <Activity class="admin-waitlist__card-icon-svg" />
            </div>
            <h3 class="admin-waitlist__card-label">Pending</h3>
          </div>
          <p class="admin-waitlist__card-value admin-waitlist__card-value--amber">{{ waitlistStats.uninvited }}</p>
        </div>
        <div class="admin-waitlist__card">
          <div class="admin-waitlist__card-header">
            <div class="admin-waitlist__card-icon admin-waitlist__card-icon--blue">
              <Activity class="admin-waitlist__card-icon-svg" />
            </div>
            <h3 class="admin-waitlist__card-label">This Week</h3>
          </div>
          <p class="admin-waitlist__card-value admin-waitlist__card-value--blue">{{ waitlistStats.this_week }}</p>
        </div>
      </div>

      <!-- Invite Config Panel -->
      <div v-if="waitlistStats.uninvited > 0" class="admin-waitlist__config">
        <button 
          class="admin-waitlist__config-toggle" 
          @click="showInviteConfig = !showInviteConfig"
        >
          <span>Invite Settings</span>
          <span v-if="showInviteConfig">▼</span>
          <span v-else>▶</span>
        </button>
        
        <div v-if="showInviteConfig" class="admin-waitlist__config-panel">
          <div class="admin-waitlist__config-field">
            <label>Discount Percent</label>
            <input 
              v-model.number="inviteConfig.percent_off" 
              type="number" 
              min="0" 
              max="100"
              class="admin-waitlist__config-input"
            />
          </div>
          <div class="admin-waitlist__config-field">
            <label>Duration (months)</label>
            <input 
              v-model.number="inviteConfig.duration_months" 
              type="number" 
              min="1" 
              max="12"
              class="admin-waitlist__config-input"
            />
          </div>
          <div class="admin-waitlist__config-field">
            <label>Allowed Tier</label>
            <select v-model="inviteConfig.allowed_tiers[0]" class="admin-waitlist__config-select">
              <option value="starter">Starter</option>
              <option value="creator">Creator</option>
              <option value="pro">Pro</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Header -->
      <div class="admin-waitlist__header">
        <div class="admin-waitlist__header-info">
          <div class="admin-waitlist__header-icon">
            <Users class="admin-waitlist__header-icon-svg" />
          </div>
          <div>
            <h2 class="admin-waitlist__header-title">Waitlist</h2>
            <p class="admin-waitlist__header-desc">Users who signed up for early access</p>
          </div>
        </div>
        <div class="admin-waitlist__header-actions">
          <button 
            class="admin-waitlist__add-user-btn" 
            @click="showAddUserDialog = true"
          >
            <UserPlus class="admin-waitlist__add-user-icon" />
            Add User
          </button>
          <button 
            v-if="waitlistStats.uninvited > 0" 
            class="admin-waitlist__invite-all-btn" 
            @click="showBulkConfirm = true"
            :disabled="inviting"
          >
            <UserPlus class="admin-waitlist__invite-all-icon" />
            Invite All Pending ({{ waitlistStats.uninvited }})
          </button>
          <button v-if="waitlistEntries.length > 0" class="admin-waitlist__copy-all-btn" @click="copyAllWaitlistEmails">
            <Copy class="admin-waitlist__copy-all-icon" />
            Copy All Emails
          </button>
          <button v-if="waitlistEntries.length > 0" class="admin-waitlist__copy-all-btn" @click="exportWaitlistEmailsCsv">
            <Download class="admin-waitlist__copy-all-icon" />
            Export Emails CSV
          </button>
          <span class="admin-waitlist__count">
            {{ waitlistEntries.length }} email{{ waitlistEntries.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- Add User Dialog -->
      <div v-if="showAddUserDialog" class="admin-waitlist__confirm-overlay" @click="showAddUserDialog = false">
        <div class="admin-waitlist__confirm-dialog" @click.stop>
          <h3>Add User to Waitlist</h3>
          <p>Enter the email address to add to the waitlist</p>
          <div class="admin-waitlist__add-user-form">
            <input 
              v-model="newUserEmail" 
              type="email" 
              placeholder="user@example.com"
              class="admin-waitlist__add-user-input"
              @keyup.enter="addUserToWaitlist"
            />
          </div>
          <div class="admin-waitlist__confirm-actions">
            <button @click="showAddUserDialog = false" class="admin-waitlist__confirm-cancel">Cancel</button>
            <button @click="addUserToWaitlist" class="admin-waitlist__confirm-submit" :disabled="!newUserEmail || adding">Add User</button>
          </div>
        </div>
      </div>

      <!-- Bulk Invite Confirmation Dialog -->
      <div v-if="showBulkConfirm" class="admin-waitlist__confirm-overlay" @click="showBulkConfirm = false">
        <div class="admin-waitlist__confirm-dialog" @click.stop>
          <h3>Confirm Bulk Invite</h3>
          <p>Send invites to {{ waitlistStats.uninvited }} pending users?</p>
          <p class="admin-waitlist__confirm-config">
            {{ inviteConfig.percent_off }}% off for {{ inviteConfig.duration_months }} month(s) - {{ inviteConfig.allowed_tiers[0] }} tier
          </p>
          <div class="admin-waitlist__confirm-actions">
            <button @click="showBulkConfirm = false" class="admin-waitlist__confirm-cancel">Cancel</button>
            <button @click="inviteAllPending" class="admin-waitlist__confirm-submit">Send Invites</button>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="admin-waitlist__error">
        <AlertTriangle class="admin-waitlist__error-icon" />
        <p class="admin-waitlist__error-text">{{ error }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !waitlistEntries.length" class="admin-waitlist__loading">
        <Loader2 class="admin-waitlist__loading-icon" />
        <p class="admin-waitlist__loading-text">Loading waitlist...</p>
      </div>

      <!-- Waitlist Table -->
      <div v-else-if="waitlistEntries.length > 0" class="admin-waitlist__table-wrapper">
        <div class="admin-waitlist__table-scroll">
          <table class="admin-waitlist__table">
            <thead class="admin-waitlist__thead">
              <tr>
                <th class="admin-waitlist__th">ID</th>
                <th class="admin-waitlist__th">Email</th>
                <th class="admin-waitlist__th">Signed Up</th>
                <th class="admin-waitlist__th">Status</th>
                <th class="admin-waitlist__th">Beta Code</th>
                <th class="admin-waitlist__th">Discount Code</th>
                <th class="admin-waitlist__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-waitlist__tbody">
              <tr v-for="entry in waitlistEntries" :key="entry.id" class="admin-waitlist__row">
                <td class="admin-waitlist__td">
                  <span class="admin-waitlist__id">#{{ entry.id }}</span>
                </td>
                <td class="admin-waitlist__td">
                  <span class="admin-waitlist__email">{{ entry.email }}</span>
                </td>
                <td class="admin-waitlist__td">
                  <span class="admin-waitlist__date">{{ formatDate(entry.created_at) }}</span>
                </td>
                <td class="admin-waitlist__td">
                  <span v-if="entry.invited_at" class="admin-waitlist__status admin-waitlist__status--invited">
                    ✓ Invited {{ formatDate(entry.invited_at) }}
                  </span>
                  <span v-else class="admin-waitlist__status admin-waitlist__status--pending">
                    Pending
                  </span>
                  <span v-if="entry.email_delivery_error" class="admin-waitlist__status admin-waitlist__status--error" :title="entry.email_delivery_error">
                    ⚠ Email Failed
                  </span>
                </td>
                <td class="admin-waitlist__td">
                  <span v-if="entry.beta_code" class="admin-waitlist__code">{{ entry.beta_code }}</span>
                  <span v-else class="admin-waitlist__code-empty">—</span>
                </td>
                <td class="admin-waitlist__td">
                  <span v-if="entry.discount_code" class="admin-waitlist__code">{{ entry.discount_code }}</span>
                  <span v-else class="admin-waitlist__code-empty">—</span>
                </td>
                <td class="admin-waitlist__td">
                  <div v-if="!entry.invited_at">
                    <button 
                      class="admin-waitlist__invite-btn" 
                      @click="inviteEntry(entry.id)"
                      :disabled="inviting"
                    >
                      <UserPlus class="admin-waitlist__invite-icon" />
                      Invite
                    </button>
                  </div>
                  <div v-else class="admin-waitlist__action-buttons">
                    <button 
                      class="admin-waitlist__reinvite-btn" 
                      @click="reinviteEntry(entry.id)"
                      :disabled="inviting"
                      title="Cancel old codes and send new invite"
                    >
                      <RefreshCcw class="admin-waitlist__reinvite-icon" />
                      Reinvite
                    </button>
                    <button 
                      class="admin-waitlist__copy-btn" 
                      @click="copyWaitlistEmail(entry.email)"
                    >
                      <Copy class="admin-waitlist__copy-icon" />
                      Copy
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-waitlist__empty">
        <div class="admin-waitlist__empty-icon">
          <Users class="admin-waitlist__empty-icon-svg" />
        </div>
        <p class="admin-waitlist__empty-text">No waitlist signups yet</p>
        <button class="admin-waitlist__empty-btn" @click="fetchWaitlist">Refresh Waitlist</button>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import { downloadEmailsCsv } from '@/utils/downloadEmailsCsv';
  import { UserPlus, Users, Activity, RefreshCw, Loader2, Copy, Download, AlertTriangle, RefreshCcw } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import api from '@/services/api';
  import { useToast } from '@/composables/useToast';

  interface WaitlistEntry {
    id: number;
    email: string;
    created_at: string;
    invited_at?: string;
    email_sent_at?: string;
    email_delivery_error?: string;
    beta_code?: string;
    discount_code?: string;
  }

  interface WaitlistStats {
    total: number;
    today: number;
    this_week: number;
    invited: number;
    uninvited: number;
  }

  const waitlistEntries = ref<WaitlistEntry[]>([]);
  const waitlistStats = ref<WaitlistStats>({ total: 0, today: 0, this_week: 0, invited: 0, uninvited: 0 });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const inviting = ref(false);
  const adding = ref(false);
  const showInviteConfig = ref(false);
  const showBulkConfirm = ref(false);
  const showAddUserDialog = ref(false);
  const newUserEmail = ref('');
  const inviteConfig = ref({
    percent_off: 30,
    duration_months: 1,
    allowed_tiers: ['creator']
  });
  const { error: showErrorToast } = useToast();

  const fetchWaitlist = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/admin/waitlist');
      if (response.data.success) {
        waitlistEntries.value = response.data.entries;
        waitlistStats.value = response.data.stats;
      } else {
        error.value = response.data.error || 'Failed to load waitlist';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading.value = false;
    }
  };

  const copyWaitlistEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyAllWaitlistEmails = async () => {
    const emails = waitlistEntries.value.map((entry) => entry.email).join('\n');
    if (!emails) {
      error.value = 'No emails to copy';
      return;
    }
    try {
      await navigator.clipboard.writeText(emails);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const exportWaitlistEmailsCsv = async () => {
    const emails = waitlistEntries.value.map((entry) => entry.email).filter(Boolean);
    if (!emails.length) {
      showErrorToast('Export failed', 'No emails to export');
      return;
    }
    try {
      await downloadEmailsCsv(emails, 'waitlist-emails.csv');
    } catch (err) {
      console.error('Failed to export waitlist emails:', err);
      showErrorToast('Export failed', err instanceof Error ? err.message : 'Failed to export emails CSV');
    }
  };

  const inviteEntry = async (entryId: number) => {
    inviting.value = true;
    error.value = null;
    try {
      const response = await api.post(`/admin/waitlist/${entryId}/invite`, inviteConfig.value);
      if (response.data.success) {
        await fetchWaitlist();
      } else {
        error.value = response.data.error || 'Failed to send invite';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      inviting.value = false;
    }
  };

  const reinviteEntry = async (entryId: number) => {
    inviting.value = true;
    error.value = null;
    try {
      const response = await api.post(`/admin/waitlist/${entryId}/reinvite`, inviteConfig.value);
      if (response.data.success) {
        await fetchWaitlist();
      } else {
        error.value = response.data.error || 'Failed to send reinvite';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      inviting.value = false;
    }
  };

  const inviteAllPending = async () => {
    showBulkConfirm.value = false;
    inviting.value = true;
    error.value = null;
    try {
      const response = await api.post('/admin/waitlist/invite', inviteConfig.value);
      if (response.data.success) {
        await fetchWaitlist();
        alert(`Successfully invited ${response.data.invited_count} users. Skipped: ${response.data.skipped_count}. Errors: ${response.data.errors.length}`);
      } else {
        error.value = response.data.error || 'Failed to send invites';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      inviting.value = false;
    }
  };

  const addUserToWaitlist = async () => {
    if (!newUserEmail.value) return;
    
    adding.value = true;
    error.value = null;
    try {
      const response = await api.post('/admin/waitlist', { email: newUserEmail.value });
      if (response.data.success) {
        showAddUserDialog.value = false;
        newUserEmail.value = '';
        await fetchWaitlist();
      } else {
        error.value = response.data.error || 'Failed to add user to waitlist';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      adding.value = false;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  onMounted(() => {
    fetchWaitlist();
  });
</script>

<style scoped>
  .admin-waitlist {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-waitlist__heading {
    margin-bottom: 0.5rem;
  }

  .admin-waitlist__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-waitlist__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-waitlist__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .admin-waitlist__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .admin-waitlist__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-waitlist__action-icon {
    width: 14px;
    height: 14px;
  }
  .admin-waitlist__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-waitlist__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .admin-waitlist__cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .admin-waitlist__card {
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-waitlist__card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .admin-waitlist__card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-waitlist__card-icon--violet {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
  }
  .admin-waitlist__card-icon--violet .admin-waitlist__card-icon-svg {
    color: #a78bfa;
  }

  .admin-waitlist__card-icon--green {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .admin-waitlist__card-icon--green .admin-waitlist__card-icon-svg {
    color: #34d399;
  }

  .admin-waitlist__card-icon--blue {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .admin-waitlist__card-icon--blue .admin-waitlist__card-icon-svg {
    color: #60a5fa;
  }

  .admin-waitlist__card-icon-svg {
    width: 16px;
    height: 16px;
  }

  .admin-waitlist__card-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-waitlist__card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-waitlist__card-value--green {
    color: #34d399;
  }
  .admin-waitlist__card-value--blue {
    color: #60a5fa;
  }

  .admin-waitlist__header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  @media (min-width: 640px) {
    .admin-waitlist__header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .admin-waitlist__header-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-waitlist__header-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .admin-waitlist__header-icon-svg {
    width: 20px;
    height: 20px;
    color: #a78bfa;
  }

  .admin-waitlist__header-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-waitlist__header-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-waitlist__header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .admin-waitlist__copy-all-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__copy-all-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  .admin-waitlist__copy-all-icon {
    width: 16px;
    height: 16px;
  }

  .admin-waitlist__count {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .admin-waitlist__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
  }

  .admin-waitlist__error-icon {
    width: 16px;
    height: 16px;
    color: #f87171;
  }
  .admin-waitlist__error-text {
    font-size: 0.875rem;
    color: #fca5a5;
    margin: 0;
  }

  .admin-waitlist__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .admin-waitlist__loading-icon {
    width: 32px;
    height: 32px;
    color: #a78bfa;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .admin-waitlist__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-waitlist__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-waitlist__table-scroll {
    overflow-x: auto;
  }

  .admin-waitlist__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-waitlist__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }

  .admin-waitlist__th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-waitlist__tbody {
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-waitlist__row {
    transition: background-color 150ms ease;
  }
  .admin-waitlist__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }
  .admin-waitlist__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }

  .admin-waitlist__td {
    padding: 1rem 1.25rem;
    white-space: nowrap;
  }

  .admin-waitlist__id {
    font-size: 0.875rem;
    font-family: monospace;
    color: var(--sidebar-text-muted);
  }

  .admin-waitlist__email {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .admin-waitlist__date {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-waitlist__copy-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__copy-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  .admin-waitlist__copy-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  .admin-waitlist__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .admin-waitlist__empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    margin-bottom: 1rem;
  }

  .admin-waitlist__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #a78bfa;
  }

  .admin-waitlist__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .admin-waitlist__empty-btn {
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__empty-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Invite Config Panel */
  .admin-waitlist__config {
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-waitlist__config-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 150ms ease;
  }

  .admin-waitlist__config-toggle:hover {
    color: var(--sidebar-accent);
  }

  .admin-waitlist__config-panel {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--sidebar-border);
  }

  @media (min-width: 768px) {
    .admin-waitlist__config-panel {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .admin-waitlist__config-field label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.5rem;
  }

  .admin-waitlist__config-input,
  .admin-waitlist__config-select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    transition: all 150ms ease;
  }

  .admin-waitlist__config-input:focus,
  .admin-waitlist__config-select:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background-color: rgba(39, 39, 42, 0.8);
  }

  /* Amber card styling */
  .admin-waitlist__card-icon--amber {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%);
    border: 1px solid rgba(251, 191, 36, 0.3);
  }
  .admin-waitlist__card-icon--amber .admin-waitlist__card-icon-svg {
    color: #fbbf24;
  }

  .admin-waitlist__card-value--amber {
    color: #fbbf24;
  }

  /* Invite All Button */
  .admin-waitlist__invite-all-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__invite-all-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-waitlist__invite-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-waitlist__invite-all-icon {
    width: 16px;
    height: 16px;
  }

  /* Bulk Confirm Dialog */
  .admin-waitlist__confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
  }

  .admin-waitlist__confirm-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 28rem;
    width: calc(100% - 2rem);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  }

  .admin-waitlist__confirm-dialog h3 {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .admin-waitlist__confirm-dialog p {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
  }

  .admin-waitlist__confirm-config {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .admin-waitlist__confirm-actions {
    display: flex;
    gap: 0.75rem;
  }

  .admin-waitlist__confirm-cancel,
  .admin-waitlist__confirm-submit {
    flex: 1;
    padding: 0.625rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__confirm-cancel {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-waitlist__confirm-cancel:hover {
    background-color: rgba(63, 63, 70, 1);
  }

  .admin-waitlist__confirm-submit {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
  }

  .admin-waitlist__confirm-submit:hover {
    opacity: 0.9;
  }

  /* Status badges */
  .admin-waitlist__status {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-waitlist__status--invited {
    color: #34d399;
  }

  .admin-waitlist__status--pending {
    color: #fbbf24;
  }

  .admin-waitlist__status--error {
    color: #f87171;
    display: block;
    margin-top: 0.25rem;
  }

  /* Code display */
  .admin-waitlist__code {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .admin-waitlist__code-empty {
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  /* Invite button */
  .admin-waitlist__invite-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__invite-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-waitlist__invite-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-waitlist__invite-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  /* Add User Button */
  .admin-waitlist__add-user-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__add-user-btn:hover {
    opacity: 0.9;
  }

  .admin-waitlist__add-user-icon {
    width: 16px;
    height: 16px;
  }

  /* Action buttons container */
  .admin-waitlist__action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  /* Reinvite button */
  .admin-waitlist__reinvite-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    background: linear-gradient(to right, #f59e0b, #ea580c);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-waitlist__reinvite-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-waitlist__reinvite-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-waitlist__reinvite-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  /* Add User Form */
  .admin-waitlist__add-user-form {
    margin-bottom: 1rem;
  }

  .admin-waitlist__add-user-input {
    width: 100%;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    transition: all 150ms ease;
  }

  .admin-waitlist__add-user-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    background-color: rgba(39, 39, 42, 0.8);
  }

  .admin-waitlist__add-user-input::placeholder {
    color: var(--sidebar-text-muted);
  }
</style>
