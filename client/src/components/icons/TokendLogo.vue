<template>
  <img
    src="/tokend.png"
    alt="Tokend"
    class="tokend-logo"
    :width="size"
    :height="size"
    :style="{ width: `${size}px`, height: `${size}px` }"
    draggable="false"
  />
</template>

<script setup lang="ts">
  withDefaults(
    defineProps<{
      size?: number;
    }>(),
    { size: 24 }
  );
</script>

<style scoped>
  .tokend-logo {
    display: block;
    border-radius: 22%;
    object-fit: cover;
    flex-shrink: 0;
  }
</style>
