<template>
  <div class="flex items-center justify-center gap-2">
    <img :src="icon" alt="" class="h-3.5 w-auto" />
    <img :src="logo" alt="Clippster" class="mt-0.5 h-3.5 w-auto brightness-0 invert" />
  </div>
</template>

<script setup lang="ts">
  import icon from '../../public/logo-titlebar.svg';
  import logo from '../../public/logo.svg';
</script>
