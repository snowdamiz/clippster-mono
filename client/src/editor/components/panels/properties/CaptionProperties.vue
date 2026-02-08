<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import type { CaptionElement, CaptionPresetId, CaptionHighlightStyle } from "../../../types/timeline";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import { BUILT_IN_FONTS } from "../../../constants/text-constants";
import { Button } from "@/components/ui/button";
import {
	ChevronDown,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Bold,
	Type,
} from "lucide-vue-next";

const props = defineProps<{
	element: CaptionElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { allFonts, ensureFontLoaded } = useFontManager();

const fontSizeInput = ref(props.element.fontSize.toString());
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const maxWordsInput = ref(props.element.maxWordsPerLine.toString());
const showStroke = ref(!!props.element.stroke);
const showShadow = ref(!!props.element.shadow);
const showGlow = ref(!!props.element.glow);

const sections = ref({
	style: true,
	font: true,
	effects: false,
});

function toggleSection(key: keyof typeof sections.value) {
	sections.value[key] = !sections.value[key];
}

watch(() => props.element.fontSize, (v) => { fontSizeInput.value = v.toString(); });
watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.maxWordsPerLine, (v) => { maxWordsInput.value = v.toString(); });
watch(() => props.element.stroke, (v) => { showStroke.value = !!v; });
watch(() => props.element.shadow, (v) => { showShadow.value = !!v; });
watch(() => props.element.glow, (v) => { showGlow.value = !!v; });

