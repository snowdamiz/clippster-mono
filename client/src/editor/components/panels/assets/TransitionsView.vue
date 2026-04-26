<script setup lang="ts">
import { ref, computed } from "vue";
import { TRANSITION_PRESETS } from "../../../constants/transition-constants";
import type { TransitionPreset } from "../../../types/transitions";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { ArrowRightLeft, Check, Trash2 } from "lucide-vue-next";
import PanelSearchBar from "./PanelSearchBar.vue";
import TransitionPreviewCanvas from "./TransitionPreviewCanvas.vue";
import { generateUUID } from "../../../utils/id";
import { usePointerDrag } from "../../../composables/usePointerDrag";
import type { TransitionDragData } from "../../../types/drag";
import {
	findTransitionForTrackElement,
	removeTransitionTargetsInvolvingElement,
	resolveTransitionIncomingElementId,
} from "../../../lib/timeline/transition-pairing";
import { useToast } from "@/composables/useToast";

const { startDrag, wasDragCompleted } = usePointerDrag();

function handlePointerDown(e: PointerEvent, preset: TransitionPreset) {
	const data: TransitionDragData = {
		id: generateUUID(),
		name: preset.label,
		type: "transition",
		transitionType: preset.type,
		duration: preset.defaultDuration,
	};
	startDrag(e, data);
}

const { editor } = useEditor();
const { selectedElements } = useElementSelection();
const { toast } = useToast();

const searchQuery = ref("");

const filteredPresets = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return TRANSITION_PRESETS;
	return TRANSITION_PRESETS.filter(
		(p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
	);
});

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
	return findTransitionForTrackElement({
		transitions: existingTransitions.value,
		track: sel.track,
		elementId: sel.element.id,
	});
});

function applyTransition(preset: TransitionPreset) {
	const sel = selectedElement.value;
	if (!sel) return;

	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return; }
	if (!scene) return;

	const incomingId = resolveTransitionIncomingElementId({
		track: sel.track,
		selectedElementId: sel.element.id,
	});
	if (!incomingId) {
		toast({
			title: "No adjacent video cut",
			description:
				"Transitions sit between two video (or image) clips on the same track. Select a clip that touches the next or previous one within about a second, or split/move clips until they meet.",
			type: "warning",
		});
		return;
	}

	const currentTransitions = [...(scene.transitions ?? [])];
	const filtered = currentTransitions.filter((t) => t.targetElementId !== incomingId);
	filtered.push({
		id: generateUUID(),
		type: preset.type,
		duration: preset.defaultDuration,
		targetElementId: incomingId,
		trackId: sel.trackId,
	});

	const updatedScene = { ...scene, transitions: filtered };
	const scenes = editor.scenes.getScenes().map((s) => s.id === scene.id ? updatedScene : s);
	editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
}

function removeTransition() {
	const sel = selectedElement.value;
	if (!sel) return;

	let scene;
	try { scene = editor.scenes.getActiveScene(); } catch { return; }
	if (!scene) return;

	const filtered = removeTransitionTargetsInvolvingElement({
		transitions: scene.transitions,
		track: sel.track,
		elementId: sel.element.id,
	});
	const updatedScene = { ...scene, transitions: filtered };
	const scenes = editor.scenes.getScenes().map((s) => s.id === scene.id ? updatedScene : s);
	editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
}
</script>

<template>
	<div class="flex h-full flex-col">
		<PanelSearchBar v-model="searchQuery" placeholder="Search transitions..." />

		<div class="flex-1 overflow-y-auto p-2">
			<!-- Active transition -->
			<div v-if="activeTransition" class="mb-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="size-8 shrink-0 overflow-hidden rounded bg-zinc-900">
							<TransitionPreviewCanvas :transition-type="activeTransition.type" />
						</div>
						<div>
							<p class="text-xs font-medium text-zinc-200">{{ activeTransition.type }}</p>
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

			<div v-if="filteredPresets.length === 0" class="flex items-center justify-center py-8">
				<p class="text-xs text-zinc-500">No transitions found</p>
			</div>

			<div v-else class="grid grid-cols-2 gap-1.5">
				<button
					v-for="preset in filteredPresets"
					:key="preset.type"
					class="group relative cursor-grab overflow-hidden rounded-lg border transition-all active:cursor-grabbing active:scale-[0.97]"
					:class="activeTransition?.type === preset.type
						? 'border-white/20 bg-white/[0.06]'
						: 'border-white/[0.06] bg-zinc-950 hover:border-white/15'"
					@click="!wasDragCompleted && applyTransition(preset)"
					@pointerdown="handlePointerDown($event, preset)"
					@dragstart.prevent
				>
					<!-- Preview thumbnail -->
					<div class="aspect-[4/3] w-full overflow-hidden bg-zinc-950">
						<TransitionPreviewCanvas :transition-type="preset.type" />
					</div>
					<!-- Label overlay -->
					<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
						<p class="text-[10px] font-medium leading-tight group-hover:text-white"
							:class="activeTransition?.type === preset.type ? 'text-white' : 'text-zinc-200'">
							{{ preset.label }}
						</p>
					</div>
					<!-- Active checkmark -->
					<div v-if="activeTransition?.type === preset.type" class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-white/20">
						<Check class="size-2.5 text-white" />
					</div>
				</button>
			</div>
		</div>
	</div>
</template>
