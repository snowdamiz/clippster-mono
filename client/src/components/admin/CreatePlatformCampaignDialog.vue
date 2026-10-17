<template>
  <Modal
    :open="modelValue"
    title="New platform campaign"
    description="Launch a new Clippster-owned campaign"
    :icon="Sparkles"
    size="lg"
    :dismissible="!isProcessing"
    body-class="flex flex-col gap-5"
    @update:open="(open) => !open && close()"
  >
    <PlatformCampaignFields
      v-model:title="form.title"
      v-model:description="form.description"
      v-model:starts-at="form.start_date"
      v-model:ends-at="form.end_date"
    />

    <!-- Payment model -->
    <Field label="Payment model">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2" role="radiogroup">
        <button
          v-for="model in paymentModels"
          :key="model.value"
          type="button"
          role="radio"
          :aria-checked="form.platform_payment_model === model.value"
          class="relative flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors"
          :class="
            form.platform_payment_model === model.value
              ? 'border-brand-line bg-brand-soft'
              : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
          "
          @click="form.platform_payment_model = model.value"
        >
          <span class="flex items-center justify-between gap-2 text-sm font-medium text-fg">
            {{ model.title }}
            <Check v-if="form.platform_payment_model === model.value" class="size-3.5 shrink-0 text-brand" />
          </span>
          <span class="text-xs text-fg-muted">{{ model.description }}</span>
        </button>
      </div>
    </Field>

    <div :key="form.platform_payment_model" class="animate-enter">
      <!-- CPM flywheel settings -->
      <div v-if="form.platform_payment_model === 'cpm_flywheel'" class="grid grid-cols-2 gap-3">
        <Field label="CPM rate ($)" hint="Amount paid per 1,000 views">
          <Input v-model.number="form.cpm_rate" type="number" step="0.01" min="0" />
        </Field>
        <Field label="Budget cap ($)" :hint="`Available: $${formatMoney(revenueBalance)}`">
          <Input v-model.number="form.budget" type="number" step="0.01" min="0" />
        </Field>
      </div>

      <!-- Milestone reward tiers -->
      <div v-if="form.platform_payment_model === 'milestone_rewards'" class="flex flex-col gap-3">
        <div
          v-for="(tier, index) in form.reward_tiers"
          :key="index"
          class="rounded-lg border border-line-subtle bg-surface"
        >
          <div class="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-2">
            <span class="text-sm font-semibold text-fg">Tier {{ index + 1 }}</span>
            <Button variant="ghost" size="icon-xs" :title="`Remove tier ${index + 1}`" @click="removeTier(index)">
              <Trash2 />
            </Button>
          </div>
          <div class="grid grid-cols-2 gap-3 p-3">
            <Field label="Views required">
              <Input v-model.number="tier.views_required" type="number" min="0" />
            </Field>
            <Field label="AI credits">
              <CustomDropdown
                :model-value="tier.ai_credits_amount"
                :options="aiCreditOptions"
                @update:model-value="(value) => selectAICreditsAmount(index, value)"
              />
            </Field>

            <Field label="Subscription discount">
              <CustomDropdown
                :model-value="tier.discount_percent"
                :options="discountOptions"
                @update:model-value="(value) => selectDiscountPercent(index, value)"
              />
            </Field>
            <Field v-if="tier.discount_percent > 0" label="Discount applies to">
              <CustomDropdown
                :model-value="JSON.stringify(tier.discount_applies_to_tiers)"
                :options="appliesToOptions"
                @update:model-value="(value) => selectAppliesTo(index, 'discount_applies_to_tiers', JSON.parse(value))"
              />
            </Field>
            <div v-else />

            <template v-if="tier.discount_percent > 0">
              <label class="flex h-[var(--control-md)] items-center gap-2 self-end text-sm text-fg">
                <Checkbox v-model="tier.discount_recurring" />
                Recurring discount
              </label>
              <Field v-if="tier.discount_recurring" label="Discount duration">
                <CustomDropdown
                  :model-value="tier.discount_duration_months"
                  :options="monthOptions"
                  @update:model-value="(value) => selectDiscountDuration(index, value)"
                />
              </Field>
              <div v-else />
            </template>

            <Field label="Free subscription months">
              <CustomDropdown
                :model-value="freeMonthsKey(tier)"
                :options="freeMonthOptions"
                @update:model-value="(value) => selectFreeMonthsKey(index, value)"
              />
            </Field>
            <Field v-if="tier.free_months_count > 0" label="Free months apply to">
              <CustomDropdown
                :model-value="JSON.stringify(tier.free_months_applies_to_tiers)"
                :options="appliesToOptions"
                @update:model-value="(value) => selectAppliesTo(index, 'free_months_applies_to_tiers', JSON.parse(value))"
              />
            </Field>
            <div v-else />

            <template v-if="tier.ai_credits_amount > 0">
              <label class="flex h-[var(--control-md)] items-center gap-2 self-end text-sm text-fg">
                <Checkbox v-model="tier.ai_credits_recurring" />
                Recurring credits
              </label>
              <Field v-if="tier.ai_credits_recurring" label="Credits duration">
                <CustomDropdown
                  :model-value="tier.ai_credits_duration_months"
                  :options="monthOptions"
                  @update:model-value="(value) => selectAICreditsDuration(index, value)"
                />
              </Field>
            </template>
          </div>
        </div>

        <Button variant="secondary" size="sm" class="self-start" @click="addTier">
          <Plus />
          Add tier
        </Button>
      </div>

      <!-- Regular budget settings -->
      <div v-if="form.platform_payment_model === 'regular_budget'" class="grid grid-cols-2 gap-3">
        <Field label="Payment type" class="col-span-2">
          <CustomDropdown
            :model-value="form.payment_model"
            :options="paymentTypeOptions"
            @update:model-value="selectPaymentType"
          />
        </Field>
        <Field v-if="form.payment_model === 'per_clip'" label="Amount per clip ($)">
          <Input v-model.number="form.per_clip_amount" type="number" step="0.01" min="0" />
        </Field>
        <Field v-if="form.payment_model === 'cpm'" label="CPM rate ($)">
          <Input v-model.number="form.cpm_rate" type="number" step="0.01" min="0" />
        </Field>
        <Field label="Total budget ($)">
          <Input v-model.number="form.budget" type="number" step="0.01" min="0" />
        </Field>
      </div>
    </div>

    <Alert v-if="error" variant="destructive">
      <AlertTriangle />
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <template #footer>
      <Button variant="ghost" :disabled="isProcessing" @click="close">Cancel</Button>
      <Button variant="primary" :loading="isProcessing" :disabled="!canCreate || isProcessing" @click="createCampaign">
        {{ isProcessing ? 'Creating…' : 'Create campaign' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, Check, Plus, Trash2, AlertTriangle } from 'lucide-vue-next';
import api from '@/services/api';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import PlatformCampaignFields from './PlatformCampaignFields.vue';

interface Props {
  modelValue: boolean;
  revenueBalance: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  created: [];
}>();

const showPaymentTypeDropdown = ref(false);
const isProcessing = ref(false);
const error = ref('');

const paymentModels = [
  {
    value: 'cpm_flywheel',
    title: 'Revenue flywheel (CPM)',
    description: 'Pay clippers based on views using platform fund'
  },
  {
    value: 'milestone_rewards',
    title: 'Milestone rewards',
    description: 'Grant discounts, free months, and AI credits at view milestones'
  },
  {
    value: 'regular_budget',
    title: 'Regular budget',
    description: 'Fixed payment per clip or CPM with manual verification'
  }
];

// Option lists for the reward-tier selects.
const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;
const monthOptions = [1, 2, 3, 6, 12].map((m) => ({ label: plural(m, 'month'), value: m }));
const discountOptions = [
  { label: 'No discount', value: 0 },
  ...[10, 15, 20, 25, 30, 40, 50, 75, 100].map((p) => ({ label: `${p}% off`, value: p })),
];
const aiCreditOptions = [
  { label: 'None', value: 0 },
  ...[50, 100, 200, 300, 500, 1000].map((a) => ({ label: `${a} minutes`, value: a })),
];
const freeMonthOptions = [
  { label: 'None', value: '0' },
  ...[1, 2, 3, 6, 12].map((m) => ({ label: plural(m, 'month'), value: `${m}` })),
  ...[1, 2, 3, 6, 12].map((m) => ({ label: `${plural(m, 'month')} (recurring)`, value: `${m}r` })),
];
const appliesToOptions = [[], ['starter'], ['creator'], ['pro'], ['starter', 'creator'], ['creator', 'pro']].map(
  (tiers) => ({ label: getAppliesTo(tiers), value: JSON.stringify(tiers) })
);
const paymentTypeOptions = [
  { label: 'Fixed per clip', value: 'per_clip' },
  { label: 'CPM (cost per 1,000 views)', value: 'cpm' },
];

/** Free months are one select that encodes count + recurring ("3" / "3r"). */
function freeMonthsKey(tier: any): string {
  if (!tier.free_months_count) return '0';
  return `${tier.free_months_count}${tier.free_months_recurring ? 'r' : ''}`;
}

function selectFreeMonthsKey(index: number, key: string) {
  selectFreeMonths(index, parseInt(key, 10) || 0, key.endsWith('r'));
}

const form = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  platform_payment_model: 'cpm_flywheel',
  payment_model: 'cpm',
  cpm_rate: 5.0,
  budget: 0,
  per_clip_amount: 0,
  join_type: 'open',
  allowed_platforms: ['tiktok', 'instagram', 'x', 'youtube'],
  reward_tiers: [] as any[]
});

