<script setup lang="ts">
import { computed } from "vue";
import { nanoid } from "nanoid";
import { useEditor } from "../../../composables/useEditor";
import { useEditorUIState } from "../../../composables/useEditorUIState";
import type { VideoElement, ImageElement, MaskShape } from "../../../types/timeline";
import { Plus, Trash2, RectangleHorizontal, Circle, Pentagon } from "lucide-vue-next";

const props = defineProps<{
	element: VideoElement | ImageElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { maskEditMode } = useEditorUIState();

const masks = computed<MaskShape[]>(() => props.element.masks ?? []);

function updateMasks(newMasks: MaskShape[]) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: { masks: newMasks },
	});
}

function addMask(type: "rectangle" | "ellipse" | "polygon") {
	const newMask: MaskShape = {
		id: nanoid(8),
		type,
		x: 0.5,
		y: 0.5,
		width: 0.4,
		height: 0.3,
		feather: 0,
		invert: false,
		rotation: 0,
	};
	if (type === "polygon") {
		newMask.points = [
			{ x: 0.35, y: 0.35 },
			{ x: 0.65, y: 0.35 },
			{ x: 0.75, y: 0.6 },
			{ x: 0.5, y: 0.75 },
			{ x: 0.25, y: 0.6 },
		];
	}
	updateMasks([...masks.value, newMask]);
}

function removeMask(id: string) {
	updateMasks(masks.value.filter((m) => m.id !== id));
}

function updateMask(id: string, partial: Partial<MaskShape>) {
	updateMasks(
		masks.value.map((m) => (m.id === id ? { ...m, ...partial } : m)),
	);
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}
</script>

