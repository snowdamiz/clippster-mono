<template>
  <div class="flex h-full min-w-0 flex-col">
    <PageLayout
      title="Edit profile"
      description="Build your public portfolio to attract organizations"
      :icon="UserCircle"
      :breadcrumbs="[{ label: 'My profile', path: '/clipper-profile' }, { label: 'Edit profile' }]"
    >
      <template #actions>
        <router-link
          v-if="publicSlug"
          :to="`/clippers/${publicSlug}`"
          :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
        >
          <Eye />
          View public profile
        </router-link>
      </template>

      <ClipperProfileEditor ref="editor" />
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { Eye, UserCircle } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ClipperProfileEditor from '@/components/clipper-profile/ClipperProfileEditor.vue';
  import { buttonVariants } from '@/components/ui/button';
  import { useUnsavedChanges } from '@/composables/useUnsavedChanges';

  const editor = ref<InstanceType<typeof ClipperProfileEditor> | null>(null);

  /** Saved (not draft) slug of a public profile, for the header link. */
  const publicSlug = computed(() => {
    const profile = editor.value?.profile;
    return profile?.is_public && profile.slug ? profile.slug : null;
  });

  // Asks before leaving the page or quitting the app with unsaved profile edits.
  useUnsavedChanges(() => editor.value?.isDirty ?? false, {
    title: 'Discard unsaved changes?',
    message: 'Your profile changes haven’t been saved yet.',
  });
</script>
