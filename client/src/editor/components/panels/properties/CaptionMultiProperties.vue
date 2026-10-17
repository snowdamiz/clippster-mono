<script setup lang="ts">
import { computed, h, ref, watchEffect, type FunctionalComponent } from "vue";
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
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import OptionChip from "../shared/OptionChip.vue";
import ChipGroup from "../shared/ChipGroup.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";
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
const PANEL_TAB_OPTIONS: SegmentedOption<PanelTab>[] = [
	{ value: "style", label: "Style" },
	{ value: "animation", label: "Animation" },
];

type AnimTab = "in" | "out" | "loop";
const activeAnimTab = ref<AnimTab>("in");
const selectedCategory = ref<AnimationCategory | "all">("all");

/** Brand dot marking In / Out / Loop tabs that already have an animation. */
const AnimSetDot: FunctionalComponent = () =>
	h("span", { class: "grid place-items-center" }, [h("span", { class: "size-1.5 rounded-full bg-brand" })]);

const animTabOptions = computed<SegmentedOption<AnimTab>[]>(() => {
	const el = first.value;
	return [
		{ value: "in", label: "In", icon: el?.animationIn ? AnimSetDot : undefined },
		{ value: "out", label: "Out", icon: el?.animationOut ? AnimSetDot : undefined },
		{ value: "loop", label: "Loop", icon: el?.animationLoop ? AnimSetDot : undefined },
	];
});

function selectAnimTab(tab: AnimTab) {
	activeAnimTab.value = tab;
	selectedCategory.value = "all";
}

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
	{ id: "ease-in", label: "Ease in" },
	{ id: "ease-out", label: "Ease out" },
	{ id: "ease-in-out", label: "Ease in out" },
	{ id: "ease-in-cubic", label: "Ease in cubic" },
	{ id: "ease-out-cubic", label: "Ease out cubic" },
	{ id: "ease-in-out-cubic", label: "Ease in out cubic" },
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

/** Font list for the family select; keeps the current family listed even if it isn't loaded. */
const fontOptions = computed(() => {
	const options = allFonts.value.map((font) => ({ value: font.family, label: font.family }));
	const current = first.value?.fontFamily;
	if (current && !options.some((o) => o.value === current)) {
		options.unshift({ value: current, label: current });
	}
	return options;
});

const FONT_WEIGHT_OPTIONS = [
	{ value: "normal", label: "Normal" },
	{ value: "bold", label: "Bold" },
	...["600", "700", "800", "900"].map((w) => ({ value: w, label: w })),
];

const TEXT_ALIGN_OPTIONS = [
	{ value: "left", label: "Align left", icon: AlignLeft },
	{ value: "center", label: "Align center", icon: AlignCenter },
	{ value: "right", label: "Align right", icon: AlignRight },
] as const;

// Size / words-per-line boxes commit on blur or Enter (only when changed, like a native `change`).
function commitFontSize(raw: string) {
	if (raw === String(first.value?.fontSize)) return;
	updateAll({ fontSize: Math.max(8, Math.min(200, Number(raw))) });
}

