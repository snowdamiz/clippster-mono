<script setup lang="ts">
import { ref, watchEffect, computed, nextTick } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import type {
	CaptionElement,
	CaptionPresetId,
	CaptionLine,
	CaptionTrack,
	Transform,
} from "../../../types/timeline";
import { cloneTransform } from "../../../lib/timeline/element-utils";
import type { CaptionElementUpdatable } from "../../../lib/commands/timeline/element/update-caption-element";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPresetCategory } from "../../../constants/caption-constants";
import { ANIMATION_PRESETS, getExportableAnimationPresetsForDirection } from "../../../constants/animation-constants";
import type { AnimationType } from "../../../types/animations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorTabRail from "../shared/InspectorTabRail.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import OptionChip from "../shared/OptionChip.vue";
import ChipGroup from "../shared/ChipGroup.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import {
	AlignLeft,
	AlignCenter,
	AlignRight,
	RotateCcw,
	Plus,
	Trash2,
	Ban,
	Captions,
	Type,
	Zap,
} from "lucide-vue-next";

const props = defineProps<{
	element: CaptionElement;
	trackId: string;
}>();

const { editor, version } = useEditor({
	subscribe: {
		timeline: true,
		scenes: true,
		playback: false,
		project: false,
		media: false,
		selection: false,
	},
});
const { allFonts, ensureFontLoaded, uploadCustomFont } = useFontManager();

// ── Top-level tabs (CapCut style) ──
type TopTab = "captions" | "text" | "animation";
const activeTopTab = ref<TopTab>("captions");
const topTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: 'captions', label: 'Captions', icon: Captions },
	{ id: 'text', label: 'Text', icon: Type },
	{ id: 'animation', label: 'Animation', icon: Zap },
];

// ── Text sub-tabs ──
type TextSubTab = "style" | "effects";
const activeTextSubTab = ref<TextSubTab>("style");
const showCustomize = ref(false);
const TEXT_SUB_TAB_OPTIONS: SegmentedOption<TextSubTab>[] = [
	{ value: "style", label: "Style" },
	{ value: "effects", label: "Effects" },
];

// ── Animation sub-tabs ──
type AnimSubTab = "in" | "out" | "loop";
const activeAnimSubTab = ref<AnimSubTab>("in");
const ANIM_SUB_TAB_OPTIONS: SegmentedOption<AnimSubTab>[] = [
	{ value: "in", label: "In" },
	{ value: "out", label: "Out" },
	{ value: "loop", label: "Loop" },
];

// ── Apply to all toggle ──
const applyToAll = ref(true);

// ── Input refs ──
const fontSizeInput = ref(props.element.fontSize.toString());
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const maxWordsInput = ref(props.element.maxWordsPerLine.toString());
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(props.element.transform.position.x.toString());
const posYInput = ref(props.element.transform.position.y.toString());
const rotationInput = ref(props.element.transform.rotate.toString());
const showStroke = ref(!!props.element.stroke);
const showShadow = ref(!!props.element.shadow);
const showGlow = ref(!!props.element.glow);

// ── Watchers — single watchEffect so all refs update atomically on element switch ──
watchEffect(() => {
	void props.element.id;
	fontSizeInput.value = props.element.fontSize.toString();
	opacityInput.value = Math.round(props.element.opacity * 100).toString();
	maxWordsInput.value = props.element.maxWordsPerLine.toString();
	scaleInput.value = Math.round(props.element.transform.scale * 100).toString();
	posXInput.value = Math.round(props.element.transform.position.x).toString();
	posYInput.value = Math.round(props.element.transform.position.y).toString();
	rotationInput.value = props.element.transform.rotate.toFixed(2);
	showStroke.value = !!props.element.stroke;
	showShadow.value = !!props.element.shadow;
	showGlow.value = !!props.element.glow;
});

// ── All caption elements for "apply to all" ──
const allCaptionElements = computed(() => {
	void version.value;
	const result: { trackId: string; element: CaptionElement }[] = [];
	for (const track of editor.timeline.getTracks()) {
		if (track.type !== "caption") continue;
		for (const el of track.elements) {
			if (el.type === "caption") result.push({ trackId: track.id, element: el as CaptionElement });
		}
	}
	return result;
});

// ── All caption lines across all elements (for the Captions tab line list) ──
const allCaptionLines = computed(() => {
	void version.value;
	const lines: { lineIndex: number; globalIndex: number; line: CaptionLine; trackId: string; elementId: string; elementLocalIndex: number }[] = [];
	let globalIdx = 0;
	for (const { trackId, element } of allCaptionElements.value) {
		for (let i = 0; i < element.lines.length; i++) {
			lines.push({
				lineIndex: i,
				globalIndex: globalIdx++,
				line: element.lines[i],
				trackId,
				elementId: element.id,
				elementLocalIndex: i,
			});
		}
	}
	return lines;
});

