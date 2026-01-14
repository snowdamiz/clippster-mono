<template>
  <PageLayout
    title="Organization Applications"
    description="Review and manage organization account applications"
    :show-header="true"
    :icon="FileText"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Organization Applications' }]"
  >
    <template #actions>
      <button class="admin-apps__action-btn" @click="fetchApplications">
        <RefreshCw class="admin-apps__action-icon" />
        Refresh
      </button>
    </template>

    <div class="admin-apps">
      <!-- Page Heading -->
      <div class="admin-apps__heading">
        <h1 class="admin-apps__title">Organization Applications</h1>
        <p class="admin-apps__subtitle">Review and approve organization account requests</p>
      </div>

      <!-- Stats Header with Filters -->
      <div class="admin-apps__stats-header">
        <div class="admin-apps__stats-info">
          <div class="admin-apps__stats-icon">
            <FileText class="admin-apps__stats-icon-svg" />
          </div>
          <div>
            <h2 class="admin-apps__stats-title">Applications</h2>
            <p class="admin-apps__stats-desc">Manage organization account requests</p>
          </div>
        </div>
        <div class="admin-apps__filters">
          <select v-model="filters.status" class="admin-apps__filter-select" @change="fetchApplications">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <span class="admin-apps__stats-count">
            {{ applications.length }} application{{ applications.length !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- Applications Table -->
      <div v-if="applications.length > 0" class="admin-apps__table-wrapper">
        <div class="admin-apps__table-scroll">
          <table class="admin-apps__table">
            <thead class="admin-apps__thead">
              <tr>
                <th class="admin-apps__th">ID</th>
                <th class="admin-apps__th">Organization Name</th>
                <th class="admin-apps__th">User</th>
                <th class="admin-apps__th">Team Size</th>
                <th class="admin-apps__th">Status</th>
                <th class="admin-apps__th">Submitted</th>
                <th class="admin-apps__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-apps__tbody">
              <tr v-for="app in applications" :key="app.id" class="admin-apps__row">
                <td class="admin-apps__td">
                  <span class="admin-apps__id">#{{ app.id }}</span>
                </td>
                <td class="admin-apps__td">
                  <div class="admin-apps__org-cell">
                    <p class="admin-apps__org-name">{{ app.name }}</p>
                    <p class="admin-apps__org-desc">{{ app.description }}</p>
                  </div>
                </td>
                <td class="admin-apps__td">
                  <div class="admin-apps__user-cell">
                    <p class="admin-apps__user-email">{{ app.user?.email || 'N/A' }}</p>
                    <p v-if="app.contact_email !== app.user?.email" class="admin-apps__user-contact">
                      {{ app.contact_email }}
                    </p>
                  </div>
                </td>
                <td class="admin-apps__td">
                  <span class="admin-apps__team-size">{{ app.team_size }}</span>
                </td>
                <td class="admin-apps__td">
                  <span :class="['admin-apps__status', getStatusClass(app.status)]">
                    {{ app.status.toUpperCase() }}
                  </span>
                </td>
                <td class="admin-apps__td">
                  <span class="admin-apps__date">{{ formatDate(app.inserted_at) }}</span>
                </td>
                <td class="admin-apps__td">
                  <div class="admin-apps__actions">
                    <button
                      v-if="app.status === 'pending'"
                      class="admin-apps__btn admin-apps__btn--view"
                      @click="viewApplication(app)"
                    >
                      <Eye class="admin-apps__btn-icon" />
                      View
                    </button>
                    <button
                      class="admin-apps__btn admin-apps__btn--delete"
                      :disabled="deletingAppId === app.id"
                      @click="confirmDeleteApplication(app)"
                    >
                      <Loader2
                        v-if="deletingAppId === app.id"
                        class="admin-apps__btn-icon admin-apps__btn-icon--spin"
                      />
                      <Trash2 v-else class="admin-apps__btn-icon" />
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
      <div v-else class="admin-apps__empty">
        <div class="admin-apps__empty-icon">
          <FileText class="admin-apps__empty-icon-svg" />
        </div>
        <p class="admin-apps__empty-text">No applications found</p>
        <button class="admin-apps__empty-btn" @click="fetchApplications">Refresh Applications</button>
      </div>
    </div>

    <!-- View/Review Application Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="selectedApp" class="admin-apps__modal-overlay" @click.self="selectedApp = null">
          <Transition name="dialog" appear>
            <div v-if="selectedApp" class="admin-apps__modal" role="dialog" aria-modal="true">
              <div class="admin-apps__modal-accent"></div>

              <div class="admin-apps__modal-header">
                <button
                  class="admin-apps__modal-close"
                  @click="selectedApp = null"
                  :disabled="processing"
                  title="Close"
                >
                  <X :size="18" />
                </button>
              </div>

              <div class="admin-apps__modal-content">
                <!-- Header Card with Logo and Name -->
                <div class="admin-apps__modal-header-card">
                  <div v-if="selectedApp.logo_url" class="admin-apps__modal-logo">
                    <img :src="selectedApp.logo_url" :alt="selectedApp.name" class="admin-apps__modal-logo-img" />
                  </div>
                  <div v-else class="admin-apps__modal-logo admin-apps__modal-logo--fallback">
                    <Building2 :size="32" />
                  </div>
                  <div class="admin-apps__modal-header-info">
                    <h2 class="admin-apps__modal-title">{{ selectedApp.name }}</h2>
                    <span
                      :class="[
                        'admin-apps__modal-status',
                        selectedApp.status === 'pending'
                          ? 'admin-apps__modal-status--pending'
                          : selectedApp.status === 'approved'
                            ? 'admin-apps__modal-status--approved'
                            : 'admin-apps__modal-status--rejected',
                      ]"
                    >
                      {{ selectedApp.status }}
                    </span>
                  </div>
                </div>

                <!-- Organization Details -->
                <div class="admin-apps__modal-section">
                  <h3 class="admin-apps__modal-section-title">Organization Details</h3>
                  <div class="admin-apps__modal-grid">
                    <div class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">Description</span>
                      <p class="admin-apps__modal-value">{{ selectedApp.description }}</p>
                    </div>
                    <div v-if="selectedApp.website" class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">Website</span>
                      <a :href="selectedApp.website" target="_blank" class="admin-apps__modal-link">
                        {{ selectedApp.website }}
                      </a>
                    </div>
                    <div class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">Team Size</span>
                      <span class="admin-apps__modal-value">{{ selectedApp.team_size }} members</span>
                    </div>
                  </div>
                </div>

                <!-- Use Case -->
                <div class="admin-apps__modal-section">
                  <h3 class="admin-apps__modal-section-title">Use Case</h3>
                  <div class="admin-apps__modal-use-case">
                    <p class="admin-apps__modal-text">{{ selectedApp.use_case }}</p>
                  </div>
                </div>

                <!-- Applicant Information -->
                <div class="admin-apps__modal-section">
                  <h3 class="admin-apps__modal-section-title">Applicant Information</h3>
                  <div class="admin-apps__modal-grid">
                    <div class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">User Email</span>
                      <span class="admin-apps__modal-value">{{ selectedApp.user?.email || 'N/A' }}</span>
                    </div>
                    <div class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">Contact Email</span>
                      <span class="admin-apps__modal-value">{{ selectedApp.contact_email }}</span>
                    </div>
                    <div v-if="selectedApp.user?.wallet_address" class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">Wallet Address</span>
                      <code class="admin-apps__modal-code">
                        {{ formatWalletAddress(selectedApp.user.wallet_address) }}
                      </code>
                    </div>
                    <div class="admin-apps__modal-grid-item">
                      <span class="admin-apps__modal-label">Submitted</span>
                      <span class="admin-apps__modal-value">{{ formatDate(selectedApp.inserted_at) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Admin Notes Input (for pending) -->
                <div v-if="selectedApp.status === 'pending'" class="admin-apps__modal-section">
                  <h3 class="admin-apps__modal-section-title">Admin Notes (Optional)</h3>
                  <textarea
                    v-model="adminNotes"
                    rows="3"
                    placeholder="Add notes about this decision (visible to the applicant)..."
                    class="admin-apps__modal-textarea"
                  ></textarea>
                </div>

                <!-- Existing Review Notes -->
                <div v-if="selectedApp.admin_notes" class="admin-apps__modal-section">
                  <h3 class="admin-apps__modal-section-title">Review Notes</h3>
                  <div class="admin-apps__modal-review-box">
                    <p class="admin-apps__modal-text">{{ selectedApp.admin_notes }}</p>
                    <div v-if="selectedApp.reviewed_by" class="admin-apps__modal-meta">
                      Reviewed by {{ selectedApp.reviewed_by.email }} on {{ formatDate(selectedApp.reviewed_at) }}
                    </div>
                  </div>
                </div>

                <!-- Error Alert -->
                <div v-if="actionError" class="admin-apps__modal-alert admin-apps__modal-alert--error">
                  <AlertCircle :size="16" />
                  <p class="admin-apps__modal-alert-text">{{ actionError }}</p>
                </div>
              </div>

              <div v-if="selectedApp.status === 'pending'" class="admin-apps__modal-footer">
                <button
                  @click="rejectApplication"
                  :disabled="processing"
                  class="admin-apps__modal-btn admin-apps__modal-btn--secondary"
                >
                  <Loader2 v-if="processing && actionType === 'reject'" :size="16" class="admin-apps__spinner" />
                  <X v-else :size="16" />
                  Reject
                </button>
                <button
                  @click="approveApplication"
                  :disabled="processing"
                  class="admin-apps__modal-btn admin-apps__modal-btn--primary"
                >
                  <Loader2 v-if="processing && actionType === 'approve'" :size="16" class="admin-apps__spinner" />
                  <Check v-else :size="16" />
                  Approve & Create Organization
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Application"
      :message="'Are you sure you want to delete the application for'"
      :item-name="appToDelete?.name || ''"
      suffix="?"
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteDialogClose"
      @confirm="deleteApplicationConfirmed"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { FileText, RefreshCw, Eye, Trash2, Loader2, X, Building2, AlertCircle, Check } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import api from '@/services/api';

  interface Application {
    id: number;
    name: string;
    description: string;
    website: string | null;
    team_size: string;
    use_case: string;
    contact_email: string;
    logo_url: string | null;
    status: string;
    admin_notes: string | null;
    user: {
      id: number;
      email: string;
      name: string | null;
      wallet_address: string | null;
    } | null;
    reviewed_by: {
      id: number;
      email: string;
      name: string | null;
    } | null;
    reviewed_at: string | null;
    inserted_at: string;
    updated_at: string;
  }

  const applications = ref<Application[]>([]);
  const filters = ref({ status: '' });
  const deletingAppId = ref<number | null>(null);
  const showDeleteDialog = ref(false);
  const appToDelete = ref<Application | null>(null);
  const selectedApp = ref<Application | null>(null);
  const adminNotes = ref('');
  const processing = ref(false);
  const actionType = ref<'approve' | 'reject' | null>(null);
  const actionError = ref<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const fetchApplications = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.value.status) {
        params.append('status', filters.value.status);
      }

      const response = await api.get(`/admin/organization-applications?${params}`);
      const data = response.data;

      if (data.success) {
        applications.value = data.applications || [];
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  };

  const viewApplication = (app: Application) => {
    selectedApp.value = app;
    adminNotes.value = '';
    actionError.value = null;
  };

  const approveApplication = async () => {
    if (!selectedApp.value || processing.value) return;

    processing.value = true;
    actionType.value = 'approve';
    actionError.value = null;

    try {
      const response = await api.put(`/admin/organization-applications/${selectedApp.value.id}/approve`, {
        admin_notes: adminNotes.value.trim() || null,
      });

      const data = response.data;

      if (data.success) {
        await fetchApplications();
        selectedApp.value = null;
        adminNotes.value = '';
      } else {
        actionError.value = data.error || 'Failed to approve application';
      }
    } catch (error: any) {
      console.error('Failed to approve application:', error);
      actionError.value = error.response?.data?.error || 'An error occurred while approving the application';
    } finally {
      processing.value = false;
      actionType.value = null;
    }
  };

  const rejectApplication = async () => {
    if (!selectedApp.value || processing.value) return;

    processing.value = true;
    actionType.value = 'reject';
    actionError.value = null;

    try {
      const response = await api.put(`/admin/organization-applications/${selectedApp.value.id}/reject`, {
        admin_notes: adminNotes.value.trim() || null,
      });

      const data = response.data;

      if (data.success) {
        await fetchApplications();
        selectedApp.value = null;
        adminNotes.value = '';
      } else {
        actionError.value = data.error || 'Failed to reject application';
      }
    } catch (error: any) {
      console.error('Failed to reject application:', error);
      actionError.value = error.response?.data?.error || 'An error occurred while rejecting the application';
    } finally {
      processing.value = false;
      actionType.value = null;
    }
  };

  const confirmDeleteApplication = (app: Application) => {
    appToDelete.value = app;
    showDeleteDialog.value = true;
  };

  const handleDeleteDialogClose = () => {
    showDeleteDialog.value = false;
    appToDelete.value = null;
  };

  const deleteApplicationConfirmed = async () => {
    if (!appToDelete.value) return;

    deletingAppId.value = appToDelete.value.id;

    try {
      const response = await api.delete(`/admin/organization-applications/${appToDelete.value.id}`);
      const data = response.data;

      if (data.success) {
        await fetchApplications();
      }
    } catch (error) {
      console.error('Failed to delete application:', error);
    } finally {
      deletingAppId.value = null;
      showDeleteDialog.value = false;
      appToDelete.value = null;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'admin-apps__status--pending';
      case 'approved':
        return 'admin-apps__status--approved';
      case 'rejected':
        return 'admin-apps__status--rejected';
      default:
        return '';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatWalletAddress = (address: string | null) => {
    if (!address) return 'N/A';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  onMounted(() => {
    fetchApplications();
  });
</script>

<style scoped>
  /* Use the same styles as AdminBugReports.vue */
  .admin-apps {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-apps__heading {
    margin-bottom: 0.5rem;
  }

  .admin-apps__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .admin-apps__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .admin-apps__action-btn {
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
    background-color: transparent;
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-apps__action-btn:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .admin-apps__action-icon {
    width: 14px;
    height: 14px;
  }

  .admin-apps__stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-apps__stats-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .admin-apps__stats-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-apps__stats-icon-svg {
    width: 24px;
    height: 24px;
    color: var(--sidebar-accent);
  }

  .admin-apps__stats-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .admin-apps__stats-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-apps__filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-apps__filter-select {
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-apps__filter-select:focus {
    outline: none;
    border-color: var(--sidebar-accent);
  }

  .admin-apps__stats-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 6px;
  }

  .admin-apps__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-apps__table-scroll {
    overflow-x: auto;
  }

  .admin-apps__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-apps__thead {
    background-color: var(--sidebar-hover);
  }

  .admin-apps__th {
    padding: 0.875rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .admin-apps__tbody {
    background-color: var(--sidebar-surface);
  }

  .admin-apps__row {
    border-bottom: 1px solid var(--sidebar-border);
    transition: background-color 150ms ease;
  }

  .admin-apps__row:hover {
    background-color: var(--sidebar-hover);
  }

  .admin-apps__td {
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .admin-apps__id {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .admin-apps__org-cell {
    max-width: 300px;
  }

  .admin-apps__org-name {
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .admin-apps__org-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .admin-apps__user-cell {
    max-width: 200px;
  }

  .admin-apps__user-email {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .admin-apps__user-contact {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-apps__team-size {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  .admin-apps__status {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .admin-apps__status--pending {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .admin-apps__status--approved {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .admin-apps__status--rejected {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .admin-apps__date {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .admin-apps__actions {
    display: flex;
    gap: 0.5rem;
  }

  .admin-apps__btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-apps__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-apps__btn--view {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .admin-apps__btn--view:hover:not(:disabled) {
    background-color: rgba(6, 182, 212, 0.25);
  }

  .admin-apps__btn--delete {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .admin-apps__btn--delete:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.25);
  }

  .admin-apps__btn-icon {
    width: 14px;
    height: 14px;
  }

  .admin-apps__btn-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .admin-apps__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.5rem;
    text-align: center;
  }

  .admin-apps__empty-icon {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    background-color: var(--sidebar-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .admin-apps__empty-icon-svg {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .admin-apps__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .admin-apps__empty-btn {
    padding: 0.625rem 1.25rem;
    background-color: var(--sidebar-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .admin-apps__empty-btn:hover {
    opacity: 0.9;
  }

  /* Modal Styles */
  .admin-apps__modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .admin-apps__modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .admin-apps__modal-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .admin-apps__modal-header {
    position: relative;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .admin-apps__modal-close {
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
    z-index: 10;
  }

  .admin-apps__modal-close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .admin-apps__modal-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-apps__modal-header-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-bottom: 1.5rem;
  }

  .admin-apps__modal-header-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-apps__modal-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .admin-apps__modal-status {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .admin-apps__modal-status--pending {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .admin-apps__modal-status--approved {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .admin-apps__modal-status--rejected {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .admin-apps__modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .admin-apps__modal-content::-webkit-scrollbar {
    width: 6px;
  }

  .admin-apps__modal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .admin-apps__modal-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .admin-apps__modal-section {
    margin-bottom: 1.5rem;
  }

  .admin-apps__modal-section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-apps__modal-field {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .admin-apps__modal-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    display: block;
    margin-bottom: 0.25rem;
  }

  .admin-apps__modal-value {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    line-height: 1.5;
  }

  .admin-apps__modal-link {
    font-size: 0.8125rem;
    color: var(--sidebar-accent);
    text-decoration: none;
  }

  .admin-apps__modal-link:hover {
    text-decoration: underline;
  }

  .admin-apps__modal-code {
    font-family: monospace;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background-color: var(--sidebar-hover);
    border-radius: 4px;
    color: var(--sidebar-text);
  }

  .admin-apps__modal-text {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    line-height: 1.6;
    margin: 0;
  }

  .admin-apps__modal-logo {
    width: 72px;
    height: 72px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .admin-apps__modal-logo--fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, var(--sidebar-hover) 100%);
    color: var(--sidebar-text-muted);
  }

  .admin-apps__modal-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .admin-apps__modal-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .admin-apps__modal-grid-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .admin-apps__modal-use-case {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-apps__modal-review-box {
    padding: 1rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
  }

  .admin-apps__modal-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.5rem;
    font-style: italic;
  }

  .admin-apps__modal-textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    resize: none;
    transition: all 150ms ease;
  }

  .admin-apps__modal-textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .admin-apps__modal-textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .admin-apps__modal-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    margin-top: 1rem;
  }

  .admin-apps__modal-alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .admin-apps__modal-alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  .admin-apps__modal-footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-apps__modal-btn {
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

  .admin-apps__modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-apps__modal-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-apps__modal-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .admin-apps__modal-btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .admin-apps__modal-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-apps__spinner {
    animation: spin 0.8s linear infinite;
  }

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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
