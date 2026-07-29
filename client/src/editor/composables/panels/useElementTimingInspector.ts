import { ref, watch, computed, type Ref } from "vue";
import { useEditor } from "../useEditor";
import type { TimelineElement } from "../../types/timeline";
import { formatInspectorTime, parseInspectorTime } from "../../lib/inspector-time";
import {
	clampSpeed,
	getElementSourceExtent,
} from "../../lib/timeline/trim-source-utils";
import { snapTimeToFrame } from "../../lib/time";

const MIN_DURATION_SECONDS = 0.01;

function canExtendDuration(type: TimelineElement["type"]): boolean {
	return (
		type === "text" ||
		type === "image" ||
		type === "effect" ||
		type === "sticker" ||
		type === "caption"
	);
}

function getMaxDuration(element: TimelineElement): number | null {
	if (canExtendDuration(element.type)) return null;

	const speed = clampSpeed("speed" in element ? element.speed : undefined);
	const sourceExtent = getElementSourceExtent({
		trimStart: element.trimStart,
		duration: element.duration,
		trimEnd: element.trimEnd,
		speed,
	});

	return Math.max(
		MIN_DURATION_SECONDS,
		(sourceExtent - element.trimStart) / speed,
	);
}

export function useElementTimingInspector(opts: {
	element: Ref<TimelineElement>;
	trackId: string;
}) {
	const { editor } = useEditor({ subscribe: false });

	const startInput = ref(formatInspectorTime(opts.element.value.startTime));
	const durationInput = ref(formatInspectorTime(opts.element.value.duration));

	watch(
		() => opts.element.value.startTime,
		(value) => {
			startInput.value = formatInspectorTime(value);
		},
	);
	watch(
		() => opts.element.value.duration,
		(value) => {
			durationInput.value = formatInspectorTime(value);
		},
	);

	const maxDuration = computed(() => getMaxDuration(opts.element.value));

	function getFps(): number {
		return editor.project.getActive()?.settings?.fps ?? 30;
	}

	function clampDuration(duration: number): number {
		let clamped = Math.max(MIN_DURATION_SECONDS, duration);
		const max = maxDuration.value;
		if (max != null) clamped = Math.min(max, clamped);
		return snapTimeToFrame({ time: clamped, fps: getFps() });
	}

	function commitStart() {
		const parsed = parseInspectorTime(startInput.value);
		if (parsed == null) {
			startInput.value = formatInspectorTime(opts.element.value.startTime);
			return;
		}

		const startTime = snapTimeToFrame({
			time: Math.max(0, parsed),
			fps: getFps(),
		});
		startInput.value = formatInspectorTime(startTime);

		if (Math.abs(startTime - opts.element.value.startTime) < 1e-6) return;

		editor.timeline.updateElementStartTime({
			elements: [{ trackId: opts.trackId, elementId: opts.element.value.id }],
			startTime,
		});
	}

	function commitDuration() {
		const parsed = parseInspectorTime(durationInput.value);
		if (parsed == null) {
			durationInput.value = formatInspectorTime(opts.element.value.duration);
			return;
		}

		const duration = clampDuration(parsed);
		durationInput.value = formatInspectorTime(duration);

		if (Math.abs(duration - opts.element.value.duration) < 1e-6) return;

		editor.timeline.updateElementDuration({
			trackId: opts.trackId,
			elementId: opts.element.value.id,
			duration,
		});
	}

	function onStartInput(value: string) {
		startInput.value = value;
	}

	function onDurationInput(value: string) {
		durationInput.value = value;
	}

	return {
		startInput,
		durationInput,
		maxDuration,
		onStartInput,
		onDurationInput,
		commitStart,
		commitDuration,
	};
}
