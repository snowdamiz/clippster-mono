/**
 * Composable for fade-in/fade-out handle drag interaction on timeline elements.
 * Dragging the fade handle horizontally sets the fade duration.
 */
import { ref, onUnmounted, type Ref } from "vue";
import type { TimelineElement, TimelineTrack } from "../../../types/timeline";
import { EditorCore } from "../../../core";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";

interface FadeState {
	side: "fadeIn" | "fadeOut";
	startX: number;
	initialFade: number;
}

interface UseElementFadeProps {
	element: Ref<TimelineElement>;
	track: Ref<TimelineTrack>;
	zoomLevel: Ref<number>;
}

export function useElementFade({ element, track, zoomLevel }: UseElementFadeProps) {
	const editor = EditorCore.getInstance();
	const fadeState = ref<FadeState | null>(null);
	const currentFadeIn = ref(0);
	const currentFadeOut = ref(0);

	function handleFadeStart(e: MouseEvent, side: "fadeIn" | "fadeOut") {
		e.stopPropagation();
		e.preventDefault();

		if (track.value.locked) return;

		const el = element.value;
		const initialFade = side === "fadeIn" ? (el.fadeIn ?? 0) : (el.fadeOut ?? 0);

		fadeState.value = {
			side,
			startX: e.clientX,
			initialFade,
		};

		currentFadeIn.value = el.fadeIn ?? 0;
		currentFadeOut.value = el.fadeOut ?? 0;

		const onMove = (ev: MouseEvent) => {
			const fs = fadeState.value;
			if (!fs) return;

			const deltaX = ev.clientX - fs.startX;
			const deltaTime = deltaX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value);

			const maxFade = element.value.duration;

			if (fs.side === "fadeIn") {
				const newFade = Math.max(0, Math.min(maxFade, fs.initialFade + deltaTime));
				currentFadeIn.value = newFade;
			} else {
				// For fade-out, dragging left (negative deltaX) increases fade
				const newFade = Math.max(0, Math.min(maxFade, fs.initialFade - deltaTime));
				currentFadeOut.value = newFade;
			}
		};

		const onUp = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);

			const fs = fadeState.value;
			if (!fs) return;

			const el = element.value;
			const newFadeIn = currentFadeIn.value;
			const newFadeOut = currentFadeOut.value;

			// Only commit if changed
			if (
				(fs.side === "fadeIn" && newFadeIn !== (el.fadeIn ?? 0)) ||
				(fs.side === "fadeOut" && newFadeOut !== (el.fadeOut ?? 0))
			) {
				editor.timeline.updateElement({
					trackId: track.value.id,
					elementId: el.id,
					updates: {
						fadeIn: newFadeIn > 0.01 ? newFadeIn : undefined,
						fadeOut: newFadeOut > 0.01 ? newFadeOut : undefined,
					},
				});
			}

			fadeState.value = null;
		};

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}

	onUnmounted(() => {
		fadeState.value = null;
	});

	return {
		fadeState,
		currentFadeIn,
		currentFadeOut,
		handleFadeStart,
	};
}
