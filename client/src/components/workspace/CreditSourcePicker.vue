<script setup lang="ts">
  /**
   * "Pay with" picker for AI jobs (clip detection, transcription): one radio-like
   * row per credit source from `useCreditSource()`.
   */
  import { Building2, Check, User } from 'lucide-vue-next';
  import { Field } from '@/components/ui/field';
  import { IconTile } from '@/components/ui/icon-tile';
  import type { CreditSource, CreditSourceOption } from '@/composables/useCreditSource';

  const props = defineProps<{
    options: CreditSourceOption[];
    selectedSource: CreditSource;
    selectedOrganizationId: number | null;
  }>();

  const emit = defineEmits<{
    selectPersonal: [];
    selectOrganization: [organizationId: number];
  }>();

  function isSelected(option: CreditSourceOption) {
    return (
      props.selectedSource === option.type &&
      (option.type === 'personal' || props.selectedOrganizationId === option.organizationId)
    );
  }

  function select(option: CreditSourceOption) {
    if (option.type === 'personal') emit('selectPersonal');
    else emit('selectOrganization', option.organizationId!);
  }
</script>

<template>
  <Field label="Pay with">
    <!-- One framed list of divided options (not a box per option) -->
    <div
      class="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle"
      role="radiogroup"
    >
      <button
        v-for="option in options"
        :key="option.type + (option.organizationId || '')"
        type="button"
        role="radio"
        :aria-checked="isSelected(option)"
        class="flex items-center gap-3 px-3 py-2 text-left transition-colors duration-[var(--duration-fast)] focus-visible:bg-surface-hover focus-visible:outline-none"
        :class="isSelected(option) ? 'bg-brand-soft' : 'hover:bg-surface-hover'"
        @click="select(option)"
      >
        <IconTile :icon="option.type === 'personal' ? User : Building2" size="sm" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-fg">{{ option.label }}</span>
          <span class="block text-xs text-fg-muted">
            {{ option.hoursRemaining === -1 ? 'Unlimited' : `${Math.round(option.hoursRemaining)} min remaining` }}
          </span>
        </span>
        <Check v-if="isSelected(option)" class="size-4 shrink-0 text-brand" />
      </button>
    </div>
  </Field>
</template>
