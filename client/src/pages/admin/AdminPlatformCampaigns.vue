<template>
  <PageLayout
    title="Platform Campaigns"
    description="Manage Clippster-owned campaigns and rewards"
    :show-header="true"
    :icon="Sparkles"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Platform Campaigns' }]"
  >
    <template #actions>
      <div class="pc-header-actions">
        <button class="pc-header__action-btn" :disabled="loading" @click="loadData">
          <RefreshCw v-if="!loading" class="pc-header__action-icon" />
          <Loader2 v-else class="pc-header__action-icon pc-header__action-icon--spin" />
          Refresh
        </button>
        <button class="pc-header__action-btn pc-header__action-btn--primary" @click="showCreateDialog = true">
          <Plus class="pc-header__action-icon" />
          New Campaign
        </button>
      </div>
    </template>

    <div class="admin-pc">
      <!-- Page Heading -->
      <div class="admin-pc__heading">
        <h1 class="admin-pc__title">Platform Campaigns</h1>
        <p class="admin-pc__subtitle">Manage Clippster-owned campaigns and rewards</p>
      </div>

      <!-- Stats Header -->
      <div class="admin-pc__stats-header">
        <div class="admin-pc__stats-info">
          <div class="admin-pc__stats-icon">
            <Sparkles class="admin-pc__stats-icon-svg" />
          </div>
          <div>
            <h2 class="admin-pc__stats-title">Campaign Management</h2>
            <p class="admin-pc__stats-desc">Track platform campaigns, rewards, and revenue allocation</p>
          </div>
        </div>
        <span v-if="campaigns.length > 0" class="admin-pc__stats-count">{{ campaigns.length }} campaign{{ campaigns.length !== 1 ? 's' : '' }}</span>
      </div>

      <!-- Stats Cards -->
      <div class="admin-pc__cards">
        <div class="admin-pc__card">
          <div class="admin-pc__card-header">
            <div class="admin-pc__card-icon admin-pc__card-icon--cyan">
              <LayoutGrid class="admin-pc__card-icon-svg" />
            </div>
            <h3 class="admin-pc__card-label">Total Campaigns</h3>
          </div>
          <p class="admin-pc__card-value">{{ stats.total_campaigns }}</p>
        </div>
        <div class="admin-pc__card">
          <div class="admin-pc__card-header">
            <div class="admin-pc__card-icon admin-pc__card-icon--green">
              <CheckCircle class="admin-pc__card-icon-svg" />
            </div>
            <h3 class="admin-pc__card-label">Active</h3>
          </div>
          <p class="admin-pc__card-value admin-pc__card-value--green">{{ stats.active_campaigns }}</p>
        </div>
        <div class="admin-pc__card">
          <div class="admin-pc__card-header">
            <div class="admin-pc__card-icon admin-pc__card-icon--purple">
              <Gift class="admin-pc__card-icon-svg" />
            </div>
            <h3 class="admin-pc__card-label">Rewards Granted</h3>
          </div>
          <p class="admin-pc__card-value admin-pc__card-value--purple">{{ stats.total_rewards_granted }}</p>
        </div>
        <div class="admin-pc__card">
          <div class="admin-pc__card-header">
            <div class="admin-pc__card-icon admin-pc__card-icon--amber">
              <DollarSign class="admin-pc__card-icon-svg" />
            </div>
            <h3 class="admin-pc__card-label">Budget Spent</h3>
          </div>
          <p class="admin-pc__card-value admin-pc__card-value--amber">${{ formatMoney(stats.total_budget_spent) }}</p>
        </div>
      </div>

      <!-- Revenue Allocation Section -->
      <div class="admin-pc__section">
        <div class="admin-pc__section-header">
          <div class="admin-pc__section-icon">
            <TrendingUp class="admin-pc__section-icon-svg" />
          </div>
          <div>
            <h3 class="admin-pc__section-title">Revenue Allocation Settings</h3>
            <p class="admin-pc__section-desc">Configure automatic revenue allocation from subscriptions</p>
          </div>
        </div>
        <div class="admin-pc__section-content">
          <div class="admin-pc__toggle-row">
            <div class="admin-pc__toggle-info">
              <span class="admin-pc__toggle-label">Enable Automatic Revenue Allocation</span>
              <span class="admin-pc__toggle-hint">Automatically allocate a percentage of subscription revenue to platform fund</span>
            </div>
            <button
              @click="toggleRevenue"
              class="admin-pc__toggle"
              :class="{ 'admin-pc__toggle--active': revenueSettings.enabled }"
            >
              <span
                class="admin-pc__toggle-thumb"
                :class="{ 'admin-pc__toggle-thumb--active': revenueSettings.enabled }"
              />
            </button>
          </div>

          <div v-if="revenueSettings.enabled" class="admin-pc__revenue-details">
            <div class="admin-pc__field">
              <label class="admin-pc__label">Allocation Percentage</label>
              <div class="admin-pc__input-group">
                <input
                  v-model.number="revenueSettings.allocation_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="admin-pc__input"
                  @change="updateRevenueSettings"
                />
                <span class="admin-pc__input-suffix">%</span>
              </div>
            </div>

            <div class="admin-pc__revenue-stats">
              <div class="admin-pc__revenue-stat">
                <span class="admin-pc__revenue-stat-label">Current Balance</span>
                <span class="admin-pc__revenue-stat-value">${{ formatMoney(revenueSettings.current_balance) }}</span>
              </div>
              <div class="admin-pc__revenue-stat">
                <span class="admin-pc__revenue-stat-label">Total Allocated</span>
                <span class="admin-pc__revenue-stat-value">${{ formatMoney(revenueSettings.total_allocated) }}</span>
              </div>
              <div class="admin-pc__revenue-stat">
                <span class="admin-pc__revenue-stat-label">Total Spent</span>
                <span class="admin-pc__revenue-stat-value">${{ formatMoney(revenueSettings.total_spent) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="admin-pc__error">
        <AlertTriangle class="admin-pc__error-icon" />
        <p class="admin-pc__error-text">{{ error }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !campaigns.length" class="admin-pc__loading">
        <Loader2 class="admin-pc__loading-icon" />
        <p class="admin-pc__loading-text">Loading campaigns...</p>
      </div>

      <!-- Campaigns Table -->
      <div v-else-if="campaigns.length > 0" class="admin-pc__table-wrapper">
        <div class="admin-pc__table-scroll">
          <table class="admin-pc__table">
            <thead class="admin-pc__thead">
              <tr>
                <th class="admin-pc__th">Campaign</th>
                <th class="admin-pc__th">Payment Model</th>
                <th class="admin-pc__th">Budget</th>
                <th class="admin-pc__th">Spent</th>
                <th class="admin-pc__th">Status</th>
                <th class="admin-pc__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-pc__tbody">
              <tr v-for="campaign in campaigns" :key="campaign.id" class="admin-pc__row">
                <td class="admin-pc__td">
                  <div class="admin-pc__campaign">
                    <span class="admin-pc__campaign-title">{{ campaign.title }}</span>
                    <span class="admin-pc__campaign-id">#{{ campaign.id }}</span>
                  </div>
                </td>
                <td class="admin-pc__td">
                  <code class="admin-pc__code">{{ formatPaymentModel(campaign.platform_payment_model) }}</code>
                </td>
                <td class="admin-pc__td">${{ formatMoney(campaign.budget) }}</td>
                <td class="admin-pc__td admin-pc__td--amber">${{ formatMoney(campaign.spent) }}</td>
                <td class="admin-pc__td">
                  <span
                    class="admin-pc__status"
                    :class="{
                      'admin-pc__status--active': campaign.status === 'active',
                      'admin-pc__status--paused': campaign.status === 'paused',
                      'admin-pc__status--draft': campaign.status === 'draft',
                      'admin-pc__status--completed': campaign.status === 'completed',
                    }"
                  >
                    {{ campaign.status }}
                  </span>
                </td>
                <td class="admin-pc__td">
                  <div class="admin-pc__actions">
                    <button @click="editCampaign(campaign)" class="admin-pc__action-btn" title="Edit">
                      <Edit :size="16" />
                    </button>
                    <button @click="viewRewards(campaign)" class="admin-pc__action-btn" title="View Rewards">
                      <Gift :size="16" />
                    </button>
                    <button @click="deleteCampaign(campaign)" class="admin-pc__action-btn admin-pc__action-btn--danger" title="Delete">
                      <Trash2 :size="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-pc__empty">
        <div class="admin-pc__empty-icon">
          <Sparkles class="admin-pc__empty-icon-svg" />
        </div>
        <h3 class="admin-pc__empty-title">No Platform Campaigns</h3>
        <p class="admin-pc__empty-text">Create your first platform campaign to get started</p>
        <button @click="showCreateDialog = true" class="admin-pc__empty-btn">
          <Plus :size="16" />
          Create Campaign
        </button>
      </div>
    </div>

    <!-- Dialogs -->
    <CreatePlatformCampaignDialog
      v-model="showCreateDialog"
      :revenue-balance="revenueSettings.current_balance"
      @created="onCampaignCreated"
    />

    <EditPlatformCampaignDialog
      v-model="showEditDialog"
      :campaign="selectedCampaign"
      @updated="onCampaignUpdated"
    />

    <CampaignRewardsDialog
      v-model="showRewardsDialog"
      :campaign-id="selectedCampaign?.id"
    />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Sparkles,
  RefreshCw,
  Loader2,
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
  if (!confirm(`Are you sure you want to delete "${campaign.title}"?`)) return;

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
    cpm_flywheel: 'CPM Flywheel',
    milestone_rewards: 'Milestone Rewards',
    regular_budget: 'Regular Budget'
  };
  return models[model] || model;
}
</script>

