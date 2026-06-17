<script setup lang="ts">
import { ref, computed, toRef, watch } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useKeyframes } from "../../composables/useKeyframes";
import { EASING_PRESETS } from "../../constants/easing-constants";
import type { KeyframableProperty, KeyframeInterpolation } from "../../types/keyframes";
import { sortedKeyframes } from "../../types/keyframes";
import type { TimelineTrack, TimelineElement } from "../../types/timeline";
import {
	getKeyframePropertyStaticDefault,
	formatKeyframeDisplayValue,
	parseKeyframeDisplayValue,
	getValueForNewKeyframeAtOffset,
} from "../../lib/keyframe-property-defaults";
import { Diamond, Plus, Trash2, ChevronDown, X, List, BarChart2 } from "lucide-vue-next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import KeyframeGraphEditor from "./KeyframeGraphEditor.vue";
import { useEditorUIState, isWaveformPlacementProperty } from "../../composables/useEditorUIState";
import { CLIP_GAIN_MAX } from "../../lib/audio-volume-ui";

const { editor, version } = useEditor();
const {
	timelineKeyframePlacementActive,
	setTimelineKeyframePlacementActive,
	timelineKeyframePlacementProperty,
	setTimelineKeyframePlacementProperty,
} = useEditorUIState();
const { selectedElements } = useElementSelection();

watch(
	() => selectedElements.value.length,
	(len) => {
		if (len !== 1 && timelineKeyframePlacementActive.value) setTimelineKeyframePlacementActive(false);
	},
);

const selectedData = computed(() => {
	void version.value;
	if (selectedElements.value.length !== 1) return null;
	const sel = selectedElements.value[0];
	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return null; }
	if (!scene) return null;
	for (const track of scene.tracks) {
		if (track.id !== sel.trackId) continue;
		const el = track.elements.find((e: any) => e.id === sel.elementId);
		if (el) return { element: el as TimelineElement, track: track as TimelineTrack };
	}
	return null;
});

const trackRef = computed(() => selectedData.value?.track as TimelineTrack);
const elementRef = computed(() => selectedData.value?.element as TimelineElement);

// Placeholder refs so useKeyframes can run before selection (composable rules).
const fallbackTrack = { id: "__none__", type: "video", name: "", elements: [], muted: false, hidden: false, locked: false, isMain: true } as TimelineTrack;
const fallbackElement = {
	id: "__none__",
	type: "video",
	name: "",
	duration: 1,
	startTime: 0,
	trimStart: 0,
	trimEnd: 0,
	mediaId: "",
	transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
	opacity: 1,
} as TimelineElement;

const kfTrackRef = computed(() => trackRef.value ?? fallbackTrack);
const kfElementRef = computed(() => elementRef.value ?? fallbackElement);
const kf = useKeyframes({
	trackRef: kfTrackRef,
	elementRef: kfElementRef,
});

const PROPERTIES: { key: KeyframableProperty; label: string; defaultValue: number; min: number; max: number; step: number }[] = [
	{ key: "opacity", label: "Opacity", defaultValue: 1, min: 0, max: 1, step: 0.01 },
	{ key: "scale", label: "Scale", defaultValue: 1, min: 0.1, max: 5, step: 0.01 },
	{ key: "positionX", label: "Position X", defaultValue: 0, min: -1000, max: 1000, step: 1 },
	{ key: "positionY", label: "Position Y", defaultValue: 0, min: -1000, max: 1000, step: 1 },
	{ key: "rotation", label: "Rotation", defaultValue: 0, min: -360, max: 360, step: 1 },
	{ key: "volume", label: "Volume (gain)", defaultValue: 1, min: 0, max: CLIP_GAIN_MAX, step: 0.01 },
	{ key: "speed", label: "Speed", defaultValue: 1, min: 0.1, max: 10, step: 0.01 },
];

const expandedProperties = ref<Set<KeyframableProperty>>(new Set());
const showGraph = ref(false);

function toggleExpand(prop: KeyframableProperty) {
	if (expandedProperties.value.has(prop)) {
		expandedProperties.value.delete(prop);
	} else {
		expandedProperties.value.add(prop);
	}
}

