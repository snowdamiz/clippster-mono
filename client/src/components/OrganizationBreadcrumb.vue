<template>
  <OrganizationSelector
    v-if="hasMultipleOrgs"
    v-model="organizationId"
    class="org-breadcrumb__selector"
  />
  <router-link
    v-else
    to="/organizations"
    class="page-header__breadcrumb-link"
  >
    Organizations
  </router-link>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  import OrganizationSelector from './OrganizationSelector.vue';
  import { useOrganizationSelector } from '@/composables/useOrganizationSelector';

  const route = useRoute();
  const { hasMultipleOrgs } = useOrganizationSelector();

  const organizationId = computed(() => route.params.id as string);
</script>

<style scoped>
  .org-breadcrumb__selector {
    margin: 0;
  }
</style>
