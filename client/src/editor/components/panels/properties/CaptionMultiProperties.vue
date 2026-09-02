<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import type { CaptionElement } from "../../../types/timeline";
import type { Transform } from "../../../types/timeline";
import type { CaptionElementUpdatable } from "../../../lib/commands/timeline/element/update-caption-element";
import type { AnimationType, AnimationEasing, AnimationCategory, ElementAnimation } from "../../../types/animations";
import {
	ANIMATION_PRESETS,
	getExportableAnimationPresetsForDirection,
	ANIMATION_CATEGORIES,
} from "../../../constants/animation-constants";
import ColorPicker from "@/components/ColorPicker.vue";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlignLeft, AlignCenter, AlignRight, X } from "lucide-vue-next";
import { cloneTransform } from "../../../lib/timeline/element-utils";

const props = defineProps<{
	elements: Array<{ trackId: string; element: CaptionElement }>;
}>();

const { editor } = useEditor({ subscribe: false });
const { allFonts } = useFontManager();

const count = computed(() => props.elements.length);
const first = computed(() => props.elements[0]?.element);

const scaleInput = ref("100");
const rotationInput = ref("0");
const posXInput = ref("0");
const posYInput = ref("0");
const opacityInput = ref("100");

watchEffect(() => {
	const el = first.value;
	if (!el) return;
	scaleInput.value = Math.round((el.transform.scale ?? 1) * 100).toString();
	rotationInput.value = (el.transform.rotate ?? 0).toFixed(1);
	posXInput.value = Math.round(el.transform.position.x ?? 0).toString();
	posYInput.value = Math.round(el.transform.position.y ?? 0).toString();
	opacityInput.value = Math.round((el.opacity ?? 1) * 100).toString();
});

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

const minElementDuration = computed(() => {
	let m = 10;
	for (const { element } of props.elements) {
		m = Math.min(m, Math.max(0.1, element.duration));
	}
	return m;
});

type PanelTab = "style" | "animation";
const activePanelTab = ref<PanelTab>("style");

type AnimTab = "in" | "out" | "loop";
const activeAnimTab = ref<AnimTab>("in");
const selectedCategory = ref<AnimationCategory | "all">("all");

const inPresets = computed(() => getExportableAnimationPresetsForDirection("in"));
const outPresets = computed(() => getExportableAnimationPresetsForDirection("out"));
const loopPresets = computed(() => getExportableAnimationPresetsForDirection("loop"));

const currentPresetList = computed(() => {
	switch (activeAnimTab.value) {
		case "in":
			return inPresets.value;
		case "out":
			return outPresets.value;
		case "loop":
			return loopPresets.value;
	}
});

const currentAnim = computed<ElementAnimation | undefined>(() => {
	const el = first.value;
	if (!el) return undefined;
	switch (activeAnimTab.value) {
		case "in":
			return el.animationIn;
		case "out":
			return el.animationOut;
		case "loop":
			return el.animationLoop;
	}
});

const filteredAnimPresets = computed(() => {
	if (selectedCategory.value === "all") return currentPresetList.value;
	return currentPresetList.value.filter((p) => p.category === selectedCategory.value);
});

const availableAnimCategories = computed(() => {
	const cats = new Set(currentPresetList.value.map((p) => p.category));
	return ANIMATION_CATEGORIES.filter((c) => cats.has(c.id));
});

const easingOptions: { id: AnimationEasing; label: string }[] = [
	{ id: "linear", label: "Linear" },
	{ id: "ease-in", label: "Ease In" },
	{ id: "ease-out", label: "Ease Out" },
	{ id: "ease-in-out", label: "Ease In Out" },
	{ id: "ease-in-cubic", label: "Ease In Cubic" },
	{ id: "ease-out-cubic", label: "Ease Out Cubic" },
	{ id: "ease-in-out-cubic", label: "Ease In Out Cubic" },
	{ id: "ease-out-back", label: "Overshoot" },
	{ id: "ease-out-bounce", label: "Bounce" },
	{ id: "spring", label: "Spring" },
];

function getBatchTarget(): { trackId: string; elementIds: string[] } | null {
	if (props.elements.length === 0) return null;
	return {
		trackId: props.elements[0].trackId,
		elementIds: props.elements.map((item) => item.element.id),
	};
}

function updateAll(updates: CaptionElementUpdatable) {
	const target = getBatchTarget();
	if (!target) return;
	editor.timeline.updateCaptionsBatch({
		trackId: target.trackId,
		elementIds: target.elementIds,
		updates,
	});
}

