<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../../composables/useEditorUIState";
import type { VideoElement, ColorAdjustments, CropRect, ColorCurves, ColorWheels } from "../../../types/timeline";
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../../types/timeline";
import type { VideoEffect } from "../../../types/effects";
import { getEffectPreset } from "../../../constants/effect-constants";
import type { ChromakeySettings } from "../../../types/chromakey";
import { DEFAULT_CHROMAKEY } from "../../../types/chromakey";
import { Film, Trash2, RotateCcw, VolumeX, Volume2, FlipHorizontal, FlipVertical, Gauge, Wand2, Eye, EyeOff, X, ChevronDown, Crop, RectangleHorizontal, Square, RectangleVertical, Pipette, SlidersHorizontal, Sparkles, Scissors } from "lucide-vue-next";
import MasksPanel from "./MasksPanel.vue";
import { useKeyframes } from "../../../composables/useKeyframes";
import { toRef } from "vue";
import KeyframeToggle from "./KeyframeToggle.vue";
import AnimationProperties from "./AnimationProperties.vue";
import ColorCurvesPanel from "./ColorCurvesPanel.vue";
import ColorWheelsPanel from "./ColorWheelsPanel.vue";
import LutPanel from "./LutPanel.vue";
import { Switch } from '@/components/ui/switch';

const props = defineProps<{
	element: VideoElement;
	trackId: string;
}>();

type TopTab = 'video' | 'audio' | 'speed' | 'adjust' | 'grading' | 'animate' | 'masks';
const activeTab = ref<TopTab>('video');

const topTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: 'video', label: 'Video', icon: Film },
	{ id: 'audio', label: 'Audio', icon: Volume2 },
	{ id: 'speed', label: 'Speed', icon: Gauge },
	{ id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
	{ id: 'grading', label: 'Grade', icon: Wand2 },
	{ id: 'animate', label: 'Animate', icon: Sparkles },
	{ id: 'masks', label: 'Masks', icon: Scissors },
];

const openVideoSections = ref<Set<string>>(new Set(['basic']));
function toggleVideoSection(section: string) {
	openVideoSections.value = openVideoSections.value.has(section) ? new Set() : new Set([section]);
}

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();
const { cropPanelRequested, clearCropPanelRequest } = useEditorUIState();

const trackRef = computed(() => editor.timeline.getTrackById({ trackId: props.trackId })!);
const { hasKeyframes: hasKf, addKeyframe, clearPropertyKeyframes } = useKeyframes({
	trackRef,
	elementRef: toRef(props, 'element'),
});

// --- Local input refs synced with element props ---
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const volumeInput = ref(Math.round((props.element.volume ?? 1) * 100).toString());
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(props.element.transform.position.x.toString());
const posYInput = ref(props.element.transform.position.y.toString());
const rotateInput = ref(props.element.transform.rotate.toString());

watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.volume, (v) => { volumeInput.value = Math.round((v ?? 1) * 100).toString(); });
watch(() => props.element.transform.scale, (v) => { scaleInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.position.x, (v) => { posXInput.value = v.toString(); });
watch(() => props.element.transform.position.y, (v) => { posYInput.value = v.toString(); });
watch(() => props.element.transform.rotate, (v) => { rotateInput.value = v.toString(); });

const volumePercent = computed(() => `${Math.round((props.element.volume ?? 1) * 100)}%`);

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

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

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

function handleFadeInSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value) / 10;
	fadeInInput.value = (val * 10).toFixed(0);
	update({ fadeIn: val > 0.01 ? val : undefined });
}
function handleFadeOutSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value) / 10;
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
function handleOpacitySlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
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

