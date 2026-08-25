import { onMounted, onUnmounted, readonly, shallowRef } from "vue";
import { EditorCore } from "../core";

const time = shallowRef(0);
let consumers = 0;
let lastPublishedAt = 0;
let unsubscribe: (() => void) | null = null;

function start() {
	if (unsubscribe) return;
	const playback = EditorCore.getInstance().playback;
	time.value = playback.getCurrentTime();
	unsubscribe = playback.subscribe(() => {
		const now = performance.now();
		if (now - lastPublishedAt < 100) return;
		lastPublishedAt = now;
		time.value = playback.getCurrentTime();
	});
}

function stop() {
	unsubscribe?.();
	unsubscribe = null;
}

/**
 * Shared low-frequency playback clock for secondary UI. The preview/playhead
 * keep their precise clocks; transcript and assistant panels share one 10 Hz
 * subscription instead of each invalidating on every playback frame.
 */
export function usePlaybackClock() {
	onMounted(() => {
		consumers += 1;
		start();
	});
	onUnmounted(() => {
		consumers = Math.max(0, consumers - 1);
		if (consumers === 0) stop();
	});
	return readonly(time);
}
