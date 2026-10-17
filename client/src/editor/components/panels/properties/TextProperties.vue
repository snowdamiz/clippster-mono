<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import { useImageMode } from "../../../composables/useImageMode";
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
import BlendModeSelect from "./BlendModeSelect.vue";
import InspectorSwitchCard from "./InspectorSwitchCard.vue";
import InspectorColorPickerField from "./InspectorColorPickerField.vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorTabRail from "../shared/InspectorTabRail.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import OptionChip from "../shared/OptionChip.vue";
import ChipGroup from "../shared/ChipGroup.vue";

const props = defineProps<{
	element: TextElement;
	trackId: string;
}>();

const { editor } = useEditor({ subscribe: false });
const { allFonts, uploadCustomFont, ensureFontLoaded } = useFontManager();
const { isImageMode } = useImageMode();

// ── Top-level tabs (CapCut style) ──
type TopTab = "style" | "effects" | "bubble" | "animate" | "keyframes";
const activeTopTab = ref<TopTab>("style");
const allTopTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: "style", label: "Style", icon: Baseline },
	{ id: "effects", label: "Effects", icon: Sparkles },
	{ id: "bubble", label: "Bubble", icon: MessageSquare },
	{ id: "animate", label: "Animate", icon: Zap },
	{ id: "keyframes", label: "Keyframes", icon: Diamond },
];
const topTabs = computed(() =>
	isImageMode.value
		? allTopTabs.filter((t) => t.id !== "animate" && t.id !== "keyframes")
		: allTopTabs,
);
watch(topTabs, (tabs) => {
	if (!tabs.some((t) => t.id === activeTopTab.value)) activeTopTab.value = "style";
});

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
const caseOptions: { value: TextCase; label: string; title: string }[] = [
	{ value: "none", label: "Aa", title: "Original case" },
	{ value: "uppercase", label: "AA", title: "Uppercase" },
	{ value: "lowercase", label: "aa", title: "Lowercase" },
	{ value: "capitalize", label: "Ab", title: "Capitalize" },
];

const alignOptions = [
	{ value: "left", icon: AlignLeft, title: "Align left" },
	{ value: "center", icon: AlignCenter, title: "Align center" },
	{ value: "right", icon: AlignRight, title: "Align right" },
] as const;