// ── Paragraph text for header ──
const paragraphCount = computed(() => allCaptionLines.value.length);

function update(updates: Record<string, unknown>) {
	if (applyToAll.value && updates.transform) {
		const nextTransform = cloneTransform(updates.transform as Transform);
		const targets = allCaptionElements.value;
		if (targets.length === 0) return;

		const byTrack = new Map<string, string[]>();
		for (const { trackId, element } of targets) {
			const ids = byTrack.get(trackId) ?? [];
			ids.push(element.id);
			byTrack.set(trackId, ids);
		}

		for (const [trackId, elementIds] of byTrack) {
			const track = editor.timeline.getTrackById({ trackId });
			if (!track) continue;
			const idSet = new Set(elementIds);
			const batchUpdates: { elementId: string; transform: Transform }[] = [];
			const previousTransforms: { elementId: string; transform: Transform }[] = [];

			for (const el of track.elements) {
				if (!idSet.has(el.id) || el.type !== "caption") continue;
				batchUpdates.push({ elementId: el.id, transform: cloneTransform(nextTransform) });
				previousTransforms.push({ elementId: el.id, transform: cloneTransform(el.transform) });
			}

			if (batchUpdates.length > 0) {
				editor.timeline.updateElementsTransformsBatch({
					trackId,
					updates: batchUpdates,
					previousTransforms,
				});
			}
		}
		return;
	}

	if (applyToAll.value) {
		const targets = allCaptionElements.value;
		if (targets.length === 0) return;

		const byTrack = new Map<string, string[]>();
		for (const { trackId, element } of targets) {
			const ids = byTrack.get(trackId) ?? [];
			ids.push(element.id);
			byTrack.set(trackId, ids);
		}

		for (const [trackId, elementIds] of byTrack) {
			editor.timeline.updateCaptionsBatch({
				trackId,
				elementIds,
				updates: updates as CaptionElementUpdatable,
			});
		}
		return;
	} else {
		editor.timeline.updateCaptionElement({
			trackId: props.trackId,
			elementId: props.element.id,
			updates: updates as any,
		});
	}
}

function updateSingle(updates: Record<string, unknown>) {
	editor.timeline.updateCaptionElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: updates as any,
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

// ── Font size ──
function handleFontSizeChange(value: string) {
	fontSizeInput.value = value;
	if (value.trim() !== "") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) update({ fontSize: clamp(parsed, 8, 300) });
	}
}
function handleFontSizeBlur() {
	const parsed = parseInt(fontSizeInput.value, 10);
	const fontSize = Number.isNaN(parsed) ? props.element.fontSize : clamp(parsed, 8, 300);
	fontSizeInput.value = fontSize.toString();
	update({ fontSize });
}

// ── Opacity ──
function handleOpacityChange(value: string) {
	opacityInput.value = value;
	if (value.trim() !== "") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) update({ opacity: clamp(parsed, 0, 100) / 100 });
	}
}
function handleOpacityBlur() {
	const parsed = parseInt(opacityInput.value, 10);
	const opacity = Number.isNaN(parsed) ? props.element.opacity : clamp(parsed, 0, 100) / 100;
	opacityInput.value = Math.round(opacity * 100).toString();
	update({ opacity });
}

// ── Max words ──
function handleMaxWordsChange(value: string) {
	maxWordsInput.value = value;
	if (value.trim() !== "") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) update({ maxWordsPerLine: clamp(parsed, 1, 10) });
	}
}
function handleMaxWordsBlur() {
	const parsed = parseInt(maxWordsInput.value, 10);
	const maxWords = Number.isNaN(parsed) ? props.element.maxWordsPerLine : clamp(parsed, 1, 10);
	maxWordsInput.value = maxWords.toString();
	update({ maxWordsPerLine: maxWords });
}

// ── Scale ──
function handleScaleSlider(value: string) {
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		scaleInput.value = parsed.toString();
		update({ transform: { ...props.element.transform, scale: parsed / 100 } });
	}
}
function handleScaleInput(value: string) {
	scaleInput.value = value;
	if (value.trim() !== "") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) {
			update({ transform: { ...props.element.transform, scale: clamp(parsed, 10, 500) / 100 } });
		}
	}
}
function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const scale = Number.isNaN(parsed) ? props.element.transform.scale * 100 : clamp(parsed, 10, 500);
	scaleInput.value = Math.round(scale).toString();
	update({ transform: { ...props.element.transform, scale: scale / 100 } });
}

