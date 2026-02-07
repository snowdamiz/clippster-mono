<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { useEditorUIState } from "../../../composables/useEditorUIState";
import type { VideoElement, ColorAdjustments, CropRect } from "../../../types/timeline";
import type { VideoEffect } from "../../../types/effects";
import { getEffectPreset } from "../../../constants/effect-constants";
import { Film, Trash2, RotateCcw, VolumeX, Volume2, FlipHorizontal, FlipVertical, Gauge, Wand2, Eye, EyeOff, X, ChevronDown, Crop, RectangleHorizontal, Square, RectangleVertical } from "lucide-vue-next";

const props = defineProps<{
	element: VideoElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { selectedElements } = useElementSelection();
const { cropPanelRequested, clearCropPanelRequest } = useEditorUIState();

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

const speedPresets = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
const currentSpeed = computed(() => props.element.speed ?? 1);

function changeSpeed(speed: number) {
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed,
	});
}

const colorDefaults: ColorAdjustments = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 };
const ca = computed(() => props.element.colorAdjustments ?? colorDefaults);

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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
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
	update({ colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } });
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
	<div class="space-y-5 p-4">
		<!-- Header -->
		<div class="flex items-center gap-2">
			<Film class="size-4 text-zinc-500" />
			<h3 class="text-sm font-medium">Video</h3>
		</div>

		<!-- Info -->
		<div class="space-y-3">
			<div class="space-y-1">
				<label class="text-xs text-zinc-500">Name</label>
				<p class="text-sm">{{ element.name }}</p>
			</div>
			<div class="flex gap-4">
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Start</label>
					<p class="text-sm">{{ formatTime(element.startTime) }}</p>
				</div>
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Duration</label>
					<p class="text-sm">{{ formatTime(element.duration) }}</p>
				</div>
			</div>
		</div>

		<!-- Audio section -->
		<div class="space-y-3">
			<label class="text-xs font-medium text-zinc-400">Audio</label>

			<!-- Volume -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Volume</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="(element.volume ?? 1) * 100" min="0" max="200" step="1" class="flex-1" @input="handleVolumeSlider" />
					<input type="number" :value="volumeInput" min="0" max="200" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleVolumeInput((e.target as HTMLInputElement).value)" @blur="handleVolumeBlur" />
				</div>
			</div>

			<!-- Mute toggle -->
			<button
				:class="[
					'flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
					element.muted
						? 'border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/25'
						: 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10',
				]"
				@click="update({ muted: !element.muted })"
			>
				<component :is="element.muted ? VolumeX : Volume2" class="size-4" />
				{{ element.muted ? 'Unmute' : 'Mute' }}
			</button>
		</div>

		<!-- Speed -->
		<div class="space-y-1.5">
			<div class="flex items-center gap-1.5">
				<Gauge class="size-3 text-zinc-500" />
				<label class="text-xs text-zinc-500">Speed</label>
			</div>
			<div class="flex flex-wrap gap-1">
				<button
					v-for="s in speedPresets"
					:key="s"
					:class="[
						'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
						currentSpeed === s
							? 'bg-primary/20 text-primary border border-primary/30'
							: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200',
					]"
					@click="changeSpeed(s)"
				>
					{{ s }}x
				</button>
			</div>
		</div>

		<!-- Opacity -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Opacity</label>
			<div class="flex items-center gap-2">
				<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="flex-1" @input="handleOpacitySlider" />
				<input type="number" :value="opacityInput" min="0" max="100" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleOpacityInput((e.target as HTMLInputElement).value)" @blur="handleOpacityBlur" />
			</div>
		</div>

		<!-- Transform section -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<label class="text-xs font-medium text-zinc-400">Transform</label>
				<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Reset transform" @click="resetTransform">
					<RotateCcw class="size-3" />
					Reset
				</button>
			</div>

			<!-- Scale -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Scale</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="element.transform.scale * 100" min="10" max="500" step="1" class="flex-1" @input="handleScaleSlider" />
					<input type="number" :value="scaleInput" min="10" max="500" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleScaleInput((e.target as HTMLInputElement).value)" @blur="handleScaleBlur" />
				</div>
			</div>

			<!-- Position -->
			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Position X</label>
					<input type="number" :value="posXInput" step="1" class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handlePosX((e.target as HTMLInputElement).value)" />
				</div>
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Position Y</label>
					<input type="number" :value="posYInput" step="1" class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handlePosY((e.target as HTMLInputElement).value)" />
				</div>
			</div>

			<!-- Rotation -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Rotation</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="element.transform.rotate" min="-360" max="360" step="1" class="flex-1" @input="handleRotateSlider" />
					<input type="number" :value="rotateInput" min="-360" max="360" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleRotateInput((e.target as HTMLInputElement).value)" />
				</div>
			</div>

			<!-- Flip -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Flip</label>
				<div class="flex gap-2">
					<button
						:class="[
							'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
							element.flip?.horizontal
								? 'bg-primary/20 text-primary border border-primary/30'
								: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
						]"
						@click="update({ flip: { horizontal: !(element.flip?.horizontal ?? false), vertical: element.flip?.vertical ?? false } })"
					>
						<FlipHorizontal class="size-3.5" />
						H
					</button>
					<button
						:class="[
							'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
							element.flip?.vertical
								? 'bg-primary/20 text-primary border border-primary/30'
								: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
						]"
						@click="update({ flip: { horizontal: element.flip?.horizontal ?? false, vertical: !(element.flip?.vertical ?? false) } })"
					>
						<FlipVertical class="size-3.5" />
						V
					</button>
				</div>
			</div>
		</div>

		<!-- Crop -->
		<div class="space-y-3">
			<button class="flex w-full items-center justify-between" @click="showCrop = !showCrop">
				<div class="flex items-center gap-1.5">
					<Crop class="size-3.5 text-zinc-500" />
					<label class="text-xs font-medium text-zinc-400">Crop</label>
					<span v-if="activeCropPresetLabel !== 'None'" class="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium text-blue-400">{{ activeCropPresetLabel }}</span>
				</div>
				<ChevronDown class="size-3.5 text-zinc-500 transition-transform" :class="{ 'rotate-180': !showCrop }" />
			</button>

			<div v-if="showCrop" class="space-y-3">
				<!-- Aspect ratio presets -->
				<div class="space-y-1.5">
					<label class="text-xs text-zinc-500">Aspect Ratio</label>
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
				<div class="space-y-1.5">
					<label class="text-xs text-zinc-500">Top</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="cropVal.top * 100" min="0" max="45" step="1" class="flex-1" @input="(e) => updateCrop({ top: Number((e.target as HTMLInputElement).value) / 100 })" />
						<input type="number" :value="cropTopInput" min="0" max="45" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
							@input="(e) => { cropTopInput = (e.target as HTMLInputElement).value; const v = parseInt(cropTopInput, 10); if (!Number.isNaN(v)) updateCrop({ top: clamp(v, 0, 45) / 100 }); }" />
					</div>
				</div>
				<div class="space-y-1.5">
					<label class="text-xs text-zinc-500">Bottom</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="cropVal.bottom * 100" min="0" max="45" step="1" class="flex-1" @input="(e) => updateCrop({ bottom: Number((e.target as HTMLInputElement).value) / 100 })" />
						<input type="number" :value="cropBottomInput" min="0" max="45" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
							@input="(e) => { cropBottomInput = (e.target as HTMLInputElement).value; const v = parseInt(cropBottomInput, 10); if (!Number.isNaN(v)) updateCrop({ bottom: clamp(v, 0, 45) / 100 }); }" />
					</div>
				</div>
				<div class="space-y-1.5">
					<label class="text-xs text-zinc-500">Left</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="cropVal.left * 100" min="0" max="45" step="1" class="flex-1" @input="(e) => updateCrop({ left: Number((e.target as HTMLInputElement).value) / 100 })" />
						<input type="number" :value="cropLeftInput" min="0" max="45" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
							@input="(e) => { cropLeftInput = (e.target as HTMLInputElement).value; const v = parseInt(cropLeftInput, 10); if (!Number.isNaN(v)) updateCrop({ left: clamp(v, 0, 45) / 100 }); }" />
					</div>
				</div>
				<div class="space-y-1.5">
					<label class="text-xs text-zinc-500">Right</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="cropVal.right * 100" min="0" max="45" step="1" class="flex-1" @input="(e) => updateCrop({ right: Number((e.target as HTMLInputElement).value) / 100 })" />
						<input type="number" :value="cropRightInput" min="0" max="45" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
							@input="(e) => { cropRightInput = (e.target as HTMLInputElement).value; const v = parseInt(cropRightInput, 10); if (!Number.isNaN(v)) updateCrop({ right: clamp(v, 0, 45) / 100 }); }" />
					</div>
				</div>

				<!-- Crop preview indicator -->
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

				<!-- Reset crop -->
				<button
					class="flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
					@click="resetCrop"
				>
					<RotateCcw class="size-3" />
					Reset Crop
				</button>
			</div>
		</div>

		<!-- Color Adjustments -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<label class="text-xs font-medium text-zinc-400">Color Adjustments</label>
				<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Reset color" @click="resetColor">
					<RotateCcw class="size-3" />
					Reset
				</button>
			</div>

			<div v-for="prop in (['brightness', 'contrast', 'saturation', 'temperature'] as const)" :key="prop" class="space-y-1">
				<label class="text-xs capitalize text-zinc-500">{{ prop }}</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="ca[prop]" min="-100" max="100" step="1" class="flex-1" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
					<span class="w-8 text-right text-xs text-zinc-400">{{ ca[prop] }}</span>
				</div>
			</div>
		</div>

		<!-- Effects -->
		<div class="space-y-3">
			<button class="flex w-full items-center justify-between" @click="showEffects = !showEffects">
				<div class="flex items-center gap-1.5">
					<Wand2 class="size-3.5 text-zinc-500" />
					<label class="text-xs font-medium text-zinc-400">Effects</label>
					<span v-if="effects.length > 0" class="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium text-blue-400">{{ effects.length }}</span>
				</div>
				<ChevronDown class="size-3.5 text-zinc-500 transition-transform" :class="{ 'rotate-180': !showEffects }" />
			</button>

			<div v-if="showEffects" class="space-y-2">
				<div v-if="effects.length === 0" class="rounded-md border border-dashed border-white/10 px-3 py-4 text-center">
					<p class="text-[11px] text-zinc-600">No effects applied</p>
					<p class="mt-0.5 text-[10px] text-zinc-700">Add effects from the Effects panel</p>
				</div>

				<div v-for="effect in effects" :key="effect.id" class="rounded-md border border-white/5 bg-white/[0.02]">
					<!-- Effect header -->
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

					<!-- Effect params -->
					<div v-if="effect.enabled" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
						<!-- Intensity (all effects) -->
						<div class="flex items-center gap-2">
							<span class="w-14 shrink-0 text-[10px] text-zinc-500">Intensity</span>
							<input type="range" :value="effect.intensity" min="0" max="100" step="1" class="flex-1"
								@input="(e) => updateEffectParam(effect.id, 'intensity', Number((e.target as HTMLInputElement).value))" />
							<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ effect.intensity }}</span>
						</div>

						<!-- Blur: radius -->
						<template v-if="effect.type === 'blur'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Radius</span>
								<input type="range" :value="(effect as any).radius" min="1" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).radius }}px</span>
							</div>
						</template>

						<!-- Pixelate: blockSize -->
						<template v-if="effect.type === 'pixelate'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Block</span>
								<input type="range" :value="(effect as any).blockSize" min="2" max="64" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'blockSize', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).blockSize }}</span>
							</div>
						</template>

						<!-- Sharpen: amount -->
						<template v-if="effect.type === 'sharpen'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="0" max="10" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).amount }}</span>
							</div>
						</template>

						<!-- Vignette: radius + softness -->
						<template v-if="effect.type === 'vignette'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Radius</span>
								<input type="range" :value="(effect as any).radius" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).radius }}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Softness</span>
								<input type="range" :value="(effect as any).softness" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'softness', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).softness }}</span>
							</div>
						</template>

						<!-- ColorShift: offsets -->
						<template v-if="effect.type === 'colorShift'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-red-400">Red X</span>
								<input type="range" :value="(effect as any).redOffsetX" min="-20" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'redOffsetX', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).redOffsetX }}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-blue-400">Blue X</span>
								<input type="range" :value="(effect as any).blueOffsetX" min="-20" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'blueOffsetX', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).blueOffsetX }}</span>
							</div>
						</template>

						<!-- Glitch: sliceCount, maxOffset, colorBleed -->
						<template v-if="effect.type === 'glitch'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Slices</span>
								<input type="range" :value="(effect as any).sliceCount" min="2" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'sliceCount', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).sliceCount }}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Offset</span>
								<input type="range" :value="(effect as any).maxOffset" min="0" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'maxOffset', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).maxOffset }}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Bleed</span>
								<input type="range" :value="(effect as any).colorBleed" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).colorBleed }}</span>
							</div>
						</template>

						<!-- Wave: amplitude, frequency, speed -->
						<template v-if="effect.type === 'wave'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amp</span>
								<input type="range" :value="(effect as any).amplitude" min="1" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amplitude', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).amplitude }}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Freq</span>
								<input type="range" :value="(effect as any).frequency" min="0.5" max="10" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).frequency }}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
								<input type="range" :value="(effect as any).speed" min="0" max="10" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).speed }}</span>
							</div>
						</template>

						<!-- ZoomPulse: amount, speed -->
						<template v-if="effect.type === 'zoomPulse'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="1" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).amount }}%</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
								<input type="range" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).speed }}x</span>
							</div>
						</template>

						<!-- Flash: color, speed -->
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
								<span class="w-6 text-right font-mono text-[10px] text-zinc-500">{{ (effect as any).speed }}x</span>
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>

		<!-- Delete -->
		<button
			class="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25 hover:border-red-500/50"
			@click="handleDelete"
		>
			<Trash2 class="size-4" />
			Delete Video
		</button>
	</div>
</template>
