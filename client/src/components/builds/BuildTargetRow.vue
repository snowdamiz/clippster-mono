<script setup lang="ts">
  /**
   * A selectable build target (organization or campaign) in the build
   * settings dialog. Render inside one framed, divided list
   * (`divide-y … rounded-lg border`) — the row itself has no frame. When selected and several formats are being built, the
   * formats to build for this target can be toggled individually.
   */
  import { Check } from 'lucide-vue-next';
  import { Checkbox } from '@/components/ui/checkbox';

  defineProps<{
    name: string;
    subtitle?: string | null;
    selected: boolean;
    /** All formats being built. */
    ratios: string[];
    /** Formats enabled for this target. */
    targetRatios: string[];
    showRatios?: boolean;
  }>();

  const emit = defineEmits<{ toggle: []; 'toggle-ratio': [ratio: string] }>();
</script>

<template>
  <!-- Frameless row: the parent list draws one frame with hairline dividers. -->
  <div class="transition-colors" :class="selected ? 'bg-brand-soft' : 'hover:bg-surface-hover'">
    <div class="flex cursor-pointer items-center gap-3 px-3 py-2" @click="emit('toggle')">
      <Checkbox :model-value="selected" :aria-label="`Build for ${name}`" @click.stop @update:model-value="emit('toggle')" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-fg">{{ name }}</p>
        <p v-if="subtitle" class="truncate text-xs text-fg-muted">{{ subtitle }}</p>
      </div>
      <slot name="badge" />
    </div>

    <div
      v-if="selected && showRatios"
      class="flex flex-wrap items-center gap-1.5 pb-2 pl-10 pr-3"
    >
      <span class="mr-1 text-xs text-fg-subtle">Formats</span>
      <button
        v-for="ratio in ratios"
        :key="ratio"
        type="button"
        class="tabular inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors"
        :class="
          targetRatios.includes(ratio)
            ? 'border-brand-line bg-brand-soft text-brand'
            : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
        "
        :aria-pressed="targetRatios.includes(ratio)"
        @click="emit('toggle-ratio', ratio)"
      >
        <Check v-if="targetRatios.includes(ratio)" class="size-3" :stroke-width="3" />
        {{ ratio }}
      </button>
    </div>
  </div>
</template>
