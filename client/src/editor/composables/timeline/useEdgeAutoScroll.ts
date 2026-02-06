/**
 * Vue composable equivalent of OpenCut's use-edge-auto-scroll.ts
 * Auto-scrolls the timeline when dragging near edges.
 */
import { watch, onUnmounted, type Ref } from "vue";

interface UseEdgeAutoScrollParams {
	isActive: Ref<boolean>;
	getMouseClientX: () => number;
	rulerScrollRef: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	contentWidth: Ref<number>;
	edgeThreshold?: number;
	maxScrollSpeed?: number;
}

export function useEdgeAutoScroll({
	isActive,
	getMouseClientX,
	rulerScrollRef,
	tracksScrollRef,
	contentWidth,
	edgeThreshold = 100,
	maxScrollSpeed = 15,
}: UseEdgeAutoScrollParams): void {
	let rafId: number | null = null;

	function step() {
		const rulerViewport = rulerScrollRef.value;
		const tracksViewport = tracksScrollRef.value;
		if (!rulerViewport || !tracksViewport) {
			rafId = requestAnimationFrame(step);
			return;
		}

		const viewportRect = rulerViewport.getBoundingClientRect();
		const mouseX = getMouseClientX();
		const mouseXRelative = mouseX - viewportRect.left;

		const viewportWidth = rulerViewport.clientWidth;
		const intrinsicContentWidth = rulerViewport.scrollWidth;
		const effectiveContentWidth = Math.max(contentWidth.value, intrinsicContentWidth);
		const scrollMax = Math.max(0, effectiveContentWidth - viewportWidth);

		let scrollSpeed = 0;

		if (mouseXRelative < edgeThreshold && rulerViewport.scrollLeft > 0) {
			const edgeDistance = Math.max(0, mouseXRelative);
			const intensity = 1 - edgeDistance / edgeThreshold;
			scrollSpeed = -maxScrollSpeed * intensity;
		} else if (
			mouseXRelative > viewportWidth - edgeThreshold &&
			rulerViewport.scrollLeft < scrollMax
		) {
			const edgeDistance = Math.max(0, viewportWidth - edgeThreshold - mouseXRelative);
			const intensity = 1 - edgeDistance / edgeThreshold;
			scrollSpeed = maxScrollSpeed * intensity;
		}

		if (scrollSpeed !== 0) {
			const newScrollLeft = Math.max(0, Math.min(scrollMax, rulerViewport.scrollLeft + scrollSpeed));
			rulerViewport.scrollLeft = newScrollLeft;
			tracksViewport.scrollLeft = newScrollLeft;
		}

		rafId = requestAnimationFrame(step);
	}

	function stopLoop() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	watch(isActive, (active) => {
		if (active) {
			rafId = requestAnimationFrame(step);
		} else {
			stopLoop();
		}
	}, { immediate: true });

	onUnmounted(stopLoop);
}
