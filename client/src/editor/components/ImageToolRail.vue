<script setup lang="ts">
import { computed, inject, type Ref } from "vue";
import {
	MousePointer2,
	Square,
	Crop,
	Paintbrush,
	Eraser,
	PaintBucket,
	Pipette,
	Type,
	Shapes,
	Hand,
	ZoomIn,
	ArrowLeftRight,
	ImagePlus,
	Lasso,
	WandSparkles,
	Blend,
	Stamp,
	Wand2,
} from "lucide-vue-next";
import { IMAGE_TOOL_RAIL, useImageEditorTools } from "../composables/useImageEditorTools";
import type { PixelToolId } from "../types/image-document";

const { activeTool, activateTool, fillColor, strokeColor } = useImageEditorTools();
const setImageDockTab = inject<(tab: string) => void>("setImageDockTab");
const imageDockTab = inject<Ref<string>>("imageDockTab");
const isPlaceOpen = computed(() => imageDockTab?.value === "media");

const ICONS: Record<string, any> = {
	move: MousePointer2,
	"marquee-rect": Square,
	lasso: Lasso,
	"magic-wand": WandSparkles,
	crop: Crop,
	brush: Paintbrush,
	eraser: Eraser,
	fill: PaintBucket,
	gradient: Blend,
	clone: Stamp,
	heal: Wand2,
	eyedropper: Pipette,
	text: Type,
	shape: Shapes,
	hand: Hand,
	zoom: ZoomIn,
};

const groupedTools = computed(() => {
	const groups: Array<{ group: string; tools: typeof IMAGE_TOOL_RAIL }> = [];
	for (const tool of IMAGE_TOOL_RAIL) {
		const last = groups[groups.length - 1];
		if (!last || last.group !== tool.group) {
			groups.push({ group: tool.group, tools: [tool] });
		} else {
			last.tools.push(tool);
		}
	}
	return groups;
});

function onSelectTool(id: PixelToolId) {
	activateTool(id);
}

function swapColors() {
	const nextFill = strokeColor.value;
	strokeColor.value = fillColor.value;
	fillColor.value = nextFill;
}

function resetColors() {
	fillColor.value = "#ffffff";
	strokeColor.value = "#000000";
}
</script>

<template>
	<div class="flex w-10 shrink-0 flex-col items-center border-r border-black/50 bg-[#1e1e1e] py-1.5">
		<template v-for="(group, index) in groupedTools" :key="group.group">
			<div v-if="index > 0" class="my-1 h-px w-6 bg-white/10" />
			<button
				v-for="tool in group.tools"
				:key="tool.id"
				type="button"
				:title="`${tool.label} (${tool.shortcut})`"
				:aria-label="tool.label"
				:aria-pressed="activeTool === tool.id"
				:class="[
					'flex size-8 items-center justify-center rounded-sm transition-colors',
					activeTool === tool.id
						? 'bg-[#4693e0] text-white'
						: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
				]"
				@click="onSelectTool(tool.id)"
			>
				<component :is="ICONS[tool.id] || MousePointer2" class="size-3.5" />
			</button>
		</template>

		<div class="my-1 h-px w-6 bg-white/10" />
		<button
			type="button"
			title="Upload images (Media)"
			aria-label="Open media panel"
			:aria-pressed="isPlaceOpen"
			:class="[
				'flex size-8 items-center justify-center rounded-sm transition-colors',
				isPlaceOpen
					? 'bg-[#4693e0] text-white'
					: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
			]"
			@click="setImageDockTab?.(isPlaceOpen ? 'properties' : 'media')"
		>
			<ImagePlus class="size-3.5" />
		</button>

		<div class="mt-auto flex flex-col items-center gap-1 pb-2">
			<div class="relative size-8">
				<button
					type="button"
					class="absolute bottom-0 right-0 size-[14px] rounded-[2px] border border-black/60"
					:style="{ backgroundColor: strokeColor }"
					title="Stroke color"
					@click="swapColors"
				/>
				<input
					v-model="fillColor"
					type="color"
					class="absolute left-0 top-0 size-[18px] cursor-pointer rounded-[2px] border border-black/60 bg-transparent p-0"
					title="Fill color"
				/>
			</div>
			<button
				type="button"
				class="text-[8px] leading-none text-zinc-600 hover:text-zinc-400"
				title="Reset to black and white"
				@click="resetColors"
			>
				D
			</button>
			<button
				type="button"
				class="text-zinc-600 hover:text-zinc-300"
				title="Swap fill and stroke (X)"
				@click="swapColors"
			>
				<ArrowLeftRight class="size-2.5" />
			</button>
		</div>
	</div>
</template>
