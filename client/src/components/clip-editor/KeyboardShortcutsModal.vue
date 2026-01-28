<template>
  <Teleport to="body">
    <Transition name="shortcuts-modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10001] flex items-center justify-center p-8"
        @click.self="$emit('update:modelValue', false)"
      >
        <div
          class="w-full max-w-2xl bg-[var(--editor-surface)] rounded-xl border border-[var(--editor-border)] shadow-2xl overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--editor-border)] bg-[var(--editor-surface-elevated)]">
            <div class="flex items-center gap-3">
              <Keyboard :size="20" class="text-[var(--editor-accent)]" />
              <h2 class="text-lg font-semibold text-[var(--editor-text)]">Keyboard Shortcuts</h2>
            </div>
            <button
              class="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--editor-text-muted)] bg-transparent border-none cursor-pointer transition-all duration-150 hover:bg-[var(--editor-hover)] hover:text-[var(--editor-text)]"
              @click="$emit('update:modelValue', false)"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 max-h-[60vh] overflow-y-auto">
            <div class="grid grid-cols-2 gap-8">
              <!-- Playback -->
              <div class="flex flex-col gap-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--editor-accent)] pb-2 border-b border-white/10">
                  Playback
                </h3>
                <ShortcutRow shortcut="Space" description="Play / Pause" />
                <ShortcutRow shortcut="J" description="Rewind" />
                <ShortcutRow shortcut="K" description="Stop" />
                <ShortcutRow shortcut="L" description="Fast Forward" />
                <ShortcutRow shortcut="Home" description="Go to Start" />
                <ShortcutRow shortcut="End" description="Go to End" />
              </div>

              <!-- Editing -->
              <div class="flex flex-col gap-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--editor-accent)] pb-2 border-b border-white/10">
                  Editing
                </h3>
                <ShortcutRow shortcut="S" description="Split at Playhead" />
                <ShortcutRow shortcut="Delete" description="Delete Selected" />
                <ShortcutRow :shortcut="isMac ? '⌘ Z' : 'Ctrl+Z'" description="Undo" />
                <ShortcutRow :shortcut="isMac ? '⌘ Y' : 'Ctrl+Y'" description="Redo" />
                <ShortcutRow :shortcut="isMac ? '⌘ S' : 'Ctrl+S'" description="Save" />
              </div>

              <!-- Timeline -->
              <div class="flex flex-col gap-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--editor-accent)] pb-2 border-b border-white/10">
                  Timeline
                </h3>
                <ShortcutRow shortcut="+" description="Zoom In" />
                <ShortcutRow shortcut="-" description="Zoom Out" />
                <ShortcutRow shortcut="F" description="Fit to Window" />
                <ShortcutRow shortcut="←" description="Previous Frame" />
                <ShortcutRow shortcut="→" description="Next Frame" />
              </div>

              <!-- General -->
              <div class="flex flex-col gap-3">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--editor-accent)] pb-2 border-b border-white/10">
                  General
                </h3>
                <ShortcutRow :shortcut="isMac ? '⌘ E' : 'Ctrl+E'" description="Export" />
                <ShortcutRow shortcut="Esc" description="Close / Deselect" />
                <ShortcutRow shortcut="?" description="Show Shortcuts" />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 bg-[var(--editor-bg)] border-t border-[var(--editor-border)] text-center">
            <p class="text-xs text-[var(--editor-text-muted)]">
              Press <kbd class="px-1.5 py-0.5 bg-white/10 rounded text-[var(--editor-text)] font-mono text-[10px]">?</kbd> at any time to show this dialog
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Keyboard, X } from 'lucide-vue-next';

defineProps<{
  modelValue: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

// Detect if running on Mac
const isMac = computed(() => {
  if (typeof navigator !== 'undefined') {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }
  return false;
});

// Shortcut row sub-component
const ShortcutRow = {
  props: {
    shortcut: String,
    description: String,
  },
  template: `
    <div class="flex items-center justify-between gap-4">
      <span class="text-sm text-[var(--editor-text-muted)]">{{ description }}</span>
      <kbd class="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-[var(--editor-text)] min-w-[40px] text-center">
        {{ shortcut }}
      </kbd>
    </div>
  `,
};
</script>

<style scoped>
/* Modal transitions */
.shortcuts-modal-enter-active {
  transition: all 0.2s ease-out;
}

.shortcuts-modal-leave-active {
  transition: all 0.15s ease-in;
}

.shortcuts-modal-enter-from,
.shortcuts-modal-leave-to {
  opacity: 0;
}

.shortcuts-modal-enter-from > div,
.shortcuts-modal-leave-to > div {
  transform: scale(0.95);
}
</style>
