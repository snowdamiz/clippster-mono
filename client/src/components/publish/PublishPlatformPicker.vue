<script setup lang="ts">
  import { PlatformLogo } from '@/components/ui/platform-logo';
  /**
   * Multi-select grid of publishing platforms (toggle tiles with the platform
   * logo). Emits `toggle` with the platform id so callers keep their own
   * selection bookkeeping (accounts, aspect ratios, ...).
   */
  import { Check } from 'lucide-vue-next';

  defineProps<{
    platforms: { id: string; label: string }[];
    selected: string[];
    disabled?: boolean;
  }>();

  defineEmits<{ toggle: [platformId: string] }>();
</script>

<template>
  <div class="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2" role="group">
    <button
      v-for="platform in platforms"
      :key="platform.id"
      type="button"
      role="checkbox"
      :aria-checked="selected.includes(platform.id)"
      :disabled="disabled"
      class="flex h-10 min-w-0 items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50"
      :class="
        selected.includes(platform.id)
          ? 'border-brand-line bg-brand-soft text-fg'
          : 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg'
      "
      @click="$emit('toggle', platform.id)"
    >
      <PlatformLogo :platform="platform.id" size="sm" />
      <span class="min-w-0 flex-1 truncate">{{ platform.label }}</span>
      <span
        class="grid size-4 shrink-0 place-items-center rounded-full border transition-colors"
        :class="selected.includes(platform.id) ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong'"
      >
        <Check v-if="selected.includes(platform.id)" class="size-3" :stroke-width="3" />
      </span>
    </button>
  </div>
</template>
