<script setup lang="ts">
  /**
   * First-load placeholder for an admin conversation list (avatar + two
   * lines per row). Drawn with `.skeleton` blocks only, so it stays hidden
   * for the skeleton delay and fast loads go straight to the list.
   *
   *   <AdminChatListSkeleton v-if="loading && !conversations.length" :rows="5" />
   */
  withDefaults(defineProps<{ rows?: number }>(), { rows: 4 });
</script>

<template>
  <div class="flex flex-col gap-1" aria-busy="true">
    <div v-for="i in rows" :key="i" class="flex items-center gap-2.5 px-2.5 py-2">
      <div class="skeleton size-9 shrink-0 !rounded-full" />
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <div class="skeleton h-3 w-2/5" />
        <div class="skeleton h-2.5 w-4/5" />
      </div>
    </div>
  </div>
</template>
