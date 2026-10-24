<script setup lang="ts">
  /** Details of the selected timeline block: swap or remove a shot, edit or remove an overlay. */
  import { computed } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Separator } from '@/components/ui/separator';
  import { placeShots } from '../compiler/compile';
  import { removeOverlay, removeShot, setOverlayText, swapShot } from '../director/edits';
  import { formatClock } from '../format';
  import type { EditDocument, MediaItem } from '../types';

  const props = defineProps<{ document: EditDocument; media: MediaItem[]; selected: string | null }>();
  const emit = defineEmits<{ apply: [document: EditDocument]; text: [overlayId: string, document: EditDocument]; deselect: [] }>();

  const names = computed(() => new Map(props.media.map((item) => [item.id, item.name])));
  const shotIndex = computed(() => props.document.shots.findIndex((shot) => shot.id === props.selected));
  const shot = computed(() => props.document.shots[shotIndex.value] ?? null);
  const placed = computed(() => (shot.value ? placeShots(props.document)[shotIndex.value] : null));
  const overlay = computed(() => props.document.overlays.find((entry) => entry.id === props.selected) ?? null);

  const alternates = computed(() =>
    (shot.value?.alternates ?? []).map((alternate, index) => {
      const next = swapShot(props.document, shot.value!.id, index, props.media);
      return { ...alternate, name: names.value.get(alternate.mediaId) ?? alternate.mediaId, next, fits: next.shots[shotIndex.value] !== shot.value };
    })
  );

  function remove() {
    if (shot.value) emit('apply', removeShot(props.document, shot.value.id, props.media));
    else if (overlay.value) emit('apply', removeOverlay(props.document, overlay.value.id));
    emit('deselect');
  }

  function onText(value: string | number) {
    if (overlay.value) emit('text', overlay.value.id, setOverlayText(props.document, overlay.value.id, String(value)));
  }
</script>

<template>
  <div v-if="shot && placed" class="flex flex-col gap-2.5">
    <div class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-fg">Shot {{ shotIndex + 1 }}</span>
      <span class="text-xs text-fg-muted">{{ shot.description }}</span>
    </div>
    <p class="text-xs text-fg-subtle">
      From {{ names.get(shot.mediaId) ?? shot.mediaId }} at {{ formatClock(shot.sourceIn) }}. {{ formatClock(placed.start) }} to
      {{ formatClock(placed.end) }}.<template v-if="shot.refShot !== null"> Matches example shot {{ shot.refShot + 1 }}.</template>
    </p>
    <Separator />
    <span class="text-xs font-semibold text-fg">Swap shot</span>
    <template v-if="alternates.length">
      <span class="text-xs text-fg-subtle">Other moments the AI considered for this spot:</span>
      <div class="flex flex-col gap-1.5">
        <div v-for="(alternate, index) in alternates" :key="`${alternate.mediaId}-${alternate.sourceIn}-${index}`" class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <span class="block truncate text-xs text-fg" :title="alternate.name">{{ alternate.name }}</span>
            <span class="block truncate text-xs text-fg-subtle" :title="alternate.description">{{ alternate.description }}</span>
          </div>
          <Button variant="secondary" size="sm" :disabled="!alternate.fits" :title="alternate.fits ? undefined : 'Too short for this spot'" @click="emit('apply', alternate.next)">
            Use
          </Button>
        </div>
      </div>
    </template>
    <span v-else class="text-xs text-fg-subtle">No other moments were kept for this spot. Ask in the chat for a different shot.</span>
    <Separator />
    <div>
      <Button variant="ghost" size="sm" :disabled="document.shots.length <= 1" @click="remove">Remove shot</Button>
    </div>
  </div>

  <div v-else-if="overlay" class="flex flex-col gap-2.5">
    <div class="flex flex-col gap-0.5">
      <span class="text-sm font-semibold text-fg">{{ overlay.lane === 'text' ? 'Text' : 'Graphic' }}</span>
      <span class="text-xs text-fg-subtle">{{ formatClock(overlay.start) }} to {{ formatClock(overlay.start + overlay.duration) }}</span>
    </div>
    <div v-if="overlay.lane === 'text'" class="flex flex-col gap-1">
      <span class="text-xs text-fg-muted">Words on screen</span>
      <Input :model-value="overlay.label" @update:model-value="onText" />
    </div>
    <div v-else class="flex flex-col gap-1.5">
      <span class="text-xs text-fg">{{ overlay.label }}</span>
      <span class="text-xs text-fg-subtle">
        Designed by the AI to match the example. To change how it looks, ask in the chat, for example "make the flash softer".
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
</template>
