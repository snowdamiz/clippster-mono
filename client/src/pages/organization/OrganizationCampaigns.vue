<template>
  <PageLayout
    title="Campaigns"
    description="Run and track clipping campaigns for your organization"
    :icon="Target"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Campaigns' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button v-if="isAdmin" variant="primary" size="sm" @click="campaignsRef?.openCreateDialog()">
        <Plus />
        Create campaign
      </Button>
    </template>
    <div class="w-full">
      <OrganizationCampaignsComponent ref="campaignsRef" :organization-id="organizationId ?? ''" :is-admin="isAdmin" />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Target, Plus } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import OrganizationCampaignsComponent from '@/components/organization/OrganizationCampaigns.vue';
  import { Button } from '@/components/ui/button';
  import { useOrganization } from '@/composables/useOrganization';

  const { organizationId, isAdmin } = useOrganization();
  const campaignsRef = ref<InstanceType<typeof OrganizationCampaignsComponent> | null>(null);
</script>