function getPropertyKeyframes(prop: KeyframableProperty) {
	if (!elementRef.value?.keyframes) return [];
	const track = elementRef.value.keyframes.tracks[prop];
	return sortedKeyframes(track?.keyframes ?? []);
}

function hasPropertyKeyframes(prop: KeyframableProperty): boolean {
	return getPropertyKeyframes(prop).length > 0;
}

function addKeyframeAtPlayhead(prop: KeyframableProperty) {
	if (!selectedData.value || !elementRef.value) return;
	const el = elementRef.value;
	const normalizedTime = kf.getNormalizedPlayheadOffset();
	const staticDefault = getKeyframePropertyStaticDefault(el, prop);
	const currentVal = getValueForNewKeyframeAtOffset({
		elementKeyframes: el.keyframes,
		property: prop,
		offset: normalizedTime,
		staticDefault,
	});
	kf.addKeyframe(prop, normalizedTime, currentVal);
}

function removeKeyframeById(prop: KeyframableProperty, keyframeId: string) {
	kf.removeKeyframe(prop, keyframeId);
}

function clearAllKeyframes(prop: KeyframableProperty) {
	kf.clearPropertyKeyframes(prop);
}

function updateKeyframeValue(prop: KeyframableProperty, keyframeId: string, value: number) {
	kf.updateKeyframe(prop, keyframeId, { value });
}

function updateKeyframeOffset(prop: KeyframableProperty, keyframeId: string, offset: number) {
	kf.updateKeyframe(prop, keyframeId, { offset: Math.max(0, Math.min(1, offset)) });
}

function updateKeyframeInterpolation(prop: KeyframableProperty, keyframeId: string, interpolation: KeyframeInterpolation) {
	kf.updateKeyframe(prop, keyframeId, { interpolation });
}

function keyframeValueLabel(prop: KeyframableProperty): string {
	if (prop === "scale") return "%";
	if (prop === "opacity") return "%";
	return "";
}

function displayKeyframeValue(prop: KeyframableProperty, value: number): string {
	return formatKeyframeDisplayValue(prop, value);
}

function onKeyframeValueInput(prop: KeyframableProperty, keyframeId: string, raw: number) {
	const stored = parseKeyframeDisplayValue(prop, raw);
	updateKeyframeValue(prop, keyframeId, stored);
}

function formatOffset(offset: number): string {
	return `${Math.round(offset * 100)}%`;
}

function getEasingLabel(interp: KeyframeInterpolation): string {
	return EASING_PRESETS.find((e) => e.id === interp)?.label ?? interp;
}

const applicableProperties = computed(() => {
	if (!elementRef.value) return [];
	const type = elementRef.value.type;
	if (type === "audio") return PROPERTIES.filter((p) => p.key === "volume");
	if (type === "video") return PROPERTIES;
	if (type === "image") return PROPERTIES.filter((p) => p.key !== "volume" && p.key !== "speed");
	return PROPERTIES.filter((p) => p.key !== "volume" && p.key !== "speed");
});

watch(applicableProperties, (props) => {
	if (props.length === 0) return;
	if (!props.some((p) => p.key === timelineKeyframePlacementProperty.value)) {
		setTimelineKeyframePlacementProperty(props[0]!.key);
	}
}, { immediate: true });

function onPropertyRowClick(prop: KeyframableProperty) {
	if (timelineKeyframePlacementActive.value) {
		setTimelineKeyframePlacementProperty(prop);
	}
	toggleExpand(prop);
}

