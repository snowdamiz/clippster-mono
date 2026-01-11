<template>
  <PageLayout
    title="Shared Clips"
    description="Distribute clips to team members for editing and posting"
    :show-header="true"
    :icon="Share2"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Shared Clips' }]"
  >
    <template #actions>
      <Button v-if="isAdmin" @click="showShareClipDialog = true">
        <Share2 class="h-4 w-4 mr-1.5" />
        Share Clip
      </Button>
    </template>

    <div class="org-shared">
      <SharedClipsList
        ref="sharedClipsListRef"
        :organization-id="organizationId ?? ''"
        :is-admin="isAdmin"
        @share-clip="showShareClipDialog = true"
        @view-clip="handleViewSharedClip"
        @view-stats="handleViewSharedClipStats"
      />
    </div>

    <!-- Share Clip Dialog -->
    <ShareClipDialog
      v-model:open="showShareClipDialog"
      :organization-id="organizationId ?? ''"
      :members="members"
      @created="handleSharedClipCreated"
      @close="showShareClipDialog = false"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { Share2 } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import PageLayout from '@/components/PageLayout.vue';
  import SharedClipsList from '@/components/organization/SharedClipsList.vue';
  import ShareClipDialog from '@/components/organization/ShareClipDialog.vue';
  import type { SharedClip } from '@/services/sharedClipsApi';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';

  const { success: showSuccess } = useToast();

  const { organizationId, isAdmin, members } = useOrganization();

  const showShareClipDialog = ref(false);
  const sharedClipsListRef = ref<InstanceType<typeof SharedClipsList> | null>(null);

  function handleViewSharedClip(clip: SharedClip) {
    console.log('View shared clip:', clip);
  }

  function handleViewSharedClipStats(clip: SharedClip) {
    console.log('View shared clip stats:', clip);
  }

  function handleSharedClipCreated(clip: SharedClip) {
    showShareClipDialog.value = false;
    sharedClipsListRef.value?.loadClips();
    showSuccess('Clip shared successfully');
  }
</script>

<style scoped>
  .org-shared {
    width: 100%;
    padding: 1.5rem;
  }
</style>
