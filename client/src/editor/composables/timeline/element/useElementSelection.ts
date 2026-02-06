/**
 * Vue composable equivalent of OpenCut's use-element-selection.ts
 */
import { computed } from "vue";
import { useEditor } from "../../useEditor";

type ElementRef = { trackId: string; elementId: string };

export function useElementSelection() {
	const { editor, version } = useEditor();

	const selectedElements = computed(() => {
		void version.value; // trigger reactivity
		return editor.selection.getSelectedElements();
	});

	function isElementSelected({ trackId, elementId }: ElementRef): boolean {
		return selectedElements.value.some(
			(el) => el.trackId === trackId && el.elementId === elementId,
		);
	}

	function selectElement({ trackId, elementId }: ElementRef) {
		editor.selection.setSelectedElements({ elements: [{ trackId, elementId }] });
	}

	function addElementToSelection({ trackId, elementId }: ElementRef) {
		const alreadySelected = selectedElements.value.some(
			(el) => el.trackId === trackId && el.elementId === elementId,
		);
		if (alreadySelected) return;
		editor.selection.setSelectedElements({
			elements: [...selectedElements.value, { trackId, elementId }],
		});
	}

	function removeElementFromSelection({ trackId, elementId }: ElementRef) {
		editor.selection.setSelectedElements({
			elements: selectedElements.value.filter(
				(el) => !(el.trackId === trackId && el.elementId === elementId),
			),
		});
	}

	function toggleElementSelection({ trackId, elementId }: ElementRef) {
		const alreadySelected = selectedElements.value.some(
			(el) => el.trackId === trackId && el.elementId === elementId,
		);
		if (alreadySelected) {
			removeElementFromSelection({ trackId, elementId });
		} else {
			addElementToSelection({ trackId, elementId });
		}
	}

	function clearElementSelection() {
		editor.selection.clearSelection();
	}

	function setElementSelection({ elements }: { elements: ElementRef[] }) {
		editor.selection.setSelectedElements({ elements });
	}

	function rippleSelect({ trackId, elementId }: ElementRef) {
		const track = editor.timeline.getTrackById({ trackId });
		if (!track) return;
		const element = track.elements.find((e) => e.id === elementId);
		if (!element) return;
		const rightElements = track.elements
			.filter((e) => e.startTime >= element.startTime)
			.map((e) => ({ trackId, elementId: e.id }));
		editor.selection.setSelectedElements({ elements: rightElements });
	}

	function rangeSelect({ trackId, elementId }: ElementRef) {
		const lastSelected = selectedElements.value[selectedElements.value.length - 1];
		if (!lastSelected || lastSelected.trackId !== trackId) {
			selectElement({ trackId, elementId });
			return;
		}
		const track = editor.timeline.getTrackById({ trackId });
		if (!track) return;
		const clickedEl = track.elements.find((e) => e.id === elementId);
		const lastEl = track.elements.find((e) => e.id === lastSelected.elementId);
		if (!clickedEl || !lastEl) {
			selectElement({ trackId, elementId });
			return;
		}
		const minTime = Math.min(clickedEl.startTime, lastEl.startTime);
		const maxTime = Math.max(
			clickedEl.startTime + clickedEl.duration,
			lastEl.startTime + lastEl.duration,
		);
		const rangeElements = track.elements
			.filter((e) => e.startTime >= minTime && e.startTime + e.duration <= maxTime)
			.map((e) => ({ trackId, elementId: e.id }));
		editor.selection.setSelectedElements({ elements: rangeElements });
	}

	function handleElementClick({
		trackId,
		elementId,
		isMultiKey,
		isAltKey,
		isShiftKey,
	}: ElementRef & { isMultiKey: boolean; isAltKey?: boolean; isShiftKey?: boolean }) {
		if (isAltKey) {
			rippleSelect({ trackId, elementId });
		} else if (isShiftKey) {
			rangeSelect({ trackId, elementId });
		} else if (isMultiKey) {
			toggleElementSelection({ trackId, elementId });
		} else {
			selectElement({ trackId, elementId });
		}
	}

	return {
		selectedElements,
		isElementSelected,
		selectElement,
		setElementSelection,
		addElementToSelection,
		removeElementFromSelection,
		toggleElementSelection,
		clearElementSelection,
		handleElementClick,
		rippleSelect,
		rangeSelect,
	};
}