function updateAllTransform(partial: { scale?: number; rotate?: number; x?: number; y?: number }) {
	if (props.elements.length === 0) return;

	const trackId = props.elements[0].trackId;
	const track = editor.timeline.getTrackById({ trackId });
	if (!track) return;

	const targetIds = new Set(props.elements.map((item) => item.element.id));
	const updates: { elementId: string; transform: Transform }[] = [];
	const previousTransforms: { elementId: string; transform: Transform }[] = [];

	for (const el of track.elements) {
		if (!targetIds.has(el.id) || el.type !== "caption") continue;
		const t = el.transform;
		const nextTransform = cloneTransform({
			scale: partial.scale ?? t.scale,
			rotate: partial.rotate ?? t.rotate,
			position: {
				x: partial.x ?? t.position.x,
				y: partial.y ?? t.position.y,
			},
		});
		updates.push({ elementId: el.id, transform: nextTransform });
		previousTransforms.push({ elementId: el.id, transform: cloneTransform(t) });
	}

	if (updates.length === 0) return;

	editor.timeline.updateElementsTransformsBatch({
		trackId,
		updates,
		previousTransforms,
	});
}

function handleScaleSlider(value: string) {
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed)) return;
	scaleInput.value = parsed.toString();
	updateAllTransform({ scale: parsed / 100 });
}

function handleScaleInput(value: string) {
	scaleInput.value = value;
	if (value.trim() === "") return;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		updateAllTransform({ scale: clamp(parsed, 10, 500) / 100 });
	}
}

function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const scale = Number.isNaN(parsed)
		? Math.round((first.value?.transform.scale ?? 1) * 100)
		: clamp(parsed, 10, 500);
	scaleInput.value = scale.toString();
	updateAllTransform({ scale: scale / 100 });
}

function handleRotationSlider(value: string) {
	const parsed = parseFloat(value);
	if (Number.isNaN(parsed)) return;
	rotationInput.value = parsed.toFixed(1);
	updateAllTransform({ rotate: parsed });
}

function handleRotationInput(value: string) {
	rotationInput.value = value;
	if (value.trim() === "" || value === "-") return;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		updateAllTransform({ rotate: clamp(parsed, -180, 180) });
	}
}

function handleRotationBlur() {
	const parsed = parseFloat(rotationInput.value);
	const rotate = Number.isNaN(parsed) ? (first.value?.transform.rotate ?? 0) : clamp(parsed, -180, 180);
	rotationInput.value = rotate.toFixed(1);
	updateAllTransform({ rotate });
}

function handlePosXSlider(value: string) {
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed)) return;
	posXInput.value = parsed.toString();
	updateAllTransform({ x: parsed });
}

function handlePosXInput(value: string) {
	posXInput.value = value;
	if (value.trim() === "" || value === "-") return;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		updateAllTransform({ x: clamp(parsed, -1000, 1000) });
	}
}

function handlePosXBlur() {
	const parsed = parseInt(posXInput.value, 10);
	const x = Number.isNaN(parsed)
		? Math.round(first.value?.transform.position.x ?? 0)
		: clamp(parsed, -1000, 1000);
	posXInput.value = x.toString();
	updateAllTransform({ x });
}

function handlePosYSlider(value: string) {
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed)) return;
	posYInput.value = parsed.toString();
	updateAllTransform({ y: parsed });
}

function handlePosYInput(value: string) {
	posYInput.value = value;
	if (value.trim() === "" || value === "-") return;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		updateAllTransform({ y: clamp(parsed, -1000, 1000) });
	}
}

function handlePosYBlur() {
	const parsed = parseInt(posYInput.value, 10);
	const y = Number.isNaN(parsed)
		? Math.round(first.value?.transform.position.y ?? 0)
		: clamp(parsed, -1000, 1000);
	posYInput.value = y.toString();
	updateAllTransform({ y });
}

function handleOpacitySlider(value: string) {
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed)) return;
	opacityInput.value = parsed.toString();
	updateAll({ opacity: parsed / 100 });
}

function handleOpacityInput(value: string) {
	opacityInput.value = value;
	if (value.trim() === "") return;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		updateAll({ opacity: clamp(parsed, 0, 100) / 100 });
	}
}

