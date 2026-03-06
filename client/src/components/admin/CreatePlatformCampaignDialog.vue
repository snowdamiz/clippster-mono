<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="campaign-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="campaign-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="campaign-dialog__accent"></div>

            <!-- Header -->
            <div class="campaign-dialog__header">
              <button class="campaign-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="campaign-dialog__icon">
                <Sparkles :size="24" />
              </div>
              <h2 class="campaign-dialog__title">Create Platform Campaign</h2>
              <p class="campaign-dialog__subtitle">Launch a new Clippster-owned campaign</p>
            </div>

            <!-- Content -->
            <div class="campaign-dialog__content">
              <!-- Basic Information -->
              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Campaign Title</label>
                <input
                  v-model="form.title"
                  type="text"
                  class="campaign-dialog__input"
                  placeholder="Enter campaign title"
                />
              </div>

              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Description</label>
                <textarea
                  v-model="form.description"
                  rows="3"
                  class="campaign-dialog__input campaign-dialog__textarea"
                  placeholder="Campaign description"
                ></textarea>
              </div>

              <div class="campaign-dialog__field-row">
                <div class="campaign-dialog__field">
                  <label class="campaign-dialog__label">Start Date</label>
                  <input v-model="form.start_date" type="datetime-local" class="campaign-dialog__input" />
                </div>
                <div class="campaign-dialog__field">
                  <label class="campaign-dialog__label">End Date</label>
                  <input v-model="form.end_date" type="datetime-local" class="campaign-dialog__input" />
                </div>
              </div>

              <!-- Payment Model Selection -->
              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Payment Model</label>
                <div class="campaign-dialog__radio-group">
                  <button
                    v-for="model in paymentModels"
                    :key="model.value"
                    @click="form.platform_payment_model = model.value"
                    class="campaign-dialog__radio-option"
                    :class="{ 'campaign-dialog__radio-option--selected': form.platform_payment_model === model.value }"
                  >
                    <div class="campaign-dialog__radio-content">
                      <div class="campaign-dialog__radio-title">{{ model.title }}</div>
                      <div class="campaign-dialog__radio-desc">{{ model.description }}</div>
                    </div>
                    <div
                      v-if="form.platform_payment_model === model.value"
                      class="campaign-dialog__checkmark"
                    >
                      <Check :size="14" />
                    </div>
                  </button>
                </div>
              </div>

              <!-- CPM Flywheel Settings -->
              <div v-if="form.platform_payment_model === 'cpm_flywheel'" class="campaign-dialog__section">
                <div class="campaign-dialog__field-row">
                  <div class="campaign-dialog__field">
                    <label class="campaign-dialog__label">CPM Rate ($)</label>
                    <input
                      v-model.number="form.cpm_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      class="campaign-dialog__input"
                    />
                    <small class="campaign-dialog__hint">Amount paid per 1000 views</small>
                  </div>
                  <div class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Budget Cap ($)</label>
                    <input
                      v-model.number="form.budget"
                      type="number"
                      step="0.01"
                      min="0"
                      class="campaign-dialog__input"
                    />
                    <small class="campaign-dialog__hint">Available: ${{ formatMoney(revenueBalance) }}</small>
                  </div>
                </div>
              </div>

              <!-- Milestone Rewards Settings -->
              <div v-if="form.platform_payment_model === 'milestone_rewards'" class="campaign-dialog__section">
                <div v-for="(tier, index) in form.reward_tiers" :key="index" class="campaign-dialog__tier">
                  <div class="campaign-dialog__tier-header">
                    <span class="campaign-dialog__tier-title">Tier {{ index + 1 }}</span>
                    <button @click="removeTier(index)" class="campaign-dialog__tier-remove">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                  
                  <div class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Views Required</label>
                    <input
                      v-model.number="tier.views_required"
                      type="number"
                      min="0"
                      class="campaign-dialog__input"
                    />
                  </div>

                  <!-- Discount Percentage -->
                  <div class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Subscription Discount</label>
                    <div class="relative">
                      <button
                        @click="tier.showDiscountDropdown = !tier.showDiscountDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ tier.discount_percent > 0 ? tier.discount_percent + '% off' : 'No discount' }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showDiscountDropdown }"
                        />
                      </button>
                      <div v-if="tier.showDiscountDropdown" class="campaign-dialog__dropdown">
                        <button
                          @click="selectDiscountPercent(index, 0)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.discount_percent === 0 }"
                        >
                          No discount
                        </button>
                        <button
                          v-for="percent in [10, 15, 20, 25, 30, 40, 50, 75, 100]"
                          :key="percent"
                          @click="selectDiscountPercent(index, percent)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.discount_percent === percent }"
                        >
                          {{ percent }}% off
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Discount Recurring Checkbox (only if discount > 0) -->
                  <div v-if="tier.discount_percent > 0" class="campaign-dialog__field">
                    <label class="campaign-dialog__checkbox-wrapper">
                      <input
                        type="checkbox"
                        v-model="tier.discount_recurring"
                        class="campaign-dialog__checkbox"
                      />
                      <span>Recurring discount</span>
                    </label>
                  </div>

                  <!-- Discount Duration (only if discount > 0 and recurring) -->
                  <div v-if="tier.discount_percent > 0 && tier.discount_recurring" class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Discount Duration</label>
                    <div class="relative">
                      <button
                        @click="tier.showDiscountDurationDropdown = !tier.showDiscountDurationDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ tier.discount_duration_months }} month{{ tier.discount_duration_months !== 1 ? 's' : '' }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showDiscountDurationDropdown }"
                        />
                      </button>
                      <div v-if="tier.showDiscountDurationDropdown" class="campaign-dialog__dropdown">
                        <button
                          v-for="months in [1, 2, 3, 6, 12]"
                          :key="months"
                          @click="selectDiscountDuration(index, months)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.discount_duration_months === months }"
                        >
                          {{ months }} month{{ months !== 1 ? 's' : '' }}
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Discount Applies To (only if discount > 0) -->
                  <div v-if="tier.discount_percent > 0" class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Discount Applies To</label>
                    <div class="relative">
                      <button
                        @click="tier.showDiscountTiersDropdown = !tier.showDiscountTiersDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ getAppliesTo(tier.discount_applies_to_tiers) }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showDiscountTiersDropdown }"
                        />
                      </button>
                      <div v-if="tier.showDiscountTiersDropdown" class="campaign-dialog__dropdown">
                        <button
                          @click="selectAppliesTo(index, 'discount_applies_to_tiers', [])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.discount_applies_to_tiers.length === 0 }"
                        >
                          All tiers
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'discount_applies_to_tiers', ['starter'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.discount_applies_to_tiers) === JSON.stringify(['starter']) }"
                        >
                          Starter only
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'discount_applies_to_tiers', ['creator'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.discount_applies_to_tiers) === JSON.stringify(['creator']) }"
                        >
                          Creator only
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'discount_applies_to_tiers', ['pro'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.discount_applies_to_tiers) === JSON.stringify(['pro']) }"
                        >
                          Pro only
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'discount_applies_to_tiers', ['starter', 'creator'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.discount_applies_to_tiers) === JSON.stringify(['starter', 'creator']) }"
                        >
                          Starter + Creator
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'discount_applies_to_tiers', ['creator', 'pro'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.discount_applies_to_tiers) === JSON.stringify(['creator', 'pro']) }"
                        >
                          Creator + Pro
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Free Months -->
                  <div class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Free Subscription Months</label>
                    <div class="relative">
                      <button
                        @click="tier.showFreeMonthsDropdown = !tier.showFreeMonthsDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ tier.free_months_count > 0 ? tier.free_months_count + ' month' + (tier.free_months_count !== 1 ? 's' : '') + (tier.free_months_recurring ? ' (recurring)' : '') : 'None' }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showFreeMonthsDropdown }"
                        />
                      </button>
                      <div v-if="tier.showFreeMonthsDropdown" class="campaign-dialog__dropdown">
                        <button
                          @click="selectFreeMonths(index, 0, false)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.free_months_count === 0 }"
                        >
                          None
                        </button>
                        <button
                          v-for="months in [1, 2, 3, 6, 12]"
                          :key="months"
                          @click="selectFreeMonths(index, months, false)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.free_months_count === months && !tier.free_months_recurring }"
                        >
                          {{ months }} month{{ months !== 1 ? 's' : '' }}
                        </button>
                        <button
                          v-for="months in [1, 2, 3, 6, 12]"
                          :key="'recurring-' + months"
                          @click="selectFreeMonths(index, months, true)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.free_months_count === months && tier.free_months_recurring }"
                        >
                          {{ months }} month{{ months !== 1 ? 's' : '' }} (recurring)
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Free Months Applies To (only if free_months > 0) -->
                  <div v-if="tier.free_months_count > 0" class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Free Months Apply To</label>
                    <div class="relative">
                      <button
                        @click="tier.showFreeMonthsTiersDropdown = !tier.showFreeMonthsTiersDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ getAppliesTo(tier.free_months_applies_to_tiers) }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showFreeMonthsTiersDropdown }"
                        />
                      </button>
                      <div v-if="tier.showFreeMonthsTiersDropdown" class="campaign-dialog__dropdown">
                        <button
                          @click="selectAppliesTo(index, 'free_months_applies_to_tiers', [])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.free_months_applies_to_tiers.length === 0 }"
                        >
                          All tiers
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'free_months_applies_to_tiers', ['starter'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.free_months_applies_to_tiers) === JSON.stringify(['starter']) }"
                        >
                          Starter only
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'free_months_applies_to_tiers', ['creator'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.free_months_applies_to_tiers) === JSON.stringify(['creator']) }"
                        >
                          Creator only
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'free_months_applies_to_tiers', ['pro'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.free_months_applies_to_tiers) === JSON.stringify(['pro']) }"
                        >
                          Pro only
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'free_months_applies_to_tiers', ['starter', 'creator'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.free_months_applies_to_tiers) === JSON.stringify(['starter', 'creator']) }"
                        >
                          Starter + Creator
                        </button>
                        <button
                          @click="selectAppliesTo(index, 'free_months_applies_to_tiers', ['creator', 'pro'])"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': JSON.stringify(tier.free_months_applies_to_tiers) === JSON.stringify(['creator', 'pro']) }"
                        >
                          Creator + Pro
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- AI Credits Amount -->
                  <div class="campaign-dialog__field">
                    <label class="campaign-dialog__label">AI Credits</label>
                    <div class="relative">
                      <button
                        @click="tier.showAICreditsDropdown = !tier.showAICreditsDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ tier.ai_credits_amount > 0 ? tier.ai_credits_amount + ' minutes' : 'None' }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showAICreditsDropdown }"
                        />
                      </button>
                      <div v-if="tier.showAICreditsDropdown" class="campaign-dialog__dropdown">
                        <button
                          @click="selectAICreditsAmount(index, 0)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.ai_credits_amount === 0 }"
                        >
                          None
                        </button>
                        <button
                          v-for="amount in [50, 100, 200, 300, 500, 1000]"
                          :key="amount"
                          @click="selectAICreditsAmount(index, amount)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.ai_credits_amount === amount }"
                        >
                          {{ amount }} minutes
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- AI Credits Recurring Checkbox (only if amount > 0) -->
                  <div v-if="tier.ai_credits_amount > 0" class="campaign-dialog__field">
                    <label class="campaign-dialog__checkbox-wrapper">
                      <input
                        type="checkbox"
                        v-model="tier.ai_credits_recurring"
                        class="campaign-dialog__checkbox"
                      />
                      <span>Recurring credits</span>
                    </label>
                  </div>

                  <!-- AI Credits Duration (only if amount > 0 and recurring) -->
                  <div v-if="tier.ai_credits_amount > 0 && tier.ai_credits_recurring" class="campaign-dialog__field">
                    <label class="campaign-dialog__label">Credits Duration</label>
                    <div class="relative">
                      <button
                        @click="tier.showAICreditsDurationDropdown = !tier.showAICreditsDurationDropdown"
                        class="campaign-dialog__input campaign-dialog__select"
                      >
                        <span>{{ tier.ai_credits_duration_months }} month{{ tier.ai_credits_duration_months !== 1 ? 's' : '' }}</span>
                        <ChevronDown
                          :size="16"
                          class="transition-transform"
                          :class="{ 'rotate-180': tier.showAICreditsDurationDropdown }"
                        />
                      </button>
                      <div v-if="tier.showAICreditsDurationDropdown" class="campaign-dialog__dropdown">
                        <button
                          v-for="months in [1, 2, 3, 6, 12]"
                          :key="months"
                          @click="selectAICreditsDuration(index, months)"
                          class="campaign-dialog__dropdown-item"
                          :class="{ 'campaign-dialog__dropdown-item--selected': tier.ai_credits_duration_months === months }"
                        >
                          {{ months }} month{{ months !== 1 ? 's' : '' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <button @click="addTier" class="campaign-dialog__btn-add">
                  <Plus :size="16" />
                  Add Tier
                </button>
              </div>

              <!-- Regular Budget Settings -->
              <div v-if="form.platform_payment_model === 'regular_budget'" class="campaign-dialog__section">
                <div class="campaign-dialog__field">
                  <label class="campaign-dialog__label">Payment Type</label>
                  <div class="relative">
                    <button
                      @click="showPaymentTypeDropdown = !showPaymentTypeDropdown"
                      class="campaign-dialog__input campaign-dialog__select"
                    >
                      <span>{{ form.payment_model === 'per_clip' ? 'Fixed Per Clip' : 'CPM (Cost Per 1000 Views)' }}</span>
                      <ChevronDown
                        :size="16"
                        class="transition-transform"
                        :class="{ 'rotate-180': showPaymentTypeDropdown }"
                      />
                    </button>
                    <div v-if="showPaymentTypeDropdown" class="campaign-dialog__dropdown">
                      <button
                        @click="selectPaymentType('per_clip')"
                        class="campaign-dialog__dropdown-item"
                        :class="{ 'campaign-dialog__dropdown-item--selected': form.payment_model === 'per_clip' }"
                      >
                        Fixed Per Clip
                      </button>
                      <button
                        @click="selectPaymentType('cpm')"
                        class="campaign-dialog__dropdown-item"
                        :class="{ 'campaign-dialog__dropdown-item--selected': form.payment_model === 'cpm' }"
                      >
                        CPM (Cost Per 1000 Views)
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="form.payment_model === 'per_clip'" class="campaign-dialog__field">
                  <label class="campaign-dialog__label">Amount Per Clip ($)</label>
                  <input
                    v-model.number="form.per_clip_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    class="campaign-dialog__input"
                  />
                </div>

                <div v-if="form.payment_model === 'cpm'" class="campaign-dialog__field">
                  <label class="campaign-dialog__label">CPM Rate ($)</label>
                  <input
                    v-model.number="form.cpm_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    class="campaign-dialog__input"
                  />
                </div>

                <div class="campaign-dialog__field">
                  <label class="campaign-dialog__label">Total Budget ($)</label>
                  <input
                    v-model.number="form.budget"
                    type="number"
                    step="0.01"
                    min="0"
                    class="campaign-dialog__input"
                  />
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="campaign-dialog__alert campaign-dialog__alert--error">
                <AlertTriangle :size="16" />
                <p>{{ error }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="campaign-dialog__footer">
              <button @click="close" class="campaign-dialog__btn campaign-dialog__btn--secondary">
                Cancel
              </button>
              <button
                @click="createCampaign"
                :disabled="!canCreate || isProcessing"
                class="campaign-dialog__btn campaign-dialog__btn--primary"
              >
                <Loader2 v-if="isProcessing" :size="16" class="campaign-dialog__spinner" />
                {{ isProcessing ? 'Creating...' : 'Create Campaign' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { X, Sparkles, Check, ChevronDown, Plus, Trash2, Loader2, AlertTriangle } from 'lucide-vue-next';
import api from '@/services/api';

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
    title: 'Revenue Flywheel (CPM)',
    description: 'Pay clippers based on views using platform fund'
  },
  {
    value: 'milestone_rewards',
    title: 'Milestone Rewards',
    description: 'Grant discounts, free months, and AI credits at view milestones'
  },
  {
    value: 'regular_budget',
    title: 'Regular Budget',
    description: 'Fixed payment per clip or CPM with manual verification'
  }
];

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

<style scoped>
/* Overlay */
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

/* Dialog Container */
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

/* Accent Bar */
.campaign-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* Header */
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

/* Content Area */
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

/* Form Field */
.campaign-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.campaign-dialog__field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.campaign-dialog__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.campaign-dialog__input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.campaign-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.campaign-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.campaign-dialog__textarea {
  resize: vertical;
  min-height: 80px;
}

.campaign-dialog__hint {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin-top: -0.25rem;
}

.campaign-dialog__select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.campaign-dialog__select:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Dropdown */
.campaign-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
}

.campaign-dialog__dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: background-color 150ms ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.campaign-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.campaign-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

/* Radio Group */
.campaign-dialog__radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.campaign-dialog__radio-option {
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  transition: all 150ms ease;
  border: 1px solid var(--sidebar-border);
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  cursor: pointer;
}

.campaign-dialog__radio-option:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.campaign-dialog__radio-option--selected {
  background-color: rgba(6, 182, 212, 0.15);
  border-color: rgba(6, 182, 212, 0.3);
}

.campaign-dialog__radio-content {
  flex: 1;
}

.campaign-dialog__radio-title {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.campaign-dialog__radio-desc {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.campaign-dialog__checkmark {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--sidebar-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #000;
}

/* Section */
.campaign-dialog__section {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

/* Tier */
.campaign-dialog__tier {
  padding: 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.campaign-dialog__tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.campaign-dialog__tier-title {
  font-weight: 600;
  font-size: 0.875rem;
}

.campaign-dialog__tier-remove {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background-color 150ms ease;
}

.campaign-dialog__tier-remove:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.campaign-dialog__btn-add {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px dashed var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 150ms ease;
}

.campaign-dialog__btn-add:hover {
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
  background-color: rgba(6, 182, 212, 0.05);
}

/* Checkbox */
.campaign-dialog__checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  cursor: pointer;
}

.campaign-dialog__checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--sidebar-accent);
}

/* Dropdown */
.campaign-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
  max-height: 12rem;
  overflow-y: auto;
}

.campaign-dialog__dropdown::-webkit-scrollbar {
  width: 6px;
}

.campaign-dialog__dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.campaign-dialog__dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.campaign-dialog__dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: background-color 150ms ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.campaign-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.campaign-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

/* Alert */
.campaign-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.campaign-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Footer */
.campaign-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

/* Buttons */
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

.campaign-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.campaign-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.campaign-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.campaign-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.campaign-dialog__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.campaign-dialog__spinner {
  animation: spin 0.8s linear infinite;
}

/* Transitions */
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
