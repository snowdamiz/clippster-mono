<script setup lang="ts">
import { ref, computed } from "vue";
// activeCategory removed
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import { DEFAULT_TEXT_ELEMENT, TEXT_PRESETS, type TextPresetCategory } from "../../../constants/text-constants";
import { buildTextElement } from "../../../lib/timeline/element-utils";
import { Plus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor();
const { uploadCustomFont } = useFontManager();

const activeCategory = ref<TextPresetCategory | "all">("all");

const categories: { value: TextPresetCategory | "all"; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "basic", label: "Basic" },
	{ value: "titles", label: "Titles" },
	{ value: "subtitles", label: "Subs" },
	{ value: "lower-thirds", label: "L3" },
	{ value: "social", label: "Social" },
	{ value: "gaming", label: "Gaming" },
	{ value: "neon", label: "Neon" },
	{ value: "bubbles", label: "Bubbles" },
	{ value: "handwritten", label: "Hand" },
];

const hoveredPreset = ref<string | null>(null);
const searchQuery = ref("");

const filteredPresets = computed(() => {
	let presets = activeCategory.value === "all" ? TEXT_PRESETS : TEXT_PRESETS.filter((p) => p.category === activeCategory.value);
	const q = searchQuery.value.trim().toLowerCase();
	if (q) presets = presets.filter((p) => p.name.toLowerCase().includes(q) || p.element.content?.toLowerCase().includes(q));
	return presets;
});

function addPreset(presetId: string) {
	const preset = TEXT_PRESETS.find((p) => p.id === presetId);
	if (!preset) return;

	const currentTime = editor.playback.getCurrentTime();
	const merged = { ...DEFAULT_TEXT_ELEMENT, ...preset.element };
	const element = buildTextElement({ raw: merged, startTime: currentTime });

	editor.timeline.insertElement({
		element,
		placement: { mode: "auto" },
	});
}

