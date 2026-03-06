<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h3>Edit Platform Campaign</h3>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>

      <div class="dialog-content">
        <div class="form-section">
          <h4>Basic Information</h4>
          <div class="form-group">
            <label>Campaign Title *</label>
            <input v-model="form.title" type="text" placeholder="Enter campaign title" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="form.description" rows="4" placeholder="Campaign description"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Start Date</label>
              <input v-model="form.start_date" type="datetime-local" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input v-model="form.end_date" type="datetime-local" />
            </div>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select v-model="form.status">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div class="form-section">
          <h4>Payment Model: {{ formatPaymentModel(campaign.platform_payment_model) }}</h4>
          <p class="info-text">Payment model cannot be changed after creation</p>
        </div>

        <div v-if="campaign.platform_payment_model === 'cpm_flywheel'" class="form-section">
          <h4>CPM Flywheel Settings</h4>
          <div class="form-row">
            <div class="form-group">
              <label>CPM Rate ($)</label>
              <input v-model.number="form.cpm_rate" type="number" step="0.01" min="0" />
            </div>
            <div class="form-group">
              <label>Budget Cap ($)</label>
              <input v-model.number="form.budget" type="number" step="0.01" min="0" />
              <small>Available: ${{ formatMoney(revenueBalance) }}</small>
            </div>
          </div>
        </div>

        <div v-if="campaign.platform_payment_model === 'milestone_rewards'" class="form-section">
          <h4>Reward Tiers</h4>
          <div v-for="(tier, index) in form.reward_tiers" :key="tier.id || index" class="reward-tier">
            <div class="tier-header">
              <h5>Tier {{ index + 1 }}</h5>
              <button @click="removeTier(index)" class="btn-remove">Remove</button>
            </div>
            <div class="form-group">
              <label>Views Required</label>
              <input v-model.number="tier.views_required" type="number" min="0" />
            </div>
            
            <div class="reward-section">
              <label class="checkbox-label">
                <input type="checkbox" v-model="tier.discount_enabled" />
                Subscription Discount
              </label>
              <div v-if="tier.discount_enabled" class="reward-details">
                <div class="form-row">
                  <div class="form-group">
                    <label>Discount %</label>
                    <input v-model.number="tier.discount_percent" type="number" min="0" max="100" />
                  </div>
                  <div class="form-group">
                    <label>Duration (months)</label>
                    <input v-model.number="tier.discount_duration_months" type="number" min="1" />
                  </div>
                </div>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="tier.discount_recurring" />
                  Recurring
                </label>
                <div class="form-group">
                  <label>Applies to Tiers</label>
                  <div class="tier-checkboxes">
                    <label><input type="checkbox" value="starter" v-model="tier.discount_applies_to_tiers" /> Starter</label>
                    <label><input type="checkbox" value="creator" v-model="tier.discount_applies_to_tiers" /> Creator</label>
                    <label><input type="checkbox" value="pro" v-model="tier.discount_applies_to_tiers" /> Pro</label>
                  </div>
                </div>
              </div>
            </div>

            <div class="reward-section">
              <label class="checkbox-label">
                <input type="checkbox" v-model="tier.free_months_enabled" />
                Free Subscription Months
              </label>
              <div v-if="tier.free_months_enabled" class="reward-details">
                <div class="form-group">
                  <label>Free Months</label>
                  <input v-model.number="tier.free_months_count" type="number" min="1" />
                </div>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="tier.free_months_recurring" />
                  Recurring
                </label>
                <div class="form-group">
                  <label>Applies to Tiers</label>
                  <div class="tier-checkboxes">
                    <label><input type="checkbox" value="starter" v-model="tier.free_months_applies_to_tiers" /> Starter</label>
                    <label><input type="checkbox" value="creator" v-model="tier.free_months_applies_to_tiers" /> Creator</label>
                    <label><input type="checkbox" value="pro" v-model="tier.free_months_applies_to_tiers" /> Pro</label>
                  </div>
                </div>
              </div>
            </div>

            <div class="reward-section">
              <label class="checkbox-label">
                <input type="checkbox" v-model="tier.ai_credits_enabled" />
                AI Credits
              </label>
              <div v-if="tier.ai_credits_enabled" class="reward-details">
                <div class="form-group">
                  <label>Credits Amount (minutes)</label>
                  <input v-model.number="tier.ai_credits_amount" type="number" min="1" />
                </div>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="tier.ai_credits_recurring" />
                  Recurring
                </label>
              </div>
            </div>
          </div>
          <button @click="addTier" class="btn-add">+ Add Tier</button>
        </div>

        <div v-if="campaign.platform_payment_model === 'regular_budget'" class="form-section">
          <h4>Regular Budget Settings</h4>
          <div class="form-group">
            <label>Payment Type</label>
            <select v-model="form.payment_model">
              <option value="per_clip">Fixed Per Clip</option>
              <option value="cpm">CPM (Cost Per 1000 Views)</option>
            </select>
          </div>
          <div v-if="form.payment_model === 'per_clip'" class="form-group">
            <label>Amount Per Clip ($)</label>
            <input v-model.number="form.per_clip_amount" type="number" step="0.01" min="0" />
          </div>
          <div v-if="form.payment_model === 'cpm'" class="form-group">
            <label>CPM Rate ($)</label>
            <input v-model.number="form.cpm_rate" type="number" step="0.01" min="0" />
          </div>
          <div class="form-group">
            <label>Total Budget ($)</label>
            <input v-model.number="form.budget" type="number" step="0.01" min="0" />
          </div>
        </div>

        <div class="form-section">
          <h4>Campaign Settings</h4>
          <div class="form-group">
            <label>Join Type</label>
            <select v-model="form.join_type">
              <option value="open">Open (anyone can join)</option>
              <option value="application_required">Application Required</option>
            </select>
          </div>
          <div class="form-group">
            <label>Allowed Platforms</label>
            <div class="platform-checkboxes">
              <label><input type="checkbox" value="tiktok" v-model="form.allowed_platforms" /> TikTok</label>
              <label><input type="checkbox" value="instagram" v-model="form.allowed_platforms" /> Instagram</label>
              <label><input type="checkbox" value="x" v-model="form.allowed_platforms" /> X (Twitter)</label>
              <label><input type="checkbox" value="youtube" v-model="form.allowed_platforms" /> YouTube</label>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button @click="$emit('close')" class="btn-secondary">Cancel</button>
        <button @click="updateCampaign" :disabled="!canUpdate" class="btn-primary">Update Campaign</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/services/api'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  },
  revenueBalance: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'updated'])

