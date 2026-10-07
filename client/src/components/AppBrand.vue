<template>
  <div class="titlebar-app-info">
    <img :src="icon" alt="Clippster Logo Icon" class="titlebar-logo-icon" />
    <img :src="logo" alt="Clippster Logo" class="titlebar-logo" />
  </div>
</template>
<script setup lang="ts">
  import icon from '../../public/logo-titlebar.svg';
  import logo from '../../public/logo.svg';
</script>
<style scoped>
  .titlebar-app-info {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 12px;
    gap: 8px;
  }

  .titlebar-logo-icon {
    height: 14px;
    width: auto;
  }

  .titlebar-logo {
    height: 14px;
    width: auto;
    filter: brightness(0) invert(1); /* Make logo white for dark titlebar */
    opacity: 0.9;
    margin-top: 2px;
  }
</style>