function commitMaxWords(raw: string) {
	if (raw === String(first.value?.maxWordsPerLine)) return;
	updateAll({ maxWordsPerLine: Math.max(1, Math.min(32, Math.floor(Number(raw)))) });
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
	<div class="flex h-full min-h-0 flex-col">
		<!-- Selection summary + Style / Animation switch (pinned) -->
		<div class="shrink-0 space-y-2 border-b border-line-subtle px-3 py-2">
			<p class="text-2xs text-fg-muted">
				Editing <span class="tabular font-medium text-fg">{{ count }}</span> captions — changes apply to
				<span class="font-medium text-fg">all</span> selected. Values reflect the first caption.
			</p>
			<SegmentedControl v-model="activePanelTab" :options="PANEL_TAB_OPTIONS" size="sm" block />
		</div>

		<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
			<!-- ── Style (shared) ── -->
			<template v-if="activePanelTab === 'style' && first">
				<InspectorSection title="Transform">
					<SliderField
						inline
						label="Scale"
						:model-value="Math.round((first.transform.scale ?? 1) * 100)"
						:input-value="scaleInput"
						:min="10"
						:max="500"
						unit="%"
						input-type="text"
						@slide="(v) => handleScaleSlider(String(v))"
						@input="handleScaleInput"
						@commit="handleScaleBlur"
					/>
					<SliderField
						inline
						label="Rotation"
						:model-value="first.transform.rotate ?? 0"
						:input-value="rotationInput"
						:min="-180"
						:max="180"
						:step="0.1"
						input-type="text"
						@slide="(v) => handleRotationSlider(String(v))"
						@input="handleRotationInput"
						@commit="handleRotationBlur"
					/>
					<SliderField
						inline
						label="Position X"
						:model-value="Math.round(first.transform.position.x ?? 0)"
						:input-value="posXInput"
						:min="-1000"
						:max="1000"
						input-type="text"
						@slide="(v) => handlePosXSlider(String(v))"
						@input="handlePosXInput"
						@commit="handlePosXBlur"
					/>
					<SliderField
						inline
						label="Position Y"
						:model-value="Math.round(first.transform.position.y ?? 0)"
						:input-value="posYInput"
						:min="-1000"
						:max="1000"
						input-type="text"
						@slide="(v) => handlePosYSlider(String(v))"
						@input="handlePosYInput"
						@commit="handlePosYBlur"
					/>
					<SliderField
						inline
						label="Opacity"
						:model-value="Math.round((first.opacity ?? 1) * 100)"
						:input-value="opacityInput"
						:min="0"
						:max="100"
						unit="%"
						input-type="text"
						@slide="(v) => handleOpacitySlider(String(v))"
						@input="handleOpacityInput"
						@commit="handleOpacityBlur"
					/>
				</InspectorSection>

				<InspectorSection title="Typography" flush>
					<InspectorField label="Font">
						<InspectorSelect
							:model-value="first.fontFamily"
							:options="fontOptions"
							aria-label="Font family"
							@update:model-value="(v) => selectFont(String(v))"
						/>
					</InspectorField>
					<InspectorField label="Fill">
						<ColorSwatchField
							app-picker
							:model-value="first.color"
							aria-label="Fill color"
							@update:model-value="(v) => updateAll({ color: v })"
						/>
					</InspectorField>
					<div class="grid grid-cols-2 gap-2">
						<InspectorField label="Size">
							<NumberBox
								:value="first.fontSize"
								:min="8"
								:max="200"
								aria-label="Font size"
								@commit="commitFontSize"
							/>
						</InspectorField>
						<InspectorField label="Weight">
							<InspectorSelect
								:model-value="first.fontWeight"
								:options="FONT_WEIGHT_OPTIONS"
								aria-label="Font weight"
								@update:model-value="(v) => updateAll({ fontWeight: String(v) as CaptionElementUpdatable['fontWeight'] })"
							/>
						</InspectorField>
					</div>
					<InspectorField label="Alignment">
						<ChipGroup class="flex w-full">
							<OptionChip
								v-for="opt in TEXT_ALIGN_OPTIONS"
								:key="opt.value"
								variant="ghost"
								:icon="opt.icon"
								:active="first.textAlign === opt.value"
								:title="opt.label"
								:aria-label="opt.label"
								class="flex-1"
								@click="updateAll({ textAlign: opt.value })"
							/>
						</ChipGroup>
					</InspectorField>
					<InspectorField label="Words / line">
						<NumberBox
							:value="first.maxWordsPerLine"
							:min="1"
							:max="32"
							aria-label="Words per line"
							@commit="commitMaxWords"
						/>
					</InspectorField>
				</InspectorSection>
			</template>

			<!-- ── Animation (shared, export-parity list) ── -->
			<template v-else-if="activePanelTab === 'animation' && first">
				<InspectorSection flush>
					<SegmentedControl
						:model-value="activeAnimTab"
						:options="animTabOptions"
						size="sm"
						block
						@update:model-value="selectAnimTab"
					/>

					<!-- Current animation for this direction -->
					<div v-if="currentAnim" class="overflow-hidden rounded-lg border border-line-subtle bg-surface-raised">
						<div class="flex h-8 items-center gap-1 pl-2.5 pr-1">
							<span class="min-w-0 flex-1 truncate text-xs font-medium text-fg">
								{{ ANIMATION_PRESETS.find((p) => p.type === currentAnim?.type)?.label ?? currentAnim?.type ?? "" }}
							</span>
							<Button
								variant="ghost"
								size="icon-xs"
								class="hover:bg-danger-soft hover:text-danger"
								title="Remove animation"
								aria-label="Remove animation"
								@click="removeAnimationAll"
							>
								<X />
							</Button>
						</div>
						<div class="space-y-1.5 border-t border-line-subtle px-2.5 py-2">
							<SliderField
								inline
								label="Duration"
								:model-value="currentAnim.duration * 10"
								:min="1"
								:max="activeAnimTab === 'loop' ? 100 : Math.min(minElementDuration * 10, 50)"
								:step="1"
								:readout="`${currentAnim.duration.toFixed(1)}s`"
								@slide="(v) => updateAnimDuration(v / 10)"
							/>
							<InspectorField inline label="Easing">
								<InspectorSelect
									:model-value="currentAnim.easing"
									:options="easingOptions.map((opt) => ({ value: opt.id, label: opt.label }))"
									aria-label="Easing"
									class="flex-1"
									@update:model-value="(v) => updateAnimEasing(v as AnimationEasing)"
								/>
							</InspectorField>
						</div>
					</div>

					<!-- Category filter -->
					<div class="flex flex-wrap gap-1">
						<OptionChip :active="selectedCategory === 'all'" @click="selectedCategory = 'all'">All</OptionChip>
						<OptionChip
							v-for="cat in availableAnimCategories"
							:key="cat.id"
							:active="selectedCategory === cat.id"
							@click="selectedCategory = cat.id"
						>
							{{ cat.label }}
						</OptionChip>
					</div>

					<!-- Preset list -->
					<div class="grid grid-cols-2 gap-0.5">
						<OptionChip
							variant="ghost"
							:active="!currentAnim"
							:icon="X"
							class="h-7 justify-start px-2"
							@click="removeAnimationAll"
						>
							None
						</OptionChip>
						<OptionChip
							v-for="preset in filteredAnimPresets"
							:key="preset.type"
							variant="ghost"
							:active="currentAnim?.type === preset.type"
							:title="preset.label"
							class="h-7 justify-start px-2"
							@click="setAnimationAll(activeAnimTab, preset.type)"
						>
							<span class="truncate">{{ preset.label }}</span>
						</OptionChip>
					</div>
				</InspectorSection>
			</template>
		</div>
	</div>
</template>
