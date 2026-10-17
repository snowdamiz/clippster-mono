<template>
  <img
    src="/tokend.png"
    alt="Tokend"
    class="block shrink-0 rounded-[22%] object-cover"
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
