<script setup lang="ts">
import { ref, watch, computed, toRef, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../../composables/useEditorUIState";
import type { VideoElement, ColorAdjustments, CropRect, ColorCurves, ColorWheels } from "../../../types/timeline";
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../../types/timeline";
import type { VideoEffect } from "../../../types/effects";
import { getEffectPreset } from "../../../constants/effect-constants";
import { COLOR_OVERLAY_BLEND_OPTIONS } from "../../../constants/color-overlay-constants";
import type { ChromakeySettings } from "../../../types/chromakey";
import { DEFAULT_CHROMAKEY } from "../../../types/chromakey";
import { Film, Trash2, RotateCcw, VolumeX, Volume2, FlipHorizontal, FlipVertical, Gauge, Wand2, Eye, EyeOff, X, ChevronDown, ChevronUp, Crop, RectangleHorizontal, Square, RectangleVertical, Pipette, SlidersHorizontal, Sparkles, Scissors, Diamond } from "lucide-vue-next";
import KeyframeEditorPanel from "../KeyframeEditorPanel.vue";
import MasksPanel from "./MasksPanel.vue";
import { useKeyframes } from "../../../composables/useKeyframes";
import { useKeyframedInspectorProperty } from "../../../composables/useKeyframedInspectorProperty";
import KeyframeToggle from "./KeyframeToggle.vue";
import AnimationProperties from "./AnimationProperties.vue";
import ColorCurvesPanel from "./ColorCurvesPanel.vue";
import ColorWheelsPanel from "./ColorWheelsPanel.vue";
import LutPanel from "./LutPanel.vue";
import ElementTimingFields from "./ElementTimingFields.vue";
import { Switch } from '@/components/ui/switch';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorTabRail from "../shared/InspectorTabRail.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import OptionChip from "../shared/OptionChip.vue";
import BlendModeSelect from "./BlendModeSelect.vue";
import EffectStackEditor from "./EffectStackEditor.vue";
import ColorAdjustmentsEditor from "./ColorAdjustmentsEditor.vue";
import ChromaKeyEditor from "./ChromaKeyEditor.vue";
import ColorGradingEditor from "./ColorGradingEditor.vue";
import { useClipVolumeInspector } from "../../../composables/panels/useClipVolumeInspector";
import { useRafBatchedUpdate } from "../../../composables/useRafBatchedUpdate";

const props = defineProps<{
	element: VideoElement;
	trackId: string;
}>();

type TopTab = 'video' | 'audio' | 'speed' | 'adjust' | 'grading' | 'animate' | 'masks' | 'keyframes';
const activeTab = ref<TopTab>('video');

const topTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: 'video', label: 'Video', icon: Film },
	{ id: 'audio', label: 'Audio', icon: Volume2 },
	{ id: 'speed', label: 'Speed', icon: Gauge },
	{ id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
	{ id: 'grading', label: 'Color grading', icon: Wand2 },
	{ id: 'animate', label: 'Animate', icon: Sparkles },
	{ id: 'masks', label: 'Masks', icon: Scissors },
	{ id: 'keyframes', label: 'Keyframes', icon: Diamond },
];

const openVideoSections = ref<Set<string>>(new Set(['basic']));
function toggleVideoSection(section: string) {
	openVideoSections.value = openVideoSections.value.has(section) ? new Set() : new Set([section]);
}

const { editor } = useEditor({
	subscribe: {
		playback: false,
		timeline: false,
		scenes: false,
		project: false,
		media: false,
		selection: false,
	},
});
const { selectedElements } = useElementSelection();
const { cropPanelRequested, clearCropPanelRequest } = useEditorUIState();

function isRangeInputTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement && target.type === "range";
}

function handleRangePointerDown(event: PointerEvent) {
	if (isRangeInputTarget(event.target)) {
		editor.setInteractiveDrag(true);
	}
}

function stopRangeInteraction() {
	flushUpdate();
	editor.setInteractiveDrag(false);
}

onMounted(() => {
	window.addEventListener("pointerup", stopRangeInteraction);
	window.addEventListener("pointercancel", stopRangeInteraction);
});

onUnmounted(() => {
	window.removeEventListener("pointerup", stopRangeInteraction);
	window.removeEventListener("pointercancel", stopRangeInteraction);
	stopRangeInteraction();
});

