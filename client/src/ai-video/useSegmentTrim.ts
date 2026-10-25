import { computed, shallowRef } from 'vue';
import type { EditDocument, MediaItem } from './types';
import { trimBlock } from './director/timing';
import type { SceneInventory } from './director/sceneLayers';

export function useSegmentTrim(options: {
  document: () => EditDocument;
  media: () => MediaItem[];
  files: () => Record<string, string>;
  inventories?: () => SceneInventory[];
  maxSeconds: () => number;
  commit: (document: EditDocument) => void;
}) {
  const drag = shallowRef<{
    id: string;
    edge: 'start' | 'end';
    x: number;
    pixelsPerSecond: number;
    before: EditDocument;
    preview: EditDocument;
  } | null>(null);
  const document = computed(() => drag.value?.preview ?? options.document());
  function start(event: PointerEvent, id: string, edge: 'start' | 'end', pixelsPerSecond: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const before = options.document();
    drag.value = { id, edge, x: event.clientX, pixelsPerSecond, before, preview: before };
  }
  function move(event: PointerEvent) {
    const current = drag.value;
    if (!current) return;
    drag.value = {
      ...current,
      preview: trimBlock(
        current.before,
        current.id,
        current.edge,
        (event.clientX - current.x) / current.pixelsPerSecond,
        options.media(),
        options.maxSeconds(),
        options.files(),
        options.inventories?.()
      ),
    };
  }
  function finish(event: PointerEvent) {
    event.stopPropagation();
    move(event);
    const current = drag.value;
    drag.value = null;
    if (current && current.preview !== current.before) options.commit(current.preview);
  }
  function cancel() {
    drag.value = null;
  }
  return { drag, document, start, move, finish, cancel };
}
