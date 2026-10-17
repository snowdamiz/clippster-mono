<script setup lang="ts">
  /** Join type and start/end dates for a campaign (create wizard + edit form). */
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { JOIN_TYPE_OPTIONS, type CampaignFormState } from './campaignForm';

  defineProps<{ form: CampaignFormState }>();
</script>

<template>
  <div class="flex flex-col gap-4">
    <Field label="Join type" hint="Open: anyone can join. Application required: you approve each clipper.">
      <CustomDropdown v-model="form.join_type" :options="JOIN_TYPE_OPTIONS" placeholder="Select join type" />
    </Field>
    <div class="grid grid-cols-2 gap-3">
      <Field label="Start date (optional)">
        <Input v-model="form.starts_at" type="datetime-local" />
      </Field>
      <Field label="End date (optional)">
        <Input v-model="form.ends_at" type="datetime-local" />
      </Field>
    </div>
  </div>
</template>
