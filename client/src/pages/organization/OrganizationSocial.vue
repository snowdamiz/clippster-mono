<template>
  <PageLayout
    title="Social Accounts"
    description="Manage connected social platforms for your organization"
    :show-header="true"
    :icon="Globe"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Social Accounts' }]"
  >
    <div class="org-social">
      <SocialAccountsManager
        :organization-id="organizationId ?? ''"
        :is-admin="isAdmin"
        :members="members"
        @accounts-changed="loadOrganization"
      />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { Globe } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import SocialAccountsManager from '@/components/organization/SocialAccountsManager.vue';
  import { useOrganization } from '@/composables/useOrganization';

  const { organizationId, isAdmin, members, loadOrganization } = useOrganization();
</script>

<style scoped>
  .org-social {
    width: 100%;
    padding: 1.5rem;
  }
</style>