const trackRef = computed(() => editor.timeline.getTrackById({ trackId: props.trackId })!);
const elementRef = toRef(props, "element");
const { hasKeyframes: hasKf, addKeyframe, clearPropertyKeyframes } = useKeyframes({
	trackRef,
	elementRef,
});

const scaleKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "scale" });
const posXKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "positionX" });
const posYKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "positionY" });
const rotationKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "rotation" });

// --- Local input refs synced with element props (or keyframed resolved values) ---
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(props.element.transform.position.x.toString());
const posYInput = ref(props.element.transform.position.y.toString());
const rotateInput = ref(props.element.transform.rotate.toString());

watch(() => props.element.opacity, (v) => {
	if (!hasKf("opacity")) opacityInput.value = Math.round(v * 100).toString();
});
watch(scaleKf.displayValue, (v) => {
	scaleInput.value = Math.round(v * 100).toString();
}, { immediate: true });
watch(posXKf.displayValue, (v) => { posXInput.value = v.toString(); }, { immediate: true });
watch(posYKf.displayValue, (v) => { posYInput.value = v.toString(); }, { immediate: true });
watch(rotationKf.displayValue, (v) => { rotateInput.value = v.toString(); }, { immediate: true });

const speedTicks = [0.5, 1, 2, 3, 4, 5, 8, 10];
const currentSpeed = computed(() => props.element.speed ?? 1);
const speedInput = ref(currentSpeed.value.toFixed(2));
const isDraggingSpeed = ref(false);
const speedDragSnapshot = ref<ReturnType<typeof editor.timeline.getTracks> | null>(null);

watch(() => props.element.speed, (v) => { speedInput.value = (v ?? 1).toFixed(2); });

function clampSpeed(speed: number) {
	return Math.round(Math.max(0.1, Math.min(10, speed)) * 10) / 10;
}

function commitSpeed(speed: number) {
	const clamped = clampSpeed(speed);
	speedInput.value = clamped.toFixed(2);
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed: clamped,
	});
}

function applySpeedPreview(speed: number) {
	const clamped = clampSpeed(speed);
	const tracks = editor.timeline.getTracks();
	const updatedTracks = tracks.map((track) => {
		if (track.id !== props.trackId) return track;
		const target = track.elements.find((el) => el.id === props.element.id);
		if (!target) return track;
		const oldSpeed = ("speed" in target && typeof target.speed === "number") ? target.speed : 1;
		const oldDuration = target.duration;
		const newDuration = oldDuration * oldSpeed / clamped;
		const durationDelta = newDuration - oldDuration;
		const oldEndTime = target.startTime + oldDuration;
		return {
			...track,
			elements: track.elements.map((el) => {
				if (el.id === props.element.id) {
					return { ...el, speed: clamped, duration: newDuration } as typeof el;
				}
				if (durationDelta !== 0 && el.startTime >= oldEndTime - 0.001) {
					return { ...el, startTime: el.startTime + durationDelta } as typeof el;
				}
				return el;
			}),
		} as typeof track;
	});
	editor.timeline.updateTracks(updatedTracks);
}

function changeSpeed(speed: number) {
	const clamped = clampSpeed(speed);
	speedInput.value = clamped.toFixed(2);
	if (isDraggingSpeed.value) {
		applySpeedPreview(clamped);
	} else {
		commitSpeed(clamped);
	}
}

function onSpeedPointerDown() {
	if (!isDraggingSpeed.value) {
		speedDragSnapshot.value = editor.timeline.getTracks();
	}
	editor.setInteractiveDrag(true);
	isDraggingSpeed.value = true;
}
function onSpeedPointerUp(e: PointerEvent) {
	if (!isDraggingSpeed.value) return;
	isDraggingSpeed.value = false;
	editor.setInteractiveDrag(false);
	if (speedDragSnapshot.value) {
		editor.timeline.updateTracks(speedDragSnapshot.value);
		speedDragSnapshot.value = null;
	}
	commitSpeed(Number((e.target as HTMLInputElement).value) / 10);
}

function handleSpeedInput(value: string) {
	speedInput.value = value;
}

function handleSpeedBlur() {
	const parsed = parseFloat(speedInput.value);
	const val = Number.isNaN(parsed) ? (props.element.speed ?? 1) : Math.max(0.1, Math.min(10, parsed));
	commitSpeed(val);
}

const ca = computed(() => ({ ...DEFAULT_COLOR_ADJUSTMENTS, ...props.element.colorAdjustments }));

