<script setup lang="ts">
/**
 * Keyframe editor panel with Values and Curves modes.
 *
 * Values mode shows a list of all keyframes for each animatable property with
 * inline editing of time, value, and easing. Curves mode displays the graph editor.
 *
 * While this panel is open, the main timeline accepts clicks on the selected
 * clip to place keyframes at the clicked position (not only at the playhead).
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { TimelineElement } from "../../types/timeline";
import type { KeyframableProperty, KeyframeInterpolation } from "../../types/keyframes";
import { useEditor } from "../../composables/useEditor";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { useKeyframeEditor } from "../../composables/useKeyframeEditor";
import {
	KEYFRAME_EASING_OPTIONS,
	getKeyframePropertyDef,
	storedToDisplayValue,
	displayToStoredValue,
} from "../../lib/keyframe-editor-properties";
import KeyframeToggle from "./properties/KeyframeToggle.vue";
import KeyframeGraphEditor from "./KeyframeGraphEditor.vue";
import NumberBox from "./shared/NumberBox.vue";
import InspectorSelect from "./shared/InspectorSelect.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Diamond, ChevronLeft, ChevronRight, List, LineChart } from "lucide-vue-next";

const props = defineProps<{
	trackId: string;
	element: TimelineElement;
}>();

const { editor, version } = useEditor({
	subscribe: {
		timeline: true,
		playback: false,
		scenes: false,
		project: false,
		media: false,
		selection: false,
	},
});
const { setTimelineKeyframePlacementActive, setTimelineKeyframePlacementProperty } = useEditorUIState();

const liveTrack = computed(() => {
	void version.value;
	return editor.timeline.getTrackById({ trackId: props.trackId }) ?? null;
});
const liveElement = computed(() => {
	void version.value;
	return liveTrack.value?.elements.find((e) => e.id === props.element.id) ?? props.element;
});

const ke = useKeyframeEditor({
	trackRef: computed(() => liveTrack.value!),
	elementRef: liveElement,
});

const {
	applicableProperties,
	hasKeyframes,
	getPropertyKeyframes,
	isOnKeyframe,
	hasPrevKeyframe,
	hasNextKeyframe,
	goToPrevKeyframe,
	goToNextKeyframe,
	toggleKeyframing,
	addOrRemoveKeyframeAtPlayhead,
	setInterpolation,
	normalizedPlayhead,
	seekToOffset,
} = ke;

const showCurves = ref(false);

function formatOffset(offset: number): string {
	const el = liveElement.value;
	if (!el) return "0:00.00";
	const timeInSeconds = el.startTime + offset * el.duration;
	const minutes = Math.floor(timeInSeconds / 60);
	const seconds = (timeInSeconds % 60).toFixed(2);
	return `${minutes}:${seconds.padStart(5, "0")}`;
}

function usesCompactInputLabel(prop: KeyframableProperty): boolean {
	return prop === "positionX" || prop === "positionY";
}

type EditorMode = "values" | "curves";
const MODE_OPTIONS: SegmentedOption<EditorMode>[] = [
	{ value: "values", label: "Values", icon: List },
	{ value: "curves", label: "Curves", icon: LineChart },
];

const EASING_SELECT_OPTIONS = KEYFRAME_EASING_OPTIONS.map((o) => ({ value: o.id, label: o.label }));

function updateKeyframeValue(prop: KeyframableProperty, keyframeId: string, displayValue: string) {
	const def = getKeyframePropertyDef(prop);
	const parsed = parseFloat(displayValue);
	if (Number.isNaN(parsed)) return;
	const clamped = Math.max(def.min, Math.min(def.max, parsed));
	const stored = displayToStoredValue(def, clamped);
	
	const currentKeyframes = liveElement.value.keyframes;
	if (!currentKeyframes?.tracks[prop]) return;
	
	const updatedKeyframes = {
		...currentKeyframes,
		tracks: {
			...currentKeyframes.tracks,
			[prop]: {
				...currentKeyframes.tracks[prop],
				keyframes: currentKeyframes.tracks[prop].keyframes.map((k) =>
					k.id === keyframeId ? { ...k, value: stored } : k
				),
			},
		},
	};
	
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: { keyframes: updatedKeyframes },
	});
}

function onDiamondClick(prop: KeyframableProperty) {
	setTimelineKeyframePlacementProperty(prop);
	if (!hasKeyframes(prop)) {
		toggleKeyframing(prop);
		return;
	}
	addOrRemoveKeyframeAtPlayhead(prop);
}

onMounted(() => {
	setTimelineKeyframePlacementActive(true);
});

onUnmounted(() => {
	setTimelineKeyframePlacementActive(false);
});
</script>

<template>
	<div v-if="liveTrack" class="flex h-full flex-col overflow-hidden">
		<!-- Mode toggle -->
		<div class="shrink-0 border-b border-line-subtle px-3 py-2">
			<SegmentedControl
				:model-value="showCurves ? 'curves' : 'values'"
				:options="MODE_OPTIONS"
				size="sm"
				block
				@update:model-value="(v) => (showCurves = v === 'curves')"
			/>
		</div>

		<!-- Curves mode -->
		<div v-if="showCurves" class="min-h-0 flex-1 overflow-y-auto p-3">
			<KeyframeGraphEditor
				:track="liveTrack"
				:element="liveElement"
				:properties="applicableProperties"
				:playhead="normalizedPlayhead"
			/>
		</div>

		<!-- Values mode: one block per animatable property -->
		<div v-else class="min-h-0 flex-1 overflow-y-auto">
			<section
				v-for="prop in applicableProperties"
				:key="prop.key"
				class="border-b border-line-subtle"
			>
				<!-- Property header -->
				<div class="flex h-9 items-center gap-1.5 pl-2 pr-1.5">
					<KeyframeToggle
						:active="hasKeyframes(prop.key)"
						:label="prop.label"
						class="shrink-0"
						@toggle="toggleKeyframing(prop.key)"
					/>
					<span
						class="min-w-0 truncate text-xs font-semibold"
						:class="hasKeyframes(prop.key) ? 'text-fg' : 'text-fg-muted'"
					>{{ prop.label }}</span>
					<Badge v-if="hasKeyframes(prop.key)" variant="neutral" class="tabular">
						{{ getPropertyKeyframes(prop.key).length }}
					</Badge>
					<div class="flex-1" />
					<div v-if="hasKeyframes(prop.key)" class="flex shrink-0 items-center gap-0.5">
						<Button
							variant="ghost"
							size="icon-xs"
							:disabled="!hasPrevKeyframe(prop.key)"
							title="Previous keyframe"
							aria-label="Previous keyframe"
							@click="goToPrevKeyframe(prop.key)"
						>
							<ChevronLeft />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							:class="isOnKeyframe(prop.key) ? 'text-warning hover:bg-warning-soft hover:text-warning' : 'hover:text-warning'"
							:title="isOnKeyframe(prop.key) ? 'Remove keyframe' : 'Add keyframe'"
							:aria-label="isOnKeyframe(prop.key) ? 'Remove keyframe' : 'Add keyframe'"
							@click="onDiamondClick(prop.key)"
						>
							<Diamond :fill="isOnKeyframe(prop.key) ? 'currentColor' : 'none'" />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							:disabled="!hasNextKeyframe(prop.key)"
							title="Next keyframe"
							aria-label="Next keyframe"
							@click="goToNextKeyframe(prop.key)"
						>
							<ChevronRight />
						</Button>
					</div>
				</div>

				<!-- Keyframes: time · value · easing -->
				<div v-if="hasKeyframes(prop.key)" class="space-y-1.5 px-3 pb-3">
					<div
						v-for="kf in getPropertyKeyframes(prop.key)"
						:key="kf.id"
						class="flex items-center gap-1.5"
					>
						<button
							type="button"
							class="tabular h-7 shrink-0 rounded-md border px-1.5 font-mono text-2xs transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
							:class="Math.abs(kf.offset - normalizedPlayhead) < 0.005
								? 'border-[var(--warning-line)] bg-warning-soft text-warning'
								: 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg'"
							title="Go to keyframe"
							@click="seekToOffset(kf.offset)"
						>
							{{ formatOffset(kf.offset) }}
						</button>

						<NumberBox
							:value="storedToDisplayValue(prop, kf.value)"
							:min="prop.min"
							:max="prop.max"
							:step="prop.step"
							:prefix="usesCompactInputLabel(prop.key) ? prop.inputLabel : undefined"
							:suffix="prop.unit"
							align="right"
							:aria-label="`${prop.label} value`"
							class="w-[84px] shrink-0 px-1.5"
							@input="(v) => updateKeyframeValue(prop.key, kf.id, v)"
						/>

						<InspectorSelect
							:model-value="kf.interpolation"
							:options="EASING_SELECT_OPTIONS"
							aria-label="Easing"
							class="flex-1"
							@update:model-value="(v) => setInterpolation(prop.key, kf.id, v as KeyframeInterpolation)"
						/>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>
