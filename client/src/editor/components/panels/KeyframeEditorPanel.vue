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
import type { KeyframePropertyDef } from "../../lib/keyframe-editor-properties";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function keyframeValueInputClass(prop: KeyframePropertyDef): string {
	const base = "shrink-0 bg-transparent text-xs tabular-nums text-zinc-200 outline-none";
	switch (prop.key) {
		case "scale":
			return `${base} w-12 text-right`;
		case "opacity":
		case "volume":
			return `${base} w-11 text-right`;
		case "speed":
			return `${base} w-14 text-right`;
		case "positionX":
		case "positionY":
			return `${base} w-[4.25rem] text-right`;
		default:
			return `${base} w-12 text-right`;
	}
}

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
		<!-- Mode Toggle (matching Video tab styling) -->
		<div class="shrink-0 space-y-4 border-b border-white/10 p-3">
			<div class="flex gap-1 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
				<button
					type="button"
					class="flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-medium transition-colors"
					:class="!showCurves ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
					@click="showCurves = false"
				>
					<List class="size-3" />
					Values
				</button>
				<button
					type="button"
					class="flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-medium transition-colors"
					:class="showCurves ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
					@click="showCurves = true"
				>
					<LineChart class="size-3" />
					Curves
				</button>
			</div>
		</div>

		<!-- Curves Mode -->
		<KeyframeGraphEditor
			v-if="showCurves"
			:track="liveTrack"
			:element="liveElement"
			:properties="applicableProperties"
			:playhead="normalizedPlayhead"
		/>

		<!-- Values Mode: Flat list matching Video tab styling -->
		<div v-else class="flex-1 overflow-y-auto">
			<div
				v-for="prop in applicableProperties"
				:key="prop.key"
				class="space-y-2 border-t border-white/[0.05] px-3 py-4 first:border-t-0"
			>
				<!-- Property Header (matching Video tab section headers) -->
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<KeyframeToggle
							:active="hasKeyframes(prop.key)"
							:label="prop.label"
							class="shrink-0"
							@toggle="toggleKeyframing(prop.key)"
						/>
						<span class="text-xs font-medium text-zinc-300">{{ prop.label }}</span>
					</div>
					<div v-if="hasKeyframes(prop.key)" class="flex items-center gap-1">
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded transition-colors"
							:class="hasPrevKeyframe(prop.key) ? 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100' : 'cursor-default text-zinc-600'"
							:disabled="!hasPrevKeyframe(prop.key)"
							title="Previous keyframe"
							@click="goToPrevKeyframe(prop.key)"
						>
							<ChevronLeft class="size-3.5" />
						</button>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded transition-colors"
							:class="isOnKeyframe(prop.key) ? 'text-amber-400 hover:bg-amber-400/10' : 'text-zinc-400 hover:text-amber-400'"
							:title="isOnKeyframe(prop.key) ? 'Remove keyframe' : 'Add keyframe'"
							@click="onDiamondClick(prop.key)"
						>
							<Diamond class="size-3.5" :fill="isOnKeyframe(prop.key) ? 'currentColor' : 'none'" />
						</button>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded transition-colors"
							:class="hasNextKeyframe(prop.key) ? 'text-zinc-300 hover:bg-white/5 hover:text-zinc-100' : 'cursor-default text-zinc-600'"
							:disabled="!hasNextKeyframe(prop.key)"
							title="Next keyframe"
							@click="goToNextKeyframe(prop.key)"
						>
							<ChevronRight class="size-3.5" />
						</button>
					</div>
				</div>

				<!-- Keyframes (flat rows, no nested cards) -->
				<div v-if="hasKeyframes(prop.key)" class="space-y-1.5">
					<div
						v-for="(kf, idx) in getPropertyKeyframes(prop.key)"
						:key="kf.id"
						class="flex items-center gap-2"
					>
						<!-- Time -->
						<button
							type="button"
							class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors"
							:class="Math.abs(kf.offset - normalizedPlayhead) < 0.005 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'"
							@click="seekToOffset(kf.offset)"
						>
							{{ formatOffset(kf.offset) }}
						</button>

						<!-- Value: hug contents — no extra dead space left of the number -->
						<div class="inline-flex h-7 w-fit shrink-0 items-center gap-0.5 rounded-sm border border-white/10 bg-white/5 pl-1.5 pr-1">
							<span
								v-if="usesCompactInputLabel(prop.key)"
								class="shrink-0 select-none text-[10px] text-zinc-500"
							>{{ prop.inputLabel }}</span>
							<input
								type="number"
								:value="storedToDisplayValue(prop, kf.value)"
								:min="prop.min"
								:max="prop.max"
								:step="prop.step"
								:class="keyframeValueInputClass(prop)"
								@input="(e) => updateKeyframeValue(prop.key, kf.id, (e.target as HTMLInputElement).value)"
							/>
							<span class="shrink-0 text-[10px] text-zinc-500">{{ prop.unit }}</span>
						</div>

						<!-- Easing fills remaining row space -->
						<Select
							class="min-w-0 flex-1"
							:model-value="kf.interpolation"
							@update:model-value="(v) => setInterpolation(prop.key, kf.id, v as KeyframeInterpolation)"
						>
							<SelectTrigger class="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 text-[10px] text-zinc-200">
								<SelectValue />
							</SelectTrigger>
							<SelectContent class="max-h-[250px] border-white/10 bg-zinc-900">
								<SelectItem
									v-for="opt in KEYFRAME_EASING_OPTIONS"
									:key="opt.id"
									:value="opt.id"
									class="text-xs text-zinc-200"
								>
									{{ opt.label }}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
