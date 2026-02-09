<script setup lang="ts">
import { ref, computed } from "vue";
import { TRANSITION_PRESETS, TRANSITION_CATEGORIES } from "../../../constants/transition-constants";
import type { TransitionCategory, TransitionPreset } from "../../../types/transitions";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { ArrowRightLeft, Search, Check, Trash2, GripVertical } from "lucide-vue-next";
import TransitionPreviewCanvas from "./TransitionPreviewCanvas.vue";
import { generateUUID } from "../../../utils/id";
import { setDragData } from "../../../lib/drag-data";
import type { TransitionDragData } from "../../../types/drag";

function handleDragStart(e: DragEvent, preset: TransitionPreset) {
	if (!e.dataTransfer) return;
	const data: TransitionDragData = {
		id: generateUUID(),
		name: preset.label,
		type: "transition",
		transitionType: preset.type,
		duration: preset.defaultDuration,
	};
	setDragData({ dataTransfer: e.dataTransfer, dragData: data });
}

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

const activeCategory = ref<TransitionCategory | "all">("all");
const searchQuery = ref("");

const filteredPresets = computed(() => {
	let presets = TRANSITION_PRESETS;
	if (activeCategory.value !== "all") {
		presets = presets.filter((p) => p.category === activeCategory.value);
	}
	if (searchQuery.value.trim()) {
		const q = searchQuery.value.toLowerCase();
		presets = presets.filter(
			(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
		);
	}
	return presets;
});

const categoryTabs = computed(() => [
	{ key: "all" as const, label: "All" },
	...TRANSITION_CATEGORIES,
]);

const selectedElement = computed(() => {
	if (selectedElements.value.length !== 1) return null;
	const sel = selectedElements.value[0];
	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return null; }
	if (!scene) return null;
	for (const track of scene.tracks) {
		if (track.id !== sel.trackId) continue;
		if (track.type !== "video") continue;
		const el = track.elements.find((e: any) => e.id === sel.elementId);
		if (el) return { element: el, trackId: track.id, track };
	}
	return null;
});

const existingTransitions = computed(() => {
	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return []; }
	return scene?.transitions ?? [];
});

const activeTransition = computed(() => {
	const sel = selectedElement.value;
	if (!sel) return null;
	return existingTransitions.value.find((t) => t.targetElementId === sel.element.id) ?? null;
});

function applyTransition(preset: TransitionPreset) {
	const sel = selectedElement.value;
	if (!sel) return;

	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return; }
	if (!scene) return;

	const currentTransitions = [...(scene.transitions ?? [])];

	// Remove existing transition for this element
	const filtered = currentTransitions.filter((t) => t.targetElementId !== sel.element.id);

	// Add new transition
	filtered.push({
		id: generateUUID(),
		type: preset.type,
		duration: preset.defaultDuration,
		targetElementId: sel.element.id,
		trackId: sel.trackId,
	});

	// Store transitions on the scene
	const updatedScene = { ...scene, transitions: filtered };
	const scenes = editor.scenes.getScenes().map((s) =>
		s.id === scene.id ? updatedScene : s,
	);
	editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
}

function removeTransition() {
	const sel = selectedElement.value;
	if (!sel) return;

	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return; }
	if (!scene) return;

	const filtered = (scene.transitions ?? []).filter((t) => t.targetElementId !== sel.element.id);
	const updatedScene = { ...scene, transitions: filtered };
	const scenes = editor.scenes.getScenes().map((s) =>
		s.id === scene.id ? updatedScene : s,
	);
	editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
}

</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Search -->
		<div class="border-b border-white/10 px-3 py-2">
			<div class="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2">
				<Search class="size-3.5 shrink-0 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search transitions..."
					class="h-7 w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
				/>
			</div>
		</div>

		<!-- Category tabs -->
		<div class="flex items-center gap-0.5 overflow-x-auto border-b border-white/10 px-2 py-1">
			<button
				v-for="cat in categoryTabs"
				:key="cat.key"
				:class="[
					'whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
					activeCategory === cat.key
						? 'bg-blue-500/20 text-blue-400'
						: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
				]"
				@click="activeCategory = cat.key"
			>
				{{ cat.label }}
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-3">
			<!-- Hint -->
			<div class="mb-3 flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
				<GripVertical class="size-3.5 shrink-0 text-zinc-600" />
				<p class="text-[11px] text-zinc-500">Drag between clips, or select a clip and click to apply</p>
			</div>

			<!-- Active transition -->
			<div v-if="activeTransition" class="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="size-8 shrink-0 overflow-hidden rounded bg-zinc-900">
							<TransitionPreviewCanvas :transition-type="activeTransition.type" />
						</div>
						<div>
							<p class="text-xs font-medium text-blue-400">{{ activeTransition.type }}</p>
							<p class="text-[10px] text-zinc-500">{{ activeTransition.duration }}s duration</p>
						</div>
					</div>
					<button
						class="flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
						@click="removeTransition"
					>
						<Trash2 class="size-3.5" />
					</button>
				</div>
			</div>

			<!-- Transition grid -->
			<div v-if="filteredPresets.length === 0" class="flex items-center justify-center py-8">
				<p class="text-xs text-zinc-500">No transitions found</p>
			</div>

			<div v-else class="grid grid-cols-2 gap-2">
				<button
					v-for="preset in filteredPresets"
					:key="preset.type"
					draggable="true"
					:class="[
						'group overflow-hidden rounded-lg border transition-all cursor-grab active:cursor-grabbing',
						activeTransition?.type === preset.type
							? 'border-blue-500/40 bg-blue-500/10'
							: 'border-white/5 bg-white/[0.02] hover:border-[#E040FB]/30 hover:bg-[#E040FB]/5',
					]"
					@click="applyTransition(preset)"
					@dragstart="handleDragStart($event, preset)"
				>
					<!-- Transition preview thumbnail -->
					<div class="relative aspect-[3/2] w-full overflow-hidden bg-zinc-900">
						<TransitionPreviewCanvas :transition-type="preset.type" />
						<!-- Active checkmark -->
						<div v-if="activeTransition?.type === preset.type" class="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-blue-500">
							<Check class="size-2.5 text-white" />
						</div>
					</div>
					<div class="px-2 py-1.5 text-center">
						<p class="text-[11px] font-medium" :class="activeTransition?.type === preset.type ? 'text-blue-400' : 'text-zinc-300 group-hover:text-zinc-100'">
							{{ preset.label }}
						</p>
						<p class="mt-0.5 text-[9px] leading-tight text-zinc-600">{{ preset.description }}</p>
					</div>
				</button>
			</div>
		</div>
	</div>
</template>
