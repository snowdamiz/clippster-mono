<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../../composables/useEditorUIState";
import type { VideoElement, ColorAdjustments, CropRect } from "../../../types/timeline";
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../../types/timeline";
import type { VideoEffect } from "../../../types/effects";
import { getEffectPreset } from "../../../constants/effect-constants";
import type { ChromakeySettings } from "../../../types/chromakey";
import { DEFAULT_CHROMAKEY } from "../../../types/chromakey";
import { Film, Trash2, RotateCcw, VolumeX, Volume2, FlipHorizontal, FlipVertical, Gauge, Wand2, Eye, EyeOff, X, ChevronDown, Crop, RectangleHorizontal, Square, RectangleVertical, Pipette } from "lucide-vue-next";
import { useKeyframes } from "../../../composables/useKeyframes";
import { toRef } from "vue";
import KeyframeToggle from "./KeyframeToggle.vue";
import AnimationProperties from "./AnimationProperties.vue";
import TransitionProperties from "./TransitionProperties.vue";
import type { Transition } from "../../../types/transitions";

const props = defineProps<{
	element: VideoElement;
	trackId: string;
}>();

const activeTransition = computed<Transition | null>(() => {
	void version.value;
	try {
		const scene = editor.scenes.getActiveScene();
		if (!scene?.transitions) return null;
		return scene.transitions.find((t) => t.targetElementId === props.element.id) ?? null;
	} catch {
		return null;
	}
});

type TopTab = 'video' | 'audio' | 'speed' | 'adjust' | 'animate';
type VideoSubTab = 'basic' | 'crop' | 'effects' | 'chromakey';
const activeTab = ref<TopTab>('video');
const activeVideoSub = ref<VideoSubTab>('basic');

const topTabs: { id: TopTab; label: string }[] = [
	{ id: 'video', label: 'Video' },
	{ id: 'audio', label: 'Audio' },
	{ id: 'speed', label: 'Speed' },
	{ id: 'adjust', label: 'Adjust' },
	{ id: 'animate', label: 'Animate' },
];
const videoSubTabs: { id: VideoSubTab; label: string }[] = [
	{ id: 'basic', label: 'Basic' },
	{ id: 'crop', label: 'Crop' },
	{ id: 'effects', label: 'Effects' },
	{ id: 'chromakey', label: 'Chroma Key' },
];

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

watch(() => props.element.speed, (v) => { speedInput.value = (v ?? 1).toFixed(2); });

function changeSpeed(speed: number) {
	const clamped = Math.round(Math.max(0.1, Math.min(10, speed)) * 10) / 10;
	speedInput.value = clamped.toFixed(2);
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed: clamped,
	});
}

function handleSpeedInput(value: string) {
	speedInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed) && parsed >= 0.1 && parsed <= 10) {
		editor.timeline.changeElementSpeed({
			trackId: props.trackId,
			elementId: props.element.id,
			speed: Math.round(parsed * 10) / 10,
		});
	}
}

function handleSpeedBlur() {
	const parsed = parseFloat(speedInput.value);
	const val = Number.isNaN(parsed) ? (props.element.speed ?? 1) : Math.max(0.1, Math.min(10, parsed));
	const clamped = Math.round(val * 10) / 10;
	speedInput.value = clamped.toFixed(2);
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed: clamped,
	});
}

const ca = computed(() => ({ ...DEFAULT_COLOR_ADJUSTMENTS, ...props.element.colorAdjustments }));

// --- Crop ---
const cropDefaults: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };
const cropVal = computed(() => props.element.crop ?? cropDefaults);
const showCrop = ref(cropVal.value.top > 0 || cropVal.value.right > 0 || cropVal.value.bottom > 0 || cropVal.value.left > 0);

