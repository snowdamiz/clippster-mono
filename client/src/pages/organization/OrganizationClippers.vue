<template>
  <PageLayout
    title="Find clippers"
    description="Discover and recruit talented clippers for your team"
    :icon="Search"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Find clippers' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <SegmentedControl v-model="activeView" :options="viewOptions" size="sm" />
    </template>

    <OrganizationClippersComponent :active-view="activeView" :organization-id="organizationId" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRoute } from 'vue-router';
  import { Search, Users, Trophy } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import OrganizationClippersComponent from '@/components/organization/OrganizationClippers.vue';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

  type ClippersView = 'directory' | 'leaderboard';

  const route = useRoute();
  const organizationId = route.params.id as string;
  const activeView = ref<ClippersView>('directory');

  const viewOptions: SegmentedOption<ClippersView>[] = [
    { value: 'directory', label: 'Directory', icon: Users },
    { value: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ];
</script>
