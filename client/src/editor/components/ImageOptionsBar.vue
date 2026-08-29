<script setup lang="ts">
import { computed } from "vue";
import { IMAGE_TOOL_RAIL, useImageEditorTools } from "../composables/useImageEditorTools";
import { useEditorUIState } from "../composables/useEditorUIState";
import { ArrowLeftRight, Circle, Square } from "lucide-vue-next";

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
	shapeKind,
	marqueeKind,
} = useImageEditorTools();
const { isCropMode } = useEditorUIState();

const toolMeta = computed(
	() => IMAGE_TOOL_RAIL.find((t) => t.id === activeTool.value) ?? IMAGE_TOOL_RAIL[0],
);

function swapColors() {
	const nextFill = strokeColor.value;
	strokeColor.value = fillColor.value;
	fillColor.value = nextFill;
}

const showBrushControls = computed(
	() =>
		activeTool.value === "brush" ||
		activeTool.value === "eraser" ||
		activeTool.value === "clone" ||
		activeTool.value === "heal",
);
</script>

<template>
	<div class="flex h-8 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#1a1a1d] px-3">
		<div class="flex min-w-[88px] items-center gap-2">
			<span class="text-[11px] font-medium text-zinc-200">{{ toolMeta.label }}</span>
			<span class="text-[10px] text-zinc-600">{{ toolMeta.shortcut }}</span>
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
				<label class="flex items-center gap-1.5 text-[10px] text-zinc-500">
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
				<p
					v-if="activeTool === 'clone' || activeTool === 'heal'"
					class="truncate text-[11px] text-zinc-500"
				>
					Alt-click or first click sets the source · Drag to stamp
				</p>
			</template>

			<p v-else-if="activeTool === 'move'" class="truncate text-[11px] text-zinc-500">
				Drag to move · Open Media to upload images from your computer
			</p>
			<template v-else-if="activeTool === 'marquee-rect'">
				<div class="flex items-center rounded border border-white/10 p-0.5">
					<button
						type="button"
						:class="[
							'flex size-6 items-center justify-center rounded-sm',
							marqueeKind === 'rect' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
						]"
						title="Rectangular marquee (M)"
						@click="marqueeKind = 'rect'"
					>
						<Square class="size-3.5" />
					</button>
					<button
						type="button"
						:class="[
							'flex size-6 items-center justify-center rounded-sm',
							marqueeKind === 'ellipse' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
						]"
						title="Elliptical marquee (Shift+M)"
						@click="marqueeKind = 'ellipse'"
					>
						<Circle class="size-3.5" />
					</button>
				</div>
				<p class="truncate text-[11px] text-zinc-500">
					Drag to select · Shift constrains · Delete / Ctrl+C / Esc
				</p>
			</template>
			<p v-else-if="activeTool === 'lasso'" class="truncate text-[11px] text-zinc-500">
				Drag a freehand selection · Delete / Ctrl+C / Esc work like marquee
			</p>
			<template v-else-if="activeTool === 'magic-wand'">
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
				<p class="truncate text-[11px] text-zinc-500">
					Click a color to select it · Delete / Ctrl+C / Esc
				</p>
			</template>
			<p v-else-if="activeTool === 'crop'" class="truncate text-[11px] text-zinc-500">
				{{ isCropMode ? "Drag handles to crop, then confirm" : "Drag on the canvas to crop" }}
			</p>
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
				<p class="truncate text-[11px] text-zinc-500">
					Click a layer to flood-fill · Empty canvas fills the background
				</p>
			</template>
			<p v-else-if="activeTool === 'gradient'" class="truncate text-[11px] text-zinc-500">
				Drag to paint a linear gradient from fill to stroke · Honors the current selection
			</p>
			<p v-else-if="activeTool === 'eyedropper'" class="truncate text-[11px] text-zinc-500">
				Click the canvas to sample a color
			</p>
			<p v-else-if="activeTool === 'text'" class="truncate text-[11px] text-zinc-500">
				Click the canvas to place a text layer
			</p>
			<p v-else-if="activeTool === 'hand'" class="truncate text-[11px] text-zinc-500">
				Drag to pan the canvas
			</p>
			<p v-else-if="activeTool === 'zoom'" class="truncate text-[11px] text-zinc-500">
				Click to zoom in · Alt-click to zoom out
			</p>

			<template v-else-if="activeTool === 'shape'">
				<div class="flex items-center rounded border border-white/10 p-0.5">
					<button
						type="button"
						:class="[
							'flex size-6 items-center justify-center rounded-sm',
							shapeKind === 'rect' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
						]"
						title="Rectangle"
						@click="shapeKind = 'rect'"
					>
						<Square class="size-3.5" />
					</button>
					<button
						type="button"
						:class="[
							'flex size-6 items-center justify-center rounded-sm',
							shapeKind === 'ellipse' ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
						]"
						title="Ellipse"
						@click="shapeKind = 'ellipse'"
					>
						<Circle class="size-3.5" />
					</button>
				</div>
				<span class="text-[11px] text-zinc-500">Click the canvas to place a shape</span>
			</template>
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
