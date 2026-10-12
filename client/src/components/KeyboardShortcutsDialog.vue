<template>
  <Modal
    :open="open"
    title="Shortcuts & controls"
    description="Keyboard and mouse shortcuts for the clip editor timeline."
    :icon="KeyboardIcon"
    size="lg"
    body-class="!pt-2"
    @update:open="emit('update:open', $event)"
  >
    <SegmentedControl v-model="activeTab" :options="tabOptions" block class="mb-4" />

    <!-- Keyed by tab so each switch eases in -->
    <div :key="activeTab" class="flex animate-enter flex-col gap-4">
      <section v-for="section in activeSections" :key="section.title ?? 'default'" class="flex flex-col gap-1">
        <h3 v-if="section.title" class="eyebrow px-1 pb-1">{{ section.title }}</h3>
        <div class="overflow-hidden rounded-[var(--radius-card)] border border-line-subtle bg-surface">
          <div
            v-for="item in section.items"
            :key="item.label"
            class="flex min-h-10 items-center justify-between gap-4 border-b border-line-subtle px-3 py-2 last:border-b-0"
          >
            <span class="text-sm text-fg">{{ item.label }}</span>
            <span class="flex shrink-0 items-center gap-1.5 text-xs text-fg-muted">
              <template v-for="(part, i) in item.combo" :key="i">
                <span v-if="i > 0" class="text-fg-subtle">+</span>
                <kbd
                  v-if="part.key"
                  class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-raised px-1.5 text-2xs font-medium text-fg shadow-[0_1px_0_var(--line-strong)]"
                >
                  {{ part.key }}
                </kbd>
                <span v-else class="rounded bg-surface-hover px-1.5 py-0.5 text-fg-muted">{{ part.action }}</span>
              </template>
              <span v-if="item.hint" class="text-fg-subtle">{{ item.hint }}</span>
            </span>
          </div>
        </div>
      </section>

      <p v-if="activeTab === 'more'" class="flex items-start gap-2 px-1 text-xs text-fg-muted">
        <Info class="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
        <span>
          <kbd class="font-mono text-fg">Ctrl</kbd> on Windows and Linux works like
          <kbd class="font-mono text-fg">Cmd</kbd> on macOS for multi-selection and scrolling.
        </span>
      </p>
    </div>
  </Modal>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { Edit3, Info, KeyboardIcon, MoreHorizontal, MousePointer, Play, Scissors, ZoomIn } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

  defineProps<{ open: boolean }>();
  const emit = defineEmits<{ 'update:open': [value: boolean] }>();

  type ComboPart = { key?: string; action?: string };
  type Shortcut = { label: string; combo: ComboPart[]; hint?: string };
  type Section = { title?: string; items: Shortcut[] };
  type TabId = 'playback' | 'timeline' | 'selection' | 'editing' | 'cut' | 'more';

  const key = (k: string): ComboPart => ({ key: k });
  const act = (a: string): ComboPart => ({ action: a });

  const shortcuts: Record<TabId, Section[]> = {
    playback: [
      {
        items: [
          { label: 'Play / pause', combo: [key('Space')] },
          { label: 'Play / pause (alternative)', combo: [act('Click video')] },
          { label: 'Seek playhead (no selection)', combo: [key('← →')], hint: 'hold for 2×' },
          { label: 'Seek to time', combo: [act('Click video track')] },
          { label: 'Scrub', combo: [act('Drag playhead')] },
        ],
      },
    ],
    timeline: [
      {
        items: [
          { label: 'Zoom in / out', combo: [act('Scroll on ruler')] },
          { label: 'Zoom to range', combo: [act('Click + drag timeline')] },
          { label: 'Zoom level', combo: [act('Drag slider')] },
          { label: 'Pan horizontally', combo: [key('Ctrl'), act('Scroll')] },
          { label: 'Pan vertically (through clips)', combo: [key('Alt'), act('Scroll')] },
        ],
      },
    ],
    selection: [
      {
        items: [
          { label: 'Select segment', combo: [act('Click segment')] },
          { label: 'Multi-select segments', combo: [key('Ctrl'), act('Click segments')] },
          { label: 'Deselect all', combo: [act('Click empty area')] },
        ],
      },
    ],
    editing: [
      {
        title: 'Keyboard',
        items: [
          { label: 'Move selected segments', combo: [key('← →')], hint: 'hold for 2×' },
          { label: 'Delete selected segments', combo: [key('Backspace')] },
          { label: 'Merge selected segments', combo: [key('J')] },
        ],
      },
      {
        title: 'Mouse',
        items: [
          { label: 'Reorder segment', combo: [act('Drag segment')] },
          { label: 'Trim start / end', combo: [act('Drag segment edge')] },
        ],
      },
    ],
    cut: [
      {
        items: [
          { label: 'Toggle cut tool', combo: [key('X')] },
          { label: 'Split at cursor', combo: [act('Click segment')] },
          { label: 'Cancel cut tool', combo: [key('Esc')] },
        ],
      },
    ],
    more: [
      {
        title: 'General',
        items: [{ label: 'Exit cut tool / close dialogs', combo: [key('Esc')] }],
      },
      {
        title: 'Timeline toolbar',
        items: [
          { label: 'Back 10 seconds', combo: [act('Hold button')] },
          { label: 'Forward 10 seconds', combo: [act('Hold button')] },
          { label: 'Cut tool', combo: [act('Click to toggle')] },
          { label: 'Merge segments', combo: [act('Click to merge')] },
        ],
      },
    ],
  };

  const tabOptions: SegmentedOption<TabId>[] = [
    { value: 'playback', label: 'Playback', icon: Play },
    { value: 'timeline', label: 'Timeline', icon: ZoomIn },
    { value: 'selection', label: 'Selection', icon: MousePointer },
    { value: 'editing', label: 'Editing', icon: Edit3 },
    { value: 'cut', label: 'Cut', icon: Scissors },
    { value: 'more', label: 'More', icon: MoreHorizontal },
  ];

  const activeTab = ref<TabId>('playback');
  const activeSections = computed(() => shortcuts[activeTab.value]);
</script>
