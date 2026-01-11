<template>
  <PageLayout
    title="Campaigns"
    description="Run and track clipping campaigns for your organization"
    :show-header="true"
    :icon="Target"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Campaigns' }]"
  >
    <template #actions>
      <button v-if="isAdmin" class="create-campaign-btn" @click="campaignsRef?.openCreateDialog()">
        <Plus class="create-campaign-btn__icon" />
        Create Campaign
      </button>
    </template>
    <div class="org-campaigns">
      <OrganizationCampaignsComponent ref="campaignsRef" :organization-id="organizationId ?? ''" :is-admin="isAdmin" />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Target, Plus } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationCampaignsComponent from '@/components/organization/OrganizationCampaigns.vue';
  import { useOrganization } from '@/composables/useOrganization';

  const { organizationId, isAdmin } = useOrganization();
  const campaignsRef = ref<InstanceType<typeof OrganizationCampaignsComponent> | null>(null);
</script>

<style scoped>
  .org-campaigns {
    width: 100%;
  }

  .create-campaign-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 34px;
    padding: 0 1rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .create-campaign-btn:hover {
    opacity: 0.9;
  }

  .create-campaign-btn__icon {
    width: 16px;
    height: 16px;
  }
</style>