// ── Position ──
function handlePosXChange(value: string) {
	posXInput.value = value;
	if (value.trim() !== "" && value !== "-") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) {
			update({ transform: { ...props.element.transform, position: { ...props.element.transform.position, x: parsed } } });
		}
	}
}
function handlePosYChange(value: string) {
	posYInput.value = value;
	if (value.trim() !== "" && value !== "-") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) {
			update({ transform: { ...props.element.transform, position: { ...props.element.transform.position, y: parsed } } });
		}
	}
}

// ── Rotation ──
function handleRotationChange(value: string) {
	rotationInput.value = value;
	if (value.trim() !== "" && value !== "-") {
		const parsed = parseFloat(value);
		if (!Number.isNaN(parsed)) {
			update({ transform: { ...props.element.transform, rotate: parsed } });
		}
	}
}

// ── Reset transform ──
function resetTransform() {
	update({ transform: { scale: 1, position: { x: 0, y: 200 }, rotate: 0 } });
}

// ── Font ──
/** Font list for the family select; keeps the current family listed even if it isn't loaded. */
const fontOptions = computed(() => {
	const options = allFonts.value.map((font) => ({ value: font.family, label: font.family }));
	if (props.element.fontFamily && !options.some((o) => o.value === props.element.fontFamily)) {
		options.unshift({ value: props.element.fontFamily, label: props.element.fontFamily });
	}
	return options;
});

const FONT_WEIGHT_OPTIONS = [
	{ value: "normal", label: "Normal" },
	{ value: "bold", label: "Bold" },
	...["100", "200", "300", "400", "500", "600", "700", "800", "900"].map((w) => ({ value: w, label: w })),
];

const TEXT_ALIGN_OPTIONS = [
	{ value: "left", label: "Align left", icon: AlignLeft },
	{ value: "center", label: "Align center", icon: AlignCenter },
	{ value: "right", label: "Align right", icon: AlignRight },
] as const;

function selectFont(fontFamily: string, filePath?: string) {
	if (filePath) ensureFontLoaded(fontFamily, filePath);
	update({ fontFamily, fontFilePath: filePath });
}

// ── Presets ──
function applyPreset(presetId: CaptionPresetId) {
	const preset = getPresetById(presetId);

	const styleUpdates: Record<string, unknown> = {
		presetId: preset.id,
		highlightStyle: preset.highlightStyle,
		highlightColor: preset.highlightColor,
		color: preset.color,
		backgroundColor: preset.backgroundColor,
		fontSize: preset.fontSize,
		fontFamily: preset.fontFamily,
		fontWeight: preset.fontWeight,
		fontStyle: preset.fontStyle,
		letterSpacing: preset.letterSpacing,
		lineHeight: preset.lineHeight,
		stroke: preset.stroke,
		shadow: preset.shadow,
		glow: preset.glow,
		gradient: preset.gradient,
		maxWordsPerLine: preset.maxWordsPerLine,
	};

	// When maxWordsPerLine changes, we must re-group words into new lines
	const targets = applyToAll.value ? allCaptionElements.value : [{ trackId: props.trackId, element: props.element }];

	for (const { trackId, element } of targets) {
		if (element.maxWordsPerLine !== preset.maxWordsPerLine) {
			// Collect all words from all lines in this element
			const allWords = element.lines.flatMap(l => l.words);
			if (allWords.length === 0) {
				editor.timeline.updateCaptionElement({ trackId, elementId: element.id, updates: styleUpdates as any });
				continue;
			}

			// Re-group words into new lines with the new maxWordsPerLine
			const newMaxPerLine = preset.maxWordsPerLine;
			const newLines: CaptionLine[] = [];
			for (let i = 0; i < allWords.length; i += newMaxPerLine) {
				const chunk = allWords.slice(i, i + newMaxPerLine);
				newLines.push({
					text: chunk.map(w => w.word).join(" "),
					words: chunk,
					startTime: chunk[0].start,
					endTime: chunk[chunk.length - 1].end,
				});
			}

			editor.timeline.updateCaptionElement({
				trackId,
				elementId: element.id,
				updates: {
					...styleUpdates,
					lines: newLines,
				} as any,
			});
		} else {
			editor.timeline.updateCaptionElement({ trackId, elementId: element.id, updates: styleUpdates as any });
		}
	}
}

// ── Highlight styles ──
const highlightStyles: { value: CaptionElement["highlightStyle"]; label: string }[] = [
	{ value: "none", label: "None" },
	{ value: "karaoke", label: "Karaoke" },
	{ value: "karaoke-scale", label: "Karaoke pop" },
	{ value: "underline", label: "Underline" },
	{ value: "background", label: "Background" },
	{ value: "glow", label: "Glow" },
];

