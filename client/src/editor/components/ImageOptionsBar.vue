<script setup lang="ts">
import { computed } from "vue";
import { IMAGE_TOOL_BY_ID } from "../constants/image-tool-flyouts";
import { useImageEditorTools } from "../composables/useImageEditorTools";
import { useImageBackgroundEraser } from "../composables/useImageBackgroundEraser";
import { useEditorUIState } from "../composables/useEditorUIState";
import { ArrowLeftRight } from "lucide-vue-next";

const {
	activeTool,
	brushSize,
	brushOpacity,
	brushHardness,
	fillTolerance,
	wandTolerance,
	wandContiguous,
	fillColor,
	strokeColor,
} = useImageEditorTools();
const { bgEraserSampling, bgEraserLimits, bgEraserTolerance } = useImageBackgroundEraser();
const { isCropMode } = useEditorUIState();

const toolMeta = computed(() => IMAGE_TOOL_BY_ID[activeTool.value]);

const showBrushControls = computed(
	() =>
		activeTool.value === "brush" ||
		activeTool.value === "pencil" ||
		activeTool.value === "eraser" ||
		activeTool.value === "background-eraser" ||
		activeTool.value === "clone" ||
		activeTool.value === "heal" ||
		activeTool.value === "spot-heal",
);

function swapColors() {
	const nextFill = strokeColor.value;
	strokeColor.value = fillColor.value;
	fillColor.value = nextFill;
}
</script>

<template>
	<div class="flex h-8 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#1a1a1d] px-3">
		<div class="flex min-w-[120px] items-center gap-2">
			<span class="truncate text-[11px] font-medium text-zinc-200">
				{{ toolMeta?.label?.replace(/ Tool$/, "") ?? "Tool" }}
			</span>
			<span class="text-[10px] text-zinc-600">{{ toolMeta?.shortcut }}</span>
		</div>

		<div class="h-4 w-px bg-white/10" />

		<div class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
			<template v-if="showBrushControls">
				<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
					Size
					<input
						v-model.number="brushSize"
						type="range"
						min="1"
						max="200"
						class="w-24 accent-blue-500"
					/>
					<span class="w-7 tabular-nums text-zinc-400">{{ brushSize }}</span>
				</label>
				<label
					v-if="activeTool !== 'pencil'"
					class="flex items-center gap-1.5 text-[10px] text-zinc-500"
				>
					Hardness
					<input
						v-model.number="brushHardness"
						type="range"
						min="0"
						max="1"
						step="0.05"
						class="w-16 accent-blue-500"
					/>
					<span class="w-7 tabular-nums text-zinc-400">{{ Math.round(brushHardness * 100) }}%</span>
				</label>
				<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
					Opacity
					<input
						v-model.number="brushOpacity"
						type="range"
						min="0.05"
						max="1"
						step="0.05"
						class="w-16 accent-blue-500"
					/>
					<span class="w-7 tabular-nums text-zinc-400">{{ Math.round(brushOpacity * 100) }}%</span>
				</label>
				<template v-if="activeTool === 'background-eraser'">
					<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
						Tolerance
						<input
							v-model.number="bgEraserTolerance"
							type="range"
							min="0"
							max="128"
							class="w-20 accent-blue-500"
						/>
						<span class="w-7 tabular-nums text-zinc-400">{{ bgEraserTolerance }}</span>
					</label>
					<select
						v-model="bgEraserSampling"
						class="rounded border border-white/10 bg-transparent px-1 py-0.5 text-[10px] text-zinc-300"
						title="Sampling"
					>
						<option value="continuous">Continuous</option>
						<option value="once">Once</option>
					</select>
					<select
						v-model="bgEraserLimits"
						class="rounded border border-white/10 bg-transparent px-1 py-0.5 text-[10px] text-zinc-300"
						title="Limits"
					>
						<option value="contiguous">Contiguous</option>
						<option value="discontiguous">Discontiguous</option>
					</select>
				</template>
				<p v-else class="truncate text-[11px] text-zinc-500">
					{{ toolMeta?.hint }}
					<span v-if="activeTool === 'eraser' || activeTool === 'background-eraser' || activeTool === 'magic-eraser'" class="text-zinc-600">
						· Shift+E cycles
					</span>
				</p>
			</template>

			<template v-else-if="activeTool === 'magic-wand' || activeTool === 'magic-eraser'">
				<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
					Tolerance
					<input
						v-model.number="wandTolerance"
						type="range"
						min="0"
						max="128"
						class="w-24 accent-blue-500"
					/>
					<span class="w-7 tabular-nums text-zinc-400">{{ wandTolerance }}</span>
				</label>
				<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
					<input v-model="wandContiguous" type="checkbox" class="accent-blue-500" />
					Contiguous
				</label>
				<p class="truncate text-[11px] text-zinc-500">{{ toolMeta?.hint }}</p>
			</template>

			<template v-else-if="activeTool === 'fill'">
				<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
					Tolerance
					<input
						v-model.number="fillTolerance"
						type="range"
						min="0"
						max="128"
						class="w-24 accent-blue-500"
					/>
					<span class="w-7 tabular-nums text-zinc-400">{{ fillTolerance }}</span>
				</label>
				<p class="truncate text-[11px] text-zinc-500">{{ toolMeta?.hint }} · Shift+G cycles</p>
			</template>

			<p v-else-if="activeTool === 'crop'" class="truncate text-[11px] text-zinc-500">
				{{ isCropMode ? "Drag handles to crop, then confirm" : toolMeta?.hint }}
			</p>

			<p v-else class="truncate text-[11px] text-zinc-500">
				{{ toolMeta?.hint }}
				<span v-if="toolMeta && ['M','L','B','E','G','J','U'].includes(toolMeta.shortcut)" class="text-zinc-600">
					· Shift+{{ toolMeta.shortcut }} cycles related tools
				</span>
			</p>
		</div>

		<div class="ml-auto flex items-center gap-2">
			<div class="relative size-8">
				<input
					v-model="strokeColor"
					type="color"
					class="absolute bottom-0 right-0 size-4 cursor-pointer rounded-sm border border-white/20 bg-transparent"
					title="Stroke"
				/>
				<input
					v-model="fillColor"
					type="color"
					class="absolute left-0 top-0 size-5 cursor-pointer rounded-sm border border-white/20 bg-transparent"
					title="Fill"
				/>
			</div>
			<button
				type="button"
				class="rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
				title="Swap fill and stroke"
				@click="swapColors"
			>
				<ArrowLeftRight class="size-3" />
			</button>
		</div>
	</div>
</template>
