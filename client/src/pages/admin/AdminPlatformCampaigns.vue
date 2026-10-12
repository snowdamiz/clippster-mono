<template>
  <PageLayout
    title="Platform campaigns"
    description="Manage Clippster-owned campaigns and rewards"
    :icon="Sparkles"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Platform campaigns' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh" :disabled="loading" @click="loadData">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
      <Button variant="primary" size="sm" @click="showCreateDialog = true">
        <Plus />
        New campaign
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Stats -->
      <StatGrid :count="4">
        <StatCard label="Total campaigns" :value="stats.total_campaigns" :icon="LayoutGrid" :loading="loading && !campaigns.length" />
        <StatCard label="Active" :value="stats.active_campaigns" :icon="CheckCircle" tone="success" :loading="loading && !campaigns.length" />
        <StatCard label="Rewards granted" :value="stats.total_rewards_granted" :icon="Gift" :loading="loading && !campaigns.length" />
        <StatCard
          label="Budget spent"
          :value="`$${formatMoney(stats.total_budget_spent)}`"
          :icon="DollarSign"
          :loading="loading && !campaigns.length"
        />
      </StatGrid>

      <!-- Revenue allocation -->
      <SectionCard title="Revenue allocation" :icon="TrendingUp" body-class="py-0">
        <SettingRow
          label="Automatic revenue allocation"
          description="Allocate a percentage of subscription revenue to the platform fund"
        >
          <Switch
            :model-value="revenueSettings.enabled"
            aria-label="Automatic revenue allocation"
            @update:model-value="toggleRevenue"
          />
        </SettingRow>
        <div v-if="revenueSettings.enabled" class="flex animate-enter flex-wrap items-end gap-x-6 gap-y-3 py-3">
          <Field label="Allocation" class="w-32">
            <div class="relative">
              <Input
                v-model.number="revenueSettings.allocation_percentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="pr-7"
                @change="updateRevenueSettings"
              />
              <span class="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-xs text-fg-subtle">%</span>
            </div>
          </Field>
          <StatGrid
            size="sm"
            class="min-w-[min(100%,330px)] max-w-[420px] flex-1"
            :items="[
              { label: 'Current balance', value: `$${formatMoney(revenueSettings.current_balance)}` },
              { label: 'Total allocated', value: `$${formatMoney(revenueSettings.total_allocated)}` },
              { label: 'Total spent', value: `$${formatMoney(revenueSettings.total_spent)}` },
            ]"
          />
        </div>
      </SectionCard>

      <Alert v-if="error" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <!-- Campaigns -->
      <DataTable :columns="columns" :rows="campaigns" row-key="id" :loading="loading">
        <template #cell-campaign="{ row: campaign }">
          <p class="truncate font-medium text-fg" :title="campaign.title">{{ campaign.title }}</p>
          <p class="tabular truncate text-xs text-fg-subtle">#{{ campaign.id }}</p>
        </template>
        <template #cell-model="{ row: campaign }">
          <Badge variant="neutral">{{ formatPaymentModel(campaign.platform_payment_model) }}</Badge>
        </template>
        <template #cell-budget="{ row: campaign }">
          <span class="tabular">${{ formatMoney(campaign.budget) }}</span>
        </template>
        <template #cell-spent="{ row: campaign }">
          <span class="tabular text-fg-muted">${{ formatMoney(campaign.spent) }}</span>
        </template>
        <template #cell-status="{ row: campaign }">
          <Badge :variant="statusVariant(campaign.status)">{{ formatStatus(campaign.status) }}</Badge>
        </template>
        <template #actions="{ row: campaign }">
          <AdminRowActions :label="`Actions for ${campaign.title}`">
            <AdminActionItem :icon="Edit" @select="editCampaign(campaign)">Edit</AdminActionItem>
            <AdminActionItem :icon="Gift" @select="viewRewards(campaign)">View rewards</AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="Trash2" destructive @select="deleteCampaign(campaign)">Delete</AdminActionItem>
          </AdminRowActions>
        </template>
        <template #empty>
          <EmptyState
            size="sm"
            :icon="Sparkles"
            title="No platform campaigns"
            description="Create your first platform campaign to get started."
          >
            <Button variant="secondary" size="sm" @click="showCreateDialog = true"><Plus />New campaign</Button>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <!-- Dialogs -->
    <CreatePlatformCampaignDialog
      v-model="showCreateDialog"
      :revenue-balance="revenueSettings.current_balance"
      @created="onCampaignCreated"
    />

    <EditPlatformCampaignDialog v-model="showEditDialog" :campaign="selectedCampaign" @updated="onCampaignUpdated" />

    <CampaignRewardsDialog v-model="showRewardsDialog" :campaign-id="selectedCampaign?.id" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { confirmDialog } from '@/composables/useDialogs';
