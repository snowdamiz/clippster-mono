/**
 * Vue composable equivalent of OpenCut's use-scroll-sync.ts
 * Synchronizes horizontal scroll between ruler, tracks, and bookmarks.
 * Synchronizes vertical scroll between track labels and tracks.
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
	let isUpdating = false;
	let lastRulerSync = 0;
	let lastTracksSync = 0;
	let lastVerticalSync = 0;
	let lastBookmarksSync = 0;
	const cleanups: (() => void)[] = [];

	function syncScrollLeft(target: HTMLDivElement | null | undefined, scrollLeft: number) {
		if (target) target.scrollLeft = scrollLeft;
	}

	onMounted(() => {
		const rulerViewport = rulerScrollRef?.value ?? null;
		const tracksViewport = tracksScrollRef.value;
		const trackLabelsViewport = trackLabelsScrollRef?.value ?? null;
		const bookmarksViewport = bookmarksScrollRef?.value ?? null;

		if (!tracksViewport) return;

		const handleRulerScroll = () => {
			const now = Date.now();
			if (isUpdating || now - lastRulerSync < 16) return;
			lastRulerSync = now;
			isUpdating = true;
			tracksViewport.scrollLeft = rulerViewport?.scrollLeft ?? 0;
			syncScrollLeft(bookmarksViewport, rulerViewport?.scrollLeft ?? 0);
			isUpdating = false;
		};

		const handleTracksScroll = () => {
			const now = Date.now();
			if (isUpdating || now - lastTracksSync < 16) return;
			lastTracksSync = now;
			isUpdating = true;
			syncScrollLeft(rulerViewport, tracksViewport.scrollLeft);
			syncScrollLeft(bookmarksViewport, tracksViewport.scrollLeft);
			isUpdating = false;
		};

		if (rulerViewport && rulerViewport !== tracksViewport) {
			rulerViewport.addEventListener("scroll", handleRulerScroll);
			cleanups.push(() => rulerViewport.removeEventListener("scroll", handleRulerScroll));
		}
		if (tracksViewport !== rulerViewport) {
			tracksViewport.addEventListener("scroll", handleTracksScroll);
			cleanups.push(() => tracksViewport.removeEventListener("scroll", handleTracksScroll));
		}

		if (bookmarksViewport && bookmarksViewport !== tracksViewport) {
			const handleBookmarksScroll = () => {
				const now = Date.now();
				if (isUpdating || now - lastBookmarksSync < 16) return;
				lastBookmarksSync = now;
				isUpdating = true;
				const nextScrollLeft = bookmarksViewport.scrollLeft;
				tracksViewport.scrollLeft = nextScrollLeft;
				syncScrollLeft(rulerViewport, nextScrollLeft);
				isUpdating = false;
			};
			bookmarksViewport.addEventListener("scroll", handleBookmarksScroll);
			cleanups.push(() => bookmarksViewport.removeEventListener("scroll", handleBookmarksScroll));
		}

		if (trackLabelsViewport) {
			const handleTrackLabelsScroll = () => {
				const now = Date.now();
				if (isUpdating || now - lastVerticalSync < 16) return;
				lastVerticalSync = now;
				isUpdating = true;
				tracksViewport.scrollTop = trackLabelsViewport.scrollTop;
				isUpdating = false;
			};

			const handleTracksVerticalScroll = () => {
				const now = Date.now();
				if (isUpdating || now - lastVerticalSync < 16) return;
				lastVerticalSync = now;
				isUpdating = true;
				trackLabelsViewport.scrollTop = tracksViewport.scrollTop;
				isUpdating = false;
			};

			trackLabelsViewport.addEventListener("scroll", handleTrackLabelsScroll);
			tracksViewport.addEventListener("scroll", handleTracksVerticalScroll);
			cleanups.push(() => {
				trackLabelsViewport.removeEventListener("scroll", handleTrackLabelsScroll);
				tracksViewport.removeEventListener("scroll", handleTracksVerticalScroll);
			});
		}
	});

	onUnmounted(() => {
		for (const cleanup of cleanups) cleanup();
		cleanups.length = 0;
	});
}
