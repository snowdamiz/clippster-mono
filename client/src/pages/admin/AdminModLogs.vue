<template>
  <PageLayout
    title="Moderator Logs"
    description="View all moderator actions and activity"
    :show-header="true"
    :icon="ScrollText"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Moderator Logs' }]"
  >
    <template #actions>
      <button class="admin-mod-logs__action-btn" :disabled="loading" @click="loadLogs">
        <RefreshCw v-if="!loading" class="admin-mod-logs__action-icon" />
        <Loader2 v-else class="admin-mod-logs__action-icon admin-mod-logs__action-icon--spin" />
        Refresh Logs
      </button>
    </template>

    <div class="admin-mod-logs">
      <!-- Page Heading -->
      <div class="admin-mod-logs__heading">
        <h1 class="admin-mod-logs__title">Moderator Logs</h1>
        <p class="admin-mod-logs__subtitle">View all moderator actions and activity</p>
      </div>

      <!-- Stats Header -->
      <div class="admin-mod-logs__stats-header">
        <div class="admin-mod-logs__stats-info">
          <div class="admin-mod-logs__stats-icon">
            <ScrollText class="admin-mod-logs__stats-icon-svg" />
          </div>
          <div>
            <h2 class="admin-mod-logs__stats-title">Moderation Activity</h2>
            <p class="admin-mod-logs__stats-desc">Track moderator actions and decisions</p>
          </div>
        </div>
        <span v-if="logs.length > 0" class="admin-mod-logs__stats-count">{{ logs.length }} log{{ logs.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Filters -->
        <div class="admin-mod-logs__filters">
          <div class="admin-mod-logs__filter">
            <label>Moderator</label>
            <CustomDropdown
              v-model="filters.moderatorId"
              :options="moderatorOptions"
              placeholder="All Moderators"
              trigger-class="admin-mod-logs__dropdown-trigger"
            />
          </div>
          
          <div class="admin-mod-logs__filter">
            <label>Action Type</label>
            <CustomDropdown
              v-model="filters.actionType"
              :options="actionTypeOptions"
              placeholder="All Actions"
              trigger-class="admin-mod-logs__dropdown-trigger"
            />
          </div>
          
          <Button @click="loadLogs" size="sm">
            <Filter class="admin-mod-logs__button-icon" />
            Apply Filters
          </Button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="admin-mod-logs__loading">
          <Loader2 class="admin-mod-logs__spinner" />
          <p>Loading moderator logs...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="admin-mod-logs__error">
          <AlertTriangle class="admin-mod-logs__error-icon" />
          <h3>Failed to load logs</h3>
          <p>{{ error }}</p>
          <Button @click="loadLogs">Try Again</Button>
        </div>

        <!-- Logs Table -->
        <div v-else-if="logs.length === 0" class="admin-mod-logs__empty">
          <ScrollText class="admin-mod-logs__empty-icon" />
          <h3>No logs found</h3>
          <p>No moderator actions match the current filters</p>
        </div>

        <div v-else class="admin-mod-logs__table-container">
          <table class="admin-mod-logs__table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Moderator</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in logs" :key="log.id">
                <td>
                  <div class="admin-mod-logs__timestamp">
                    <span class="admin-mod-logs__date">{{ formatDate(log.inserted_at) }}</span>
                    <span class="admin-mod-logs__time">{{ formatTime(log.inserted_at) }}</span>
                  </div>
                </td>
                <td>
                  <div class="admin-mod-logs__moderator">
                    <User class="admin-mod-logs__moderator-icon" />
                    <span>{{ log.moderator?.name || log.moderator?.email || 'Unknown' }}</span>
                  </div>
                </td>
                <td>
                  <span :class="['admin-mod-logs__action-badge', `admin-mod-logs__action-badge--${getActionColor(log.action_type)}`]">
                    {{ formatActionType(log.action_type) }}
                  </span>
                </td>
                <td>
                  <div class="admin-mod-logs__target">
                    <span class="admin-mod-logs__target-type">{{ formatTargetType(log.target_type) }}</span>
                    <span class="admin-mod-logs__target-id">#{{ log.target_id }}</span>
                  </div>
                </td>
                <td>
                  <div class="admin-mod-logs__details">
                    <template v-if="log.details && Object.keys(log.details).length > 0">
                      <div v-for="(value, key) in log.details" :key="key" class="admin-mod-logs__detail-item">
                        <span class="admin-mod-logs__detail-key">{{ key }}:</span>
                        <span class="admin-mod-logs__detail-value">{{ value }}</span>
                      </div>
                    </template>
                    <span v-else class="admin-mod-logs__no-details">—</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div class="admin-mod-logs__pagination">
            <Button @click="prevPage" :disabled="page === 1" variant="outline" size="sm">
              Previous
            </Button>
            <span class="admin-mod-logs__page-info">
              Page {{ page }} of {{ totalPages }}
            </span>
            <Button @click="nextPage" :disabled="page >= totalPages" variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { formatDate as fmtDate, formatTime as fmtTime } from '@/utils/dateTimeUtils';
import { ScrollText, Filter, Loader2, AlertTriangle, User, RefreshCw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/PageLayout.vue';
import CustomDropdown from '@/components/CustomDropdown.vue';
import api from '@/services/api';

const logs = ref<any[]>([]);
const moderators = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const page = ref(1);
const perPage = ref(50);
const total = ref(0);

const filters = ref({
  moderatorId: '',
  actionType: ''
});

const moderatorOptions = computed(() => [
  { label: 'All Moderators', value: '' },
  ...moderators.value.map(mod => ({
    label: mod.name || mod.email,
    value: mod.id
  }))
]);

const actionTypeOptions = [
  { label: 'All Actions', value: '' },
  { label: 'Approve Org Application', value: 'approve_org_application' },
  { label: 'Reject Org Application', value: 'reject_org_application' },
  { label: 'Update Bug Report', value: 'update_bug_report' },
  { label: 'Respond to Support', value: 'respond_to_support' },
  { label: 'Archive Support', value: 'archive_support_conversation' }
];

const totalPages = computed(() => Math.ceil(total.value / perPage.value));

const loadLogs = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const params: any = {
      page: page.value,
      per_page: perPage.value
    };
    
    if (filters.value.moderatorId) {
      const response = await api.get(`/admin/mod-logs/${filters.value.moderatorId}`, { params });
      logs.value = response.data.logs || [];
      total.value = response.data.total || 0;
    } else {
      const response = await api.get('/admin/mod-logs', { params });
      logs.value = response.data.logs || [];
      total.value = response.data.total || 0;
    }
    
    // Filter by action type on frontend if specified
    if (filters.value.actionType) {
      logs.value = logs.value.filter(log => log.action_type === filters.value.actionType);
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to load moderator logs';
    console.error('Failed to load logs:', err);
  } finally {
    loading.value = false;
  }
};

const loadModerators = async () => {
  try {
    const response = await api.get('/admin/users');
    moderators.value = (response.data.users || []).filter((u: any) => u.is_moderator);
  } catch (err) {
    console.error('Failed to load moderators:', err);
  }
};

const prevPage = () => {
  if (page.value > 1) {
    page.value--;
    loadLogs();
  }
};

const nextPage = () => {
  if (page.value < totalPages.value) {
    page.value++;
    loadLogs();
  }
};

const formatDate = (timestamp: string) => {
  return fmtDate(timestamp);
};

const formatTime = (timestamp: string) => {
  return fmtTime(timestamp);
};

const formatActionType = (actionType: string) => {
  return actionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatTargetType = (targetType: string) => {
  return targetType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getActionColor = (actionType: string) => {
  if (actionType.includes('approve')) return 'success';
  if (actionType.includes('reject') || actionType.includes('delete')) return 'danger';
  if (actionType.includes('archive')) return 'warning';
  return 'default';
};

onMounted(() => {
  loadLogs();
  loadModerators();
});
</script>

<style scoped>
.admin-mod-logs {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.admin-mod-logs__heading {
  margin-bottom: 0.5rem;
}

.admin-mod-logs__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}

.admin-mod-logs__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-mod-logs__stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
}

.admin-mod-logs__stats-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-mod-logs__stats-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.admin-mod-logs__stats-icon-svg {
  width: 20px;
  height: 20px;
  color: #3b82f6;
}

.admin-mod-logs__stats-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.admin-mod-logs__stats-desc {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-mod-logs__stats-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  padding: 0.375rem 0.75rem;
  background-color: var(--sidebar-hover);
  border-radius: 6px;
}

.admin-mod-logs__action-btn {
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

.admin-mod-logs__action-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.admin-mod-logs__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-mod-logs__action-icon {
  width: 14px;
  height: 14px;
}

.admin-mod-logs__action-icon--spin {
  animation: spin 1s linear infinite;
}

.admin-mod-logs__filters {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  padding: 1rem 1.25rem;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
}

.admin-mod-logs__filter {
  flex: 1;
}

.admin-mod-logs__filter label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin-bottom: 0.5rem;
}

/* Dropdown trigger styling */
:deep(.admin-mod-logs__dropdown-trigger) {
  height: 38px !important;
  padding: 0 0.75rem !important;
  background-color: var(--sidebar-surface) !important;
  border: 1px solid var(--sidebar-border) !important;
  border-radius: 6px !important;
  font-size: 0.875rem !important;
  transition: all 150ms ease !important;
}

:deep(.admin-mod-logs__dropdown-trigger:hover) {
  border-color: rgba(255, 255, 255, 0.15) !important;
}

:deep(.admin-mod-logs__dropdown-trigger span) {
  color: var(--sidebar-text) !important;
}

:deep(.admin-mod-logs__dropdown-trigger svg) {
  width: 14px !important;
  height: 14px !important;
  color: var(--sidebar-text-muted) !important;
}

.admin-mod-logs__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.admin-mod-logs__spinner {
  width: 32px;
  height: 32px;
  color: #3b82f6;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.admin-mod-logs__loading p {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-mod-logs__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 0.75rem;
}

.admin-mod-logs__error-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: #ef4444;
}

.admin-mod-logs__error h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.admin-mod-logs__error p {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-mod-logs__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 0.75rem;
}

.admin-mod-logs__empty-icon {
  width: 3rem;
  height: 3rem;
  color: var(--sidebar-text-muted);
  opacity: 0.5;
}

.admin-mod-logs__empty h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.admin-mod-logs__empty p {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-mod-logs__table-container {
  border-radius: 10px;
  border: 1px solid var(--sidebar-border);
  overflow: hidden;
  background-color: var(--sidebar-surface);
}

.admin-mod-logs__table {
  width: 100%;
  border-collapse: collapse;
}

.admin-mod-logs__table thead {
  background: rgba(255, 255, 255, 0.02);
}

.admin-mod-logs__table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.admin-mod-logs__table tbody tr {
  border-top: 1px solid var(--sidebar-border);
  transition: background-color 150ms ease;
}

.admin-mod-logs__table tbody tr:hover {
  background-color: var(--sidebar-hover);
}

.admin-mod-logs__table td {
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
}

.admin-mod-logs__timestamp {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-mod-logs__date {
  font-weight: 600;
  color: var(--sidebar-text);
}

.admin-mod-logs__time {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.admin-mod-logs__moderator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-mod-logs__moderator-icon {
  width: 1rem;
  height: 1rem;
  opacity: 0.7;
}

.admin-mod-logs__action-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-mod-logs__action-badge--success {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.admin-mod-logs__action-badge--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.admin-mod-logs__action-badge--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.admin-mod-logs__action-badge--default {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.admin-mod-logs__target {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-mod-logs__target-type {
  font-weight: 600;
  color: var(--sidebar-text);
}

.admin-mod-logs__target-id {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.admin-mod-logs__details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-mod-logs__detail-item {
  font-size: 0.75rem;
}

.admin-mod-logs__detail-key {
  font-weight: 500;
  margin-right: 0.25rem;
}

.admin-mod-logs__detail-value {
  color: var(--sidebar-text-muted);
}

.admin-mod-logs__no-details {
  color: var(--sidebar-text-muted);
}

.admin-mod-logs__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid var(--sidebar-border);
  background: rgba(255, 255, 255, 0.01);
}

.admin-mod-logs__page-info {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
}

.admin-mod-logs__button-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
