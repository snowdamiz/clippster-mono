import { ref } from "vue";
import type { CropRect } from "../types/timeline";
import type { SocialOverlayPreset } from "../types/social-overlays";

// Shared reactive state for cross-component UI coordination
/** When true, video/audio clips use a crosshair cursor and accept timeline clicks to add keyframes. When false, clicks select and drag clips normally. */
const timelineKeyframePlacementActive = ref(false);

const cropPanelRequested = ref(false);
const isCropMode = ref(false);
const activeSocialOverlay = ref<SocialOverlayPreset | null>(null);

/** Preview viewport zoom: 1 = fit-to-panel, values > 1 zoom in, < 1 zoom out. Range: 0.1–4.0. */
const viewportZoom = ref(1);
/** Preview quality: "auto" uses project resolution, numbers are target height in px. */
const previewQuality = ref<"auto" | 360 | 540 | 720 | 1080>("auto");

// Snapshot of crop values when entering crop mode — used for cancel/revert
const originalCrop = ref<CropRect | null>(null);
// Pending crop values being edited — committed only on confirm
const pendingCrop = ref<CropRect | null>(null);

export function useEditorUIState() {
	function requestCropPanel() {
		cropPanelRequested.value = true;
	}

	function clearCropPanelRequest() {
		cropPanelRequested.value = false;
	}

	function enterCropMode(currentCrop?: CropRect) {
		const defaults: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };
		originalCrop.value = currentCrop ? { ...currentCrop } : { ...defaults };
		pendingCrop.value = currentCrop ? { ...currentCrop } : { ...defaults };
		isCropMode.value = true;
		cropPanelRequested.value = true;
	}

	function exitCropMode() {
		isCropMode.value = false;
		originalCrop.value = null;
		pendingCrop.value = null;
	}

	function confirmCrop(): CropRect | null {
		const result = pendingCrop.value ? { ...pendingCrop.value } : null;
		isCropMode.value = false;
		originalCrop.value = null;
		pendingCrop.value = null;
		return result;
	}

	function cancelCrop(): CropRect | null {
		const result = originalCrop.value ? { ...originalCrop.value } : null;
		isCropMode.value = false;
		originalCrop.value = null;
		pendingCrop.value = null;
		return result;
	}

	function toggleCropMode(currentCrop?: CropRect) {
		if (isCropMode.value) {
			exitCropMode();
		} else {
			enterCropMode(currentCrop);
		}
	}

	function setTimelineKeyframePlacementActive(value: boolean) {
		timelineKeyframePlacementActive.value = value;
	}

	return {
		timelineKeyframePlacementActive,
		setTimelineKeyframePlacementActive,
		cropPanelRequested,
		isCropMode,
		originalCrop,
		pendingCrop,
		activeSocialOverlay,
		viewportZoom,
		previewQuality,
		requestCropPanel,
		clearCropPanelRequest,
		enterCropMode,
		exitCropMode,
		confirmCrop,
		cancelCrop,
		toggleCropMode,
	};
}