const form = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  status: 'active',
  payment_model: 'cpm',
  cpm_rate: 0,
  budget: 0,
  per_clip_amount: 0,
  join_type: 'open',
  allowed_platforms: [],
  reward_tiers: []
})

const canUpdate = computed(() => {
  return form.value.title.length >= 3
})

onMounted(() => {
  form.value = {
    title: props.campaign.title || '',
    description: props.campaign.description || '',
    start_date: props.campaign.start_date || '',
    end_date: props.campaign.end_date || '',
    status: props.campaign.status || 'active',
    payment_model: props.campaign.payment_model || 'cpm',
    cpm_rate: props.campaign.cpm_rate || 0,
    budget: props.campaign.budget || 0,
    per_clip_amount: props.campaign.per_clip_amount || 0,
    join_type: props.campaign.join_type || 'open',
    allowed_platforms: props.campaign.allowed_platforms || [],
    reward_tiers: props.campaign.reward_tiers || []
  }
})

function addTier() {
  form.value.reward_tiers.push({
    tier_number: form.value.reward_tiers.length + 1,
    views_required: 10000,
    discount_enabled: false,
    discount_percent: 25,
    discount_duration_months: 1,
    discount_recurring: false,
    discount_applies_to_tiers: [],
    free_months_enabled: false,
    free_months_count: 1,
    free_months_recurring: false,
    free_months_applies_to_tiers: [],
    ai_credits_enabled: false,
    ai_credits_amount: 100,
    ai_credits_recurring: false
  })
}

function removeTier(index) {
  form.value.reward_tiers.splice(index, 1)
  form.value.reward_tiers.forEach((tier, i) => {
    tier.tier_number = i + 1
  })
}

async function updateCampaign() {
  try {
    await api.put(`/admin/platform-campaigns/${props.campaign.id}`, form.value)
    emit('updated')
  } catch (error) {
    console.error('Failed to update campaign:', error)
    alert('Failed to update campaign: ' + (error.response?.data?.error || error.message))
  }
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
/* Reuse same styles as CreatePlatformCampaignDialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.dialog {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #333;
}

.dialog-header h3 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #333;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.info-text {
  color: #888;
  font-size: 13px;
  margin: 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #aaa;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
}

.form-group small {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.reward-tier {
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tier-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.btn-remove {
  background: #ef4444;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-remove:hover {
  background: #dc2626;
}

.reward-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 8px;
  cursor: pointer;
}

.reward-details {
  margin-left: 24px;
  padding-left: 16px;
  border-left: 2px solid #333;
}

.tier-checkboxes,
.platform-checkboxes {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.tier-checkboxes label,
.platform-checkboxes label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-add {
  background: #10b981;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  width: 100%;
}

.btn-add:hover {
  background: #059669;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #333;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #374151;
  cursor: not-allowed;
}

.btn-secondary {
  background: #374151;
  color: #fff;
}

.btn-secondary:hover {
  background: #4b5563;
}
</style>
