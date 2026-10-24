<template>
  <div ref="host" class="relative size-full overflow-hidden bg-black" />
</template>

<script setup lang="ts">
  import '@hyperframes/player';
  import type { HyperframesPlayer } from '@hyperframes/player';
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
  import type { SceneInventory } from '../director/sceneLayers';

  const props = defineProps<{
    /** URL of the served composition (`index.html`). Changing it reloads the player. */
    src: string;
    /** Bumped by the parent after recompiling, to reload the same URL. */
    revision?: number;
    muted?: boolean;
    selectedLayer?: { owner: string; key: string } | null;
  }>();

  const emit = defineEmits<{
    ready: [duration: number];
    timeupdate: [time: number];
    playing: [playing: boolean];
    ended: [];
    error: [message: string];
    layers: [inventory: SceneInventory];
    selectLayer: [selection: { owner: string; key: string }];
  }>();

  const host = ref<HTMLDivElement | null>(null);
  let player: HyperframesPlayer | null = null;
  let loadedSrc: string | null = null;

  function load() {
    if (!host.value) return;
    const resumeAt = loadedSrc === props.src ? (player?.currentTime ?? 0) : 0;
    let ready = false;
    player?.remove();
    const el = document.createElement('hyperframes-player') as HyperframesPlayer;
    el.setAttribute('sandbox-origin', 'opaque');
    el.setAttribute('disable-click-to-play', '');
    el.setAttribute('interactive', '');
    el.setAttribute('assets-loading-ui', 'none');
    el.style.cssText = 'display:block;width:100%;height:100%';
    el.muted = !!props.muted;
    const onReady = (event: Event) => {
      const { duration } = (event as CustomEvent<{ duration: number }>).detail;
      // The runtime hides every clip at its exclusive end. Hold the last frame instead.
      if (Number.isFinite(duration) && duration > 0) el.setAttribute('range-end', String(duration));
      if (!ready) {
        ready = true;
        if (resumeAt > 0) el.seek(Math.min(resumeAt, Math.max(0, duration - 0.001)));
      }
      emit('ready', duration);
    };
    el.addEventListener('ready', onReady);
    el.addEventListener('durationchange', onReady);
    el.addEventListener('timeupdate', (e) => {
      if (ready) emit('timeupdate', (e as CustomEvent<{ currentTime: number }>).detail.currentTime);
    });
    el.addEventListener('play', () => emit('playing', true));
    el.addEventListener('pause', () => emit('playing', false));
    el.addEventListener('ended', () => {
      emit('playing', false);
      emit('ended');
    });
    el.addEventListener('error', (e: Event) =>
      emit('error', (e as CustomEvent<{ message?: string } | null>).detail?.message ?? 'The preview failed to load.')
    );
    const cacheBust = props.revision ? `${props.src.includes('?') ? '&' : '?'}r=${props.revision}` : '';
    el.setAttribute('src', props.src + cacheBust);
    host.value.appendChild(el);
    player = el;
    loadedSrc = props.src;
  }

  function onLayers(event: MessageEvent) {
    const frame = player?.shadowRoot?.querySelector('iframe');
    if (!frame || event.source !== frame.contentWindow) return;
    if (
      event.data?.type === 'clippster-layer-selected' &&
      typeof event.data.owner === 'string' &&
      typeof event.data.key === 'string'
    ) {
      emit('selectLayer', { owner: event.data.owner, key: event.data.key });
      return;
    }
    if (event.data?.type !== 'clippster-scene-layers') return;
    const { owner, layers } = event.data;
    if (typeof owner === 'string' && Array.isArray(layers)) emit('layers', { owner, layers });
    highlightSelection();
  }
  function highlightSelection() {
    player?.shadowRoot
      ?.querySelector('iframe')
      ?.contentWindow?.postMessage({ type: 'clippster-select-layer', ...props.selectedLayer }, '*');
  }
  watch(() => props.selectedLayer, highlightSelection);
  onMounted(() => {
    window.addEventListener('message', onLayers);
    load();
  });
  onBeforeUnmount(() => {
    window.removeEventListener('message', onLayers);
    player?.remove();
  });
  watch(() => [props.src, props.revision], load);
  watch(
    () => props.muted,
    (muted) => {
      if (player) player.muted = !!muted;
    }
  );

  defineExpose({
    play: () => player?.play(),
    pause: () => player?.pause(),
    seek: (time: number) => player?.seek(time),
    currentTime: () => player?.currentTime ?? 0,
  });
</script>
