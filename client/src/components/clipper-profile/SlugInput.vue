<script setup lang="ts">
  /**
   * Text input with a fixed URL prefix ("/clipper/") for the public profile
   * slug. Shared by the profile edit page and the onboarding wizard.
   */
  withDefaults(
    defineProps<{
      modelValue: string;
      prefix?: string;
      placeholder?: string;
      /** Draws the error border (pair with a Field error). */
      invalid?: boolean;
    }>(),
    { prefix: '/clipper/', placeholder: 'your-username' }
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string];
    blur: [event: FocusEvent];
    enter: [event: KeyboardEvent];
  }>();
</script>

<template>
  <div
    class="flex h-[var(--control-md)] w-full items-center overflow-hidden rounded-[var(--radius-control)] border bg-surface-raised transition-[border-color,box-shadow] hover:border-line-strong focus-within:border-brand-line focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
    :class="invalid ? 'border-[var(--danger-line)]' : 'border-line'"
  >
    <span class="flex h-full shrink-0 items-center border-r border-line bg-surface px-2.5 text-sm text-fg-subtle">
      {{ prefix }}
    </span>
    <input
      :value="modelValue"
      :placeholder="placeholder"
      spellcheck="false"
      autocomplete="off"
      class="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
      :aria-invalid="invalid || undefined"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur', $event)"
      @keydown.enter="emit('enter', $event)"
    />
  </div>
</template>
