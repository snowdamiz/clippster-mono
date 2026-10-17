<script setup lang="ts">
  /** Inline notice above the chat composer — errors (`danger`), confirmations (`success`) or hints (`info`). */
  import { computed } from 'vue';
  import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next';

  const props = withDefaults(defineProps<{ tone?: 'danger' | 'success' | 'info'; dismissible?: boolean }>(), {
    tone: 'danger',
    dismissible: false,
  });

  const emit = defineEmits<{ dismiss: [] }>();

  const styles = computed(
    () =>
      ({
        danger: { box: 'border-[var(--danger-line)] bg-danger-soft', icon: 'text-danger', comp: AlertCircle },
        success: { box: 'border-[var(--success-line)] bg-success-soft', icon: 'text-success', comp: CheckCircle2 },
        info: { box: 'border-brand-line bg-brand-soft', icon: 'text-brand', comp: Info },
      })[props.tone]
  );
</script>

<template>
  <div class="flex animate-enter items-start gap-2 rounded-lg border px-3 py-2 text-xs text-fg" :class="styles.box" role="alert">
    <component :is="styles.comp" class="mt-px size-3.5 shrink-0" :class="styles.icon" />
    <div class="min-w-0 flex-1 break-words"><slot /></div>
    <button
      v-if="dismissible"
      type="button"
      class="-my-0.5 -mr-1 grid size-5 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      aria-label="Dismiss"
      title="Dismiss"
      @click="emit('dismiss')"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>