const canCreate = computed(() => form.value.title.length >= 3);

function close() {
  if (!isProcessing.value) {
    emit('update:modelValue', false);
  }
}

function selectPaymentType(type: string) {
  form.value.payment_model = type;
  showPaymentTypeDropdown.value = false;
}

function addTier() {
  form.value.reward_tiers.push({
    tier_number: form.value.reward_tiers.length + 1,
    views_required: 10000,
    discount_percent: 0,
    discount_duration_months: 1,
    discount_recurring: false,
    discount_applies_to_tiers: [],
    free_months_count: 0,
    free_months_recurring: false,
    free_months_applies_to_tiers: [],
    ai_credits_amount: 0,
    ai_credits_duration_months: 1,
    ai_credits_recurring: false,
    showDiscountDropdown: false,
    showDiscountDurationDropdown: false,
    showDiscountTiersDropdown: false,
    showFreeMonthsDropdown: false,
    showFreeMonthsTiersDropdown: false,
    showAICreditsDropdown: false,
    showAICreditsDurationDropdown: false
  });
}

function removeTier(index: number) {
  form.value.reward_tiers.splice(index, 1);
  form.value.reward_tiers.forEach((tier, i) => {
    tier.tier_number = i + 1;
  });
}

function selectDiscountPercent(index: number, percent: number) {
  form.value.reward_tiers[index].discount_percent = percent;
  form.value.reward_tiers[index].showDiscountDropdown = false;
  if (percent === 0) {
    form.value.reward_tiers[index].discount_recurring = false;
  }
}