function handleOpacityBlur() {
	const parsed = parseInt(opacityInput.value, 10);
	const opacity = Number.isNaN(parsed)
		? (first.value?.opacity ?? 1)
		: clamp(parsed, 0, 100) / 100;
	opacityInput.value = Math.round(opacity * 100).toString();
	updateAll({ opacity });
}

function selectFont(family: string) {
	updateAll({ fontFamily: family });
}

function setAnimationAll(direction: AnimTab, type: AnimationType | null) {
	const preset = type ? ANIMATION_PRESETS.find((p) => p.type === type) : null;
	const key =
		direction === "in" ? "animationIn" : direction === "out" ? "animationOut" : "animationLoop";
	const value = preset
		? { type: preset.type, duration: preset.defaultDuration, easing: preset.defaultEasing }
		: undefined;
	updateAll({ [key]: value } as CaptionElementUpdatable);
}

function removeAnimationAll() {
	setAnimationAll(activeAnimTab.value, null);
}

function updateAnimDuration(val: number) {
	const anim = currentAnim.value;
	if (!anim) return;
	const key =
		activeAnimTab.value === "in"
			? "animationIn"
			: activeAnimTab.value === "out"
				? "animationOut"
				: "animationLoop";
	const maxDur = activeAnimTab.value === "loop" ? 10 : Math.min(minElementDuration.value, 5);
	const clamped = Math.max(0.1, Math.min(maxDur, val));
	const next = { ...anim, duration: Math.round(clamped * 10) / 10 };
	updateAll({ [key]: next } as CaptionElementUpdatable);
}

function updateAnimEasing(easing: AnimationEasing) {
	const anim = currentAnim.value;
	if (!anim) return;
	const key =
		activeAnimTab.value === "in"
			? "animationIn"
			: activeAnimTab.value === "out"
				? "animationOut"
				: "animationLoop";
	const next = { ...anim, easing };
	updateAll({ [key]: next } as CaptionElementUpdatable);
}
</script>

