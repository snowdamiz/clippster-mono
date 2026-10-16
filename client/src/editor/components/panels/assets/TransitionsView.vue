<script setup lang="ts">
import { ref, computed } from "vue";
import { TRANSITION_PRESETS } from "../../../constants/transition-constants";
import type { TransitionPreset } from "../../../types/transitions";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { ArrowRightLeft, Check, Trash2, SearchX } from "lucide-vue-next";
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
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

const { editor } = useEditor({ subscribe: false });
const { selectedElements } = useElementSelection();
const { toast } = useToast();

const searchQuery = ref("");
const visibleTransitionPresets = computed(() =>
	TRANSITION_PRESETS
		.filter((p) => p.exportSupported)
		.slice()
		.sort((a, b) => a.modernRank - b.modernRank),
);

const filteredPresets = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return visibleTransitionPresets.value;
	return visibleTransitionPresets.value.filter(
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
		<PanelSearchBar v-model="searchQuery" placeholder="Search transitions…" />

		<div class="flex-1 overflow-y-auto p-3">
			<!-- Active transition -->
			<div
				v-if="activeTransition"
				class="mb-3 flex items-center gap-2.5 rounded-lg border border-line-subtle bg-surface-raised p-2"
			>
				<div class="h-9 w-12 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
					<TransitionPreviewCanvas :transition-type="activeTransition.type" />
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-xs font-medium text-fg">{{ activeTransition.type }}</p>
					<p class="tabular text-2xs text-fg-subtle">{{ activeTransition.duration }}s duration</p>
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					class="hover:bg-danger-soft hover:text-danger"
					title="Remove transition"
					aria-label="Remove transition"
					@click="removeTransition"
				>
					<Trash2 />
				</Button>
			</div>

			<EmptyState
				v-if="filteredPresets.length === 0"
				size="sm"
				:icon="SearchX"
				title="No transitions found"
				description="Try a different search term."
			/>

			<AssetGrid v-else :min="88">
				<AssetTile
					v-for="preset in filteredPresets"
					:key="preset.type"
					:label="preset.label"
					:selected="activeTransition?.type === preset.type"
					class="cursor-grab active:cursor-grabbing"
					:title="`Drag ${preset.label} between two clips or click to apply`"
					@click="!wasDragCompleted && applyTransition(preset)"
					@pointerdown="handlePointerDown($event, preset)"
					@dragstart.prevent
				>
					<TransitionPreviewCanvas :transition-type="preset.type" />
				</AssetTile>
			</AssetGrid>
		</div>
	</div>
</template>
