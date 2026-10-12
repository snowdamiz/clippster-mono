<template>
  <PageLayout
    title="Waitlist"
    description="Users who signed up for early access"
    :icon="UserPlus"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Waitlist' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh waitlist" :disabled="loading" @click="fetchWaitlist">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
      <Button variant="secondary" size="sm" @click="showAddUserDialog = true">
        <UserPlus />
        Add user
      </Button>
      <Button
        v-if="waitlistStats.uninvited > 0"
        variant="primary"
        size="sm"
        :loading="inviting"
        :disabled="inviting"
        @click="showBulkConfirm = true"
      >
        <Send v-if="!inviting" />
        Invite pending ({{ waitlistStats.uninvited }})
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar :count="waitlistEntries.length" count-label="email">
        <Button
          v-if="waitlistStats.uninvited > 0"
          variant="ghost"
          size="sm"
          :class="{ 'bg-surface-active text-fg': showInviteConfig }"
          :aria-expanded="showInviteConfig"
          @click="showInviteConfig = !showInviteConfig"
        >
          <SlidersHorizontal />
          Invite settings
          <span class="text-fg-subtle">· {{ inviteSummary }}</span>
        </Button>
        <template #end>
          <Button v-if="waitlistEntries.length > 0" variant="ghost" size="sm" @click="copyAllWaitlistEmails">
            <Copy />
            Copy emails
          </Button>
          <Button v-if="waitlistEntries.length > 0" variant="ghost" size="sm" @click="exportWaitlistCsv">
            <Download />
            Export CSV
          </Button>
        </template>
      </AdminFilterBar>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Stats -->
      <StatGrid :count="4">
        <StatCard label="Total signups" :value="waitlistStats.total" :icon="Users" :loading="loading && !waitlistEntries.length" />
        <StatCard label="Invited" :value="waitlistStats.invited" :icon="MailCheck" :loading="loading && !waitlistEntries.length" />
        <StatCard label="Pending" :value="waitlistStats.uninvited" :icon="Hourglass" :loading="loading && !waitlistEntries.length" />
        <StatCard label="This week" :value="waitlistStats.this_week" :icon="CalendarDays" :loading="loading && !waitlistEntries.length" />
      </StatGrid>

      <!-- Invite settings -->
      <SectionCard
        v-if="showInviteConfig && waitlistStats.uninvited > 0"
        title="Invite settings"
        description="Applied to every invite and reinvite you send from this page"
        :icon="SlidersHorizontal"
        class="animate-enter"
      >
        <template #actions>
          <Button variant="ghost" size="icon-sm" title="Close invite settings" @click="showInviteConfig = false">
            <X />
          </Button>
        </template>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <Field label="Discount percent" for="waitlist-percent">
            <Input id="waitlist-percent" v-model.number="inviteConfig.percent_off" type="number" min="0" max="100" />
          </Field>
          <Field label="Duration (months)" for="waitlist-duration">
            <Input id="waitlist-duration" v-model.number="inviteConfig.duration_months" type="number" min="1" max="12" />
          </Field>
          <Field label="Allowed tier">
            <CustomDropdown v-model="inviteConfig.allowed_tiers[0]" :options="tierOptions" />
          </Field>
        </div>
      </SectionCard>

      <!-- Error -->
      <Alert v-if="error" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Table -->
      <DataTable
        :columns="columns"
        :rows="waitlistEntries"
        row-key="id"
        :loading="loading"
        :empty-icon="Users"
        empty-title="No waitlist signups yet"
        empty-description="People who sign up for early access will appear here."
      >
        <template #cell-id="{ row: entry }">
          <span class="tabular text-xs text-fg-subtle">#{{ entry.id }}</span>
        </template>

        <template #cell-email="{ row: entry }">
          <div class="group/email flex min-w-0 items-center gap-1">
            <span class="truncate font-medium text-fg">{{ entry.email }}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover/email:opacity-100 focus-visible:opacity-100"
              :title="`Copy ${entry.email}`"
              @click="copyWaitlistEmail(entry.email)"
            >
              <Copy />
            </Button>
          </div>
        </template>

        <template #cell-signed_up="{ row: entry }">
          <span class="tabular block truncate text-fg">{{ formatDay(entry.created_at) }}</span>
          <span class="tabular block truncate text-xs text-fg-subtle">{{ formatClock(entry.created_at) }}</span>
        </template>

        <template #cell-status="{ row: entry }">
          <div class="flex min-w-0 flex-wrap items-center gap-1">
            <Badge v-if="entry.invited_at" variant="success" :title="`Invited ${formatDate(entry.invited_at)}`">
              <Check />
              Invited
            </Badge>
            <Badge v-else variant="warning">Pending</Badge>
            <Badge v-if="entry.email_delivery_error" variant="danger" :title="entry.email_delivery_error">
              <AlertTriangle />
              Email failed
            </Badge>
          </div>
          <p v-if="entry.invited_at" class="tabular mt-0.5 truncate text-xs text-fg-subtle">
            {{ formatDay(entry.invited_at) }}
          </p>
        </template>

        <template #cell-beta_code="{ row: entry }">
          <code v-if="entry.beta_code" class="block truncate font-mono text-xs text-fg">{{ entry.beta_code }}</code>
          <span v-else class="text-fg-subtle">—</span>
        </template>

        <template #cell-discount_code="{ row: entry }">
          <code v-if="entry.discount_code" class="block truncate font-mono text-xs text-fg">{{ entry.discount_code }}</code>
          <span v-else class="text-fg-subtle">—</span>
        </template>

        <template #actions="{ row: entry }">
          <AdminRowActions :label="`Actions for ${entry.email}`" :disabled="inviting">
            <AdminActionItem v-if="!entry.invited_at" :icon="Send" @select="inviteEntry(entry.id)">Send invite</AdminActionItem>
            <AdminActionItem v-else :icon="RefreshCcw" @select="reinviteEntry(entry.id)">
              Reinvite with new codes
            </AdminActionItem>
            <AdminActionItem :icon="Copy" @select="copyWaitlistEmail(entry.email)">Copy email</AdminActionItem>
          </AdminRowActions>
        </template>
      </DataTable>
    </div>

    <!-- Add user -->
    <Modal
      v-model:open="showAddUserDialog"
      title="Add user to waitlist"
      description="Enter the email address to add to the waitlist"
      :icon="UserPlus"
      size="sm"
    >
      <Field label="Email" for="waitlist-email">
        <Input
          id="waitlist-email"
          v-model="newUserEmail"
          type="email"
          placeholder="user@example.com"
          autofocus
          @keyup.enter="addUserToWaitlist"
        />
      </Field>
      <template #footer>
        <Button variant="ghost" @click="showAddUserDialog = false">Cancel</Button>
        <Button variant="primary" :loading="adding" :disabled="!newUserEmail || adding" @click="addUserToWaitlist">
          Add user
        </Button>
      </template>
    </Modal>

    <!-- Bulk invite -->
    <Modal
      v-model:open="showBulkConfirm"
      title="Invite pending users"
      :description="`Send invites to ${waitlistStats.uninvited} pending user${waitlistStats.uninvited !== 1 ? 's' : ''}?`"
      :icon="Send"
      size="sm"
    >
      <div class="rounded-lg border border-line-subtle bg-surface-sunken px-3 py-2.5">
        <p class="text-xs text-fg-muted">Each invite includes</p>
        <p class="mt-0.5 text-sm text-fg">{{ inviteSummary }}</p>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showBulkConfirm = false">Cancel</Button>
        <Button variant="primary" @click="inviteAllPending">Send invites</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDateTime, formatDate as formatDay, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import { downloadRecordsCsv } from '@/utils/downloadRecordsCsv';
  import {
    UserPlus,
    Users,
    RefreshCw,
    Copy,
    Download,
    AlertTriangle,
    RefreshCcw,
    Send,
    SlidersHorizontal,
    X,
    Check,
    MailCheck,
    Hourglass,
    CalendarDays,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
  } from '@/components/admin/shared';
  import { SectionCard } from '@/components/ui/section-card';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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

  const tierOptions = [
    { label: 'Starter', value: 'starter' },
    { label: 'Creator', value: 'creator' },
    { label: 'Pro', value: 'pro' },
  ];

  const inviteSummary = computed(() => {
    const { percent_off, duration_months, allowed_tiers } = inviteConfig.value;
    const tier = tierOptions.find((option) => option.value === allowed_tiers[0])?.label || allowed_tiers[0];
    return `${percent_off}% off for ${duration_months} month${duration_months !== 1 ? 's' : ''} · ${tier}`;
  });

  const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', width: '64px' },
    { key: 'email', label: 'Email' },
    { key: 'signed_up', label: 'Signed up', width: '120px', hideBelow: 'md' },
    { key: 'status', label: 'Status', width: '190px' },
    { key: 'beta_code', label: 'Beta code', width: '130px', hideBelow: 'md' },
    { key: 'discount_code', label: 'Discount code', width: '130px', hideBelow: 'lg' },
  ];

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

  const exportWaitlistCsv = async () => {
    if (!waitlistEntries.value.length) {
      showErrorToast('Export failed', 'No waitlist entries to export');
      return;
    }
    try {
      await downloadRecordsCsv(waitlistEntries.value, 'waitlist.csv');
    } catch (err) {
      console.error('Failed to export waitlist:', err);
      showErrorToast('Export failed', err instanceof Error ? err.message : 'Failed to export waitlist CSV');
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
        useToast().success(`Invited ${response.data.invited_count} users`, `Skipped ${response.data.skipped_count} · ${response.data.errors.length} errors`);
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
