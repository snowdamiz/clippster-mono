<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import type { TextElement, TextBubbleStyle, TextCase } from "../../../types/timeline";
import { BUILT_IN_FONTS } from "../../../constants/text-constants";
import { Button } from "@/components/ui/button";
import {
	Upload,
	ChevronDown,
	AlignLeft,
	AlignCenter,
	AlignRight,
	Bold,
	Italic,
	Underline,
	Strikethrough,
	Type,
} from "lucide-vue-next";
import AnimationProperties from "./AnimationProperties.vue";

const props = defineProps<{
	element: TextElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { allFonts, uploadCustomFont, ensureFontLoaded } = useFontManager();

const fontSizeInput = ref(props.element.fontSize.toString());
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const contentInput = ref(props.element.content);
const showStroke = ref(!!props.element.stroke);
const showShadow = ref(!!props.element.shadow);
const showGlow = ref(!!props.element.glow);
const showGradient = ref(!!props.element.gradient?.enabled);

// Collapsible section state
const sections = ref({
	font: true,
	appearance: true,
	bubble: false,
	effects: false,
});

function toggleSection(key: keyof typeof sections.value) {
	sections.value[key] = !sections.value[key];
}

watch(() => props.element.fontSize, (v) => { fontSizeInput.value = v.toString(); });
watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.content, (v) => { contentInput.value = v; });
watch(() => props.element.stroke, (v) => { showStroke.value = !!v; });
watch(() => props.element.shadow, (v) => { showShadow.value = !!v; });
watch(() => props.element.glow, (v) => { showGlow.value = !!v; });
watch(() => props.element.gradient, (v) => { showGradient.value = !!v?.enabled; });

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
	const pct = Number.isNaN(parsed) ? Math.round(props.element.opacity * 100) : clamp(parsed, 0, 100);
	opacityInput.value = pct.toString();
	update({ opacity: pct / 100 });
}

function handleContentChange(e: Event) {
	const value = (e.target as HTMLTextAreaElement).value;
	contentInput.value = value;
	update({ content: value });
}

async function handleFontChange(e: Event) {
	const family = (e.target as HTMLSelectElement).value;
	const font = allFonts.value.find((f) => f.family === family);
	await ensureFontLoaded(family, font?.filePath);
	update({ fontFamily: family, fontFilePath: font?.filePath });
}

async function handleUploadFont() {
	const font = await uploadCustomFont();
	if (font) {
		update({ fontFamily: font.family, fontFilePath: font.filePath });
	}
}

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
	{ value: "700", label: "Bold" },
	{ value: "800", label: "ExtraBold" },
	{ value: "900", label: "Black" },
];
</script>