// Watch for toolbar crop button request
watch(cropPanelRequested, (requested) => {
	if (requested) {
		showCrop.value = true;
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
	if (c.top > 0 || c.right > 0 || c.bottom > 0 || c.left > 0) showCrop.value = true;
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
	<div class="flex h-full flex-col">
		<!-- ══════ Top Tabs ══════ -->
		<div class="flex border-b border-white/10">
			<button
				v-for="tab in topTabs"
				:key="tab.id"
				:class="[
					'flex-1 py-2 text-center text-xs font-medium transition-colors',
					activeTab === tab.id
						? 'text-primary border-b-2 border-primary'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeTab = tab.id"
			>
				{{ tab.label }}
			</button>
		</div>

		<!-- ══════ Video Tab ══════ -->
		<template v-if="activeTab === 'video'">
			<!-- Sub-tabs -->
			<div class="flex gap-1 border-b border-white/5 px-3 py-1.5">
				<button
					v-for="sub in videoSubTabs"
					:key="sub.id"
					:class="[
						'rounded-md px-3 py-1 text-xs font-medium transition-colors',
						activeVideoSub === sub.id
							? 'bg-white/10 text-zinc-200'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
					]"
					@click="activeVideoSub = sub.id"
				>
					{{ sub.label }}
				</button>
			</div>

			<div class="flex-1 overflow-y-auto">
				<!-- ── Basic sub-tab ── -->
				<div v-if="activeVideoSub === 'basic'" class="space-y-4 p-3">
					<!-- Transform -->
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium text-zinc-300">Transform</span>
							<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" @click="resetTransform">
								<RotateCcw class="size-3" />
							</button>
						</div>

						<!-- Scale -->
						<div class="space-y-1">
							<label class="text-[11px] text-zinc-500">Scale</label>
							<div class="flex items-center gap-2">
								<input type="range" :value="element.transform.scale * 100" min="10" max="500" step="1" class="flex-1" @input="handleScaleSlider" />
								<div class="flex h-7 w-16 items-center rounded-sm border border-white/10 bg-white/5 px-2">
									<input type="number" :value="scaleInput" min="10" max="500" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handleScaleInput((e.target as HTMLInputElement).value)" @blur="handleScaleBlur" />
									<span class="text-[10px] text-zinc-500">%</span>
								</div>
							</div>
						</div>

						<!-- Position -->
						<div class="space-y-1">
							<label class="text-[11px] text-zinc-500">Position</label>
							<div class="grid grid-cols-2 gap-2">
								<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
									<span class="text-[10px] text-zinc-500">X</span>
									<input type="number" :value="posXInput" step="1" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handlePosX((e.target as HTMLInputElement).value)" />
								</div>
								<div class="flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2">
									<span class="text-[10px] text-zinc-500">Y</span>
									<input type="number" :value="posYInput" step="1" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handlePosY((e.target as HTMLInputElement).value)" />
								</div>
							</div>
						</div>

						<!-- Rotation -->
						<div class="space-y-1">
							<label class="text-[11px] text-zinc-500">Rotate</label>
							<div class="flex items-center gap-2">
								<input type="range" :value="element.transform.rotate" min="-360" max="360" step="1" class="flex-1" @input="handleRotateSlider" />
								<div class="flex h-7 w-16 items-center rounded-sm border border-white/10 bg-white/5 px-2">
									<input type="number" :value="rotateInput" min="-360" max="360" step="0.1" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handleRotateInput((e.target as HTMLInputElement).value)" />
									<span class="text-[10px] text-zinc-500">°</span>
								</div>
							</div>
						</div>

						<!-- Flip buttons -->
						<div class="flex gap-1.5">
							<button
								v-for="(dir, idx) in [
									{ icon: FlipHorizontal, label: 'H', key: 'horizontal' as const },
									{ icon: FlipVertical, label: 'V', key: 'vertical' as const },
								]"
								:key="idx"
								:class="[
									'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
									element.flip?.[dir.key]
										? 'bg-primary/20 text-primary border border-primary/30'
										: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
								]"
								:title="'Flip ' + dir.label"
								@click="update({ flip: { horizontal: dir.key === 'horizontal' ? !(element.flip?.horizontal ?? false) : (element.flip?.horizontal ?? false), vertical: dir.key === 'vertical' ? !(element.flip?.vertical ?? false) : (element.flip?.vertical ?? false) } })"
							>
								<component :is="dir.icon" class="size-4" />
							</button>
						</div>
					</div>

					<!-- Opacity -->
					<div class="space-y-1 border-t border-white/10 pt-4">
						<div class="flex items-center justify-between">
							<label class="text-[11px] text-zinc-500">Opacity</label>
							<KeyframeToggle :active="hasKf('opacity')" label="opacity" @toggle="toggleOpacityKeyframe" />
						</div>
						<div class="flex items-center gap-2">
							<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="flex-1" @input="handleOpacitySlider" />
							<div class="flex h-7 w-16 items-center rounded-sm border border-white/10 bg-white/5 px-2">
								<input type="number" :value="opacityInput" min="0" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handleOpacityInput((e.target as HTMLInputElement).value)" @blur="handleOpacityBlur" />
								<span class="text-[10px] text-zinc-500">%</span>
							</div>
						</div>
					</div>

					<!-- Fade In / Out -->
					<div class="space-y-1 border-t border-white/10 pt-4">
						<label class="text-[11px] text-zinc-500">Fade</label>
						<div class="flex items-center gap-3">
							<div class="flex flex-1 flex-col gap-1">
								<span class="text-[9px] text-zinc-600">In</span>
								<input type="range" :value="(element.fadeIn ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="handleFadeInSlider" />
								<span class="text-[9px] text-zinc-500">{{ ((element.fadeIn ?? 0)).toFixed(1) }}s</span>
							</div>
							<div class="flex flex-1 flex-col gap-1">
								<span class="text-[9px] text-zinc-600">Out</span>
								<input type="range" :value="(element.fadeOut ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="handleFadeOutSlider" />
								<span class="text-[9px] text-zinc-500">{{ ((element.fadeOut ?? 0)).toFixed(1) }}s</span>
							</div>
						</div>
					</div>

					<!-- Visibility -->
					<div class="flex items-center justify-between border-t border-white/10 pt-4">
						<span class="text-[11px] text-zinc-500">Visible</span>
						<button
							:class="[
								'relative h-5 w-9 rounded-full transition-colors',
								!element.hidden ? 'bg-primary' : 'bg-zinc-700',
							]"
							@click="update({ hidden: !element.hidden })"
						>
							<span :class="['absolute top-0.5 size-4 rounded-full bg-white transition-transform', !element.hidden ? 'left-[18px]' : 'left-0.5']" />
						</button>
					</div>

					<!-- Info -->
					<div class="flex gap-3 border-t border-white/10 pt-4 text-[10px] text-zinc-600">
						<span>{{ formatTime(element.startTime) }} – {{ formatTime(element.startTime + element.duration) }}</span>
						<span>{{ formatTime(element.duration) }}</span>
					</div>

					<!-- Delete -->
					<div class="border-t border-white/10 pt-4 mt-2">
						<button
							class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
							@click="handleDelete"
						>
							<Trash2 class="size-3.5" />
							Delete
						</button>
					</div>
				</div>

				<!-- ── Crop sub-tab ── -->
				<div v-else-if="activeVideoSub === 'crop'" class="space-y-4 p-3">
					<!-- Aspect ratio presets -->
					<div class="space-y-1.5">
						<label class="text-[11px] text-zinc-500">Aspect Ratio</label>
						<div class="flex flex-wrap gap-1">
							<button
								v-for="preset in cropPresets"
								:key="preset.label"
								:class="[
									'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
									activeCropPresetLabel === preset.label || (preset.label === 'Free' && activeCropPresetLabel === 'None')
										? 'bg-primary/20 text-primary border border-primary/30'
										: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200',
								]"
								@click="applyCropPreset(preset)"
							>
								{{ preset.label }}
							</button>
						</div>
					</div>

					<!-- Crop sliders -->
					<div v-for="side in (['top', 'bottom', 'left', 'right'] as const)" :key="side" class="space-y-1">
						<label class="text-[11px] capitalize text-zinc-500">{{ side }}</label>
						<div class="flex items-center gap-2">
							<input type="range" :value="cropVal[side] * 100" min="0" max="45" step="1" class="flex-1" @input="(e) => updateCrop({ [side]: Number((e.target as HTMLInputElement).value) / 100 })" />
							<input type="number" :value="Math.round(cropVal[side] * 100)" min="0" max="45" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateCrop({ [side]: Number((e.target as HTMLInputElement).value) / 100 })" />
						</div>
					</div>

					<!-- Crop preview -->
					<div class="flex items-center justify-center">
						<div class="relative h-20 w-32 rounded border border-white/10 bg-white/5">
							<div
								class="absolute rounded border border-primary/50 bg-primary/10"
								:style="{
									top: `${cropVal.top * 100}%`,
									right: `${cropVal.right * 100}%`,
									bottom: `${cropVal.bottom * 100}%`,
									left: `${cropVal.left * 100}%`,
								}"
							/>
						</div>
					</div>

					<button
						class="flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
						@click="resetCrop"
					>
						<RotateCcw class="size-3" />
						Reset Crop
					</button>
				</div>

				<!-- ── Effects sub-tab ── -->
				<div v-else-if="activeVideoSub === 'effects'" class="space-y-3 p-3">
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

				<!-- ── Chroma Key sub-tab ── -->
				<div v-else-if="activeVideoSub === 'chromakey'" class="space-y-3 p-3">
					<div class="flex items-center justify-between">
						<span class="text-[11px] text-zinc-500">Enabled</span>
						<button
							:class="[
								'relative h-5 w-9 rounded-full transition-colors',
								chromakey.enabled ? 'bg-green-500' : 'bg-zinc-700',
							]"
							@click="updateChromakey({ enabled: !chromakey.enabled })"
						>
							<span :class="['absolute top-0.5 size-4 rounded-full bg-white transition-transform', chromakey.enabled ? 'left-[18px]' : 'left-0.5']" />
						</button>
					</div>

					<template v-if="chromakey.enabled">
						<div class="flex items-center gap-2">
							<span class="w-14 shrink-0 text-[10px] text-zinc-500">Color</span>
							<div class="relative">
								<input type="color" :value="chromakey.color" class="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
									@input="(e) => updateChromakey({ color: (e.target as HTMLInputElement).value })" />
								<div class="size-6 rounded border border-white/10" :style="{ backgroundColor: chromakey.color }" />
							</div>
							<span class="text-[10px] text-zinc-400">{{ chromakey.color }}</span>
						</div>

						<div v-for="param in ([
							{ key: 'similarity' as const, label: 'Similar' },
							{ key: 'smoothness' as const, label: 'Smooth' },
							{ key: 'spillReduction' as const, label: 'Spill' },
						])" :key="param.key" class="flex items-center gap-2">
							<span class="w-14 shrink-0 text-[10px] text-zinc-500">{{ param.label }}</span>
							<input type="range" :value="chromakey[param.key]" min="0" max="100" step="1" class="flex-1"
								@input="(e) => updateChromakey({ [param.key]: Number((e.target as HTMLInputElement).value) })" />
							<input type="number" :value="chromakey[param.key]" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateChromakey({ [param.key]: Number((e.target as HTMLInputElement).value) })" />
						</div>
					</template>
				</div>
			</div>
		</template>

		<!-- ══════ Audio Tab ══════ -->
		<div v-else-if="activeTab === 'audio'" class="flex-1 overflow-y-auto p-3">
			<div class="space-y-4">
				<!-- Volume -->
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Volume</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="(element.volume ?? 1) * 100" min="0" max="200" step="1" class="flex-1" @input="handleVolumeSlider" />
						<div class="flex h-7 w-16 items-center rounded-sm border border-white/10 bg-white/5 px-2">
							<input type="number" :value="volumeInput" min="0" max="200" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => handleVolumeInput((e.target as HTMLInputElement).value)" @blur="handleVolumeBlur" />
							<span class="text-[10px] text-zinc-500">%</span>
						</div>
					</div>
				</div>

				<!-- Mute -->
				<div class="flex items-center justify-between">
					<span class="text-[11px] text-zinc-500">Mute</span>
					<button
						:class="[
							'relative h-5 w-9 rounded-full transition-colors',
							element.muted ? 'bg-red-500' : 'bg-zinc-700',
						]"
						@click="update({ muted: !element.muted })"
					>
						<span :class="['absolute top-0.5 size-4 rounded-full bg-white transition-transform', element.muted ? 'left-[18px]' : 'left-0.5']" />
					</button>
				</div>
			</div>
		</div>

		<!-- ══════ Speed Tab ══════ -->
		<div v-else-if="activeTab === 'speed'" class="flex-1 overflow-y-auto p-3">
			<div class="space-y-2">
				<label class="text-[11px] text-zinc-500">Speed</label>
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						<input type="range" :value="currentSpeed * 10" min="1" max="100" step="1" class="w-full" @input="(e) => changeSpeed(Number((e.target as HTMLInputElement).value) / 10)" />
						<!-- Tick marks -->
						<div class="pointer-events-none absolute inset-x-0 top-1/2 flex h-0 items-center">
							<div
								v-for="tick in speedTicks"
								:key="tick"
								class="absolute h-[8px] w-px bg-white/25"
								:style="{ left: `${((tick * 10 - 1) / 99) * 100}%` }"
							/>
						</div>
					</div>
					<div class="flex h-7 w-[72px] items-center rounded-sm border border-white/10 bg-white/5">
						<input
							type="text"
							:value="speedInput"
							class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none"
							@input="(e) => handleSpeedInput((e.target as HTMLInputElement).value)"
							@blur="handleSpeedBlur"
							@keydown.enter="($event.target as HTMLInputElement).blur()"
						/>
						<span class="pr-1.5 text-[10px] text-zinc-500">x</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ══════ Animate Tab ══════ -->
		<div v-else-if="activeTab === 'animate'" class="flex-1 overflow-y-auto">
			<AnimationProperties
				:element-id="element.id"
				:track-id="trackId"
				:animation-in="element.animationIn"
				:animation-out="element.animationOut"
				:animation-loop="element.animationLoop"
				:element-duration="element.duration"
			/>
		</div>

		<!-- ══════ Adjust Tab ══════ -->
		<div v-else-if="activeTab === 'adjust'" class="flex-1 overflow-y-auto p-3">
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-zinc-300">Color</span>
					<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" @click="resetColor">
						<RotateCcw class="size-3" />
					</button>
				</div>

				<div v-for="prop in (['brightness', 'contrast', 'saturation', 'temperature', 'highlights', 'shadows', 'exposure'] as const)" :key="prop" class="space-y-0.5">
					<label class="text-[10px] capitalize text-zinc-500">{{ prop }}</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="ca[prop]" min="-100" max="100" step="1" class="flex-1" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
						<input type="number" :value="ca[prop]" min="-100" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
					</div>
				</div>

				<div class="space-y-0.5">
					<label class="text-[10px] text-zinc-500">Fade</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="ca.fade" min="0" max="100" step="1" class="flex-1" @input="(e) => updateColor({ fade: Number((e.target as HTMLInputElement).value) })" />
						<input type="number" :value="ca.fade" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateColor({ fade: Number((e.target as HTMLInputElement).value) })" />
					</div>
				</div>

				<div class="space-y-0.5">
					<label class="text-[10px] text-zinc-500">Sharpness</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="ca.sharpness" min="0" max="100" step="1" class="flex-1" @input="(e) => updateColor({ sharpness: Number((e.target as HTMLInputElement).value) })" />
						<input type="number" :value="ca.sharpness" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateColor({ sharpness: Number((e.target as HTMLInputElement).value) })" />
					</div>
				</div>

				<div class="space-y-0.5">
					<label class="text-[10px] text-zinc-500">Tint</label>
					<div class="flex items-center gap-2">
						<div class="relative">
							<input type="color" :value="ca.tint || '#000000'" class="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
								@input="(e) => updateColor({ tint: (e.target as HTMLInputElement).value })" />
							<div class="size-6 rounded border border-white/10" :style="{ backgroundColor: ca.tint || 'transparent' }" />
						</div>
						<span class="text-[10px] text-zinc-400">{{ ca.tint || 'None' }}</span>
						<button v-if="ca.tint" class="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300" @click="updateColor({ tint: '' })">Clear</button>
					</div>
				</div>
			</div>
		</div>

		<!-- ══════ Transition (shown at bottom if element has one) ══════ -->
		<div v-if="activeTransition" class="shrink-0 border-t border-white/10 p-3">
			<TransitionProperties :transition="activeTransition" />
		</div>
	</div>
</template>
