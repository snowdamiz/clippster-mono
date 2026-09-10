<template>
  <header
    class="relative z-10 flex h-[3.2rem] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0e0e10] px-3 pr-4"
  >
    <div class="flex min-w-0 items-center gap-2">
      <button
        type="button"
        class="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
        aria-label="Back to projects"
        @click="$emit('back')"
      >
        <ArrowLeft class="size-4" />
      </button>

      <input
        v-if="isRenaming"
        ref="titleInputRef"
        v-model="renameDraft"
        type="text"
        class="h-7 min-w-24 max-w-72 rounded border border-white/10 bg-white/5 px-2 text-[0.85rem] text-zinc-100 outline-none focus:border-blue-400/70 focus:bg-white/10"
        aria-label="Project name"
        @blur="commitRename"
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent="cancelRename"
      />
      <button
        v-else
        type="button"
        class="max-w-72 truncate rounded px-1.5 py-1 text-left text-[0.85rem] text-zinc-200 transition-colors hover:bg-white/5 hover:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
        :title="`Rename ${title}`"
        @click="startRename"
      >
        {{ title }}
      </button>

      <span
        v-if="statusLabel"
        class="hidden rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline"
        :class="statusClass"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div
      class="pointer-events-auto absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center"
    >
      <div class="flex rounded-lg border border-white/10 bg-zinc-900/80 p-0.5">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="mode === 'image' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
          @click="$emit('change-mode', 'image')"
        >
          Create Image
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="mode === 'thumbnail' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
          @click="$emit('change-mode', 'thumbnail')"
        >
          Create Thumbnail
        </button>
      </div>
    </div>

    <nav class="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <slot name="actions-before" />

      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md px-[0.12rem] py-[0.12rem] text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canExport || busy"
          @click="showExportMenu = !showExportMenu"
        >
          <div
            class="relative flex items-center gap-1.5 rounded-md bg-[var(--sidebar-accent,#0ea5e9)] px-3 py-1.5 shadow-[0_1px_3px_0px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#0284c7]"
          >
            <Loader2 v-if="busy" class="size-4 animate-spin" />
            <Download v-else class="size-4" />
            <span class="text-[0.875rem] font-medium">Export</span>
            <ChevronDown class="size-3.5 opacity-80" />
          </div>
        </button>

        <div
          v-if="showExportMenu"
          class="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-md"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            :disabled="!canExport || busy"
            @click="run('export')"
          >
            <Download class="size-3.5" />
            Export image
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            :disabled="!canExport || busy"
            @click="run('save-local')"
          >
            <HardDrive class="size-3.5" />
            Save locally
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            :disabled="!canExport || busy"
            @click="run('save-workable')"
          >
            <FileStack class="size-3.5" />
            Save workable file
          </button>
          <div class="my-1 border-t border-white/10" />
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40"
            :disabled="!canExport || busy"
            @click="run('open-editor')"
          >
            <ExternalLink class="size-3.5" />
            Open in Image Editor
          </button>
        </div>
        <div v-if="showExportMenu" class="fixed inset-0 z-40" @click="showExportMenu = false" />
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
  import { nextTick, ref, watch } from 'vue';
  import {
    ArrowLeft,
    ChevronDown,
    Download,
    ExternalLink,
    FileStack,
    HardDrive,
    Loader2,
  } from 'lucide-vue-next';

  export type AIImageCreatorMode = 'image' | 'thumbnail';
  export type AIImageExportAction = 'export' | 'save-local' | 'save-workable' | 'open-editor';

  const props = defineProps<{
    title: string;
    mode: AIImageCreatorMode;
    canExport?: boolean;
    busy?: boolean;
    statusLabel?: string;
    statusClass?: string;
  }>();

  const emit = defineEmits<{
    back: [];
    rename: [name: string];
    'change-mode': [mode: AIImageCreatorMode];
    export: [action: AIImageExportAction];
  }>();

  const isRenaming = ref(false);
  const renameDraft = ref(props.title);
  const titleInputRef = ref<HTMLInputElement | null>(null);
  const showExportMenu = ref(false);

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
    showExportMenu.value = false;
    emit('export', action);
  }
</script>