<style scoped>
/* Header Actions */
.pc-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pc-header__action-btn {
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

.pc-header__action-btn:hover:not(:disabled) {
  background-color: var(--sidebar-hover);
  border-color: rgba(255, 255, 255, 0.15);
}

.pc-header__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pc-header__action-btn--primary {
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border-color: var(--sidebar-accent);
}

.pc-header__action-btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.pc-header__action-icon {
  width: 14px;
  height: 14px;
}

.pc-header__action-icon--spin {
  animation: spin 0.8s linear infinite;
}

/* Page Container */
.admin-pc {
  width: 100%;
  min-height: 100%;
}

/* Page Heading */
.admin-pc__heading {
  margin-bottom: 1.5rem;
}

.admin-pc__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
}

.admin-pc__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* Stats Header */
.admin-pc__stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.admin-pc__stats-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.admin-pc__stats-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background-color: rgba(6, 182, 212, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-pc__stats-icon-svg {
  width: 24px;
  height: 24px;
  color: var(--sidebar-accent);
}

.admin-pc__stats-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
}

.admin-pc__stats-desc {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-pc__stats-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  padding: 0.375rem 0.75rem;
  background-color: var(--sidebar-hover);
  border-radius: 6px;
}

/* Stats Cards */
.admin-pc__cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.admin-pc__card {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 1.25rem;
  transition: all 180ms ease;
}