import { ref, onMounted } from 'vue';
import {
  Sparkles,
  RefreshCw,
  Plus,
  LayoutGrid,
  CheckCircle,
  Gift,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Edit,
  Trash2
} from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { StatCard, StatGrid } from '@/components/ui/stat-card';
import { Switch } from '@/components/ui/switch';
import {
  AdminActionItem,
  AdminRowActions,
  formatStatus,
  statusVariant,
} from '@/components/admin/shared';
import { SectionCard } from '@/components/ui/section-card';
import { SettingRow } from '@/components/ui/setting-row';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import CreatePlatformCampaignDialog from '@/components/admin/CreatePlatformCampaignDialog.vue';
import EditPlatformCampaignDialog from '@/components/admin/EditPlatformCampaignDialog.vue';
import CampaignRewardsDialog from '@/components/admin/CampaignRewardsDialog.vue';
import api from '@/services/api';

const loading = ref(false);
const error = ref('');
const campaigns = ref<any[]>([]);
const stats = ref({
  total_campaigns: 0,
  active_campaigns: 0,
  total_rewards_granted: 0,
  total_budget_spent: 0
});
const revenueSettings = ref({
  enabled: false,
  allocation_percentage: 0,
  current_balance: 0,
  total_allocated: 0,
  total_spent: 0
});

const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showRewardsDialog = ref(false);
const selectedCampaign = ref<any>(null);

const columns: DataTableColumn[] = [
  { key: 'campaign', label: 'Campaign' },
  { key: 'model', label: 'Payment model', width: '150px', hideBelow: 'md' },
  { key: 'budget', label: 'Budget', width: '104px', align: 'right' },
  { key: 'spent', label: 'Spent', width: '104px', align: 'right' },
  { key: 'status', label: 'Status', width: '104px' },
];

onMounted(() => {
  loadData();
});

async function loadData() {
  loading.value = true;
  error.value = '';

  try {
    await Promise.all([
      loadCampaigns(),
      loadStats(),
      loadRevenueSettings()
    ]);
  } catch (err: any) {
    console.error('Failed to load data:', err);
    error.value = err.message || 'Failed to load data';
  } finally {
    loading.value = false;
  }
}

async function loadCampaigns() {
  const response = await api.get('/admin/platform-campaigns');
  campaigns.value = response.data.campaigns || [];
}

async function loadStats() {
  const response = await api.get('/admin/platform-campaigns/stats');
  stats.value = response.data.stats || stats.value;
}

async function loadRevenueSettings() {
  const response = await api.get('/admin/revenue-allocation/settings');
  revenueSettings.value = response.data.settings || revenueSettings.value;
}

async function toggleRevenue() {
  revenueSettings.value.enabled = !revenueSettings.value.enabled;
  await updateRevenueSettings();
}

async function updateRevenueSettings() {
  try {
    await api.put('/admin/revenue-allocation/settings', {
      enabled: revenueSettings.value.enabled,
      allocation_percentage: revenueSettings.value.allocation_percentage
    });
    await loadRevenueSettings();
  } catch (err: any) {
    console.error('Failed to update revenue settings:', err);
    error.value = 'Failed to update revenue settings';
  }
}

function editCampaign(campaign: any) {
  selectedCampaign.value = campaign;
  showEditDialog.value = true;
}

function viewRewards(campaign: any) {
  selectedCampaign.value = campaign;
  showRewardsDialog.value = true;
}

async function deleteCampaign(campaign: any) {
  if (!(await confirmDialog({ title: 'Delete campaign?', message: `"${campaign.title}" will be permanently deleted.`, confirmText: 'Delete', variant: 'destructive' }))) return;

  try {
    await api.delete(`/admin/platform-campaigns/${campaign.id}`);
    await loadData();
  } catch (err: any) {
    console.error('Failed to delete campaign:', err);
    error.value = 'Failed to delete campaign';
  }
}

function onCampaignCreated() {
  showCreateDialog.value = false;
  loadData();
}

function onCampaignUpdated() {
  showEditDialog.value = false;
  loadData();
}

function formatMoney(value: any): string {
  if (!value) return '0.00';
  return Number(value).toFixed(2);
}

function formatPaymentModel(model: string): string {
  const models: Record<string, string> = {
    cpm_flywheel: 'CPM flywheel',
    milestone_rewards: 'Milestone rewards',
    regular_budget: 'Regular budget'
  };
  return models[model] || model;
}
</script>
