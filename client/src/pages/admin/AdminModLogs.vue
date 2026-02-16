<template>
  <div class="admin-mod-logs">
    <PageLayout
      title="Moderator Logs"
      description="View all moderator actions and activity"
      :show-header="true"
      :icon="ScrollText"
    >
      <div class="admin-mod-logs__content">
        <!-- Filters -->
        <div class="admin-mod-logs__filters">
          <div class="admin-mod-logs__filter">
            <label>Moderator</label>
            <select v-model="filters.moderatorId">
              <option value="">All Moderators</option>
              <option v-for="mod in moderators" :key="mod.id" :value="mod.id">
                {{ mod.name || mod.email }}
              </option>
            </select>
          </div>
          
          <div class="admin-mod-logs__filter">
            <label>Action Type</label>
            <select v-model="filters.actionType">
              <option value="">All Actions</option>
              <option value="approve_org_application">Approve Org Application</option>
              <option value="reject_org_application">Reject Org Application</option>
              <option value="update_bug_report">Update Bug Report</option>
              <option value="respond_to_support">Respond to Support</option>
              <option value="archive_support_conversation">Archive Support</option>
            </select>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ScrollText, Filter, Loader2, AlertTriangle, User } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/PageLayout.vue';
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
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
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
  width: 100%;
  min-height: 100%;
}

.admin-mod-logs__content {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.admin-mod-logs__filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--accent);
  border-radius: 0.5rem;
}

.admin-mod-logs__filter {
  flex: 1;
}

.admin-mod-logs__filter label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.admin-mod-logs__filter select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--background);
}

.admin-mod-logs__loading,
.admin-mod-logs__error,
.admin-mod-logs__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.admin-mod-logs__spinner {
  width: 3rem;
  height: 3rem;
  animation: spin 1s linear infinite;
}

.admin-mod-logs__error-icon,
.admin-mod-logs__empty-icon {
  width: 4rem;
  height: 4rem;
  opacity: 0.5;
}

.admin-mod-logs__table-container {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden;
}

.admin-mod-logs__table {
  width: 100%;
  border-collapse: collapse;
}

.admin-mod-logs__table th {
  background: var(--accent);
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}

.admin-mod-logs__table td {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.875rem;
}

.admin-mod-logs__table tbody tr:hover {
  background: var(--accent);
}

.admin-mod-logs__timestamp {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-mod-logs__date {
  font-weight: 500;
}

.admin-mod-logs__time {
  font-size: 0.75rem;
  color: var(--muted-foreground);
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
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.admin-mod-logs__action-badge--success {
  background: #10b98120;
  color: #10b981;
}

.admin-mod-logs__action-badge--danger {
  background: #ef444420;
  color: #ef4444;
}

.admin-mod-logs__action-badge--warning {
  background: #f59e0b20;
  color: #f59e0b;
}

.admin-mod-logs__action-badge--default {
  background: var(--accent);
  color: var(--foreground);
}

.admin-mod-logs__target {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-mod-logs__target-type {
  font-weight: 500;
}

.admin-mod-logs__target-id {
  font-size: 0.75rem;
  color: var(--muted-foreground);
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
  color: var(--muted-foreground);
}

.admin-mod-logs__no-details {
  color: var(--muted-foreground);
}

.admin-mod-logs__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid var(--border);
}

.admin-mod-logs__page-info {
  font-size: 0.875rem;
  color: var(--muted-foreground);
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
