<script setup lang="ts">
  /**
   * Account picker used by every publish/schedule flow. Values follow the
   * existing `org:<id>` / `user:<id>` convention; an empty string means
   * "nothing selected" and shows the placeholder.
   *
   *   <PublishAccountSelect
   *     v-model="accountValue"
   *     :groups="[
   *       { label: 'Organization', prefix: 'org', accounts: orgAccounts },
   *       { label: 'Personal', prefix: 'user', accounts: personalAccounts },
   *     ]"
   *   />
   */
  import { computed } from 'vue';
  import type { PublishAccountGroup } from './types';
  import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';

  const props = withDefaults(
    defineProps<{
      modelValue: string | null | undefined;
      groups: PublishAccountGroup[];
      placeholder?: string;
      loading?: boolean;
      disabled?: boolean;
      size?: 'sm' | 'md';
      /** Shown under the trigger when no group has accounts. */
      emptyText?: string;
      id?: string;
    }>(),
    { placeholder: 'Select account', size: 'md' }
  );

  const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

  const visibleGroups = computed(() => props.groups.filter((g) => g.accounts.length > 0));
  const isEmpty = computed(() => !props.loading && visibleGroups.value.length === 0);

  const value = computed({
    get: () => props.modelValue || '',
    set: (v: string) => emit('update:modelValue', v),
  });
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <Select v-model="value" :disabled="disabled || loading || isEmpty">
      <SelectTrigger :id="id" :class="size === 'sm' ? 'h-[var(--control-sm)] text-xs' : ''">
        <SelectValue :placeholder="loading ? 'Loading accounts…' : isEmpty ? 'No accounts connected' : placeholder" />
      </SelectTrigger>
      <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
        <template v-for="(group, index) in visibleGroups" :key="group.prefix + group.label">
          <SelectSeparator v-if="index > 0" />
          <SelectGroup class="p-0">
            <SelectLabel>{{ group.label }}</SelectLabel>
            <SelectItem
              v-for="account in group.accounts"
              :key="`${group.prefix}-${account.id}`"
              :value="`${group.prefix}:${account.id}`"
            >
              @{{ account.username }}
            </SelectItem>
          </SelectGroup>
        </template>
      </SelectContent>
    </Select>
    <p v-if="isEmpty && emptyText" class="text-xs text-warning">{{ emptyText }}</p>
  </div>
</template>
