<script setup lang="ts">
  import { computed } from 'vue';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';
  import {
    layerId,
    readOverrides,
    setLayerOverride,
    type SceneInventory,
    type LayerOverride,
  } from '../director/sceneLayers';
  import type { EditDocument } from '../types';
  const props = defineProps<{ document: EditDocument; selected: string | null; inventories: SceneInventory[] }>();
  const emit = defineEmits<{ apply: [document: EditDocument]; deselect: [] }>();
  const selection = computed(() => {
    for (const inventory of props.inventories) {
      const layer = inventory.layers.find((layer) => layerId(inventory.owner, layer.key) === props.selected);
      if (layer) return { owner: inventory.owner, layer };
    }
    return null;
  });
  const overrides = computed(() => {
    const owner = selection.value?.owner;
    const variables =
      props.document.shots.find((shot) => shot.id === owner)?.scene?.variables ??
      props.document.overlays.find((overlay) => overlay.id === owner)?.variables;
    return readOverrides(variables?.__editorLayers)[selection.value?.layer.key ?? ''] ?? {};
  });
  function change(value: Partial<LayerOverride>) {
    const item = selection.value;
    if (item) emit('apply', setLayerOverride(props.document, item.owner, item.layer.key, value));
  }
  function style(key: string, value: string) {
    change({ styles: { ...overrides.value.styles, [key]: value } });
  }
  function timing(field: 'start' | 'duration', event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || !selection.value) return;
    const owner = selection.value.owner;
    const span =
      props.document.shots.find((shot) => shot.id === owner)?.duration ??
      props.document.overlays.find((overlay) => overlay.id === owner)?.duration ??
      1;
    const minimum = 1 / props.document.format.fps;
    const start =
      field === 'start'
        ? Math.min(span - minimum, Math.max(0, value))
        : (overrides.value.start ?? selection.value.layer.start);
    const duration = Math.min(
      span - start,
      Math.max(minimum, field === 'duration' ? value : (overrides.value.duration ?? selection.value.layer.duration))
    );
    change({ start, duration });
  }
  const fields = [
    ['translate', 'Position offset (x y)'],
    ['rotate', 'Rotation'],
    ['scale', 'Scale'],
    ['opacity', 'Opacity'],
    ['color', 'Color'],
    ['background', 'Background'],
    ['border-color', 'Border color'],
    ['fill', 'Fill'],
    ['stroke', 'Stroke'],
    ['width', 'Width'],
    ['height', 'Height'],
  ];
  const eases = ['none', 'power1.out', 'power2.out', 'power3.out', 'sine.inOut', 'back.out(1.7)', 'elastic.out(1,0.3)'];
</script>
<template>
  <div v-if="selection" class="flex flex-col gap-3">
    <span class="text-sm font-semibold capitalize text-fg">
      {{
        selection.layer.category === 'animation'
          ? 'Animation'
          : selection.layer.category === 'icons'
            ? 'Icon'
            : selection.layer.category === 'images'
              ? 'Image'
              : 'Element'
      }}
    </span>
    <span class="break-words text-xs text-fg-muted">{{ selection.layer.label }}</span>
    <Button
      size="sm"
      variant="secondary"
      @click="
        change({ deleted: true });
        emit('deselect');
      "
    >
      {{ selection.layer.kind === 'animation' ? 'Delete animation' : 'Delete element' }}
    </Button>
    <label
      v-for="field in ['start', 'duration'] as const"
      :key="field"
      class="flex flex-col gap-1 text-xs text-fg-muted"
    >
      {{ field === 'start' ? 'Start within scene (seconds)' : 'Duration (seconds)' }}
      <Input
        type="number"
        :min="field === 'start' ? 0 : 0.001"
        step=".033333"
        :aria-label="`${selection.layer.kind === 'animation' ? 'Animation' : 'Layer'} ${field}`"
        :model-value="Math.round((overrides[field] ?? selection.layer[field]) * 1000) / 1000"
        @change="timing(field, $event)"
      />
    </label>
    <template v-if="selection.layer.kind === 'animation'">
      <label class="flex flex-col gap-1 text-xs text-fg-muted">
        Easing
        <select
          aria-label="Layer animation easing"
          class="h-8 rounded-md border border-line bg-surface px-2 text-fg"
          :value="overrides.ease ?? selection.layer.ease"
          @change="change({ ease: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="ease in eases" :key="ease" :value="ease">{{ ease }}</option>
        </select>
      </label>
      <div v-for="group in ['fromProperties', 'properties'] as const" :key="group" class="flex flex-col gap-2">
        <span v-if="Object.keys(selection.layer[group] ?? {}).length" class="text-xs font-semibold text-fg">
          {{ group === 'fromProperties' ? 'From values' : 'To values' }}
        </span>
        <label
          v-for="(value, key) in selection.layer[group]"
          :key="key"
          class="flex flex-col gap-1 text-xs text-fg-muted"
        >
          {{ key }}
          <Input
            :aria-label="`Animation ${group === 'fromProperties' ? 'from' : 'to'} ${key}`"
            :model-value="overrides[group]?.[key] ?? value"
            @change="change({ [group]: { ...overrides[group], [key]: ($event.target as HTMLInputElement).value } })"
          />
        </label>
      </div>
      <p class="text-xs text-fg-subtle">
        This is one authored animation. Moving or resizing it changes its timing independently of the scene.
      </p>
    </template>
    <template v-else>
      <label v-for="[key, label] in fields" :key="key" class="flex flex-col gap-1 text-xs text-fg-muted">
        {{ label }}
        <Input
          :aria-label="`Layer ${label}`"
          :model-value="overrides.styles?.[key] ?? selection.layer.styles?.[key] ?? ''"
          @change="style(key, ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label v-if="selection.layer.category === 'images'" class="flex flex-col gap-1 text-xs text-fg-muted">
        Image URL
        <Input
          aria-label="Layer image URL"
          :model-value="overrides.src ?? selection.layer.src ?? ''"
          @change="change({ src: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label v-if="selection.layer.category === 'icons'" class="flex flex-col gap-1 text-xs text-fg-muted">
        Replace SVG icon
        <textarea
          aria-label="Layer SVG markup"
          class="min-h-24 rounded-md border border-line bg-surface p-2 font-mono text-[10px] text-fg"
          :value="overrides.svg ?? ''"
          @change="change({ svg: ($event.target as HTMLTextAreaElement).value })"
        />
      </label>
    </template>
    <Button size="sm" variant="secondary" @click="change({ hidden: !overrides.hidden })">
      {{
        overrides.hidden ? 'Restore layer' : selection.layer.kind === 'animation' ? 'Disable animation' : 'Hide element'
      }}
    </Button>
    <p class="text-xs text-fg-subtle">
      Changes save automatically. Use Undo in the timeline to restore the previous value.
    </p>
  </div>
</template>
