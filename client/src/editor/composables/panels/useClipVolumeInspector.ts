import { computed, onUnmounted, reactive, ref, watch } from "vue";
import {
	linearGainToDb,
	dbToLinearGain,
	formatClipVolumeDb,
	gainToSliderStep,
	sliderStepToGain,
	parseVolumeDbInput,
	CLIP_VOLUME_SLIDER_STEPS,
	CLIP_VOLUME_SLIDER_DB_MIN,
	CLIP_VOLUME_SLIDER_DB_MAX,
	CLIP_VOLUME_SILENCE_DB,
} from "../../lib/audio-volume-ui";
import { clearClipVolumeDraft, setClipVolumeDraft } from "../../lib/clip-volume-draft";

const VOLUME_NUDGE_DB = 0.1;
const NUDGE_COMMIT_DELAY_MS = 350;

/**
 * Shared inspector UX for clip linear gain with dB labels and a centered log-like slider.
 */
export function useClipVolumeInspector(opts: {
	elementId: string;
	getLinearGain: () => number;
	setLinearGain: (gain: number) => void;
}) {
	const dbField = ref("");
	const draftGain = ref<number | null>(null);
	const isDragging = ref(false);
	let nudgeCommitTimer: number | null = null;

	const uiGain = computed(() => draftGain.value ?? opts.getLinearGain());

	function syncDbField() {
		dbField.value = formatClipVolumeDb(linearGainToDb(uiGain.value));
	}

	watch(
		() => opts.getLinearGain(),
		() => {
			if (isDragging.value) return;
			syncDbField();
		},
		{ immediate: true },
	);

	const sliderStep = computed(() => gainToSliderStep(uiGain.value));

	function commitDraft() {
		if (draftGain.value == null) return;
		cancelNudgeCommit();
		const gain = draftGain.value;
		isDragging.value = false;
		opts.setLinearGain(gain);
		clearClipVolumeDraft(opts.elementId);
		draftGain.value = null;
		dbField.value = formatClipVolumeDb(linearGainToDb(gain));
	}

	function cancelGlobalCommitListeners() {
		window.removeEventListener("pointerup", onSliderPointerUp);
		window.removeEventListener("pointercancel", onSliderPointerUp);
		window.removeEventListener("blur", onSliderPointerUp);
	}

	function cancelNudgeCommit() {
		if (nudgeCommitTimer == null) return;
		window.clearTimeout(nudgeCommitTimer);
		nudgeCommitTimer = null;
	}

	function scheduleNudgeCommit() {
		cancelNudgeCommit();
		nudgeCommitTimer = window.setTimeout(() => {
			nudgeCommitTimer = null;
			commitDraft();
		}, NUDGE_COMMIT_DELAY_MS);
	}

	function onSliderPointerDown() {
		cancelNudgeCommit();
		isDragging.value = true;
		draftGain.value = opts.getLinearGain();
		setClipVolumeDraft(opts.elementId, draftGain.value);
		window.addEventListener("pointerup", onSliderPointerUp, { once: true });
		window.addEventListener("pointercancel", onSliderPointerUp, { once: true });
		window.addEventListener("blur", onSliderPointerUp, { once: true });
	}

	function onSliderPointerUp() {
		cancelGlobalCommitListeners();
		commitDraft();
	}

	function onSliderInput(e: Event) {
		const step = Number((e.target as HTMLInputElement).value);
		const gain = sliderStepToGain(step);
		if (!isDragging.value) {
			opts.setLinearGain(gain);
			return;
		}
		draftGain.value = gain;
		setClipVolumeDraft(opts.elementId, gain);
		syncDbField();
	}

	function onDbFieldInput(value: string) {
		dbField.value = value;
	}

	function onDbFieldBlur() {
		const db = parseVolumeDbInput(dbField.value);
		if (Number.isNaN(db)) {
			syncDbField();
			return;
		}
		draftGain.value = null;
		isDragging.value = false;
		cancelGlobalCommitListeners();
		cancelNudgeCommit();
		clearClipVolumeDraft(opts.elementId);
		opts.setLinearGain(dbToLinearGain(db));
		syncDbField();
	}

	function nudgeDb(direction: 1 | -1) {
		cancelGlobalCommitListeners();
		isDragging.value = false;

		const currentDb = linearGainToDb(uiGain.value);
		let nextDb: number;
		if (currentDb <= CLIP_VOLUME_SILENCE_DB + 0.5 && direction > 0) {
			nextDb = CLIP_VOLUME_SLIDER_DB_MIN;
		} else {
			nextDb = currentDb + direction * VOLUME_NUDGE_DB;
		}
		nextDb = Math.max(CLIP_VOLUME_SILENCE_DB, Math.min(CLIP_VOLUME_SLIDER_DB_MAX, nextDb));
		const gain = dbToLinearGain(nextDb);
		draftGain.value = gain;
		setClipVolumeDraft(opts.elementId, gain);
		dbField.value = formatClipVolumeDb(nextDb);
		scheduleNudgeCommit();
	}

	onUnmounted(() => {
		cancelGlobalCommitListeners();
		cancelNudgeCommit();
		clearClipVolumeDraft(opts.elementId);
	});

	// Return a reactive object so templates can safely read nested refs as
	// `clipVolume.sliderStep` / `clipVolume.dbField` without rendering Ref objects.
	return reactive({
		dbField,
		sliderMax: CLIP_VOLUME_SLIDER_STEPS,
		sliderStep,
		onSliderPointerDown,
		onSliderInput,
		onDbFieldInput,
		onDbFieldBlur,
		nudgeDb,
		syncDbField,
	});
}