function placementTargetHint(prop: KeyframableProperty): string {
	return isWaveformPlacementProperty(prop)
		? "Click the clip waveform on the timeline"
		: "Click the clip picture area on the timeline";
}
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center gap-1.5 border-b border-white/10 px-4 py-2">
			<Diamond class="size-3.5 text-zinc-500" />
			<span class="text-xs font-medium text-zinc-400">Keyframes</span>
			<div
				v-if="selectedData && (elementRef.type === 'video' || elementRef.type === 'audio' || elementRef.type === 'image')"
				class="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-2 py-0.5"
				title="When on, click the timeline to add a keyframe for the selected property. Visual properties use the picture area; volume uses the waveform."
			>
				<span class="text-[10px] font-medium text-zinc-500">Click timeline to add</span>
				<Switch
					:model-value="timelineKeyframePlacementActive"
					class="scale-90"
					@update:model-value="setTimelineKeyframePlacementActive"
				/>
			</div>
			<div class="ml-auto flex items-center gap-0.5">
				<button
					class="flex size-5 items-center justify-center rounded text-zinc-500 transition-colors"
					:class="!showGraph ? 'bg-white/10 text-zinc-200' : 'hover:bg-white/5 hover:text-zinc-300'"
					title="List view"
					@click="showGraph = false"
				>
					<List class="size-3" />
				</button>
				<button
					class="flex size-5 items-center justify-center rounded text-zinc-500 transition-colors"
					:class="showGraph ? 'bg-white/10 text-zinc-200' : 'hover:bg-white/5 hover:text-zinc-300'"
					title="Graph view"
					@click="showGraph = true"
				>
					<BarChart2 class="size-3" />
				</button>
			</div>
		</div>

		<!-- No element selected -->
		<div v-if="!selectedData" class="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
			<Diamond class="size-8 text-zinc-600" :stroke-width="1" />
			<p class="text-xs text-zinc-500">Select an element to edit keyframes</p>
		</div>

		<!-- Graph view -->
		<div v-else-if="showGraph" class="flex-1 overflow-y-auto">
			<KeyframeGraphEditor
				:track-ref="toRef(() => trackRef)"
				:element-ref="toRef(() => elementRef)"
				:applicable-properties="applicableProperties"
			/>
		</div>

		<!-- List view -->
		<div v-else class="flex-1 overflow-y-auto p-3 space-y-1">
			<p class="mb-2 px-1 text-[10px] leading-relaxed text-zinc-600">
				Outside the first and last keyframe, the clip uses its base value (e.g. 100% scale). Values animate only between keyframes.
			</p>
			<div
				v-if="timelineKeyframePlacementActive && applicableProperties.length > 0"
				class="mb-2 flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5"
			>
				<span class="shrink-0 text-[10px] font-medium text-amber-400">Add property</span>
				<Select
					:model-value="timelineKeyframePlacementProperty"
					@update:model-value="(v) => setTimelineKeyframePlacementProperty(v as KeyframableProperty)"
				>
					<SelectTrigger class="h-6 min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 text-[10px] text-zinc-200">
						<SelectValue />
					</SelectTrigger>
					<SelectContent class="bg-zinc-900 border-white/10">
						<SelectItem
							v-for="prop in applicableProperties"
							:key="prop.key"
							:value="prop.key"
							class="text-[10px] text-zinc-200"
						>
							{{ prop.label }}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<p
				v-if="timelineKeyframePlacementActive"
				class="mb-2 px-1 text-[10px] leading-relaxed text-amber-400/80"
			>
				{{ placementTargetHint(timelineKeyframePlacementProperty) }}
			</p>
			<div
				v-for="prop in applicableProperties"
				:key="prop.key"
				class="rounded-md border bg-white/[0.02]"
				:class="timelineKeyframePlacementActive && timelineKeyframePlacementProperty === prop.key
					? 'border-amber-500/40 bg-amber-500/5'
					: 'border-white/10'"
			>
				<!-- Property header -->
				<button
					class="flex w-full items-center justify-between px-2.5 py-1.5"
					:title="timelineKeyframePlacementActive ? `Set timeline click target to ${prop.label}` : undefined"
					@click="onPropertyRowClick(prop.key)"
				>
					<div class="flex items-center gap-1.5">
						<Diamond
							class="size-3"
							:class="hasPropertyKeyframes(prop.key) ? 'text-amber-400' : 'text-zinc-600'"
						/>
						<span class="text-xs font-medium" :class="hasPropertyKeyframes(prop.key) ? 'text-zinc-300' : 'text-zinc-500'">
							{{ prop.label }}
						</span>
						<span v-if="hasPropertyKeyframes(prop.key)" class="rounded-full bg-amber-500/20 px-1.5 text-[9px] font-medium text-amber-400">
							{{ getPropertyKeyframes(prop.key).length }}
						</span>
					</div>
					<div class="flex items-center gap-1">
						<button
							class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-white/5 hover:text-amber-400"
							title="Add keyframe at playhead"
							@click.stop="setTimelineKeyframePlacementProperty(prop.key); addKeyframeAtPlayhead(prop.key)"
						>
							<Plus class="size-3" />
						</button>
						<button
							v-if="hasPropertyKeyframes(prop.key)"
							class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
							title="Clear all keyframes"
							@click.stop="clearAllKeyframes(prop.key)"
						>
							<Trash2 class="size-3" />
						</button>
						<ChevronDown
							class="size-3.5 text-zinc-500 transition-transform"
							:class="{ 'rotate-180': !expandedProperties.has(prop.key) }"
						/>
					</div>
				</button>

				<!-- Keyframe list -->
				<div v-if="expandedProperties.has(prop.key)" class="border-t border-white/10 px-2.5 py-2 space-y-1.5">
					<div v-if="getPropertyKeyframes(prop.key).length === 0" class="py-2 text-center">
						<p class="text-[10px] text-zinc-600">No keyframes. Click + to add one.</p>
					</div>

					<div
						v-for="keyframe in getPropertyKeyframes(prop.key)"
						:key="keyframe.id"
						class="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1"
					>
						<!-- Diamond icon -->
						<Diamond class="size-2.5 shrink-0 text-amber-400" />

						<!-- Offset -->
						<div class="flex items-center gap-0.5">
							<span class="text-[9px] text-zinc-500">@</span>
							<input
								type="number"
								:value="Math.round(keyframe.offset * 100)"
								min="0"
								max="100"
								step="1"
								class="h-5 w-10 rounded border border-white/10 bg-white/5 px-1 text-center text-[10px] text-zinc-300"
								@change="(e) => updateKeyframeOffset(prop.key, keyframe.id, Number((e.target as HTMLInputElement).value) / 100)"
							/>
							<span class="text-[9px] text-zinc-500">%</span>
						</div>

						<!-- Value -->
						<input
							type="number"
							:value="displayKeyframeValue(prop.key, keyframe.value)"
							:min="prop.key === 'scale' || prop.key === 'opacity' ? prop.min * 100 : prop.min"
							:max="prop.key === 'scale' || prop.key === 'opacity' ? prop.max * 100 : prop.max"
							:step="prop.key === 'scale' || prop.key === 'opacity' ? 1 : prop.step"
							class="h-5 w-14 rounded border border-white/10 bg-white/5 px-1 text-center text-[10px] text-zinc-300"
							@change="(e) => onKeyframeValueInput(prop.key, keyframe.id, Number((e.target as HTMLInputElement).value))"
						/>
						<span v-if="keyframeValueLabel(prop.key)" class="text-[9px] text-zinc-500">{{ keyframeValueLabel(prop.key) }}</span>

						<!-- Easing dropdown -->
						<Select
							:model-value="keyframe.interpolation"
							@update:model-value="(v) => updateKeyframeInterpolation(prop.key, keyframe.id, v as KeyframeInterpolation)"
						>
							<SelectTrigger class="h-5 flex-1 min-w-0 rounded border border-white/10 bg-white/5 px-1 text-[9px] text-zinc-400">
								<SelectValue />
							</SelectTrigger>
							<SelectContent class="bg-zinc-900 border-white/10">
								<SelectItem v-for="easing in EASING_PRESETS" :key="easing.id" :value="easing.id" class="text-[9px] text-zinc-200">
									{{ easing.label }}
								</SelectItem>
							</SelectContent>
						</Select>

						<!-- Delete -->
						<button
							class="flex size-4 shrink-0 items-center justify-center rounded text-zinc-600 hover:text-red-400"
							@click="removeKeyframeById(prop.key, keyframe.id)"
						>
							<X class="size-2.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