<template>
	<div class="flex h-full flex-col overflow-y-auto p-3 text-xs">
		<div class="mb-3 rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400">
			Editing <span class="font-medium text-zinc-200">{{ count }}</span> captions — changes apply to
			<strong>all</strong> selected. Values reflect the first caption.
		</div>

		<div class="mb-2 flex rounded-md border border-white/10 bg-white/[0.02]">
			<button
				v-for="tab in (['style', 'animation'] as PanelTab[])"
				:key="tab"
				class="flex-1 py-1.5 text-center text-[11px] font-medium transition-colors"
				:class="
					activePanelTab === tab
						? 'bg-primary/15 text-primary'
						: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
				"
				@click="activePanelTab = tab"
			>
				{{ tab === "style" ? "Style" : "Animation" }}
			</button>
		</div>

		<!-- ── Style (shared) ── -->
		<div v-if="activePanelTab === 'style' && first" class="space-y-4">
			<div class="space-y-2 border-b border-white/10 pb-3">
				<span class="text-[11px] font-medium text-zinc-300">Transform</span>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Scale</label>
					<div class="flex items-center gap-2">
						<input
							type="range"
							min="10"
							max="500"
							:value="Math.round((first.transform.scale ?? 1) * 100)"
							class="flex-1"
							@input="handleScaleSlider(($event.target as HTMLInputElement).value)"
						/>
						<div class="flex items-center">
							<input
								type="text"
								:value="scaleInput"
								class="h-7 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
								@input="handleScaleInput(($event.target as HTMLInputElement).value)"
								@blur="handleScaleBlur"
							/>
							<span class="ml-0.5 text-zinc-500">%</span>
						</div>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Rotation</label>
					<div class="flex items-center gap-2">
						<input
							type="range"
							min="-180"
							max="180"
							step="0.1"
							:value="first.transform.rotate ?? 0"
							class="flex-1"
							@input="handleRotationSlider(($event.target as HTMLInputElement).value)"
						/>
						<input
							type="text"
							:value="rotationInput"
							class="h-7 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
							@input="handleRotationInput(($event.target as HTMLInputElement).value)"
							@blur="handleRotationBlur"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">X</label>
					<div class="flex items-center gap-2">
						<input
							type="range"
							min="-1000"
							max="1000"
							:value="Math.round(first.transform.position.x ?? 0)"
							class="flex-1"
							@input="handlePosXSlider(($event.target as HTMLInputElement).value)"
						/>
						<input
							type="text"
							:value="posXInput"
							class="h-7 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
							@input="handlePosXInput(($event.target as HTMLInputElement).value)"
							@blur="handlePosXBlur"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Y</label>
					<div class="flex items-center gap-2">
						<input
							type="range"
							min="-1000"
							max="1000"
							:value="Math.round(first.transform.position.y ?? 0)"
							class="flex-1"
							@input="handlePosYSlider(($event.target as HTMLInputElement).value)"
						/>
						<input
							type="text"
							:value="posYInput"
							class="h-7 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
							@input="handlePosYInput(($event.target as HTMLInputElement).value)"
							@blur="handlePosYBlur"
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Opacity</label>
					<div class="flex items-center gap-2">
						<input
							type="range"
							min="0"
							max="100"
							:value="Math.round((first.opacity ?? 1) * 100)"
							class="flex-1"
							@input="handleOpacitySlider(($event.target as HTMLInputElement).value)"
						/>
						<div class="flex items-center">
							<input
								type="text"
								:value="opacityInput"
								class="h-7 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
								@input="handleOpacityInput(($event.target as HTMLInputElement).value)"
								@blur="handleOpacityBlur"
							/>
							<span class="ml-0.5 text-zinc-500">%</span>
						</div>
					</div>
				</div>
			</div>

			<div class="space-y-2 border-b border-white/10 pb-3">
				<span class="text-[11px] font-medium text-zinc-300">Typography</span>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Font</label>
					<Select :model-value="first.fontFamily" @update:model-value="(v) => selectFont(String(v))">
						<SelectTrigger class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
							<SelectValue :placeholder="first.fontFamily" />
						</SelectTrigger>
						<SelectContent class="max-h-[220px] border-white/10 bg-zinc-900">
							<SelectItem v-for="font in allFonts" :key="font.family" :value="font.family" class="text-xs text-zinc-200">
								{{ font.family }}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Fill</label>
					<ColorPicker :model-value="first.color" @update:model-value="(v) => updateAll({ color: v })" />
				</div>
				<div class="grid grid-cols-2 gap-2">
					<div class="space-y-1">
						<label class="text-[11px] text-zinc-500">Size</label>
						<input
							type="number"
							min="8"
							max="200"
							:value="first.fontSize"
							class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
							@change="
								updateAll({ fontSize: Math.max(8, Math.min(200, Number(($event.target as HTMLInputElement).value))) })
							"
						/>
					</div>
					<div class="space-y-1">
						<label class="text-[11px] text-zinc-500">Weight</label>
						<Select :model-value="first.fontWeight" @update:model-value="(v) => updateAll({ fontWeight: String(v) })">
							<SelectTrigger class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
								<SelectValue />
							</SelectTrigger>
							<SelectContent class="border-white/10 bg-zinc-900">
								<SelectItem value="normal" class="text-xs">Normal</SelectItem>
								<SelectItem value="bold" class="text-xs">Bold</SelectItem>
								<SelectItem value="600" class="text-xs">600</SelectItem>
								<SelectItem value="700" class="text-xs">700</SelectItem>
								<SelectItem value="800" class="text-xs">800</SelectItem>
								<SelectItem value="900" class="text-xs">900</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Align</label>
					<div class="flex gap-1">
						<button
							type="button"
							class="flex-1 rounded-md border p-1.5 transition-all"
							:class="first.textAlign === 'left' ? 'border-primary/50 bg-primary/10' : 'border-white/10 hover:bg-white/5'"
							@click="updateAll({ textAlign: 'left' })"
						>
							<AlignLeft class="mx-auto size-3.5 text-zinc-300" />
						</button>
						<button
							type="button"
							class="flex-1 rounded-md border p-1.5 transition-all"
							:class="first.textAlign === 'center' ? 'border-primary/50 bg-primary/10' : 'border-white/10 hover:bg-white/5'"
							@click="updateAll({ textAlign: 'center' })"
						>
							<AlignCenter class="mx-auto size-3.5 text-zinc-300" />
						</button>
						<button
							type="button"
							class="flex-1 rounded-md border p-1.5 transition-all"
							:class="first.textAlign === 'right' ? 'border-primary/50 bg-primary/10' : 'border-white/10 hover:bg-white/5'"
							@click="updateAll({ textAlign: 'right' })"
						>
							<AlignRight class="mx-auto size-3.5 text-zinc-300" />
						</button>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-[11px] text-zinc-500">Words / line</label>
					<input
						type="number"
						min="1"
						max="32"
						:value="first.maxWordsPerLine"
						class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
						@change="
							updateAll({
								maxWordsPerLine: Math.max(1, Math.min(32, Math.floor(Number(($event.target as HTMLInputElement).value)))),
							})
						"
					/>
				</div>
			</div>
		</div>

		<!-- ── Animation (shared, export-parity list) ── -->
		<div v-else-if="activePanelTab === 'animation' && first" class="space-y-3">
			<div class="flex rounded-md border border-white/10 bg-white/[0.02]">
				<button
					v-for="tab in (['in', 'out', 'loop'] as AnimTab[])"
					:key="tab"
					class="flex-1 py-1.5 text-center text-[11px] font-medium capitalize transition-colors"
					:class="
						activeAnimTab === tab
							? 'bg-primary/15 text-primary'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
					"
					@click="activeAnimTab = tab; selectedCategory = 'all'"
				>
					{{ tab }}
					<span
						v-if="
							(tab === 'in' && first.animationIn) ||
							(tab === 'out' && first.animationOut) ||
							(tab === 'loop' && first.animationLoop)
						"
						class="ml-0.5 inline-block size-1 rounded-full bg-primary"
					/>
				</button>
			</div>

			<div v-if="currentAnim" class="space-y-2 border-b border-white/[0.06] pb-3">
				<div class="flex items-center justify-between">
					<span class="text-[11px] font-medium text-zinc-300">
						{{ ANIMATION_PRESETS.find((p) => p.type === currentAnim?.type)?.label ?? currentAnim?.type ?? "" }}
					</span>
					<button
						type="button"
						class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
						title="Remove animation"
						@click="removeAnimationAll"
					>
						<X class="size-3" />
					</button>
				</div>
				<div class="flex items-center gap-2">
					<label class="w-12 shrink-0 text-[10px] text-zinc-500">Duration</label>
					<input
						type="range"
						:value="currentAnim.duration * 10"
						min="1"
						:max="activeAnimTab === 'loop' ? 100 : Math.min(minElementDuration * 10, 50)"
						step="1"
						class="flex-1"
						@input="updateAnimDuration(Number(($event.target as HTMLInputElement).value) / 10)"
					/>
					<span class="w-10 text-right text-[11px] text-zinc-400">{{ currentAnim.duration.toFixed(1) }}s</span>
				</div>
				<div class="flex items-center gap-2">
					<label class="w-12 shrink-0 text-[10px] text-zinc-500">Easing</label>
					<Select :model-value="currentAnim.easing" @update:model-value="(v) => updateAnimEasing(v as AnimationEasing)">
						<SelectTrigger class="h-7 flex-1 rounded-md border border-white/10 bg-white/5 px-2 text-[10px] text-zinc-200">
							<SelectValue />
						</SelectTrigger>
						<SelectContent class="border-white/10 bg-zinc-900">
							<SelectItem v-for="opt in easingOptions" :key="opt.id" :value="opt.id" class="text-[10px] text-zinc-200">
								{{ opt.label }}
							</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div class="flex flex-wrap gap-1">
				<button
					type="button"
					class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
					:class="selectedCategory === 'all' ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:bg-white/5'"
					@click="selectedCategory = 'all'"
				>
					All
				</button>
				<button
					v-for="cat in availableAnimCategories"
					:key="cat.id"
					type="button"
					class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
					:class="selectedCategory === cat.id ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:bg-white/5'"
					@click="selectedCategory = cat.id"
				>
					{{ cat.label }}
				</button>
			</div>

			<div class="grid grid-cols-2 gap-0.5">
				<button
					type="button"
					class="flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors"
					:class="!currentAnim ? 'bg-primary/10 text-primary' : 'text-zinc-500 hover:bg-white/5'"
					@click="removeAnimationAll"
				>
					<X class="size-3 shrink-0" />
					None
				</button>
				<button
					v-for="preset in filteredAnimPresets"
					:key="preset.type"
					type="button"
					class="flex h-7 items-center rounded px-2 text-[11px] font-medium transition-colors"
					:class="
						currentAnim?.type === preset.type ? 'bg-primary/10 text-primary' : 'text-zinc-500 hover:bg-white/5'
					"
					:title="preset.label"
					@click="setAnimationAll(activeAnimTab, preset.type)"
				>
					{{ preset.label }}
				</button>
			</div>
		</div>
	</div>
</template>
