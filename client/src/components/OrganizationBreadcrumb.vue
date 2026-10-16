<template>
  <!-- First crumb on organization pages: the org itself (switcher when the user has several). -->
  <OrganizationSelector v-if="hasMultipleOrgs" :model-value="organizationId" muted />
  <router-link
    v-else
    :to="`/organization/${organizationId}`"
    class="truncate text-fg-muted transition-colors hover:text-fg"
  >
    {{ organization?.name || 'Organization' }}
  </router-link>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  import OrganizationSelector from './OrganizationSelector.vue';
  import { useOrganizationSelector } from '@/composables/useOrganizationSelector';
  import { useOrganization } from '@/composables/useOrganization';

  const route = useRoute();
  const { hasMultipleOrgs } = useOrganizationSelector();
  const { organization } = useOrganization();

  const organizationId = computed(() => route.params.id as string);
</script>