// --- Crop ---
const cropDefaults: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };
const cropVal = computed(() => props.element.crop ?? cropDefaults);
// Watch for toolbar crop button request
watch(cropPanelRequested, (requested) => {
	if (requested) {
		activeTab.value = 'video';
		openVideoSections.value = new Set(['crop']);
		clearCropPanelRequest();
	}
});

const cropTopInput = ref(Math.round(cropVal.value.top * 100).toString());
const cropRightInput = ref(Math.round(cropVal.value.right * 100).toString());
const cropBottomInput = ref(Math.round(cropVal.value.bottom * 100).toString());
const cropLeftInput = ref(Math.round(cropVal.value.left * 100).toString());

watch(() => props.element.crop, (v) => {
	const c = v ?? cropDefaults;
	cropTopInput.value = Math.round(c.top * 100).toString();
	cropRightInput.value = Math.round(c.right * 100).toString();
	cropBottomInput.value = Math.round(c.bottom * 100).toString();
	cropLeftInput.value = Math.round(c.left * 100).toString();
}, { deep: true });

function updateCrop(partial: Partial<CropRect>) {
	const newCrop = { ...cropVal.value, ...partial };
	// Clamp: ensure remaining visible area is at least 5%
	newCrop.top = clamp(newCrop.top, 0, 0.95 - newCrop.bottom);
	newCrop.bottom = clamp(newCrop.bottom, 0, 0.95 - newCrop.top);
	newCrop.left = clamp(newCrop.left, 0, 0.95 - newCrop.right);
	newCrop.right = clamp(newCrop.right, 0, 0.95 - newCrop.left);
	update({ crop: newCrop });
}

function resetCrop() {
	update({ crop: { top: 0, right: 0, bottom: 0, left: 0 } });
}

interface CropPreset {
	label: string;
	ratio: [number, number]; // width:height
}

const cropPresets: CropPreset[] = [
	{ label: "Free", ratio: [0, 0] },
	{ label: "16:9", ratio: [16, 9] },
	{ label: "9:16", ratio: [9, 16] },
	{ label: "4:3", ratio: [4, 3] },
	{ label: "3:4", ratio: [3, 4] },
	{ label: "1:1", ratio: [1, 1] },
	{ label: "4:5", ratio: [4, 5] },
	{ label: "21:9", ratio: [21, 9] },
];

function applyCropPreset(preset: CropPreset) {
	if (preset.ratio[0] === 0) {
		// Free — just reset
		resetCrop();
		return;
	}

	// Calculate crop to achieve target aspect ratio from source
	// We assume the source fills the canvas; crop symmetrically
	const targetW = preset.ratio[0];
	const targetH = preset.ratio[1];
	const targetAR = targetW / targetH;

	// Get media asset to know source dimensions
	const asset = editor.media.getAssets().find((a) => a.id === props.element.mediaId);
	const srcW = asset?.width ?? 1920;
	const srcH = asset?.height ?? 1080;
	const srcAR = srcW / srcH;

	let cropH = 0, cropV = 0; // horizontal and vertical crop fractions (per side)

	if (srcAR > targetAR) {
		// Source is wider than target — crop left/right
		const visibleW = srcH * targetAR; // width we want to keep
		const totalCropW = (srcW - visibleW) / srcW; // total fraction to remove
		cropH = totalCropW / 2;
	} else if (srcAR < targetAR) {
		// Source is taller than target — crop top/bottom
		const visibleH = srcW / targetAR;
		const totalCropH = (srcH - visibleH) / srcH;
		cropV = totalCropH / 2;
	}

	update({ crop: { top: cropV, right: cropH, bottom: cropV, left: cropH } });
}

const activeCropPresetLabel = computed(() => {
	const c = cropVal.value;
	if (c.top === 0 && c.right === 0 && c.bottom === 0 && c.left === 0) return "None";

	// Check if current crop matches a preset
	const asset = editor.media.getAssets().find((a) => a.id === props.element.mediaId);
	const srcW = asset?.width ?? 1920;
	const srcH = asset?.height ?? 1080;

	const visW = srcW * (1 - c.left - c.right);
	const visH = srcH * (1 - c.top - c.bottom);
	const visAR = visW / visH;

	for (const p of cropPresets) {
		if (p.ratio[0] === 0) continue;
		const pAR = p.ratio[0] / p.ratio[1];
		if (Math.abs(visAR - pAR) < 0.02) return p.label;
	}
	return "Custom";
});

