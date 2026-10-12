<template>
  <PageLayout
    title="Post submissions"
    description="Review and approve member post submissions"
    :show-header="true"
    :icon="FileCheck"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Post submissions' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <PostSubmissionsList
      :organization-id="organizationId ?? ''"
      :is-admin="isAdmin"
      :creator-profiles="creatorProfiles"
      :members="members"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { onMounted } from 'vue';
  import { FileCheck } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import PostSubmissionsList from '@/components/organization/PostSubmissionsList.vue';
  import { useOrganization } from '@/composables/useOrganization';

  const { organizationId, isAdmin, creatorProfiles, members, profilesLoaded, loadCreatorProfiles } = useOrganization();

  onMounted(() => {
    if (!profilesLoaded.value) {
      loadCreatorProfiles();
    }
  });
</script>
