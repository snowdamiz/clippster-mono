<script setup lang="ts">
import { ref, watch } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import type { TextElement, TextBubbleStyle, TextCase } from "../../../types/timeline";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ColorPicker from "@/components/ColorPicker.vue";
import {
	Plus,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Bold,
	Italic,
	Underline,
	Strikethrough,
	RotateCcw,
	Trash2,
	Baseline,
	Sparkles,
	MessageSquare,
	Zap,
	Diamond,
} from "lucide-vue-next";
import AnimationProperties from "./AnimationProperties.vue";
import KeyframeEditorPanel from "../KeyframeEditorPanel.vue";
import ElementTimingFields from "./ElementTimingFields.vue";

const props = defineProps<{
	element: TextElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { allFonts, uploadCustomFont, ensureFontLoaded } = useFontManager();

// ── Top-level tabs (CapCut style) ──
type TopTab = "style" | "effects" | "bubble" | "animate" | "keyframes";
const activeTopTab = ref<TopTab>("style");
const topTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: 'style', label: 'Style', icon: Baseline },
	{ id: 'effects', label: 'Effects', icon: Sparkles },
	{ id: 'bubble', label: 'Bubble', icon: MessageSquare },
	{ id: 'animate', label: 'Animate', icon: Zap },
	{ id: 'keyframes', label: 'Keyframes', icon: Diamond },
];

// ── Input refs ──
const fontSizeInput = ref(props.element.fontSize.toString());
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const contentInput = ref(props.element.content);
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(Math.round(props.element.transform.position.x).toString());
const posYInput = ref(Math.round(props.element.transform.position.y).toString());
const rotationInput = ref(props.element.transform.rotate.toString());
const showStroke = ref(!!props.element.stroke);
const showShadow = ref(!!props.element.shadow);
const showGlow = ref(!!props.element.glow);
const showGradient = ref(!!props.element.gradient?.enabled);
const fadeInInput = ref((props.element.fadeIn ?? 0).toFixed(1));
const fadeOutInput = ref((props.element.fadeOut ?? 0).toFixed(1));
const textOpacityInput = ref(Math.round((props.element.textOpacity ?? 1) * 100).toString());
const bubbleOpacityInput = ref(Math.round((props.element.bubbleOpacity ?? 1) * 100).toString());

