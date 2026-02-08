/**
 * Vue composable equivalent of OpenCut's use-raf-loop.ts React hook.
 * Runs a callback on every requestAnimationFrame tick.
 */
import { onMounted, onUnmounted } from "vue";

export function useRafLoop(callback: (opts: { time: number }) => void) {
	let requestId = 0;
	let previousTime: number | null = null;

	const loop = (time: number) => {
		if (previousTime !== null) {
			const deltaTime = time - previousTime;
			callback({ time: deltaTime });
		}
		previousTime = time;
		requestId = requestAnimationFrame(loop);
	};

	onMounted(() => {
		requestId = requestAnimationFrame(loop);
	});

	onUnmounted(() => {
		cancelAnimationFrame(requestId);
	});
}
