<template>
  <PageLayout
    title="Bug reports"
    description="Track and manage reported issues"
    :icon="FileText"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Bug reports' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh bug reports" :disabled="loading" @click="fetchBugReports">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar :count="bugReports.length" count-label="report">
        <div class="w-36">
          <CustomDropdown
            v-model="bugReportFilters.status"
            :options="statusOptions"
            placeholder="All statuses"
            size="sm"
            @update:model-value="fetchBugReports"
          />
        </div>
        <div class="w-36">
          <CustomDropdown
            v-model="bugReportFilters.severity"
            :options="severityOptions"
            placeholder="All severities"
            size="sm"
            @update:model-value="fetchBugReports"
          />
        </div>
      </AdminFilterBar>
    </template>

    <div class="px-5 py-4">
      <DataTable
        :columns="columns"
        :rows="bugReports"
        row-key="id"
        :loading="loading"
        clickable
        :expanded="(report) => expandedId === report.id"
        :empty-icon="Bug"
        :empty-title="bugReportFilters.status || bugReportFilters.severity ? 'No reports match these filters' : 'No bug reports'"
        empty-description="Reports submitted from the app will show up here."
        @row-click="(report) => (expandedId = expandedId === report.id ? null : report.id)"
      >
        <template #cell-id="{ row: report }">
          <span class="tabular text-xs text-fg-subtle">#{{ report.id }}</span>
        </template>

        <template #cell-title="{ row: report }">
          <div class="flex min-w-0 items-center gap-1.5">
            <ChevronRight
              class="size-3.5 shrink-0 text-fg-subtle transition-transform"
              :class="{ 'rotate-90': expandedId === report.id }"
            />
            <div class="min-w-0">
              <p class="truncate font-medium text-fg">{{ report.title }}</p>
              <p class="truncate text-xs text-fg-subtle">{{ report.description }}</p>
            </div>
          </div>
        </template>

        <template #cell-severity="{ row: report }">
          <Badge :variant="severityVariant(report.severity)">
            <AlertOctagon v-if="report.severity === 'critical'" />
            {{ formatStatus(report.severity) }}
          </Badge>
        </template>

        <template #cell-status="{ row: report }">
          <Badge :variant="statusVariant(report.status)">{{ formatStatus(report.status) }}</Badge>
        </template>

        <template #cell-user="{ row: report }">
          <code
            v-if="report.user_wallet_address"
            class="block truncate font-mono text-xs text-fg-muted"
            :title="report.user_wallet_address"
          >
            {{ formatWalletAddress(report.user_wallet_address) }}
          </code>
          <span v-else class="text-fg-subtle">—</span>
        </template>

        <template #cell-created="{ row: report }">
          <span class="tabular block truncate text-fg">{{ formatDay(report.inserted_at) }}</span>
          <span class="tabular block truncate text-xs text-fg-subtle">{{ formatClock(report.inserted_at) }}</span>
        </template>

        <template #actions="{ row: report }">
          <AdminRowActions
            :label="`Actions for report #${report.id}`"
            :loading="updatingBugReportId === report.id || deletingBugReportId === report.id"
          >
            <AdminActionItem
              v-if="report.status !== 'resolved'"
              :icon="Check"
              @select="updateBugReportStatus(report.id, 'resolved')"
            >
              Mark resolved
            </AdminActionItem>
            <AdminActionItem v-else :icon="RotateCcw" @select="updateBugReportStatus(report.id, 'in_progress')">
              Reopen
            </AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="Trash2" destructive @select="confirmDeleteBugReport(report)">Delete</AdminActionItem>
          </AdminRowActions>
        </template>

        <template #expanded="{ row: report }">
          <div class="flex animate-enter flex-col gap-3 px-4 py-3.5 pl-24 text-sm">
            <div>
              <p class="eyebrow mb-1">Description</p>
              <p class="whitespace-pre-wrap text-fg">{{ report.description }}</p>
            </div>
            <div
              v-if="report.expected_behavior || report.actual_behavior"
              class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3"
            >
              <div v-if="report.expected_behavior">
                <p class="eyebrow mb-1">Expected</p>
                <p class="whitespace-pre-wrap text-fg-muted">{{ report.expected_behavior }}</p>
              </div>
              <div v-if="report.actual_behavior">
                <p class="eyebrow mb-1">Actual</p>
                <p class="whitespace-pre-wrap text-fg-muted">{{ report.actual_behavior }}</p>
              </div>
            </div>
            <p class="text-xs text-fg-subtle">
              Reported {{ formatDate(report.inserted_at) }}
              <template v-if="report.updated_at && report.updated_at !== report.inserted_at">
                · Updated {{ formatDate(report.updated_at) }}
              </template>
            </p>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteBugReportDialog"
      title="Delete bug report"
      :message="'Are you sure you want to delete the bug report'"
      :item-name="bugReportToDelete?.title || ''"
      suffix="?"
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteBugReportDialogClose"
      @confirm="deleteBugReportConfirmed"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { formatDateTime, formatDate as formatDay, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import { FileText, RefreshCw, Check, Trash2, Bug, ChevronRight, RotateCcw, AlertOctagon } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import { useAuthStore } from '@/stores/auth';

  interface BugReport {
    id: number;
    title: string;
    description: string;
    severity: string;
    expected_behavior: string | null;
    actual_behavior: string | null;
    user_wallet_address: string;
    status: string;
    inserted_at: string;
    updated_at: string;
  }

  const authStore = useAuthStore();
  const bugReports = ref<BugReport[]>([]);
  const bugReportFilters = ref({ status: '', severity: '' });
  const updatingBugReportId = ref<number | null>(null);
  const deletingBugReportId = ref<number | null>(null);
  const showDeleteBugReportDialog = ref(false);
  const loading = ref(false);
  const expandedId = ref<number | null>(null);

  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', width: '64px' },
    { key: 'title', label: 'Report' },
    { key: 'severity', label: 'Severity', width: '104px' },
    { key: 'status', label: 'Status', width: '112px' },
    { key: 'user', label: 'User', width: '120px', hideBelow: 'md' },
    { key: 'created', label: 'Created', width: '120px', hideBelow: 'md' },
  ];
  const bugReportToDelete = ref<BugReport | null>(null);

  const statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'In progress', value: 'in_progress' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Closed', value: 'closed' }
  ];

  const severityOptions = [
    { label: 'All severities', value: '' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' }
  ];

  const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : 'https://api.clippster.app');

  const fetchBugReports = async () => {
    loading.value = true;
    try {
      const queryParams = new URLSearchParams();
      if (bugReportFilters.value.status) queryParams.append('status', bugReportFilters.value.status);
      if (bugReportFilters.value.severity) queryParams.append('severity', bugReportFilters.value.severity);

      const response = await fetch(`${API_BASE}/api/admin/bug-reports?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          bugReports.value = data.bug_reports;
        }
      }
    } catch (err) {
      console.error('Error fetching bug reports:', err);
    } finally {
      loading.value = false;
    }
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  type BadgeVariant = NonNullable<BadgeVariants['variant']>;

  const severityVariant = (severity: string): BadgeVariant => {
    switch (severity) {
      case 'medium':
        return 'warning';
      case 'high':
      case 'critical':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const updateBugReportStatus = async (bugReportId: number, status: string) => {
    updatingBugReportId.value = bugReportId;
    try {
      const response = await fetch(`${API_BASE}/api/admin/bug-reports/${bugReportId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const bugReportIndex = bugReports.value.findIndex((br) => br.id === bugReportId);
          if (bugReportIndex !== -1) {
            bugReports.value[bugReportIndex] = {
              ...bugReports.value[bugReportIndex],
              status: data.bug_report.status,
              updated_at: data.bug_report.updated_at,
            };
          }
        }
      }
    } catch (err) {
      console.error('Error updating bug report:', err);
    } finally {
      updatingBugReportId.value = null;
    }
  };

  const confirmDeleteBugReport = (bugReport: BugReport) => {
    bugReportToDelete.value = bugReport;
    showDeleteBugReportDialog.value = true;
  };

  const handleDeleteBugReportDialogClose = () => {
    showDeleteBugReportDialog.value = false;
    bugReportToDelete.value = null;
  };

  const deleteBugReportConfirmed = async () => {
    if (!bugReportToDelete.value) return;
    deletingBugReportId.value = bugReportToDelete.value.id;
    try {
      const response = await fetch(`${API_BASE}/api/admin/bug-reports/${bugReportToDelete.value.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          bugReports.value = bugReports.value.filter((br) => br.id !== bugReportToDelete.value!.id);
        }
      }
    } catch (err) {
      console.error('Error deleting bug report:', err);
    } finally {
      deletingBugReportId.value = null;
      showDeleteBugReportDialog.value = false;
      bugReportToDelete.value = null;
    }
  };

  onMounted(() => {
    fetchBugReports();
  });
</script>
