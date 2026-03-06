<template>
  <PageLayout
    title="Platform Campaigns"
    description="Manage Clippster-owned campaigns and rewards"
    :show-header="true"
    :icon="Sparkles"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Platform Campaigns' }]"
  >
    <PlatformCampaigns />
  </PageLayout>
</template>

<script setup lang="ts">
  import { Sparkles } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import PlatformCampaigns from '@/components/admin/PlatformCampaigns.vue';
</script>

<style scoped>
  /* No additional styles needed - component handles its own styling */
</style>
