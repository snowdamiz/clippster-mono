<script setup lang="ts">
  /**
   * Project tile for the Video Editor library (/video-editor): the shared
   * `MediaTile` (thumbnail, selection checkbox, hover actions) with the
   * editor's source / clip / duration chips and a "more" menu (open, edit
   * details, delete). Presentational only — the page owns the data and
   * actions. Laid out by `ProjectGrid` like the other Create tools.
   */
  import { ref } from 'vue';
  import { Clapperboard, Clock, Edit, Film, MoreHorizontal, Play, Trash2 } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { MediaChip, MediaTile } from '@/components/ui/media-tile';

  defineProps<{
    name: string;
    thumbnailUrl?: string | null;
    selected?: boolean;
    /** "Clip project" chip (project built from clips). */
    isClipProject?: boolean;
    sourceCount?: number;
    inEditorCount?: number;
    /** Formatted duration, or empty for an empty project. */
    duration?: string;
    updatedLabel: string;
  }>();

  const emit = defineEmits<{
    open: [];
    edit: [];
    delete: [];
    'toggle-select': [];
  }>();

  /** Keep the hover actions visible while the menu is open. */
  const menuOpen = ref(false);
</script>

<template>
  <MediaTile
    :title="name"
    :thumbnail="thumbnailUrl"
    :icon="Clapperboard"
    :meta="[duration ? null : 'Empty project', updatedLabel]"
    selectable
    :selected="selected"
    :actions-visible="menuOpen"
    @open="emit('open')"
    @toggle-select="emit('toggle-select')"
  >
    <template v-if="isClipProject || sourceCount || inEditorCount || duration" #badges>
      <MediaChip v-if="duration">
        <Clock />
        <span class="tabular">{{ duration }}</span>
      </MediaChip>
      <MediaChip v-if="isClipProject">
        <Film />
        Clip project
      </MediaChip>
      <MediaChip v-else-if="sourceCount && sourceCount > 0">
        <Film />
        {{ sourceCount }} {{ sourceCount === 1 ? 'source' : 'sources' }}
      </MediaChip>
      <MediaChip v-if="inEditorCount && inEditorCount > 0">
        <Edit />
        {{ inEditorCount }} in editor
      </MediaChip>
    </template>

    <template #actions>
      <DropdownMenu v-model:open="menuOpen">
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" size="icon-xs" title="More actions" :aria-label="`More actions for ${name}`">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem @select="emit('open')">
            <Play />
            Open in editor
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('edit')">
            <Edit />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="text-danger focus:bg-danger-soft [&>svg]:text-danger" @select="emit('delete')">
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </MediaTile>
</template>