<template>
	<div class="flex min-w-0 flex-col gap-3 p-3">
		<div class="flex min-w-0 items-center justify-between gap-2">
			<span class="text-[11px] text-zinc-400">Mask lock</span>
			<button
				class="shrink-0 rounded px-2 py-0.5 text-[10px] transition"
				:class="!maskEditMode ? 'bg-primary/20 text-primary' : 'bg-white/5 text-zinc-400 hover:bg-white/10'"
				@click="maskEditMode = !maskEditMode"
			>
				{{ maskEditMode ? 'Unlocked' : 'Locked' }}
			</button>
		</div>

		<!-- Add buttons -->
		<div class="grid min-w-0 grid-cols-3 gap-1.5">
			<button
				type="button"
				title="Add rectangle mask"
				class="flex min-w-0 flex-col items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1 py-2 text-[10px] text-zinc-300 transition hover:bg-white/10"
				@click="addMask('rectangle')"
			>
				<RectangleHorizontal class="size-3.5 shrink-0" />
				<span class="truncate">Rect</span>
			</button>
			<button
				type="button"
				title="Add ellipse mask"
				class="flex min-w-0 flex-col items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1 py-2 text-[10px] text-zinc-300 transition hover:bg-white/10"
				@click="addMask('ellipse')"
			>
				<Circle class="size-3.5 shrink-0" />
				<span class="truncate">Ellipse</span>
			</button>
			<button
				type="button"
				title="Add polygon mask"
				class="flex min-w-0 flex-col items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1 py-2 text-[10px] text-zinc-300 transition hover:bg-white/10"
				@click="addMask('polygon')"
			>
				<Pentagon class="size-3.5 shrink-0" />
				<span class="truncate">Polygon</span>
			</button>
		</div>

		<!-- Empty state -->
		<div
			v-if="masks.length === 0"
			class="flex flex-col items-center justify-center gap-2 py-6 text-center"
		>
			<p class="text-xs text-zinc-500">No masks. Add a rectangle or ellipse above.</p>
		</div>

		<!-- Mask list -->
		<div
			v-for="mask in masks"
			:key="mask.id"
			class="min-w-0 rounded-md border border-white/10 bg-white/[0.03] p-3"
		>
			<!-- Mask header -->
			<div class="mb-2.5 flex items-center justify-between">
				<div class="flex items-center gap-1.5">
					<RectangleHorizontal v-if="mask.type === 'rectangle'" class="size-3.5 text-zinc-400" />
					<Circle v-else-if="mask.type === 'ellipse'" class="size-3.5 text-zinc-400" />
					<Pentagon v-else class="size-3.5 text-zinc-400" />
					<span class="text-xs font-medium capitalize text-zinc-300">{{ mask.type }}</span>
				</div>
				<button
					class="flex size-6 items-center justify-center rounded text-zinc-600 hover:text-red-400"
					@click="removeMask(mask.id)"
				>
					<Trash2 class="size-3.5" />
				</button>
			</div>

			<div class="grid grid-cols-2 gap-x-3 gap-y-2.5">
				<!-- Center X -->
				<div class="flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Center X</label>
					<input
						type="range"
						:value="mask.x"
						min="0" max="1" step="0.01"
						class="h-1 w-full accent-blue-500"
						@input="updateMask(mask.id, { x: Number(($event.target as HTMLInputElement).value) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ Math.round(mask.x * 100) }}%</span>
				</div>

				<!-- Center Y -->
				<div class="flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Center Y</label>
					<input
						type="range"
						:value="mask.y"
						min="0" max="1" step="0.01"
						class="h-1 w-full accent-blue-500"
						@input="updateMask(mask.id, { y: Number(($event.target as HTMLInputElement).value) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ Math.round(mask.y * 100) }}%</span>
				</div>

				<!-- Width -->
				<div class="flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Width</label>
					<input
						type="range"
						:value="mask.width"
						min="0.01" max="1" step="0.01"
						class="h-1 w-full accent-blue-500"
						@input="updateMask(mask.id, { width: clamp(Number(($event.target as HTMLInputElement).value), 0.01, 1) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ Math.round(mask.width * 100) }}%</span>
				</div>

				<!-- Height -->
				<div class="flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Height</label>
					<input
						type="range"
						:value="mask.height"
						min="0.01" max="1" step="0.01"
						class="h-1 w-full accent-blue-500"
						@input="updateMask(mask.id, { height: clamp(Number(($event.target as HTMLInputElement).value), 0.01, 1) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ Math.round(mask.height * 100) }}%</span>
				</div>

				<!-- Feather -->
				<div class="flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Feather</label>
					<input
						type="range"
						:value="mask.feather"
						min="0" max="80" step="1"
						class="h-1 w-full accent-purple-500"
						@input="updateMask(mask.id, { feather: Number(($event.target as HTMLInputElement).value) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ mask.feather }}px</span>
				</div>

				<!-- Rotation -->
				<div class="flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Rotation</label>
					<input
						type="range"
						:value="mask.rotation"
						min="-180" max="180" step="1"
						class="h-1 w-full accent-blue-500"
						@input="updateMask(mask.id, { rotation: Number(($event.target as HTMLInputElement).value) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ mask.rotation }}°</span>
				</div>

				<!-- Corner Radius (rectangle only) -->
				<div v-if="mask.type === 'rectangle'" class="col-span-2 flex flex-col gap-1">
					<label class="text-[10px] text-zinc-500">Corner Radius</label>
					<input
						type="range"
						:value="mask.cornerRadius ?? 0"
						min="0" max="1" step="0.01"
						class="h-1 w-full accent-blue-500"
						@input="updateMask(mask.id, { cornerRadius: Number(($event.target as HTMLInputElement).value) })"
					/>
					<span class="text-right text-[9px] text-zinc-500">{{ Math.round((mask.cornerRadius ?? 0) * 100) }}%</span>
				</div>
			</div>

			<!-- Invert toggle -->
			<div class="mt-2.5 flex items-center justify-between">
				<span class="text-[10px] text-zinc-500">Invert mask</span>
				<button
					class="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-medium transition"
					:class="mask.invert ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-zinc-500 hover:bg-white/10'"
					@click="updateMask(mask.id, { invert: !mask.invert })"
				>
					{{ mask.invert ? 'Inverted' : 'Normal' }}
				</button>
			</div>
		</div>
	</div>
</template>