function addDefaultText() {
	const currentTime = editor.playback.getCurrentTime();
	const element = buildTextElement({ raw: DEFAULT_TEXT_ELEMENT, startTime: currentTime });
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

async function handleUploadFont() {
	await uploadCustomFont();
}

function getPresetPreviewStyle(preset: typeof TEXT_PRESETS[number]): Record<string, string> {
	const el = preset.element;
	const style: Record<string, string> = {};
	style.fontFamily = `"${el.fontFamily || "Inter"}", sans-serif`;
	style.fontWeight = el.fontWeight === "bold" ? "bold" : el.fontWeight || "normal";
	style.fontStyle = el.fontStyle === "italic" ? "italic" : "normal";
	style.fontSize = "13px";
	style.lineHeight = "1.2";
	style.textTransform = el.textCase === "uppercase" ? "uppercase" : el.textCase === "lowercase" ? "lowercase" : el.textCase === "capitalize" ? "capitalize" : "none";

	if (el.letterSpacing) style.letterSpacing = `${Math.min(el.letterSpacing, 4)}px`;

	// Gradient text
	if (el.gradient?.enabled && el.gradient.colors) {
		style.background = `linear-gradient(${el.gradient.angle || 135}deg, ${el.gradient.colors[0]}, ${el.gradient.colors[1]})`;
		style.webkitBackgroundClip = "text";
		style.webkitTextFillColor = "transparent";
		style.backgroundClip = "text";
	} else {
		style.color = el.color || "#ffffff";
	}

	if (el.stroke) {
		style.webkitTextStroke = `${Math.min(el.stroke.width, 1.5)}px ${el.stroke.color}`;
	}

	const shadows: string[] = [];
	if (el.shadow) {
		shadows.push(`${el.shadow.offsetX}px ${el.shadow.offsetY}px ${el.shadow.blur}px ${el.shadow.color}`);
	}
	if (el.glow) {
		shadows.push(`0 0 ${el.glow.intensity}px ${el.glow.color}`);
		shadows.push(`0 0 ${el.glow.intensity * 2}px ${el.glow.color}`);
	}
	if (shadows.length) style.textShadow = shadows.join(", ");

	return style;
}

function getPresetBgStyle(preset: typeof TEXT_PRESETS[number]): Record<string, string> {
	const el = preset.element;
	const style: Record<string, string> = {};

	if (el.bubbleStyle && el.bubbleStyle !== "none" && el.bubbleColor) {
		if (el.bubbleStyle === "neon-box") {
			style.border = `1px solid ${el.bubbleColor}`;
			style.boxShadow = `0 0 6px ${el.bubbleColor}, inset 0 0 6px ${el.bubbleColor}20`;
			style.backgroundColor = "transparent";
			style.borderRadius = "4px";
		} else {
			style.backgroundColor = el.bubbleColor;
			if (el.bubbleStyle === "pill") style.borderRadius = "999px";
			else if (el.bubbleStyle === "rounded" || el.bubbleStyle === "speech" || el.bubbleStyle === "thought") style.borderRadius = "10px";
			else if (el.bubbleStyle === "label") style.borderRadius = "4px";
			else if (el.bubbleStyle === "glitch") style.borderRadius = "0";
		}
		style.padding = "3px 8px";
	} else if (el.backgroundColor && el.backgroundColor !== "transparent") {
		style.backgroundColor = el.backgroundColor;
		style.padding = "3px 6px";
		style.borderRadius = "3px";
	}

	return style;
}

function getPresetCardBg(preset: typeof TEXT_PRESETS[number]): string {
	const el = preset.element;
	if (el.glow || el.bubbleStyle === "neon-box") return "bg-zinc-950";
	return "bg-zinc-900/80";
}
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Search bar -->
		<PanelSearchBar v-model="searchQuery" placeholder="Search presets...">
			<Button variant="ghost" size="icon" class="size-6 mr-1" title="Upload custom font" @click="handleUploadFont">
				<Plus class="size-3" />
			</Button>
		</PanelSearchBar>

		<!-- Category tabs -->
		<div class="scrollbar-none flex gap-0.5 overflow-x-auto border-b border-white/5 px-2 py-1.5">
			<button
				v-for="cat in categories"
				:key="cat.value"
				type="button"
				:class="[
					'shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-all',
					activeCategory === cat.value
						? 'bg-primary/15 text-primary'
						: 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
				]"
				@click="activeCategory = cat.value"
			>
				{{ cat.label }}
			</button>
		</div>

		<!-- Presets grid -->
		<div class="flex-1 overflow-y-auto p-2">
			<!-- Add default text button -->
			<button
				type="button"
				class="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 py-3 text-xs text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
				@click="addDefaultText"
			>
				<Plus class="size-4" />
				Add Default Text
			</button>

			<div class="grid grid-cols-2 gap-1.5">
				<button
					v-for="preset in filteredPresets"
					:key="preset.id"
					type="button"
					class="group relative flex flex-col items-center justify-center overflow-hidden rounded-lg border border-white/5 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
					:class="getPresetCardBg(preset)"
					style="min-height: 96px"
					@click="addPreset(preset.id)"
					@mouseenter="hoveredPreset = preset.id"
					@mouseleave="hoveredPreset = null"
				>
					<!-- Preview area -->
					<div class="flex flex-1 items-center justify-center px-3 py-3">
						<div :style="getPresetBgStyle(preset)" class="relative flex items-center justify-center">
							<span
								:style="getPresetPreviewStyle(preset)"
								class="select-none truncate whitespace-nowrap leading-tight"
							>
								Sample
							</span>
						</div>
					</div>
					<!-- Label -->
					<div class="w-full border-t border-white/[0.03] bg-black/20 px-1.5 py-1">
						<span class="block truncate text-center text-[9px] leading-none text-zinc-600 group-hover:text-zinc-400">{{ preset.name }}</span>
					</div>
					<!-- Hover tooltip -->
					<div
						v-if="hoveredPreset === preset.id"
						class="pointer-events-none absolute inset-x-0 -top-10 z-10 flex items-center justify-center"
					>
						<div class="rounded bg-zinc-800 px-2 py-1 shadow-lg border border-white/10">
							<span
								:style="{ ...getPresetPreviewStyle(preset), fontSize: '16px' }"
								class="select-none whitespace-nowrap leading-tight"
							>
								Sample Text
							</span>
						</div>
					</div>
				</button>
			</div>
		</div>
	</div>
</template>
