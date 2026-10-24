<script setup lang="ts">
  /** Details of the selected timeline block: swap or remove a shot, edit or remove a scene or overlay. */
  import { computed } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Separator } from '@/components/ui/separator';
  import { placeShots } from '../compiler/compile';
  import { removeOverlay, removeShot, setBlockText, swapShot } from '../director/edits';
  import { formatClock } from '../format';
  import { findSceneText } from '../director/sceneText';
  import SceneVariableFields from './SceneVariableFields.vue';
  import BlockTimingInspector from './BlockTimingInspector.vue';
  import CompositionEditor from './CompositionEditor.vue';
  import SceneLayerInspector from './SceneLayerInspector.vue';
  import TransitionInspector from './TransitionInspector.vue';
  import type { SceneInventory } from '../director/sceneLayers';
  import type { EditDocument, MediaItem } from '../types';

  const props = defineProps<{
    document: EditDocument;
    media: MediaItem[];
    files?: Record<string, string>;
    selected: string | null;
    maxSeconds?: number;
    inventories?: SceneInventory[];
  }>();
  const emit = defineEmits<{
    apply: [document: EditDocument];
    text: [blockId: string, document: EditDocument];
    deselect: [];
    composition: [path: string, source: string];
  }>();

  const names = computed(() => new Map(props.media.map((item) => [item.id, item.name])));
  const shotIndex = computed(() => props.document.shots.findIndex((shot) => shot.id === props.selected));
  const shot = computed(() => props.document.shots[shotIndex.value] ?? null);
  const placed = computed(() => (shot.value ? placeShots(props.document)[shotIndex.value] : null));
  const overlay = computed(() => props.document.overlays.find((entry) => entry.id === props.selected) ?? null);
  const copyField = computed(() => findSceneText(props.document, props.selected, props.files));
  const selectedComposition = computed(
    () =>
      shot.value?.scene?.composition ??
      overlay.value?.composition ??
      props.document.shots.find((shot) => shot.id === copyField.value?.shotId)?.scene?.composition ??
      null
  );
  const music = computed(() =>
    props.selected === `music:${props.document.music?.mediaId}` ? props.document.music : null
  );

  const alternates = computed(() =>
    (shot.value?.alternates ?? []).map((alternate, index) => {
      const next = swapShot(props.document, shot.value!.id, index, props.media);
      return {
        ...alternate,
        name: names.value.get(alternate.mediaId) ?? alternate.mediaId,
        next,
        fits: next.shots[shotIndex.value] !== shot.value,
      };
    })
  );

  function remove() {
    if (shot.value) emit('apply', removeShot(props.document, shot.value.id, props.media));
    else if (overlay.value) emit('apply', removeOverlay(props.document, overlay.value.id));
    emit('deselect');
  }

  function onText(value: string | number) {
    if (props.selected)
      emit('text', props.selected, setBlockText(props.document, props.selected, String(value), props.files));
  }
  function onSceneVariable(key: string, value: string | number | boolean) {
    const current = shot.value;
    if (!current?.scene) return;
    const next = {
      ...props.document,
      shots: props.document.shots.map((item) =>
        item.id === current.id && item.scene
          ? { ...item, scene: { ...item.scene, variables: { ...item.scene.variables, [key]: value } } }
          : item
      ),
    };
    emit('text', `${current.id}:${key}`, next);
  }
  function setMusicVolume(value: string | number) {
    if (!music.value) return;
    const volume = Number(value);
    if (Number.isFinite(volume))
      emit('apply', { ...props.document, music: { ...music.value, volume: Math.max(0, Math.min(100, volume)) / 100 } });
  }
</script>