.admin-pc__card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.admin-pc__card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.875rem;
}

.admin-pc__card-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-pc__card-icon--cyan {
  background-color: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.admin-pc__card-icon--green {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.admin-pc__card-icon--purple {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.admin-pc__card-icon--amber {
  background-color: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.admin-pc__card-icon-svg {
  width: 18px;
  height: 18px;
}

.admin-pc__card-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-pc__card-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.admin-pc__card-value--green {
  color: #22c55e;
}

.admin-pc__card-value--purple {
  color: #a855f7;
}

.admin-pc__card-value--amber {
  color: #fbbf24;
}

/* Section */
.admin-pc__section {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.admin-pc__section-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.admin-pc__section-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: rgba(6, 182, 212, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.admin-pc__section-icon-svg {
  width: 20px;
  height: 20px;
  color: var(--sidebar-accent);
}

.admin-pc__section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
}

.admin-pc__section-desc {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.admin-pc__section-content {
  padding: 1.25rem;
}

/* Toggle */
.admin-pc__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.admin-pc__toggle-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-pc__toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.admin-pc__toggle-hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.admin-pc__toggle {
  position: relative;
  display: inline-flex;
  height: 24px;
  width: 44px;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 9999px;
  border: 2px solid transparent;
  background-color: var(--sidebar-hover);
  transition: background-color 200ms ease-in-out;
}

.admin-pc__toggle:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--sidebar-accent);
}

.admin-pc__toggle--active {
  background-color: var(--sidebar-accent);
}

.admin-pc__toggle-thumb {
  pointer-events: none;
  display: inline-block;
  height: 20px;
  width: 20px;
  transform: translateX(0);
  border-radius: 9999px;
  background-color: white;
  transition: transform 200ms ease-in-out;
}

.admin-pc__toggle-thumb--active {
  transform: translateX(20px);
}

/* Revenue Details */
.admin-pc__revenue-details {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--sidebar-border);
}

.admin-pc__field {
  margin-bottom: 1rem;
}

.admin-pc__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin-bottom: 0.5rem;
}

.admin-pc__input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.admin-pc__input {
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 0.875rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.admin-pc__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.admin-pc__input-suffix {
  position: absolute;
  right: 0.875rem;
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  pointer-events: none;
}

.admin-pc__revenue-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.admin-pc__revenue-stat {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.875rem;
  background-color: var(--sidebar-hover);
  border-radius: 6px;
}

.admin-pc__revenue-stat-label {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-pc__revenue-stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--sidebar-text);
  font-variant-numeric: tabular-nums;
}

/* Error */
.admin-pc__error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #f87171;
  margin-bottom: 1.5rem;
}

.admin-pc__error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.admin-pc__error-text {
  font-size: 0.875rem;
  margin: 0;
}

/* Loading */
.admin-pc__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  gap: 1rem;
}