function selectDiscountDuration(index: number, months: number) {
  form.value.reward_tiers[index].discount_duration_months = months;
  form.value.reward_tiers[index].showDiscountDurationDropdown = false;
}

function selectFreeMonths(index: number, months: number, recurring: boolean) {
  form.value.reward_tiers[index].free_months_count = months;
  form.value.reward_tiers[index].free_months_recurring = recurring;
  form.value.reward_tiers[index].showFreeMonthsDropdown = false;
}

function selectAICreditsAmount(index: number, amount: number) {
  form.value.reward_tiers[index].ai_credits_amount = amount;
  form.value.reward_tiers[index].showAICreditsDropdown = false;
  if (amount === 0) {
    form.value.reward_tiers[index].ai_credits_recurring = false;
  }
}

function selectAICreditsDuration(index: number, months: number) {
  form.value.reward_tiers[index].ai_credits_duration_months = months;
  form.value.reward_tiers[index].showAICreditsDurationDropdown = false;
}

function selectAppliesTo(index: number, field: string, tiers: string[]) {
  form.value.reward_tiers[index][field] = tiers;
  if (field === 'discount_applies_to_tiers') {
    form.value.reward_tiers[index].showDiscountTiersDropdown = false;
  } else {
    form.value.reward_tiers[index].showFreeMonthsTiersDropdown = false;
  }
}

function getAppliesTo(tiers: string[]): string {
  if (tiers.length === 0) return 'All tiers';
  if (tiers.length === 1) return tiers[0].charAt(0).toUpperCase() + tiers[0].slice(1) + ' only';
  return tiers.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
}

async function createCampaign() {
  if (!canCreate.value) return;

  isProcessing.value = true;
  error.value = '';

  try {
    await api.post('/admin/platform-campaigns', form.value);
    emit('created');
    emit('update:modelValue', false);
  } catch (err: any) {
    console.error('Failed to create campaign:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to create campaign';
  } finally {
    isProcessing.value = false;
  }
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}
</script>