// ── Caption line editing ──
const pendingCaptionLineFocus = ref<string | null>(null);

function captionLineInputKey(item: { elementId: string; elementLocalIndex: number }) {
	return `${item.elementId}-${item.elementLocalIndex}`;
}

async function focusPendingCaptionLineInput() {
	const key = pendingCaptionLineFocus.value;
	if (!key) return;
	pendingCaptionLineFocus.value = null;
	await nextTick();
	const input = document.querySelector<HTMLInputElement>(`[data-caption-line-key="${key}"]`);
	input?.focus();
	const len = input?.value.length ?? 0;
	input?.setSelectionRange(len, len);
}

function seekToLine(line: CaptionLine) {
	editor.playback.seek({ time: line.startTime });
}

function updateCaptionLineText(trackId: string, elementId: string, lineIndex: number, newText: string) {
	const captionEl = allCaptionElements.value.find(c => c.element.id === elementId);
	if (!captionEl) return;
	const newLines = captionEl.element.lines.map((l, i) => {
		if (i !== lineIndex) return l;
		// Update the line text and each word's text
		const words = newText.split(/\s+/).filter(Boolean);
		const updatedWords = l.words.map((w, wi) => ({
			...w,
			word: words[wi] ?? "",
		}));
		// If user added more words than existed, append new word entries using last word's timing
		const lastWord = l.words[l.words.length - 1];
		for (let wi = l.words.length; wi < words.length; wi++) {
			updatedWords.push({
				word: words[wi],
				start: lastWord?.end ?? l.startTime,
				end: lastWord?.end ?? l.endTime,
				confidence: 1,
			});
		}
		// Remove empty trailing words if user deleted words
		const filtered = updatedWords.filter(w => w.word !== "");
		return {
			...l,
			text: newText,
			words: filtered.length > 0 ? filtered : l.words,
		};
	});
	editor.timeline.updateCaptionElement({
		trackId,
		elementId,
		updates: { lines: newLines } as any,
	});
}

function splitCaptionLineAtCursor(
	trackId: string,
	elementId: string,
	lineIndex: number,
	cursor: number,
	lineText?: string,
) {
	const insertedElementId = editor.timeline.splitCaptionLine({
		trackId,
		elementId,
		lineIndex,
		cursor,
		lineText,
	});
	if (insertedElementId) {
		pendingCaptionLineFocus.value = `${insertedElementId}-0`;
		void focusPendingCaptionLineInput();
	}
}

function handleCaptionLineKeydown(
	event: KeyboardEvent,
	item: { trackId: string; elementId: string; elementLocalIndex: number },
) {
	if (event.key !== "Enter" || !event.shiftKey) return;
	event.preventDefault();
	const input = event.target as HTMLInputElement;
	splitCaptionLineAtCursor(
		item.trackId,
		item.elementId,
		item.elementLocalIndex,
		input.selectionStart ?? input.value.length,
		input.value,
	);
}

function deleteCaptionLine(trackId: string, elementId: string, lineIndex: number) {
	const captionEl = allCaptionElements.value.find(c => c.element.id === elementId);
	if (!captionEl) return;
	const newLines = [...captionEl.element.lines];
	newLines.splice(lineIndex, 1);
	if (newLines.length === 0) {
		// Remove the entire element if no lines left
		editor.timeline.deleteElements({ elements: [{ trackId, elementId }] });
	} else {
		editor.timeline.updateCaptionElement({
			trackId,
			elementId,
			updates: {
				lines: newLines,
				startTime: newLines[0].startTime,
				duration: newLines[newLines.length - 1].endTime - newLines[0].startTime,
			} as any,
		});
	}
}

// ── Template category filter ──
const CATEGORY_LABELS: Record<CaptionPresetCategory, string> = {
	"single-word": "Single word",
	classic: "Classic",
	creator: "Creator",
	colorful: "Colorful",
	effects: "Effects",
};
const CATEGORY_ORDER: CaptionPresetCategory[] = ["single-word", "classic", "creator", "colorful", "effects"];
const activeTemplateCategory = ref<CaptionPresetCategory | "all">("all");

const filteredPresets = computed(() => {
	if (activeTemplateCategory.value === "all") return CAPTION_PRESETS;
	return CAPTION_PRESETS.filter(p => p.category === activeTemplateCategory.value);
});

