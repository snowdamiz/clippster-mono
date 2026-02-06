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

	function handleElementClick({
		trackId,
		elementId,
		isMultiKey,
	}: ElementRef & { isMultiKey: boolean }) {
		if (isMultiKey) {
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
	};
}
