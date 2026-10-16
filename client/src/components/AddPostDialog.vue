<template>
  <Modal
    :open="modelValue"
    title="Add post"
    description="Track a post you've published externally."
    :icon="Link"
    size="md"
    :dismissible="!submitting"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <Field label="Post URL" required :error="urlError">
        <Input
          v-model="postUrl"
          type="url"
          :disabled="submitting"
          placeholder="Paste an Instagram, TikTok, YouTube or X post URL"
        />
        <div v-if="detectedPlatform" class="flex items-center gap-1.5">
          <Badge size="md">
            <component :is="platformIcon" />
            {{ platformDisplayName }}
          </Badge>
          <span class="text-xs text-fg-subtle">detected</span>
        </div>
      </Field>

      <Field label="Creator profile" hint="Select if this post was made for a specific creator.">
        <template #label-end><span class="text-2xs text-fg-subtle">Optional</span></template>
        <DropdownMenu>
          <DropdownMenuTrigger as-child :disabled="submitting || loadingCreators">
            <button
              type="button"
              class="flex h-[var(--control-md)] w-full min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-left text-sm text-fg transition-colors hover:border-line-strong disabled:opacity-50 data-[state=open]:border-line-strong"
            >
              <Loader2 v-if="loadingCreators" class="size-3.5 shrink-0 animate-spin text-fg-subtle" />
              <span class="min-w-0 flex-1 truncate" :class="{ 'text-fg-muted': !selectedCreatorId }">
                <template v-if="loadingCreators">Loading creators…</template>
                <template v-else-if="selectedCreatorId">{{ selectedCreatorLabel }}</template>
                <template v-else>None (personal post)</template>
              </span>
              <ChevronDown class="size-3.5 shrink-0 text-fg-subtle" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto"
          >
            <DropdownMenuItem @select="selectCreator('')">
              <span class="flex-1 text-fg-muted">None (personal post)</span>
              <Check v-if="!selectedCreatorId" class="!text-brand" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>My creators</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="creator in myCreators"
              :key="creator.id"
              class="h-auto min-h-8 py-1.5"
              @select="selectCreator(creator.id)"
            >
              <Avatar :src="creator.profile_image_url" :icon="User" size="sm" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate">{{ creator.name }}</span>
                <span v-if="creator.org_name" class="truncate text-2xs text-fg-subtle">{{ creator.org_name }}</span>
              </span>
              <Check v-if="selectedCreatorId === creator.id" class="!text-brand" />
            </DropdownMenuItem>
            <p v-if="!myCreators.length" class="px-2 py-2 text-xs text-fg-subtle">No creator profiles found</p>
          </DropdownMenuContent>
        </DropdownMenu>
      </Field>

      <p
        v-if="error"
        class="rounded-lg border border-[var(--danger-line)] bg-danger-soft px-3 py-2 text-xs text-danger"
      >
        {{ error }}
      </p>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="submitting" @click="close">Cancel</Button>
      <Button variant="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
        {{ submitting ? 'Submitting…' : 'Add post' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { Check, Link, ChevronDown, Loader2, User, Instagram, Youtube, X } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { submitPersonalExternalPost, getUserAssignedCreatorProfiles } from '@/services/creatorProfileRuntime';
  import { useToast } from '@/composables/useToast';

  interface CreatorOption {
    id: string;
    name: string;
    profile_image_url: string | null;
    org_name?: string;
    server_id?: number;
  }

  const props = defineProps<{
    modelValue: boolean;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    submitted: [submission: any];
  }>();

  const { showToast } = useToast();

  const postUrl = ref('');
  const detectedPlatform = ref<string | null>(null);
  const urlError = ref<string | null>(null);
  const selectedCreatorId = ref('');
  const showCreatorDropdown = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const loadingCreators = ref(false);
  const myCreators = ref<CreatorOption[]>([]);

  // Auto-detect platform from URL
  watch(postUrl, () => {
    if (!postUrl.value) {
      detectedPlatform.value = null;
      urlError.value = null;
      return;
    }

    const url = postUrl.value.toLowerCase();

    if (url.includes('instagram.com') || url.includes('instagr.am')) {
      detectedPlatform.value = 'instagram';
      urlError.value = null;
    } else if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      detectedPlatform.value = 'tiktok';
      urlError.value = null;
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      detectedPlatform.value = 'youtube';
      urlError.value = null;
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      detectedPlatform.value = 'twitter';
      urlError.value = null;
    } else {
      detectedPlatform.value = null;
      urlError.value = 'URL must be from Instagram, TikTok, YouTube, or X';
    }
  });

  const platformDisplayName = computed(() => {
    switch (detectedPlatform.value) {
      case 'instagram':
        return 'Instagram';
      case 'tiktok':
        return 'TikTok';
      case 'youtube':
        return 'YouTube';
      case 'twitter':
        return 'X (Twitter)';
      default:
        return '';
    }
  });

  const platformIcon = computed(() => {
    switch (detectedPlatform.value) {
      case 'instagram':
        return Instagram;
      case 'youtube':
        return Youtube;
      default:
        return Link;
    }
  });

  const platformBadgeClass = computed(() => {
    switch (detectedPlatform.value) {
      case 'instagram':
        return 'add-post-dialog__platform-badge--instagram';
      case 'tiktok':
        return 'add-post-dialog__platform-badge--tiktok';
      case 'youtube':
        return 'add-post-dialog__platform-badge--youtube';
      case 'twitter':
        return 'add-post-dialog__platform-badge--twitter';
      default:
        return '';
    }
  });

  const selectedCreatorLabel = computed(() => {
    const creator = myCreators.value.find((c) => c.id === selectedCreatorId.value);
    return creator ? creator.name : '';
  });

  const canSubmit = computed(() => {
    return postUrl.value && detectedPlatform.value && !urlError.value;
  });

  function selectCreator(id: string) {
    selectedCreatorId.value = id;
    showCreatorDropdown.value = false;
  }

  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showCreatorDropdown.value = false;
    }
  }

  async function loadCreators() {
    loadingCreators.value = true;
    try {
      const res = await getUserAssignedCreatorProfiles();
      if (res.success) {
        myCreators.value = res.profiles.map((p) => ({
          id: `org-${p.id}`,
          name: p.name,
          profile_image_url: p.profile_image_url ?? null,
          org_name: (p as any).organization?.name,
          server_id: p.id,
        }));
      }
    } catch (e) {
      console.error('[AddPostDialog] Failed to load creators:', e);
    } finally {
      loadingCreators.value = false;
    }
  }

  function resetForm() {
    postUrl.value = '';
    detectedPlatform.value = null;
    urlError.value = null;
    selectedCreatorId.value = '';
    showCreatorDropdown.value = false;
    error.value = null;
  }

  function close() {
    if (!submitting.value) {
      emit('update:modelValue', false);
    }
  }

  async function submit() {
    if (!canSubmit.value) return;

    submitting.value = true;
    error.value = null;

    try {
      // Resolve server_id from selected creator
      let creatorProfileId: number | undefined;
      if (selectedCreatorId.value) {
        const creator = myCreators.value.find((c) => c.id === selectedCreatorId.value);
        creatorProfileId = creator?.server_id;
      }

      const response = await submitPersonalExternalPost({
        platform: detectedPlatform.value!,
        post_url: postUrl.value,
        creator_profile_id: creatorProfileId,
      });

      if (response.success) {
        showToast('Post added successfully', 'success');
        emit('submitted', response.submission);
        emit('update:modelValue', false);
      } else {
        error.value = response.error || 'Failed to add post';
      }
    } catch (err: any) {
      console.error('[AddPostDialog] Failed to submit:', err);
      error.value = err?.response?.data?.error || 'Failed to add post. Please try again.';
    } finally {
      submitting.value = false;
    }
  }

  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        resetForm();
        loadCreators();
      }
    }
  );

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>
