<template>
  <PageLayout
    title="Campaigns"
    description="Run and track clipping campaigns for your organization"
    :show-header="true"
    :icon="Target"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Campaigns' }]"
  >
    <div class="org-campaigns">
      <OrganizationCampaignsComponent :organization-id="organizationId ?? ''" :is-admin="isAdmin" />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { Target } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationCampaignsComponent from '@/components/organization/OrganizationCampaigns.vue';
  import { useOrganization } from '@/composables/useOrganization';

  const { organizationId, isAdmin } = useOrganization();
</script>

<style scoped>
  .org-campaigns {
    width: 100%;
    padding: 1.5rem;
  }
</style>