const groupedPresets = computed(() => {
	if (activeTemplateCategory.value !== "all") {
		return [{ category: activeTemplateCategory.value as CaptionPresetCategory, label: CATEGORY_LABELS[activeTemplateCategory.value as CaptionPresetCategory], presets: filteredPresets.value }];
	}
	return CATEGORY_ORDER.map(cat => ({
		category: cat,
		label: CATEGORY_LABELS[cat],
		presets: CAPTION_PRESETS.filter(p => p.category === cat),
	})).filter(g => g.presets.length > 0);
});

// ── Animation presets (export parity: fade + raster sequence in renderer-manager) ──
const captionAnimInPresets = computed(() => getExportableAnimationPresetsForDirection("in"));
const captionAnimOutPresets = computed(() => getExportableAnimationPresetsForDirection("out"));
const captionAnimLoopPresets = computed(() => getExportableAnimationPresetsForDirection("loop"));

function setAnimation(direction: "in" | "out" | "loop", type: AnimationType | null) {
	const preset = type ? ANIMATION_PRESETS.find(p => p.type === type) : null;
	if (direction === "in") {
		update({
			animationIn: preset ? { type: preset.type, duration: preset.defaultDuration, easing: preset.defaultEasing } : undefined,
		});
	} else if (direction === "out") {
		update({
			animationOut: preset ? { type: preset.type, duration: preset.defaultDuration, easing: preset.defaultEasing } : undefined,
		});
	} else {
		update({
			animationLoop: preset ? { type: preset.type, duration: preset.defaultDuration, easing: preset.defaultEasing } : undefined,
		});
	}
}

const currentAnimIn = computed(() => props.element.animationIn?.type ?? null);
const currentAnimOut = computed(() => props.element.animationOut?.type ?? null);
const currentAnimLoop = computed(() => props.element.animationLoop?.type ?? null);

// Preset tiles + current selection for the active In / Out / Loop sub-tab
const activeAnimPresets = computed(() =>
	activeAnimSubTab.value === "in"
		? captionAnimInPresets.value
		: activeAnimSubTab.value === "out"
			? captionAnimOutPresets.value
			: captionAnimLoopPresets.value,
);
const activeAnimType = computed(() =>
	activeAnimSubTab.value === "in"
		? currentAnimIn.value
		: activeAnimSubTab.value === "out"
			? currentAnimOut.value
			: currentAnimLoop.value,
);
function animTileLabel(label: string) {
	if (activeAnimSubTab.value === "in") return label.replace(" In", "");
	if (activeAnimSubTab.value === "out") return label.replace(" Out", "");
	return label;
}

// ── Text effect toggles (Switch) ──
function setStrokeEnabled(on: boolean) {
	showStroke.value = on;
	update({ stroke: showStroke.value ? { color: props.element.stroke?.color || "#000000", width: props.element.stroke?.width || 3 } : undefined });
}
function setShadowEnabled(on: boolean) {
	showShadow.value = on;
	update({ shadow: showShadow.value ? { color: props.element.shadow?.color || "rgba(0,0,0,0.8)", offsetX: 2, offsetY: 2, blur: 4 } : undefined });
}
function setGlowEnabled(on: boolean) {
	showGlow.value = on;
	update({ glow: showGlow.value ? { color: props.element.glow?.color || "#22D3EE", intensity: props.element.glow?.intensity || 10 } : undefined });
}

const captionText = computed(() => {
	return props.element.lines.map((l) => l.text).join("\n");
});

const wordCount = computed(() => {
	return props.element.lines.reduce((sum, l) => sum + l.words.length, 0);
});

// ── Upload custom font ──
async function handleUploadFont() {
	const font = await uploadCustomFont();
	if (font) {
		// Apply the newly uploaded font to the caption
		update({ fontFamily: font.family, fontFilePath: font.filePath });
	}
}
</script>

