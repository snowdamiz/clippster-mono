<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import type {
	CaptionElement,
	CaptionPresetId,
	CaptionHighlightStyle,
	CaptionLine,
	CaptionTrack,
} from "../../../types/timeline";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPresetCategory } from "../../../constants/caption-constants";
import { ANIMATION_PRESETS, getPresetsForDirection } from "../../../constants/animation-constants";
import type { AnimationType } from "../../../types/animations";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	ChevronDown,
	ChevronUp,
	AlignLeft,
	AlignCenter,
	AlignRight,
	RotateCcw,
	Plus,
	Trash2,
	Check,
} from "lucide-vue-next";

const props = defineProps<{
	element: CaptionElement;
	trackId: string;
}>();

const { editor, version } = useEditor();
const { allFonts, ensureFontLoaded, uploadCustomFont } = useFontManager();

// ── Top-level tabs (CapCut style) ──
type TopTab = "captions" | "text" | "animation";
const activeTopTab = ref<TopTab>("captions");

// ── Text sub-tabs ──
type TextSubTab = "basic" | "templates" | "effects";
const activeTextSubTab = ref<TextSubTab>("basic");

// ── Animation sub-tabs ──
type AnimSubTab = "in" | "out" | "loop" | "captions";
const activeAnimSubTab = ref<AnimSubTab>("in");

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

