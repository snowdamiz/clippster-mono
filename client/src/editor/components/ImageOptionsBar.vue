<script setup lang="ts">
  import { computed } from 'vue';
  import { IMAGE_TOOL_BY_ID } from '../constants/image-tool-flyouts';
  import { useImageEditorTools } from '../composables/useImageEditorTools';
  import { useImageBackgroundEraser } from '../composables/useImageBackgroundEraser';
  import { useEditorUIState } from '../composables/useEditorUIState';
  import { ArrowLeftRight } from 'lucide-vue-next';
  import ToolbarButton from './chrome/ToolbarButton.vue';
  import ToolbarSeparator from './chrome/ToolbarSeparator.vue';

  const {
    activeTool,
    brushSize,
    brushOpacity,
    brushHardness,
    fillTolerance,
    wandTolerance,
    wandContiguous,
    fillColor,
    strokeColor,
  } = useImageEditorTools();
  const { bgEraserSampling, bgEraserLimits, bgEraserTolerance } = useImageBackgroundEraser();
  const { isCropMode } = useEditorUIState();

  const toolMeta = computed(() => IMAGE_TOOL_BY_ID[activeTool.value]);

  const showBrushControls = computed(
    () =>
      activeTool.value === 'brush' ||
      activeTool.value === 'pencil' ||
      activeTool.value === 'eraser' ||
      activeTool.value === 'background-eraser' ||
      activeTool.value === 'clone' ||
      activeTool.value === 'heal' ||
      activeTool.value === 'spot-heal'
  );

  function swapColors() {
    const nextFill = strokeColor.value;
    strokeColor.value = fillColor.value;
    fillColor.value = nextFill;
  }
</script>

<template>
  <div class="flex h-9 shrink-0 items-center gap-3 border-b border-line-subtle bg-panel px-3">
    <div class="flex min-w-[120px] items-center gap-2">
      <span class="truncate text-xs font-medium text-fg">
        {{ toolMeta?.label?.replace(/ Tool$/, '') ?? 'Tool' }}
      </span>
      <kbd v-if="toolMeta?.shortcut" class="rounded border border-line px-1 text-2xs leading-4 text-fg-subtle">
        {{ toolMeta?.shortcut }}
      </kbd>
    </div>

    <ToolbarSeparator class="mx-0" />

    <div class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <template v-if="showBrushControls">
        <label class="flex items-center gap-1.5 text-2xs text-fg-subtle">
          Size
          <input v-model.number="brushSize" type="range" min="1" max="200" class="w-24" />
          <span class="tabular w-8 text-fg-muted">{{ brushSize }}</span>
        </label>
        <label v-if="activeTool !== 'pencil'" class="flex items-center gap-1.5 text-2xs text-fg-subtle">
          Hardness
          <input v-model.number="brushHardness" type="range" min="0" max="1" step="0.05" class="w-16" />
          <span class="tabular w-8 text-fg-muted">{{ Math.round(brushHardness * 100) }}%</span>
        </label>
        <label class="flex items-center gap-1.5 text-2xs text-fg-subtle">
          Opacity
          <input v-model.number="brushOpacity" type="range" min="0.05" max="1" step="0.05" class="w-16" />
          <span class="tabular w-8 text-fg-muted">{{ Math.round(brushOpacity * 100) }}%</span>
        </label>
        <template v-if="activeTool === 'background-eraser'">
          <label class="flex items-center gap-1.5 text-2xs text-fg-subtle">
            Tolerance
            <input v-model.number="bgEraserTolerance" type="range" min="0" max="128" class="w-20" />
            <span class="tabular w-8 text-fg-muted">{{ bgEraserTolerance }}</span>
          </label>
          <select
            v-model="bgEraserSampling"
            class="h-6 rounded-md border border-line bg-surface-raised px-1.5 text-2xs text-fg hover:border-line-strong focus:border-brand-line focus:outline-none"
            title="Sampling"
          >
            <option value="continuous">Continuous</option>
            <option value="once">Once</option>
          </select>
          <select
            v-model="bgEraserLimits"
            class="h-6 rounded-md border border-line bg-surface-raised px-1.5 text-2xs text-fg hover:border-line-strong focus:border-brand-line focus:outline-none"
            title="Limits"
          >
            <option value="contiguous">Contiguous</option>
            <option value="discontiguous">Discontiguous</option>
          </select>
        </template>
        <p v-else class="truncate text-xs text-fg-subtle">
          {{ toolMeta?.hint }}
          <span v-if="activeTool === 'eraser' || activeTool === 'magic-eraser'" class="text-fg-disabled">
            · Shift+E cycles
          </span>
        </p>
      </template>

      <template v-else-if="activeTool === 'magic-wand' || activeTool === 'magic-eraser'">
        <label class="flex items-center gap-1.5 text-2xs text-fg-subtle">
          Tolerance
          <input v-model.number="wandTolerance" type="range" min="0" max="128" class="w-24" />
          <span class="tabular w-8 text-fg-muted">{{ wandTolerance }}</span>
        </label>
        <label class="flex items-center gap-1.5 text-2xs text-fg-subtle">
          <input v-model="wandContiguous" type="checkbox" class="accent-[var(--brand)]" />
          Contiguous
        </label>
        <p class="truncate text-xs text-fg-subtle">{{ toolMeta?.hint }}</p>
      </template>

      <template v-else-if="activeTool === 'fill'">
        <label class="flex items-center gap-1.5 text-2xs text-fg-subtle">
          Tolerance
          <input v-model.number="fillTolerance" type="range" min="0" max="128" class="w-24" />
          <span class="tabular w-8 text-fg-muted">{{ fillTolerance }}</span>
        </label>
        <p class="truncate text-xs text-fg-subtle">{{ toolMeta?.hint }} · Shift+G cycles</p>
      </template>

      <p v-else-if="activeTool === 'crop'" class="truncate text-xs text-fg-subtle">
        {{ isCropMode ? 'Drag handles to crop, then confirm' : toolMeta?.hint }}
      </p>

      <p v-else class="truncate text-xs text-fg-subtle">
        {{ toolMeta?.hint }}
        <span
          v-if="toolMeta && ['M', 'L', 'B', 'E', 'G', 'J', 'U'].includes(toolMeta.shortcut)"
          class="text-fg-disabled"
        >
          · Shift+{{ toolMeta.shortcut }} cycles related tools
        </span>
      </p>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <div class="relative size-7">
        <input
          v-model="strokeColor"
          type="color"
          class="absolute bottom-0 right-0 size-4 cursor-pointer rounded-sm border border-line-strong bg-transparent"
          title="Stroke"
        />
        <input
          v-model="fillColor"
          type="color"
          class="absolute left-0 top-0 size-5 cursor-pointer rounded-sm border border-line-strong bg-transparent"
          title="Fill"
        />
      </div>
      <ToolbarButton label="Swap fill and stroke" size="icon-xs" @click="swapColors">
        <ArrowLeftRight />
      </ToolbarButton>
    </div>
  </div>
</template>