.admin-pc__loading-icon {
  width: 32px;
  height: 32px;
  color: var(--sidebar-accent);
  animation: spin 0.8s linear infinite;
}

.admin-pc__loading-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* Table */
.admin-pc__table-wrapper {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  overflow: hidden;
}

.admin-pc__table-scroll {
  overflow-x: auto;
}

.admin-pc__table {
  width: 100%;
  border-collapse: collapse;
}

.admin-pc__thead {
  background-color: var(--sidebar-hover);
  border-bottom: 1px solid var(--sidebar-border);
}

.admin-pc__th {
  padding: 0.875rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-pc__tbody {
}

.admin-pc__row {
  border-bottom: 1px solid var(--sidebar-border);
  transition: background-color 150ms ease;
}

.admin-pc__row:last-child {
  border-bottom: none;
}

.admin-pc__row:hover {
  background-color: var(--sidebar-hover);
}

.admin-pc__td {
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
}

.admin-pc__td--amber {
  color: #fbbf24;
  font-weight: 600;
}

.admin-pc__campaign {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-pc__campaign-title {
  font-weight: 500;
}

.admin-pc__campaign-id {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.admin-pc__code {
  padding: 0.25rem 0.5rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}

.admin-pc__status {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  text-transform: capitalize;
}

.admin-pc__status--active {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.admin-pc__status--paused {
  background-color: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.admin-pc__status--draft {
  background-color: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

.admin-pc__status--completed {
  background-color: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.admin-pc__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-pc__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background-color: transparent;
  border: 1px solid var(--sidebar-border);
  color: var(--sidebar-text);
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-pc__action-btn:hover {
  background-color: var(--sidebar-hover);
  border-color: rgba(255, 255, 255, 0.15);
}

.admin-pc__action-btn--danger {
  color: #ef4444;
}

.admin-pc__action-btn--danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

/* Empty State */
.admin-pc__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
}

.admin-pc__empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background-color: rgba(6, 182, 212, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.admin-pc__empty-icon-svg {
  width: 36px;
  height: 36px;
  color: var(--sidebar-accent);
}

.admin-pc__empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.admin-pc__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 1.5rem;
  max-width: 320px;
}

.admin-pc__empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.admin-pc__empty-btn:hover {
  opacity: 0.9;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
