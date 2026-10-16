<script setup lang="ts">
  /**
   * The basic fields shared by the create and edit platform-campaign dialogs:
   * title, description and the start/end schedule. Anything dialog-specific
   * (e.g. the status select in Edit) goes in the default slot, rendered
   * between the description and the dates.
   *
   *   <PlatformCampaignFields
   *     v-model:title="form.title"
   *     v-model:description="form.description"
   *     v-model:starts-at="form.start_date"
   *     v-model:ends-at="form.end_date"
   *   >
   *     <Field label="Status">...</Field>
   *   </PlatformCampaignFields>
   */
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';

  const title = defineModel<string>('title', { required: true });
  const description = defineModel<string>('description', { required: true });
  const startsAt = defineModel<string>('startsAt', { required: true });
  const endsAt = defineModel<string>('endsAt', { required: true });
</script>

<template>
  <div class="flex flex-col gap-4">
    <Field label="Campaign title">
      <Input v-model="title" placeholder="Enter campaign title" />
    </Field>

    <Field label="Description">
      <Textarea v-model="description" rows="3" placeholder="Campaign description" />
    </Field>

    <slot />

    <div class="grid grid-cols-2 gap-3">
      <Field label="Start date">
        <Input v-model="startsAt" type="datetime-local" />
      </Field>
      <Field label="End date">
        <Input v-model="endsAt" type="datetime-local" />
      </Field>
    </div>
  </div>
</template>
