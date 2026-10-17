<template>
  <PageLayout
    title="Organization applications"
    description="Review and manage organization account applications"
    :icon="FileText"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Organization applications' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh applications" :disabled="loading" @click="fetchApplications">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar :count="applications.length" count-label="application">
        <SegmentedControl
          :model-value="filters.status"
          :options="statusOptions"
          size="sm"
          @update:model-value="setStatusFilter"
        />
      </AdminFilterBar>
    </template>

    <div class="px-5 py-4">
      <DataTable
        :columns="columns"
        :rows="applications"
        row-key="id"
        :loading="loading"
        clickable
        :empty-icon="FileText"
        :empty-title="filters.status ? `No ${filters.status} applications` : 'No applications found'"
        empty-description="New organization requests will show up here for review."
        @row-click="viewApplication"
      >
        <template #cell-id="{ row: app }">
          <span class="tabular text-xs text-fg-subtle">#{{ app.id }}</span>
        </template>

        <template #cell-organization="{ row: app }">
          <div class="flex min-w-0 items-center gap-2.5">
            <Avatar :name="app.name" :src="app.logo_url" :icon="Building2" shape="square" size="sm" />
            <div class="min-w-0">
              <p class="truncate font-medium text-fg">{{ app.name }}</p>
              <p class="truncate text-xs text-fg-subtle">{{ app.description }}</p>
            </div>
          </div>
        </template>

        <template #cell-applicant="{ row: app }">
          <p class="truncate text-fg">{{ app.user?.email || 'N/A' }}</p>
          <p v-if="app.contact_email !== app.user?.email" class="truncate text-xs text-fg-subtle">
            {{ app.contact_email }}
          </p>
        </template>

        <template #cell-team_size="{ row: app }">
          <span class="tabular text-fg-muted">{{ app.team_size }}</span>
        </template>

        <template #cell-status="{ row: app }">
          <Badge :variant="statusVariant(app.status)">{{ formatStatus(app.status) }}</Badge>
        </template>

        <template #cell-submitted="{ row: app }">
          <span class="tabular block truncate text-fg">{{ formatDay(app.inserted_at) }}</span>
          <span class="tabular block truncate text-xs text-fg-subtle">{{ formatClock(app.inserted_at) }}</span>
        </template>

        <template #actions="{ row: app }">
          <AdminRowActions :label="`Actions for ${app.name}`" :loading="deletingAppId === app.id">
            <AdminActionItem :icon="Eye" @select="viewApplication(app)">
              {{ app.status === 'pending' ? 'Review' : 'View details' }}
            </AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="Trash2" destructive @select="confirmDeleteApplication(app)">Delete</AdminActionItem>
          </AdminRowActions>
        </template>
      </DataTable>
    </div>

    <!-- Review application -->
    <Modal
      :open="!!selectedApp"
      :title="selectedApp?.name || 'Application'"
      :description="selectedApp ? `Organization application · submitted ${formatDate(selectedApp.inserted_at)}` : undefined"
      size="lg"
      :dismissible="!processing"
      body-class="flex flex-col gap-4"
      @close="selectedApp = null"
    >
      <template v-if="selectedApp">
        <div class="flex min-w-0 items-center gap-3">
          <Avatar :name="selectedApp.name" :src="selectedApp.logo_url" :icon="Building2" shape="square" size="md" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-fg">{{ selectedApp.name }}</p>
            <a
              v-if="selectedApp.website"
              :href="selectedApp.website"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex max-w-full items-center gap-1 text-xs text-brand hover:text-brand-hover hover:underline"
            >
              <span class="truncate">{{ selectedApp.website }}</span>
              <ExternalLink class="size-3 shrink-0" />
            </a>
          </div>
          <Badge :variant="statusVariant(selectedApp.status)" size="md">{{ formatStatus(selectedApp.status) }}</Badge>
        </div>

        <div class="grid gap-x-6 border-y border-line-subtle sm:grid-cols-2">
          <div>
            <InfoRow label="Team size">{{ selectedApp.team_size }} members</InfoRow>
            <InfoRow label="Submitted">{{ formatDate(selectedApp.inserted_at) }}</InfoRow>
          </div>
          <div>
            <InfoRow label="User email">{{ selectedApp.user?.email || 'N/A' }}</InfoRow>
            <InfoRow label="Contact email">{{ selectedApp.contact_email }}</InfoRow>
            <InfoRow v-if="selectedApp.user?.wallet_address" label="Wallet" mono>
              {{ formatWalletAddress(selectedApp.user.wallet_address) }}
            </InfoRow>
          </div>
        </div>

        <section>
          <h3 class="eyebrow mb-1.5">Description</h3>
          <p class="whitespace-pre-wrap text-sm text-fg">{{ selectedApp.description }}</p>
        </section>

        <section>
          <h3 class="eyebrow mb-1.5">Use case</h3>
          <p class="whitespace-pre-wrap text-sm text-fg">
            {{ selectedApp.use_case }}
          </p>
        </section>

        <Field
          v-if="selectedApp.status === 'pending'"
          label="Admin notes"
          for="org-app-notes"
          hint="Optional. Visible to the applicant."
        >
          <Textarea
            id="org-app-notes"
            v-model="adminNotes"
            rows="3"
            placeholder="Add notes about this decision…"
          />
        </Field>

        <section v-if="selectedApp.admin_notes">
          <h3 class="eyebrow mb-1.5">Review notes</h3>
          <p class="whitespace-pre-wrap text-sm text-fg">{{ selectedApp.admin_notes }}</p>
          <p v-if="selectedApp.reviewed_by" class="mt-1 text-xs text-fg-subtle">
            Reviewed by {{ selectedApp.reviewed_by.email }} on {{ formatDate(selectedApp.reviewed_at) }}
          </p>
        </section>

        <Alert v-if="actionError" variant="destructive">
          <AlertCircle />
          <AlertDescription>{{ actionError }}</AlertDescription>
        </Alert>
      </template>

      <template #footer>
        <template v-if="selectedApp?.status === 'pending'">
          <Button variant="destructive-soft" :loading="processing && actionType === 'reject'" :disabled="processing" @click="rejectApplication">
            <X v-if="!(processing && actionType === 'reject')" />
            Reject
          </Button>
          <Button variant="primary" :loading="processing && actionType === 'approve'" :disabled="processing" @click="approveApplication">
            <Check v-if="!(processing && actionType === 'approve')" />
            Approve &amp; create organization
          </Button>
        </template>
        <Button v-else variant="ghost" @click="selectedApp = null">Close</Button>
      </template>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete application"
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
  import { formatDateTime, formatDate as formatDay, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import { FileText, RefreshCw, Eye, Trash2, X, Building2, AlertCircle, Check, ExternalLink } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Textarea } from '@/components/ui/textarea';
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import { InfoRow } from '@/components/ui/info-list';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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

  const statusOptions: SegmentedOption<string>[] = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ];

  const loading = ref(false);

  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', width: '64px' },
    { key: 'organization', label: 'Organization' },
    { key: 'applicant', label: 'Applicant', width: '28%', hideBelow: 'md' },
    { key: 'team_size', label: 'Team', width: '72px', hideBelow: 'md' },
    { key: 'status', label: 'Status', width: '100px' },
    { key: 'submitted', label: 'Submitted', width: '120px' },
  ];

  const setStatusFilter = (status: string) => {
    filters.value.status = status;
    fetchApplications();
  };

  const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : 'https://api.clippster.app');

  const fetchApplications = async () => {
    loading.value = true;
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
    } finally {
      loading.value = false;
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return formatDateTime(dateString);
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
