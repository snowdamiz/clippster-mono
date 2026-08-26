<script setup lang="ts">
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
} from "lucide-vue-next";
import { IMAGE_TOOL_RAIL, useImageEditorTools } from "../composables/useImageEditorTools";
import type { PixelToolId } from "../types/image-document";
import { useEditorUIState } from "../composables/useEditorUIState";

const {
	activeTool,
	setTool,
	brushSize,
	fillColor,
	insertShapeLayer,
	insertTextLayer,
	fillCanvasBackground,
} = useImageEditorTools();
const { isCropMode } = useEditorUIState();

const ICONS: Record<string, any> = {
	move: MousePointer2,
	"marquee-rect": Square,
	crop: Crop,
	brush: Paintbrush,
	eraser: Eraser,
	fill: PaintBucket,
	eyedropper: Pipette,
	text: Type,
	shape: Shapes,
	hand: Hand,
	zoom: ZoomIn,
};

async function onSelectTool(id: PixelToolId) {
	setTool(id);
	if (id === "crop") {
		isCropMode.value = true;
	} else if (isCropMode.value) {
		isCropMode.value = false;
	}
	if (id === "text") {
		insertTextLayer();
	}
	if (id === "shape") {
		await insertShapeLayer("rect");
	}
	if (id === "fill") {
		await fillCanvasBackground();
	}
}
</script>

<template>
	<div class="flex w-[44px] shrink-0 flex-col items-center gap-0.5 border-r border-white/[0.06] bg-[#0c0c0e] py-2">
		<button
			v-for="tool in IMAGE_TOOL_RAIL"
			:key="tool.id"
			type="button"
			:title="`${tool.label} (${tool.shortcut})`"
			:aria-label="tool.label"
			:aria-pressed="activeTool === tool.id"
			:class="[
				'flex size-8 items-center justify-center rounded-md transition-colors',
				activeTool === tool.id
					? 'bg-blue-500/20 text-blue-400'
					: 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200',
			]"
			@click="onSelectTool(tool.id)"
		>
			<component :is="ICONS[tool.id] || MousePointer2" class="size-3.5" />
		</button>

		<div class="my-1 h-px w-6 bg-white/10" />

		<div class="px-1 text-center">
			<label class="block text-[8px] text-zinc-600">Size</label>
			<input
				v-model.number="brushSize"
				type="range"
				min="1"
				max="200"
				class="w-8 accent-blue-500"
				title="Brush size"
			/>
		</div>
		<input
			v-model="fillColor"
			type="color"
			class="mt-1 size-6 cursor-pointer rounded border border-white/10 bg-transparent"
			title="Fill color"
		/>
	</div>
</template>
