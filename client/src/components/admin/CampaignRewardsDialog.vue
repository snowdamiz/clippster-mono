<template>
  <Modal
    :open="modelValue"
    title="Campaign rewards"
    description="Rewards granted for this campaign"
    :icon="Gift"
    size="lg"
    @update:open="(open) => !open && close()"
  >
    <!-- Loading -->
    <div v-if="loading" class="flex flex-col gap-2">
      <div v-for="i in 3" :key="i" class="skeleton h-[68px] rounded-lg" />
    </div>

    <Alert v-else-if="error" variant="destructive">
      <AlertTriangle />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <EmptyState v-else-if="rewards.length === 0" size="sm" :icon="Gift" title="No rewards granted yet" />

    <ul v-else class="flex animate-fade-in flex-col divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface">
      <li v-for="reward in rewards" :key="reward.id" class="flex items-start gap-3 px-3.5 py-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-raised text-fg-subtle">
          <User class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3">
            <p class="truncate text-sm font-medium text-fg">{{ reward.user?.username || 'Unknown user' }}</p>
            <span class="shrink-0 text-xs text-fg-subtle">{{ formatDate(reward.granted_at) }}</span>
          </div>
          <p class="tabular text-xs text-fg-muted">
            Tier {{ reward.reward_tier?.tier_number || '?' }} · {{ formatNumber(reward.reward_tier?.views_required || 0) }} views
          </p>
          <div
            v-if="reward.stripe_coupon_id || reward.free_months_granted || reward.ai_credits_granted"
            class="mt-1.5 flex flex-wrap gap-1.5"
          >
            <Badge v-if="reward.stripe_coupon_id" variant="neutral" class="font-mono">
              <Percent />{{ reward.stripe_coupon_id }}
            </Badge>
            <Badge v-if="reward.free_months_granted" variant="success">
              <Calendar />{{ reward.free_months_granted }} free month{{ reward.free_months_granted > 1 ? 's' : '' }}
            </Badge>
            <Badge v-if="reward.ai_credits_granted" variant="ai">
              <Sparkles />{{ reward.ai_credits_granted }} AI credits
            </Badge>
          </div>
        </div>
      </li>
    </ul>

    <template #footer>
      <Button variant="secondary" @click="close">Close</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Gift, User, Percent, Calendar, Sparkles, AlertTriangle } from 'lucide-vue-next';
import api from '@/services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';

interface Props {
  modelValue: boolean;
  campaignId?: number | null;
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
