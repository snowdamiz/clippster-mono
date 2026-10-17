<template>
  <SessionHeader :title="title" back-label="Back to projects" @back="$emit('back')">
    <template #title>
      <input
        v-if="isRenaming"
        ref="titleInputRef"
        v-model="renameDraft"
        type="text"
        class="h-7 w-56 min-w-0 max-w-full rounded-md border border-brand-line bg-surface-raised px-2 text-sm font-semibold text-fg shadow-[0_0_0_3px_var(--brand-soft)] outline-none"
        aria-label="Project name"
        @blur="commitRename"
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent="cancelRename"
      />
      <button
        v-else
        type="button"
        class="min-w-0 truncate rounded-md px-1.5 py-1 text-left text-sm font-semibold text-fg transition-colors hover:bg-surface-hover focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
        :title="`Rename ${title}`"
        @click="startRename"
      >
        {{ title }}
      </button>
    </template>

    <template v-if="statusLabel" #badge>
      <Badge :variant="statusVariant || 'neutral'" :class="['hidden sm:inline-flex', statusClass]">{{ statusLabel }}</Badge>
    </template>

    <template #center>
      <SegmentedControl
        :model-value="mode"
        :options="modeOptions"
        @update:model-value="(value) => $emit('change-mode', value)"
      />
    </template>

    <template #actions>
      <slot name="actions-before" />

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="primary" size="sm" :disabled="!canExport" :loading="busy">
            <Download v-if="!busy" />
            Export
            <ChevronDown class="-mr-0.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('export')"><Download /> Export image</DropdownMenuItem>
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('save-local')"><HardDrive /> Save locally</DropdownMenuItem>
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('save-workable')">
            <FileStack /> Save workable file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('open-editor')">
            <ExternalLink /> Open in Image Editor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>
  </SessionHeader>
</template>

<script setup lang="ts">
  /**
   * Header for the full-screen AI Image and AI Thumbnail sessions: back,
   * inline rename, status badge, Image/Thumbnail mode switch and Export menu.
   * Built on the shared SessionHeader.
   */
  import { nextTick, ref, watch } from 'vue';
  import { ChevronDown, Download, ExternalLink, FileStack, HardDrive } from 'lucide-vue-next';
  import SessionHeader from '@/components/create/SessionHeader.vue';
  import { Badge, type BadgeVariants } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { SegmentedControl } from '@/components/ui/segmented-control';

  export type AIImageCreatorMode = 'image' | 'thumbnail';
  export type AIImageExportAction = 'export' | 'save-local' | 'save-workable' | 'open-editor';

  const props = defineProps<{
    title: string;
    mode: AIImageCreatorMode;
    canExport?: boolean;
    busy?: boolean;
    statusLabel?: string;
    /** Extra classes for the status badge (prefer `statusVariant`). */
    statusClass?: string;
    statusVariant?: BadgeVariants['variant'];
  }>();

  const emit = defineEmits<{
    back: [];
    rename: [name: string];
    'change-mode': [mode: AIImageCreatorMode];
    export: [action: AIImageExportAction];
  }>();

  const modeOptions: { value: AIImageCreatorMode; label: string }[] = [
    { value: 'image', label: 'Create image' },
    { value: 'thumbnail', label: 'Create thumbnail' },
  ];

  const isRenaming = ref(false);
  const renameDraft = ref(props.title);
  const titleInputRef = ref<HTMLInputElement | null>(null);

  watch(
    () => props.title,
    (value) => {
      if (!isRenaming.value) renameDraft.value = value;
    }
  );

  async function startRename() {
    renameDraft.value = props.title;
    isRenaming.value = true;
    await nextTick();
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
  }

  function cancelRename() {
    renameDraft.value = props.title;
    isRenaming.value = false;
  }

  function commitRename() {
    if (!isRenaming.value) return;
    const next = renameDraft.value.trim() || props.title;
    isRenaming.value = false;
    if (next !== props.title) emit('rename', next);
  }

  function run(action: AIImageExportAction) {
    emit('export', action);
  }
</script>
