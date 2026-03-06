<template>
  <div class="platform-campaigns">
    <div class="header">
      <h2>Platform Campaigns</h2>
      <button @click="showCreateDialog = true" class="btn-primary">
        Create Campaign
      </button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Campaigns</div>
        <div class="stat-value">{{ stats.total_campaigns }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Campaigns</div>
        <div class="stat-value">{{ stats.active_campaigns }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Rewards Granted</div>
        <div class="stat-value">{{ stats.total_rewards_granted }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Budget Spent</div>
        <div class="stat-value">${{ formatMoney(stats.total_budget_spent) }}</div>
      </div>
    </div>

    <div class="revenue-allocation-section">
      <h3>Revenue Allocation Settings</h3>
      <div class="revenue-settings">
        <div class="setting-row">
          <label>
            <input type="checkbox" v-model="revenueSettings.enabled" @change="updateRevenueSettings" />
            Enable Automatic Revenue Allocation
          </label>
        </div>
        <div class="setting-row" v-if="revenueSettings.enabled">
          <label>
            Allocation Percentage:
            <input
              type="number"
              v-model.number="revenueSettings.allocation_percentage"
              @change="updateRevenueSettings"
              min="0"
              max="100"
              step="0.1"
            />%
          </label>
        </div>
        <div class="balance-display">
          <div class="balance-item">
            <span>Current Balance:</span>
            <strong>${{ formatMoney(revenueSettings.current_balance) }}</strong>
          </div>
          <div class="balance-item">
            <span>Total Allocated:</span>
            <strong>${{ formatMoney(revenueSettings.total_allocated) }}</strong>
          </div>
          <div class="balance-item">
            <span>Total Spent:</span>
            <strong>${{ formatMoney(revenueSettings.total_spent) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="campaigns-list">
      <h3>Campaigns</h3>
      <div v-if="loading" class="loading">Loading campaigns...</div>
      <div v-else-if="campaigns.length === 0" class="empty-state">
        No platform campaigns yet. Create your first campaign to get started.
      </div>
      <div v-else class="campaigns-grid">
        <div v-for="campaign in campaigns" :key="campaign.id" class="campaign-card">
          <div class="campaign-header">
            <h4>{{ campaign.title }}</h4>
            <span class="status-badge" :class="campaign.status">{{ campaign.status }}</span>
          </div>
          <p class="campaign-description">{{ campaign.description }}</p>
          <div class="campaign-details">
            <div class="detail-row">
              <span>Payment Model:</span>
              <strong>{{ formatPaymentModel(campaign.platform_payment_model) }}</strong>
            </div>
            <div class="detail-row" v-if="campaign.budget">
              <span>Budget:</span>
              <strong>${{ formatMoney(campaign.budget) }}</strong>
            </div>
            <div class="detail-row" v-if="campaign.spent_budget">
              <span>Spent:</span>
              <strong>${{ formatMoney(campaign.spent_budget) }}</strong>
            </div>
            <div class="detail-row" v-if="campaign.cpm_rate">
              <span>CPM Rate:</span>
              <strong>${{ formatMoney(campaign.cpm_rate) }}</strong>
            </div>
          </div>
          <div class="campaign-actions">
            <button @click="editCampaign(campaign)" class="btn-secondary">Edit</button>
            <button @click="viewRewards(campaign)" class="btn-secondary">View Rewards</button>
            <button @click="deleteCampaign(campaign)" class="btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>

    <CreatePlatformCampaignDialog
      v-if="showCreateDialog"
      :revenue-balance="revenueSettings.current_balance"
      @close="showCreateDialog = false"
      @created="onCampaignCreated"
    />

    <EditPlatformCampaignDialog
      v-if="showEditDialog"
      :campaign="selectedCampaign"
      :revenue-balance="revenueSettings.current_balance"
      @close="showEditDialog = false"
      @updated="onCampaignUpdated"
    />

    <CampaignRewardsDialog
      v-if="showRewardsDialog"
      :campaign="selectedCampaign"
      @close="showRewardsDialog = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/services/api'
import CreatePlatformCampaignDialog from './CreatePlatformCampaignDialog.vue'
import EditPlatformCampaignDialog from './EditPlatformCampaignDialog.vue'
import CampaignRewardsDialog from './CampaignRewardsDialog.vue'

const campaigns = ref([])
const stats = ref({
  total_campaigns: 0,
  active_campaigns: 0,
  total_rewards_granted: 0,
  total_budget_spent: 0
})
const revenueSettings = ref({
  enabled: false,
  allocation_percentage: 0,
  current_balance: 0,
  total_allocated: 0,
  total_spent: 0
})
const loading = ref(false)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showRewardsDialog = ref(false)
const selectedCampaign = ref(null)

onMounted(() => {
  loadCampaigns()
  loadStats()
  loadRevenueSettings()
})

async function loadCampaigns() {
  loading.value = true
  try {
    const response = await api.get('/admin/platform-campaigns')
    campaigns.value = response.data.campaigns
  } catch (error) {
    console.error('Failed to load campaigns:', error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const response = await api.get('/admin/platform-campaigns/stats')
    stats.value = response.data.stats
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

async function loadRevenueSettings() {
  try {
    const response = await api.get('/admin/revenue-allocation/settings')
    revenueSettings.value = response.data.settings
  } catch (error) {
    console.error('Failed to load revenue settings:', error)
  }
}

async function updateRevenueSettings() {
  try {
    await api.put('/admin/revenue-allocation/settings', {
      enabled: revenueSettings.value.enabled,
      allocation_percentage: revenueSettings.value.allocation_percentage
    })
    await loadRevenueSettings()
  } catch (error) {
    console.error('Failed to update revenue settings:', error)
  }
}

function editCampaign(campaign) {
  selectedCampaign.value = campaign
  showEditDialog.value = true
}

function viewRewards(campaign) {
  selectedCampaign.value = campaign
  showRewardsDialog.value = true
}

async function deleteCampaign(campaign) {
  if (!confirm(`Are you sure you want to delete "${campaign.title}"?`)) return

  try {
    await api.delete(`/admin/platform-campaigns/${campaign.id}`)
    await loadCampaigns()
    await loadStats()
  } catch (error) {
    console.error('Failed to delete campaign:', error)
    alert('Failed to delete campaign')
  }
}

function onCampaignCreated() {
  showCreateDialog.value = false
  loadCampaigns()
  loadStats()
  loadRevenueSettings()
}

function onCampaignUpdated() {
  showEditDialog.value = false
  loadCampaigns()
  loadStats()
}

function formatMoney(value) {
  if (!value) return '0.00'
  return Number(value).toFixed(2)
}

function formatPaymentModel(model) {
  const models = {
    cpm_flywheel: 'CPM Flywheel',
    milestone_rewards: 'Milestone Rewards',
    regular_budget: 'Regular Budget'
  }
  return models[model] || model
}
</script>

<style scoped>
.platform-campaigns {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.revenue-allocation-section {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 32px;
}

.revenue-allocation-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.revenue-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.setting-row input[type="number"] {
  width: 80px;
  padding: 4px 8px;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 4px;
  color: #fff;
  margin-left: 8px;
}

.balance-display {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: #0a0a0a;
  border-radius: 4px;
}

.balance-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.balance-item span {
  font-size: 12px;
  color: #888;
}

.balance-item strong {
  font-size: 18px;
  color: #fff;
}

.campaigns-list h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}

.campaigns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.campaign-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.campaign-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.campaign-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.active {
  background: #10b981;
  color: #000;
}

.status-badge.paused {
  background: #f59e0b;
  color: #000;
}

.status-badge.completed {
  background: #6b7280;
  color: #fff;
}

.campaign-description {
  font-size: 14px;
  color: #aaa;
  margin: 0;
  line-height: 1.5;
}

.campaign-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid #333;
  border-bottom: 1px solid #333;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.detail-row span {
  color: #888;
}

.detail-row strong {
  color: #fff;
}

.campaign-actions {
  display: flex;
  gap: 8px;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #374151;
  color: #fff;
  flex: 1;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

.btn-danger:hover {
  background: #dc2626;
}
</style>
