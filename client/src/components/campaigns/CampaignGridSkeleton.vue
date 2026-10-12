<script setup lang="ts">
  /**
   * First-load placeholder for a grid of `CampaignCard`s (Campaigns page,
   * organization campaigns). Same grid and lean card shape as the loaded
   * content; `skeleton-group` keeps it invisible during fast loads.
   */
  withDefaults(defineProps<{ count?: number }>(), { count: 6 });
</script>

<template>
  <div class="skeleton-group card-grid [--card-grid-min:17.5rem]" aria-hidden="true">
    <div
      v-for="i in count"
      :key="i"
      class="flex flex-col gap-2.5 rounded-xl border border-line-subtle bg-surface px-3.5 py-3"
    >
      <div class="flex flex-col gap-2">
        <div class="skeleton h-3.5 w-2/3" />
        <div class="skeleton h-3 w-1/3" />
        <div class="skeleton h-3 w-full" />
      </div>
      <div class="flex flex-col gap-2 border-t border-line-subtle pt-2.5">
        <div class="skeleton h-3.5 w-1/2" />
        <div class="skeleton h-3 w-3/4" />
      </div>
    </div>
  </div>
</template>
