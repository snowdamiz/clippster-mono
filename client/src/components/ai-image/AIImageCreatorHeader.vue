<template>
  <SessionHeader :title="title" back-label="Back to projects" @back="$emit('back')">
    <template #title>
      <SessionTitle :title="title" @rename="(name) => $emit('rename', name)" />
    </template>

    <template v-if="statusLabel" #badge>
      <Badge :variant="statusVariant || 'neutral'" :class="['hidden sm:inline-flex', statusClass]">
        {{ statusLabel }}
      </Badge>
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
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('export')">
            <Download />
            Export image
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('save-local')">
            <HardDrive />
            Save locally
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('save-workable')">
            <FileStack />
            Save workable file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="!canExport || busy" @click="run('open-editor')">
            <ExternalLink />
            Open in Image Editor
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
  import { ChevronDown, Download, ExternalLink, FileStack, HardDrive } from 'lucide-vue-next';
  import SessionHeader from '@/components/create/SessionHeader.vue';
  import SessionTitle from '@/components/create/SessionTitle.vue';
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

  defineProps<{
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

  function run(action: AIImageExportAction) {
    emit('export', action);
  }
</script>
