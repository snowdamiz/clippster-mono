<script setup lang="ts">
  /**
   * Payment model, rate, budget and view thresholds for a campaign — shared by
   * the create wizard and the edit form. Edits the passed form state in place.
   */
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { CPM_VIEWS_OPTIONS, formatViews, type CampaignFormState } from './campaignForm';

  defineProps<{
    form: CampaignFormState;
    /** Show the optional max-views cap (create wizard only). */
    showMaxViews?: boolean;
  }>();

  const paymentModelOptions: SegmentedOption<'cpm' | 'per_clip'>[] = [
    { value: 'cpm', label: 'CPM (cost per mille)' },
    { value: 'per_clip', label: 'Pay per clip' },
  ];
</script>

<template>
  <div class="flex flex-col gap-4">
    <Field label="Payment model">
      <SegmentedControl v-model="form.payment_model" :options="paymentModelOptions" class="self-start" />
    </Field>

    <!-- CPM fields -->
    <div v-if="form.payment_model === 'cpm'" class="flex flex-col gap-1.5">
      <div class="grid grid-cols-2 gap-3">
        <Field label="CPM price ($)">
          <Input v-model.number="form.cpm" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
        <Field label="Per views">
          <CustomDropdown v-model="form.cpm_views" :options="CPM_VIEWS_OPTIONS" placeholder="Select views" />
        </Field>
      </div>
      <p class="text-xs text-fg-subtle">${{ form.cpm }} per {{ formatViews(form.cpm_views) }} views</p>
    </div>

    <!-- Pay-per-clip fields -->
    <div v-else class="flex flex-col gap-1.5">
      <div class="grid grid-cols-2 gap-3">
        <Field label="Amount per clip ($)">
          <Input v-model.number="form.per_clip_amount" type="number" step="0.01" min="0" placeholder="0.00" />
        </Field>
        <Field label="Clips per profile">
          <Input v-model.number="form.clips_per_profile" type="number" step="1" min="1" placeholder="5" />
        </Field>
      </div>
      <p class="text-xs text-fg-subtle">
        ${{ form.per_clip_amount }} per clip, max {{ form.clips_per_profile }} clips per profile
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <Field label="Budget ($)">
        <Input v-model.number="form.budget" type="number" step="1" min="0" placeholder="0" />
      </Field>
      <Field label="Min views for payment">
        <Input v-model.number="form.min_views_for_payment" type="number" step="100" min="0" placeholder="1000" />
      </Field>
    </div>

    <Field
      v-if="showMaxViews && form.payment_model === 'cpm'"
      label="Max views (optional)"
      hint="Maximum views counted for payment. Payment is calculated only for views between min and max (e.g. 10K min to 500K max)."
    >
      <Input
        :model-value="form.max_views ?? ''"
        type="number"
        min="0"
        placeholder="500000"
        @update:model-value="(value) => (form.max_views = value === '' ? null : Number(value))"
      />
    </Field>
  </div>
</template>
