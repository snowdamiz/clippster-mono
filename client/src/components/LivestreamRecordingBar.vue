<template>
  <div class="livestream-recording-indicator flex items-center justify-end">
    <!-- Recording indicator (only shown when recording is active) -->
    <div v-if="totalRecordedDuration > 0" class="flex items-center gap-2 text-xs text-zinc-400">
      <div class="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
      <span>{{ formatTime(totalRecordedDuration) }} available for clipping</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  interface Props {
    totalRecordedDuration: number;
    liveEdgeTime: number;
  }

  const props = defineProps<Props>();

  // Helper functions
  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<style scoped>
  .livestream-recording-indicator {
    user-select: none;
  }
</style>