const nativePresetLabel = computed(() => {
	const asset = editor.media.getAssets().find((a) => a.id === props.element.mediaId);
	if (!asset || !asset.width || !asset.height) return null;
	const srcAR = asset.width / asset.height;
	for (const p of cropPresets) {
		if (p.ratio[0] === 0) continue;
		const pAR = p.ratio[0] / p.ratio[1];
		if (Math.abs(srcAR - pAR) < 0.02) return p.label;
	}
	return null;
});

function commitUpdate(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

const { update, flush: flushUpdate } = useRafBatchedUpdate(commitUpdate);

const clipVolume = useClipVolumeInspector({
	elementId: props.element.id,
	getLinearGain: () => props.element.volume ?? 1,
	setLinearGain: (gain: number) => update({ volume: gain }),
});

function updateTransform(partial: Record<string, unknown>) {
	update({
		transform: {
			...props.element.transform,
			...partial,
			position: {
				...props.element.transform.position,
				...(partial.position as Record<string, unknown> ?? {}),
			},
		},
	});
}

function updateColorCurves(curves: ColorCurves) {
	update({ colorCurves: Object.keys(curves).length > 0 ? curves : undefined });
}

function updateColorWheels(wheels: ColorWheels) {
	update({ colorWheels: Object.keys(wheels).length > 0 ? wheels : undefined });
}

function updateLutPath(lutPath: string | undefined) {
	update({ lutPath: lutPath || undefined });
}

function updateColor(partial: Partial<ColorAdjustments>) {
	update({
		colorAdjustments: { ...ca.value, ...partial },
	});
}

// --- Chromakey ---
const chromakey = computed(() => props.element.chromakey ?? DEFAULT_CHROMAKEY);
const showChromakey = ref(chromakey.value.enabled);

function updateChromakey(partial: Partial<ChromakeySettings>) {
	update({ chromakey: { ...chromakey.value, ...partial } });
}

function resetChromakey() {
	update({ chromakey: { ...DEFAULT_CHROMAKEY } });
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

// --- Fade ---
const fadeInInput = ref(((props.element.fadeIn ?? 0) * 10).toFixed(0));
const fadeOutInput = ref(((props.element.fadeOut ?? 0) * 10).toFixed(0));

watch(() => props.element.fadeIn, (v) => { fadeInInput.value = ((v ?? 0) * 10).toFixed(0); });
watch(() => props.element.fadeOut, (v) => { fadeOutInput.value = ((v ?? 0) * 10).toFixed(0); });

function handleFadeInSlider(raw: number) {
	const val = raw / 10;
	fadeInInput.value = (val * 10).toFixed(0);
	update({ fadeIn: val > 0.01 ? val : undefined });
}
function handleFadeOutSlider(raw: number) {
	const val = raw / 10;
	fadeOutInput.value = (val * 10).toFixed(0);
	update({ fadeOut: val > 0.01 ? val : undefined });
}
function handleFadeInInput(value: string) {
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed) && parsed >= 0) {
		const clamped = Math.min(3, parsed);
		update({ fadeIn: clamped > 0.01 ? clamped : undefined });
	}
}
function handleFadeInBlur(e: Event) {
	const parsed = parseFloat((e.target as HTMLInputElement).value);
	const clamped = Number.isNaN(parsed) ? (props.element.fadeIn ?? 0) : Math.min(3, Math.max(0, parsed));
	update({ fadeIn: clamped > 0.01 ? clamped : undefined });
}
function handleFadeOutInput(value: string) {
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed) && parsed >= 0) {
		const clamped = Math.min(3, parsed);
		update({ fadeOut: clamped > 0.01 ? clamped : undefined });
	}
}
function handleFadeOutBlur(e: Event) {
	const parsed = parseFloat((e.target as HTMLInputElement).value);
	const clamped = Number.isNaN(parsed) ? (props.element.fadeOut ?? 0) : Math.min(3, Math.max(0, parsed));
	update({ fadeOut: clamped > 0.01 ? clamped : undefined });
}