// ── Watchers ──
watch(() => props.element.fontSize, (v) => { fontSizeInput.value = v.toString(); });
watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.maxWordsPerLine, (v) => { maxWordsInput.value = v.toString(); });
watch(() => props.element.transform.scale, (v) => { scaleInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.position.x, (v) => { posXInput.value = Math.round(v).toString(); });
watch(() => props.element.transform.position.y, (v) => { posYInput.value = Math.round(v).toString(); });
watch(() => props.element.transform.rotate, (v) => { rotationInput.value = v.toFixed(2); });
watch(() => props.element.stroke, (v) => { showStroke.value = !!v; });
watch(() => props.element.shadow, (v) => { showShadow.value = !!v; });
watch(() => props.element.glow, (v) => { showGlow.value = !!v; });

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
	if (applyToAll.value) {
		for (const { trackId, element } of allCaptionElements.value) {
			editor.timeline.updateCaptionElement({
				trackId,
				elementId: element.id,
				updates: updates as any,
			});
		}
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
const highlightStyles: { value: CaptionHighlightStyle; label: string }[] = [
	{ value: "none", label: "None" },
	{ value: "karaoke", label: "Karaoke" },
	{ value: "karaoke-scale", label: "Karaoke Pop" },
	{ value: "underline", label: "Underline" },
	{ value: "background", label: "Background" },
	{ value: "glow", label: "Glow" },
];

// ── Caption line editing ──
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
	"single-word": "Single Word",
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

// ── Animation presets ──
const animInPresets = computed(() => getPresetsForDirection("in"));
const animOutPresets = computed(() => getPresetsForDirection("out"));
const animLoopPresets = computed(() => getPresetsForDirection("loop"));

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
	<div class="flex flex-col text-xs">
		<!-- ═══ Top-level tab bar (CapCut style) ═══ -->
		<div class="flex border-b border-white/10">
			<button
				v-for="tab in (['captions', 'text', 'animation'] as TopTab[])"
				:key="tab"
				class="flex-1 py-2 text-center text-xs font-medium capitalize transition-colors"
				:class="activeTopTab === tab ? 'text-sky-400 border-b-2 border-sky-400' : 'text-zinc-400 hover:text-zinc-200'"
				@click="activeTopTab = tab"
			>
				{{ tab === 'captions' ? 'Captions' : tab === 'text' ? 'Text' : 'Animation' }}
			</button>
		</div>

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Captions — line-by-line breakdown     -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-if="activeTopTab === 'captions'" class="flex flex-col gap-0 overflow-y-auto" style="max-height: calc(100vh - 200px)">
			<!-- Paragraph count header -->
			<div class="px-3 pt-3 pb-2 text-zinc-500 text-[11px]">
				The {{ paragraphCount }} paragraph{{ paragraphCount !== 1 ? 's' : '' }}
			</div>

			<!-- Line list -->
			<div class="flex flex-col">
				<div
					v-for="item in allCaptionLines"
					:key="`${item.elementId}-${item.lineIndex}`"
					class="group flex items-start gap-2 border-b border-white/5 px-3 py-2.5 hover:bg-white/[0.03]"
				>
					<!-- Line number (click to seek) -->
					<span
						class="mt-1 w-5 shrink-0 text-right text-zinc-500 text-[11px] cursor-pointer hover:text-sky-400 transition-colors"
						title="Seek to line"
						@click="seekToLine(item.line)"
					>{{ item.globalIndex + 1 }}</span>

					<!-- Editable line text -->
					<input
						type="text"
						:value="item.line.text"
						class="flex-1 bg-transparent border-none outline-none text-zinc-300 text-[11px] leading-relaxed px-0 py-0 focus:text-white focus:ring-0"
						@change="updateCaptionLineText(item.trackId, item.elementId, item.elementLocalIndex, ($event.target as HTMLInputElement).value)"
						@click.stop
					/>

					<!-- Action buttons (visible on hover) -->
					<div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							class="rounded p-1 hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
							title="Delete line"
							@click.stop="deleteCaptionLine(item.trackId, item.elementId, item.elementLocalIndex)"
						>
							<Trash2 class="size-3" />
						</button>
					</div>
				</div>
			</div>

			<!-- Empty state -->
			<div v-if="allCaptionLines.length === 0" class="px-3 py-6 text-center text-zinc-500 text-[11px]">
				No caption lines generated yet.
			</div>
		</div>

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Text — Basic / Templates / Effects    -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-else-if="activeTopTab === 'text'" class="flex flex-col overflow-y-auto" style="max-height: calc(100vh - 200px)">
			<!-- Sub-tab bar -->
			<div class="flex border-b border-white/10 mx-3 mt-2">
				<button
					v-for="sub in (['basic', 'templates', 'effects'] as TextSubTab[])"
					:key="sub"
					class="flex-1 pb-2 text-center text-[11px] font-medium capitalize transition-colors"
					:class="activeTextSubTab === sub ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'"
					@click="activeTextSubTab = sub"
				>
					{{ sub }}
				</button>
			</div>

			<!-- Apply to all checkbox -->
			<div class="flex items-center gap-2 px-3 pt-3 pb-1">
				<button
					class="flex size-4 items-center justify-center rounded border transition-colors"
					:class="applyToAll ? 'border-sky-500 bg-sky-500' : 'border-white/20 bg-transparent'"
					@click="applyToAll = !applyToAll"
				>
					<Check v-if="applyToAll" class="size-3 text-white" />
				</button>
				<span class="text-zinc-400 text-[11px]">Apply to all main captions</span>
			</div>

			<!-- ── Basic sub-tab ── -->
			<div v-if="activeTextSubTab === 'basic'" class="flex flex-col gap-3 p-3">
				<!-- Caption text preview -->
				<div class="rounded-md border border-white/5 bg-white/[0.02] p-2">
					<pre class="max-h-20 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">{{ captionText }}</pre>
				</div>

				<!-- ── Transform section ── -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-zinc-400 font-medium">Transform</span>
						<button class="text-zinc-500 hover:text-zinc-300" title="Reset transform" @click="resetTransform">
							<RotateCcw class="size-3.5" />
						</button>
					</div>

					<!-- Scale slider -->
					<div class="space-y-1">
						<label class="text-zinc-500">Scale</label>
						<div class="flex items-center gap-2">
							<input
								type="range"
								min="10"
								max="500"
								:value="Math.round(element.transform.scale * 100)"
								class="flex-1 accent-sky-500"
								@input="handleScaleSlider(($event.target as HTMLInputElement).value)"
							/>
							<div class="flex items-center">
								<input
									type="text"
									:value="scaleInput"
									class="h-6 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
									@input="handleScaleInput(($event.target as HTMLInputElement).value)"
									@blur="handleScaleBlur"
								/>
								<span class="ml-0.5 text-zinc-500">%</span>
							</div>
						</div>
					</div>

					<!-- Position X / Y -->
					<div class="flex gap-2">
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">X</label>
							<input
								type="text"
								:value="posXInput"
								class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
								@input="handlePosXChange(($event.target as HTMLInputElement).value)"
							/>
						</div>
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Y</label>
							<input
								type="text"
								:value="posYInput"
								class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
								@input="handlePosYChange(($event.target as HTMLInputElement).value)"
							/>
						</div>
					</div>

					<!-- Rotation -->
					<div class="space-y-1">
						<label class="text-zinc-500">Rotation</label>
						<input
							type="text"
							:value="rotationInput"
							class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
							@input="handleRotationChange(($event.target as HTMLInputElement).value)"
						/>
					</div>
				</div>

				<!-- ── Font section ── -->
				<div class="space-y-2 border-t border-white/5 pt-3">
					<div class="flex items-center justify-between">
						<span class="text-zinc-400 font-medium">Font</span>
						<button
							@click="handleUploadFont"
							class="flex items-center gap-1 px-2 py-1 text-[10px] text-sky-400 hover:text-sky-300 bg-sky-500/10 rounded transition-colors border border-sky-500/20"
							title="Upload custom font"
						>
							<Plus class="size-3" />
							Upload Font
						</button>
					</div>

					<!-- Font family -->
					<Select :model-value="element.fontFamily" @update:model-value="(v) => selectFont(String(v))">
						<SelectTrigger class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
							<SelectValue :placeholder="element.fontFamily" />
						</SelectTrigger>
						<SelectContent class="max-h-[250px] bg-zinc-900 border-white/10">
							<SelectItem v-for="font in allFonts" :key="font.family" :value="font.family" class="text-xs text-zinc-200">
								{{ font.family }}
							</SelectItem>
						</SelectContent>
					</Select>

					<!-- Font size + weight -->
					<div class="flex gap-2">
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Size</label>
							<input
								type="text"
								:value="fontSizeInput"
								class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
								@input="handleFontSizeChange(($event.target as HTMLInputElement).value)"
								@blur="handleFontSizeBlur"
							/>
						</div>
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Weight</label>
							<Select :model-value="element.fontWeight" @update:model-value="(v) => update({ fontWeight: String(v) })">
								<SelectTrigger class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
									<SelectValue />
								</SelectTrigger>
								<SelectContent class="bg-zinc-900 border-white/10">
									<SelectItem value="normal" class="text-xs text-zinc-200">Normal</SelectItem>
									<SelectItem value="bold" class="text-xs text-zinc-200">Bold</SelectItem>
									<SelectItem value="100" class="text-xs text-zinc-200">100</SelectItem>
									<SelectItem value="200" class="text-xs text-zinc-200">200</SelectItem>
									<SelectItem value="300" class="text-xs text-zinc-200">300</SelectItem>
									<SelectItem value="400" class="text-xs text-zinc-200">400</SelectItem>
									<SelectItem value="500" class="text-xs text-zinc-200">500</SelectItem>
									<SelectItem value="600" class="text-xs text-zinc-200">600</SelectItem>
									<SelectItem value="700" class="text-xs text-zinc-200">700</SelectItem>
									<SelectItem value="800" class="text-xs text-zinc-200">800</SelectItem>
									<SelectItem value="900" class="text-xs text-zinc-200">900</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<!-- Alignment -->
					<div class="flex gap-1">
						<button
							class="flex-1 rounded-md border p-1.5 transition-all"
							:class="element.textAlign === 'left' ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:bg-white/5'"
							@click="update({ textAlign: 'left' })"
						>
							<AlignLeft class="mx-auto size-3.5 text-zinc-300" />
						</button>
						<button
							class="flex-1 rounded-md border p-1.5 transition-all"
							:class="element.textAlign === 'center' ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:bg-white/5'"
							@click="update({ textAlign: 'center' })"
						>
							<AlignCenter class="mx-auto size-3.5 text-zinc-300" />
						</button>
						<button
							class="flex-1 rounded-md border p-1.5 transition-all"
							:class="element.textAlign === 'right' ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:bg-white/5'"
							@click="update({ textAlign: 'right' })"
						>
							<AlignRight class="mx-auto size-3.5 text-zinc-300" />
						</button>
					</div>

					<!-- Words/line + Opacity -->
					<div class="flex gap-2">
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Words/line</label>
							<input
								type="text"
								:value="maxWordsInput"
								class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
								@input="handleMaxWordsChange(($event.target as HTMLInputElement).value)"
								@blur="handleMaxWordsBlur"
							/>
						</div>
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Opacity %</label>
							<input
								type="text"
								:value="opacityInput"
								class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
								@input="handleOpacityChange(($event.target as HTMLInputElement).value)"
								@blur="handleOpacityBlur"
							/>
						</div>
					</div>
				</div>

				<!-- ── Highlight section ── -->
				<div class="space-y-2 border-t border-white/5 pt-3">
					<span class="text-zinc-400 font-medium">Highlight</span>
					<Select :model-value="element.highlightStyle" @update:model-value="(v) => update({ highlightStyle: String(v) })">
						<SelectTrigger class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
							<SelectValue />
						</SelectTrigger>
						<SelectContent class="bg-zinc-900 border-white/10">
							<SelectItem v-for="hs in highlightStyles" :key="hs.value" :value="hs.value" class="text-xs text-zinc-200">
								{{ hs.label }}
							</SelectItem>
						</SelectContent>
					</Select>

					<!-- Colors -->
					<div class="flex gap-3">
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Text</label>
							<div class="flex items-center gap-1.5">
								<input
									type="color"
									:value="element.color"
									class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
									@input="update({ color: ($event.target as HTMLInputElement).value })"
								/>
								<span class="text-zinc-400 text-[10px]">{{ element.color }}</span>
							</div>
						</div>
						<div class="flex-1 space-y-1">
							<label class="text-zinc-500">Active</label>
							<div class="flex items-center gap-1.5">
								<input
									type="color"
									:value="element.highlightColor"
									class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
									@input="update({ highlightColor: ($event.target as HTMLInputElement).value })"
								/>
								<span class="text-zinc-400 text-[10px]">{{ element.highlightColor }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- ── Templates sub-tab ── -->
			<div v-else-if="activeTextSubTab === 'templates'" class="flex flex-col gap-2 p-3">
				<!-- Category filter pills -->
				<div class="flex flex-wrap gap-1">
					<button
						class="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
						:class="activeTemplateCategory === 'all' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-zinc-200'"
						@click="activeTemplateCategory = 'all'"
					>All</button>
					<button
						v-for="cat in CATEGORY_ORDER"
						:key="cat"
						class="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
						:class="activeTemplateCategory === cat ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-zinc-200'"
						@click="activeTemplateCategory = cat"
					>{{ CATEGORY_LABELS[cat] }}</button>
				</div>

				<!-- Grouped preset sections -->
				<div v-for="group in groupedPresets" :key="group.category" class="flex flex-col gap-1.5">
					<span class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{{ group.label }}</span>
					<div class="grid grid-cols-3 gap-1.5">
						<button
							v-for="preset in group.presets"
							:key="preset.id"
							class="group relative flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all hover:border-white/20 hover:bg-white/5"
							:class="element.presetId === preset.id ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 bg-white/[0.02]'"
							@click="applyPreset(preset.id)"
						>
							<div
								class="flex h-8 w-full items-center justify-center rounded font-bold"
								:class="preset.maxWordsPerLine === 1 ? 'text-sm' : 'text-[11px]'"
								:style="{
									color: preset.color === 'transparent' ? (preset.stroke?.color || '#FFFFFF') : preset.color,
									fontFamily: preset.fontFamily,
									fontWeight: preset.fontWeight,
									fontStyle: preset.fontStyle,
									letterSpacing: preset.letterSpacing + 'px',
									textShadow: preset.stroke
										? `0 0 0 transparent, -1px -1px 0 ${preset.stroke.color}, 1px -1px 0 ${preset.stroke.color}, -1px 1px 0 ${preset.stroke.color}, 1px 1px 0 ${preset.stroke.color}`
										: preset.shadow
											? `${preset.shadow.offsetX}px ${preset.shadow.offsetY}px ${preset.shadow.blur}px ${preset.shadow.color}`
											: preset.glow
												? `0 0 ${preset.glow.intensity}px ${preset.glow.color}`
												: 'none',
									backgroundColor: preset.backgroundColor !== 'transparent' ? preset.backgroundColor : undefined,
								}"
							>
								<span :style="{ color: preset.highlightStyle !== 'none' ? preset.highlightColor : (preset.color === 'transparent' ? (preset.stroke?.color || '#FFFFFF') : preset.color) }">{{ preset.maxWordsPerLine === 1 ? 'Word' : 'Ab' }}</span>
								<span v-if="preset.maxWordsPerLine > 1" class="ml-0.5">Cd</span>
							</div>
							<span class="text-[9px] text-zinc-500 group-hover:text-zinc-400 truncate w-full">{{ preset.name }}</span>
						</button>
					</div>
				</div>
			</div>

			<!-- ── Effects sub-tab ── -->
			<div v-else-if="activeTextSubTab === 'effects'" class="flex flex-col gap-2 p-3">
				<!-- Stroke toggle -->
				<div class="flex items-center justify-between">
					<label class="text-zinc-400">Stroke</label>
					<button
						class="h-5 w-9 rounded-full transition-colors"
						:class="showStroke ? 'bg-sky-500' : 'bg-white/10'"
						@click="showStroke = !showStroke; update({ stroke: showStroke ? { color: element.stroke?.color || '#000000', width: element.stroke?.width || 3 } : undefined })"
					>
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showStroke ? 'translate-x-4' : 'translate-x-0.5'" />
					</button>
				</div>
				<div v-if="showStroke && element.stroke" class="flex gap-2 pl-2">
					<input type="color" :value="element.stroke.color" class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent" @input="update({ stroke: { ...element.stroke!, color: ($event.target as HTMLInputElement).value } })" />
					<input type="range" min="1" max="10" :value="element.stroke.width" class="flex-1 accent-sky-500" @input="update({ stroke: { ...element.stroke!, width: parseInt(($event.target as HTMLInputElement).value) } })" />
					<span class="w-6 text-right text-zinc-500">{{ element.stroke.width }}</span>
				</div>

				<!-- Shadow toggle -->
				<div class="flex items-center justify-between">
					<label class="text-zinc-400">Shadow</label>
					<button
						class="h-5 w-9 rounded-full transition-colors"
						:class="showShadow ? 'bg-sky-500' : 'bg-white/10'"
						@click="showShadow = !showShadow; update({ shadow: showShadow ? { color: element.shadow?.color || 'rgba(0,0,0,0.8)', offsetX: 2, offsetY: 2, blur: 4 } : undefined })"
					>
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showShadow ? 'translate-x-4' : 'translate-x-0.5'" />
					</button>
				</div>
				<div v-if="showShadow && element.shadow" class="space-y-1.5 pl-2">
					<div class="flex items-center gap-2">
						<input type="color" :value="element.shadow.color" class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent" @input="update({ shadow: { ...element.shadow!, color: ($event.target as HTMLInputElement).value } })" />
						<label class="text-zinc-500">Blur</label>
						<input type="range" min="0" max="20" :value="element.shadow.blur" class="flex-1 accent-sky-500" @input="update({ shadow: { ...element.shadow!, blur: parseInt(($event.target as HTMLInputElement).value) } })" />
						<span class="w-6 text-right text-zinc-500">{{ element.shadow.blur }}</span>
					</div>
				</div>

				<!-- Glow toggle -->
				<div class="flex items-center justify-between">
					<label class="text-zinc-400">Glow</label>
					<button
						class="h-5 w-9 rounded-full transition-colors"
						:class="showGlow ? 'bg-sky-500' : 'bg-white/10'"
						@click="showGlow = !showGlow; update({ glow: showGlow ? { color: element.glow?.color || '#22D3EE', intensity: element.glow?.intensity || 10 } : undefined })"
					>
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showGlow ? 'translate-x-4' : 'translate-x-0.5'" />
					</button>
				</div>
				<div v-if="showGlow && element.glow" class="flex gap-2 pl-2">
					<input type="color" :value="element.glow.color" class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent" @input="update({ glow: { ...element.glow!, color: ($event.target as HTMLInputElement).value } })" />
					<input type="range" min="1" max="30" :value="element.glow.intensity" class="flex-1 accent-sky-500" @input="update({ glow: { ...element.glow!, intensity: parseInt(($event.target as HTMLInputElement).value) } })" />
					<span class="w-6 text-right text-zinc-500">{{ element.glow.intensity }}</span>
				</div>

				<!-- Background color -->
				<div class="space-y-1">
					<label class="text-zinc-500">Background</label>
					<div class="flex items-center gap-2">
						<input
							type="color"
							:value="element.backgroundColor === 'transparent' ? '#000000' : element.backgroundColor"
							class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
							@input="update({ backgroundColor: ($event.target as HTMLInputElement).value })"
						/>
						<button
							class="rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-white/5"
							@click="update({ backgroundColor: 'transparent' })"
						>
							Clear
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Animation — In / Out / Loop / Captions -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-else-if="activeTopTab === 'animation'" class="flex flex-col overflow-y-auto" style="max-height: calc(100vh - 200px)">
			<!-- Sub-tab bar -->
			<div class="flex border-b border-white/10 mx-3 mt-2">
				<button
					v-for="sub in (['in', 'out', 'loop', 'captions'] as AnimSubTab[])"
					:key="sub"
					class="flex-1 pb-2 text-center text-[11px] font-medium capitalize transition-colors"
					:class="activeAnimSubTab === sub ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'"
					@click="activeAnimSubTab = sub"
				>
					{{ sub === 'captions' ? 'Captions' : sub === 'in' ? 'In' : sub === 'out' ? 'Out' : 'Loop' }}
				</button>
			</div>

			<!-- Apply to all checkbox -->
			<div class="flex items-center gap-2 px-3 pt-3 pb-1">
				<button
					class="flex size-4 items-center justify-center rounded border transition-colors"
					:class="applyToAll ? 'border-sky-500 bg-sky-500' : 'border-white/20 bg-transparent'"
					@click="applyToAll = !applyToAll"
				>
					<Check v-if="applyToAll" class="size-3 text-white" />
				</button>
				<span class="text-zinc-400 text-[11px]">Apply to all main captions</span>
			</div>

			<!-- ── In animations ── -->
			<div v-if="activeAnimSubTab === 'in'" class="grid grid-cols-4 gap-1.5 p-3">
				<!-- None option -->
				<button
					class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
					:class="!currentAnimIn ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'"
					@click="setAnimation('in', null)"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<div class="size-6 rounded-full border-2 border-white/20 relative">
							<div class="absolute inset-0 flex items-center justify-center">
								<div class="w-full h-[2px] bg-white/20 rotate-45" />
							</div>
						</div>
					</div>
					<span class="text-[9px] text-zinc-500">None</span>
				</button>
				<button
					v-for="preset in animInPresets"
					:key="preset.type"
					class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
					:class="currentAnimIn === preset.type ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'"
					@click="setAnimation('in', preset.type)"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<span class="text-[10px] font-bold text-zinc-300">Aa</span>
					</div>
					<span class="text-[9px] text-zinc-500 truncate w-full text-center">{{ preset.label.replace(' In', '') }}</span>
				</button>
			</div>

			<!-- ── Out animations ── -->
			<div v-else-if="activeAnimSubTab === 'out'" class="grid grid-cols-4 gap-1.5 p-3">
				<button
					class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
					:class="!currentAnimOut ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'"
					@click="setAnimation('out', null)"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<div class="size-6 rounded-full border-2 border-white/20 relative">
							<div class="absolute inset-0 flex items-center justify-center">
								<div class="w-full h-[2px] bg-white/20 rotate-45" />
							</div>
						</div>
					</div>
					<span class="text-[9px] text-zinc-500">None</span>
				</button>
				<button
					v-for="preset in animOutPresets"
					:key="preset.type"
					class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
					:class="currentAnimOut === preset.type ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'"
					@click="setAnimation('out', preset.type)"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<span class="text-[10px] font-bold text-zinc-300">Aa</span>
					</div>
					<span class="text-[9px] text-zinc-500 truncate w-full text-center">{{ preset.label.replace(' Out', '') }}</span>
				</button>
			</div>

			<!-- ── Loop animations ── -->
			<div v-else-if="activeAnimSubTab === 'loop'" class="grid grid-cols-4 gap-1.5 p-3">
				<button
					class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
					:class="!currentAnimLoop ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'"
					@click="setAnimation('loop', null)"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<div class="size-6 rounded-full border-2 border-white/20 relative">
							<div class="absolute inset-0 flex items-center justify-center">
								<div class="w-full h-[2px] bg-white/20 rotate-45" />
							</div>
						</div>
					</div>
					<span class="text-[9px] text-zinc-500">None</span>
				</button>
				<button
					v-for="preset in animLoopPresets"
					:key="preset.type"
					class="flex flex-col items-center gap-1 rounded-lg border p-2 transition-all"
					:class="currentAnimLoop === preset.type ? 'border-sky-500/50 bg-sky-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'"
					@click="setAnimation('loop', preset.type)"
				>
					<div class="flex size-10 items-center justify-center rounded-md bg-white/5">
						<span class="text-[10px] font-bold text-zinc-300">Aa</span>
					</div>
					<span class="text-[9px] text-zinc-500 truncate w-full text-center">{{ preset.label }}</span>
				</button>
			</div>

			<!-- ── Captions animation sub-tab (highlight style selector) ── -->
			<div v-else-if="activeAnimSubTab === 'captions'" class="flex flex-col gap-3 p-3">
				<span class="text-zinc-400 text-[11px]">Word highlight animation style</span>
				<div class="grid grid-cols-2 gap-1.5">
					<button
						v-for="hs in highlightStyles"
						:key="hs.value"
						class="rounded-md border px-3 py-2 text-[11px] transition-all"
						:class="element.highlightStyle === hs.value ? 'border-sky-500/50 bg-sky-500/10 text-sky-300' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300'"
						@click="update({ highlightStyle: hs.value })"
					>
						{{ hs.label }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