// --- Volume ---
function handleVolumeSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	volumeInput.value = val.toString();
	update({ volume: val / 100 });
}
function handleVolumeInput(value: string) {
	volumeInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) update({ volume: clamp(parsed, 0, 200) / 100 });
}
function handleVolumeBlur() {
	const parsed = parseInt(volumeInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round((props.element.volume ?? 1) * 100) : clamp(parsed, 0, 200);
	volumeInput.value = pct.toString();
	update({ volume: pct / 100 });
}

// --- Scale ---
function handleScaleSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	scaleInput.value = val.toString();
	updateTransform({ scale: val / 100 });
}
function handleScaleInput(value: string) {
	scaleInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) updateTransform({ scale: clamp(parsed, 10, 500) / 100 });
}
function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.transform.scale * 100) : clamp(parsed, 10, 500);
	scaleInput.value = pct.toString();
	updateTransform({ scale: pct / 100 });
}

// --- Position ---
function handlePosX(value: string) {
	posXInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) updateTransform({ position: { x: parsed, y: props.element.transform.position.y } });
}
function handlePosY(value: string) {
	posYInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) updateTransform({ position: { x: props.element.transform.position.x, y: parsed } });
}

// --- Rotation ---
function handleRotateSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	rotateInput.value = val.toString();
	updateTransform({ rotate: val });
}
function handleRotateInput(value: string) {
	rotateInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) updateTransform({ rotate: clamp(parsed, -360, 360) });
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

function formatTime(seconds: number): string {
	const min = Math.floor(seconds / 60);
	const sec = (seconds % 60).toFixed(2);
	return `${min}:${sec.padStart(5, "0")}`;
}
</script>

