<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="campaign-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="campaign-dialog" role="dialog" aria-modal="true">
            <div class="campaign-dialog__accent"></div>

            <div class="campaign-dialog__header">
              <button class="campaign-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="campaign-dialog__icon">
                <Gift :size="24" />
              </div>
              <h2 class="campaign-dialog__title">Campaign Rewards</h2>
              <p class="campaign-dialog__subtitle">View granted rewards for this campaign</p>
            </div>

            <div class="campaign-dialog__content">
              <div v-if="loading" class="campaign-dialog__loading">
                <Loader2 :size="24" class="campaign-dialog__spinner" />
                <p>Loading rewards...</p>
              </div>

              <div v-else-if="error" class="campaign-dialog__alert campaign-dialog__alert--error">
                <AlertTriangle :size="16" />
                <p>{{ error }}</p>
              </div>

              <div v-else-if="rewards.length === 0" class="campaign-dialog__empty">
                <div class="campaign-dialog__empty-icon">
                  <Gift :size="32" />
                </div>
                <p class="campaign-dialog__empty-text">No rewards granted yet</p>
              </div>

              <div v-else class="campaign-dialog__rewards">
                <div v-for="reward in rewards" :key="reward.id" class="campaign-dialog__reward">
                  <div class="campaign-dialog__reward-header">
                    <div class="campaign-dialog__reward-user">
                      <User :size="16" />
                      <span>{{ reward.user?.username || 'Unknown User' }}</span>
                    </div>
                    <div class="campaign-dialog__reward-date">
                      {{ formatDate(reward.granted_at) }}
                    </div>
                  </div>

                  <div class="campaign-dialog__reward-details">
                    <div class="campaign-dialog__reward-tier">
                      Tier {{ reward.reward_tier?.tier_number || '?' }} - {{ formatNumber(reward.reward_tier?.views_required || 0) }} views
                    </div>

                    <div class="campaign-dialog__reward-items">
                      <div v-if="reward.stripe_coupon_id" class="campaign-dialog__reward-item">
                        <Percent :size="14" />
                        <span>Discount Code: {{ reward.stripe_coupon_id }}</span>
                      </div>
                      <div v-if="reward.free_months_granted" class="campaign-dialog__reward-item">
                        <Calendar :size="14" />
                        <span>{{ reward.free_months_granted }} Free Month{{ reward.free_months_granted > 1 ? 's' : '' }}</span>
                      </div>
                      <div v-if="reward.ai_credits_granted" class="campaign-dialog__reward-item">
                        <Sparkles :size="14" />
                        <span>{{ reward.ai_credits_granted }} AI Credits</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="campaign-dialog__footer">
              <button @click="close" class="campaign-dialog__btn campaign-dialog__btn--primary">
                Close
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, Gift, User, Percent, Calendar, Sparkles, Loader2, AlertTriangle } from 'lucide-vue-next';
import api from '@/services/api';

interface Props {
  modelValue: boolean;
  campaignId: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const loading = ref(false);
const error = ref('');
const rewards = ref<any[]>([]);

function close() {
  emit('update:modelValue', false);
}

async function loadRewards() {
  if (!props.campaignId) return;

  loading.value = true;
  error.value = '';
  rewards.value = [];

  try {
    const response = await api.get(`/admin/platform-campaigns/${props.campaignId}/rewards`);
    rewards.value = response.data.rewards || [];
  } catch (err: any) {
    console.error('Failed to load rewards:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to load rewards';
  } finally {
    loading.value = false;
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    loadRewards();
  }
});
</script>

<style scoped>
.campaign-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.campaign-dialog {
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
}

.campaign-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

.campaign-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.campaign-dialog__close {
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
}

.campaign-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.campaign-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.campaign-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.campaign-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.campaign-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.campaign-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.campaign-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.campaign-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.campaign-dialog__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
  color: var(--sidebar-text-muted);
}

.campaign-dialog__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.campaign-dialog__empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background-color: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-text-muted);
}

.campaign-dialog__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.campaign-dialog__rewards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.campaign-dialog__reward {
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  padding: 1rem;
}

.campaign-dialog__reward-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.campaign-dialog__reward-user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--sidebar-text);
}

.campaign-dialog__reward-date {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.campaign-dialog__reward-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.campaign-dialog__reward-tier {
  font-size: 0.8125rem;
  color: var(--sidebar-accent);
  font-weight: 500;
}

.campaign-dialog__reward-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.campaign-dialog__reward-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  padding: 0.5rem;
  background-color: rgba(6, 182, 212, 0.05);
  border-radius: 6px;
}

.campaign-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
}

.campaign-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.campaign-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.campaign-dialog__btn {
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

.campaign-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.campaign-dialog__btn--primary:hover {
  opacity: 0.9;
}

.campaign-dialog__spinner {
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