<template>
	<div class="flex flex-col divide-y divide-white/5">
		<!-- Content -->
		<div class="px-3 py-3">
			<textarea
				class="min-h-16 w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500/50 focus:outline-none"
				placeholder="Enter text..."
				:value="contentInput"
				@input="handleContentChange"
			/>
		</div>

		<!-- ═══ FONT SECTION ═══ -->
		<div>
			<button class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-300" @click="toggleSection('font')">
				<span>Font</span>
				<ChevronDown class="size-3.5 transition-transform" :class="{ 'rotate-180': !sections.font }" />
			</button>
			<div v-show="sections.font" class="space-y-3 px-3 pb-3">
				<!-- Font Family + Upload -->
				<div class="flex items-center gap-1.5">
					<select
						class="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500/50 focus:outline-none"
						:value="element.fontFamily"
						@change="handleFontChange"
					>
						<optgroup label="Built-in">
							<option v-for="f in BUILT_IN_FONTS" :key="f.family" :value="f.family">{{ f.label }}</option>
						</optgroup>
						<optgroup v-if="allFonts.filter(f => f.category === 'custom').length > 0" label="Custom">
							<option v-for="f in allFonts.filter(f => f.category === 'custom')" :key="f.family" :value="f.family">{{ f.label }}</option>
						</optgroup>
					</select>
					<button class="flex size-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200" title="Upload font" @click="handleUploadFont">
						<Upload class="size-3" />
					</button>
				</div>

				<!-- Weight + Size row -->
				<div class="flex items-center gap-1.5">
					<select
						class="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 focus:border-blue-500/50 focus:outline-none"
						:value="element.fontWeight"
						@change="update({ fontWeight: ($event.target as HTMLSelectElement).value })"
					>
						<option v-for="w in weightOptions" :key="w.value" :value="w.value">{{ w.label }}</option>
					</select>
					<div class="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5">
						<Type class="size-3 shrink-0 text-zinc-500" />
						<input type="number" :value="fontSizeInput" min="8" max="300"
							class="h-7 w-10 bg-transparent text-center text-xs text-zinc-200 focus:outline-none"
							@input="(e) => handleFontSizeChange((e.target as HTMLInputElement).value)" @blur="handleFontSizeBlur" />
					</div>
				</div>

				<!-- Style + Align row -->
				<div class="flex items-center gap-3">
					<!-- Style buttons -->
					<div class="flex items-center rounded border border-white/10">
						<button
							class="flex size-7 items-center justify-center text-zinc-400 transition-colors first:rounded-l last:rounded-r hover:text-zinc-200"
							:class="element.fontWeight === 'bold' || element.fontWeight === '700' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ fontWeight: element.fontWeight === 'bold' || element.fontWeight === '700' ? 'normal' : 'bold' })"
						><Bold class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors hover:text-zinc-200"
							:class="element.fontStyle === 'italic' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })"
						><Italic class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors hover:text-zinc-200"
							:class="element.textDecoration === 'underline' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })"
						><Underline class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors last:rounded-r hover:text-zinc-200"
							:class="element.textDecoration === 'line-through' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ textDecoration: element.textDecoration === 'line-through' ? 'none' : 'line-through' })"
						><Strikethrough class="size-3.5" /></button>
					</div>

					<!-- Align buttons -->
					<div class="flex items-center rounded border border-white/10">
						<button
							class="flex size-7 items-center justify-center text-zinc-400 transition-colors first:rounded-l hover:text-zinc-200"
							:class="element.textAlign === 'left' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ textAlign: 'left' })"
						><AlignLeft class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors hover:text-zinc-200"
							:class="element.textAlign === 'center' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ textAlign: 'center' })"
						><AlignCenter class="size-3.5" /></button>
						<button
							class="flex size-7 items-center justify-center border-l border-white/10 text-zinc-400 transition-colors last:rounded-r hover:text-zinc-200"
							:class="element.textAlign === 'right' ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ textAlign: 'right' })"
						><AlignRight class="size-3.5" /></button>
					</div>

					<!-- Case buttons -->
					<div class="flex items-center rounded border border-white/10">
						<button v-for="c in caseOptions" :key="c.value"
							class="flex size-7 items-center justify-center border-l border-white/10 text-[10px] font-semibold text-zinc-400 transition-colors first:border-l-0 first:rounded-l last:rounded-r hover:text-zinc-200"
							:class="element.textCase === c.value ? 'bg-blue-500/20 text-blue-400' : ''"
							@click="update({ textCase: c.value })"
						>{{ c.label }}</button>
					</div>
				</div>

				<!-- Color -->
				<div class="flex items-center gap-2">
					<label class="w-14 text-[10px] text-zinc-500">Color</label>
					<div class="relative">
						<input type="color" :value="element.color" class="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
							@input="(e) => update({ color: (e.target as HTMLInputElement).value })" />
						<div class="size-6 rounded border border-white/10" :style="{ backgroundColor: element.color }" />
					</div>
					<span class="font-mono text-[10px] uppercase text-zinc-500">{{ element.color }}</span>
				</div>
			</div>
		</div>

		<!-- ═══ APPEARANCE SECTION ═══ -->
		<div>
			<button class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-300" @click="toggleSection('appearance')">
				<span>Appearance</span>
				<ChevronDown class="size-3.5 transition-transform" :class="{ 'rotate-180': !sections.appearance }" />
			</button>
			<div v-show="sections.appearance" class="space-y-3 px-3 pb-3">
				<!-- Letter Spacing -->
				<div class="flex items-center gap-2">
					<label class="w-20 shrink-0 text-[10px] text-zinc-500">Spacing</label>
					<input type="range" :value="element.letterSpacing" min="-5" max="30" step="0.5" class="flex-1"
						@input="(e) => update({ letterSpacing: Number((e.target as HTMLInputElement).value) })" />
					<span class="w-10 text-right font-mono text-[10px] text-zinc-500">{{ element.letterSpacing }}px</span>
				</div>

				<!-- Line Height -->
				<div class="flex items-center gap-2">
					<label class="w-20 shrink-0 text-[10px] text-zinc-500">Line Height</label>
					<input type="range" :value="element.lineHeight" min="0.8" max="3" step="0.1" class="flex-1"
						@input="(e) => update({ lineHeight: Number((e.target as HTMLInputElement).value) })" />
					<span class="w-10 text-right font-mono text-[10px] text-zinc-500">{{ element.lineHeight?.toFixed(1) }}</span>
				</div>

				<!-- Opacity -->
				<div class="flex items-center gap-2">
					<label class="w-20 shrink-0 text-[10px] text-zinc-500">Opacity</label>
					<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="flex-1"
						@input="(e) => { const val = Number((e.target as HTMLInputElement).value); update({ opacity: val / 100 }); opacityInput = val.toString(); }" />
					<input type="number" :value="opacityInput" min="0" max="100"
						class="h-6 w-10 rounded border border-white/10 bg-white/5 text-center text-[10px] text-zinc-200 focus:outline-none"
						@input="(e) => handleOpacityChange((e.target as HTMLInputElement).value)" @blur="handleOpacityBlur" />
				</div>

				<!-- Background Color (non-bubble) -->
				<div v-if="element.bubbleStyle === 'none'" class="flex items-center gap-2">
					<label class="w-20 shrink-0 text-[10px] text-zinc-500">Background</label>
					<div class="relative">
						<input type="color"
							:value="element.backgroundColor === 'transparent' ? '#000000' : element.backgroundColor"
							class="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
							@input="(e) => update({ backgroundColor: (e.target as HTMLInputElement).value })" />
						<div class="size-6 rounded border border-white/10"
							:style="{ backgroundColor: element.backgroundColor === 'transparent' ? 'transparent' : element.backgroundColor }"
							:class="element.backgroundColor === 'transparent' && 'bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:8px_8px]'" />
					</div>
					<button class="text-[10px] text-zinc-500 hover:text-zinc-300"
						@click="update({ backgroundColor: element.backgroundColor === 'transparent' ? '#000000' : 'transparent' })">
						{{ element.backgroundColor === 'transparent' ? 'Add' : 'Clear' }}
					</button>
				</div>
			</div>
		</div>

		<!-- ═══ BUBBLE / SHAPE SECTION ═══ -->
		<div>
			<button class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-300" @click="toggleSection('bubble')">
				<span>Bubble / Shape</span>
				<ChevronDown class="size-3.5 transition-transform" :class="{ 'rotate-180': !sections.bubble }" />
			</button>
			<div v-show="sections.bubble" class="space-y-3 px-3 pb-3">
				<!-- Visual bubble shape picker grid -->
				<div class="grid grid-cols-4 gap-1.5">
					<button v-for="b in bubbleOptions" :key="b.value"
						class="group flex flex-col items-center gap-1 rounded-md border p-1.5 transition-all"
						:class="element.bubbleStyle === b.value
							? 'border-blue-500/60 bg-blue-500/10'
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
							:class="element.bubbleStyle === b.value ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-400'"
						>{{ b.label }}</span>
					</button>
				</div>

				<!-- Bubble Color + Padding (when bubble active) -->
				<div v-if="element.bubbleStyle !== 'none'" class="space-y-2">
					<div class="flex items-center gap-2">
						<label class="w-20 shrink-0 text-[10px] text-zinc-500">Color</label>
						<div class="relative">
							<input type="color" :value="element.bubbleColor || '#3b82f6'" class="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
								@input="(e) => update({ bubbleColor: (e.target as HTMLInputElement).value })" />
							<div class="size-6 rounded border border-white/10" :style="{ backgroundColor: element.bubbleColor || '#3b82f6' }" />
						</div>
						<span class="font-mono text-[10px] uppercase text-zinc-500">{{ element.bubbleColor || '#3b82f6' }}</span>
					</div>
					<div class="flex items-center gap-2">
						<label class="w-20 shrink-0 text-[10px] text-zinc-500">Padding</label>
						<input type="range" :value="element.bubblePadding ?? 16" min="4" max="40" step="2" class="flex-1"
							@input="(e) => update({ bubblePadding: Number((e.target as HTMLInputElement).value) })" />
						<span class="w-10 text-right font-mono text-[10px] text-zinc-500">{{ element.bubblePadding ?? 16 }}px</span>
					</div>
				</div>
			</div>
		</div>

		<!-- ═══ EFFECTS SECTION ═══ -->
		<div>
			<button class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-300" @click="toggleSection('effects')">
				<span>Effects</span>
				<ChevronDown class="size-3.5 transition-transform" :class="{ 'rotate-180': !sections.effects }" />
			</button>
			<div v-show="sections.effects" class="space-y-2 px-3 pb-3">
				<!-- Stroke -->
				<div class="rounded-md border border-white/5 bg-white/[0.02]">
					<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleStroke">
						<span class="text-xs text-zinc-300">Stroke</span>
						<div class="flex size-5 items-center justify-center rounded-sm" :class="showStroke ? 'bg-blue-500 text-white' : 'border border-white/15 text-transparent'">
							<svg class="size-3" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" fill="none" /></svg>
						</div>
					</button>
					<div v-if="showStroke && element.stroke" class="flex items-center gap-2 border-t border-white/5 px-2.5 py-2">
						<div class="relative">
							<input type="color" :value="element.stroke.color" class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
								@input="(e) => update({ stroke: { ...element.stroke!, color: (e.target as HTMLInputElement).value } })" />
							<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: element.stroke.color }" />
						</div>
						<input type="range" :value="element.stroke.width" min="1" max="20" step="0.5" class="flex-1"
							@input="(e) => update({ stroke: { ...element.stroke!, width: Number((e.target as HTMLInputElement).value) } })" />
						<input type="number" :value="element.stroke.width" min="1" max="20" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
							@input="(e) => update({ stroke: { ...element.stroke!, width: Number((e.target as HTMLInputElement).value) } })" />
					</div>
				</div>

				<!-- Shadow -->
				<div class="rounded-md border border-white/5 bg-white/[0.02]">
					<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleShadow">
						<span class="text-xs text-zinc-300">Shadow</span>
						<div class="flex size-5 items-center justify-center rounded-sm" :class="showShadow ? 'bg-blue-500 text-white' : 'border border-white/15 text-transparent'">
							<svg class="size-3" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" fill="none" /></svg>
						</div>
					</button>
					<div v-if="showShadow && element.shadow" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
						<div class="flex items-center gap-2">
							<div class="relative">
								<input type="color" :value="element.shadow.color.startsWith('rgba') ? '#000000' : element.shadow.color"
									class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
									@input="(e) => update({ shadow: { ...element.shadow!, color: (e.target as HTMLInputElement).value } })" />
								<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: element.shadow.color.startsWith('rgba') ? '#000' : element.shadow.color }" />
							</div>
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
							<input type="number" :value="element.shadow.blur" min="0" max="30" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
								@input="(e) => update({ shadow: { ...element.shadow!, blur: Number((e.target as HTMLInputElement).value) } })" />
						</div>
					</div>
				</div>

				<!-- Glow -->
				<div class="rounded-md border border-white/5 bg-white/[0.02]">
					<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleGlow">
						<span class="text-xs text-zinc-300">Glow</span>
						<div class="flex size-5 items-center justify-center rounded-sm" :class="showGlow ? 'bg-blue-500 text-white' : 'border border-white/15 text-transparent'">
							<svg class="size-3" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" fill="none" /></svg>
						</div>
					</button>
					<div v-if="showGlow && element.glow" class="flex items-center gap-2 border-t border-white/5 px-2.5 py-2">
						<div class="relative">
							<input type="color" :value="element.glow.color" class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
								@input="(e) => update({ glow: { ...element.glow!, color: (e.target as HTMLInputElement).value } })" />
							<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: element.glow.color }" />
						</div>
						<input type="range" :value="element.glow.intensity" min="1" max="30" step="1" class="flex-1"
							@input="(e) => update({ glow: { ...element.glow!, intensity: Number((e.target as HTMLInputElement).value) } })" />
						<input type="number" :value="element.glow.intensity" min="1" max="30" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
							@input="(e) => update({ glow: { ...element.glow!, intensity: Number((e.target as HTMLInputElement).value) } })" />
					</div>
				</div>

				<!-- Gradient -->
				<div class="rounded-md border border-white/5 bg-white/[0.02]">
					<button class="flex w-full items-center justify-between px-2.5 py-1.5" @click="toggleGradient">
						<span class="text-xs text-zinc-300">Gradient</span>
						<div class="flex size-5 items-center justify-center rounded-sm" :class="showGradient ? 'bg-blue-500 text-white' : 'border border-white/15 text-transparent'">
							<svg class="size-3" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" fill="none" /></svg>
						</div>
					</button>
					<div v-if="showGradient && element.gradient" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
						<div class="flex items-center gap-2">
							<div class="relative">
								<input type="color" :value="element.gradient.colors[0]" class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
									@input="(e) => update({ gradient: { ...element.gradient!, colors: [(e.target as HTMLInputElement).value, element.gradient!.colors[1]] } })" />
								<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: element.gradient.colors[0] }" />
							</div>
							<div class="h-4 flex-1 rounded" :style="{ background: `linear-gradient(${element.gradient.angle}deg, ${element.gradient.colors[0]}, ${element.gradient.colors[1]})` }" />
							<div class="relative">
								<input type="color" :value="element.gradient.colors[1]" class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
									@input="(e) => update({ gradient: { ...element.gradient!, colors: [element.gradient!.colors[0], (e.target as HTMLInputElement).value] } })" />
								<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: element.gradient.colors[1] }" />
							</div>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-[10px] text-zinc-500">Angle</span>
							<input type="range" :value="element.gradient.angle" min="0" max="360" step="15" class="flex-1"
								@input="(e) => update({ gradient: { ...element.gradient!, angle: Number((e.target as HTMLInputElement).value) } })" />
							<input type="number" :value="element.gradient.angle" min="0" max="360" step="15" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
								@input="(e) => update({ gradient: { ...element.gradient!, angle: Number((e.target as HTMLInputElement).value) } })" />
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Animation -->
		<div class="space-y-1.5">
			<label class="text-xs font-medium text-zinc-400">Animation</label>
			<div class="rounded-md border border-white/5 bg-white/[0.01]">
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
	</div>
</template>