<template>
	<div class="flex h-full min-h-0 flex-row">
		<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<!-- ══════ Captions tab — line-by-line breakdown ══════ -->
			<div v-if="activeTopTab === 'captions'" class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
				<InspectorSection title="Caption lines" flush body-class="space-y-0 px-1.5">
					<template v-if="paragraphCount > 0" #meta>
						<Badge variant="neutral" class="tabular">{{ paragraphCount }}</Badge>
					</template>

					<div
						v-for="item in allCaptionLines"
						:key="`${item.elementId}-${item.lineIndex}`"
						class="group/line flex h-8 items-center gap-1 rounded-md pr-0.5 transition-colors hover:bg-surface-hover"
					>
						<!-- Line number (click to seek) -->
						<button
							type="button"
							class="tabular h-6 w-7 shrink-0 rounded text-right text-2xs text-fg-subtle transition-colors hover:text-brand focus-visible:outline-none focus-visible:text-brand"
							title="Seek to line"
							@click="seekToLine(item.line)"
						>{{ item.globalIndex + 1 }}</button>

						<!-- Editable line text -->
						<input
							type="text"
							:value="item.line.text"
							:data-caption-line-key="captionLineInputKey(item)"
							aria-label="Caption line text"
							class="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-xs text-fg-muted outline-none transition-colors hover:text-fg focus:border-brand-line focus:bg-surface-raised focus:text-fg"
							@change="updateCaptionLineText(item.trackId, item.elementId, item.elementLocalIndex, ($event.target as HTMLInputElement).value)"
							@keydown="handleCaptionLineKeydown($event, item)"
							@click.stop
						/>

						<!-- Actions (visible on hover) -->
						<Button
							variant="ghost"
							size="icon-xs"
							class="opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover/line:opacity-100 focus-visible:opacity-100"
							title="Delete line"
							aria-label="Delete line"
							@click.stop="deleteCaptionLine(item.trackId, item.elementId, item.elementLocalIndex)"
						>
							<Trash2 />
						</Button>
					</div>

					<EmptyState
						v-if="allCaptionLines.length === 0"
						size="sm"
						:icon="Captions"
						title="No caption lines generated yet"
					/>
				</InspectorSection>
			</div>

			<!-- ══════ Text + Animation tabs ══════ -->
			<template v-else>
				<!-- Sub-tabs + "apply to all" (pinned above the scroll area) -->
				<div class="shrink-0 space-y-2 border-b border-line-subtle px-3 py-2">
					<SegmentedControl
						v-if="activeTopTab === 'text'"
						v-model="activeTextSubTab"
						:options="TEXT_SUB_TAB_OPTIONS"
						size="sm"
						block
					/>
					<SegmentedControl
						v-else
						v-model="activeAnimSubTab"
						:options="ANIM_SUB_TAB_OPTIONS"
						size="sm"
						block
					/>
					<label class="flex h-5 cursor-pointer items-center gap-2 text-xs text-fg-muted">
						<Checkbox
							:model-value="applyToAll"
							@update:model-value="(v) => (applyToAll = v === true)"
						/>
						Apply to all main captions
					</label>
				</div>

				<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
					<!-- ── Text › Style (presets + customize) ── -->
					<template v-if="activeTopTab === 'text' && activeTextSubTab === 'style'">
						<InspectorSection title="Style preset">
							<!-- Category filter -->
							<div class="flex flex-wrap gap-1">
								<OptionChip :active="activeTemplateCategory === 'all'" @click="activeTemplateCategory = 'all'">All</OptionChip>
								<OptionChip
									v-for="cat in CATEGORY_ORDER"
									:key="cat"
									:active="activeTemplateCategory === cat"
									@click="activeTemplateCategory = cat"
								>
									{{ CATEGORY_LABELS[cat] }}
								</OptionChip>
							</div>

							<!-- Grouped preset tiles (previews show the preset's own styling) -->
							<div v-for="group in groupedPresets" :key="group.category" class="space-y-1.5">
								<SectionHeader :title="group.label" variant="eyebrow" class="min-h-0" />
								<AssetGrid :min="76" class="gap-1.5">
									<AssetTile
										v-for="preset in group.presets"
										:key="preset.id"
										:label="preset.name"
										:title="preset.description"
										:selected="element.presetId === preset.id"
										aspect="2/1"
										preview-class="flex items-center justify-center p-1.5"
										@click="applyPreset(preset.id)"
									>
										<div
											class="flex h-8 w-full items-center justify-center rounded font-bold"
											:class="preset.maxWordsPerLine === 1 ? 'text-sm' : 'text-2xs'"
											:style="{
												color: preset.color === 'transparent' ? (preset.stroke?.color || '#FFFFFF') : preset.color,
												fontFamily: preset.fontFamily,
												fontWeight: preset.fontWeight,
												fontStyle: preset.fontStyle,
												letterSpacing: preset.letterSpacing + 'px',
												backgroundColor: preset.backgroundColor && preset.backgroundColor !== 'transparent' ? preset.backgroundColor : undefined,
												padding: preset.backgroundColor && preset.backgroundColor !== 'transparent' ? '2px 5px' : undefined,
												borderRadius: preset.backgroundColor && preset.backgroundColor !== 'transparent' ? '3px' : undefined,
											}"
										>Aa</div>
									</AssetTile>
								</AssetGrid>
							</div>
						</InspectorSection>

						<InspectorSection
							title="Customize"
							collapsible
							flush
							:open="showCustomize"
							@update:open="(v) => (showCustomize = v)"
						>
							<!-- Transform -->
							<div class="space-y-2">
								<SectionHeader title="Transform" variant="eyebrow" class="min-h-6">
									<Button variant="ghost" size="xs" title="Reset transform" @click="resetTransform">
										<RotateCcw />
										Reset
									</Button>
								</SectionHeader>
								<SliderField
									inline
									label="Scale"
									:model-value="Math.round(element.transform.scale * 100)"
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
									label="Position X"
									:model-value="Math.round(element.transform.position.x)"
									:input-value="posXInput"
									:min="-1000"
									:max="1000"
									input-type="text"
									@slide="(v) => handlePosXChange(String(v))"
									@input="handlePosXChange"
								/>
								<SliderField
									inline
									label="Position Y"
									:model-value="Math.round(element.transform.position.y)"
									:input-value="posYInput"
									:min="-1000"
									:max="1000"
									input-type="text"
									@slide="(v) => handlePosYChange(String(v))"
									@input="handlePosYChange"
								/>
								<SliderField
									inline
									label="Rotation"
									:model-value="element.transform.rotate"
									:input-value="rotationInput"
									:min="-180"
									:max="180"
									:step="0.1"
									input-type="text"
									@slide="(v) => handleRotationChange(String(v))"
									@input="handleRotationChange"
								/>
							</div>

							<!-- Font -->
							<div class="space-y-3 border-t border-line-subtle pt-3">
								<SectionHeader title="Font" variant="eyebrow" class="min-h-6">
									<Button variant="ghost" size="xs" title="Upload custom font" @click="handleUploadFont">
										<Plus />
										Upload font
									</Button>
								</SectionHeader>

								<InspectorSelect
									:model-value="element.fontFamily"
									:options="fontOptions"
									aria-label="Font family"
									@update:model-value="(v) => selectFont(String(v))"
								/>

								<InspectorField label="Fill color">
									<ColorSwatchField
										app-picker
										:model-value="element.color"
										aria-label="Fill color"
										@update:model-value="(v) => update({ color: v })"
									/>
								</InspectorField>

								<div class="grid grid-cols-2 gap-2">
									<InspectorField label="Size">
										<NumberBox
											type="text"
											:value="fontSizeInput"
											aria-label="Font size"
											@input="handleFontSizeChange"
											@commit="handleFontSizeBlur"
										/>
									</InspectorField>
									<InspectorField label="Weight">
										<InspectorSelect
											:model-value="element.fontWeight"
											:options="FONT_WEIGHT_OPTIONS"
											aria-label="Font weight"
											@update:model-value="(v) => update({ fontWeight: String(v) })"
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
											:active="element.textAlign === opt.value"
											:title="opt.label"
											:aria-label="opt.label"
											class="flex-1"
											@click="update({ textAlign: opt.value })"
										/>
									</ChipGroup>
								</InspectorField>

								<div class="grid grid-cols-2 gap-2">
									<InspectorField label="Words / line">
										<NumberBox
											type="text"
											:value="maxWordsInput"
											aria-label="Words per line"
											@input="handleMaxWordsChange"
											@commit="handleMaxWordsBlur"
										/>
									</InspectorField>
									<InspectorField label="Opacity">
										<NumberBox
											type="text"
											:value="opacityInput"
											suffix="%"
											aria-label="Opacity"
											@input="handleOpacityChange"
											@commit="handleOpacityBlur"
										/>
									</InspectorField>
								</div>
							</div>
						</InspectorSection>
					</template>

					<!-- ── Text › Effects ── -->
					<template v-else-if="activeTopTab === 'text' && activeTextSubTab === 'effects'">
						<!-- Highlight (karaoke) — lives with effects to avoid duplicating style preset colors -->
						<InspectorSection title="Highlight">
							<InspectorField inline label="Style">
								<InspectorSelect
									:model-value="element.highlightStyle"
									:options="highlightStyles"
									aria-label="Highlight style"
									class="flex-1"
									@update:model-value="(v) => update({ highlightStyle: String(v) })"
								/>
							</InspectorField>
							<InspectorField inline label="Active word">
								<ColorSwatchField
									app-picker
									:model-value="element.highlightColor"
									aria-label="Active word color"
									class="flex-1"
									@update:model-value="(v) => update({ highlightColor: v })"
								/>
							</InspectorField>
						</InspectorSection>

						<InspectorSection title="Effects" flush>
							<!-- Stroke -->
							<div class="space-y-2">
								<InspectorField inline label="Stroke">
									<div class="flex-1" />
									<Switch :model-value="showStroke" aria-label="Stroke" @update:model-value="setStrokeEnabled" />
								</InspectorField>
								<template v-if="showStroke && element.stroke">
									<InspectorField inline label="Color">
										<ColorSwatchField
											app-picker
											:model-value="element.stroke.color.startsWith('#') ? element.stroke.color : '#000000'"
											aria-label="Stroke color"
											class="flex-1"
											@update:model-value="(v) => update({ stroke: { ...element.stroke!, color: v } })"
										/>
									</InspectorField>
									<SliderField
										inline
										label="Width"
										:model-value="element.stroke.width"
										:min="1"
										:max="10"
										:readout="String(element.stroke.width)"
										@slide="(v) => update({ stroke: { ...element.stroke!, width: v } })"
									/>
								</template>
							</div>

							<!-- Shadow -->
							<div class="space-y-2 border-t border-line-subtle pt-3">
								<InspectorField inline label="Shadow">
									<div class="flex-1" />
									<Switch :model-value="showShadow" aria-label="Shadow" @update:model-value="setShadowEnabled" />
								</InspectorField>
								<template v-if="showShadow && element.shadow">
									<InspectorField inline label="Color">
										<ColorSwatchField
											app-picker
											:model-value="element.shadow.color.startsWith('#') ? element.shadow.color : '#000000'"
											aria-label="Shadow color"
											class="flex-1"
											@update:model-value="(v) => update({ shadow: { ...element.shadow!, color: v } })"
										/>
									</InspectorField>
									<SliderField
										inline
										label="Blur"
										:model-value="element.shadow.blur"
										:min="0"
										:max="20"
										:readout="String(element.shadow.blur)"
										@slide="(v) => update({ shadow: { ...element.shadow!, blur: v } })"
									/>
								</template>
							</div>

							<!-- Glow -->
							<div class="space-y-2 border-t border-line-subtle pt-3">
								<InspectorField inline label="Glow">
									<div class="flex-1" />
									<Switch :model-value="showGlow" aria-label="Glow" @update:model-value="setGlowEnabled" />
								</InspectorField>
								<template v-if="showGlow && element.glow">
									<InspectorField inline label="Color">
										<ColorSwatchField
											app-picker
											:model-value="element.glow.color"
											aria-label="Glow color"
											class="flex-1"
											@update:model-value="(v) => update({ glow: { ...element.glow!, color: v } })"
										/>
									</InspectorField>
									<SliderField
										inline
										label="Intensity"
										:model-value="element.glow.intensity"
										:min="1"
										:max="30"
										:readout="String(element.glow.intensity)"
										@slide="(v) => update({ glow: { ...element.glow!, intensity: v } })"
									/>
								</template>
							</div>

							<!-- Background color -->
							<InspectorField label="Background" class="border-t border-line-subtle pt-3">
								<template v-if="element.backgroundColor === 'transparent'" #actions>
									<Button variant="ghost" size="xs" class="-my-1" @click="update({ backgroundColor: '#1a1a1a' })">Set color</Button>
								</template>
								<ColorSwatchField
									app-picker
									:model-value="element.backgroundColor === 'transparent' ? '' : element.backgroundColor"
									fallback="#1a1a1a"
									placeholder="None"
									clearable
									aria-label="Background color"
									@update:model-value="(v) => update({ backgroundColor: v })"
									@clear="update({ backgroundColor: 'transparent' })"
								/>
							</InspectorField>
						</InspectorSection>
					</template>

					<!-- ── Animation › In / Out / Loop ── -->
					<InspectorSection v-else-if="activeTopTab === 'animation'" flush>
						<p class="text-2xs text-fg-subtle">Plays in preview and export.</p>
						<AssetGrid :min="72" class="gap-1.5">
							<AssetTile
								label="None"
								aspect="2/1"
								:selected="!activeAnimType"
								preview-class="grid place-items-center"
								@click="setAnimation(activeAnimSubTab, null)"
							>
								<Ban class="size-5 text-fg-subtle" />
							</AssetTile>
							<AssetTile
								v-for="preset in activeAnimPresets"
								:key="preset.type"
								:label="animTileLabel(preset.label)"
								:title="preset.label"
								aspect="2/1"
								:selected="activeAnimType === preset.type"
								preview-class="grid place-items-center"
								@click="setAnimation(activeAnimSubTab, preset.type)"
							>
								<span class="text-xs font-bold text-fg-muted">Aa</span>
							</AssetTile>
						</AssetGrid>
					</InspectorSection>
				</div>
			</template>
		</div>

		<InspectorTabRail v-model="activeTopTab" :tabs="topTabs" />
	</div>
</template>