function toggleOpacityKeyframe() {
	if (hasKf('opacity')) {
		clearPropertyKeyframes('opacity');
	} else {
		const currentTime = editor.playback.getCurrentTime();
		const elapsed = currentTime - props.element.startTime;
		const offset = props.element.duration > 0 ? elapsed / props.element.duration : 0;
		addKeyframe('opacity', clamp(offset, 0, 1), props.element.opacity);
	}
}

function toggleSpeedKeyframe() {
	if (hasKf('speed')) {
		clearPropertyKeyframes('speed');
	} else {
		const currentTime = editor.playback.getCurrentTime();
		const elapsed = currentTime - props.element.startTime;
		const offset = props.element.duration > 0 ? elapsed / props.element.duration : 0;
		addKeyframe('speed', clamp(offset, 0, 1), props.element.speed ?? 1);
	}
}

// --- Opacity ---
function handleOpacitySlider(val: number) {
	opacityInput.value = val.toString();
	update({ opacity: val / 100 });
}
function handleOpacityInput(value: string) {
	opacityInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) update({ opacity: clamp(parsed, 0, 100) / 100 });
}
function handleOpacityBlur() {
	const parsed = parseInt(opacityInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.opacity * 100) : clamp(parsed, 0, 100);
	opacityInput.value = pct.toString();
	update({ opacity: pct / 100 });
}

// --- Scale ---
function handleScaleSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	scaleInput.value = val.toString();
	const scale = val / 100;
	if (scaleKf.isKeyframed.value) {
		scaleKf.setKeyframedValue(scale);
	} else {
		updateTransform({ scale });
	}
}
function handleScaleInput(value: string) {
	scaleInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		const scale = clamp(parsed, 10, 500) / 100;
		if (scaleKf.isKeyframed.value) {
			scaleKf.setKeyframedValue(scale);
		} else {
			updateTransform({ scale });
		}
	}
}
function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const pct = Number.isNaN(parsed)
		? Math.round(scaleKf.displayValue.value * 100)
		: clamp(parsed, 10, 500);
	scaleInput.value = pct.toString();
	const scale = pct / 100;
	if (scaleKf.isKeyframed.value) {
		scaleKf.setKeyframedValue(scale);
	} else {
		updateTransform({ scale });
	}
}

// --- Position ---
function handlePosX(value: string) {
	posXInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		if (posXKf.isKeyframed.value) {
			posXKf.setKeyframedValue(parsed);
		} else {
			updateTransform({ position: { x: parsed, y: props.element.transform.position.y } });
		}
	}
}
function handlePosY(value: string) {
	posYInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		if (posYKf.isKeyframed.value) {
			posYKf.setKeyframedValue(parsed);
		} else {
			updateTransform({ position: { x: props.element.transform.position.x, y: parsed } });
		}
	}
}

// --- Rotation ---
function handleRotateSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	rotateInput.value = val.toString();
	if (rotationKf.isKeyframed.value) {
		rotationKf.setKeyframedValue(val);
	} else {
		updateTransform({ rotate: val });
	}
}
function handleRotateInput(value: string) {
	rotateInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		const rot = clamp(parsed, -360, 360);
		if (rotationKf.isKeyframed.value) {
			rotationKf.setKeyframedValue(rot);
		} else {
			updateTransform({ rotate: rot });
		}
	}
}

// --- Resets ---
function resetTransform() {
	update({ transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 } });
}
function resetColor() {
	update({ colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS } });
}

// --- Effects ---
const effects = computed(() => props.element.effects ?? []);
const showEffects = ref(effects.value.length > 0);

watch(() => props.element.effects, (v) => {
	if (v && v.length > 0) showEffects.value = true;
});

function toggleEffect(effectId: string) {
	const updated = effects.value.map((e) =>
		e.id === effectId ? { ...e, enabled: !e.enabled } : e,
	);
	update({ effects: updated });
}

function removeEffect(effectId: string) {
	const updated = effects.value.filter((e) => e.id !== effectId);
	update({ effects: updated });
}

function updateEffectParam(effectId: string, key: string, value: number | string) {
	const updated = effects.value.map((e) =>
		e.id === effectId ? { ...e, [key]: value } : e,
	);
	update({ effects: updated });
}

