<template>
  <Modal
    :open="show"
    title="Existing project found"
    description="This clip has already been edited in a video project."
    :icon="FolderOpen"
    size="sm"
    @close="$emit('cancel')"
  >
    <div
      v-if="existingProject"
      class="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface px-3 py-2.5"
    >
      <IconTile :icon="Video" size="md" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-fg">{{ existingProject.name }}</p>
        <p class="mt-0.5 text-xs text-fg-muted">
          Modified {{ formatDate(existingProject.updated_at) }}
          <template v-if="existingProject.total_duration > 0">
            <span class="text-fg-disabled"> · </span>
            <span class="tabular">{{ formatDuration(existingProject.total_duration) }}</span>
          </template>
        </p>
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="$emit('create-new')">
        <Plus />
        New project
      </Button>
      <Button variant="primary" @click="$emit('open-existing')">
        <FolderOpen />
        Open existing
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { FolderOpen, Video, Plus } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { IconTile } from '@/components/ui/icon-tile';
  import type { VideoEditorProject } from '@/services/database';
  import { formatUnixDate } from '@/utils/dateTimeUtils';

  function formatDate(timestamp: number): string {
    return formatUnixDate(timestamp);
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  interface Props {
    show: boolean;
    existingProject: VideoEditorProject | null;
  }

  interface Emits {
    (e: 'open-existing'): void;
    (e: 'create-new'): void;
    (e: 'cancel'): void;
  }

  defineProps<Props>();
  defineEmits<Emits>();
</script>
