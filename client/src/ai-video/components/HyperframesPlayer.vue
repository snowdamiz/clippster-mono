<template>
  <div ref="host" class="relative size-full overflow-hidden bg-black" />
</template>

<script setup lang="ts">
  import '@hyperframes/player';
  import type { HyperframesPlayer } from '@hyperframes/player';
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

  const props = defineProps<{
    /** URL of the served composition (`index.html`). Changing it reloads the player. */
    src: string;
    /** Bumped by the parent after recompiling, to reload the same URL. */
    revision?: number;
    muted?: boolean;
  }>();

  const emit = defineEmits<{
    ready: [duration: number];
    timeupdate: [time: number];
    playing: [playing: boolean];
    ended: [];
    error: [message: string];
  }>();

  const host = ref<HTMLDivElement | null>(null);
  let player: HyperframesPlayer | null = null;

  function load() {
    if (!host.value) return;
    player?.remove();
    const el = document.createElement('hyperframes-player') as HyperframesPlayer;
    el.setAttribute('sandbox-origin', 'opaque');
    el.setAttribute('disable-click-to-play', '');
    el.setAttribute('assets-loading-ui', 'none');
    el.style.cssText = 'display:block;width:100%;height:100%';
    el.muted = !!props.muted;
    el.addEventListener('ready', (e) => emit('ready', (e as CustomEvent<{ duration: number }>).detail.duration));
    el.addEventListener('durationchange', (e) => emit('ready', (e as CustomEvent<{ duration: number }>).detail.duration));
    el.addEventListener('timeupdate', (e) => emit('timeupdate', (e as CustomEvent<{ currentTime: number }>).detail.currentTime));
    el.addEventListener('play', () => emit('playing', true));
    el.addEventListener('pause', () => emit('playing', false));
    el.addEventListener('ended', () => {
      emit('playing', false);
      emit('ended');
    });
    el.addEventListener('error', (e: Event) => emit('error', (e as CustomEvent<{ message?: string } | null>).detail?.message ?? 'The preview failed to load.'));
    const cacheBust = props.revision ? `${props.src.includes('?') ? '&' : '?'}r=${props.revision}` : '';
    el.setAttribute('src', props.src + cacheBust);
    host.value.appendChild(el);
    player = el;
  }

  onMounted(load);
  onBeforeUnmount(() => player?.remove());
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
