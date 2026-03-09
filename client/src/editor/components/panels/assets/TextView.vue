<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useFontManager } from "../../../composables/useFontManager";
import { DEFAULT_TEXT_ELEMENT, TEXT_PRESETS } from "../../../constants/text-constants";
import { buildTextElement } from "../../../lib/timeline/element-utils";
import { Plus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor();
const { uploadCustomFont } = useFontManager();

const searchQuery = ref("");

const filteredPresets = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return TEXT_PRESETS;
	return TEXT_PRESETS.filter((p) => p.name.toLowerCase().includes(q) || p.element.content?.toLowerCase().includes(q));
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

		<!-- Presets list -->
		<div class="flex-1 overflow-y-auto">
			<button
				v-for="preset in filteredPresets"
				:key="preset.id"
				type="button"
				class="group flex w-full items-center gap-3 border-b border-white/[0.05] px-3 py-2 transition-colors hover:bg-white/[0.03]"
				@click="addPreset(preset.id)"
			>
				<!-- Styled preview swatch -->
				<div
					class="flex h-9 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md"
					:class="getPresetCardBg(preset)"
				>
					<div :style="getPresetBgStyle(preset)" class="flex items-center justify-center px-1.5">
						<span :style="getPresetPreviewStyle(preset)" class="select-none whitespace-nowrap leading-tight">
							Sample
						</span>
					</div>
				</div>
				<!-- Name -->
				<span class="truncate text-xs text-zinc-400 transition-colors group-hover:text-zinc-200">{{ preset.name }}</span>
			</button>
		</div>
	</div>
</template>
