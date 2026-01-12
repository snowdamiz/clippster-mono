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
            <h3 class="admin-waitlist__card-label">Today</h3>
          </div>
          <p class="admin-waitlist__card-value admin-waitlist__card-value--green">{{ waitlistStats.today }}</p>
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
          <button v-if="waitlistEntries.length > 0" class="admin-waitlist__copy-all-btn" @click="copyAllWaitlistEmails">
            <Copy class="admin-waitlist__copy-all-icon" />
            Copy All Emails
          </button>
          <span class="admin-waitlist__count">
            {{ waitlistEntries.length }} email{{ waitlistEntries.length !== 1 ? 's' : '' }}
          </span>
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
                  <button class="admin-waitlist__copy-btn" @click="copyWaitlistEmail(entry.email)">
                    <Copy class="admin-waitlist__copy-icon" />
                    Copy
                  </button>
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
  import { UserPlus, Users, Activity, RefreshCw, Loader2, Copy, AlertTriangle } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import api from '@/services/api';

  interface WaitlistEntry {
    id: number;
    email: string;
    created_at: string;
  }

  interface WaitlistStats {
    total: number;
    today: number;
    this_week: number;
  }

  const waitlistEntries = ref<WaitlistEntry[]>([]);
  const waitlistStats = ref<WaitlistStats>({ total: 0, today: 0, this_week: 0 });
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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
    margin: 0 0 0.375rem;
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
</style>
