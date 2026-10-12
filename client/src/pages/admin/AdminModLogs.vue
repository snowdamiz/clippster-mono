<template>
  <PageLayout
    title="Moderator logs"
    description="View all moderator actions and activity"
    :icon="ScrollText"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Moderator logs' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh logs" :disabled="loading" @click="loadLogs">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar :count="loading && !logs.length ? undefined : logs.length" count-label="log">
        <div class="w-40">
          <CustomDropdown v-model="filters.moderatorId" :options="moderatorOptions" placeholder="All moderators" size="sm" />
        </div>
        <div class="w-48">
          <CustomDropdown v-model="filters.actionType" :options="actionTypeOptions" placeholder="All actions" size="sm" />
        </div>
        <Button variant="secondary" size="sm" :disabled="loading" @click="loadLogs">
          <Filter />
          Apply filters
        </Button>
      </AdminFilterBar>
    </template>

    <div class="px-5 py-4">
      <!-- Error -->
      <EmptyState v-if="error" :icon="AlertTriangle" tone="danger" title="Failed to load logs" :description="error">
        <Button variant="secondary" @click="loadLogs">Try again</Button>
      </EmptyState>

      <DataTable
        v-else
        :columns="columns"
        :rows="logs"
        row-key="id"
        :loading="loading"
        :empty-icon="ScrollText"
        empty-title="No logs found"
        empty-description="No moderator actions match the current filters."
      >
        <template #cell-time="{ row: log }">
          <span class="tabular block truncate text-fg">{{ formatDate(log.inserted_at) }}</span>
          <span class="tabular block truncate text-xs text-fg-subtle">{{ formatTime(log.inserted_at) }}</span>
        </template>

        <template #cell-moderator="{ row: log }">
          <div class="flex min-w-0 items-center gap-2">
            <Avatar :name="log.moderator?.name || log.moderator?.email" size="sm" />
            <span class="truncate text-fg">{{ log.moderator?.name || log.moderator?.email || 'Unknown' }}</span>
          </div>
        </template>

        <template #cell-action="{ row: log }">
          <Badge :variant="getActionVariant(log.action_type)" class="max-w-full">
            <span class="truncate">{{ formatActionType(log.action_type) }}</span>
          </Badge>
        </template>

        <template #cell-target="{ row: log }">
          <span class="block truncate text-fg">{{ formatTargetType(log.target_type) }}</span>
          <span class="tabular block truncate text-xs text-fg-subtle">#{{ log.target_id }}</span>
        </template>

        <template #cell-details="{ row: log }">
          <dl
            v-if="log.details && Object.keys(log.details).length > 0"
            class="flex min-w-0 flex-col gap-0.5 text-xs"
            :title="formatDetailsTitle(log.details)"
          >
            <div v-for="(value, key) in log.details" :key="key" class="flex min-w-0 gap-1.5">
              <dt class="shrink-0 text-fg-subtle">{{ formatDetailKey(String(key)) }}</dt>
              <dd class="min-w-0 truncate text-fg-muted">{{ value }}</dd>
            </div>
          </dl>
          <span v-else class="text-fg-subtle">—</span>
        </template>

        <template #footer>
          <PaginationFooter
            mode="static"
            :current-page="page"
            :total-pages="totalPages"
            :total-items="total"
            item-label="log"
            @previous="prevPage"
            @next="nextPage"
            @go-to-page="goToPage"
          />
        </template>
      </DataTable>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { formatDate as fmtDate, formatTime as fmtTime } from '@/utils/dateTimeUtils';
import { ScrollText, Filter, AlertTriangle, RefreshCw } from 'lucide-vue-next';
import type { BadgeVariants } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import PageLayout from '@/components/PageLayout.vue';
import PaginationFooter from '@/components/PaginationFooter.vue';
import { Avatar } from '@/components/ui/avatar';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { AdminFilterBar } from '@/components/admin/shared';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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
  { label: 'All moderators', value: '' },
  ...moderators.value.map(mod => ({
    label: mod.name || mod.email,
    value: mod.id
  }))
]);

const actionTypeOptions = [
  { label: 'All actions', value: '' },
  { label: 'Approve org application', value: 'approve_org_application' },
  { label: 'Reject org application', value: 'reject_org_application' },
  { label: 'Update bug report', value: 'update_bug_report' },
  { label: 'Respond to support', value: 'respond_to_support' },
  { label: 'Archive support', value: 'archive_support_conversation' }
];

const columns: DataTableColumn[] = [
  { key: 'time', label: 'Time', width: '112px' },
  { key: 'moderator', label: 'Moderator' },
  { key: 'action', label: 'Action', width: '190px' },
  { key: 'target', label: 'Target', width: '130px', hideBelow: 'md' },
  { key: 'details', label: 'Details', width: '28%', hideBelow: 'md' },
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

const goToPage = (target: number) => {
  if (target === page.value) return;
  page.value = target;
  loadLogs();
};

const formatDate = (timestamp: string) => {
  return fmtDate(timestamp);
};

const formatTime = (timestamp: string) => {
  return fmtTime(timestamp);
};

const toSentence = (value: string) => {
  const text = (value || '').replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatActionType = (actionType: string) => toSentence(actionType);

const formatTargetType = (targetType: string) => toSentence(targetType);

const formatDetailKey = (key: string) => toSentence(key);

const formatDetailsTitle = (details: Record<string, unknown>) =>
  Object.entries(details)
    .map(([key, value]) => `${formatDetailKey(key)}: ${value}`)
    .join('\n');

const getActionVariant = (actionType: string): NonNullable<BadgeVariants['variant']> => {
  if (actionType.includes('approve')) return 'success';
  if (actionType.includes('reject') || actionType.includes('delete')) return 'danger';
  if (actionType.includes('archive')) return 'warning';
  return 'neutral';
};

onMounted(() => {
  loadLogs();
  loadModerators();
});
</script>