<template>
  <BlockTimingInspector
    :document="document"
    :media="media"
    :files="files"
    :selected="selected"
    :max-seconds="maxSeconds ?? 60"
    @apply="emit('apply', $event)"
  />
  <SceneLayerInspector v-if="selected?.startsWith('layer:')" :document="document" :selected="selected" :inventories="inventories ?? []" @apply="emit('apply', $event)" @deselect="emit('deselect')" />
  <TransitionInspector v-else-if="selected?.startsWith('transition:')" :document="document" :selected="selected" @apply="emit('apply', $event)" />
  <div v-else-if="copyField" class="flex flex-col gap-3">
    <span class="text-sm font-semibold text-fg">Text</span>
    <label class="flex flex-col gap-1.5 text-xs text-fg-muted">
      {{ copyField.label }}
      <Input aria-label="Text content" :model-value="copyField.value" @update:model-value="onText" />
    </label>
    <span class="text-xs text-fg-subtle">
      Changes update this text in the animated scene. Undo restores the previous words.
    </span>
    <Button variant="ghost" size="sm" @click="onText('')">Clear text</Button>
  </div>
  <div v-else-if="music" class="flex flex-col gap-3">
    <span class="text-sm font-semibold text-fg">Audio</span>
    <label class="flex flex-col gap-1.5 text-xs text-fg-muted">
      Volume (%)
      <Input
        type="number"
        min="0"
        max="100"
        aria-label="Audio volume"
        :model-value="Math.round(music.volume * 100)"
        @update:model-value="setMusicVolume"
      />
    </label>
    <Button
      variant="ghost"
      size="sm"
      @click="
        emit('apply', { ...document, music: null });
        emit('deselect');
      "
    >
      Remove audio
    </Button>
  </div>
  <div v-else-if="shot?.scene && placed" class="flex flex-col gap-2.5">
    <div class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-fg">Scene {{ shotIndex + 1 }}</span>
      <span class="text-xs text-fg-muted">{{ shot.scene.label || shot.description }}</span>
    </div>
    <p class="text-xs text-fg-subtle">
      Designed by the AI. {{ formatClock(placed.start) }} to {{ formatClock(placed.end) }}.
      <template v-if="shot.refShot !== null">Matches example shot {{ shot.refShot + 1 }}.</template>
    </p>
    <SceneVariableFields :id="shot.id" :scene="shot.scene" :files="files" @change="onSceneVariable" />
    <span class="text-xs text-fg-subtle">Select an element below to change its styling, icon, or animation.</span>
    <Separator />
    <div>
      <Button variant="ghost" size="sm" :disabled="document.shots.length <= 1" @click="remove">Remove scene</Button>
    </div>
  </div>

  <div v-else-if="shot && placed" class="flex flex-col gap-2.5">
    <div class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-fg">Shot {{ shotIndex + 1 }}</span>
      <span class="text-xs text-fg-muted">{{ shot.description }}</span>
    </div>
    <p class="text-xs text-fg-subtle">
      From {{ names.get(shot.mediaId ?? '') ?? shot.mediaId }} at {{ formatClock(shot.sourceIn) }}.
      {{ formatClock(placed.start) }} to {{ formatClock(placed.end) }}.
      <template v-if="shot.refShot !== null">Matches example shot {{ shot.refShot + 1 }}.</template>
    </p>
    <Separator />
    <span class="text-xs font-semibold text-fg">Swap shot</span>
    <template v-if="alternates.length">
      <span class="text-xs text-fg-subtle">Other moments the AI considered for this spot:</span>
      <div class="flex flex-col gap-1.5">
        <div
          v-for="(alternate, index) in alternates"
          :key="`${alternate.mediaId}-${alternate.sourceIn}-${index}`"
          class="flex items-center gap-2"
        >
          <div class="min-w-0 flex-1">
            <span class="block truncate text-xs text-fg" :title="alternate.name">{{ alternate.name }}</span>
            <span class="block truncate text-xs text-fg-subtle" :title="alternate.description">
              {{ alternate.description }}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            :disabled="!alternate.fits"
            :title="alternate.fits ? undefined : 'Too short for this spot'"
            @click="emit('apply', alternate.next)"
          >
            Use
          </Button>
        </div>
      </div>
    </template>
    <span v-else class="text-xs text-fg-subtle">
      No other moments were kept for this spot. Ask in the chat for a different shot.
    </span>
    <Separator />
    <div>
      <Button variant="ghost" size="sm" :disabled="document.shots.length <= 1" @click="remove">Remove shot</Button>
    </div>
  </div>

  <div v-else-if="overlay" class="flex flex-col gap-2.5">
    <div class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-fg">{{ overlay.lane === 'text' ? 'Text' : 'Graphic' }}</span>
      <span class="text-xs text-fg-subtle">
        {{ formatClock(overlay.start) }} to {{ formatClock(overlay.start + overlay.duration) }}
      </span>
    </div>
    <div v-if="overlay.lane === 'text'" class="flex flex-col gap-1">
      <span class="text-xs text-fg-muted">Words on screen</span>
      <Input :model-value="overlay.label" @update:model-value="onText" />
    </div>
    <div v-else class="flex flex-col gap-1.5">
      <span class="text-xs text-fg">{{ overlay.label }}</span>
      <span class="text-xs text-fg-subtle">
        Open the composition controls below to change its styling and animation.
      </span>
    </div>
    <Separator />
    <div>
      <Button variant="ghost" size="sm" @click="remove">Remove</Button>
    </div>
  </div>

  <div v-else class="flex flex-col gap-1.5">
    <span class="text-sm font-semibold text-fg">Nothing selected</span>
    <span class="text-xs text-fg-muted">Click any block on the timeline to swap a shot, edit text, or remove it.</span>
  </div>
  <CompositionEditor
    v-if="selectedComposition && files?.[selectedComposition]"
    :path="selectedComposition"
    :source="files[selectedComposition]"
    @save="(path, source) => emit('composition', path, source)"
  />
</template>