<template>
	<div class="flex h-full min-h-0 flex-row">
		<!-- ══════ Content Area ══════ -->
		<div class="flex min-h-0 flex-1 min-w-0 flex-col overflow-hidden">
		<!-- One scroll region for the active tab + transition block -->
		<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
		<!-- ══════ Video Tab ══════ -->
		<template v-if="activeTab === 'video'">
			<div>
				<!-- ── Basic ── -->
				<button
					class="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-xs font-medium transition-colors"
					:class="openVideoSections.has('basic') ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
					@click="toggleVideoSection('basic')"
				>
					<span>Basic</span>
					<ChevronDown class="size-3.5 transition-transform duration-150" :class="{ 'rotate-180': openVideoSections.has('basic') }" />
				</button>
				<div v-if="openVideoSections.has('basic')" class="space-y-4 p-3">
					<!-- Transform -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium text-zinc-300">Transform</span>
							<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" @click="resetTransform">
								<RotateCcw class="size-3" />
								Reset
							</button>
						</div>

						<!-- Scale + Rotate grid -->
						<div class="grid grid-cols-2 gap-2">
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Scale</span>
								<input type="number" :value="scaleInput" min="10" max="500" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => handleScaleInput((e.target as HTMLInputElement).value)" @blur="handleScaleBlur" />
								<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">%</span>
							</div>
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Rotate</span>
								<input type="number" :value="rotateInput" min="-360" max="360" step="0.1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => handleRotateInput((e.target as HTMLInputElement).value)" />
								<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">°</span>
							</div>
						</div>

						<!-- X + Y grid -->
						<div class="grid grid-cols-2 gap-2">
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">X</span>
								<input type="number" :value="posXInput" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => handlePosX((e.target as HTMLInputElement).value)" />
							</div>
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Y</span>
								<input type="number" :value="posYInput" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => handlePosY((e.target as HTMLInputElement).value)" />
							</div>
						</div>

						<!-- Flip buttons -->
						<div class="flex gap-2">
							<button
								:class="[
									'flex h-7 flex-1 items-center justify-center gap-1 rounded-sm border text-xs transition-colors',
									element.flip?.horizontal
										? 'border-primary/30 bg-primary/20 text-primary'
										: 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
								]"
								@click="update({ flip: { horizontal: !(element.flip?.horizontal ?? false), vertical: element.flip?.vertical ?? false } })"
							>
								<FlipHorizontal class="size-3.5" />
								Flip H
							</button>
							<button
								:class="[
									'flex h-7 flex-1 items-center justify-center gap-1 rounded-sm border text-xs transition-colors',
									element.flip?.vertical
										? 'border-primary/30 bg-primary/20 text-primary'
										: 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
								]"
								@click="update({ flip: { horizontal: element.flip?.horizontal ?? false, vertical: !(element.flip?.vertical ?? false) } })"
							>
								<FlipVertical class="size-3.5" />
								Flip V
							</button>
						</div>
					</div>

					<!-- Opacity -->
					<div class="space-y-1.5 border-t border-white/[0.05] pt-4">
						<div class="flex items-center justify-between">
							<label class="shrink-0 text-[11px] text-zinc-500">Opacity</label>
							<KeyframeToggle :active="hasKf('opacity')" label="opacity" @toggle="toggleOpacityKeyframe" />
						</div>
						<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="w-full" @input="handleOpacitySlider" />
					</div>

				<!-- Blend Mode -->
				<div class="space-y-1.5 border-t border-white/[0.05] pt-4">
					<label class="text-[11px] text-zinc-500">Blend Mode</label>
					<select
						:value="element.blendMode ?? 'normal'"
						class="w-full rounded-sm border border-white/10 bg-[#1a1a1e] px-2 py-1.5 text-xs text-zinc-200 outline-none"
						@change="(e) => update({ blendMode: (e.target as HTMLSelectElement).value === 'normal' ? undefined : (e.target as HTMLSelectElement).value })"
					>
						<option value="normal">Normal</option>
						<option value="multiply">Multiply</option>
						<option value="screen">Screen</option>
						<option value="overlay">Overlay</option>
						<option value="soft-light">Soft Light</option>
						<option value="hard-light">Hard Light</option>
						<option value="darken">Darken</option>
						<option value="lighten">Lighten</option>
						<option value="color-dodge">Color Dodge</option>
						<option value="color-burn">Color Burn</option>
						<option value="difference">Difference</option>
						<option value="exclusion">Exclusion</option>
					</select>
				</div>

				<!-- Fade In / Out -->
				<div class="space-y-2 border-t border-white/[0.05] pt-4">
					<label class="text-[11px] text-zinc-500">Fade</label>
					<div class="flex items-center gap-3">
						<div class="flex flex-1 flex-col gap-1">
							<span class="text-[10px] text-zinc-500">In</span>
							<input type="range" :value="(element.fadeIn ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="handleFadeInSlider" />
						</div>
						<div class="flex flex-1 flex-col gap-1">
							<span class="text-[10px] text-zinc-500">Out</span>
							<input type="range" :value="(element.fadeOut ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="handleFadeOutSlider" />
						</div>
					</div>
				</div>

			</div>

				<!-- ── Crop ── -->
				<button
					class="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-xs font-medium transition-colors"
					:class="[openVideoSections.has('crop') ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300', openVideoSections.has('basic') ? 'border-t' : '']"
					@click="toggleVideoSection('crop')"
				>
					<span>Crop</span>
					<ChevronDown class="size-3.5 transition-transform duration-150" :class="{ 'rotate-180': openVideoSections.has('crop') }" />
				</button>
				<div v-if="openVideoSections.has('crop')" class="space-y-3 p-3">
					<!-- Aspect ratio presets -->
					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<label class="text-[11px] text-zinc-500">Aspect Ratio</label>
							<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" @click="resetCrop">
								<RotateCcw class="size-3" />
								Reset
							</button>
						</div>
						<div class="grid grid-cols-4 gap-1">
							<button
								v-for="preset in cropPresets"
								:key="preset.label"
								:disabled="preset.label === nativePresetLabel"
								:class="[
									'rounded px-1.5 py-1 text-[11px] font-medium transition-colors text-center',
									preset.label === nativePresetLabel
										? 'border border-white/5 bg-white/[0.02] text-zinc-700 cursor-not-allowed'
										: activeCropPresetLabel === preset.label || (preset.label === 'Free' && activeCropPresetLabel === 'None')
											? 'bg-primary/20 text-primary border border-primary/30'
											: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200',
								]"
								@click="applyCropPreset(preset)"
							>
								{{ preset.label }}
							</button>
						</div>
					</div>

					<!-- Crop values 2x2 grid -->
					<div class="space-y-2">
						<div class="grid grid-cols-2 gap-2">
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Top</span>
								<input type="number" :value="Math.round(cropVal.top * 100)" min="0" max="45" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => updateCrop({ top: Number((e.target as HTMLInputElement).value) / 100 })" />
								<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">%</span>
							</div>
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Bottom</span>
								<input type="number" :value="Math.round(cropVal.bottom * 100)" min="0" max="45" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => updateCrop({ bottom: Number((e.target as HTMLInputElement).value) / 100 })" />
								<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">%</span>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Left</span>
								<input type="number" :value="Math.round(cropVal.left * 100)" min="0" max="45" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => updateCrop({ left: Number((e.target as HTMLInputElement).value) / 100 })" />
								<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">%</span>
							</div>
							<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<span class="mr-1 shrink-0 select-none text-[10px] text-zinc-500">Right</span>
								<input type="number" :value="Math.round(cropVal.right * 100)" min="0" max="45" step="1" class="w-full bg-transparent text-right text-xs text-zinc-200 outline-none" @input="(e) => updateCrop({ right: Number((e.target as HTMLInputElement).value) / 100 })" />
								<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">%</span>
							</div>
						</div>
					</div>
				</div>

				<!-- ── Effects ── -->
				<button
					class="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-xs font-medium transition-colors"
					:class="[openVideoSections.has('effects') ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300', openVideoSections.has('crop') ? 'border-t' : '']"
					@click="toggleVideoSection('effects')"
				>
					<span>Effects</span>
					<ChevronDown class="size-3.5 transition-transform duration-150" :class="{ 'rotate-180': openVideoSections.has('effects') }" />
				</button>
				<div v-if="openVideoSections.has('effects')" class="space-y-3 p-3">
					<div v-if="effects.length === 0" class="rounded-md border border-dashed border-white/10 px-3 py-6 text-center">
						<Wand2 class="mx-auto mb-1.5 size-5 text-zinc-600" />
						<p class="text-[11px] text-zinc-600">No effects applied</p>
						<p class="mt-0.5 text-[10px] text-zinc-700">Add effects from the Effects panel</p>
					</div>

					<div v-for="effect in effects" :key="effect.id" class="rounded-md border border-white/5 bg-white/[0.02]">
						<div class="flex items-center justify-between px-2.5 py-1.5">
							<span class="text-xs font-medium" :class="effect.enabled ? 'text-zinc-300' : 'text-zinc-600'">{{ getEffectLabel(effect.type) }}</span>
							<div class="flex items-center gap-1">
								<button class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-300" @click="toggleEffect(effect.id)">
									<component :is="effect.enabled ? Eye : EyeOff" class="size-3" />
								</button>
								<button class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400" @click="removeEffect(effect.id)">
									<X class="size-3" />
								</button>
							</div>
						</div>

						<div v-if="effect.enabled" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Intensity</span>
								<input type="range" :value="effect.intensity" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'intensity', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="effect.intensity" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'intensity', Number((e.target as HTMLInputElement).value))" />
							</div>

							<!-- Blur -->
							<template v-if="effect.type === 'blur'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Radius</span>
									<input type="range" :value="(effect as any).radius" min="1" max="50" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).radius" min="1" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Pixelate -->
							<template v-if="effect.type === 'pixelate'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Block</span>
									<input type="range" :value="(effect as any).blockSize" min="2" max="64" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'blockSize', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).blockSize" min="2" max="64" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'blockSize', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Sharpen -->
							<template v-if="effect.type === 'sharpen'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
									<input type="range" :value="(effect as any).amount" min="0" max="10" step="0.5" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).amount" min="0" max="10" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Vignette -->
							<template v-if="effect.type === 'vignette'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Radius</span>
									<input type="range" :value="(effect as any).radius" min="0" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).radius" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Softness</span>
									<input type="range" :value="(effect as any).softness" min="0" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'softness', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).softness" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'softness', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- ColorShift -->
							<template v-if="effect.type === 'colorShift'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-red-400">Red X</span>
									<input type="range" :value="(effect as any).redOffsetX" min="-20" max="20" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'redOffsetX', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).redOffsetX" min="-20" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'redOffsetX', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-blue-400">Blue X</span>
									<input type="range" :value="(effect as any).blueOffsetX" min="-20" max="20" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'blueOffsetX', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).blueOffsetX" min="-20" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'blueOffsetX', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Glitch -->
							<template v-if="effect.type === 'glitch'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Slices</span>
									<input type="range" :value="(effect as any).sliceCount" min="2" max="20" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'sliceCount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).sliceCount" min="2" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'sliceCount', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Offset</span>
									<input type="range" :value="(effect as any).maxOffset" min="0" max="50" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'maxOffset', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).maxOffset" min="0" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'maxOffset', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Bleed</span>
									<input type="range" :value="(effect as any).colorBleed" min="0" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).colorBleed" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Wave -->
							<template v-if="effect.type === 'wave'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amp</span>
									<input type="range" :value="(effect as any).amplitude" min="1" max="50" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'amplitude', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).amplitude" min="1" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'amplitude', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Freq</span>
									<input type="range" :value="(effect as any).frequency" min="0.5" max="10" step="0.5" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).frequency" min="0.5" max="10" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
									<input type="range" :value="(effect as any).speed" min="0" max="10" step="0.5" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).speed" min="0" max="10" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- ZoomPulse -->
							<template v-if="effect.type === 'zoomPulse'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
									<input type="range" :value="(effect as any).amount" min="1" max="50" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).amount" min="1" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
									<input type="range" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Flash -->
							<template v-if="effect.type === 'flash'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Color</span>
									<div class="relative">
										<input type="color" :value="(effect as any).color" class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
											@input="(e) => updateEffectParam(effect.id, 'color', (e.target as HTMLInputElement).value)" />
										<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: (effect as any).color }" />
									</div>
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
									<input type="range" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Noise -->
							<template v-if="effect.type === 'noise'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
									<input type="range" :value="(effect as any).amount" min="0" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).amount" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- VHS -->
							<template v-if="effect.type === 'vhs'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Scanline</span>
									<input type="range" :value="(effect as any).scanlineOpacity" min="0" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'scanlineOpacity', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).scanlineOpacity" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'scanlineOpacity', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Bleed</span>
									<input type="range" :value="(effect as any).colorBleed" min="0" max="50" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).colorBleed" min="0" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Noise</span>
									<input type="range" :value="(effect as any).noiseAmount" min="0" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'noiseAmount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).noiseAmount" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'noiseAmount', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Motion Blur -->
							<template v-if="effect.type === 'motionBlur'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Angle</span>
									<input type="range" :value="(effect as any).angle" min="0" max="360" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'angle', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).angle" min="0" max="360" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'angle', Number((e.target as HTMLInputElement).value))" />
								</div>
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Dist</span>
									<input type="range" :value="(effect as any).distance" min="1" max="30" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'distance', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).distance" min="1" max="30" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'distance', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Radial Blur -->
							<template v-if="effect.type === 'radialBlur'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
									<input type="range" :value="(effect as any).amount" min="1" max="20" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).amount" min="1" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Hue Shift -->
							<template v-if="effect.type === 'hueShift'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
									<input type="range" :value="(effect as any).speed" min="0.1" max="5" step="0.1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).speed" min="0.1" max="5" step="0.1" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Halftone -->
							<template v-if="effect.type === 'colorHalftone'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Dot Size</span>
									<input type="range" :value="(effect as any).dotSize" min="2" max="20" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'dotSize', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).dotSize" min="2" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'dotSize', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Lens Distortion -->
							<template v-if="effect.type === 'lensDistortion'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
									<input type="range" :value="(effect as any).amount" min="-100" max="100" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).amount" min="-100" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>

							<!-- Posterize -->
							<template v-if="effect.type === 'posterize'">
								<div class="flex items-center gap-2">
									<span class="w-14 shrink-0 text-[10px] text-zinc-500">Levels</span>
									<input type="range" :value="(effect as any).levels" min="2" max="16" step="1" class="flex-1"
										@input="(e) => updateEffectParam(effect.id, 'levels', Number((e.target as HTMLInputElement).value))" />
									<input type="number" :value="(effect as any).levels" min="2" max="16" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
										@input="(e) => updateEffectParam(effect.id, 'levels', Number((e.target as HTMLInputElement).value))" />
								</div>
							</template>
						</div>
					</div>
				</div>

				<!-- ── Chroma Key ── -->
				<button
					class="flex w-full items-center justify-between border-b border-white/10 px-3 py-2 text-xs font-medium transition-colors"
					:class="[openVideoSections.has('chromakey') ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300', openVideoSections.has('effects') ? 'border-t' : '']"
					@click="toggleVideoSection('chromakey')"
				>
					<span>Chroma Key</span>
					<ChevronDown class="size-3.5 transition-transform duration-150" :class="{ 'rotate-180': openVideoSections.has('chromakey') }" />
				</button>
				<div v-if="openVideoSections.has('chromakey')" class="space-y-3 p-3">
					<!-- Enabled -->
					<div class="flex items-center justify-between">
						<span class="text-[11px] text-zinc-500">Enabled</span>
						<Switch :model-value="chromakey.enabled" @update:model-value="(val: boolean) => updateChromakey({ enabled: val })" />
					</div>

					<template v-if="chromakey.enabled">
						<div class="flex items-center justify-end">
							<button
								class="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
								@click="resetChromakey"
							>
								Reset
							</button>
						</div>

						<!-- Color picker -->
						<div class="flex h-7 items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-2">
							<span class="shrink-0 select-none text-[10px] text-zinc-500">Color</span>
							<div class="relative ml-1 shrink-0">
								<input type="color" :value="chromakey.color" class="absolute inset-0 h-4 w-4 cursor-pointer opacity-0" @input="(e) => updateChromakey({ color: (e.target as HTMLInputElement).value })" />
								<div class="size-4 rounded-sm border border-white/20" :style="{ backgroundColor: chromakey.color }" />
							</div>
							<span class="flex-1 text-right font-mono text-xs text-zinc-300">{{ chromakey.color }}</span>
						</div>

						<!-- Sliders -->
						<div v-for="param in ([
							{ key: 'similarity' as const, label: 'Similarity' },
							{ key: 'smoothness' as const, label: 'Smoothness' },
							{ key: 'spillReduction' as const, label: 'Spill Reduction' },
						])" :key="param.key" class="space-y-1">
							<div class="flex items-center justify-between">
								<label class="text-[11px] text-zinc-500">{{ param.label }}</label>
								<span class="text-[10px] text-zinc-500">{{ chromakey[param.key] }}</span>
							</div>
							<input type="range" :value="chromakey[param.key]" min="0" max="100" step="1" class="w-full"
								@input="(e) => updateChromakey({ [param.key]: Number((e.target as HTMLInputElement).value) })" />
						</div>
					</template>
				</div>
			</div>
		</template>

		<!-- ══════ Audio Tab ══════ -->
		<div v-else-if="activeTab === 'audio'" class="p-3">
			<div class="flex items-center border-b border-white/10 -mx-3 -mt-3 mb-4 px-3 py-1.5">
				<span class="text-sm text-zinc-400">Audio</span>
			</div>
			<div class="space-y-4">
				<!-- Volume -->
				<div class="space-y-2">
					<span class="text-xs font-medium text-zinc-300">Volume</span>
					<div class="flex items-center gap-2">
						<input type="range" :value="(element.volume ?? 1) * 100" min="0" max="200" step="1" class="flex-1" @input="handleVolumeSlider" />
						<div class="flex h-7 w-16 items-center rounded-sm border border-white/10 bg-white/5 px-2">
							<input type="number" :value="volumeInput" min="0" max="200" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handleVolumeInput((e.target as HTMLInputElement).value)" @blur="handleVolumeBlur" />
							<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">%</span>
						</div>
					</div>
				</div>

				<!-- Pan -->
				<div class="space-y-2 border-t border-white/[0.05] pt-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-zinc-300">Pan</span>
						<div class="flex items-center gap-1.5">
							<span class="text-[10px] text-zinc-600">L</span>
							<span class="min-w-[28px] text-center text-[10px] text-zinc-400">
								{{ (element.pan ?? 0) === 0 ? 'C' : (element.pan ?? 0) > 0 ? `R${Math.round(Math.abs(element.pan ?? 0) * 100)}` : `L${Math.round(Math.abs(element.pan ?? 0) * 100)}` }}
							</span>
							<span class="text-[10px] text-zinc-600">R</span>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<input
							type="range"
							:value="(element.pan ?? 0) * 100"
							min="-100"
							max="100"
							step="1"
							class="flex-1"
							@input="(e) => update({ pan: Number((e.target as HTMLInputElement).value) / 100 })"
						/>
						<button
							class="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:text-zinc-200"
							@click="update({ pan: 0 })"
						>
							C
						</button>
					</div>
				</div>

				<!-- Mute -->
				<div class="flex items-center justify-between border-t border-white/[0.05] pt-4">
					<span class="text-[11px] text-zinc-500">Mute</span>
					<Switch :model-value="!!element.muted" @update:model-value="(val: boolean) => update({ muted: val })" />
				</div>
			</div>
		</div>

		<!-- ══════ Speed Tab ══════ -->
		<div v-else-if="activeTab === 'speed'" class="p-3">
			<div class="flex items-center justify-between border-b border-white/10 -mx-3 -mt-3 mb-4 px-3 py-1.5">
				<span class="text-sm text-zinc-400">Speed</span>
				<KeyframeToggle :active="hasKf('speed')" label="speed" @toggle="toggleSpeedKeyframe" />
			</div>
			<div class="flex items-center gap-2">
				<input
					type="range"
					:value="currentSpeed * 10"
					min="1"
					max="100"
					step="1"
					class="flex-1"
					@pointerdown="onSpeedPointerDown"
					@pointerup="onSpeedPointerUp"
					@input="(e) => changeSpeed(Number((e.target as HTMLInputElement).value) / 10)"
				/>
				<div class="flex h-7 w-[72px] items-center rounded-sm border border-white/10 bg-white/5 px-2">
					<input
						type="text"
						:value="speedInput"
						class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none"
						@input="(e) => handleSpeedInput((e.target as HTMLInputElement).value)"
						@blur="handleSpeedBlur"
						@keydown.enter="($event.target as HTMLInputElement).blur()"
					/>
					<span class="ml-0.5 shrink-0 text-[10px] text-zinc-500">x</span>
				</div>
			</div>
		</div>

		<!-- ══════ Animate Tab ══════ -->
		<div v-else-if="activeTab === 'animate'" class="flex flex-col">
			<div class="flex shrink-0 items-center border-b border-white/10 px-3 py-1.5">
				<span class="text-sm text-zinc-400">Animate</span>
			</div>
			<div class="p-3">
				<AnimationProperties
					:element-id="element.id"
					:track-id="trackId"
					:animation-in="element.animationIn"
					:animation-out="element.animationOut"
					:animation-loop="element.animationLoop"
					:element-duration="element.duration"
				/>
			</div>
		</div>

		<!-- ══════ Masks Tab ══════ -->
		<div v-else-if="activeTab === 'masks'">
			<div class="flex shrink-0 items-center border-b border-white/10 px-3 py-1.5">
				<span class="text-sm text-zinc-400">Masks</span>
			</div>
			<MasksPanel :element="element" :track-id="trackId" />
		</div>

		<!-- ══════ Adjust Tab ══════ -->
		<div v-else-if="activeTab === 'adjust'" class="p-3">
			<div class="flex items-center border-b border-white/10 -mx-3 -mt-3 mb-4 px-3 py-1.5">
				<span class="text-sm text-zinc-400">Adjust</span>
			</div>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-zinc-300">Color</span>
					<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" @click="resetColor">
						<RotateCcw class="size-3" />
						<span>Reset</span>
					</button>
				</div>

				<div class="space-y-2">
					<div v-for="prop in (['brightness', 'contrast', 'saturation', 'temperature', 'highlights', 'shadows', 'exposure'] as const)" :key="prop" class="space-y-1.5">
						<label class="text-[11px] capitalize text-zinc-500">{{ prop }}</label>
						<div class="flex items-center gap-2">
							<input type="range" :value="ca[prop]" min="-100" max="100" step="1" class="flex-1" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
							<div class="flex h-7 w-12 items-center rounded-sm border border-white/10 bg-white/5 px-1">
								<input type="number" :value="ca[prop]" min="-100" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-2 border-t border-white/[0.05] pt-4">
					<div class="space-y-1.5">
						<label class="text-[11px] text-zinc-500">Fade</label>
						<div class="flex items-center gap-2">
							<input type="range" :value="ca.fade" min="0" max="100" step="1" class="flex-1" @input="(e) => updateColor({ fade: Number((e.target as HTMLInputElement).value) })" />
							<div class="flex h-7 w-12 items-center rounded-sm border border-white/10 bg-white/5 px-1">
								<input type="number" :value="ca.fade" min="0" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => updateColor({ fade: Number((e.target as HTMLInputElement).value) })" />
							</div>
						</div>
					</div>

					<div class="space-y-1.5">
						<label class="text-[11px] text-zinc-500">Sharpness</label>
						<div class="flex items-center gap-2">
							<input type="range" :value="ca.sharpness" min="0" max="100" step="1" class="flex-1" @input="(e) => updateColor({ sharpness: Number((e.target as HTMLInputElement).value) })" />
							<div class="flex h-7 w-12 items-center rounded-sm border border-white/10 bg-white/5 px-1">
								<input type="number" :value="ca.sharpness" min="0" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => updateColor({ sharpness: Number((e.target as HTMLInputElement).value) })" />
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-1.5 border-t border-white/[0.05] pt-4">
					<label class="text-[11px] text-zinc-500">Tint</label>
					<div class="flex items-center gap-2">
						<div class="relative">
							<input type="color" :value="ca.tint || '#000000'" class="absolute inset-0 h-7 w-7 cursor-pointer opacity-0"
								@input="(e) => updateColor({ tint: (e.target as HTMLInputElement).value })" />
							<div class="flex h-7 w-7 items-center justify-center rounded-sm border border-white/10" :style="{ backgroundColor: ca.tint || 'transparent' }" />
						</div>
						<span class="text-[11px] text-zinc-400">{{ ca.tint || 'None' }}</span>
						<button v-if="ca.tint" class="ml-auto flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200" @click="updateColor({ tint: '' })">Clear</button>
					</div>
				</div>
			</div>
		</div>

		<!-- ══════ Color Grading Tab ══════ -->
		<div v-else-if="activeTab === 'grading'" class="space-y-5 p-3">
			<!-- RGB Curves -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-zinc-300">RGB Curves</span>
				</div>
				<ColorCurvesPanel
					:curves="element.colorCurves ?? {}"
					@update="updateColorCurves"
				/>
			</div>

			<!-- Color Wheels -->
			<div class="space-y-2 border-t border-white/[0.05] pt-4">
				<span class="text-xs font-medium text-zinc-300">Color Wheels</span>
				<ColorWheelsPanel
					:wheels="element.colorWheels ?? {}"
					@update="updateColorWheels"
				/>
			</div>

			<!-- LUT -->
			<div class="border-t border-white/[0.05] pt-4">
				<LutPanel
					:lut-path="element.lutPath"
					@update="updateLutPath"
				/>
			</div>
		</div>

		</div>
		</div>

		<!-- ══════ Right Tab Strip ══════ -->
		<div class="flex w-10 shrink-0 flex-col items-center gap-2 border-l border-white/10 bg-[#0e0e10] py-3 overflow-y-auto scrollbar-hidden">
			<button
				v-for="tab in topTabs"
				:key="tab.id"
				type="button"
				:title="tab.label"
				:class="[
					'flex flex-col items-center justify-center rounded-md p-1.5 transition-colors',
					activeTab === tab.id
						? 'text-blue-400'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeTab = tab.id"
			>
				<component :is="tab.icon" class="size-[15px]" />
			</button>
		</div>
	</div>
</template>
