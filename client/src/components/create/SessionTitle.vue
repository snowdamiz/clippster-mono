<script setup lang="ts">
  /** Click-to-rename project title for the `#title` slot of SessionHeader. Enter or blur saves, Escape cancels. */
  import { nextTick, ref, watch } from 'vue';

  const props = defineProps<{ title: string }>();
  const emit = defineEmits<{ rename: [name: string] }>();

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
</script>

<template>
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