function update(updates: Record<string, unknown>) {
	editor.timeline.updateCaptionElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: updates as any,
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

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

function selectFont(fontFamily: string, filePath?: string) {
	if (filePath) ensureFontLoaded(fontFamily, filePath);
	update({ fontFamily, fontFilePath: filePath });
}

function applyPreset(presetId: CaptionPresetId) {
	const preset = getPresetById(presetId);
	update({
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
	});
}

const highlightStyles: { value: CaptionHighlightStyle; label: string }[] = [
	{ value: "none", label: "None" },
	{ value: "karaoke", label: "Karaoke" },
	{ value: "karaoke-scale", label: "Karaoke Pop" },
	{ value: "underline", label: "Underline" },
	{ value: "background", label: "Background" },
	{ value: "glow", label: "Glow" },
];

const captionText = computed(() => {
	return props.element.lines.map((l) => l.text).join("\n");
});

const wordCount = computed(() => {
	return props.element.lines.reduce((sum, l) => sum + l.words.length, 0);
});
</script>

<template>
	<div class="flex flex-col gap-3 p-3 text-xs">
		<!-- Header info -->
		<div class="flex items-center justify-between">
			<span class="text-zinc-400">Caption</span>
			<span class="text-zinc-500">{{ wordCount }} words</span>
		</div>

		<!-- Preset selector -->
		<div>
			<button
				class="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200"
				@click="toggleSection('style')"
			>
				<span>Style: {{ getPresetById(element.presetId).name }}</span>
				<ChevronDown class="size-3.5" :class="{ 'rotate-180': sections.style }" />
			</button>
			<div v-if="sections.style" class="mt-2 grid grid-cols-3 gap-1.5">
				<button
					v-for="preset in CAPTION_PRESETS"
					:key="preset.id"
					class="rounded-md border px-2 py-1.5 text-[10px] transition-all"
					:class="
						element.presetId === preset.id
							? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
							: 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-300'
					"
					@click="applyPreset(preset.id)"
				>
					{{ preset.name }}
				</button>
			</div>
		</div>

		<!-- Highlight style -->
		<div class="space-y-1.5">
			<label class="text-zinc-500">Highlight</label>
			<select
				class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
				:value="element.highlightStyle"
				@change="update({ highlightStyle: ($event.target as HTMLSelectElement).value })"
			>
				<option v-for="hs in highlightStyles" :key="hs.value" :value="hs.value">
					{{ hs.label }}
				</option>
			</select>
		</div>

		<!-- Colors row -->
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
					<span class="text-zinc-400">{{ element.color }}</span>
				</div>
			</div>
			<div class="flex-1 space-y-1">
				<label class="text-zinc-500">Highlight</label>
				<div class="flex items-center gap-1.5">
					<input
						type="color"
						:value="element.highlightColor"
						class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
						@input="update({ highlightColor: ($event.target as HTMLInputElement).value })"
					/>
					<span class="text-zinc-400">{{ element.highlightColor }}</span>
				</div>
			</div>
		</div>

		<!-- Font section -->
		<button
			class="flex w-full items-center justify-between pt-1 text-zinc-400"
			@click="toggleSection('font')"
		>
			<span class="font-medium">Font</span>
			<ChevronDown class="size-3.5" :class="{ 'rotate-180': sections.font }" />
		</button>

		<div v-if="sections.font" class="space-y-2">
			<!-- Font family -->
			<select
				class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
				:value="element.fontFamily"
				@change="selectFont(($event.target as HTMLSelectElement).value)"
			>
				<option v-for="font in allFonts" :key="font.family" :value="font.family">
					{{ font.family }}
				</option>
			</select>

			<!-- Font size + weight row -->
			<div class="flex gap-2">
				<div class="flex-1 space-y-1">
					<label class="text-zinc-500">Size</label>
					<input
						type="text"
						:value="fontSizeInput"
						class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
						@input="handleFontSizeChange(($event.target as HTMLInputElement).value)"
						@blur="handleFontSizeBlur"
					/>
				</div>
				<div class="flex-1 space-y-1">
					<label class="text-zinc-500">Weight</label>
					<select
						class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
						:value="element.fontWeight"
						@change="update({ fontWeight: ($event.target as HTMLSelectElement).value })"
					>
						<option value="normal">Normal</option>
						<option value="bold">Bold</option>
						<option value="100">100</option>
						<option value="200">200</option>
						<option value="300">300</option>
						<option value="400">400</option>
						<option value="500">500</option>
						<option value="600">600</option>
						<option value="700">700</option>
						<option value="800">800</option>
						<option value="900">900</option>
					</select>
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

			<!-- Max words per line + opacity -->
			<div class="flex gap-2">
				<div class="flex-1 space-y-1">
					<label class="text-zinc-500">Words/line</label>
					<input
						type="text"
						:value="maxWordsInput"
						class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
						@input="handleMaxWordsChange(($event.target as HTMLInputElement).value)"
						@blur="handleMaxWordsBlur"
					/>
				</div>
				<div class="flex-1 space-y-1">
					<label class="text-zinc-500">Opacity %</label>
					<input
						type="text"
						:value="opacityInput"
						class="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200"
						@input="handleOpacityChange(($event.target as HTMLInputElement).value)"
						@blur="handleOpacityBlur"
					/>
				</div>
			</div>
		</div>

		<!-- Effects section -->
		<button
			class="flex w-full items-center justify-between pt-1 text-zinc-400"
			@click="toggleSection('effects')"
		>
			<span class="font-medium">Effects</span>
			<ChevronDown class="size-3.5" :class="{ 'rotate-180': sections.effects }" />
		</button>

		<div v-if="sections.effects" class="space-y-2">
			<!-- Stroke toggle -->
			<div class="flex items-center justify-between">
				<label class="text-zinc-400">Stroke</label>
				<button
					class="h-5 w-9 rounded-full transition-colors"
					:class="showStroke ? 'bg-sky-500' : 'bg-white/10'"
					@click="
						showStroke = !showStroke;
						update({
							stroke: showStroke
								? { color: element.stroke?.color || '#000000', width: element.stroke?.width || 3 }
								: undefined,
						})
					"
				>
					<div
						class="h-4 w-4 rounded-full bg-white shadow transition-transform"
						:class="showStroke ? 'translate-x-4' : 'translate-x-0.5'"
					/>
				</button>
			</div>
			<div v-if="showStroke && element.stroke" class="flex gap-2 pl-2">
				<input
					type="color"
					:value="element.stroke.color"
					class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
					@input="update({ stroke: { ...element.stroke!, color: ($event.target as HTMLInputElement).value } })"
				/>
				<input
					type="range"
					min="1"
					max="10"
					:value="element.stroke.width"
					class="flex-1"
					@input="update({ stroke: { ...element.stroke!, width: parseInt(($event.target as HTMLInputElement).value) } })"
				/>
				<span class="w-6 text-right text-zinc-500">{{ element.stroke.width }}</span>
			</div>

			<!-- Shadow toggle -->
			<div class="flex items-center justify-between">
				<label class="text-zinc-400">Shadow</label>
				<button
					class="h-5 w-9 rounded-full transition-colors"
					:class="showShadow ? 'bg-sky-500' : 'bg-white/10'"
					@click="
						showShadow = !showShadow;
						update({
							shadow: showShadow
								? { color: element.shadow?.color || 'rgba(0,0,0,0.8)', offsetX: 2, offsetY: 2, blur: 4 }
								: undefined,
						})
					"
				>
					<div
						class="h-4 w-4 rounded-full bg-white shadow transition-transform"
						:class="showShadow ? 'translate-x-4' : 'translate-x-0.5'"
					/>
				</button>
			</div>
			<div v-if="showShadow && element.shadow" class="space-y-1.5 pl-2">
				<div class="flex items-center gap-2">
					<input
						type="color"
						:value="element.shadow.color"
						class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
						@input="update({ shadow: { ...element.shadow!, color: ($event.target as HTMLInputElement).value } })"
					/>
					<label class="text-zinc-500">Blur</label>
					<input
						type="range"
						min="0"
						max="20"
						:value="element.shadow.blur"
						class="flex-1"
						@input="update({ shadow: { ...element.shadow!, blur: parseInt(($event.target as HTMLInputElement).value) } })"
					/>
					<span class="w-6 text-right text-zinc-500">{{ element.shadow.blur }}</span>
				</div>
			</div>

			<!-- Glow toggle -->
			<div class="flex items-center justify-between">
				<label class="text-zinc-400">Glow</label>
				<button
					class="h-5 w-9 rounded-full transition-colors"
					:class="showGlow ? 'bg-sky-500' : 'bg-white/10'"
					@click="
						showGlow = !showGlow;
						update({
							glow: showGlow
								? { color: element.glow?.color || '#22D3EE', intensity: element.glow?.intensity || 10 }
								: undefined,
						})
					"
				>
					<div
						class="h-4 w-4 rounded-full bg-white shadow transition-transform"
						:class="showGlow ? 'translate-x-4' : 'translate-x-0.5'"
					/>
				</button>
			</div>
			<div v-if="showGlow && element.glow" class="flex gap-2 pl-2">
				<input
					type="color"
					:value="element.glow.color"
					class="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent"
					@input="update({ glow: { ...element.glow!, color: ($event.target as HTMLInputElement).value } })"
				/>
				<input
					type="range"
					min="1"
					max="30"
					:value="element.glow.intensity"
					class="flex-1"
					@input="update({ glow: { ...element.glow!, intensity: parseInt(($event.target as HTMLInputElement).value) } })"
				/>
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

		<!-- Caption text preview -->
		<div class="mt-2 rounded-md border border-white/5 bg-white/[0.02] p-2">
			<label class="mb-1 block text-zinc-500">Caption Text</label>
			<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">{{ captionText }}</pre>
		</div>
	</div>
</template>