// ── Watchers ──
watch(() => props.element.fontSize, (v) => { fontSizeInput.value = v.toString(); });
watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.content, (v) => { contentInput.value = v; });
watch(() => props.element.transform.scale, (v) => { scaleInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.position.x, (v) => { posXInput.value = Math.round(v).toString(); });
watch(() => props.element.transform.position.y, (v) => { posYInput.value = Math.round(v).toString(); });
watch(() => props.element.transform.rotate, (v) => { rotationInput.value = v.toFixed(1); });
watch(() => props.element.stroke, (v) => { showStroke.value = !!v; });
watch(() => props.element.shadow, (v) => { showShadow.value = !!v; });
watch(() => props.element.glow, (v) => { showGlow.value = !!v; });
watch(() => props.element.gradient, (v) => { showGradient.value = !!v?.enabled; });
watch(() => props.element.fadeIn, (v) => { fadeInInput.value = (v ?? 0).toFixed(1); });
watch(() => props.element.fadeOut, (v) => { fadeOutInput.value = (v ?? 0).toFixed(1); });
watch(() => props.element.textOpacity, (v) => { textOpacityInput.value = Math.round((v ?? 1) * 100).toString(); });
watch(() => props.element.bubbleOpacity, (v) => { bubbleOpacityInput.value = Math.round((v ?? 1) * 100).toString(); });

function update(updates: Record<string, unknown>) {
	editor.timeline.updateTextElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: updates as any,
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function isHexColor(value: string | undefined): value is string {
	return !!value && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function getBackgroundColorValue() {
	if (props.element.bubbleStyle !== "none") {
		if (isHexColor(props.element.backgroundColor)) return props.element.backgroundColor;
		return isHexColor(props.element.bubbleColor) ? props.element.bubbleColor : "#3B82F6";
	}
	return isHexColor(props.element.backgroundColor) ? props.element.backgroundColor : "#000000";
}

function hasVisibleBackground() {
	return props.element.bubbleStyle !== "none" || props.element.backgroundColor !== "transparent";
}

function updateBackgroundColor(color: string) {
	if (props.element.bubbleStyle !== "none") {
		update({ backgroundColor: color, bubbleColor: color, bubbleOpacity: props.element.bubbleOpacity ?? 1 });
		return;
	}
	update({ backgroundColor: color, bubbleOpacity: props.element.bubbleOpacity ?? 1 });
}

function toggleBackground() {
	if (props.element.bubbleStyle !== "none") {
		update({ bubbleStyle: "none", backgroundColor: "transparent", bubbleColor: undefined });
		return;
	}
	update({
		backgroundColor: props.element.backgroundColor === "transparent" ? "#000000" : "transparent",
		bubbleOpacity: props.element.bubbleOpacity ?? 1,
	});
}

function handleBackgroundOpacityChange(value: string) {
	const parsed = parseInt(value, 10);
	if (Number.isNaN(parsed)) return;
	const pct = clamp(parsed, 0, 100);
	bubbleOpacityInput.value = pct.toString();
	update({ bubbleOpacity: pct / 100 });
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
	const pct = Number.isNaN(parsed) ? Math.round(props.element.opacity * 100) : clamp(parsed, 0, 100);
	opacityInput.value = pct.toString();
	update({ opacity: pct / 100 });
}

// ── Content ──
function handleContentChange(e: Event) {
	const value = (e.target as HTMLTextAreaElement).value;
	contentInput.value = value;
	update({ content: value });
}

// ── Font ──
async function selectFont(fontFamily: string) {
	const font = allFonts.value.find((f) => f.family === fontFamily);
	if (font?.filePath) await ensureFontLoaded(fontFamily, font.filePath);
	update({ fontFamily, fontFilePath: font?.filePath });
}

async function handleUploadFont() {
	const font = await uploadCustomFont();
	if (font) {
		update({ fontFamily: font.family, fontFilePath: font.filePath });
	}
}

// ── Transform ──
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

function handleRotationChange(value: string) {
	rotationInput.value = value;
	if (value.trim() !== "" && value !== "-") {
		const parsed = parseFloat(value);
		if (!Number.isNaN(parsed)) {
			update({ transform: { ...props.element.transform, rotate: parsed } });
		}
	}
}

function resetTransform() {
	update({ transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 } });
}

// ── Effects toggles ──
function toggleStroke() {
	if (showStroke.value) {
		update({ stroke: undefined });
		showStroke.value = false;
	} else {
		update({ stroke: { color: "#000000", width: 2 } });
		showStroke.value = true;
	}
}

function toggleShadow() {
	if (showShadow.value) {
		update({ shadow: undefined });
		showShadow.value = false;
	} else {
		update({ shadow: { color: "rgba(0,0,0,0.8)", offsetX: 3, offsetY: 3, blur: 6 } });
		showShadow.value = true;
	}
}

function toggleGlow() {
	if (showGlow.value) {
		update({ glow: undefined });
		showGlow.value = false;
	} else {
		update({ glow: { color: props.element.color, intensity: 12 } });
		showGlow.value = true;
	}
}

function toggleGradient() {
	if (showGradient.value) {
		update({ gradient: undefined });
		showGradient.value = false;
	} else {
		update({ gradient: { enabled: true, colors: ["#f97316", "#ec4899"], angle: 135 } });
		showGradient.value = true;
	}
}

// ── Delete ──
function handleDelete() {
	editor.timeline.deleteElements({
		elements: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

// ── Fade In/Out ──
function handleFadeInSlider(value: string) {
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		fadeInInput.value = parsed.toFixed(1);
		update({ fadeIn: parsed });
	}
}
function handleFadeOutSlider(value: string) {
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		fadeOutInput.value = parsed.toFixed(1);
		update({ fadeOut: parsed });
	}
}

// ── Options ──
const caseOptions: { value: TextCase; label: string }[] = [
	{ value: "none", label: "Aa" },
	{ value: "uppercase", label: "AA" },
	{ value: "lowercase", label: "aa" },
	{ value: "capitalize", label: "Ab" },
];

interface BubbleOption {
	value: TextBubbleStyle;
	label: string;
	icon: string;
}

const bubbleOptions: BubbleOption[] = [
	{ value: "none", label: "None", icon: "none" },
	{ value: "rounded", label: "Rounded", icon: "rounded" },
	{ value: "pill", label: "Pill", icon: "pill" },
	{ value: "speech", label: "Speech", icon: "speech" },
	{ value: "thought", label: "Thought", icon: "thought" },
	{ value: "label", label: "Label", icon: "label" },
	{ value: "neon-box", label: "Neon", icon: "neon" },
	{ value: "glitch", label: "Glitch", icon: "glitch" },
];

const weightOptions = [
	{ value: "normal", label: "Regular" },
	{ value: "bold", label: "Bold" },
	{ value: "100", label: "Thin" },
	{ value: "300", label: "Light" },
	{ value: "500", label: "Medium" },
	{ value: "600", label: "SemiBold" },
	{ value: "700", label: "Bold 700" },
	{ value: "800", label: "ExtraBold" },
	{ value: "900", label: "Black" },
];

// ── Quick style presets ──
const quickStyles = [
	{ label: "Plain", apply: () => update({ stroke: undefined, shadow: undefined, glow: undefined, gradient: undefined }) },
	{ label: "Outline", apply: () => update({ stroke: { color: "#000000", width: 3 }, shadow: undefined, glow: undefined, gradient: undefined }) },
	{ label: "Shadow", apply: () => update({ stroke: undefined, shadow: { color: "rgba(0,0,0,0.8)", offsetX: 3, offsetY: 3, blur: 6 }, glow: undefined, gradient: undefined }) },
	{ label: "Glow", apply: () => update({ stroke: undefined, shadow: undefined, glow: { color: "#22D3EE", intensity: 15 }, gradient: undefined }) },
	{ label: "Gradient", apply: () => update({ stroke: undefined, shadow: undefined, glow: undefined, gradient: { enabled: true, colors: ["#f97316", "#ec4899"], angle: 135 } }) },
	{ label: "Neon", apply: () => update({ stroke: { color: "#22D3EE", width: 1 }, shadow: undefined, glow: { color: "#22D3EE", intensity: 20 }, gradient: undefined }) },
];
</script>

<template>
	<div class="flex h-full flex-row text-xs">
		<!-- ═══ Content Area ═══ -->
		<div class="flex flex-1 min-w-0 flex-col overflow-hidden">

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Style                                 -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-if="activeTopTab === 'style'" class="flex flex-col gap-3 overflow-y-auto p-3" style="max-height: calc(100vh - 200px)">
			<!-- Text content -->
			<textarea
				class="min-h-16 w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-primary/50 focus:outline-none"
				placeholder="Enter text..."
				:value="contentInput"
				@input="handleContentChange"
			/>

			<!-- ── Font section ── -->
			<div class="space-y-2 border-t border-white/10 pt-4">
				<div class="flex items-center justify-between">
					<span class="text-zinc-300 font-medium">Font</span>
					<button
						@click="handleUploadFont"
						class="flex items-center gap-1 px-2 py-1 text-[10px] text-primary hover:text-primary/80 bg-primary/10 rounded transition-colors border border-primary/20"
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
							{{ font.label }}
						</SelectItem>
					</SelectContent>
				</Select>

				<!-- Font size + weight -->
				<div class="flex gap-2">
					<div class="flex-1 space-y-1">
						<label class="text-zinc-500">Size</label>
						<div class="flex items-center gap-2">
							<input type="range" min="8" max="300" :value="element.fontSize" class="flex-1"
								@input="(e) => handleFontSizeChange((e.target as HTMLInputElement).value)" />
							<input
								type="text"
								:value="fontSizeInput"
								class="h-6 w-14 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
								@input="(e) => handleFontSizeChange((e.target as HTMLInputElement).value)"
								@blur="handleFontSizeBlur"
							/>
						</div>
					</div>
					<div class="w-28 space-y-1">
						<label class="text-zinc-500">Weight</label>
						<Select :model-value="element.fontWeight" @update:model-value="(v) => update({ fontWeight: String(v) })">
							<SelectTrigger class="h-6 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
								<SelectValue />
							</SelectTrigger>
							<SelectContent class="bg-zinc-900 border-white/10">
								<SelectItem v-for="w in weightOptions" :key="w.value" :value="w.value" class="text-xs text-zinc-200">{{ w.label }}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<!-- Style + Align + Case row -->
				<div class="flex items-center gap-2">
					<!-- Style buttons -->
					<div class="flex items-center rounded border border-white/10">
						<button
							class="flex size-7 items-center justify-center text-zinc-400 transition-colors first:rounded-l last:rounded-r hover:text-zinc-200"
							:class="element.fontWeight === 'bold' || element.fontWeight === '700' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ fontWeight: element.fontWeight === 'bold' || element.fontWeight === '700' ? 'normal' : 'bold' })"
						><Bold class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors hover:text-zinc-200"
							:class="element.fontStyle === 'italic' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })"
						><Italic class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors hover:text-zinc-200"
							:class="element.textDecoration === 'underline' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })"
						><Underline class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors last:rounded-r hover:text-zinc-200"
							:class="element.textDecoration === 'line-through' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ textDecoration: element.textDecoration === 'line-through' ? 'none' : 'line-through' })"
						><Strikethrough class="size-3.5" /></button>
					</div>

					<!-- Align buttons -->
					<div class="flex items-center rounded border border-white/10">
						<button
							class="flex size-7 items-center justify-center text-zinc-400 transition-colors first:rounded-l hover:text-zinc-200"
							:class="element.textAlign === 'left' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ textAlign: 'left' })"
						><AlignLeft class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors hover:text-zinc-200"
							:class="element.textAlign === 'center' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ textAlign: 'center' })"
						><AlignCenter class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors last:rounded-r hover:text-zinc-200"
							:class="element.textAlign === 'right' ? 'bg-primary/20 text-primary' : ''"
							@click="update({ textAlign: 'right' })"
						><AlignRight class="size-3.5" /></button>
					</div>

					<!-- Case buttons -->
					<div class="flex items-center rounded border border-white/10">
						<button v-for="c in caseOptions" :key="c.value"
							class="flex size-7 items-center justify-center border-l border-white/10 text-[10px] font-semibold text-zinc-400 transition-colors first:border-l-0 first:rounded-l last:rounded-r hover:text-zinc-200"
							:class="element.textCase === c.value ? 'bg-primary/20 text-primary' : ''"
							@click="update({ textCase: c.value })"
						>{{ c.label }}</button>
					</div>
				</div>

				<!-- Text color -->
				<div class="flex items-center gap-2">
					<label class="w-24 text-zinc-500">Font Color</label>
					<ColorPicker :model-value="element.color" @update:model-value="(v) => update({ color: v })" />
					<span class="font-mono text-[10px] uppercase text-zinc-400">{{ element.color }}</span>
				</div>

				<!-- Background color + opacity -->
				<div class="space-y-2 rounded-md border border-white/5 bg-white/[0.02] p-2">
					<div class="flex items-center gap-2">
						<label class="w-24 text-zinc-500">Background</label>
						<ColorPicker
							v-if="hasVisibleBackground()"
							:model-value="getBackgroundColorValue()"
							@update:model-value="updateBackgroundColor"
						/>
						<span v-else class="text-[10px] text-zinc-500">None</span>
						<span v-if="hasVisibleBackground()" class="font-mono text-[10px] uppercase text-zinc-400">
							{{ getBackgroundColorValue() }}
						</span>
						<button
							class="ml-auto rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
							@click="toggleBackground"
						>
							{{ hasVisibleBackground() ? 'Clear' : 'Add' }}
						</button>
					</div>
					<div v-if="hasVisibleBackground()" class="flex items-center gap-2">
						<label class="w-24 text-zinc-500">Bg Opacity</label>
						<input
							type="range"
							:value="(element.bubbleOpacity ?? 1) * 100"
							min="0"
							max="100"
							step="1"
							class="flex-1"
							@input="(e) => handleBackgroundOpacityChange((e.target as HTMLInputElement).value)"
						/>
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ bubbleOpacityInput }}%</span>
					</div>
				</div>
			</div>

			<!-- ── Transform section ── -->
			<div class="space-y-2 border-t border-white/10 pt-4">
				<div class="flex items-center justify-between">
					<span class="text-zinc-300 font-medium">Transform</span>
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
							class="flex-1"
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

			<!-- ── Appearance section ── -->
			<div class="space-y-2 border-t border-white/10 pt-4">
				<span class="text-zinc-300 font-medium">Appearance</span>

				<!-- Letter Spacing -->
				<div class="space-y-1">
					<label class="text-zinc-500">Spacing</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="element.letterSpacing" min="-5" max="30" step="0.5" class="flex-1"
							@input="(e) => update({ letterSpacing: Number((e.target as HTMLInputElement).value) })" />
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ element.letterSpacing }}px</span>
					</div>
				</div>

				<!-- Line Height -->
				<div class="space-y-1">
					<label class="text-zinc-500">Line Height</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="element.lineHeight" min="0.8" max="3" step="0.1" class="flex-1"
							@input="(e) => update({ lineHeight: Number((e.target as HTMLInputElement).value) })" />
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ element.lineHeight?.toFixed(1) }}</span>
					</div>
				</div>

				<!-- Opacity -->
				<div class="space-y-1">
					<label class="text-zinc-500">Opacity</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="flex-1"
							@input="(e) => { const val = Number((e.target as HTMLInputElement).value); update({ opacity: val / 100 }); opacityInput = val.toString(); }" />
						<div class="flex items-center">
							<input type="text" :value="opacityInput"
								class="h-6 w-12 rounded-md border border-white/10 bg-white/5 px-2 text-right text-xs text-zinc-200"
								@input="(e) => handleOpacityChange((e.target as HTMLInputElement).value)" @blur="handleOpacityBlur" />
							<span class="ml-0.5 text-zinc-500">%</span>
						</div>
					</div>
				</div>

			<!-- Blend Mode -->
			<div class="space-y-1">
				<label class="text-zinc-500">Blend Mode</label>
				<select
					:value="element.blendMode ?? 'normal'"
					class="w-full rounded border border-white/10 bg-[#1a1a1e] px-2 py-1 text-xs text-zinc-200 outline-none"
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

			<!-- Background Color (non-bubble) -->
			<div v-if="element.bubbleStyle === 'none'" class="space-y-1">
					<label class="text-zinc-500">Background</label>
					<div class="flex items-center gap-2">
						<ColorPicker
							v-if="element.backgroundColor !== 'transparent'"
							:model-value="element.backgroundColor"
							@update:model-value="(v) => update({ backgroundColor: v })"
						/>
						<span v-else class="text-[10px] text-zinc-500">None</span>
						<button class="text-[10px] text-zinc-500 hover:text-zinc-300"
							@click="update({ backgroundColor: element.backgroundColor === 'transparent' ? '#000000' : 'transparent' })">
							{{ element.backgroundColor === 'transparent' ? 'Add' : 'Clear' }}
						</button>
					</div>
				</div>
			</div>

			<!-- Text opacity (independent from element opacity) -->
			<div class="space-y-1 border-t border-white/10 pt-3">
				<label class="text-zinc-500">Text Opacity</label>
				<div class="flex items-center gap-2">
					<input
						type="range"
						:value="(element.textOpacity ?? 1) * 100"
						min="0"
						max="100"
						step="1"
						class="flex-1"
						@input="(e) => { const val = Number((e.target as HTMLInputElement).value); textOpacityInput = String(val); update({ textOpacity: val / 100 }); }"
					/>
					<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ textOpacityInput }}%</span>
				</div>
			</div>

			<!-- ── Quick Style Presets ── -->
			<div class="space-y-2 border-t border-white/10 pt-4">
				<span class="text-zinc-300 font-medium">Quick Styles</span>
				<div class="grid grid-cols-3 gap-1.5">
					<button
						v-for="qs in quickStyles"
						:key="qs.label"
						class="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[10px] text-zinc-400 transition-all hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
						@click="qs.apply()"
					>
						{{ qs.label }}
					</button>
				</div>
			</div>
			<!-- ── Timing ── -->
			<div class="border-t border-white/10 pt-3">
				<ElementTimingFields :element="element" :track-id="trackId" />
			</div>

			<!-- ── Fade In/Out ── -->
			<div class="space-y-2 border-t border-white/10 pt-4">
				<span class="text-zinc-300 font-medium">Fade</span>
				<div class="space-y-1">
					<label class="text-zinc-500">Fade In</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="element.fadeIn ?? 0" min="0" max="2" step="0.1" class="flex-1"
							@input="(e) => handleFadeInSlider((e.target as HTMLInputElement).value)" />
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ fadeInInput }}s</span>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-zinc-500">Fade Out</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="element.fadeOut ?? 0" min="0" max="2" step="0.1" class="flex-1"
							@input="(e) => handleFadeOutSlider((e.target as HTMLInputElement).value)" />
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ fadeOutInput }}s</span>
					</div>
				</div>
			</div>

			<!-- ── Delete ── -->
			<div class="border-t border-white/10 pt-4 mt-2">
				<button
					class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
					@click="handleDelete"
				>
					<Trash2 class="size-3.5" /> Delete Text
				</button>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Effects                               -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-else-if="activeTopTab === 'effects'" class="flex flex-col gap-2 overflow-y-auto p-3" style="max-height: calc(100vh - 200px)">
			<!-- Stroke -->
			<div class="rounded-md border border-white/5 bg-white/[0.02]">
				<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleStroke">
					<span class="text-xs text-zinc-300">Stroke</span>
					<div class="h-5 w-9 rounded-full transition-colors" :class="showStroke ? 'bg-primary' : 'bg-white/10'">
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showStroke ? 'translate-x-4' : 'translate-x-0.5'" style="margin-top: 2px" />
					</div>
				</button>
				<div v-if="showStroke && element.stroke" class="flex items-center gap-2 border-t border-white/5 px-2.5 py-2">
					<ColorPicker :model-value="element.stroke.color" @update:model-value="(v) => update({ stroke: { ...element.stroke!, color: v } })" />
					<input type="range" :value="element.stroke.width" min="1" max="20" step="0.5" class="flex-1"
						@input="(e) => update({ stroke: { ...element.stroke!, width: Number((e.target as HTMLInputElement).value) } })" />
					<span class="w-6 text-right text-zinc-500">{{ element.stroke.width }}</span>
				</div>
			</div>

			<!-- Shadow -->
			<div class="rounded-md border border-white/5 bg-white/[0.02]">
				<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleShadow">
					<span class="text-xs text-zinc-300">Shadow</span>
					<div class="h-5 w-9 rounded-full transition-colors" :class="showShadow ? 'bg-primary' : 'bg-white/10'">
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showShadow ? 'translate-x-4' : 'translate-x-0.5'" style="margin-top: 2px" />
					</div>
				</button>
				<div v-if="showShadow && element.shadow" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
					<div class="flex items-center gap-2">
						<ColorPicker
							:model-value="element.shadow.color.startsWith('#') ? element.shadow.color : '#000000'"
							@update:model-value="(v) => update({ shadow: { ...element.shadow!, color: v } })"
						/>
						<span class="text-[10px] text-zinc-500">Color</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="w-5 text-[10px] text-zinc-500">X</span>
						<input type="range" :value="element.shadow.offsetX" min="-20" max="20" step="1" class="flex-1"
							@input="(e) => update({ shadow: { ...element.shadow!, offsetX: Number((e.target as HTMLInputElement).value) } })" />
						<span class="w-5 text-[10px] text-zinc-500">Y</span>
						<input type="range" :value="element.shadow.offsetY" min="-20" max="20" step="1" class="flex-1"
							@input="(e) => update({ shadow: { ...element.shadow!, offsetY: Number((e.target as HTMLInputElement).value) } })" />
					</div>
					<div class="flex items-center gap-2">
						<span class="w-5 text-[10px] text-zinc-500">Blur</span>
						<input type="range" :value="element.shadow.blur" min="0" max="30" step="1" class="flex-1"
							@input="(e) => update({ shadow: { ...element.shadow!, blur: Number((e.target as HTMLInputElement).value) } })" />
						<span class="w-6 text-right text-zinc-500">{{ element.shadow.blur }}</span>
					</div>
				</div>
			</div>

			<!-- Glow -->
			<div class="rounded-md border border-white/5 bg-white/[0.02]">
				<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleGlow">
					<span class="text-xs text-zinc-300">Glow</span>
					<div class="h-5 w-9 rounded-full transition-colors" :class="showGlow ? 'bg-primary' : 'bg-white/10'">
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showGlow ? 'translate-x-4' : 'translate-x-0.5'" style="margin-top: 2px" />
					</div>
				</button>
				<div v-if="showGlow && element.glow" class="flex items-center gap-2 border-t border-white/5 px-2.5 py-2">
					<ColorPicker :model-value="element.glow.color" @update:model-value="(v) => update({ glow: { ...element.glow!, color: v } })" />
					<input type="range" :value="element.glow.intensity" min="1" max="30" step="1" class="flex-1"
						@input="(e) => update({ glow: { ...element.glow!, intensity: Number((e.target as HTMLInputElement).value) } })" />
					<span class="w-6 text-right text-zinc-500">{{ element.glow.intensity }}</span>
				</div>
			</div>

			<!-- Gradient -->
			<div class="rounded-md border border-white/5 bg-white/[0.02]">
				<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleGradient">
					<span class="text-xs text-zinc-300">Gradient</span>
					<div class="h-5 w-9 rounded-full transition-colors" :class="showGradient ? 'bg-primary' : 'bg-white/10'">
						<div class="h-4 w-4 rounded-full bg-white shadow transition-transform" :class="showGradient ? 'translate-x-4' : 'translate-x-0.5'" style="margin-top: 2px" />
					</div>
				</button>
				<div v-if="showGradient && element.gradient" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
					<div class="flex items-center gap-2">
						<ColorPicker :model-value="element.gradient.colors[0]" @update:model-value="(v) => update({ gradient: { ...element.gradient!, colors: [v, element.gradient!.colors[1]] } })" />
						<div class="h-4 flex-1 rounded" :style="{ background: `linear-gradient(${element.gradient.angle}deg, ${element.gradient.colors[0]}, ${element.gradient.colors[1]})` }" />
						<ColorPicker :model-value="element.gradient.colors[1]" @update:model-value="(v) => update({ gradient: { ...element.gradient!, colors: [element.gradient!.colors[0], v] } })" />
					</div>
					<div class="flex items-center gap-2">
						<span class="text-[10px] text-zinc-500">Angle</span>
						<input type="range" :value="element.gradient.angle" min="0" max="360" step="15" class="flex-1"
							@input="(e) => update({ gradient: { ...element.gradient!, angle: Number((e.target as HTMLInputElement).value) } })" />
						<span class="w-8 text-right text-zinc-500">{{ element.gradient.angle }}°</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Bubble                                -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-else-if="activeTopTab === 'bubble'" class="flex flex-col gap-3 overflow-y-auto p-3" style="max-height: calc(100vh - 200px)">
			<!-- Visual bubble shape picker grid -->
			<div class="grid grid-cols-4 gap-1.5">
				<button v-for="b in bubbleOptions" :key="b.value"
					class="group flex flex-col items-center gap-1 rounded-md border p-1.5 transition-all"
					:class="element.bubbleStyle === b.value
						? 'border-primary/60 bg-primary/10'
						: 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/5'"
					@click="update({ bubbleStyle: b.value })"
				>
					<!-- Mini SVG icon for each bubble shape -->
					<svg viewBox="0 0 40 28" class="h-5 w-8">
						<template v-if="b.icon === 'none'">
							<text x="20" y="18" text-anchor="middle" fill="currentColor" font-size="10" class="text-zinc-500">T</text>
						</template>
						<template v-else-if="b.icon === 'rounded'">
							<rect x="4" y="4" width="32" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-zinc-400" />
						</template>
						<template v-else-if="b.icon === 'pill'">
							<rect x="4" y="6" width="32" height="16" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" class="text-zinc-400" />
						</template>
						<template v-else-if="b.icon === 'speech'">
							<rect x="4" y="3" width="32" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-zinc-400" />
							<path d="M12 20 L9 27 L16 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" class="text-zinc-400" />
						</template>
						<template v-else-if="b.icon === 'thought'">
							<rect x="4" y="2" width="32" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" class="text-zinc-400" />
							<circle cx="12" cy="22" r="2" fill="currentColor" class="text-zinc-400" />
							<circle cx="9" cy="25.5" r="1.2" fill="currentColor" class="text-zinc-400" />
						</template>
						<template v-else-if="b.icon === 'label'">
							<path d="M12 4 L36 4 L36 24 L12 24 L4 14 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" class="text-zinc-400" />
						</template>
						<template v-else-if="b.icon === 'neon'">
							<rect x="6" y="5" width="28" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" class="text-cyan-400" />
							<rect x="6" y="5" width="28" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="3" opacity="0.2" class="text-cyan-400" />
						</template>
						<template v-else-if="b.icon === 'glitch'">
							<rect x="5" y="5" width="30" height="18" fill="none" stroke="currentColor" stroke-width="1.5" class="text-zinc-400" />
							<rect x="7" y="6" width="30" height="18" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.3" class="text-red-400" />
						</template>
					</svg>
					<span class="text-[9px] leading-none"
						:class="element.bubbleStyle === b.value ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-400'"
					>{{ b.label }}</span>
				</button>
			</div>

			<!-- Bubble Color + Padding (when bubble active) -->
			<div v-if="element.bubbleStyle !== 'none'" class="space-y-2 border-t border-white/10 pt-4">
				<div class="space-y-1">
					<label class="text-zinc-500">Color</label>
					<div class="flex items-center gap-2">
						<ColorPicker :model-value="element.bubbleColor || '#3b82f6'" @update:model-value="(v) => update({ bubbleColor: v })" />
						<span class="font-mono text-[10px] uppercase text-zinc-400">{{ element.bubbleColor || '#3b82f6' }}</span>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-zinc-500">Padding</label>
					<div class="flex items-center gap-2">
						<input type="range" :value="element.bubblePadding ?? 16" min="4" max="40" step="2" class="flex-1"
							@input="(e) => update({ bubblePadding: Number((e.target as HTMLInputElement).value) })" />
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ element.bubblePadding ?? 16 }}px</span>
					</div>
				</div>
				<div class="space-y-1">
					<label class="text-zinc-500">Background Opacity</label>
					<div class="flex items-center gap-2">
						<input
							type="range"
							:value="(element.bubbleOpacity ?? 1) * 100"
							min="0"
							max="100"
							step="1"
							class="flex-1"
							@input="(e) => { const val = Number((e.target as HTMLInputElement).value); bubbleOpacityInput = String(val); update({ bubbleOpacity: val / 100 }); }"
						/>
						<span class="w-10 text-right font-mono text-[10px] text-zinc-400">{{ bubbleOpacityInput }}%</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════ -->
		<!-- TAB: Animate                               -->
		<!-- ═══════════════════════════════════════════ -->
		<div v-else-if="activeTopTab === 'animate'" class="flex-1 overflow-y-auto">
			<AnimationProperties
				:element-id="element.id"
				:track-id="trackId"
				:animation-in="element.animationIn"
				:animation-out="element.animationOut"
				:animation-loop="element.animationLoop"
				:element-duration="element.duration"
			/>
		</div>

		<div v-else-if="activeTopTab === 'keyframes'" class="flex-1 overflow-y-auto">
			<KeyframeEditorPanel :track-id="trackId" :element="element" />
		</div>
		</div>

		<!-- ═══ Right Tab Strip ═══ -->
		<div class="flex w-10 shrink-0 flex-col items-center gap-2 border-l border-white/10 bg-[#0e0e10] py-3 overflow-y-auto scrollbar-hidden">
			<button
				v-for="tab in topTabs"
				:key="tab.id"
				type="button"
				:title="tab.label"
				:class="[
					'flex flex-col items-center justify-center rounded-md p-1.5 transition-colors',
					activeTopTab === tab.id
						? 'text-blue-400'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeTopTab = tab.id"
			>
				<component :is="tab.icon" class="size-[15px]" />
			</button>
		</div>
	</div>
</template>