/** Shrinks the shared ColorPicker swatch to the 28px inspector control size. */
const pickerClass = "shrink-0 [&>button]:h-7 [&>button]:w-10 [&>button]:rounded-md [&>button]:border";

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
	{ value: "600", label: "Semibold" },
	{ value: "700", label: "Bold 700" },
	{ value: "800", label: "Extra bold" },
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
	<div class="flex h-full min-h-0 flex-row">
		<div class="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
			<!-- ══════ Style tab ══════ -->
			<template v-if="activeTopTab === 'style'">
				<InspectorSection title="Content">
					<Textarea
						:model-value="contentInput"
						placeholder="Enter text…"
						aria-label="Text content"
						class="min-h-16 resize-none px-2 py-1.5 text-xs"
						@input="handleContentChange"
					/>
				</InspectorSection>

				<InspectorSection title="Font">
					<template #actions>
						<Button variant="ghost" size="xs" title="Upload custom font" @click="handleUploadFont">
							<Plus />
							Upload font
						</Button>
					</template>

					<Select :model-value="element.fontFamily" @update:model-value="(v) => selectFont(String(v))">
						<SelectTrigger
							aria-label="Font family"
							class="h-7 rounded-md px-2 text-xs [&>svg]:size-3.5 [&>svg]:text-fg-subtle [&>svg]:opacity-100"
						>
							<SelectValue :placeholder="element.fontFamily" />
						</SelectTrigger>
						<SelectContent class="max-h-[250px]">
							<SelectItem v-for="font in allFonts" :key="font.family" :value="font.family" class="text-xs">
								{{ font.label }}
							</SelectItem>
						</SelectContent>
					</Select>

					<InspectorField inline label="Weight">
						<InspectorSelect
							:model-value="element.fontWeight"
							:options="weightOptions"
							aria-label="Font weight"
							class="flex-1"
							@update:model-value="(v) => update({ fontWeight: v })"
						/>
					</InspectorField>

					<SliderField
						inline
						label="Size"
						:model-value="element.fontSize"
						:min="8"
						:max="300"
						:input-value="fontSizeInput"
						input-type="text"
						@slide="(v) => handleFontSizeChange(String(v))"
						@input="handleFontSizeChange"
						@commit="handleFontSizeBlur"
					/>

					<!-- Style / alignment / case -->
					<div class="flex flex-wrap items-center gap-2">
						<ChipGroup aria-label="Text style">
							<OptionChip
								variant="ghost"
								square
								:icon="Bold"
								title="Bold"
								aria-label="Bold"
								:active="element.fontWeight === 'bold' || element.fontWeight === '700'"
								@click="update({ fontWeight: element.fontWeight === 'bold' || element.fontWeight === '700' ? 'normal' : 'bold' })"
							/>
							<OptionChip
								variant="ghost"
								square
								:icon="Italic"
								title="Italic"
								aria-label="Italic"
								:active="element.fontStyle === 'italic'"
								@click="update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })"
							/>
							<OptionChip
								variant="ghost"
								square
								:icon="Underline"
								title="Underline"
								aria-label="Underline"
								:active="element.textDecoration === 'underline'"
								@click="update({ textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })"
							/>
							<OptionChip
								variant="ghost"
								square
								:icon="Strikethrough"
								title="Strikethrough"
								aria-label="Strikethrough"
								:active="element.textDecoration === 'line-through'"
								@click="update({ textDecoration: element.textDecoration === 'line-through' ? 'none' : 'line-through' })"
							/>
						</ChipGroup>
						<ChipGroup aria-label="Text alignment">
							<OptionChip
								v-for="a in alignOptions"
								:key="a.value"
								variant="ghost"
								square
								:icon="a.icon"
								:title="a.title"
								:aria-label="a.title"
								:active="element.textAlign === a.value"
								@click="update({ textAlign: a.value })"
							/>
						</ChipGroup>
						<ChipGroup aria-label="Text case">
							<OptionChip
								v-for="c in caseOptions"
								:key="c.value"
								variant="ghost"
								square
								:title="c.title"
								:aria-label="c.title"
								:active="element.textCase === c.value"
								class="text-2xs font-semibold"
								@click="update({ textCase: c.value })"
							>
								{{ c.label }}
							</OptionChip>
						</ChipGroup>
					</div>

					<InspectorColorPickerField
						label="Color"
						:model-value="element.color"
						@update:model-value="(v) => update({ color: v })"
					/>
				</InspectorSection>

				<InspectorSection title="Transform">
					<template #actions>
						<Button variant="ghost" size="xs" title="Reset transform" @click="resetTransform">
							<RotateCcw />
							Reset
						</Button>
					</template>
					<div class="grid grid-cols-2 gap-2">
						<NumberBox
							type="text"
							prefix="Scale"
							suffix="%"
							:value="scaleInput"
							@input="handleScaleInput"
							@commit="handleScaleBlur"
						/>
						<NumberBox type="text" prefix="Rotate" suffix="°" :value="rotationInput" @input="handleRotationChange" />
						<NumberBox type="text" prefix="X" :value="posXInput" @input="handlePosXChange" />
						<NumberBox type="text" prefix="Y" :value="posYInput" @input="handlePosYChange" />
					</div>
				</InspectorSection>

				<InspectorSection title="Appearance">
					<InspectorColorPickerField
						label="Background"
						:model-value="getBackgroundColorValue()"
						:empty="!hasVisibleBackground()"
						@update:model-value="updateBackgroundColor"
					>
						<Button variant="ghost" size="xs" class="ml-auto shrink-0" @click="toggleBackground">
							{{ hasVisibleBackground() ? "Clear" : "Add" }}
						</Button>
					</InspectorColorPickerField>
					<SliderField
						v-if="hasVisibleBackground()"
						inline
						label="Bg opacity"
						:model-value="(element.bubbleOpacity ?? 1) * 100"
						:readout="`${bubbleOpacityInput}%`"
						@update:model-value="(v) => handleBackgroundOpacityChange(String(v))"
					/>
					<SliderField
						inline
						label="Spacing"
						:model-value="element.letterSpacing"
						:min="-5"
						:max="30"
						:step="0.5"
						:readout="`${element.letterSpacing}px`"
						@update:model-value="(v) => update({ letterSpacing: v })"
					/>
					<SliderField
						inline
						label="Line height"
						:model-value="element.lineHeight"
						:min="0.8"
						:max="3"
						:step="0.1"
						:readout="element.lineHeight?.toFixed(1) ?? ''"
						@update:model-value="(v) => update({ lineHeight: v })"
					/>
					<SliderField
						inline
						label="Opacity"
						:model-value="element.opacity * 100"
						:input-value="opacityInput"
						unit="%"
						input-type="text"
						@slide="(v) => { update({ opacity: v / 100 }); opacityInput = v.toString(); }"
						@input="handleOpacityChange"
						@commit="handleOpacityBlur"
					/>
					<SliderField
						inline
						label="Text opacity"
						:model-value="(element.textOpacity ?? 1) * 100"
						:readout="`${textOpacityInput}%`"
						@update:model-value="(v) => { textOpacityInput = String(v); update({ textOpacity: v / 100 }); }"
					/>
					<BlendModeSelect
						:model-value="element.blendMode"
						@update:model-value="(v) => update({ blendMode: v === 'normal' ? undefined : v })"
					/>
				</InspectorSection>

				<InspectorSection title="Quick styles">
					<div class="grid grid-cols-3 gap-1.5">
						<OptionChip v-for="qs in quickStyles" :key="qs.label" @click="qs.apply()">
							{{ qs.label }}
						</OptionChip>
					</div>
				</InspectorSection>

				<!-- Timing + fade (video only) -->
				<InspectorSection v-if="!isImageMode" title="Timing">
					<ElementTimingFields :element="element" :track-id="trackId" />
					<div class="grid grid-cols-2 gap-3">
						<SliderField
							label="Fade in"
							:model-value="element.fadeIn ?? 0"
							:min="0"
							:max="2"
							:step="0.1"
							:readout="`${fadeInInput}s`"
							@slide="(v) => handleFadeInSlider(String(v))"
						/>
						<SliderField
							label="Fade out"
							:model-value="element.fadeOut ?? 0"
							:min="0"
							:max="2"
							:step="0.1"
							:readout="`${fadeOutInput}s`"
							@slide="(v) => handleFadeOutSlider(String(v))"
						/>
					</div>
				</InspectorSection>

				<div class="p-3">
					<Button variant="destructive-soft" size="sm" block @click="handleDelete">
						<Trash2 />
						Delete text
					</Button>
				</div>
			</template>

			<!-- ══════ Effects tab ══════ -->
			<InspectorSection v-else-if="activeTopTab === 'effects'" title="Effects" flush body-class="space-y-2">
				<InspectorSwitchCard
					title="Stroke"
					:model-value="showStroke"
					:open="showStroke && !!element.stroke"
					@update:model-value="toggleStroke"
				>
					<template v-if="element.stroke">
						<InspectorColorPickerField
							label="Color"
							:model-value="element.stroke.color"
							@update:model-value="(v) => update({ stroke: { ...element.stroke!, color: v } })"
						/>
						<SliderField
							inline
							label="Width"
							:model-value="element.stroke.width"
							:min="1"
							:max="20"
							:step="0.5"
							:readout="String(element.stroke.width)"
							@update:model-value="(v) => update({ stroke: { ...element.stroke!, width: v } })"
						/>
					</template>
				</InspectorSwitchCard>

				<InspectorSwitchCard
					title="Shadow"
					:model-value="showShadow"
					:open="showShadow && !!element.shadow"
					@update:model-value="toggleShadow"
				>
					<template v-if="element.shadow">
						<InspectorColorPickerField
							label="Color"
							:model-value="element.shadow.color.startsWith('#') ? element.shadow.color : '#000000'"
							@update:model-value="(v) => update({ shadow: { ...element.shadow!, color: v } })"
						/>
						<SliderField
							inline
							label="Offset X"
							:model-value="element.shadow.offsetX"
							:min="-20"
							:max="20"
							:step="1"
							:readout="String(element.shadow.offsetX)"
							@update:model-value="(v) => update({ shadow: { ...element.shadow!, offsetX: v } })"
						/>
						<SliderField
							inline
							label="Offset Y"
							:model-value="element.shadow.offsetY"
							:min="-20"
							:max="20"
							:step="1"
							:readout="String(element.shadow.offsetY)"
							@update:model-value="(v) => update({ shadow: { ...element.shadow!, offsetY: v } })"
						/>
						<SliderField
							inline
							label="Blur"
							:model-value="element.shadow.blur"
							:min="0"
							:max="30"
							:step="1"
							:readout="String(element.shadow.blur)"
							@update:model-value="(v) => update({ shadow: { ...element.shadow!, blur: v } })"
						/>
					</template>
				</InspectorSwitchCard>

				<InspectorSwitchCard
					title="Glow"
					:model-value="showGlow"
					:open="showGlow && !!element.glow"
					@update:model-value="toggleGlow"
				>
					<template v-if="element.glow">
						<InspectorColorPickerField
							label="Color"
							:model-value="element.glow.color"
							@update:model-value="(v) => update({ glow: { ...element.glow!, color: v } })"
						/>
						<SliderField
							inline
							label="Intensity"
							:model-value="element.glow.intensity"
							:min="1"
							:max="30"
							:step="1"
							:readout="String(element.glow.intensity)"
							@update:model-value="(v) => update({ glow: { ...element.glow!, intensity: v } })"
						/>
					</template>
				</InspectorSwitchCard>

				<InspectorSwitchCard
					title="Gradient"
					:model-value="showGradient"
					:open="showGradient && !!element.gradient"
					@update:model-value="toggleGradient"
				>
					<template v-if="element.gradient">
						<InspectorField inline label="Colors">
							<ColorPicker
								:model-value="element.gradient.colors[0]"
								:class="pickerClass"
								@update:model-value="(v) => update({ gradient: { ...element.gradient!, colors: [v, element.gradient!.colors[1]] } })"
							/>
							<!-- Preview of the user's gradient (user content colors) -->
							<div
								class="h-4 min-w-0 flex-1 rounded border border-line-subtle"
								:style="{ background: `linear-gradient(${element.gradient.angle}deg, ${element.gradient.colors[0]}, ${element.gradient.colors[1]})` }"
							/>
							<ColorPicker
								:model-value="element.gradient.colors[1]"
								:class="pickerClass"
								@update:model-value="(v) => update({ gradient: { ...element.gradient!, colors: [element.gradient!.colors[0], v] } })"
							/>
						</InspectorField>
						<SliderField
							inline
							label="Angle"
							:model-value="element.gradient.angle"
							:min="0"
							:max="360"
							:step="15"
							:readout="`${element.gradient.angle}°`"
							@update:model-value="(v) => update({ gradient: { ...element.gradient!, angle: v } })"
						/>
					</template>
				</InspectorSwitchCard>
			</InspectorSection>

			<!-- ══════ Bubble tab ══════ -->
			<template v-else-if="activeTopTab === 'bubble'">
				<InspectorSection title="Shape">
					<div class="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
						<button
							v-for="b in bubbleOptions"
							:key="b.value"
							type="button"
							:title="b.label"
							:aria-pressed="element.bubbleStyle === b.value"
							class="flex min-w-0 flex-col items-center gap-1 rounded-md border px-1 pb-1.5 pt-2 transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
							:class="element.bubbleStyle === b.value
								? 'border-brand-line bg-brand-soft text-brand'
								: 'border-line-subtle bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg'"
							@click="update({ bubbleStyle: b.value })"
						>
							<!-- Mini shape illustration (UI chrome: follows the tile's text color) -->
							<svg viewBox="0 0 40 28" class="h-5 w-8" aria-hidden="true">
								<template v-if="b.icon === 'none'">
									<text x="20" y="20.5" text-anchor="middle" fill="currentColor" font-size="18" font-weight="500">T</text>
								</template>
								<template v-else-if="b.icon === 'rounded'">
									<rect x="4" y="4" width="32" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" />
								</template>
								<template v-else-if="b.icon === 'pill'">
									<rect x="4" y="6" width="32" height="16" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" />
								</template>
								<template v-else-if="b.icon === 'speech'">
									<rect x="4" y="3" width="32" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" />
									<path d="M12 20 L9 27 L16 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
								</template>
								<template v-else-if="b.icon === 'thought'">
									<rect x="4" y="2" width="32" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" />
									<circle cx="12" cy="22" r="2" fill="currentColor" />
									<circle cx="9" cy="25.5" r="1.2" fill="currentColor" />
								</template>
								<template v-else-if="b.icon === 'label'">
									<path d="M12 4 L36 4 L36 24 L12 24 L4 14 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
								</template>
								<template v-else-if="b.icon === 'neon'">
									<rect x="6" y="5" width="28" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" />
									<rect x="6" y="5" width="28" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="3" opacity="0.25" />
								</template>
								<template v-else-if="b.icon === 'glitch'">
									<rect x="5" y="5" width="30" height="18" fill="none" stroke="currentColor" stroke-width="1.5" />
									<rect x="7" y="6" width="30" height="18" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4" />
								</template>
							</svg>
							<span class="max-w-full truncate text-2xs leading-none">{{ b.label }}</span>
						</button>
					</div>
				</InspectorSection>

				<InspectorSection v-if="element.bubbleStyle !== 'none'" title="Bubble">
					<InspectorColorPickerField
						label="Color"
						:model-value="element.bubbleColor || '#3b82f6'"
						@update:model-value="(v) => update({ bubbleColor: v })"
					/>
					<SliderField
						inline
						label="Padding"
						:model-value="element.bubblePadding ?? 16"
						:min="4"
						:max="40"
						:step="2"
						:readout="`${element.bubblePadding ?? 16}px`"
						@update:model-value="(v) => update({ bubblePadding: v })"
					/>
					<SliderField
						inline
						label="Opacity"
						:model-value="(element.bubbleOpacity ?? 1) * 100"
						:readout="`${bubbleOpacityInput}%`"
						@update:model-value="(v) => { bubbleOpacityInput = String(v); update({ bubbleOpacity: v / 100 }); }"
					/>
				</InspectorSection>
			</template>

			<!-- ══════ Animate tab (video only) ══════ -->
			<InspectorSection v-else-if="!isImageMode && activeTopTab === 'animate'" title="Animation" flush>
				<AnimationProperties
					:element-id="element.id"
					:track-id="trackId"
					:animation-in="element.animationIn"
					:animation-out="element.animationOut"
					:animation-loop="element.animationLoop"
					:element-duration="element.duration"
				/>
			</InspectorSection>

			<!-- ══════ Keyframes tab (video only) ══════ -->
			<KeyframeEditorPanel v-else-if="!isImageMode && activeTopTab === 'keyframes'" :track-id="trackId" :element="element" />
		</div>

		<InspectorTabRail v-model="activeTopTab" :tabs="topTabs" />
	</div>
</template>
