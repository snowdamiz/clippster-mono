<script setup lang="ts">
  /**
   * "Schedule for later" switch with date + time inputs, a human summary of
   * the chosen moment and a validation message. Validation lives in the
   * parent; this only renders.
   */
  import { CalendarClock } from 'lucide-vue-next';
  import CustomTimePicker from '@/components/CustomTimePicker.vue';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Switch } from '@/components/ui/switch';

  const props = withDefaults(
    defineProps<{
      enabled: boolean;
      date: string;
      time: string;
      minDate?: string;
      /** e.g. "in 3 hours (Tue, Oct 14, 6:30 PM)" */
      summary?: string | null;
      error?: string | null;
      disabled?: boolean;
      idPrefix?: string;
    }>(),
    { idPrefix: 'publish' }
  );

  const emit = defineEmits<{
    'update:enabled': [value: boolean];
    'update:date': [value: string];
    'update:time': [value: string];
  }>();
</script>

<template>
  <div class="flex flex-col gap-3 border-t border-line-subtle pt-4">
    <label :for="`${props.idPrefix}-schedule`" class="flex cursor-pointer items-center justify-between gap-3">
      <span class="flex flex-col">
        <span class="text-sm font-medium text-fg">Schedule for later</span>
        <span class="text-xs text-fg-subtle">Publish automatically at a set time</span>
      </span>
      <Switch
        :id="`${props.idPrefix}-schedule`"
        :model-value="enabled"
        :disabled="disabled"
        @update:model-value="(v: boolean) => emit('update:enabled', v)"
      />
    </label>

    <template v-if="enabled">
      <div class="grid grid-cols-2 gap-3">
        <Field label="Date" :for="`${props.idPrefix}-schedule-date`">
          <Input
            :id="`${props.idPrefix}-schedule-date`"
            type="date"
            :model-value="date"
            :min="minDate"
            :disabled="disabled"
            @update:model-value="(v) => emit('update:date', String(v))"
          />
        </Field>
        <Field label="Time">
          <CustomTimePicker :model-value="time" :disabled="disabled" @update:model-value="(v) => emit('update:time', v)" />
        </Field>
      </div>
      <p v-if="summary && !error" class="flex items-center gap-1.5 text-xs text-fg-muted">
        <CalendarClock class="size-3.5 shrink-0 text-fg-subtle" />
        Will be published {{ summary }}
      </p>
      <p v-if="error" class="text-xs text-danger">{{ error }}</p>
    </template>
  </div>
</template>
