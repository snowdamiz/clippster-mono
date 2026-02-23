<template>
  <PageLayout
    title="Bug Reports"
    description="Track and manage reported issues"
    :show-header="true"
    :icon="FileText"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Bug Reports' }]"
  >
    <template #actions>
      <button class="admin-bugs__action-btn" @click="fetchBugReports">
        <RefreshCw class="admin-bugs__action-icon" />
        Refresh Bugs
      </button>
    </template>

    <div class="admin-bugs">
      <!-- Page Heading -->
      <div class="admin-bugs__heading">
        <h1 class="admin-bugs__title">Bug Reports</h1>
        <p class="admin-bugs__subtitle">Track and manage reported issues</p>
      </div>

      <!-- Stats Header with Filters -->
      <div class="admin-bugs__stats-header">
        <div class="admin-bugs__stats-info">
          <div class="admin-bugs__stats-icon">
            <FileText class="admin-bugs__stats-icon-svg" />
          </div>
          <div>
            <h2 class="admin-bugs__stats-title">Bug Reports</h2>
            <p class="admin-bugs__stats-desc">Track and manage reported issues</p>
          </div>
        </div>
        <div class="admin-bugs__filters">
          <CustomDropdown
            v-model="bugReportFilters.status"
            :options="statusOptions"
            placeholder="All Status"
            trigger-class="admin-bugs__dropdown-trigger"
            @update:modelValue="fetchBugReports"
          />
          <CustomDropdown
            v-model="bugReportFilters.severity"
            :options="severityOptions"
            placeholder="All Severity"
            trigger-class="admin-bugs__dropdown-trigger"
            @update:modelValue="fetchBugReports"
          />
          <span class="admin-bugs__stats-count">
            {{ bugReports.length }} report{{ bugReports.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- Bug Reports Table -->
      <div v-if="bugReports.length > 0" class="admin-bugs__table-wrapper">
        <div class="admin-bugs__table-scroll">
          <table class="admin-bugs__table">
            <thead class="admin-bugs__thead">
              <tr>
                <th class="admin-bugs__th">ID</th>
                <th class="admin-bugs__th">Title</th>
                <th class="admin-bugs__th">Severity</th>
                <th class="admin-bugs__th">Status</th>
                <th class="admin-bugs__th">User</th>
                <th class="admin-bugs__th">Created</th>
                <th class="admin-bugs__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-bugs__tbody">
              <tr v-for="bugReport in bugReports" :key="bugReport.id" class="admin-bugs__row">
                <td class="admin-bugs__td">
                  <span class="admin-bugs__id">#{{ bugReport.id }}</span>
                </td>
                <td class="admin-bugs__td">
                  <div class="admin-bugs__title-cell">
                    <p class="admin-bugs__report-title">{{ bugReport.title }}</p>
                    <p class="admin-bugs__report-desc">{{ bugReport.description }}</p>
                  </div>
                </td>
                <td class="admin-bugs__td">
                  <span :class="['admin-bugs__severity', getSeverityClass(bugReport.severity)]">
                    {{ bugReport.severity.toUpperCase() }}
                  </span>
                </td>
                <td class="admin-bugs__td">
                  <span :class="['admin-bugs__status', getStatusClass(bugReport.status)]">
                    {{ bugReport.status.replace('_', ' ').toUpperCase() }}
                  </span>
                </td>
                <td class="admin-bugs__td">
                  <code class="admin-bugs__wallet">{{ formatWalletAddress(bugReport.user_wallet_address) }}</code>
                </td>
                <td class="admin-bugs__td">
                  <span class="admin-bugs__date">{{ formatDate(bugReport.inserted_at) }}</span>
                </td>
                <td class="admin-bugs__td">
                  <div class="admin-bugs__actions">
                    <button
                      v-if="bugReport.status !== 'resolved'"
                      class="admin-bugs__btn admin-bugs__btn--resolve"
                      :disabled="updatingBugReportId === bugReport.id"
                      @click="updateBugReportStatus(bugReport.id, 'resolved')"
                    >
                      <Loader2
                        v-if="updatingBugReportId === bugReport.id"
                        class="admin-bugs__btn-icon admin-bugs__btn-icon--spin"
                      />
                      <Check v-else class="admin-bugs__btn-icon" />
                      Resolve
                    </button>
                    <button
                      v-else
                      class="admin-bugs__btn admin-bugs__btn--reopen"
                      :disabled="updatingBugReportId === bugReport.id"
                      @click="updateBugReportStatus(bugReport.id, 'in_progress')"
                    >
                      <Loader2
                        v-if="updatingBugReportId === bugReport.id"
                        class="admin-bugs__btn-icon admin-bugs__btn-icon--spin"
                      />
                      Reopen
                    </button>
                    <button
                      class="admin-bugs__btn admin-bugs__btn--delete"
                      :disabled="deletingBugReportId === bugReport.id"
                      @click="confirmDeleteBugReport(bugReport)"
                    >
                      <Loader2
                        v-if="deletingBugReportId === bugReport.id"
                        class="admin-bugs__btn-icon admin-bugs__btn-icon--spin"
                      />
                      <Trash2 v-else class="admin-bugs__btn-icon" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-bugs__empty">
        <div class="admin-bugs__empty-icon">
          <FileText class="admin-bugs__empty-icon-svg" />
        </div>
        <p class="admin-bugs__empty-text">No bug reports found</p>
        <button class="admin-bugs__empty-btn" @click="fetchBugReports">Refresh Bug Reports</button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteBugReportDialog"
      title="Delete Bug Report"
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
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import { FileText, RefreshCw, Check, Trash2, Loader2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
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
  const bugReportToDelete = ref<BugReport | null>(null);

  const statusOptions = [
    { label: 'All Status', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'Closed', value: 'closed' }
  ];

  const severityOptions = [
    { label: 'All Severity', value: '' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' }
  ];

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const fetchBugReports = async () => {
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

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'admin-bugs__severity--low';
      case 'medium':
        return 'admin-bugs__severity--medium';
      case 'high':
        return 'admin-bugs__severity--high';
      case 'critical':
        return 'admin-bugs__severity--critical';
      default:
        return '';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'open':
        return 'admin-bugs__status--open';
      case 'in_progress':
        return 'admin-bugs__status--in-progress';
      case 'resolved':
        return 'admin-bugs__status--resolved';
      case 'closed':
        return 'admin-bugs__status--closed';
      default:
        return '';
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

<style scoped>
  .admin-bugs {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-bugs__heading {
    margin-bottom: 0.5rem;
  }

  .admin-bugs__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-bugs__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-bugs__action-btn {
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

  .admin-bugs__action-btn:hover {
    opacity: 0.9;
  }

  .admin-bugs__action-icon {
    width: 14px;
    height: 14px;
  }

  .admin-bugs__stats-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  @media (min-width: 640px) {
    .admin-bugs__stats-header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .admin-bugs__stats-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-bugs__stats-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .admin-bugs__stats-icon-svg {
    width: 20px;
    height: 20px;
    color: #f87171;
  }

  .admin-bugs__stats-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-bugs__stats-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-bugs__filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  /* Dropdown trigger styling */
  :deep(.admin-bugs__dropdown-trigger) {
    height: 38px !important;
    padding: 0 0.75rem !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 6px !important;
    font-size: 0.875rem !important;
    transition: all 150ms ease !important;
  }

  :deep(.admin-bugs__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  :deep(.admin-bugs__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.admin-bugs__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .admin-bugs__stats-count {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .admin-bugs__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-bugs__table-scroll {
    overflow-x: auto;
  }

  .admin-bugs__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-bugs__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }

  .admin-bugs__th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-bugs__tbody {
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-bugs__row {
    transition: background-color 150ms ease;
  }
  .admin-bugs__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }
  .admin-bugs__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }

  .admin-bugs__td {
    padding: 1rem 1.25rem;
    white-space: nowrap;
  }

  .admin-bugs__id {
    font-size: 0.875rem;
    font-family: monospace;
    color: var(--sidebar-text-muted);
  }

  .admin-bugs__title-cell {
    max-width: 20rem;
  }

  .admin-bugs__report-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .admin-bugs__report-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
  }

  .admin-bugs__severity {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-bugs__severity--low {
    background-color: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .admin-bugs__severity--medium {
    background-color: rgba(234, 179, 8, 0.2);
    color: #fde047;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }
  .admin-bugs__severity--high {
    background-color: rgba(249, 115, 22, 0.2);
    color: #fdba74;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }
  .admin-bugs__severity--critical {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .admin-bugs__status {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-bugs__status--open {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .admin-bugs__status--in-progress {
    background-color: rgba(234, 179, 8, 0.2);
    color: #fde047;
    border: 1px solid rgba(234, 179, 8, 0.3);
  }
  .admin-bugs__status--resolved {
    background-color: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .admin-bugs__status--closed {
    background-color: rgba(161, 161, 170, 0.2);
    color: #a1a1aa;
    border: 1px solid rgba(161, 161, 170, 0.3);
  }

  .admin-bugs__wallet {
    font-size: 0.75rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    font-family: monospace;
    color: var(--sidebar-text);
  }

  .admin-bugs__date {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-bugs__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .admin-bugs__btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-bugs__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-bugs__btn--resolve {
    background: linear-gradient(to right, #16a34a, #059669);
  }
  .admin-bugs__btn--reopen {
    background: linear-gradient(to right, #d97706, #ea580c);
  }
  .admin-bugs__btn--delete {
    background: linear-gradient(to right, #dc2626, #db2777);
  }

  .admin-bugs__btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-bugs__btn-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }
  .admin-bugs__btn-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-bugs__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .admin-bugs__empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
    margin-bottom: 1rem;
  }

  .admin-bugs__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #f87171;
  }

  .admin-bugs__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .admin-bugs__empty-btn {
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

  .admin-bugs__empty-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
