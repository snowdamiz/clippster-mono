import { ref } from "vue";

// Shared reactive state for cross-component UI coordination
const cropPanelRequested = ref(false);
const isCropMode = ref(false);

export function useEditorUIState() {
	function requestCropPanel() {
		cropPanelRequested.value = true;
	}

	function clearCropPanelRequest() {
		cropPanelRequested.value = false;
	}

	function enterCropMode() {
		isCropMode.value = true;
		cropPanelRequested.value = true;
	}

	function exitCropMode() {
		isCropMode.value = false;
	}

	function toggleCropMode() {
		if (isCropMode.value) {
			exitCropMode();
		} else {
			enterCropMode();
		}
	}

	return {
		cropPanelRequested,
		isCropMode,
		requestCropPanel,
		clearCropPanelRequest,
		enterCropMode,
		exitCropMode,
		toggleCropMode,
	};
}
