<script setup lang="ts">
import { ref, computed, toRef, watch } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useKeyframes } from "../../composables/useKeyframes";
import { EASING_PRESETS } from "../../constants/easing-constants";
import type { KeyframableProperty, KeyframeInterpolation } from "../../types/keyframes";
import type { TimelineTrack, TimelineElement } from "../../types/timeline";
import { Diamond, Plus, Trash2, ChevronDown, X, List, BarChart2 } from "lucide-vue-next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import KeyframeGraphEditor from "./KeyframeGraphEditor.vue";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { CLIP_GAIN_MAX } from "../../lib/audio-volume-ui";

const { editor, version } = useEditor();
const { timelineKeyframePlacementActive, setTimelineKeyframePlacementActive } = useEditorUIState();
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

const kf = computed(() => {
	if (!selectedData.value) return null;
	return useKeyframes({
		trackRef: toRef(() => trackRef.value),
		elementRef: toRef(() => elementRef.value),
	});
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
	return track?.keyframes ?? [];
}

function hasPropertyKeyframes(prop: KeyframableProperty): boolean {
	return getPropertyKeyframes(prop).length > 0;
}

function addKeyframeAtPlayhead(prop: KeyframableProperty) {
	if (!kf.value || !elementRef.value) return;
	const el = elementRef.value;
	const currentTime = editor.playback.getCurrentTime();
	const normalizedTime = Math.max(0, Math.min(1, (currentTime - el.startTime) / el.duration));
	const propDef = PROPERTIES.find((p) => p.key === prop);
	const defaultVal = propDef?.defaultValue ?? 0;
	const currentVal = kf.value.getResolvedValue(prop, normalizedTime, defaultVal);
	kf.value.addKeyframe(prop, normalizedTime, currentVal);
}

function removeKeyframeById(prop: KeyframableProperty, keyframeId: string) {
	if (!kf.value) return;
	kf.value.removeKeyframe(prop, keyframeId);
}

function clearAllKeyframes(prop: KeyframableProperty) {
	if (!kf.value) return;
	kf.value.clearPropertyKeyframes(prop);
}

function updateKeyframeValue(prop: KeyframableProperty, keyframeId: string, value: number) {
	if (!kf.value) return;
	kf.value.updateKeyframe(prop, keyframeId, { value });
}

function updateKeyframeOffset(prop: KeyframableProperty, keyframeId: string, offset: number) {
	if (!kf.value) return;
	kf.value.updateKeyframe(prop, keyframeId, { offset: Math.max(0, Math.min(1, offset)) });
}

function updateKeyframeInterpolation(prop: KeyframableProperty, keyframeId: string, interpolation: KeyframeInterpolation) {
	if (!kf.value) return;
	kf.value.updateKeyframe(prop, keyframeId, { interpolation });
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
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center gap-1.5 border-b border-white/10 px-4 py-2">
			<Diamond class="size-3.5 text-zinc-500" />
			<span class="text-xs font-medium text-zinc-400">Keyframes</span>
			<div
				v-if="selectedData && (elementRef.type === 'video' || elementRef.type === 'audio')"
				class="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-2 py-0.5"
				title="When on, the cursor becomes a crosshair over clips and you can click the timeline to drop keyframes (video: picture area = opacity, waveform = volume; audio: waveform = volume). When off, clicks only select and move clips."
			>
				<span class="text-[10px] font-medium text-zinc-500">Click timeline to add</span>
				<!-- Reka SwitchRoot uses modelValue / update:modelValue (not checked / update:checked) -->
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
			<div
				v-for="prop in applicableProperties"
				:key="prop.key"
				class="rounded-md border border-white/10 bg-white/[0.02]"
			>
				<!-- Property header -->
				<button
					class="flex w-full items-center justify-between px-2.5 py-1.5"
					@click="toggleExpand(prop.key)"
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
							@click.stop="addKeyframeAtPlayhead(prop.key)"
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
							:value="Number(keyframe.value.toFixed(2))"
							:min="prop.min"
							:max="prop.max"
							:step="prop.step"
							class="h-5 w-14 rounded border border-white/10 bg-white/5 px-1 text-center text-[10px] text-zinc-300"
							@change="(e) => updateKeyframeValue(prop.key, keyframe.id, Number((e.target as HTMLInputElement).value))"
						/>

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
