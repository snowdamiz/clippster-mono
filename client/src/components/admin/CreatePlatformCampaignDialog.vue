<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h3>Create Platform Campaign</h3>
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
        </div>

        <div class="form-section">
          <h4>Payment Model</h4>
          <div class="payment-model-selector">
            <label class="radio-card" :class="{ selected: form.platform_payment_model === 'cpm_flywheel' }">
              <input type="radio" v-model="form.platform_payment_model" value="cpm_flywheel" />
              <div class="radio-content">
                <strong>Option A: Revenue Flywheel (CPM)</strong>
                <p>Pay clippers based on views using platform fund</p>
              </div>
            </label>
            <label class="radio-card" :class="{ selected: form.platform_payment_model === 'milestone_rewards' }">
              <input type="radio" v-model="form.platform_payment_model" value="milestone_rewards" />
              <div class="radio-content">
                <strong>Option B: Milestone Rewards</strong>
                <p>Grant discounts, free months, and AI credits at view milestones</p>
              </div>
            </label>
            <label class="radio-card" :class="{ selected: form.platform_payment_model === 'regular_budget' }">
              <input type="radio" v-model="form.platform_payment_model" value="regular_budget" />
              <div class="radio-content">
                <strong>Option C: Regular Budget</strong>
                <p>Fixed payment per clip or CPM with manual verification</p>
              </div>
            </label>
          </div>
        </div>

        <div v-if="form.platform_payment_model === 'cpm_flywheel'" class="form-section">
          <h4>CPM Flywheel Settings</h4>
          <div class="form-row">
            <div class="form-group">
              <label>CPM Rate ($)</label>
              <input v-model.number="form.cpm_rate" type="number" step="0.01" min="0" />
              <small>Amount paid per 1000 views</small>
            </div>
            <div class="form-group">
              <label>Budget Cap ($)</label>
              <input v-model.number="form.budget" type="number" step="0.01" min="0" />
              <small>Available: ${{ formatMoney(revenueBalance) }}</small>
            </div>
          </div>
        </div>

        <div v-if="form.platform_payment_model === 'milestone_rewards'" class="form-section">
          <h4>Reward Tiers</h4>
          <div v-for="(tier, index) in form.reward_tiers" :key="index" class="reward-tier">
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
                  Recurring (grant every time milestone hit)
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
                  Recurring (grant every time milestone hit)
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
                  Recurring (grant every time milestone hit)
                </label>
              </div>
            </div>
          </div>
          <button @click="addTier" class="btn-add">+ Add Tier</button>
        </div>

        <div v-if="form.platform_payment_model === 'regular_budget'" class="form-section">
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
        <button @click="createCampaign" :disabled="!canCreate" class="btn-primary">Create Campaign</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { api } from '@/services/api'

const props = defineProps({
  revenueBalance: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['close', 'created'])

const form = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  platform_payment_model: 'cpm_flywheel',
  payment_model: 'cpm',
  cpm_rate: 5.00,
  budget: 0,
  per_clip_amount: 0,
  join_type: 'open',
  allowed_platforms: ['tiktok', 'instagram', 'x', 'youtube'],
  reward_tiers: []
})

const canCreate = computed(() => {
  return form.value.title.length >= 3
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

async function createCampaign() {
  try {
    await api.post('/admin/platform-campaigns', form.value)
    emit('created')
  } catch (error) {
    console.error('Failed to create campaign:', error)
    alert('Failed to create campaign: ' + (error.response?.data?.error || error.message))
  }
}

function formatMoney(value) {
  if (!value) return '0.00'
  return Number(value).toFixed(2)
}
</script>

<style scoped>
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

.payment-model-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #0a0a0a;
  border: 2px solid #333;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-card:hover {
  border-color: #555;
}

.radio-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.radio-card input[type="radio"] {
  margin-top: 2px;
}

.radio-content strong {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
}

.radio-content p {
  margin: 0;
  font-size: 13px;
  color: #888;
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