function getEffectLabel(type: string): string {
	return getEffectPreset(type)?.label ?? type;
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

</script>

<template>
	<div class="flex h-full min-h-0 flex-row" @pointerdown.capture="handleRangePointerDown">
		<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<div :key="activeTab" class="min-h-0 flex-1 animate-enter overflow-x-hidden overflow-y-auto">
				<!-- ══════ Video tab ══════ -->
				<template v-if="activeTab === 'video'">
					<InspectorSection
						title="Basic"
						collapsible
						:open="openVideoSections.has('basic')"
						@update:open="toggleVideoSection('basic')"
					>
						<ElementTimingFields :element="element" :track-id="trackId" />

						<div class="space-y-2 border-t border-line-subtle pt-3">
							<SectionHeader title="Transform" variant="eyebrow" class="min-h-6">
								<Button variant="ghost" size="xs" @click="resetTransform">
									<RotateCcw />
									Reset
								</Button>
							</SectionHeader>
							<div class="grid grid-cols-2 gap-2">
								<NumberBox
									prefix="Scale"
									suffix="%"
									:value="scaleInput"
									:min="10"
									:max="500"
									:step="1"
									:keyframed="scaleKf.isKeyframed.value"
									@input="handleScaleInput"
									@commit="handleScaleBlur"
								>
									<template #leading>
										<KeyframeToggle :active="scaleKf.isKeyframed.value" label="scale" class="-ml-1" @toggle="scaleKf.toggleKeyframe" />
									</template>
								</NumberBox>
								<NumberBox
									prefix="Rotate"
									suffix="°"
									:value="rotateInput"
									:min="-360"
									:max="360"
									:step="0.1"
									:keyframed="rotationKf.isKeyframed.value"
									@input="handleRotateInput"
								>
									<template #leading>
										<KeyframeToggle :active="rotationKf.isKeyframed.value" label="rotation" class="-ml-1" @toggle="rotationKf.toggleKeyframe" />
									</template>
								</NumberBox>
								<NumberBox
									prefix="X"
									:value="posXInput"
									:step="1"
									:keyframed="posXKf.isKeyframed.value"
									@input="handlePosX"
								>
									<template #leading>
										<KeyframeToggle :active="posXKf.isKeyframed.value" label="position X" class="-ml-1" @toggle="posXKf.toggleKeyframe" />
									</template>
								</NumberBox>
								<NumberBox
									prefix="Y"
									:value="posYInput"
									:step="1"
									:keyframed="posYKf.isKeyframed.value"
									@input="handlePosY"
								>
									<template #leading>
										<KeyframeToggle :active="posYKf.isKeyframed.value" label="position Y" class="-ml-1" @toggle="posYKf.toggleKeyframe" />
									</template>
								</NumberBox>
								<OptionChip
									:active="!!element.flip?.horizontal"
									:icon="FlipHorizontal"
									@click="update({ flip: { horizontal: !(element.flip?.horizontal ?? false), vertical: element.flip?.vertical ?? false } })"
								>
									Flip H
								</OptionChip>
								<OptionChip
									:active="!!element.flip?.vertical"
									:icon="FlipVertical"
									@click="update({ flip: { horizontal: element.flip?.horizontal ?? false, vertical: !(element.flip?.vertical ?? false) } })"
								>
									Flip V
								</OptionChip>
							</div>
						</div>

						<div class="space-y-3 border-t border-line-subtle pt-3">
							<SliderField
								label="Opacity"
								:model-value="element.opacity * 100"
								:input-value="opacityInput"
								unit="%"
								:keyframed="hasKf('opacity')"
								@slide="handleOpacitySlider"
								@input="handleOpacityInput"
								@commit="handleOpacityBlur"
							>
								<template #actions>
									<KeyframeToggle :active="hasKf('opacity')" label="opacity" @toggle="toggleOpacityKeyframe" />
								</template>
							</SliderField>

							<BlendModeSelect
								:model-value="element.blendMode"
								@update:model-value="(v) => update({ blendMode: v === 'normal' ? undefined : v })"
							/>

							<div class="grid grid-cols-2 gap-3">
								<SliderField
									label="Fade in"
									:model-value="(element.fadeIn ?? 0) * 10"
									:min="0"
									:max="30"
									:step="1"
									:readout="`${(element.fadeIn ?? 0).toFixed(1)}s`"
									@slide="handleFadeInSlider"
								/>
								<SliderField
									label="Fade out"
									:model-value="(element.fadeOut ?? 0) * 10"
									:min="0"
									:max="30"
									:step="1"
									:readout="`${(element.fadeOut ?? 0).toFixed(1)}s`"
									@slide="handleFadeOutSlider"
								/>
							</div>
						</div>
					</InspectorSection>

					<InspectorSection
						title="Crop"
						collapsible
						:open="openVideoSections.has('crop')"
						@update:open="toggleVideoSection('crop')"
					>
						<template v-if="activeCropPresetLabel !== 'None'" #meta>
							<Badge variant="brand">{{ activeCropPresetLabel }}</Badge>
						</template>
						<div class="space-y-2">
							<SectionHeader title="Aspect ratio" variant="eyebrow" class="min-h-6">
								<Button variant="ghost" size="xs" @click="resetCrop">
									<RotateCcw />
									Reset
								</Button>
							</SectionHeader>
							<div class="grid grid-cols-4 gap-1.5">
								<OptionChip
									v-for="preset in cropPresets"
									:key="preset.label"
									:disabled="preset.label === nativePresetLabel"
									:active="activeCropPresetLabel === preset.label || (preset.label === 'Free' && activeCropPresetLabel === 'None')"
									:title="preset.label === nativePresetLabel ? 'Source aspect ratio' : undefined"
									class="px-1"
									@click="applyCropPreset(preset)"
								>
									{{ preset.label }}
								</OptionChip>
							</div>
						</div>

						<div class="space-y-2 border-t border-line-subtle pt-3">
							<SectionHeader title="Edges" variant="eyebrow" class="min-h-6" />
							<div class="grid grid-cols-2 gap-2">
								<NumberBox prefix="Top" suffix="%" :value="Math.round(cropVal.top * 100)" :min="0" :max="45" :step="1" @input="(v) => updateCrop({ top: Number(v) / 100 })" />
								<NumberBox prefix="Bottom" suffix="%" :value="Math.round(cropVal.bottom * 100)" :min="0" :max="45" :step="1" @input="(v) => updateCrop({ bottom: Number(v) / 100 })" />
								<NumberBox prefix="Left" suffix="%" :value="Math.round(cropVal.left * 100)" :min="0" :max="45" :step="1" @input="(v) => updateCrop({ left: Number(v) / 100 })" />
								<NumberBox prefix="Right" suffix="%" :value="Math.round(cropVal.right * 100)" :min="0" :max="45" :step="1" @input="(v) => updateCrop({ right: Number(v) / 100 })" />
							</div>
						</div>
					</InspectorSection>

					<InspectorSection
						title="Effects"
						collapsible
						:open="openVideoSections.has('effects')"
						@update:open="toggleVideoSection('effects')"
					>
						<template v-if="effects.length > 0" #meta>
							<Badge variant="neutral" class="tabular">{{ effects.length }}</Badge>
						</template>
						<EffectStackEditor
							:effects="effects"
							@toggle="toggleEffect"
							@remove="removeEffect"
							@update="updateEffectParam"
						/>
					</InspectorSection>

					<InspectorSection
						title="Chroma key"
						collapsible
						:open="openVideoSections.has('chromakey')"
						@update:open="toggleVideoSection('chromakey')"
					>
						<template v-if="chromakey.enabled" #meta>
							<Badge variant="success">On</Badge>
						</template>
						<ChromaKeyEditor :settings="chromakey" @update="updateChromakey" @reset="resetChromakey" />
					</InspectorSection>
				</template>

				<!-- ══════ Audio tab ══════ -->
				<InspectorSection v-else-if="activeTab === 'audio'" title="Audio" flush>
					<!-- Volume (linear gain persisted; dB UI) -->
					<InspectorField label="Volume">
						<template #actions>
							<span class="text-2xs text-fg-subtle" title="Linear gain 1 = 0 dB (export / playback)">1 = 0 dB</span>
						</template>
						<div class="flex items-center gap-2">
							<input
								type="range"
								:value="clipVolume.sliderStep"
								min="0"
								:max="clipVolume.sliderMax"
								step="1"
								aria-label="Volume"
								class="min-w-0 flex-1"
								@pointerdown="clipVolume.onSliderPointerDown"
								@input="clipVolume.onSliderInput"
							/>
							<NumberBox
								type="text"
								:value="clipVolume.dbField"
								align="center"
								aria-label="Volume in decibels"
								class="w-[84px] shrink-0 pr-0"
								@input="clipVolume.onDbFieldInput"
								@commit="clipVolume.onDbFieldBlur"
							>
								<template #trailing>
									<div class="flex h-full w-4 shrink-0 flex-col border-l border-line">
										<button
											type="button"
											class="flex h-1/2 items-center justify-center text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
											title="Increase volume by 0.1 dB"
											aria-label="Increase volume by 0.1 dB"
											@mousedown.prevent
											@click="clipVolume.nudgeDb(1)"
										>
											<ChevronUp class="size-2.5" />
										</button>
										<button
											type="button"
											class="flex h-1/2 items-center justify-center border-t border-line text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
											title="Decrease volume by 0.1 dB"
											aria-label="Decrease volume by 0.1 dB"
											@mousedown.prevent
											@click="clipVolume.nudgeDb(-1)"
										>
											<ChevronDown class="size-2.5" />
										</button>
									</div>
								</template>
							</NumberBox>
						</div>
					</InspectorField>

					<div class="border-t border-line-subtle pt-3">
						<SliderField
							label="Pan"
							:model-value="(element.pan ?? 0) * 100"
							:min="-100"
							:max="100"
							:step="1"
							:readout="(element.pan ?? 0) === 0 ? 'C' : (element.pan ?? 0) > 0 ? `R${Math.round(Math.abs(element.pan ?? 0) * 100)}` : `L${Math.round(Math.abs(element.pan ?? 0) * 100)}`"
							@slide="(v) => update({ pan: v / 100 })"
						>
							<template #actions>
								<Button variant="ghost" size="xs" class="-my-1" title="Center pan" @click="update({ pan: 0 })">Center</Button>
							</template>
						</SliderField>
					</div>

					<InspectorField inline label="Mute" class="border-t border-line-subtle pt-3">
						<div class="flex-1" />
						<Switch :model-value="!!element.muted" aria-label="Mute clip" @update:model-value="(val: boolean) => update({ muted: val })" />
					</InspectorField>
				</InspectorSection>

				<!-- ══════ Speed tab ══════ -->
				<InspectorSection v-else-if="activeTab === 'speed'" title="Speed" flush>
					<template #actions>
						<KeyframeToggle :active="hasKf('speed')" label="speed" @toggle="toggleSpeedKeyframe" />
					</template>
					<div class="flex items-center gap-2">
						<input
							type="range"
							:value="currentSpeed * 10"
							min="1"
							max="100"
							step="1"
							aria-label="Playback speed"
							class="min-w-0 flex-1"
							@pointerdown="onSpeedPointerDown"
							@pointerup="onSpeedPointerUp"
							@input="(e) => changeSpeed(Number((e.target as HTMLInputElement).value) / 10)"
						/>
						<NumberBox
							type="text"
							:value="speedInput"
							suffix="x"
							align="center"
							aria-label="Playback speed"
							class="w-[72px] shrink-0"
							:keyframed="hasKf('speed')"
							@input="handleSpeedInput"
							@commit="handleSpeedBlur"
						/>
					</div>
				</InspectorSection>

				<!-- ══════ Animate tab ══════ -->
				<InspectorSection v-else-if="activeTab === 'animate'" title="Animation" flush>
					<AnimationProperties
						:element-id="element.id"
						:track-id="trackId"
						:animation-in="element.animationIn"
						:animation-out="element.animationOut"
						:animation-loop="element.animationLoop"
						:element-duration="element.duration"
					/>
				</InspectorSection>

				<!-- ══════ Masks tab ══════ -->
				<MasksPanel v-else-if="activeTab === 'masks'" :element="element" :track-id="trackId" />

				<!-- ══════ Adjust tab ══════ -->
				<ColorAdjustmentsEditor
					v-else-if="activeTab === 'adjust'"
					:adjustments="ca"
					@update="updateColor"
					@reset="resetColor"
				/>

				<!-- ══════ Color grading tab ══════ -->
				<ColorGradingEditor
					v-else-if="activeTab === 'grading'"
					:curves="element.colorCurves"
					:wheels="element.colorWheels"
					:lut-path="element.lutPath"
					@update:curves="updateColorCurves"
					@update:wheels="updateColorWheels"
					@update:lut-path="updateLutPath"
				/>

				<!-- ══════ Keyframes tab ══════ -->
				<KeyframeEditorPanel v-else-if="activeTab === 'keyframes'" :track-id="trackId" :element="element" />
			</div>
		</div>

		<InspectorTabRail v-model="activeTab" :tabs="topTabs" />
	</div>
</template>
