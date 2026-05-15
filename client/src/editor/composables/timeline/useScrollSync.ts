/**
 * Vue composable equivalent of OpenCut's use-scroll-sync.ts
 * Synchronizes horizontal scroll between ruler, tracks, and bookmarks.
 * Synchronizes vertical scroll between track labels and tracks.
 *
 * The previous implementation throttled with `Date.now()` at ~16ms and
 * used a `isUpdating` reentrancy flag. Two issues:
 *   - The throttle wasn't aligned to animation frames, so on high-refresh
 *     displays you'd get visible tearing between viewports.
 *   - The reentrancy flag could miss updates if `scroll` events fired in
 *     the same tick as a write, leaving viewports temporarily out of sync.
 *
 * This version uses rAF: the very next frame after any source scroll, all
 * mirrors are pushed in one batch. Only one write per source per frame.
 */
import { onMounted, onUnmounted, type Ref } from "vue";

interface UseScrollSyncProps {
	rulerScrollRef?: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	trackLabelsScrollRef?: Ref<HTMLDivElement | null>;
	bookmarksScrollRef?: Ref<HTMLDivElement | null>;
}

export function useScrollSync({
	tracksScrollRef,
	rulerScrollRef,
	trackLabelsScrollRef,
	bookmarksScrollRef,
}: UseScrollSyncProps) {
	const cleanups: (() => void)[] = [];
	let pendingHRaf: number | null = null;
	let pendingVRaf: number | null = null;
	// Source of truth scroll values queued for the next frame.
	let pendingScrollLeft: number | null = null;
	let pendingScrollTop: number | null = null;
	// The viewport that triggered the queued scroll, so we don't overwrite it.
	let hSource: HTMLDivElement | null = null;
	let vSource: HTMLDivElement | null = null;

	function flushHorizontal() {
		pendingHRaf = null;
		const sl = pendingScrollLeft;
		const src = hSource;
		pendingScrollLeft = null;
		hSource = null;
		if (sl === null) return;
		const ruler = rulerScrollRef?.value ?? null;
		const tracks = tracksScrollRef.value ?? null;
		const bookmarks = bookmarksScrollRef?.value ?? null;
		if (ruler && ruler !== src && Math.abs(ruler.scrollLeft - sl) > 0.5) ruler.scrollLeft = sl;
		if (tracks && tracks !== src && Math.abs(tracks.scrollLeft - sl) > 0.5) tracks.scrollLeft = sl;
		if (bookmarks && bookmarks !== src && Math.abs(bookmarks.scrollLeft - sl) > 0.5) bookmarks.scrollLeft = sl;
	}

	function flushVertical() {
		pendingVRaf = null;
		const st = pendingScrollTop;
		const src = vSource;
		pendingScrollTop = null;
		vSource = null;
		if (st === null) return;
		const tracks = tracksScrollRef.value ?? null;
		const labels = trackLabelsScrollRef?.value ?? null;
		if (tracks && tracks !== src && Math.abs(tracks.scrollTop - st) > 0.5) tracks.scrollTop = st;
		if (labels && labels !== src && Math.abs(labels.scrollTop - st) > 0.5) labels.scrollTop = st;
	}

	function queueHorizontal(source: HTMLDivElement) {
		pendingScrollLeft = source.scrollLeft;
		hSource = source;
		if (pendingHRaf !== null) return;
		pendingHRaf = requestAnimationFrame(flushHorizontal);
	}

	function queueVertical(source: HTMLDivElement) {
		pendingScrollTop = source.scrollTop;
		vSource = source;
		if (pendingVRaf !== null) return;
		pendingVRaf = requestAnimationFrame(flushVertical);
	}

	onMounted(() => {
		const rulerViewport = rulerScrollRef?.value ?? null;
		const tracksViewport = tracksScrollRef.value;
		const trackLabelsViewport = trackLabelsScrollRef?.value ?? null;
		const bookmarksViewport = bookmarksScrollRef?.value ?? null;

		if (!tracksViewport) return;

		if (rulerViewport && rulerViewport !== tracksViewport) {
			const handler = () => queueHorizontal(rulerViewport);
			rulerViewport.addEventListener("scroll", handler, { passive: true });
			cleanups.push(() => rulerViewport.removeEventListener("scroll", handler));
		}

		if (tracksViewport !== rulerViewport) {
			const handler = () => queueHorizontal(tracksViewport);
			tracksViewport.addEventListener("scroll", handler, { passive: true });
			cleanups.push(() => tracksViewport.removeEventListener("scroll", handler));
		}

		if (bookmarksViewport && bookmarksViewport !== tracksViewport) {
			const handler = () => queueHorizontal(bookmarksViewport);
			bookmarksViewport.addEventListener("scroll", handler, { passive: true });
			cleanups.push(() => bookmarksViewport.removeEventListener("scroll", handler));
		}

		if (trackLabelsViewport) {
			const labelsHandler = () => queueVertical(trackLabelsViewport);
			const tracksHandler = () => queueVertical(tracksViewport);
			trackLabelsViewport.addEventListener("scroll", labelsHandler, { passive: true });
			tracksViewport.addEventListener("scroll", tracksHandler, { passive: true });
			cleanups.push(() => {
				trackLabelsViewport.removeEventListener("scroll", labelsHandler);
				tracksViewport.removeEventListener("scroll", tracksHandler);
			});
		}
	});

	onUnmounted(() => {
		for (const cleanup of cleanups) cleanup();
		cleanups.length = 0;
		if (pendingHRaf !== null) cancelAnimationFrame(pendingHRaf);
		if (pendingVRaf !== null) cancelAnimationFrame(pendingVRaf);
	});
}
