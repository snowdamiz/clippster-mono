<script setup lang="ts">
  /**
   * "Portfolio clips" section of the clipper profile editor (max 3 clips).
   * Add / edit / delete hit the API immediately and refresh the list; they
   * are not part of the editor's Save changes.
   */
  import { onBeforeUnmount, reactive, ref } from 'vue';
  import { Clapperboard, Pencil, Plus, Trash2, Video } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SectionCard } from '@/components/ui/section-card';
  import { confirmDialog } from '@/composables/useDialogs';
  import { useToast } from '@/composables/useToast';
  import { deletePortfolioClip, listPortfolioClips, type PortfolioClip } from '@/services/clipperProfilesApi';
  import PortfolioClipDialog from './PortfolioClipDialog.vue';

  const MAX_CLIPS = 3;

  const clips = defineModel<PortfolioClip[]>('clips', { required: true });

  const toast = useToast();
  const showDialog = ref(false);
  const editing = ref<PortfolioClip | null>(null);

  // Posters captured while uploading, shown until the stored thumbnail is
  // reachable (R2 URLs aren't always loadable by <img> right away).
  const localThumbs = reactive(new Map<number, string>());
  // Clips whose stored thumbnail failed to load fall back to the icon.
  const brokenThumbs = reactive(new Set<number>());

  const thumbnailFor = (clip: PortfolioClip) =>
    localThumbs.get(clip.id) ?? (brokenThumbs.has(clip.id) ? null : clip.thumbnail_url);

  const formatDuration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  function openDialog(clip: PortfolioClip | null = null) {
    editing.value = clip;
    showDialog.value = true;
  }

  function forgetThumb(id: number) {
    const url = localThumbs.get(id);
    if (url) URL.revokeObjectURL(url);
    localThumbs.delete(id);
    brokenThumbs.delete(id);
  }

  async function reload() {
    try {
      const response = await listPortfolioClips();
      if (response.success) clips.value = response.portfolio_clips;
    } catch (error) {
      console.error('Failed to load portfolio clips:', error);
    }
  }

  async function onSaved({ clipId, localThumbnail }: { clipId?: number; localThumbnail?: string | null }) {
    if (clipId !== undefined) {
      forgetThumb(clipId);
      if (localThumbnail) localThumbs.set(clipId, localThumbnail);
    } else if (localThumbnail) {
      URL.revokeObjectURL(localThumbnail);
    }
    // An edited thumbnail URL gets a fresh chance to load.
    if (editing.value) brokenThumbs.delete(editing.value.id);
    await reload();
  }

  async function remove(clip: PortfolioClip) {
    const confirmed = await confirmDialog({
      title: 'Delete portfolio clip?',
      message: `“${clip.title || 'Untitled'}” will be removed from your profile.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      const response = await deletePortfolioClip(clip.id);
      if (!response.success) throw new Error(response.error);
      forgetThumb(clip.id);
      clips.value = clips.value.filter((c) => c.id !== clip.id);
    } catch (error) {
      console.error('Failed to delete portfolio clip:', error);
      toast.error('Couldn’t delete clip', 'Please try again.');
    }
  }

  onBeforeUnmount(() => localThumbs.forEach((url) => URL.revokeObjectURL(url)));
</script>

<template>
  <SectionCard
    title="Portfolio clips"
    description="Showcase up to 3 of your best clips"
    :count="`${clips.length}/${MAX_CLIPS}`"
    flush
  >
    <template #actions>
      <Button variant="secondary" size="sm" :disabled="clips.length >= MAX_CLIPS" @click="openDialog()">
        <Plus />
        Add clip
      </Button>
    </template>

    <EmptyState
      v-if="clips.length === 0"
      size="sm"
      :icon="Clapperboard"
      title="No portfolio clips yet"
      description="Add clips from your library, upload a file or link a video."
    />
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-4">
      <article v-for="clip in clips" :key="clip.id" class="flex min-w-0 flex-col gap-1">
        <div class="relative aspect-video overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken">
          <img
            v-if="thumbnailFor(clip)"
            :src="thumbnailFor(clip)!"
            alt=""
            class="size-full object-cover"
            @error="brokenThumbs.add(clip.id)"
          />
          <div v-else class="grid size-full place-items-center">
            <Video class="size-6 text-fg-disabled" />
          </div>
          <span
            v-if="clip.duration"
            class="tabular absolute bottom-1.5 right-1.5 rounded bg-[var(--overlay)] px-1.5 py-0.5 text-2xs font-medium text-fg"
          >
            {{ formatDuration(clip.duration) }}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <p class="min-w-0 flex-1 truncate text-sm font-medium text-fg" :title="clip.title || 'Untitled'">
            {{ clip.title || 'Untitled' }}
          </p>
          <Button variant="ghost" size="icon-xs" aria-label="Edit clip" title="Edit clip" @click="openDialog(clip)">
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            class="hover:!bg-danger-soft hover:!text-danger"
            aria-label="Delete clip"
            title="Delete clip"
            @click="remove(clip)"
          >
            <Trash2 />
          </Button>
        </div>
      </article>
    </div>
  </SectionCard>

  <PortfolioClipDialog v-model:open="showDialog" :clip="editing" @saved="onSaved" />
</template>
