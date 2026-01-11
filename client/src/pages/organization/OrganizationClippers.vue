<template>
  <PageLayout
    title="Find Clippers"
    description="Discover and recruit talented clippers for your team"
    :show-header="true"
    :icon="Search"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Find Clippers' }]"
  >
    <div class="org-clippers">
      <OrganizationClippersComponent />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { Search } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationClippersComponent from '@/components/organization/OrganizationClippers.vue';
</script>

<style scoped>
  .org-clippers {
    width: 100%;
    padding: 1.5rem;
  }
</style>
